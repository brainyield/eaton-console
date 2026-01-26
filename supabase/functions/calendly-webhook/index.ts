// Calendly Webhook Handler
// Handles invitee.created and invitee.canceled events
//
// Leads are stored as families with status='lead' and lead_status tracking pipeline stage

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase configuration missing')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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
    // Phone can come from text_reminder_number (SMS reminders) or form answers
    const inviteePhoneFromReminder = safeString(inviteeData.text_reminder_number || data.text_reminder_number)

    // Extract event fields
    const scheduledEventUri = safeString(scheduledEventData.uri)
    const startTime = safeString(scheduledEventData.start_time || data.start_time)
    const eventName = safeString(scheduledEventData.name || data.event_name || '')

    // Extract phone from location field (for outbound_call type events)
    const locationData = (scheduledEventData.location || {}) as Record<string, unknown>
    const locationType = safeString(locationData.type)
    const locationValue = safeString(locationData.location)
    const phoneFromLocation = locationType === 'outbound_call' ? locationValue : ''

    console.log('Extracted data:', {
      eventType,
      inviteeName,
      inviteeEmail,
      inviteeUri,
      inviteePhoneFromReminder,
      phoneFromLocation,
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

    // Prefer phone from location (outbound_call), then text reminder, then form answers
    const inviteePhone = phoneFromLocation || inviteePhoneFromReminder || formAnswers.phone || null
    console.log('Resolved phone:', inviteePhone)

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

      if (error) {
        console.error('Error updating canceled booking:', error)
        return new Response(JSON.stringify({ success: false, error: 'Failed to update booking' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

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
        const { error: errorRecordError } = await supabase.from('calendly_bookings').insert({
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
        if (errorRecordError) {
          console.error('Failed to save error record:', errorRecordError)
        }
        return new Response(JSON.stringify({ error: 'Missing invitee email' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      let familyId: string | null = null

      // Check for existing family by email (primary or secondary)
      let existingFamily: { id: string; status: string; lead_status: string | null; lead_type: string | null; primary_phone: string | null; primary_email: string | null } | null = null
      let matchedBy = 'email'

      const { data: emailMatch, error: familyQueryError } = await supabase
        .from('families')
        .select('id, status, lead_status, lead_type, primary_phone, primary_email')
        .or(`primary_email.ilike.${inviteeEmail},secondary_email.ilike.${inviteeEmail}`)
        .order('status', { ascending: true }) // 'active' before 'lead'
        .limit(1)
        .maybeSingle()

      if (familyQueryError) {
        console.error('Error querying existing family by email:', familyQueryError)
      }

      if (emailMatch) {
        existingFamily = emailMatch
      }

      // If no email match AND name has first and last name, try name-based matching
      if (!existingFamily && inviteeName && inviteeName.trim().includes(' ')) {
        const normalizedName = formatFamilyName(inviteeName).toLowerCase()

        // Only match if name is in "Last, First" format (has comma)
        if (normalizedName.includes(',')) {
          const { data: nameMatch, error: nameQueryError } = await supabase
            .from('families')
            .select('id, status, lead_status, lead_type, primary_phone, primary_email')
            .ilike('display_name', normalizedName)
            .in('status', ['active', 'lead'])
            .order('status', { ascending: true }) // 'active' before 'lead'
            .limit(1)
            .maybeSingle()

          if (nameQueryError) {
            console.error('Error querying family by name:', nameQueryError)
          }

          if (nameMatch) {
            console.log(`Name-based match found for "${inviteeName}": family ${nameMatch.id} (${nameMatch.primary_email})`)
            existingFamily = nameMatch
            matchedBy = 'name'

            // Log the name-based match for audit
            const { error: logError } = await supabase
              .from('family_merge_log')
              .insert({
                family_id: nameMatch.id,
                matched_by: 'name',
                original_email: nameMatch.primary_email,
                new_email: inviteeEmail,
                purchaser_name: inviteeName,
                source: 'calendly_webhook',
                source_id: scheduledEventUri || null,
              })

            if (logError) {
              console.error('Error logging name match:', logError)
            }

            // Store new email as secondary if not already stored
            if (nameMatch.primary_email?.toLowerCase() !== inviteeEmail) {
              const { error: updateError } = await supabase
                .from('families')
                .update({ secondary_email: inviteeEmail })
                .eq('id', nameMatch.id)
                .is('secondary_email', null)

              if (updateError) {
                console.error('Error updating secondary email:', updateError)
              } else {
                console.log(`Stored secondary email ${inviteeEmail} on family ${nameMatch.id}`)
              }
            }
          }
        }
      }

      let hasActiveEnrollment = false

      if (existingFamily) {
        familyId = existingFamily.id
        console.log('Found existing family:', familyId, 'status:', existingFamily.status, 'matched by:', matchedBy)

        const { data: enrollments, error: enrollmentsError } = await supabase
          .from('enrollments')
          .select('id')
          .eq('family_id', familyId)
          .in('status', ['active', 'trial'])
          .limit(1)

        if (enrollmentsError) {
          console.error('Error querying enrollments:', enrollmentsError)
        }

        hasActiveEnrollment = (enrollments?.length || 0) > 0
      }

      // For 15min calls, create or update family as lead (if not already a customer)
      if (bookingType === '15min_call' && !hasActiveEnrollment) {
        if (existingFamily) {
          // Check if this is an active lead
          const isActiveLead = existingFamily.status === 'lead' &&
            (existingFamily.lead_status === 'new' || existingFamily.lead_status === 'contacted')

          if (isActiveLead) {
            // Existing active lead found - update calendly info and log activity
            console.log(`Found existing active lead for ${inviteeEmail}: ${familyId} (${existingFamily.lead_type})`)

            // Update family with calendly info
            const { error: updateError } = await supabase
              .from('families')
              .update({
                calendly_event_uri: scheduledEventUri || null,
                calendly_invitee_uri: inviteeUri || null,
                scheduled_at: startTime || null,
                primary_phone: inviteePhone || existingFamily.primary_phone || null,
              })
              .eq('id', familyId)

            if (updateError) {
              console.error('Error updating existing lead family:', updateError)
            }

            // Log this touchpoint as activity
            const { error: activityError } = await supabase
              .from('lead_activities')
              .insert({
                family_id: familyId,
                contact_type: 'other',
                notes: `Repeat Calendly booking (${bookingType}): scheduled for ${startTime || 'unknown time'}`,
                contacted_at: new Date().toISOString(),
              })

            if (activityError) {
              console.error('Error logging activity for existing lead:', activityError)
            } else {
              console.log('Logged activity for existing lead:', familyId)
            }
          } else {
            // Family exists but not active lead - update to lead status with calendly info
            console.log(`Updating family ${familyId} to lead with calendly info`)

            const { error: updateError } = await supabase
              .from('families')
              .update({
                status: 'lead',
                lead_status: 'new',
                lead_type: 'calendly_call',
                calendly_event_uri: scheduledEventUri || null,
                calendly_invitee_uri: inviteeUri || null,
                scheduled_at: startTime || null,
                primary_phone: inviteePhone || existingFamily.primary_phone || null,
              })
              .eq('id', familyId)

            if (updateError) {
              console.error('Error updating family to lead:', updateError)
            }
          }
        } else {
          // No existing family - create new one as lead
          const { data: newFamily, error: familyError } = await supabase
            .from('families')
            .insert({
              display_name: formatFamilyName(inviteeName),
              primary_email: inviteeEmail,
              primary_phone: inviteePhone || null,
              primary_contact_name: inviteeName || null,
              status: 'lead',
              lead_status: 'new',
              lead_type: 'calendly_call',
              calendly_event_uri: scheduledEventUri || null,
              calendly_invitee_uri: inviteeUri || null,
              scheduled_at: startTime || null,
            })
            .select('id')
            .single()

          if (familyError) {
            console.error('Error creating family:', familyError)
          } else {
            familyId = newFamily.id
            console.log('Created family as lead:', familyId)
          }
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
          invitee_phone: inviteePhone || null,
          scheduled_at: startTime || null,
          status: 'scheduled',
          family_id: familyId,
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
