/**
 * Import Calendly Events Script
 *
 * Fetches upcoming scheduled events from Calendly API and imports them
 * into the calendly_bookings table. Mimics the webhook handler logic.
 *
 * Usage:
 *   1. Get your Calendly Personal Access Token from:
 *      https://calendly.com/integrations/api_webhooks
 *
 *   2. Run the script:
 *      CALENDLY_PAT=your_token npx tsx scripts/import-calendly-events.ts
 *
 *   3. Optional flags:
 *      --dry-run    Preview what would be imported without making changes
 *      --all        Import all events (not just upcoming)
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('Error: .env.local not found')
    process.exit(1)
  }
  const content = fs.readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex)
        // Don't override existing env vars (allows CALENDLY_PAT from command line)
        if (!process.env[key]) {
          process.env[key] = trimmed.slice(eqIndex + 1)
        }
      }
    }
  }
}
loadEnv()

const CALENDLY_PAT = process.env.CALENDLY_PAT
if (!CALENDLY_PAT) {
  console.error('Error: CALENDLY_PAT environment variable is required')
  console.error('Get your token from: https://calendly.com/integrations/api_webhooks')
  console.error('Run with: CALENDLY_PAT=your_token npx tsx scripts/import-calendly-events.ts')
  process.exit(1)
}

// Use service role key if provided (required for writes to leads/calendly_bookings)
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('Warning: Using anon key. Some inserts may fail due to RLS.')
  console.warn('Set SUPABASE_SERVICE_ROLE_KEY for full access.\n')
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  SUPABASE_KEY
)

const CALENDLY_API_BASE = 'https://api.calendly.com'

// Event type slugs (same as webhook handler)
const EVENT_TYPE_SLUGS = {
  CALL_15MIN: '15min',
  HUB_DROPOFF: 'eaton-hub-drop-off',
}

interface CalendlyUser {
  uri: string
  name: string
  email: string
}

interface CalendlyEvent {
  uri: string
  name: string
  status: 'active' | 'canceled'
  start_time: string
  end_time: string
  event_type: string
  invitees_counter: {
    total: number
    active: number
    limit: number
  }
}

interface CalendlyEventType {
  uri: string
  name: string
  slug: string
  scheduling_url: string
}

interface CalendlyInvitee {
  uri: string
  email: string
  name: string
  status: string
  timezone: string
  created_at: string
  canceled: boolean
  questions_and_answers?: Array<{
    question: string
    answer: string
    position: number
  }>
}

// Parse command line arguments
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const IMPORT_ALL = args.includes('--all')

if (DRY_RUN) {
  console.log('=== DRY RUN MODE - No changes will be made ===\n')
}

// Calendly API helpers
async function calendlyFetch<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${CALENDLY_API_BASE}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${CALENDLY_PAT}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Calendly API error: ${response.status} - ${error}`)
  }

  return response.json()
}

async function getCurrentUser(): Promise<CalendlyUser> {
  const data = await calendlyFetch<{ resource: CalendlyUser }>('/users/me')
  return data.resource
}

async function getScheduledEvents(userUri: string): Promise<CalendlyEvent[]> {
  const allEvents: CalendlyEvent[] = []
  let nextPageToken: string | null = null

  // Build query params
  const params = new URLSearchParams({
    user: userUri,
    status: 'active',
    sort: 'start_time:asc',
    count: '100',
  })

  // Only fetch future events unless --all flag is passed
  if (!IMPORT_ALL) {
    params.set('min_start_time', new Date().toISOString())
  }

  do {
    const url = `/scheduled_events?${params}${nextPageToken ? `&page_token=${nextPageToken}` : ''}`
    const data = await calendlyFetch<{
      collection: CalendlyEvent[]
      pagination: { next_page_token?: string }
    }>(url)

    allEvents.push(...data.collection)
    nextPageToken = data.pagination.next_page_token || null
  } while (nextPageToken)

  return allEvents
}

async function getInvitees(eventUri: string): Promise<CalendlyInvitee[]> {
  const eventUuid = eventUri.split('/').pop()
  const data = await calendlyFetch<{ collection: CalendlyInvitee[] }>(
    `/scheduled_events/${eventUuid}/invitees`
  )
  return data.collection
}

// Cache for event types to avoid repeated API calls
const eventTypeCache = new Map<string, CalendlyEventType>()

async function getEventType(eventTypeUri: string): Promise<CalendlyEventType> {
  if (eventTypeCache.has(eventTypeUri)) {
    return eventTypeCache.get(eventTypeUri)!
  }

  const eventTypeUuid = eventTypeUri.split('/').pop()
  const data = await calendlyFetch<{ resource: CalendlyEventType }>(
    `/event_types/${eventTypeUuid}`
  )
  eventTypeCache.set(eventTypeUri, data.resource)
  return data.resource
}

// Extract form answers (same logic as webhook handler)
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

// Determine event type from Calendly event type slug
// Default to 15min_call if not explicitly a hub_dropoff - this ensures leads are created
function determineEventType(slug: string): 'hub_dropoff' | '15min_call' {
  const slugLower = slug.toLowerCase()

  // Check for hub drop-off patterns
  if (slugLower.includes(EVENT_TYPE_SLUGS.HUB_DROPOFF) ||
      slugLower.includes('hub-drop-off') ||
      slugLower.includes('hub_drop') ||
      slugLower.includes('hubdrop') ||
      slugLower.includes('drop-off') ||
      slugLower.includes('dropoff')) {
    return 'hub_dropoff'
  }

  // Everything else is treated as a call/consultation - creates a lead
  return '15min_call'
}

// Format name as "LastName, FirstName"
function formatFamilyName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) {
    return parts[0]
  }
  const lastName = parts[parts.length - 1]
  const firstName = parts.slice(0, -1).join(' ')
  return `${lastName}, ${firstName}`
}

async function importEvent(event: CalendlyEvent, invitee: CalendlyInvitee) {
  // Fetch event type details to get the slug
  const eventTypeDetails = await getEventType(event.event_type)
  const eventType = determineEventType(eventTypeDetails.slug)
  const formAnswers = extractFormAnswers(invitee)
  const inviteeEmail = invitee.email.toLowerCase()
  const scheduledAt = event.start_time

  console.log(`\n  Processing: ${invitee.name} <${inviteeEmail}>`)
  console.log(`    Event: ${event.name} (slug: ${eventTypeDetails.slug})`)
  console.log(`    Type: ${eventType}`)
  console.log(`    Scheduled: ${new Date(scheduledAt).toLocaleString()}`)

  // Check if already imported
  const { data: existingBooking } = await supabase
    .from('calendly_bookings')
    .select('id')
    .eq('calendly_invitee_uri', invitee.uri)
    .maybeSingle()

  if (existingBooking) {
    console.log(`    SKIPPED: Already imported (ID: ${existingBooking.id})`)
    return { skipped: true, reason: 'already_exists' }
  }

  if (DRY_RUN) {
    console.log(`    WOULD IMPORT: ${eventType}`)
    if (formAnswers.studentName) console.log(`      Student: ${formAnswers.studentName}`)
    return { dryRun: true }
  }

  // Find or create family
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

  // Track whether this family has active enrollments (meaning they're already a customer)
  let hasActiveEnrollment = false

  if (existingFamily) {
    familyId = existingFamily.id
    console.log(`    Found existing family: ${familyId}`)

    // Check if family has active/trial enrollments
    const { data: activeEnrollments } = await supabase
      .from('enrollments')
      .select('id')
      .eq('family_id', familyId)
      .in('status', ['active', 'trial'])
      .limit(1)

    hasActiveEnrollment = activeEnrollments && activeEnrollments.length > 0
    if (hasActiveEnrollment) {
      console.log(`    Family has active enrollment - will skip lead creation`)
    }
  }

  if (eventType === 'hub_dropoff') {
    // HUB DROP-OFF: Create family, student, hub_session

    if (!familyId) {
      const { data: newFamily, error: familyError } = await supabase
        .from('families')
        .insert({
          display_name: formatFamilyName(invitee.name),
          primary_email: inviteeEmail,
          primary_phone: formAnswers.phone || null,
          primary_contact_name: invitee.name,
          status: 'active',
          payment_gateway: formAnswers.paymentMethod || null,
        })
        .select('id')
        .single()

      if (familyError) {
        console.log(`    ERROR creating family: ${familyError.message}`)
        return { error: familyError.message }
      }
      familyId = newFamily.id
      console.log(`    Created family: ${familyId}`)
    }

    // Find or create student
    if (formAnswers.studentName) {
      const { data: existingStudent } = await supabase
        .from('students')
        .select('id')
        .eq('family_id', familyId)
        .ilike('full_name', formAnswers.studentName)
        .single()

      if (existingStudent) {
        studentId = existingStudent.id
        console.log(`    Found existing student: ${studentId}`)
      } else {
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
          console.log(`    ERROR creating student: ${studentError.message}`)
          return { error: studentError.message }
        }
        studentId = newStudent.id
        console.log(`    Created student: ${studentId}`)
      }
    }

    // Get hub daily rate
    const { data: hubRateSetting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'hub_daily_rate')
      .single()

    const dailyRate = hubRateSetting?.value ? parseFloat(hubRateSetting.value) : 100.0

    // Create hub_session
    const sessionDate = new Date(scheduledAt).toISOString().split('T')[0]

    const { data: hubSession, error: sessionError } = await supabase
      .from('hub_sessions')
      .insert({
        student_id: studentId,
        session_date: sessionDate,
        daily_rate: dailyRate,
        notes: `Booked via Calendly (imported). Payment method: ${formAnswers.paymentMethod || 'Not specified'}`,
      })
      .select('id')
      .single()

    if (sessionError) {
      console.log(`    ERROR creating hub session: ${sessionError.message}`)
      return { error: sessionError.message }
    }
    hubSessionId = hubSession.id
    console.log(`    Created hub session: ${hubSessionId}`)

  } else if (eventType === '15min_call') {
    // 15MIN CALL: Create family (if needed) and lead
    // Skip lead creation if family already has active enrollments (they're already a customer)

    if (hasActiveEnrollment) {
      console.log(`    Skipping lead creation for existing customer`)
    } else {
      if (!familyId) {
        const { data: newFamily, error: familyError } = await supabase
          .from('families')
          .insert({
            display_name: formatFamilyName(invitee.name),
            primary_email: inviteeEmail,
            primary_phone: formAnswers.phone || null,
            primary_contact_name: invitee.name,
            status: 'lead',
            notes: 'Lead source: Calendly 15min call (imported)',
          })
          .select('id')
          .single()

        if (familyError) {
          console.log(`    ERROR creating family: ${familyError.message}`)
          return { error: familyError.message }
        }
        familyId = newFamily.id
        console.log(`    Created family as lead: ${familyId}`)
      }

      // Create lead
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .insert({
          email: inviteeEmail,
          name: invitee.name,
          phone: formAnswers.phone || null,
          lead_type: 'calendly_call',
          status: 'new',
          calendly_event_uri: event.uri,
          calendly_invitee_uri: invitee.uri,
          scheduled_at: scheduledAt,
          family_id: familyId,
        })
        .select('id')
        .single()

      if (leadError) {
        console.log(`    ERROR creating lead: ${leadError.message}`)
        return { error: leadError.message }
      }
      leadId = lead.id
      console.log(`    Created lead: ${leadId}`)
    }
  }

  // Create calendly_booking record
  const { error: bookingError } = await supabase
    .from('calendly_bookings')
    .insert({
      calendly_event_uri: event.uri,
      calendly_invitee_uri: invitee.uri,
      event_type: eventType === 'hub_dropoff' ? 'hub_dropoff' : '15min_call',
      invitee_email: inviteeEmail,
      invitee_name: invitee.name,
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
      notes: 'Imported from Calendly API',
    })

  if (bookingError) {
    console.log(`    ERROR creating booking: ${bookingError.message}`)
    return { error: bookingError.message }
  }

  console.log(`    SUCCESS: Imported ${eventType}`)
  return { success: true, eventType }
}

async function main() {
  console.log('Calendly Events Import')
  console.log('======================\n')

  // Get current user
  console.log('Fetching Calendly user...')
  const user = await getCurrentUser()
  console.log(`User: ${user.name} <${user.email}>\n`)

  // Fetch scheduled events
  console.log(`Fetching ${IMPORT_ALL ? 'all' : 'upcoming'} scheduled events...`)
  const events = await getScheduledEvents(user.uri)
  console.log(`Found ${events.length} events\n`)

  if (events.length === 0) {
    console.log('No events to import.')
    return
  }

  // Process each event
  const stats = {
    total: 0,
    imported: 0,
    skipped: 0,
    errors: 0,
  }

  for (const event of events) {
    console.log(`\nEvent: ${event.name}`)
    console.log(`  Scheduled: ${new Date(event.start_time).toLocaleString()}`)
    console.log(`  Invitees: ${event.invitees_counter.active}`)

    // Get invitees for this event
    const invitees = await getInvitees(event.uri)

    for (const invitee of invitees) {
      if (invitee.canceled) {
        console.log(`  Skipped canceled invitee: ${invitee.name}`)
        continue
      }

      stats.total++
      const result = await importEvent(event, invitee)

      if (result.success || result.dryRun) {
        stats.imported++
      } else if (result.skipped) {
        stats.skipped++
      } else if (result.error) {
        stats.errors++
      }
    }
  }

  // Summary
  console.log('\n\n=== SUMMARY ===')
  console.log(`Total invitees processed: ${stats.total}`)
  console.log(`Imported: ${stats.imported}`)
  console.log(`Skipped (already exists): ${stats.skipped}`)
  console.log(`Errors: ${stats.errors}`)

  if (DRY_RUN) {
    console.log('\n=== DRY RUN COMPLETE - No changes were made ===')
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
