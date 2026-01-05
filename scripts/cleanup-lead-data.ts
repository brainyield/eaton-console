/**
 * Lead Data Cleanup Script
 *
 * Fixes data inconsistencies where:
 * 1. Leads were created for families that already had active enrollments
 * 2. Families have status='lead' but have active enrollments
 *
 * Usage:
 *   npx tsx scripts/cleanup-lead-data.ts          # Dry run (preview)
 *   npx tsx scripts/cleanup-lead-data.ts --apply  # Apply changes
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
        if (!process.env[key]) {
          process.env[key] = trimmed.slice(eqIndex + 1)
        }
      }
    }
  }
}
loadEnv()

// Require service role key for this script
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_SERVICE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY is required for this script')
  console.error('This key is needed to update leads and families tables')
  process.exit(1)
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  SUPABASE_SERVICE_KEY
)

// Parse command line arguments
const args = process.argv.slice(2)
const APPLY_CHANGES = args.includes('--apply')

if (!APPLY_CHANGES) {
  console.log('=== DRY RUN MODE ===')
  console.log('No changes will be made. Run with --apply to execute changes.\n')
}

interface LeadWithEnrollment {
  id: string
  email: string
  name: string | null
  status: string
  family_id: string | null
  family: {
    display_name: string
  } | null
}

interface FamilyWithEnrollment {
  id: string
  display_name: string
  status: string
}

async function findLeadsWithActiveEnrollments(): Promise<LeadWithEnrollment[]> {
  // Find leads that are linked to families with active/trial enrollments
  // These leads should be marked as 'converted' since the family is already a customer
  const { data: leads, error } = await supabase
    .from('leads')
    .select(`
      id,
      email,
      name,
      status,
      family_id,
      family:families!leads_family_id_fkey (
        display_name
      )
    `)
    .in('status', ['new', 'contacted'])
    .not('family_id', 'is', null)

  if (error) {
    console.error('Error fetching leads:', error)
    throw error
  }

  if (!leads || leads.length === 0) {
    return []
  }

  // For each lead, check if the family has active enrollments
  const leadsWithActiveEnrollments: LeadWithEnrollment[] = []

  for (const lead of leads) {
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('id')
      .eq('family_id', lead.family_id)
      .in('status', ['active', 'trial'])
      .limit(1)

    if (enrollments && enrollments.length > 0) {
      leadsWithActiveEnrollments.push(lead as LeadWithEnrollment)
    }
  }

  return leadsWithActiveEnrollments
}

async function findLeadFamiliesWithActiveEnrollments(): Promise<FamilyWithEnrollment[]> {
  // Find families with status='lead' that have active/trial enrollments
  // These families should be updated to status='active'
  const { data: families, error } = await supabase
    .from('families')
    .select('id, display_name, status')
    .eq('status', 'lead')

  if (error) {
    console.error('Error fetching families:', error)
    throw error
  }

  if (!families || families.length === 0) {
    return []
  }

  // For each family, check if they have active enrollments
  const familiesWithActiveEnrollments: FamilyWithEnrollment[] = []

  for (const family of families) {
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('id')
      .eq('family_id', family.id)
      .in('status', ['active', 'trial'])
      .limit(1)

    if (enrollments && enrollments.length > 0) {
      familiesWithActiveEnrollments.push(family)
    }
  }

  return familiesWithActiveEnrollments
}

async function markLeadsAsConverted(leads: LeadWithEnrollment[]): Promise<number> {
  if (leads.length === 0) return 0

  const leadIds = leads.map(l => l.id)

  const { error } = await supabase
    .from('leads')
    .update({
      status: 'converted',
      converted_at: new Date().toISOString(),
    })
    .in('id', leadIds)

  if (error) {
    console.error('Error updating leads:', error)
    throw error
  }

  return leads.length
}

async function updateFamilyStatuses(families: FamilyWithEnrollment[]): Promise<number> {
  if (families.length === 0) return 0

  const familyIds = families.map(f => f.id)

  const { error } = await supabase
    .from('families')
    .update({ status: 'active' })
    .in('id', familyIds)

  if (error) {
    console.error('Error updating families:', error)
    throw error
  }

  return families.length
}

async function main() {
  console.log('Lead Data Cleanup')
  console.log('=================\n')

  // Part 1: Find and fix leads linked to families with active enrollments
  console.log('Part 1: Finding leads linked to families with active enrollments...')
  const leadsToConvert = await findLeadsWithActiveEnrollments()

  if (leadsToConvert.length === 0) {
    console.log('  No leads found that need conversion.\n')
  } else {
    console.log(`  Found ${leadsToConvert.length} leads to mark as converted:\n`)
    for (const lead of leadsToConvert) {
      const familyName = lead.family?.display_name || 'Unknown'
      console.log(`    - ${lead.name || lead.email} (${familyName}) [Lead ID: ${lead.id}]`)
    }
    console.log()

    if (APPLY_CHANGES) {
      const count = await markLeadsAsConverted(leadsToConvert)
      console.log(`  Updated ${count} leads to status='converted'\n`)
    } else {
      console.log('  [DRY RUN] Would mark these leads as converted\n')
    }
  }

  // Part 2: Find and fix families with status='lead' but have active enrollments
  console.log('Part 2: Finding families with status=\'lead\' that have active enrollments...')
  const familiesToUpdate = await findLeadFamiliesWithActiveEnrollments()

  if (familiesToUpdate.length === 0) {
    console.log('  No families found that need status update.\n')
  } else {
    console.log(`  Found ${familiesToUpdate.length} families to update to status='active':\n`)
    for (const family of familiesToUpdate) {
      console.log(`    - ${family.display_name} [Family ID: ${family.id}]`)
    }
    console.log()

    if (APPLY_CHANGES) {
      const count = await updateFamilyStatuses(familiesToUpdate)
      console.log(`  Updated ${count} families to status='active'\n`)
    } else {
      console.log('  [DRY RUN] Would update these families to status=\'active\'\n')
    }
  }

  // Summary
  console.log('=== SUMMARY ===')
  console.log(`Leads to convert: ${leadsToConvert.length}`)
  console.log(`Families to update: ${familiesToUpdate.length}`)

  if (!APPLY_CHANGES) {
    console.log('\n=== DRY RUN COMPLETE ===')
    console.log('Run with --apply to execute these changes')
  } else {
    console.log('\n=== CLEANUP COMPLETE ===')
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
