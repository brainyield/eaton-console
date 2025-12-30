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
const duplicatesToMerge = [
  {
    name: 'Chinea, Angela',
    keepStudentId: '9fd8c1f4-0973-4d0b-8cca-eab73144972b',      // Learning Pod
    deleteStudentId: 'df7b858a-9cf8-4c4c-b0cb-79cdcfecb04f',   // Elective Classes
  },
  {
    name: 'Silva, Legend',
    keepStudentId: '0b0861aa-b674-4c3d-adaf-34de52b3ffba',      // Learning Pod
    deleteStudentId: '6fc27ec6-fed0-42d9-99fb-ee9d15d0675e',   // Elective Classes
  },
]

async function main() {
  console.log('Merging duplicate students...\n')

  for (const dup of duplicatesToMerge) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`Processing: ${dup.name}`)
    console.log(`  Keep:   ${dup.keepStudentId}`)
    console.log(`  Delete: ${dup.deleteStudentId}`)

    // Step 1: Move enrollments from duplicate to primary
    const { data: enrollmentsToMove, error: fetchError } = await supabase
      .from('enrollments')
      .select('id, service_id')
      .eq('student_id', dup.deleteStudentId)

    if (fetchError) {
      console.log(`  ERROR fetching enrollments: ${fetchError.message}`)
      continue
    }

    console.log(`  Found ${enrollmentsToMove?.length || 0} enrollment(s) to move`)

    if (enrollmentsToMove && enrollmentsToMove.length > 0) {
      const { error: updateError } = await supabase
        .from('enrollments')
        .update({ student_id: dup.keepStudentId })
        .eq('student_id', dup.deleteStudentId)

      if (updateError) {
        console.log(`  ERROR moving enrollments: ${updateError.message}`)
        continue
      }
      console.log(`  ✓ Moved ${enrollmentsToMove.length} enrollment(s) to primary student`)
    }

    // Step 2: Delete the duplicate student
    const { error: deleteError } = await supabase
      .from('students')
      .delete()
      .eq('id', dup.deleteStudentId)

    if (deleteError) {
      console.log(`  ERROR deleting duplicate: ${deleteError.message}`)
      continue
    }

    console.log(`  ✓ Deleted duplicate student record`)
    console.log(`  ✓ ${dup.name} merged successfully!`)
    console.log('')
  }

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log('Done! All duplicates merged.')
}

main().catch(console.error)
