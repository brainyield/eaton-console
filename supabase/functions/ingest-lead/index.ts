// Lead Ingest API
// Endpoint for n8n to POST leads from various sources:
// - Exit intent forms
// - Waitlist forms
// - Any future lead sources

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

interface ExitIntentPayload {
  lead_type: 'exit_intent'
  email: string
  name?: string
  source_url?: string
}

interface WaitlistPayload {
  lead_type: 'waitlist'
  email: string
  name?: string
  source_url?: string
  // Waitlist-specific fields
  num_children?: number
  children_ages?: string
  preferred_days?: string
  preferred_time?: string
  service_interest?: string
  notes?: string
}

type LeadPayload = ExitIntentPayload | WaitlistPayload

// Name suffixes that should not be treated as last names
const NAME_SUFFIXES = ['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v', 'esq', 'esq.', 'phd', 'md', 'dds']

// Format name as "LastName, FirstName" or use email prefix
// Handles:
// - Already comma-formatted names (returns as-is)
// - "XYZ Family" format (strips " Family" suffix)
// - Name suffixes like Jr., Sr., III (preserves them)
function formatFamilyName(name: string | undefined, email: string): string {
  if (name) {
    const trimmed = name.trim()

    // Already formatted with comma
    if (trimmed.includes(',')) {
      return trimmed
    }

    // Handle "XYZ Family" format - strip " Family" suffix
    if (trimmed.endsWith(' Family')) {
      return trimmed.slice(0, -7) // Remove " Family" (7 chars)
    }

    const parts = trimmed.split(/\s+/)
    if (parts.length === 1) {
      return parts[0]
    }

    // Check if the last part is a name suffix (Jr., Sr., III, etc.)
    let suffix = ''
    if (parts.length > 2 && NAME_SUFFIXES.includes(parts[parts.length - 1].toLowerCase())) {
      suffix = ' ' + parts.pop()!
    }

    const lastName = parts.pop()!
    const firstName = parts.join(' ')
    return `${lastName}, ${firstName}${suffix}`
  }
  // Use email prefix as fallback
  const emailPrefix = email.split('@')[0]
  return `${emailPrefix} (Lead)`
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const apiKey = Deno.env.get('LEAD_INGEST_API_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase configuration missing')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Optional API key verification (if configured)
    if (apiKey) {
      const providedKey = req.headers.get('x-api-key')
      if (providedKey !== apiKey) {
        return new Response(
          JSON.stringify({ error: 'Invalid API key' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const payload: LeadPayload = await req.json()

    // Validate required fields
    if (!payload.email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!payload.lead_type || !['exit_intent', 'waitlist'].includes(payload.lead_type)) {
      return new Response(
        JSON.stringify({ error: 'Valid lead_type is required (exit_intent or waitlist)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const email = payload.email.toLowerCase().trim()

    // Check for existing lead with same email (any type, any status)
    // This prevents duplicate leads for the same person
    const { data: existingLeads, error: leadsQueryError } = await supabase
      .from('leads')
      .select('id, status, family_id, lead_type')
      .ilike('email', email)
      .order('created_at', { ascending: false })

    if (leadsQueryError) {
      console.error('Error querying existing leads:', leadsQueryError)
    }

    if (existingLeads && existingLeads.length > 0) {
      // Check if there's an active lead (new or contacted)
      const activeLead = existingLeads.find(l => l.status === 'new' || l.status === 'contacted')

      if (activeLead) {
        console.log(`Active lead already exists for ${email}: ${activeLead.id} (${activeLead.lead_type})`)

        // Log this repeat touchpoint as activity (so we track all interactions)
        const { error: activityError } = await supabase
          .from('lead_activities')
          .insert({
            lead_id: activeLead.id,
            contact_type: 'other',
            notes: `Repeat ${payload.lead_type} form submission${payload.source_url ? ` from ${payload.source_url}` : ''}`,
            contacted_at: new Date().toISOString(),
          })

        if (activityError) {
          console.error('Error logging activity for existing lead:', activityError)
        } else {
          console.log('Logged repeat touchpoint activity for lead:', activeLead.id)
        }

        return new Response(
          JSON.stringify({
            success: true,
            action: 'exists',
            leadId: activeLead.id,
            familyId: activeLead.family_id,
            message: `Lead already exists in pipeline (${activeLead.lead_type}). Activity logged.`,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // If only converted/closed leads exist, allow creating a new one
      // This handles re-engagement of past leads
      console.log(`Email ${email} has ${existingLeads.length} past lead(s), creating new lead`)
    }

    // Check if email matches existing family
    let familyId: string | null = null
    let familyAction: 'existing' | 'created' = 'existing'

    const { data: existingFamily, error: familyQueryError } = await supabase
      .from('families')
      .select('id, status')
      .ilike('primary_email', email)
      .maybeSingle()

    if (familyQueryError) {
      console.error('Error querying existing family:', familyQueryError)
    }

    if (existingFamily) {
      familyId = existingFamily.id
      console.log(`Found existing family: ${familyId}`)

      // Check if family has active/trial enrollments (meaning they're already a customer)
      const { data: activeEnrollments } = await supabase
        .from('enrollments')
        .select('id')
        .eq('family_id', familyId)
        .in('status', ['active', 'trial'])
        .limit(1)

      if (activeEnrollments && activeEnrollments.length > 0) {
        console.log(`Family ${familyId} has active enrollment - skipping lead creation`)
        return new Response(
          JSON.stringify({
            success: true,
            action: 'skipped',
            familyId,
            message: 'Family already has active enrollment - not creating lead',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      // Create a new family with status='lead'
      const { data: newFamily, error: familyError } = await supabase
        .from('families')
        .insert({
          display_name: formatFamilyName(payload.name, email),
          primary_email: email,
          primary_contact_name: payload.name || null,
          status: 'lead',
          notes: `Lead source: ${payload.lead_type}${payload.source_url ? ` from ${payload.source_url}` : ''}`,
        })
        .select('id')
        .single()

      if (familyError) {
        console.error('Error creating family:', familyError)
        throw familyError
      }

      familyId = newFamily.id
      familyAction = 'created'
      console.log(`Created new family as lead: ${familyId}`)
    }

    // Build lead record
    const leadRecord: Record<string, unknown> = {
      email,
      name: payload.name || null,
      lead_type: payload.lead_type,
      status: 'new',
      source_url: payload.source_url || null,
      family_id: familyId,
    }

    // Add waitlist-specific fields
    if (payload.lead_type === 'waitlist') {
      const waitlistPayload = payload as WaitlistPayload
      leadRecord.num_children = waitlistPayload.num_children || null
      leadRecord.children_ages = waitlistPayload.children_ages || null
      leadRecord.preferred_days = waitlistPayload.preferred_days || null
      leadRecord.preferred_time = waitlistPayload.preferred_time || null
      leadRecord.service_interest = waitlistPayload.service_interest || null
      leadRecord.notes = waitlistPayload.notes || null
    }

    // Insert lead
    const { data: newLead, error } = await supabase
      .from('leads')
      .insert(leadRecord)
      .select('id')
      .single()

    if (error) {
      console.error('Error creating lead:', error)
      throw error
    }

    console.log(`Created lead: ${newLead.id} (${payload.lead_type})`)

    return new Response(
      JSON.stringify({
        success: true,
        action: 'created',
        leadId: newLead.id,
        leadType: payload.lead_type,
        familyId,
        familyAction,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Ingest error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
