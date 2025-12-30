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

// Service code to default period mapping for active enrollments
const SERVICE_PERIODS: Record<string, string> = {
  learning_pod: 'Spring 2026',
  elective_classes: 'Spring 2026',
  academic_coaching: '2025-2026',
  eaton_online: '2025-2026',
  consulting: '2025-2026',
  eaton_hub: '2025-2026',
}

async function main() {
  console.log('=== Populating Enrollment Periods ===\n')

  // First, add the column if it doesn't exist (run migration)
  console.log('Step 1: Checking/adding enrollment_period column...')
  // Note: Column addition should be done via Supabase dashboard or SQL migration
  // This script assumes the column already exists

  // Get all active enrollments with their service codes
  const { data: enrollments, error: fetchError } = await supabase
    .from('enrollments')
    .select('id, status, service:services(code)')
    .in('status', ['active', 'trial'])

  if (fetchError) {
    console.error('Error fetching enrollments:', fetchError)
    return
  }

  console.log(`Found ${enrollments?.length || 0} active/trial enrollments\n`)

  if (!enrollments || enrollments.length === 0) {
    console.log('No enrollments to update.')
    return
  }

  // Group by service code and update
  const updates: { id: string; period: string; serviceCode: string }[] = []

  for (const enrollment of enrollments) {
    const serviceCode = (enrollment.service as any)?.code
    if (!serviceCode) {
      console.log(`  Skipping enrollment ${enrollment.id.slice(0, 8)}... - no service code`)
      continue
    }

    const period = SERVICE_PERIODS[serviceCode]
    if (!period) {
      console.log(`  Skipping enrollment ${enrollment.id.slice(0, 8)}... - unknown service code: ${serviceCode}`)
      continue
    }

    updates.push({ id: enrollment.id, period, serviceCode })
  }

  console.log(`Step 2: Updating ${updates.length} enrollments...\n`)

  // Update by service type for logging
  const byService: Record<string, number> = {}

  for (const update of updates) {
    const { error } = await supabase
      .from('enrollments')
      .update({ enrollment_period: update.period })
      .eq('id', update.id)

    if (error) {
      console.error(`  Error updating ${update.id.slice(0, 8)}...:`, error.message)
    } else {
      byService[update.serviceCode] = (byService[update.serviceCode] || 0) + 1
    }
  }

  console.log('\n=== Summary ===')
  for (const [service, count] of Object.entries(byService)) {
    console.log(`  ${service}: ${count} enrollments → ${SERVICE_PERIODS[service]}`)
  }

  // Verify
  const { data: updated, error: verifyError } = await supabase
    .from('enrollments')
    .select('enrollment_period')
    .in('status', ['active', 'trial'])
    .not('enrollment_period', 'is', null)

  if (!verifyError) {
    console.log(`\nVerification: ${updated?.length || 0} enrollments now have enrollment_period set`)
  }
}

main().catch(console.error)
