/**
 * Learning Pod Age Group Reconciliation Script
 *
 * This script:
 * 1. Reads the CSV file with accurate age group data
 * 2. Compares with existing students in Supabase
 * 3. Updates age_group for matching students
 * 4. Creates new families, students, and enrollments for non-matches
 *
 * Run with: npx tsx scripts/reconcile-learning-pod.ts
 * Execute changes: npx tsx scripts/reconcile-learning-pod.ts --execute
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables from .env.local manually
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  const content = fs.readFileSync(envPath, 'utf-8')
  const lines = content.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex)
        const value = trimmed.slice(eqIndex + 1)
        process.env[key] = value
      }
    }
  }
}

loadEnv()

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

interface CsvRow {
  studentName: string
  customerName: string
  customerEmail: string
  studentDob: string
  studentAge: string
  ageGroup: string
  customerPhone: string
  programStart: string
}

interface MatchResult {
  csvRow: CsvRow
  matchedStudentId?: string
  matchedStudentName?: string
  matchedFamilyId?: string
  currentAgeGroup?: string | null
  needsUpdate: boolean
  isNew: boolean
}

// Parse CSV
function parseCsv(filePath: string): CsvRow[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').filter(line => line.trim())

  // Skip header
  const dataLines = lines.slice(1)

  return dataLines.map(line => {
    // Handle CSV with commas in quoted fields
    const values: string[] = []
    let current = ''
    let inQuotes = false

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    values.push(current.trim())

    return {
      studentName: values[1] || '',      // "Last, First"
      customerName: values[2] || '',     // "Last, First"
      customerEmail: values[3] || '',
      studentDob: values[4] || '',
      studentAge: values[5] || '',
      ageGroup: values[6] || '',
      customerPhone: values[7] || '',
      programStart: values[8] || '',
    }
  }).filter(row => row.studentName) // Filter out empty rows
}

// Common nickname mappings
const nicknameMap: Record<string, string[]> = {
  'alex': ['alexander', 'alejandro', 'alexis'],
  'alexander': ['alex'],
  'mike': ['michael'],
  'michael': ['mike'],
  'will': ['william'],
  'william': ['will', 'bill', 'billy'],
  'bob': ['robert'],
  'robert': ['bob', 'rob', 'bobby'],
  'jim': ['james'],
  'james': ['jim', 'jimmy'],
  'dan': ['daniel'],
  'daniel': ['dan', 'danny'],
  'chris': ['christopher'],
  'christopher': ['chris'],
  'nick': ['nicholas'],
  'nicholas': ['nick'],
  'sam': ['samuel', 'samantha'],
  'samuel': ['sam'],
  'samantha': ['sam'],
  'kate': ['katherine', 'kathryn'],
  'katherine': ['kate', 'kathy', 'katie'],
  'liz': ['elizabeth'],
  'elizabeth': ['liz', 'beth', 'lizzy'],
  'tony': ['anthony'],
  'anthony': ['tony'],
}

// Normalize name for comparison: "Last, First" -> "first last" (lowercase)
// Handles edge cases like "Figueroa, Jr., Kevin" and "Pacheco Perez, Liliana Margarita"
function normalizeName(name: string): string {
  if (!name) return ''

  let result = name

  // Handle "Last, First" format (may have multiple commas for suffixes)
  if (result.includes(',')) {
    const parts = result.split(',').map(s => s.trim())

    // Check for suffix pattern: "LastName, Jr., FirstName" or "LastName, Sr., FirstName"
    if (parts.length >= 3 && /^(jr\.?|sr\.?|ii|iii|iv)$/i.test(parts[1])) {
      // Format: LastName, Suffix, FirstName
      const lastName = parts[0]
      const firstName = parts.slice(2).join(' ')
      result = `${firstName} ${lastName}`
    }
    // Check for suffix at end: "LastName, FirstName Jr."
    else if (parts.length === 2) {
      const lastName = parts[0]
      let firstName = parts[1]
      // Remove trailing suffix from first name for matching
      firstName = firstName.replace(/\s+(jr\.?|sr\.?|ii|iii|iv)$/i, '')
      result = `${firstName} ${lastName}`
    } else {
      // Standard format
      const lastName = parts[0]
      const firstName = parts.slice(1).join(' ')
      result = `${firstName} ${lastName}`
    }
  }

  // Normalize: lowercase, remove periods, extra spaces
  result = result.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim()

  return result
}

// Common spelling variations (first AND last names)
const spellingVariations: Record<string, string[]> = {
  'anabelle': ['annabelle', 'anabel', 'annabel'],
  'annabelle': ['anabelle', 'anabel', 'annabel'],
  'sara': ['sarah'],
  'sarah': ['sara'],
  'michele': ['michelle'],
  'michelle': ['michele'],
  'kristin': ['kristen', 'kristine', 'christine'],
  'kristen': ['kristin', 'kristine', 'christine'],
  'kaitlyn': ['caitlin', 'katelyn', 'kaitlin'],
  'caitlin': ['kaitlyn', 'katelyn', 'kaitlin'],
  'brian': ['bryan'],
  'bryan': ['brian'],
  'steven': ['stephen'],
  'stephen': ['steven'],
  'jeffrey': ['geoffrey'],
  'geoffrey': ['jeffrey'],
  'alan': ['allan', 'allen'],
  'allan': ['alan', 'allen'],
  'allen': ['alan', 'allan'],
  // Last name variations
  'bencosme': ['benscome', 'benscome'],
  'benscome': ['bencosme'],
}

// Check if two names match (with nickname and spelling support)
function namePartsMatch(name1: string, name2: string, checkInitials = false): boolean {
  if (name1 === name2) return true

  // Check nicknames
  const nicknames1 = nicknameMap[name1] || []
  const nicknames2 = nicknameMap[name2] || []
  if (nicknames1.includes(name2) || nicknames2.includes(name1)) return true

  // Check spelling variations
  const spellings1 = spellingVariations[name1] || []
  const spellings2 = spellingVariations[name2] || []
  if (spellings1.includes(name2) || spellings2.includes(name1)) return true

  // Check initial match: "m" matches "margarita" (only for first names)
  if (checkInitials && (name1.length === 1 || name2.length === 1)) {
    if (name1[0] === name2[0]) return true
  }

  return false
}

// Alias for backwards compatibility
function firstNamesMatch(name1: string, name2: string): boolean {
  return namePartsMatch(name1, name2, true)
}

// Check if two names match (with fuzzy matching for nicknames and spelling)
function namesMatch(name1: string, name2: string): boolean {
  const n1 = normalizeName(name1)
  const n2 = normalizeName(name2)

  // Exact match
  if (n1 === n2) return true

  // Split into words
  const words1 = n1.split(' ')
  const words2 = n2.split(' ')

  // Check if first names match (with nickname support) and last names match
  if (words1.length >= 2 && words2.length >= 2) {
    const firstName1 = words1[0]
    const firstName2 = words2[0]
    const lastName1 = words1[words1.length - 1]
    const lastName2 = words2[words2.length - 1]

    // Check last name match (including spelling variations)
    const lastNameMatch = namePartsMatch(lastName1, lastName2, false)

    // Check first name match (including nicknames and spelling variations)
    const firstNameMatch = firstNamesMatch(firstName1, firstName2)

    if (firstNameMatch && lastNameMatch) return true
  }

  return false
}

// Check if student matches by first name and family email
function matchByFirstNameAndFamily(
  csvFirstName: string,
  csvEmail: string,
  dbStudent: { full_name: string; family?: { primary_email?: string | null } | null }
): boolean {
  const dbEmail = dbStudent.family?.primary_email?.toLowerCase() || ''
  if (!dbEmail || dbEmail !== csvEmail.toLowerCase()) return false

  const dbNormalized = normalizeName(dbStudent.full_name)
  const dbFirstName = dbNormalized.split(' ')[0]

  return firstNamesMatch(csvFirstName.toLowerCase(), dbFirstName)
}

// Format phone number consistently
function formatPhone(phone: string): string {
  if (!phone) return ''
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return phone
}

// Convert "Last, First" to "First Last"
// Handles edge cases like "Figueroa, Jr., Kevin" -> "Kevin Figueroa Jr."
function toDisplayName(name: string): string {
  if (!name) return ''
  if (name.includes(',')) {
    const parts = name.split(',').map(s => s.trim())

    // Check for suffix pattern: "LastName, Jr., FirstName"
    if (parts.length >= 3 && /^(jr\.?|sr\.?|ii|iii|iv)$/i.test(parts[1])) {
      const lastName = parts[0]
      const suffix = parts[1].replace('.', '') // Normalize "Jr." to "Jr"
      const firstName = parts.slice(2).join(' ')
      return `${firstName} ${lastName} ${suffix}`
    }

    // Standard format: "Last, First" or "Last Last, First First"
    const lastName = parts[0]
    const firstName = parts.slice(1).join(' ')
    return `${firstName} ${lastName}`
  }
  return name
}

// Parse date from MM/DD/YYYY to YYYY-MM-DD
function parseDate(dateStr: string): string | null {
  if (!dateStr) return null
  const parts = dateStr.split('/')
  if (parts.length !== 3) return null
  const [month, day, year] = parts
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

async function main() {
  console.log('='.repeat(60))
  console.log('Learning Pod Age Group Reconciliation')
  console.log('='.repeat(60))
  console.log('')

  // 1. Parse CSV
  const csvPath = path.join(__dirname, '..', 'Learning Pod Clients (Current).csv')
  console.log(`Reading CSV from: ${csvPath}`)
  const csvRows = parseCsv(csvPath)
  console.log(`Found ${csvRows.length} students in CSV`)
  console.log('')

  // 2. Fetch existing students with their families
  console.log('Fetching existing students from Supabase...')
  const { data: existingStudents, error: studentsError } = await supabase
    .from('students')
    .select(`
      id,
      full_name,
      grade_level,
      age_group,
      dob,
      family_id,
      family:families(id, display_name, primary_email)
    `)

  if (studentsError) {
    console.error('Error fetching students:', studentsError)
    process.exit(1)
  }

  console.log(`Found ${existingStudents?.length || 0} existing students in database`)
  console.log('')

  // 3. Get Learning Pod service ID
  const { data: services } = await supabase
    .from('services')
    .select('id, code, name')
    .eq('code', 'learning_pod')
    .single()

  if (!services) {
    console.error('Could not find learning_pod service')
    process.exit(1)
  }
  const learningPodServiceId = services.id
  console.log(`Learning Pod service ID: ${learningPodServiceId}`)
  console.log('')

  // 4. Match CSV rows to existing students
  const results: MatchResult[] = []

  for (const csvRow of csvRows) {
    // Try to find a matching student using fuzzy name matching
    let matchedStudent: typeof existingStudents[0] | undefined

    // First try exact normalized match
    const normalizedCsvName = normalizeName(csvRow.studentName)
    matchedStudent = (existingStudents || []).find(s =>
      normalizeName(s.full_name) === normalizedCsvName
    )

    // If no exact match, try fuzzy name matching
    if (!matchedStudent) {
      matchedStudent = (existingStudents || []).find(s =>
        namesMatch(csvRow.studentName, s.full_name)
      )
    }

    // If still no match, try matching by first name + family email
    // (handles cases where student has different last name in DB, like mom's surname)
    if (!matchedStudent && csvRow.customerEmail) {
      const csvFirstName = normalizeName(csvRow.studentName).split(' ')[0]
      matchedStudent = (existingStudents || []).find(s =>
        matchByFirstNameAndFamily(csvFirstName, csvRow.customerEmail, s)
      )
    }

    if (matchedStudent) {
      results.push({
        csvRow,
        matchedStudentId: matchedStudent.id,
        matchedStudentName: matchedStudent.full_name,
        matchedFamilyId: matchedStudent.family_id,
        currentAgeGroup: matchedStudent.age_group,
        needsUpdate: matchedStudent.age_group !== csvRow.ageGroup,
        isNew: false,
      })
    } else {
      results.push({
        csvRow,
        needsUpdate: false,
        isNew: true,
      })
    }
  }

  // 5. Report findings
  const matched = results.filter(r => !r.isNew)
  const needsUpdate = results.filter(r => !r.isNew && r.needsUpdate)
  const alreadyCorrect = results.filter(r => !r.isNew && !r.needsUpdate)
  const newStudents = results.filter(r => r.isNew)

  console.log('='.repeat(60))
  console.log('ANALYSIS RESULTS')
  console.log('='.repeat(60))
  console.log('')
  console.log(`Total in CSV:        ${csvRows.length}`)
  console.log(`Matched in DB:       ${matched.length}`)
  console.log(`  - Need update:     ${needsUpdate.length}`)
  console.log(`  - Already correct: ${alreadyCorrect.length}`)
  console.log(`New (not in DB):     ${newStudents.length}`)
  console.log('')

  if (needsUpdate.length > 0) {
    console.log('-'.repeat(60))
    console.log('STUDENTS NEEDING AGE GROUP UPDATE:')
    console.log('-'.repeat(60))
    for (const r of needsUpdate) {
      console.log(`  ${r.matchedStudentName}`)
      console.log(`    Current: "${r.currentAgeGroup || '(empty)'}" -> New: "${r.csvRow.ageGroup}"`)
    }
    console.log('')
  }

  if (newStudents.length > 0) {
    console.log('-'.repeat(60))
    console.log('NEW STUDENTS TO CREATE:')
    console.log('-'.repeat(60))
    for (const r of newStudents) {
      const normalizedCsv = normalizeName(r.csvRow.studentName)
      console.log(`  ${toDisplayName(r.csvRow.studentName)}`)
      console.log(`    CSV normalized: "${normalizedCsv}"`)
      // Find close matches in DB
      const closeMatches = (existingStudents || [])
        .map(s => ({ name: s.full_name, normalized: normalizeName(s.full_name) }))
        .filter(s => {
          // Check if any word matches
          const csvWords = normalizedCsv.split(' ')
          const dbWords = s.normalized.split(' ')
          return csvWords.some(w => dbWords.includes(w) && w.length > 2)
        })
        .slice(0, 3)
      if (closeMatches.length > 0) {
        console.log(`    Possible DB matches: ${closeMatches.map(m => `"${m.name}"`).join(', ')}`)
      }
      console.log(`    Family: ${toDisplayName(r.csvRow.customerName)} (${r.csvRow.customerEmail})`)
      console.log(`    Age Group: ${r.csvRow.ageGroup}`)
    }
    console.log('')
  }

  // 6. Ask for confirmation
  const args = process.argv.slice(2)
  const dryRun = !args.includes('--execute')

  if (dryRun) {
    console.log('='.repeat(60))
    console.log('DRY RUN - No changes made')
    console.log('To execute changes, run with: --execute')
    console.log('='.repeat(60))
    return
  }

  console.log('='.repeat(60))
  console.log('EXECUTING CHANGES...')
  console.log('='.repeat(60))
  console.log('')

  // 7. Update existing students' age_group
  if (needsUpdate.length > 0) {
    console.log('Updating age groups for existing students...')
    for (const r of needsUpdate) {
      const { error } = await supabase
        .from('students')
        .update({ age_group: r.csvRow.ageGroup })
        .eq('id', r.matchedStudentId!)

      if (error) {
        console.error(`  Error updating ${r.matchedStudentName}:`, error.message)
      } else {
        console.log(`  ✓ Updated ${r.matchedStudentName}: ${r.currentAgeGroup} -> ${r.csvRow.ageGroup}`)
      }
    }
    console.log('')
  }

  // 8. Create new families, students, and enrollments
  if (newStudents.length > 0) {
    console.log('Creating new families, students, and enrollments...')

    // Group new students by family email to avoid duplicate families
    const byFamily = new Map<string, MatchResult[]>()
    for (const r of newStudents) {
      const email = r.csvRow.customerEmail.toLowerCase()
      if (!byFamily.has(email)) {
        byFamily.set(email, [])
      }
      byFamily.get(email)!.push(r)
    }

    for (const [email, familyStudents] of byFamily) {
      const firstStudent = familyStudents[0]

      // Check if family already exists by email
      const { data: existingFamily } = await supabase
        .from('families')
        .select('id, display_name')
        .eq('primary_email', email)
        .single()

      let familyId: string

      if (existingFamily) {
        familyId = existingFamily.id
        console.log(`  Using existing family: ${existingFamily.display_name}`)
      } else {
        // Create new family
        const { data: newFamily, error: familyError } = await supabase
          .from('families')
          .insert({
            display_name: toDisplayName(firstStudent.csvRow.customerName),
            primary_email: email,
            primary_phone: formatPhone(firstStudent.csvRow.customerPhone),
            status: 'active',
          })
          .select()
          .single()

        if (familyError) {
          console.error(`  Error creating family for ${email}:`, familyError.message)
          continue
        }
        familyId = newFamily.id
        console.log(`  ✓ Created family: ${newFamily.display_name}`)
      }

      // Create students and enrollments for this family
      for (const r of familyStudents) {
        // Create student
        const { data: newStudent, error: studentError } = await supabase
          .from('students')
          .insert({
            family_id: familyId,
            full_name: toDisplayName(r.csvRow.studentName),
            dob: parseDate(r.csvRow.studentDob),
            age_group: r.csvRow.ageGroup,
            active: true,
          })
          .select()
          .single()

        if (studentError) {
          console.error(`    Error creating student ${r.csvRow.studentName}:`, studentError.message)
          continue
        }
        console.log(`    ✓ Created student: ${newStudent.full_name}`)

        // Create Learning Pod enrollment
        const { error: enrollmentError } = await supabase
          .from('enrollments')
          .insert({
            family_id: familyId,
            student_id: newStudent.id,
            service_id: learningPodServiceId,
            status: 'active',
            start_date: new Date().toISOString().split('T')[0],
          })

        if (enrollmentError) {
          console.error(`      Error creating enrollment:`, enrollmentError.message)
        } else {
          console.log(`      ✓ Created Learning Pod enrollment`)
        }
      }
    }
    console.log('')
  }

  console.log('='.repeat(60))
  console.log('DONE!')
  console.log('='.repeat(60))
}

main().catch(console.error)
