// Calendly Webhook Handler
// Handles invitee.created and invitee.canceled events
// - 15min calls: Creates leads for follow-up
// - Hub drop-offs: Auto-creates family, student, and hub_session

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.177.0/node/crypto.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, calendly-webhook-signature',
}

// Calendly event type URIs contain these slugs
const EVENT_TYPE_SLUGS = {
  CALL_15MIN: '15min',
  HUB_DROPOFF: 'eaton-hub-drop-off',
}

interface CalendlyInvitee {
  uri: string
  email: string
  name: string
  status: string
  timezone: string
  created_at: string
  updated_at: string
  canceled: boolean
  cancellation?: {
    canceled_by: string
    reason: string
  }
  questions_and_answers?: Array<{
    question: string
    answer: string
    position: number
  }>
}

interface CalendlyEvent {
  uri: string
  name: string
  status: string
  start_time: string
  end_time: string
  event_type: string
  location?: {
    type: string
    location?: string
  }
}

interface CalendlyPayload {
  event: string // 'invitee.created' | 'invitee.canceled'
  payload: {
    event: CalendlyEvent
    invitee: CalendlyInvitee
    event_type: {
      uri: string
      name: string
      slug: string
    }
  }
}

// Verify Calendly webhook signature
function verifySignature(payload: string, signature: string, signingKey: string): boolean {
  // Calendly sends signature in format: t=timestamp,v1=signature
  const parts = signature.split(',')
  const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1]
  const v1Signature = parts.find(p => p.startsWith('v1='))?.split('=')[1]

  if (!timestamp || !v1Signature) {
    console.error('Invalid signature format')
    return false
  }

  // Check timestamp is within 5 minutes
  const timestampMs = parseInt(timestamp) * 1000
  const now = Date.now()
  if (Math.abs(now - timestampMs) > 5 * 60 * 1000) {
    console.error('Signature timestamp too old')
    return false
  }

  // Calculate expected signature
  const signedPayload = `${timestamp}.${payload}`
  const expectedSignature = createHmac('sha256', signingKey)
    .update(signedPayload)
    .digest('hex')

  return v1Signature === expectedSignature
}

// Extract custom form answers from Calendly payload
function extractFormAnswers(invitee: CalendlyInvitee): Record<string, string> {
  const answers: Record<string, string> = {}

  if (!invitee.questions_and_answers) return answers

  for (const qa of invitee.questions_and_answers) {
    const question = qa.question.toLowerCase()

    if (question.includes('student name') || question.includes('child name')) {
      answers.studentName = qa.answer
    } else if (question.includes('age') || question.includes('age group')) {
      answers.studentAgeGroup = qa.answer
    } else if (question.includes('paying') || question.includes('payment')) {
      answers.paymentMethod = qa.answer
    } else if (question.includes('phone')) {
      answers.phone = qa.answer
    }
  }

  return answers
}

// Determine event type from Calendly event URI
function getEventType(eventTypeUri: string): 'hub_dropoff' | '15min_call' | 'unknown' {
  if (eventTypeUri.includes(EVENT_TYPE_SLUGS.HUB_DROPOFF)) {
    return 'hub_dropoff'
  }
  if (eventTypeUri.includes(EVENT_TYPE_SLUGS.CALL_15MIN)) {
    return '15min_call'
  }
  return 'unknown'
}

// Format name as "LastName Family"
function formatFamilyName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  const lastName = parts[parts.length - 1]
  return `${lastName} Family`
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const calendlySigningKey = Deno.env.get('CALENDLY_WEBHOOK_SIGNING_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get raw body for signature verification
    const rawBody = await req.text()
    const signature = req.headers.get('calendly-webhook-signature')

    // Verify signature (skip in development if no signature)
    if (signature && calendlySigningKey) {
      if (!verifySignature(rawBody, signature, calendlySigningKey)) {
        console.error('Invalid webhook signature')
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const payload: CalendlyPayload = JSON.parse(rawBody)
    const { event, payload: data } = payload

    console.log(`Processing Calendly event: ${event}`, {
      eventType: data.event_type.name,
      inviteeEmail: data.invitee.email,
    })

    const eventType = getEventType(data.event_type.uri)
    const formAnswers = extractFormAnswers(data.invitee)
    const inviteeEmail = data.invitee.email.toLowerCase()
    const scheduledAt = data.event.start_time

    // Handle cancellation
    if (event === 'invitee.canceled') {
      // Update existing booking to canceled
      const { error } = await supabase
        .from('calendly_bookings')
        .update({
          status: 'canceled',
          canceled_at: new Date().toISOString(),
          cancel_reason: data.invitee.cancellation?.reason || null,
        })
        .eq('calendly_invitee_uri', data.invitee.uri)

      if (error) {
        console.error('Error updating canceled booking:', error)
      }

      return new Response(JSON.stringify({ success: true, action: 'canceled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Handle new booking (invitee.created)
    if (event === 'invitee.created') {
      let familyId: string | null = null
      let studentId: string | null = null
      let hubSessionId: string | null = null
      let leadId: string | null = null

      // Check for existing family by email
      const { data: existingFamily } = await supabase
        .from('families')
        .select('id')
        .ilike('primary_email', inviteeEmail)
        .single()

      if (existingFamily) {
        familyId = existingFamily.id
        console.log(`Found existing family: ${familyId}`)
      }

      if (eventType === 'hub_dropoff') {
        // HUB DROP-OFF: Auto-create family, student, hub_session

        // 1. Create family if not exists
        if (!familyId) {
          const { data: newFamily, error: familyError } = await supabase
            .from('families')
            .insert({
              display_name: formatFamilyName(data.invitee.name),
              primary_email: inviteeEmail,
              primary_phone: formAnswers.phone || null,
              primary_contact_name: data.invitee.name,
              status: 'active',
              payment_gateway: formAnswers.paymentMethod || null,
            })
            .select('id')
            .single()

          if (familyError) {
            console.error('Error creating family:', familyError)
            throw familyError
          }
          familyId = newFamily.id
          console.log(`Created new family: ${familyId}`)
        }

        // 2. Find or create student
        if (formAnswers.studentName) {
          // Check for existing student in this family
          const { data: existingStudent } = await supabase
            .from('students')
            .select('id')
            .eq('family_id', familyId)
            .ilike('full_name', formAnswers.studentName)
            .single()

          if (existingStudent) {
            studentId = existingStudent.id
            console.log(`Found existing student: ${studentId}`)
          } else {
            // Create new student
            const { data: newStudent, error: studentError } = await supabase
              .from('students')
              .insert({
                family_id: familyId,
                full_name: formAnswers.studentName,
                age_group: formAnswers.studentAgeGroup || null,
                active: true,
              })
              .select('id')
              .single()

            if (studentError) {
              console.error('Error creating student:', studentError)
              throw studentError
            }
            studentId = newStudent.id
            console.log(`Created new student: ${studentId}`)
          }
        }

        // 3. Get hub daily rate from settings
        const { data: hubRateSetting } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'hub_daily_rate')
          .single()

        const dailyRate = hubRateSetting?.value ? parseFloat(hubRateSetting.value) : 100.0

        // 4. Create hub_session for the scheduled date
        const sessionDate = new Date(scheduledAt).toISOString().split('T')[0]

        const { data: hubSession, error: sessionError } = await supabase
          .from('hub_sessions')
          .insert({
            student_id: studentId,
            session_date: sessionDate,
            daily_rate: dailyRate,
            notes: `Booked via Calendly. Payment method: ${formAnswers.paymentMethod || 'Not specified'}`,
          })
          .select('id')
          .single()

        if (sessionError) {
          console.error('Error creating hub session:', sessionError)
          throw sessionError
        }
        hubSessionId = hubSession.id
        console.log(`Created hub session: ${hubSessionId}`)

      } else if (eventType === '15min_call') {
        // 15MIN CALL: Create family (if needed) and lead for follow-up

        // Create family with status='lead' if doesn't exist
        if (!familyId) {
          const { data: newFamily, error: familyError } = await supabase
            .from('families')
            .insert({
              display_name: formatFamilyName(data.invitee.name),
              primary_email: inviteeEmail,
              primary_phone: formAnswers.phone || null,
              primary_contact_name: data.invitee.name,
              status: 'lead',
              notes: 'Lead source: Calendly 15min call',
            })
            .select('id')
            .single()

          if (familyError) {
            console.error('Error creating family:', familyError)
            throw familyError
          }
          familyId = newFamily.id
          console.log(`Created new family as lead: ${familyId}`)
        }

        const { data: lead, error: leadError } = await supabase
          .from('leads')
          .insert({
            email: inviteeEmail,
            name: data.invitee.name,
            phone: formAnswers.phone || null,
            lead_type: 'calendly_call',
            status: 'new',
            calendly_event_uri: data.event.uri,
            calendly_invitee_uri: data.invitee.uri,
            scheduled_at: scheduledAt,
            family_id: familyId,
          })
          .select('id')
          .single()

        if (leadError) {
          console.error('Error creating lead:', leadError)
          throw leadError
        }
        leadId = lead.id
        console.log(`Created lead: ${leadId}`)
      }

      // 5. Create calendly_booking record for tracking
      const { error: bookingError } = await supabase
        .from('calendly_bookings')
        .insert({
          calendly_event_uri: data.event.uri,
          calendly_invitee_uri: data.invitee.uri,
          event_type: eventType === 'hub_dropoff' ? 'hub_dropoff' : '15min_call',
          invitee_email: inviteeEmail,
          invitee_name: data.invitee.name,
          invitee_phone: formAnswers.phone || null,
          scheduled_at: scheduledAt,
          status: 'scheduled',
          family_id: familyId,
          student_id: studentId,
          hub_session_id: hubSessionId,
          lead_id: leadId,
          student_name: formAnswers.studentName || null,
          student_age_group: formAnswers.studentAgeGroup || null,
          payment_method: formAnswers.paymentMethod || null,
          raw_payload: payload,
        })

      if (bookingError) {
        console.error('Error creating booking record:', bookingError)
        throw bookingError
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: 'created',
          eventType,
          familyId,
          studentId,
          hubSessionId,
          leadId,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Unknown event type
    return new Response(
      JSON.stringify({ success: true, action: 'ignored', reason: 'Unknown event type' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
