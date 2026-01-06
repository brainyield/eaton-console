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

interface Student {
  id: string
  family_id: string
  full_name: string
  active: boolean
}

interface Enrollment {
  id: string
  student_id: string
  status: string
  service: { name: string } | null
}


async function main() {
  console.log('Finding duplicate students...\n')

  // Fetch all students
  const { data: students, error: studentsError } = await supabase
    .from('students')
    .select('id, family_id, full_name, active')
    .order('family_id')

  if (studentsError) {
    console.error('Error fetching students:', studentsError)
    return
  }

  // Fetch all families for display names
  const { data: families, error: familiesError } = await supabase
    .from('families')
    .select('id, display_name')

  if (familiesError) {
    console.error('Error fetching families:', familiesError)
    return
  }

  const familyMap = new Map<string, string>()
  for (const f of families || []) {
    familyMap.set(f.id, f.display_name)
  }

  // Group students by family_id + normalized name
  const groups = new Map<string, Student[]>()

  for (const student of students || []) {
    const normalizedName = student.full_name.trim().toLowerCase()
    const key = `${student.family_id}|${normalizedName}`

    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(student)
  }

  // Find duplicates (groups with more than 1 student)
  const duplicates = Array.from(groups.entries()).filter(([, students]) => students.length > 1)

  if (duplicates.length === 0) {
    console.log('No duplicate students found!')
    return
  }

  console.log(`Found ${duplicates.length} duplicate student group(s):\n`)

  // Fetch enrollments for all students to show which have data
  const { data: enrollments, error: enrollmentsError } = await supabase
    .from('enrollments')
    .select('id, student_id, status, service:services(name)')

  if (enrollmentsError) {
    console.error('Error fetching enrollments:', enrollmentsError)
    return
  }

  const enrollmentsByStudent = new Map<string, Enrollment[]>()
  for (const e of enrollments || []) {
    if (!e.student_id) continue
    if (!enrollmentsByStudent.has(e.student_id)) {
      enrollmentsByStudent.set(e.student_id, [])
    }
    enrollmentsByStudent.get(e.student_id)!.push(e as Enrollment)
  }

  for (const [key, dupes] of duplicates) {
    const familyId = key.split('|')[0]
    const familyName = familyMap.get(familyId) || 'Unknown Family'

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`Family: ${familyName}`)
    console.log(`Student name: ${dupes[0].full_name}`)
    console.log(`Duplicates: ${dupes.length}`)
    console.log('')

    for (const student of dupes) {
      const studentEnrollments = enrollmentsByStudent.get(student.id) || []
      const activeEnrollments = studentEnrollments.filter(e => e.status === 'active' || e.status === 'trial')
      const endedEnrollments = studentEnrollments.filter(e => e.status === 'ended' || e.status === 'paused')

      console.log(`  ID: ${student.id}`)
      console.log(`  Active: ${student.active ? 'Yes' : 'No'}`)
      console.log(`  Enrollments: ${studentEnrollments.length} total (${activeEnrollments.length} active, ${endedEnrollments.length} ended)`)

      if (studentEnrollments.length > 0) {
        for (const e of studentEnrollments) {
          const serviceName = e.service?.name || 'Unknown Service'
          console.log(`    - ${serviceName}: ${e.status}`)
        }
      }
      console.log('')
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`Summary: ${duplicates.length} families have duplicate students`)
  console.log(`Total duplicate records: ${duplicates.reduce((sum, [, d]) => sum + d.length, 0)}`)
}

main().catch(console.error)
