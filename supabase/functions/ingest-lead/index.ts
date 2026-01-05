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

// Format name as "LastName Family" or use email prefix
function formatFamilyName(name: string | undefined, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    const lastName = parts[parts.length - 1]
    return `${lastName} Family`
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const apiKey = Deno.env.get('LEAD_INGEST_API_KEY')

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

    // Check for existing lead with same email and type (avoid duplicates)
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id, status, family_id')
      .eq('email', email)
      .eq('lead_type', payload.lead_type)
      .in('status', ['new', 'contacted'])
      .single()

    if (existingLead) {
      console.log(`Lead already exists: ${existingLead.id}`)
      return new Response(
        JSON.stringify({
          success: true,
          action: 'exists',
          leadId: existingLead.id,
          familyId: existingLead.family_id,
          message: 'Lead already exists in pipeline',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if email matches existing family
    let familyId: string | null = null
    let familyAction: 'existing' | 'created' = 'existing'

    const { data: existingFamily } = await supabase
      .from('families')
      .select('id, status')
      .ilike('primary_email', email)
      .single()

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
