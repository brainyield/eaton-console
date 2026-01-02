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
  console.log('Checking for duplicate students...\n')

  // First check for duplicates
  const { data: students, error: fetchError } = await supabase
    .from('students')
    .select('id, family_id, full_name')

  if (fetchError) {
    console.error('Error fetching students:', fetchError.message)
    process.exit(1)
  }

  // Group by family_id + normalized name
  const groups = new Map<string, typeof students>()
  for (const student of students || []) {
    const key = `${student.family_id}::${student.full_name.trim().toLowerCase()}`
    const existing = groups.get(key) || []
    existing.push(student)
    groups.set(key, existing)
  }

  // Find duplicates
  const duplicates = [...groups.entries()].filter(([_, records]) => records.length > 1)

  if (duplicates.length > 0) {
    console.log('ERROR: Found duplicates that must be resolved first:\n')
    for (const [key, records] of duplicates) {
      console.log(`  ${records[0].full_name}:`)
      for (const r of records) {
        console.log(`    - ID: ${r.id}`)
      }
    }
    console.log('\nRun: npx tsx scripts/merge-duplicate-students.ts find')
    console.log('Then merge duplicates before applying the constraint.')
    process.exit(1)
  }

  console.log('No duplicates found. The unique constraint can be applied.\n')
  console.log('To apply the constraint, run this SQL in the Supabase dashboard:\n')
  console.log('----------------------------------------')
  console.log(`CREATE UNIQUE INDEX IF NOT EXISTS students_family_name_unique
ON students (family_id, lower(trim(full_name)));`)
  console.log('----------------------------------------')
  console.log('\nOr apply via: Supabase Dashboard > SQL Editor')
}

main().catch(console.error)
