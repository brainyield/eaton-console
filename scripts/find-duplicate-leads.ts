/**
 * Find Duplicate Leads Script
 *
 * Finds leads that match existing families by email or name.
 * These leads should be deleted since they represent people who are already customers.
 *
 * Usage:
 *   npx tsx scripts/find-duplicate-leads.ts          # Generate report only
 *   npx tsx scripts/find-duplicate-leads.ts --delete # Delete after confirmation
 */

import { createClient } from '@supabase/supabase-js'
import { distance } from 'fastest-levenshtein'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import * as readline from 'readline'

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
  process.exit(1)
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  SUPABASE_SERVICE_KEY
)

// Parse command line arguments
const args = process.argv.slice(2)
const DELETE_MODE = args.includes('--delete')

// Name normalization (from src/lib/utils.ts)
function formatNameLastFirst(name: string | null | undefined): string {
  if (!name) return ''
  const trimmed = name.trim()
  if (!trimmed) return ''
  if (trimmed.includes(',')) return trimmed
  if (!trimmed.includes(' ')) return trimmed
  const parts = trimmed.split(/\s+/)
  const lastName = parts.pop()!
  return `${lastName}, ${parts.join(' ')}`
}

interface Lead {
  id: string
  email: string
  name: string | null
  status: string
  lead_type: string
  created_at: string
}

interface Family {
  id: string
  display_name: string
  primary_email: string | null
  primary_contact_name: string | null
  status: string
}

type MatchConfidence = 'high' | 'medium' | 'low'

interface Match {
  lead: Lead
  family: Family
  confidence: MatchConfidence
  matchType: string
  details: string
}

async function fetchAllLeads(): Promise<Lead[]> {
  const { data, error } = await supabase
    .from('leads')
    .select('id, email, name, status, lead_type, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching leads:', error)
    throw error
  }

  return data || []
}

async function fetchAllFamilies(): Promise<Family[]> {
  // Fetch ALL families (active, trial, paused, churned) - excluding 'lead' status
  const { data, error } = await supabase
    .from('families')
    .select('id, display_name, primary_email, primary_contact_name, status')
    .in('status', ['active', 'trial', 'paused', 'churned'])

  if (error) {
    console.error('Error fetching families:', error)
    throw error
  }

  return data || []
}

function normalizeEmail(email: string | null | undefined): string {
  return (email || '').toLowerCase().trim()
}

function normalizeName(name: string | null | undefined): string {
  return formatNameLastFirst(name).toLowerCase().trim()
}

function findMatches(leads: Lead[], families: Family[]): Match[] {
  const matches: Match[] = []
  const matchedLeadIds = new Set<string>()

  // Build lookup maps for families
  const familyByEmail = new Map<string, Family>()
  const familyNames: Array<{ family: Family; normalizedName: string; source: 'display' | 'contact' }> = []

  for (const family of families) {
    // Index by email
    const email = normalizeEmail(family.primary_email)
    if (email) {
      familyByEmail.set(email, family)
    }

    // Index by display_name
    const displayName = normalizeName(family.display_name)
    if (displayName && displayName.length >= 4) {
      familyNames.push({ family, normalizedName: displayName, source: 'display' })
    }

    // Index by primary_contact_name
    const contactName = normalizeName(family.primary_contact_name)
    if (contactName && contactName.length >= 4) {
      familyNames.push({ family, normalizedName: contactName, source: 'contact' })
    }
  }

  // Match each lead
  for (const lead of leads) {
    const leadEmail = normalizeEmail(lead.email)
    const leadName = normalizeName(lead.name)

    // HIGH confidence: Exact email match
    if (leadEmail && familyByEmail.has(leadEmail)) {
      const family = familyByEmail.get(leadEmail)!
      matches.push({
        lead,
        family,
        confidence: 'high',
        matchType: 'email',
        details: `Email: ${leadEmail}`
      })
      matchedLeadIds.add(lead.id)
      continue // Skip name matching if email matched
    }

    // MEDIUM/LOW confidence: Name matching
    if (leadName && leadName.length >= 4) {
      let bestMatch: Match | null = null

      for (const { family, normalizedName, source } of familyNames) {
        // Skip if already matched this lead
        if (matchedLeadIds.has(lead.id)) break

        // Exact name match (after normalization) = MEDIUM confidence
        if (leadName === normalizedName) {
          bestMatch = {
            lead,
            family,
            confidence: 'medium',
            matchType: `name_exact_${source}`,
            details: `Name: "${lead.name}" = "${source === 'display' ? family.display_name : family.primary_contact_name}"`
          }
          break // Exact match found, no need to continue
        }

        // Fuzzy match (Levenshtein distance <= 2) = LOW confidence
        const dist = distance(leadName, normalizedName)
        if (dist <= 2 && dist > 0) {
          // Only keep the best (lowest distance) fuzzy match
          if (!bestMatch || bestMatch.confidence === 'low') {
            const existingDist = bestMatch
              ? parseInt(bestMatch.details.match(/distance: (\d+)/)?.[1] || '999')
              : 999
            if (dist < existingDist) {
              bestMatch = {
                lead,
                family,
                confidence: 'low',
                matchType: `name_fuzzy_${source}`,
                details: `"${lead.name}" ~ "${source === 'display' ? family.display_name : family.primary_contact_name}" (distance: ${dist})`
              }
            }
          }
        }
      }

      if (bestMatch) {
        matches.push(bestMatch)
        matchedLeadIds.add(lead.id)
      }
    }
  }

  return matches
}

function printReport(matches: Match[], totalLeads: number) {
  const highMatches = matches.filter(m => m.confidence === 'high')
  const mediumMatches = matches.filter(m => m.confidence === 'medium')
  const lowMatches = matches.filter(m => m.confidence === 'low')

  console.log('\n' + '='.repeat(70))
  console.log('LEAD DUPLICATE REPORT')
  console.log('='.repeat(70))

  // HIGH confidence matches
  console.log('\n=== HIGH CONFIDENCE MATCHES (Email) ===')
  if (highMatches.length === 0) {
    console.log('  (none)')
  } else {
    for (let i = 0; i < highMatches.length; i++) {
      const m = highMatches[i]
      console.log(`  [${i + 1}] Lead: ${m.lead.email} (${m.lead.status})`)
      console.log(`       → Family: "${m.family.display_name}" (${m.family.status})`)
    }
  }

  // MEDIUM confidence matches
  console.log('\n=== MEDIUM CONFIDENCE MATCHES (Exact Name) ===')
  if (mediumMatches.length === 0) {
    console.log('  (none)')
  } else {
    for (let i = 0; i < mediumMatches.length; i++) {
      const m = mediumMatches[i]
      console.log(`  [${highMatches.length + i + 1}] Lead: "${m.lead.name}" <${m.lead.email}> (${m.lead.status})`)
      console.log(`       → Family: "${m.family.display_name}" (${m.family.status})`)
      console.log(`       Match: ${m.details}`)
    }
  }

  // LOW confidence matches
  console.log('\n=== LOW CONFIDENCE MATCHES (Fuzzy Name) ===')
  if (lowMatches.length === 0) {
    console.log('  (none)')
  } else {
    for (let i = 0; i < lowMatches.length; i++) {
      const m = lowMatches[i]
      console.log(`  [${highMatches.length + mediumMatches.length + i + 1}] Lead: "${m.lead.name}" <${m.lead.email}> (${m.lead.status})`)
      console.log(`       → Family: "${m.family.display_name}" (${m.family.status})`)
      console.log(`       Match: ${m.details}`)
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70))
  console.log('SUMMARY')
  console.log('='.repeat(70))
  console.log(`Total leads in system: ${totalLeads}`)
  console.log(`Total matches found: ${matches.length}`)
  console.log(`  - High confidence (email): ${highMatches.length}`)
  console.log(`  - Medium confidence (exact name): ${mediumMatches.length}`)
  console.log(`  - Low confidence (fuzzy name): ${lowMatches.length}`)
  console.log(`Leads that would remain: ${totalLeads - matches.length}`)
}

async function saveResults(matches: Match[]) {
  const outputDir = path.join(__dirname, 'output')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const outputPath = path.join(outputDir, 'duplicate-leads.json')
  const output = {
    generatedAt: new Date().toISOString(),
    totalMatches: matches.length,
    matches: matches.map(m => ({
      leadId: m.lead.id,
      leadEmail: m.lead.email,
      leadName: m.lead.name,
      leadStatus: m.lead.status,
      familyId: m.family.id,
      familyName: m.family.display_name,
      familyStatus: m.family.status,
      confidence: m.confidence,
      matchType: m.matchType,
      details: m.details
    }))
  }

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2))
  console.log(`\nResults saved to: ${outputPath}`)
}

async function confirmAndDelete(matches: Match[]): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve)
    })
  }

  console.log('\n' + '='.repeat(70))
  console.log('DELETE CONFIRMATION')
  console.log('='.repeat(70))
  console.log(`\nYou are about to delete ${matches.length} leads.`)
  console.log('This action cannot be undone.\n')

  const answer = await question('Type "DELETE" to confirm: ')

  if (answer !== 'DELETE') {
    console.log('Deletion cancelled.')
    rl.close()
    return
  }

  console.log('\nDeleting leads...')

  const leadIds = matches.map(m => m.lead.id)
  const batchSize = 50
  let deleted = 0

  for (let i = 0; i < leadIds.length; i += batchSize) {
    const batch = leadIds.slice(i, i + batchSize)
    const { error } = await supabase
      .from('leads')
      .delete()
      .in('id', batch)

    if (error) {
      console.error(`Error deleting batch ${i / batchSize + 1}:`, error)
      throw error
    }

    deleted += batch.length
    console.log(`  Deleted ${deleted}/${leadIds.length} leads...`)
  }

  console.log(`\nSuccessfully deleted ${deleted} leads.`)
  rl.close()
}

async function main() {
  console.log('Find Duplicate Leads')
  console.log('====================')

  if (DELETE_MODE) {
    console.log('Mode: DELETE (will prompt for confirmation)')
  } else {
    console.log('Mode: REPORT ONLY (use --delete to remove matches)')
  }

  console.log('\nFetching leads...')
  const leads = await fetchAllLeads()
  console.log(`  Found ${leads.length} leads`)

  console.log('\nFetching families...')
  const families = await fetchAllFamilies()
  console.log(`  Found ${families.length} families (active, trial, paused, churned)`)

  console.log('\nMatching leads to families...')
  const matches = findMatches(leads, families)

  printReport(matches, leads.length)
  await saveResults(matches)

  if (DELETE_MODE && matches.length > 0) {
    await confirmAndDelete(matches)
  } else if (!DELETE_MODE && matches.length > 0) {
    console.log('\nTo delete these leads, run:')
    console.log('  npx tsx scripts/find-duplicate-leads.ts --delete')
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
