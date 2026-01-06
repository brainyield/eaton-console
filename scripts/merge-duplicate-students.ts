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

// Duplicates to merge (keep Learning Pod student, move other enrollment)
// To find duplicates, run: findDuplicates() first, then add IDs here
const duplicatesToMerge: Array<{
  name: string
  keepStudentId: string
  deleteStudentId: string
}> = []

// Find duplicate students by name and show their enrollments
async function findDuplicates(studentName?: string) {
  console.log('Searching for duplicate students...\n')

  let query = supabase
    .from('students')
    .select(`
      id,
      full_name,
      family_id,
      enrollments (
        id,
        service:services (name)
      )
    `)
    .order('full_name')

  if (studentName) {
    query = query.ilike('full_name', `%${studentName}%`)
  }

  const { data: students, error } = await query

  if (error) {
    console.error('Error fetching students:', error.message)
    return
  }

  // Group by name to find duplicates
  const byName = new Map<string, typeof students>()
  for (const student of students || []) {
    const existing = byName.get(student.full_name) || []
    existing.push(student)
    byName.set(student.full_name, existing)
  }

  // Show duplicates
  let foundDuplicates = false
  for (const [name, records] of byName) {
    if (records.length > 1) {
      foundDuplicates = true
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      console.log(`DUPLICATE: ${name} (${records.length} records)`)
      for (const record of records) {
        type EnrollmentWithService = { id: string; service: { name: string } | null }
        const enrollments = record.enrollments as EnrollmentWithService[] | null
        const services = enrollments?.map(e => e.service?.name).filter(Boolean).join(', ') || 'No enrollments'
        console.log(`  ID: ${record.id}`)
        console.log(`     Family: ${record.family_id}`)
        console.log(`     Services: ${services}`)
      }
      console.log('')
    }
  }

  if (!foundDuplicates) {
    console.log(studentName ? `No duplicates found for "${studentName}"` : 'No duplicate students found.')
  }
}

async function mergeStudent(keepId: string, deleteId: string) {
  console.log(`Merging student ${deleteId} into ${keepId}...`)

  // Step 1: Move enrollments from duplicate to primary
  const { data: enrollmentsToMove, error: fetchError } = await supabase
    .from('enrollments')
    .select('id, service_id')
    .eq('student_id', deleteId)

  if (fetchError) {
    console.log(`  ERROR fetching enrollments: ${fetchError.message}`)
    return false
  }

  console.log(`  Found ${enrollmentsToMove?.length || 0} enrollment(s) to move`)

  if (enrollmentsToMove && enrollmentsToMove.length > 0) {
    const { error: updateError } = await supabase
      .from('enrollments')
      .update({ student_id: keepId })
      .eq('student_id', deleteId)

    if (updateError) {
      console.log(`  ERROR moving enrollments: ${updateError.message}`)
      return false
    }
    console.log(`  ✓ Moved ${enrollmentsToMove.length} enrollment(s) to primary student`)
  }

  // Step 2: Delete the duplicate student
  const { error: deleteError } = await supabase
    .from('students')
    .delete()
    .eq('id', deleteId)

  if (deleteError) {
    console.log(`  ERROR deleting duplicate: ${deleteError.message}`)
    return false
  }

  console.log(`  ✓ Deleted duplicate student record`)
  return true
}

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  // Usage: npx tsx scripts/merge-duplicate-students.ts find [name]
  if (command === 'find') {
    await findDuplicates(args[1])
    return
  }

  // Usage: npx tsx scripts/merge-duplicate-students.ts merge <keepId> <deleteId>
  if (command === 'merge') {
    const keepId = args[1]
    const deleteId = args[2]
    if (!keepId || !deleteId) {
      console.error('Usage: npx tsx scripts/merge-duplicate-students.ts merge <keepId> <deleteId>')
      console.error('  keepId: The student ID to keep (usually Learning Pod)')
      console.error('  deleteId: The student ID to delete (enrollments will be moved)')
      process.exit(1)
    }
    const success = await mergeStudent(keepId, deleteId)
    console.log(success ? '\n✓ Merge completed!' : '\n✗ Merge failed')
    return
  }

  // Default: run batch merge from duplicatesToMerge array
  if (duplicatesToMerge.length === 0) {
    console.log('No duplicates configured in duplicatesToMerge array.')
    console.log('\nUsage:')
    console.log('  npx tsx scripts/merge-duplicate-students.ts find [name]  - Find duplicates')
    console.log('  npx tsx scripts/merge-duplicate-students.ts merge <keepId> <deleteId>  - Merge specific duplicate')
    return
  }

  console.log('Merging duplicate students...\n')

  for (const dup of duplicatesToMerge) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`Processing: ${dup.name}`)
    console.log(`  Keep:   ${dup.keepStudentId}`)
    console.log(`  Delete: ${dup.deleteStudentId}`)
    const success = await mergeStudent(dup.keepStudentId, dup.deleteStudentId)
    if (success) {
      console.log(`  ✓ ${dup.name} merged successfully!`)
    }
    console.log('')
  }

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log('Done!')
}

main().catch(console.error)
