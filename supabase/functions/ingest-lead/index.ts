// Lead Ingest API
// Endpoint for n8n to POST leads from various sources:
// - Exit intent forms
// - Waitlist forms
// - Any future lead sources
//
// Leads are stored as families with status='lead' and lead_status tracking pipeline stage

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

    // Check if email matches existing family
    const { data: existingFamily, error: familyQueryError } = await supabase
      .from('families')
      .select('id, status, lead_status, lead_type')
      .ilike('primary_email', email)
      .maybeSingle()

    if (familyQueryError) {
      console.error('Error querying existing family:', familyQueryError)
    }

    if (existingFamily) {
      // Check if this is an active lead (status='lead' with lead_status='new' or 'contacted')
      if (existingFamily.status === 'lead' &&
          (existingFamily.lead_status === 'new' || existingFamily.lead_status === 'contacted')) {
        console.log(`Active lead already exists for ${email}: ${existingFamily.id} (${existingFamily.lead_type})`)

        // Log this repeat touchpoint as activity (so we track all interactions)
        const { error: activityError } = await supabase
          .from('lead_activities')
          .insert({
            family_id: existingFamily.id,
            contact_type: 'other',
            notes: `Repeat ${payload.lead_type} form submission${payload.source_url ? ` from ${payload.source_url}` : ''}`,
            contacted_at: new Date().toISOString(),
          })

        if (activityError) {
          console.error('Error logging activity for existing lead:', activityError)
        } else {
          console.log('Logged repeat touchpoint activity for lead:', existingFamily.id)
        }

        return new Response(
          JSON.stringify({
            success: true,
            action: 'exists',
            familyId: existingFamily.id,
            message: `Lead already exists in pipeline (${existingFamily.lead_type}). Activity logged.`,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check if family has active/trial enrollments (meaning they're already a customer)
      const { data: activeEnrollments } = await supabase
        .from('enrollments')
        .select('id')
        .eq('family_id', existingFamily.id)
        .in('status', ['active', 'trial'])
        .limit(1)

      if (activeEnrollments && activeEnrollments.length > 0) {
        console.log(`Family ${existingFamily.id} has active enrollment - skipping lead creation`)
        return new Response(
          JSON.stringify({
            success: true,
            action: 'skipped',
            familyId: existingFamily.id,
            message: 'Family already has active enrollment - not creating lead',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Family exists but is not an active lead and has no enrollments
      // This could be a past customer re-engaging - update to lead status
      console.log(`Email ${email} has existing family ${existingFamily.id}, updating to lead`)

      const updateData: Record<string, unknown> = {
        status: 'lead',
        lead_status: 'new',
        lead_type: payload.lead_type,
        source_url: payload.source_url || null,
      }

      // Add waitlist-specific fields
      if (payload.lead_type === 'waitlist') {
        const waitlistPayload = payload as WaitlistPayload
        updateData.num_children = waitlistPayload.num_children || null
        updateData.children_ages = waitlistPayload.children_ages || null
        updateData.service_interest = waitlistPayload.service_interest || null
        if (waitlistPayload.notes) {
          updateData.notes = waitlistPayload.notes
        }
      }

      const { error: updateError } = await supabase
        .from('families')
        .update(updateData)
        .eq('id', existingFamily.id)

      if (updateError) {
        console.error('Error updating family to lead:', updateError)
        throw updateError
      }

      console.log(`Updated family ${existingFamily.id} to lead (${payload.lead_type})`)

      return new Response(
        JSON.stringify({
          success: true,
          action: 'reactivated',
          familyId: existingFamily.id,
          leadType: payload.lead_type,
          message: 'Existing family reactivated as lead',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // No existing family - create a new one with status='lead'
    const familyData: Record<string, unknown> = {
      display_name: formatFamilyName(payload.name, email),
      primary_email: email,
      primary_contact_name: payload.name || null,
      status: 'lead',
      lead_status: 'new',
      lead_type: payload.lead_type,
      source_url: payload.source_url || null,
      notes: `Lead source: ${payload.lead_type}${payload.source_url ? ` from ${payload.source_url}` : ''}`,
    }

    // Add waitlist-specific fields
    if (payload.lead_type === 'waitlist') {
      const waitlistPayload = payload as WaitlistPayload
      familyData.num_children = waitlistPayload.num_children || null
      familyData.children_ages = waitlistPayload.children_ages || null
      familyData.service_interest = waitlistPayload.service_interest || null
      if (waitlistPayload.notes) {
        familyData.notes = waitlistPayload.notes
      }
    }

    const { data: newFamily, error: familyError } = await supabase
      .from('families')
      .insert(familyData)
      .select('id')
      .single()

    if (familyError) {
      console.error('Error creating family:', familyError)
      throw familyError
    }

    console.log(`Created new family as lead: ${newFamily.id} (${payload.lead_type})`)

    return new Response(
      JSON.stringify({
        success: true,
        action: 'created',
        familyId: newFamily.id,
        leadType: payload.lead_type,
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
