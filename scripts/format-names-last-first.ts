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

/**
 * Formats a name to "Last Name, First Name" format.
 * - If the name already contains a comma, return as-is
 * - If the name has no spaces (single name), return as-is
 * - Otherwise, move the last word to the front with a comma
 */
function formatNameLastFirst(name: string): string {
  const trimmed = name.trim()

  // Already has comma - assume already formatted
  if (trimmed.includes(',')) {
    return trimmed
  }

  // No spaces - single name, leave as-is
  if (!trimmed.includes(' ')) {
    return trimmed
  }

  // Split and rearrange
  const parts = trimmed.split(/\s+/)
  const lastName = parts.pop()!
  const firstNames = parts.join(' ')

  return `${lastName}, ${firstNames}`
}

async function main() {
  console.log('='.repeat(60))
  console.log('Name Format Migration: First Last → Last, First')
  console.log('='.repeat(60))

  // Process families.display_name
  console.log('\n📁 Processing families.display_name...')
  const { data: families, error: famError } = await supabase
    .from('families')
    .select('id, display_name')
    .not('display_name', 'is', null)
    .not('display_name', 'like', '%,%')  // Skip already formatted
    .like('display_name', '% %')          // Must have a space

  if (famError) {
    console.error('  Error fetching families:', famError.message)
  } else {
    console.log(`  Found ${families?.length || 0} names to update`)
    for (const fam of families || []) {
      const newName = formatNameLastFirst(fam.display_name!)
      if (newName !== fam.display_name) {
        const { error } = await supabase
          .from('families')
          .update({ display_name: newName })
          .eq('id', fam.id)

        if (error) {
          console.log(`  ✗ ${fam.display_name} → Error: ${error.message}`)
        } else {
          console.log(`  ✓ ${fam.display_name} → ${newName}`)
        }
      }
    }
  }

  // Process families.primary_contact_name
  console.log('\n📁 Processing families.primary_contact_name...')
  const { data: contacts, error: contactError } = await supabase
    .from('families')
    .select('id, primary_contact_name')
    .not('primary_contact_name', 'is', null)
    .not('primary_contact_name', 'like', '%,%')
    .like('primary_contact_name', '% %')

  if (contactError) {
    console.error('  Error fetching contacts:', contactError.message)
  } else {
    console.log(`  Found ${contacts?.length || 0} names to update`)
    for (const c of contacts || []) {
      const newName = formatNameLastFirst(c.primary_contact_name!)
      if (newName !== c.primary_contact_name) {
        const { error } = await supabase
          .from('families')
          .update({ primary_contact_name: newName })
          .eq('id', c.id)

        if (error) {
          console.log(`  ✗ ${c.primary_contact_name} → Error: ${error.message}`)
        } else {
          console.log(`  ✓ ${c.primary_contact_name} → ${newName}`)
        }
      }
    }
  }

  // Process students.full_name
  console.log('\n🎓 Processing students.full_name...')
  const { data: students, error: studError } = await supabase
    .from('students')
    .select('id, full_name')
    .not('full_name', 'is', null)
    .not('full_name', 'like', '%,%')
    .like('full_name', '% %')

  if (studError) {
    console.error('  Error fetching students:', studError.message)
  } else {
    console.log(`  Found ${students?.length || 0} names to update`)
    for (const s of students || []) {
      const newName = formatNameLastFirst(s.full_name!)
      if (newName !== s.full_name) {
        const { error } = await supabase
          .from('students')
          .update({ full_name: newName })
          .eq('id', s.id)

        if (error) {
          console.log(`  ✗ ${s.full_name} → Error: ${error.message}`)
        } else {
          console.log(`  ✓ ${s.full_name} → ${newName}`)
        }
      }
    }
  }

  // Process teachers.display_name
  console.log('\n👩‍🏫 Processing teachers.display_name...')
  const { data: teachers, error: teachError } = await supabase
    .from('teachers')
    .select('id, display_name')
    .not('display_name', 'is', null)
    .not('display_name', 'like', '%,%')
    .like('display_name', '% %')

  if (teachError) {
    console.error('  Error fetching teachers:', teachError.message)
  } else {
    console.log(`  Found ${teachers?.length || 0} names to update`)
    for (const t of teachers || []) {
      const newName = formatNameLastFirst(t.display_name!)
      if (newName !== t.display_name) {
        const { error } = await supabase
          .from('teachers')
          .update({ display_name: newName })
          .eq('id', t.id)

        if (error) {
          console.log(`  ✗ ${t.display_name} → Error: ${error.message}`)
        } else {
          console.log(`  ✓ ${t.display_name} → ${newName}`)
        }
      }
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('Migration complete!')
  console.log('='.repeat(60))
}

main().catch(console.error)
