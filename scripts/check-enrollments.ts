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
  // Get Learning Pod service ID
  const { data: service } = await supabase
    .from('services')
    .select('id')
    .eq('code', 'learning_pod')
    .single()

  // Get all LP enrollments with student info
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('id, status, student:students(id, full_name, age_group)')
    .eq('service_id', service!.id)
    .in('status', ['active', 'trial'])

  console.log('Active/Trial LP enrollments:', enrollments?.length)

  // Find students with missing or bad age_group
  console.log('\nStudents with missing/invalid age_group:')
  const validAgeGroups = ['3-5', '6-8', '9-11', '12-14', '15-17']
  for (const e of enrollments || []) {
    const s = e.student as { id: string; full_name: string; age_group: string | null } | null
    if (s && (!s.age_group || !validAgeGroups.includes(s.age_group))) {
      console.log(`  - ${s.full_name} | age_group: "${s.age_group || '(none)'}"`)
    }
  }

  // Find duplicate students (same name)
  const { data: allStudents } = await supabase
    .from('students')
    .select('id, full_name, age_group, family_id')
    .order('full_name')

  type StudentRecord = { id: string; full_name: string; age_group: string | null; family_id: string }
  const nameCount = new Map<string, StudentRecord[]>()
  for (const s of allStudents || []) {
    const name = s.full_name.toLowerCase()
    if (!nameCount.has(name)) nameCount.set(name, [])
    nameCount.get(name)!.push(s)
  }

  console.log('\nDuplicate students (same name):')
  for (const [, students] of nameCount) {
    if (students.length > 1) {
      console.log(`  "${students[0].full_name}":`)
      for (const s of students) {
        const { data: lpEnroll } = await supabase
          .from('enrollments')
          .select('status')
          .eq('student_id', s.id)
          .eq('service_id', service!.id)
          .maybeSingle()
        console.log(`    - ID: ${s.id.slice(0,8)}... | age_group: ${s.age_group || '(none)'} | LP: ${lpEnroll?.status || 'none'}`)
      }
    }
  }
}

main().catch(console.error)
