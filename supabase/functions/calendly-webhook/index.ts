// Calendly Webhook Handler
// Handles invitee.created and invitee.canceled events

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, calendly-webhook-signature',
}

// Safe string helper
function safeString(val: unknown): string {
  if (typeof val === 'string') return val
  if (val === null || val === undefined) return ''
  return String(val)
}

// Name suffixes that should not be treated as last names
const NAME_SUFFIXES = ['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v', 'esq', 'esq.', 'phd', 'md', 'dds']

// Format name as "LastName, FirstName" - with null safety
// Handles:
// - Already comma-formatted names (returns as-is)
// - "XYZ Family" format (strips " Family" suffix)
// - Name suffixes like Jr., Sr., III (preserves them)
function formatFamilyName(fullName: string | null | undefined): string {
  if (!fullName) return 'Unknown'
  const trimmed = fullName.trim()
  if (!trimmed) return 'Unknown'

  // Already formatted with comma
  if (trimmed.includes(',')) {
    return trimmed
  }

  // Handle "XYZ Family" format - strip " Family" suffix
  if (trimmed.endsWith(' Family')) {
    return trimmed.slice(0, -7) // Remove " Family" (7 chars)
  }

  const parts = trimmed.split(/\s+/)
  if (parts.length === 0) return 'Unknown'
  if (parts.length === 1) return parts[0]

  // Check if the last part is a name suffix (Jr., Sr., III, etc.)
  let suffix = ''
  if (parts.length > 2 && NAME_SUFFIXES.includes(parts[parts.length - 1].toLowerCase())) {
    suffix = ' ' + parts.pop()!
  }

  const lastName = parts.pop()!
  const firstName = parts.join(' ')
  return `${lastName}, ${firstName}${suffix}`
}

// Extract form answers with null safety
function extractFormAnswers(data: Record<string, unknown>): Record<string, string> {
  const answers: Record<string, string> = {}

  // Try multiple possible locations for questions_and_answers
  const qna = (data?.questions_and_answers || data?.invitee?.questions_and_answers || []) as Array<{
    question?: string
    answer?: string
  }>

  if (!Array.isArray(qna)) return answers

  for (const qa of qna) {
    const question = safeString(qa?.question).toLowerCase()
    const answer = safeString(qa?.answer)

    if (question.includes('student name') || question.includes('child name')) {
      answers.studentName = answer
    } else if (question.includes('age') || question.includes('age group')) {
      answers.studentAgeGroup = answer
    } else if (question.includes('paying') || question.includes('payment')) {
      answers.paymentMethod = answer
    } else if (question.includes('phone')) {
      answers.phone = answer
    }
  }

  return answers
}

Deno.serve(async (req) => {
  console.log('=== CALENDLY WEBHOOK ===')
  console.log('Method:', req.method)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let rawPayload: Record<string, unknown> = {}

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const rawBody = await req.text()
    console.log('Raw body:', rawBody)

    rawPayload = JSON.parse(rawBody)
    console.log('Parsed payload keys:', Object.keys(rawPayload))

    const eventType = safeString(rawPayload.event)
    const data = (rawPayload.payload || {}) as Record<string, unknown>
    console.log('Payload.payload keys:', Object.keys(data))

    // Calendly v2 API might have data directly in payload OR in nested objects
    // Let's extract what we can from various possible locations

    // Try to get invitee info from multiple locations
    const inviteeData = (data.invitee || {}) as Record<string, unknown>
    const scheduledEventData = (data.scheduled_event || data.event || {}) as Record<string, unknown>

    // Extract invitee fields - could be in invitee object OR directly in payload
    const inviteeName = safeString(inviteeData.name || data.name)
    const inviteeEmail = safeString(inviteeData.email || data.email).toLowerCase()
    const inviteeUri = safeString(inviteeData.uri || data.uri)
    // Timezone available if needed: safeString(inviteeData.timezone || data.timezone)

    // Extract event fields
    const scheduledEventUri = safeString(scheduledEventData.uri)
    const startTime = safeString(scheduledEventData.start_time || data.start_time)
    const eventName = safeString(scheduledEventData.name || data.event_name || '')

    console.log('Extracted data:', {
      eventType,
      inviteeName,
      inviteeEmail,
      inviteeUri,
      scheduledEventUri,
      startTime,
      eventName,
    })

    // Determine if hub_dropoff or 15min_call based on event name
    const isHubDropoff = eventName.toLowerCase().includes('hub') || eventName.toLowerCase().includes('drop')
    const bookingType = isHubDropoff ? 'hub_dropoff' : '15min_call'

    // Extract form answers
    const formAnswers = extractFormAnswers(data)
    console.log('Form answers:', formAnswers)

    // Handle cancellation
    if (eventType === 'invitee.canceled') {
      const cancelReason = safeString((inviteeData.cancellation as Record<string, unknown>)?.reason || '')

      const { error } = await supabase
        .from('calendly_bookings')
        .update({
          status: 'canceled',
          canceled_at: new Date().toISOString(),
          cancel_reason: cancelReason || null,
        })
        .eq('calendly_invitee_uri', inviteeUri)

      if (error) console.error('Error updating canceled booking:', error)

      return new Response(JSON.stringify({ success: true, action: 'canceled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Handle new booking
    if (eventType === 'invitee.created') {
      // Validate we have minimum required data
      if (!inviteeEmail) {
        console.error('Missing invitee email - cannot process')
        // Still save the raw payload so we can debug
        await supabase.from('calendly_bookings').insert({
          calendly_event_uri: scheduledEventUri || 'unknown',
          calendly_invitee_uri: inviteeUri || `unknown-${Date.now()}`,
          event_type: '15min_call',
          invitee_email: 'unknown@error.com',
          invitee_name: 'WEBHOOK ERROR - Missing email',
          scheduled_at: startTime || new Date().toISOString(),
          status: 'scheduled',
          raw_payload: rawPayload,
          notes: 'Error: Could not extract invitee email from webhook payload',
        })
        return new Response(JSON.stringify({ error: 'Missing invitee email' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      let familyId: string | null = null
      let leadId: string | null = null

      // Check for existing family
      const { data: existingFamily } = await supabase
        .from('families')
        .select('id')
        .ilike('primary_email', inviteeEmail)
        .maybeSingle()

      let hasActiveEnrollment = false

      if (existingFamily) {
        familyId = existingFamily.id
        console.log('Found existing family:', familyId)

        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('id')
          .eq('family_id', familyId)
          .in('status', ['active', 'trial'])
          .limit(1)

        hasActiveEnrollment = (enrollments?.length || 0) > 0
      }

      // For 15min calls, create family and lead
      if (bookingType === '15min_call' && !hasActiveEnrollment) {
        if (!familyId) {
          const { data: newFamily, error: familyError } = await supabase
            .from('families')
            .insert({
              display_name: formatFamilyName(inviteeName),
              primary_email: inviteeEmail,
              primary_phone: formAnswers.phone || null,
              primary_contact_name: inviteeName || null,
              status: 'lead',
            })
            .select('id')
            .single()

          if (familyError) {
            console.error('Error creating family:', familyError)
          } else {
            familyId = newFamily.id
            console.log('Created family:', familyId)
          }
        }

        // Create lead
        const { data: newLead, error: leadError } = await supabase
          .from('leads')
          .insert({
            email: inviteeEmail,
            name: inviteeName || null,
            phone: formAnswers.phone || null,
            lead_type: 'calendly_call',
            status: 'new',
            calendly_event_uri: scheduledEventUri || null,
            calendly_invitee_uri: inviteeUri || null,
            scheduled_at: startTime || null,
            family_id: familyId,
          })
          .select('id')
          .single()

        if (leadError) {
          console.error('Error creating lead:', leadError)
        } else {
          leadId = newLead.id
          console.log('Created lead:', leadId)
        }
      }

      // Create calendly_booking record
      const { error: bookingError } = await supabase
        .from('calendly_bookings')
        .insert({
          calendly_event_uri: scheduledEventUri || null,
          calendly_invitee_uri: inviteeUri || null,
          event_type: bookingType,
          invitee_email: inviteeEmail,
          invitee_name: inviteeName || null,
          invitee_phone: formAnswers.phone || null,
          scheduled_at: startTime || null,
          status: 'scheduled',
          family_id: familyId,
          lead_id: leadId,
          student_name: formAnswers.studentName || null,
          student_age_group: formAnswers.studentAgeGroup || null,
          payment_method: formAnswers.paymentMethod || null,
          raw_payload: rawPayload,
        })

      if (bookingError) {
        console.error('Error creating booking:', bookingError)
        throw bookingError
      }

      console.log('SUCCESS - Booking created')

      return new Response(
        JSON.stringify({
          success: true,
          action: 'created',
          eventType: bookingType,
          familyId,
          leadId,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Unknown event
    return new Response(
      JSON.stringify({ success: true, action: 'ignored', reason: 'Unknown event type: ' + eventType }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Webhook error:', error)

    // Try to save the error for debugging
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        await supabase.from('calendly_bookings').insert({
          calendly_event_uri: 'error-' + Date.now(),
          calendly_invitee_uri: 'error-' + Date.now(),
          event_type: '15min_call',
          invitee_email: 'webhook-error@debug.com',
          invitee_name: 'WEBHOOK ERROR',
          scheduled_at: new Date().toISOString(),
          status: 'scheduled',
          raw_payload: rawPayload,
          notes: 'Error: ' + (error as Error).message,
        })
      }
    } catch (e) {
      console.error('Failed to save error record:', e)
    }

    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
