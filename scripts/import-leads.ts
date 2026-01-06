import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables from .env.local file
const projectRoot = path.join(__dirname, '..')
const envContent = fs.readFileSync(path.join(projectRoot, '.env.local'), 'utf-8')
const envVars: Record<string, string> = {}
envContent.split(/\r?\n/).forEach(line => {
  const trimmedLine = line.trim()
  const eqIndex = trimmedLine.indexOf('=')
  if (eqIndex > 0) {
    const key = trimmedLine.substring(0, eqIndex).trim()
    const value = trimmedLine.substring(eqIndex + 1).trim()
    envVars[key] = value
  }
})

const supabaseUrl = envVars.VITE_SUPABASE_URL
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env file')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

type LeadType = 'exit_intent' | 'waitlist' | 'calendly_call' | 'event'

interface LeadToInsert {
  email: string
  name: string | null
  phone: string | null
  lead_type: LeadType
  status: 'new'
  source_url: string | null
  notes: string | null
  created_at: string
}

// Simple CSV parser (handles quoted fields)
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split('\n').filter(line => line.trim())
  if (lines.length === 0) return []

  const headers = parseCSVLine(lines[0])
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((header, idx) => {
      row[header.trim()] = values[idx]?.trim() || ''
    })
    rows.push(row)
  }

  return rows
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

// Parse date strings to ISO format
function parseDate(dateStr: string): string {
  if (!dateStr || !dateStr.trim()) return new Date().toISOString()

  const str = dateStr.trim()

  try {
    // Already ISO format
    if (str.includes('T') && str.includes('Z')) {
      return str
    }

    // Format: "May 08 2025 20:00:00"
    if (str.match(/^[A-Z][a-z]+ \d{1,2} \d{4}/)) {
      const d = new Date(str)
      if (!isNaN(d.getTime())) return d.toISOString()
    }

    // Format: "2025-05-17 16:48:00" or "2025-04-30 15:16:12"
    const fullMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})/)
    if (fullMatch) {
      const [, year, month, day, hour, min, sec] = fullMatch
      const d = new Date(Date.UTC(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(min),
        parseInt(sec)
      ))
      if (!isNaN(d.getTime())) return d.toISOString()
    }

    // Format: "2025-05-17" (date only)
    const dateOnly = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
    if (dateOnly) {
      const [, year, month, day] = dateOnly
      const d = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)))
      if (!isNaN(d.getTime())) return d.toISOString()
    }

    // Try native Date parsing as fallback
    const d = new Date(str)
    if (!isNaN(d.getTime())) return d.toISOString()
  } catch {
    // Ignore parsing errors
  }

  return new Date().toISOString()
}

// Process PDF Leads (exit_intent)
function processPDFLeads(rows: Record<string, string>[]): LeadToInsert[] {
  return rows
    .filter(row => row.email && row.email.includes('@'))
    .map(row => ({
      email: row.email.toLowerCase().trim(),
      name: row.name?.trim() || null,
      phone: null,
      lead_type: 'exit_intent' as LeadType,
      status: 'new' as const,
      source_url: row.page?.trim() || null,
      notes: null,
      created_at: parseDate(row.zap_timestamp)
    }))
}

// Process Eligibility Widget Leads (exit_intent)
function processEligibilityLeads(rows: Record<string, string>[]): LeadToInsert[] {
  return rows
    .filter(row => row.email && row.email.includes('@'))
    .map(row => ({
      email: row.email.toLowerCase().trim(),
      name: null,
      phone: null,
      lead_type: 'exit_intent' as LeadType,
      status: 'new' as const,
      source_url: row.page_url?.trim() || null,
      notes: null,
      created_at: parseDate(row.timestamp)
    }))
}

// Process Calendly Routing Submissions (calendly_call)
function processCalendlyRouting(rows: Record<string, string>[]): LeadToInsert[] {
  return rows
    .filter(row => row.emailAddress && row.emailAddress.includes('@'))
    .map(row => {
      let notes = row['Routing Status'] ? `Routing: ${row['Routing Status']}` : null
      // Parse answers for additional info
      try {
        interface CalendlyAnswer {
          question?: string
          answer?: string
        }
        const answers = JSON.parse(row['Answers (JSON)'] || '[]') as CalendlyAnswer[]
        const age = answers.find(a => a.question?.includes('old is your child'))?.answer
        const timing = answers.find(a => a.question?.includes('start homeschooling'))?.answer
        if (age || timing) {
          notes = [notes, age ? `Child age: ${age}` : null, timing ? `Timing: ${timing}` : null]
            .filter(Boolean).join(' | ')
        }
      } catch (err: unknown) {
        // JSON parse failed - answers field may be malformed, continue without enrichment
        console.warn(`Failed to parse answers JSON for ${row.emailAddress}:`, err)
      }

      return {
        email: row.emailAddress.toLowerCase().trim(),
        name: row['Full Name']?.trim() || null,
        phone: null,
        lead_type: 'calendly_call' as LeadType,
        status: 'new' as const,
        source_url: null,
        notes,
        created_at: parseDate(row['Submitted At (ISO)'])
      }
    })
}

// Process EA Deals (calendly_call)
function processEADeals(rows: Record<string, string>[]): LeadToInsert[] {
  return rows
    .filter(row => row['E-mail'] && row['E-mail'].includes('@'))
    .map(row => ({
      email: row['E-mail'].toLowerCase().trim(),
      name: row.Name?.trim() || null,
      phone: row.Phone?.trim() || null,
      lead_type: 'calendly_call' as LeadType,
      status: 'new' as const,
      source_url: null,
      notes: row.Notes?.trim() || null,
      created_at: parseDate(row.Timestamp)
    }))
}

// Process Event Orders (event)
function processEventOrders(rows: Record<string, string>[]): LeadToInsert[] {
  return rows
    .filter(row => row['Email Address'] && row['Email Address'].includes('@'))
    .map(row => {
      const firstName = row['Parent First Name']?.trim() || ''
      const lastName = row['Parent Last Name']?.trim() || ''
      const name = [firstName, lastName].filter(Boolean).join(' ') || null

      const eventName = row['Event Name']?.trim()
      const studentInfo = row['Student Name'] ? `Student: ${row['Student Name']}` : null
      const notes = [eventName, studentInfo].filter(Boolean).join(' | ') || null

      return {
        email: row['Email Address'].toLowerCase().trim(),
        name,
        phone: row.Phone?.trim() || null,
        lead_type: 'event' as LeadType,
        status: 'new' as const,
        source_url: null,
        notes,
        created_at: parseDate(row['Order Date'])
      }
    })
}

async function main() {
  const projectRoot = path.join(__dirname, '..')

  console.log('Reading CSV files...')

  // Read all CSV files
  const pdfLeadsRaw = fs.readFileSync(path.join(projectRoot, 'PDF Leads - Sheet1.csv'), 'utf-8')
  const eligibilityRaw = fs.readFileSync(path.join(projectRoot, 'Eligibility Widget Leads - Sheet1.csv'), 'utf-8')
  const calendlyRoutingRaw = fs.readFileSync(path.join(projectRoot, 'Calendly Routing Submissions - Sheet1.csv'), 'utf-8')
  const eaDealsRaw = fs.readFileSync(path.join(projectRoot, 'EA - Deals - Sheet1.csv'), 'utf-8')
  const eventOrdersRaw = fs.readFileSync(path.join(projectRoot, 'Event Orders - Sheet1.csv'), 'utf-8')

  // Parse CSVs
  const pdfLeads = processPDFLeads(parseCSV(pdfLeadsRaw))
  const eligibilityLeads = processEligibilityLeads(parseCSV(eligibilityRaw))
  const calendlyRouting = processCalendlyRouting(parseCSV(calendlyRoutingRaw))
  const eaDeals = processEADeals(parseCSV(eaDealsRaw))
  const eventOrders = processEventOrders(parseCSV(eventOrdersRaw))

  console.log(`Parsed leads:`)
  console.log(`  - PDF Leads: ${pdfLeads.length}`)
  console.log(`  - Eligibility Widget: ${eligibilityLeads.length}`)
  console.log(`  - Calendly Routing: ${calendlyRouting.length}`)
  console.log(`  - EA Deals: ${eaDeals.length}`)
  console.log(`  - Event Orders: ${eventOrders.length}`)

  // Combine all leads
  const allLeads = [...pdfLeads, ...eligibilityLeads, ...calendlyRouting, ...eaDeals, ...eventOrders]
  console.log(`\nTotal parsed: ${allLeads.length}`)

  // Dedupe by email (keep first occurrence - prefer earlier sources)
  const seenEmails = new Set<string>()
  const dedupedLeads = allLeads.filter(lead => {
    if (seenEmails.has(lead.email)) return false
    seenEmails.add(lead.email)
    return true
  })
  console.log(`After dedup within CSVs: ${dedupedLeads.length}`)

  // Get existing emails from families and leads tables
  console.log('\nChecking existing emails in database...')

  const { data: existingFamilies } = await supabase
    .from('families')
    .select('primary_email')
    .not('primary_email', 'is', null)

  const { data: existingLeads } = await supabase
    .from('leads')
    .select('email')

  const existingEmails = new Set<string>()
  existingFamilies?.forEach(f => {
    if (f.primary_email) existingEmails.add(f.primary_email.toLowerCase())
  })
  existingLeads?.forEach(l => {
    if (l.email) existingEmails.add(l.email.toLowerCase())
  })

  console.log(`Existing emails in database: ${existingEmails.size}`)

  // Filter out existing
  const newLeads = dedupedLeads.filter(lead => !existingEmails.has(lead.email))
  console.log(`New leads to insert: ${newLeads.length}`)

  if (newLeads.length === 0) {
    console.log('\nNo new leads to insert!')
    return
  }

  // Show breakdown by type
  const byType = {
    exit_intent: newLeads.filter(l => l.lead_type === 'exit_intent').length,
    calendly_call: newLeads.filter(l => l.lead_type === 'calendly_call').length,
    event: newLeads.filter(l => l.lead_type === 'event').length,
  }
  console.log(`\nBreakdown by type:`)
  console.log(`  - Exit Intent: ${byType.exit_intent}`)
  console.log(`  - Calendly Call: ${byType.calendly_call}`)
  console.log(`  - Event: ${byType.event}`)

  // Generate SQL file instead of inserting directly (RLS blocks anon key)
  console.log('\nGenerating SQL file...')

  const escapeSQL = (str: string | null): string => {
    if (str === null) return 'NULL'
    return `'${str.replace(/'/g, "''")}'`
  }

  const sqlLines: string[] = [
    '-- Auto-generated SQL for lead import',
    '-- Run this in Supabase SQL Editor',
    '',
    'BEGIN;',
    ''
  ]

  for (const lead of newLeads) {
    sqlLines.push(`INSERT INTO leads (email, name, phone, lead_type, status, source_url, notes, created_at)
VALUES (${escapeSQL(lead.email)}, ${escapeSQL(lead.name)}, ${escapeSQL(lead.phone)}, '${lead.lead_type}', 'new', ${escapeSQL(lead.source_url)}, ${escapeSQL(lead.notes)}, '${lead.created_at}');`)
  }

  sqlLines.push('')
  sqlLines.push('COMMIT;')
  sqlLines.push('')
  sqlLines.push(`-- Total: ${newLeads.length} leads`)

  const sqlPath = path.join(projectRoot, 'docs', 'IMPORT_LEADS.sql')
  fs.writeFileSync(sqlPath, sqlLines.join('\n'))

  console.log(`\nDone! Generated SQL file: docs/IMPORT_LEADS.sql`)
  console.log(`Run this SQL in Supabase SQL Editor to import ${newLeads.length} leads.`)
}

main().catch(console.error)
