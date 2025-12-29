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

async function main() {
  const { data: service } = await supabase
    .from('services')
    .select('id')
    .eq('code', 'learning_pod')
    .single()

  // Fix Gupta, Shiv - find the one with LP enrollment and update age_group
  const { data: shivs } = await supabase
    .from('students')
    .select('id, full_name, age_group')
    .ilike('full_name', '%gupta, shiv%')

  console.log('Shiv Gupta records:')
  for (const s of shivs || []) {
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id, status')
      .eq('student_id', s.id)
      .eq('service_id', service!.id)
      .maybeSingle()

    console.log(`  - ${s.id} | age_group: ${s.age_group} | LP: ${enrollment?.status || 'none'}`)

    // Update the one WITH enrollment to have correct age_group
    if (enrollment) {
      const { error } = await supabase
        .from('students')
        .update({ age_group: '6-8' })
        .eq('id', s.id)

      if (error) {
        console.log(`    ERROR updating: ${error.message}`)
      } else {
        console.log(`    ✓ Updated age_group to 6-8`)
      }
    }
  }

  // Fix Hawkins, Erich - set age_group to 15-17
  console.log('\nHawkins, Erich:')
  const { data: erichs } = await supabase
    .from('students')
    .select('id, full_name, age_group')
    .ilike('full_name', '%hawkins, erich%')

  for (const s of erichs || []) {
    console.log(`  - ${s.id} | age_group: ${s.age_group || '(none)'}`)

    if (!s.age_group || s.age_group !== '15-17') {
      const { error } = await supabase
        .from('students')
        .update({ age_group: '15-17' })
        .eq('id', s.id)

      if (error) {
        console.log(`    ERROR: ${error.message}`)
      } else {
        console.log(`    ✓ Updated age_group to 15-17`)
      }
    }
  }
}

main().catch(console.error)
