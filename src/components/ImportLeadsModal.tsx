import { useState, useMemo } from 'react'
import {
  AlertCircle,
  CheckCircle,
  RefreshCw,
  AlertTriangle,
  Loader2
} from 'lucide-react'
import { useLeadMutations, useCheckDuplicateEmails, type LeadType, type CreateLeadInput } from '../lib/hooks'
import { supabase } from '../lib/supabase'
import { isValidEmail } from '../lib/validation'
import { formatNameLastFirst } from '../lib/utils'
import { AccessibleModal } from './ui/AccessibleModal'

interface ImportLeadsModalProps {
  onClose: () => void
}

interface ParsedLead {
  email: string
  name: string | null
  phone: string | null
  source_url: string | null
  notes: string | null
  created_at: string | null
  isDuplicate?: boolean
  isExistingCustomer?: boolean
  isInvalidEmail?: boolean
}

type ImportSource = 'pdf_leads' | 'eligibility_widget' | 'calendly_routing' | 'ea_deals' | 'event_orders' | 'custom'

const sourceConfigs: Record<ImportSource, { label: string; leadType: LeadType; description: string }> = {
  pdf_leads: {
    label: 'PDF Leads',
    leadType: 'exit_intent',
    description: 'Columns: name, email, page, zap_timestamp'
  },
  eligibility_widget: {
    label: 'Eligibility Widget Leads',
    leadType: 'exit_intent',
    description: 'Columns: timestamp, email, page_url'
  },
  calendly_routing: {
    label: 'Calendly Routing Submissions',
    leadType: 'calendly_call',
    description: 'Columns: Submitted At, Full Name, emailAddress, Routing Status, Answers'
  },
  ea_deals: {
    label: 'EA - Deals',
    leadType: 'calendly_call',
    description: 'Columns: Timestamp, Name, E-mail, Phone, Stage, Notes'
  },
  event_orders: {
    label: 'Event Orders',
    leadType: 'event',
    description: 'Columns: Order Date, Parent First Name, Parent Last Name, Email Address, Phone, Event Name'
  },
  custom: {
    label: 'Custom CSV',
    leadType: 'exit_intent',
    description: 'Map columns manually'
  },
}

export function ImportLeadsModal({ onClose }: ImportLeadsModalProps) {
  const [step, setStep] = useState<'source' | 'paste' | 'preview' | 'importing' | 'complete'>('source')
  const [source, setSource] = useState<ImportSource>('pdf_leads')
  const [csvText, setCsvText] = useState('')
  const [parsedLeads, setParsedLeads] = useState<ParsedLead[]>([])
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isParsing, setIsParsing] = useState(false)

  const { bulkCreateLeads } = useLeadMutations()
  const checkDuplicates = useCheckDuplicateEmails()

  const parseCSV = (text: string): string[][] => {
    const lines = text.trim().split('\n')
    return lines.map(line => {
      const values: string[] = []
      let current = ''
      let inQuotes = false

      for (let i = 0; i < line.length; i++) {
        const char = line[i]
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
      return values
    })
  }

  const handleParse = async () => {
    if (isParsing) return
    setIsParsing(true)
    setError(null)
    try {
      const rows = parseCSV(csvText)
      if (rows.length < 2) {
        setError('CSV must have a header row and at least one data row')
        return
      }

      const headers = rows[0].map(h => h.toLowerCase().trim())
      const data = rows.slice(1)

      let leads: ParsedLead[] = []

      switch (source) {
        case 'pdf_leads': {
          const emailIdx = headers.findIndex(h => h === 'email')
          const nameIdx = headers.findIndex(h => h === 'name')
          const pageIdx = headers.findIndex(h => h === 'page')
          const timestampIdx = headers.findIndex(h => h.includes('timestamp') || h.includes('zap'))

          if (emailIdx === -1) throw new Error('Could not find email column')

          leads = data.map(row => ({
            email: row[emailIdx]?.trim() || '',
            name: row[nameIdx]?.trim() || null,
            phone: null,
            source_url: row[pageIdx]?.trim() || null,
            notes: null,
            created_at: row[timestampIdx]?.trim() || null,
          })).filter(l => l.email)
          break
        }

        case 'eligibility_widget': {
          const emailIdx = headers.findIndex(h => h === 'email')
          const urlIdx = headers.findIndex(h => h.includes('url') || h.includes('page'))
          const timestampIdx = headers.findIndex(h => h === 'timestamp')

          if (emailIdx === -1) throw new Error('Could not find email column')

          leads = data.map(row => ({
            email: row[emailIdx]?.trim() || '',
            name: null,
            phone: null,
            source_url: row[urlIdx]?.trim() || null,
            notes: null,
            created_at: row[timestampIdx]?.trim() || null,
          })).filter(l => l.email)
          break
        }

        case 'calendly_routing': {
          const emailIdx = headers.findIndex(h => h.includes('email'))
          const nameIdx = headers.findIndex(h => h.includes('name'))
          const timestampIdx = headers.findIndex(h => h.includes('submitted'))
          const statusIdx = headers.findIndex(h => h.includes('routing') || h.includes('status'))

          if (emailIdx === -1) throw new Error('Could not find email column')

          leads = data.map(row => ({
            email: row[emailIdx]?.trim() || '',
            name: row[nameIdx]?.trim() || null,
            phone: null,
            source_url: null,
            notes: row[statusIdx]?.trim() || null,
            created_at: row[timestampIdx]?.trim() || null,
          })).filter(l => l.email)
          break
        }

        case 'ea_deals': {
          const emailIdx = headers.findIndex(h => h.includes('mail'))
          const nameIdx = headers.findIndex(h => h === 'name')
          const phoneIdx = headers.findIndex(h => h === 'phone')
          const timestampIdx = headers.findIndex(h => h === 'timestamp')
          const notesIdx = headers.findIndex(h => h === 'notes')

          if (emailIdx === -1) throw new Error('Could not find email column')

          leads = data.map(row => ({
            email: row[emailIdx]?.trim() || '',
            name: row[nameIdx]?.trim() || null,
            phone: row[phoneIdx]?.trim() || null,
            source_url: null,
            notes: row[notesIdx]?.trim() || null,
            created_at: row[timestampIdx]?.trim() || null,
          })).filter(l => l.email)
          break
        }

        case 'event_orders': {
          const emailIdx = headers.findIndex(h => h.includes('email'))
          const firstNameIdx = headers.findIndex(h => h.includes('first') && h.includes('name'))
          const lastNameIdx = headers.findIndex(h => h.includes('last') && h.includes('name'))
          const phoneIdx = headers.findIndex(h => h === 'phone')
          const dateIdx = headers.findIndex(h => h.includes('date'))
          const eventIdx = headers.findIndex(h => h.includes('event'))

          if (emailIdx === -1) throw new Error('Could not find email column')

          leads = data.map(row => {
            const firstName = row[firstNameIdx]?.trim() || ''
            const lastName = row[lastNameIdx]?.trim() || ''
            const fullName = [firstName, lastName].filter(Boolean).join(' ') || null

            return {
              email: row[emailIdx]?.trim() || '',
              name: fullName,
              phone: row[phoneIdx]?.trim() || null,
              source_url: null,
              notes: row[eventIdx]?.trim() ? `Event: ${row[eventIdx].trim()}` : null,
              created_at: row[dateIdx]?.trim() || null,
            }
          }).filter(l => l.email)
          break
        }

        case 'custom': {
          const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('mail'))
          const nameIdx = headers.findIndex(h => h === 'name' || h.includes('full') && h.includes('name'))
          const phoneIdx = headers.findIndex(h => h === 'phone' || h.includes('tel'))

          if (emailIdx === -1) throw new Error('Could not find email column')

          leads = data.map(row => ({
            email: row[emailIdx]?.trim() || '',
            name: nameIdx >= 0 ? row[nameIdx]?.trim() || null : null,
            phone: phoneIdx >= 0 ? row[phoneIdx]?.trim() || null : null,
            source_url: null,
            notes: null,
            created_at: null,
          })).filter(l => l.email)
          break
        }
      }

      // Validate email formats and mark invalid ones
      leads = leads.map(l => ({
        ...l,
        email: l.email.trim().toLowerCase(),
        isInvalidEmail: !isValidEmail(l.email),
      }))

      // Dedupe within the import (by email)
      const seen = new Set<string>()
      leads = leads.filter(l => {
        const email = l.email.toLowerCase()
        if (seen.has(email)) {
          return false
        }
        seen.add(email)
        return true
      })

      // Check against existing customers
      const emails = leads.map(l => l.email)
      const existingSet = await checkDuplicates.mutateAsync(emails)

      // Mark duplicates
      leads = leads.map(l => ({
        ...l,
        isExistingCustomer: existingSet.has(l.email.toLowerCase()),
      }))

      // Also check for existing leads (families with status='lead')
      const { data: existingLeadFamilies } = await supabase
        .from('families')
        .select('primary_email')
        .eq('status', 'lead')
        .not('primary_email', 'is', null)

      const existingLeadEmails = new Set(
        (existingLeadFamilies || [])
          .filter(f => f.primary_email)
          .map(f => f.primary_email!.toLowerCase())
      )
      leads = leads.map(l => ({
        ...l,
        isDuplicate: existingLeadEmails.has(l.email.toLowerCase()),
      }))

      setParsedLeads(leads)
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV')
    } finally {
      setIsParsing(false)
    }
  }

  const leadsToImport = useMemo(() => {
    return parsedLeads.filter(l => !l.isDuplicate && !l.isExistingCustomer && !l.isInvalidEmail)
  }, [parsedLeads])

  const invalidEmailCount = useMemo(() => {
    return parsedLeads.filter(l => l.isInvalidEmail).length
  }, [parsedLeads])

  const handleImport = async () => {
    if (step === 'importing') return // Prevent double submission
    setStep('importing')
    setError(null)

    try {
      const config = sourceConfigs[source]
      const leadsData: CreateLeadInput[] = leadsToImport.map(l => ({
        display_name: l.name ? formatNameLastFirst(l.name) : l.email.split('@')[0] + ' (Lead)',
        primary_email: l.email,
        primary_phone: l.phone,
        lead_type: config.leadType,
        lead_status: 'new',
        source_url: l.source_url,
        notes: l.notes,
      }))

      await bulkCreateLeads.mutateAsync(leadsData)

      setImportResult({
        imported: leadsToImport.length,
        skipped: parsedLeads.length - leadsToImport.length,
      })
      setStep('complete')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import leads')
      setStep('preview')
    }
  }

  const stepTitles: Record<typeof step, string> = {
    source: 'Import Leads - Select Source',
    paste: 'Import Leads - Paste Data',
    preview: 'Import Leads - Preview',
    importing: 'Import Leads - Importing',
    complete: 'Import Leads - Complete',
  }

  return (
    <AccessibleModal
      isOpen={true}
      onClose={onClose}
      title={stepTitles[step]}
      size="2xl"
    >
      <div className="flex flex-col max-h-[70vh]">
        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {step === 'source' && (
            <div className="space-y-4">
              <p className="text-zinc-400">Select the source of your leads:</p>
              <div className="grid grid-cols-2 gap-3">
                {(Object.entries(sourceConfigs) as [ImportSource, typeof sourceConfigs[ImportSource]][]).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => setSource(key)}
                    className={`p-4 rounded-lg border text-left transition-colors ${
                      source === key
                        ? 'bg-blue-500/10 border-blue-500 text-white'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    <p className="font-medium">{config.label}</p>
                    <p className="text-xs mt-1 opacity-70">{config.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'paste' && (
            <div className="space-y-4">
              <div>
                <p className="text-zinc-400 mb-2">
                  Paste your CSV data below. Expected format for <strong className="text-white">{sourceConfigs[source].label}</strong>:
                </p>
                <p className="text-xs text-zinc-500">{sourceConfigs[source].description}</p>
              </div>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="Paste CSV data here..."
                className="w-full h-64 p-4 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white font-mono placeholder-zinc-500 focus:outline-none focus:border-blue-500"
              />
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-zinc-800 rounded-lg p-4">
                  <p className="text-2xl font-semibold text-white">{parsedLeads.length}</p>
                  <p className="text-sm text-zinc-400">Total rows</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <p className="text-2xl font-semibold text-green-400">{leadsToImport.length}</p>
                  <p className="text-sm text-zinc-400">To import</p>
                </div>
                <div className="bg-zinc-800 rounded-lg p-4">
                  <p className="text-2xl font-semibold text-zinc-400">
                    {parsedLeads.length - leadsToImport.length - invalidEmailCount}
                  </p>
                  <p className="text-sm text-zinc-400">Duplicates</p>
                </div>
                {invalidEmailCount > 0 && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                    <p className="text-2xl font-semibold text-yellow-400">{invalidEmailCount}</p>
                    <p className="text-sm text-zinc-400">Invalid emails</p>
                  </div>
                )}
              </div>

              {/* Invalid email warning */}
              {invalidEmailCount > 0 && (
                <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {invalidEmailCount} row(s) have invalid email formats and will be skipped.
                </div>
              )}

              {/* Preview Table */}
              <div className="border border-zinc-700 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-800">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs font-medium text-zinc-400">Email</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-zinc-400">Name</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-zinc-400">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {parsedLeads.slice(0, 10).map((lead, idx) => (
                      <tr key={idx} className={lead.isDuplicate || lead.isExistingCustomer || lead.isInvalidEmail ? 'opacity-50' : ''}>
                        <td className="px-4 py-2 text-white">{lead.email}</td>
                        <td className="px-4 py-2 text-zinc-400">{lead.name ? formatNameLastFirst(lead.name) : '-'}</td>
                        <td className="px-4 py-2">
                          {lead.isInvalidEmail ? (
                            <span className="text-red-400 text-xs">Invalid email</span>
                          ) : lead.isExistingCustomer ? (
                            <span className="text-yellow-400 text-xs">Existing customer</span>
                          ) : lead.isDuplicate ? (
                            <span className="text-zinc-500 text-xs">Already a lead</span>
                          ) : (
                            <span className="text-green-400 text-xs">Will import</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedLeads.length > 10 && (
                  <div className="px-4 py-2 bg-zinc-800 text-xs text-zinc-500">
                    And {parsedLeads.length - 10} more rows...
                  </div>
                )}
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400 mt-0.5" />
                    <div>
                      <p className="text-red-400 font-medium">Import Failed</p>
                      <p className="text-red-400/80 text-sm mt-1">{error}</p>
                      <p className="text-zinc-500 text-xs mt-2">
                        Go back to edit your data, or try importing again. If the problem persists, check the data format.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mb-4" />
              <p className="text-white">Importing {leadsToImport.length} leads...</p>
            </div>
          )}

          {step === 'complete' && importResult && (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle className="w-12 h-12 text-green-400 mb-4" />
              <p className="text-xl font-semibold text-white mb-2">Import Complete</p>
              <p className="text-zinc-400">
                {importResult.imported} leads imported, {importResult.skipped} skipped
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800">
          {step === 'source' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep('paste')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Continue
              </button>
            </>
          )}

          {step === 'paste' && (
            <>
              <button
                onClick={() => setStep('source')}
                className="px-4 py-2 text-zinc-400 hover:text-white"
              >
                Back
              </button>
              <button
                onClick={handleParse}
                disabled={!csvText.trim() || isParsing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Parsing...
                  </>
                ) : (
                  'Parse & Preview'
                )}
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                onClick={() => setStep('paste')}
                className="px-4 py-2 text-zinc-400 hover:text-white"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={leadsToImport.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Import {leadsToImport.length} Leads
              </button>
            </>
          )}

          {step === 'complete' && (
            <>
              <div />
              <button
                onClick={onClose}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </AccessibleModal>
  )
}
