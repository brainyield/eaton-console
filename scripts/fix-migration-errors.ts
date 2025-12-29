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
  console.log('Fixing incorrectly migrated names...\n')

  // Fix family display names that were incorrectly converted
  const familyFixes = [
    { wrong: 'Moms, 3', correct: '3 Moms' },
    { wrong: 'Family, Diaz', correct: 'Diaz Family' },
    { wrong: 'Family, Villarreal', correct: 'Villarreal Family' },
    { wrong: 'Family, Pichs', correct: 'Pichs Family' },
  ]

  console.log('📁 Fixing families.display_name...')
  for (const fix of familyFixes) {
    const { error } = await supabase
      .from('families')
      .update({ display_name: fix.correct })
      .eq('display_name', fix.wrong)

    if (error) {
      console.log(`  ✗ ${fix.wrong} → Error: ${error.message}`)
    } else {
      console.log(`  ✓ ${fix.wrong} → ${fix.correct}`)
    }
  }

  // Fix student names that were incorrectly converted (nicknames/test data)
  const studentFixes = [
    { wrong: 'Sprouts, Brussel', correct: 'Brussel Sprouts' },
    { wrong: 'Pod, Learning', correct: 'Learning Pod' },
  ]

  console.log('\n🎓 Fixing students.full_name...')
  for (const fix of studentFixes) {
    const { error } = await supabase
      .from('students')
      .update({ full_name: fix.correct })
      .eq('full_name', fix.wrong)

    if (error) {
      console.log(`  ✗ ${fix.wrong} → Error: ${error.message}`)
    } else {
      console.log(`  ✓ ${fix.wrong} → ${fix.correct}`)
    }
  }

  console.log('\nDone!')
}

main().catch(console.error)
