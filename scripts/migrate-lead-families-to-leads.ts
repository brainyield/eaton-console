import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  const content = fs.readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex > 0) {
        process.env[trimmed.slice(0, eqIndex)] = trimmed.slice(eqIndex + 1)
      }
    }
  }
}
loadEnv()

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)

interface LeadFamily {
  id: string
  display_name: string
  primary_email: string | null
  primary_phone: string | null
  primary_contact_name: string | null
  notes: string | null
  created_at: string
}

async function main() {
  console.log('='.repeat(60))
  console.log('Migration: Move Lead Families to Leads Table')
  console.log('='.repeat(60))

  // Step 1: Find all families with status='lead'
  console.log('\n1. Finding families with status="lead"...')
  const { data: leadFamilies, error: fetchError } = await supabase
    .from('families')
    .select('id, display_name, primary_email, primary_phone, primary_contact_name, notes, created_at')
    .eq('status', 'lead')

  if (fetchError) {
    console.error('Error fetching lead families:', fetchError.message)
    return
  }

  if (!leadFamilies || leadFamilies.length === 0) {
    console.log('   No families with status="lead" found. Nothing to migrate.')
    return
  }

  console.log(`   Found ${leadFamilies.length} lead families to migrate:`)
  for (const family of leadFamilies) {
    console.log(`   - ${family.display_name} (${family.primary_email || 'no email'})`)
  }

  // Step 2: Check for existing leads with same email to avoid duplicates
  console.log('\n2. Checking for duplicate emails in leads table...')
  const emails = leadFamilies
    .map(f => f.primary_email?.toLowerCase())
    .filter((e): e is string => !!e)

  const { data: existingLeads, error: checkError } = await supabase
    .from('leads')
    .select('email')
    .in('email', emails)

  if (checkError) {
    console.error('Error checking existing leads:', checkError.message)
    return
  }

  const existingEmails = new Set((existingLeads || []).map(l => l.email.toLowerCase()))
  console.log(`   Found ${existingEmails.size} emails already in leads table`)

  // Step 3: Migrate each lead family
  console.log('\n3. Migrating lead families to leads table...')
  let migrated = 0
  let skipped = 0
  let failed = 0

  for (const family of leadFamilies as LeadFamily[]) {
    const email = family.primary_email?.toLowerCase()

    // Skip if no email (leads require email)
    if (!email) {
      console.log(`   SKIP: ${family.display_name} - no email address`)
      skipped++
      continue
    }

    // Skip if already exists in leads
    if (existingEmails.has(email)) {
      console.log(`   SKIP: ${family.display_name} - already exists in leads table`)
      skipped++
      // Still delete the family record since it's a duplicate
      const { error: deleteError } = await supabase
        .from('families')
        .delete()
        .eq('id', family.id)
      if (deleteError) {
        console.log(`   ERROR deleting duplicate family: ${deleteError.message}`)
      } else {
        console.log(`   Deleted duplicate family record`)
      }
      continue
    }

    // Default to 'waitlist' lead type for migrated families
    const leadType = 'waitlist'

    // Create lead record
    const { error: insertError } = await supabase
      .from('leads')
      .insert({
        email: email,
        name: family.primary_contact_name || family.display_name,
        phone: family.primary_phone,
        lead_type: leadType,
        status: 'new',
        notes: family.notes,
        created_at: family.created_at,
      })

    if (insertError) {
      console.log(`   FAIL: ${family.display_name} - ${insertError.message}`)
      failed++
      continue
    }

    // Delete the family record
    const { error: deleteError } = await supabase
      .from('families')
      .delete()
      .eq('id', family.id)

    if (deleteError) {
      console.log(`   WARN: Lead created but family not deleted - ${deleteError.message}`)
      // Lead was created, so count as migrated
    }

    console.log(`   OK: ${family.display_name} -> leads table`)
    migrated++
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('Migration Summary')
  console.log('='.repeat(60))
  console.log(`Migrated: ${migrated}`)
  console.log(`Skipped:  ${skipped}`)
  console.log(`Failed:   ${failed}`)
  console.log('='.repeat(60))
}

main().catch(console.error)
