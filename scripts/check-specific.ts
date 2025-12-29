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

  // Check specific students that we expect to be enrolled
  const searches = [
    'pacheco',
    'miranda, victor',
    'miranda, isabel',
    'figueroa, kevin',
    'chinea, alex',
    'benscome',
    'annabelle'
  ]

  console.log('Checking LP enrollments for students:\n')

  for (const search of searches) {
    const { data: students } = await supabase
      .from('students')
      .select('id, full_name')
      .ilike('full_name', `%${search}%`)

    for (const s of students || []) {
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('status')
        .eq('student_id', s.id)
        .eq('service_id', service!.id)
        .maybeSingle()

      console.log(`${s.full_name} | LP: ${enrollment?.status || 'NONE'}`)
    }
  }
}

main().catch(console.error)
