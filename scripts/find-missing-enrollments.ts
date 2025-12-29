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

// Parse CSV
function parseCsv(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').filter(line => line.trim())
  const dataLines = lines.slice(1)

  return dataLines.map(line => {
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
      studentName: values[1] || '',
      customerName: values[2] || '',
      customerEmail: values[3] || '',
      ageGroup: values[6] || '',
    }
  }).filter(row => row.studentName)
}

function toDisplayName(name: string): string {
  if (!name) return ''
  if (name.includes(',')) {
    const parts = name.split(',').map(s => s.trim())
    if (parts.length >= 3 && /^(jr\.?|sr\.?|ii|iii|iv)$/i.test(parts[1])) {
      const lastName = parts[0]
      const suffix = parts[1].replace('.', '')
      const firstName = parts.slice(2).join(' ')
      return `${firstName} ${lastName} ${suffix}`
    }
    const lastName = parts[0]
    const firstName = parts.slice(1).join(' ')
    return `${firstName} ${lastName}`
  }
  return name
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim()
}

async function main() {
  const { data: service } = await supabase
    .from('services')
    .select('id')
    .eq('code', 'learning_pod')
    .single()

  // Get all LP enrollments with student names
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('student:students(full_name)')
    .eq('service_id', service!.id)
    .in('status', ['active', 'trial'])

  // Build set of enrolled student names (try both formats)
  const enrolledNames = new Set<string>()
  for (const e of enrollments || []) {
    const name = (e.student as any)?.full_name || ''
    enrolledNames.add(normalizeName(name))
    enrolledNames.add(normalizeName(toDisplayName(name)))
  }

  // Parse CSV
  const csvPath = path.join(__dirname, '..', 'Learning Pod Clients (Current).csv')
  const csvRows = parseCsv(csvPath)

  console.log('Students in CSV without LP enrollment:\n')

  let missing = 0
  for (const row of csvRows) {
    const displayName = toDisplayName(row.studentName)

    // Try multiple name formats
    const formats = [
      normalizeName(displayName),
      normalizeName(row.studentName),
      normalizeName(row.studentName.split(',').map(s => s.trim()).reverse().join(' ')),
    ]

    const found = formats.some(f => enrolledNames.has(f))

    if (!found) {
      missing++
      console.log(`${missing}. ${displayName}`)
      console.log(`   Family: ${toDisplayName(row.customerName)} (${row.customerEmail})`)
      console.log(`   Age Group: ${row.ageGroup}`)
      console.log('')
    }
  }

  console.log(`Total missing: ${missing}`)
}

main().catch(console.error)
