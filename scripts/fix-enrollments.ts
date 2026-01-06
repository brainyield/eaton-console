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

  const lpServiceId = service!.id
  console.log('Learning Pod service ID:', lpServiceId)
  console.log('')

  // 1. Re-activate ended enrollments
  const studentsToReactivate = [
    'Miranda, Victor',
    'Miranda, Isabel',
    'Figueroa, Kevin Jr.',
    'Chinea, Alex'
  ]

  console.log('=== Re-activating ended enrollments ===\n')

  for (const name of studentsToReactivate) {
    const { data: student } = await supabase
      .from('students')
      .select('id, full_name, family_id')
      .ilike('full_name', name)
      .single()

    if (!student) {
      console.log(`✗ Student not found: ${name}`)
      continue
    }

    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id, status')
      .eq('student_id', student.id)
      .eq('service_id', lpServiceId)
      .single()

    if (!enrollment) {
      console.log(`✗ No LP enrollment found for: ${name}`)
      continue
    }

    if (enrollment.status === 'active') {
      console.log(`- ${name}: already active`)
      continue
    }

    const { error } = await supabase
      .from('enrollments')
      .update({ status: 'active', end_date: null })
      .eq('id', enrollment.id)

    if (error) {
      console.log(`✗ Error reactivating ${name}: ${error.message}`)
    } else {
      console.log(`✓ Reactivated: ${name}`)
    }
  }

  // 2. Create new enrollments for students who never had one
  console.log('\n=== Creating new LP enrollments ===\n')

  const studentsToEnroll = [
    'Perez, Liliana M. Pacheco',
    'Benscome, Annabelle'
  ]

  for (const name of studentsToEnroll) {
    const { data: students } = await supabase
      .from('students')
      .select('id, full_name, family_id')
      .ilike('full_name', `%${name}%`)

    if (!students || students.length === 0) {
      console.log(`✗ Student not found: ${name}`)
      continue
    }

    // Use the first match
    const student = students[0]

    // Check if already has LP enrollment
    const { data: existing } = await supabase
      .from('enrollments')
      .select('id, status')
      .eq('student_id', student.id)
      .eq('service_id', lpServiceId)
      .maybeSingle()

    if (existing) {
      console.log(`- ${student.full_name}: already has LP enrollment (${existing.status})`)
      continue
    }

    // Create new enrollment
    const { error } = await supabase
      .from('enrollments')
      .insert({
        student_id: student.id,
        family_id: student.family_id,
        service_id: lpServiceId,
        status: 'active',
        start_date: new Date().toISOString().split('T')[0]
      })

    if (error) {
      console.log(`✗ Error creating enrollment for ${student.full_name}: ${error.message}`)
    } else {
      console.log(`✓ Created LP enrollment: ${student.full_name}`)
    }
  }

  // Verify final count
  console.log('\n=== Final count ===\n')
  const { count } = await supabase
    .from('enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('service_id', lpServiceId)
    .in('status', ['active', 'trial'])

  console.log(`Active/Trial LP enrollments: ${count}`)
}

main().catch(console.error)
