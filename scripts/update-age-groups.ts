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

// Parse command line arguments
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')

// Valid age group values (must match AGE_GROUP_OPTIONS in utils.ts)
const AGE_GROUP_OPTIONS = ['3-5', '6-8', '9-11', '12-14', '15-17'] as const
type AgeGroup = (typeof AGE_GROUP_OPTIONS)[number]

/**
 * Parse a date string in YYYY-MM-DD format as a local date (no timezone shift)
 */
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Calculate age from DOB
 */
function calculateAge(dob: string | null): number | null {
  if (!dob) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null

  const birthDate = parseLocalDate(dob)
  if (Number.isNaN(birthDate.getTime())) return null

  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }

  return age >= 0 ? age : null
}

/**
 * Get age group from DOB
 */
function getAgeGroup(dob: string | null): AgeGroup | null {
  const age = calculateAge(dob)
  if (age === null) return null

  if (age >= 3 && age <= 5) return '3-5'
  if (age >= 6 && age <= 8) return '6-8'
  if (age >= 9 && age <= 11) return '9-11'
  if (age >= 12 && age <= 14) return '12-14'
  if (age >= 15 && age <= 17) return '15-17'

  return null
}

async function main() {
  console.log('='.repeat(60))
  console.log('Update Student Age Groups from DOB')
  console.log('='.repeat(60))

  if (DRY_RUN) {
    console.log('\n=== DRY RUN MODE - No changes will be made ===')
  }

  // Fetch all students with DOB
  console.log('\n🎓 Fetching students with DOB...')
  const { data: students, error } = await supabase
    .from('students')
    .select('id, full_name, dob, age_group')
    .not('dob', 'is', null)

  if (error) {
    console.error('Error fetching students:', error.message)
    return
  }

  console.log(`Found ${students?.length || 0} students with DOB`)

  let updated = 0
  let skipped = 0
  let outOfRange = 0

  for (const student of students || []) {
    const calculatedAgeGroup = getAgeGroup(student.dob)
    const currentAgeGroup = student.age_group || ''
    const isAlreadyValid = AGE_GROUP_OPTIONS.includes(currentAgeGroup as AgeGroup)

    // Skip if already has valid age group matching calculated value
    if (isAlreadyValid && currentAgeGroup === calculatedAgeGroup) {
      skipped++
      continue
    }

    // Skip if age is out of range (3-17)
    if (!calculatedAgeGroup) {
      const age = calculateAge(student.dob)
      console.log(`  ⚠ ${student.full_name}: age ${age} is outside 3-17 range`)
      outOfRange++
      continue
    }

    // Update needed
    if (DRY_RUN) {
      console.log(`  [DRY] ${student.full_name}: "${currentAgeGroup}" → "${calculatedAgeGroup}"`)
      updated++
    } else {
      const { error: updateError } = await supabase
        .from('students')
        .update({ age_group: calculatedAgeGroup })
        .eq('id', student.id)

      if (updateError) {
        console.log(`  ✗ ${student.full_name}: Error - ${updateError.message}`)
      } else {
        console.log(`  ✓ ${student.full_name}: "${currentAgeGroup}" → "${calculatedAgeGroup}"`)
        updated++
      }
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log(`Summary:`)
  console.log(`  Updated: ${updated}`)
  console.log(`  Already correct: ${skipped}`)
  console.log(`  Age out of range: ${outOfRange}`)

  if (DRY_RUN) {
    console.log('\nDRY RUN complete! Run without --dry-run to apply changes.')
  } else {
    console.log('\nMigration complete!')
  }
  console.log('='.repeat(60))
}

main().catch(console.error)
