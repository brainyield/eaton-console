import { useState, useMemo } from 'react'
import {
  X,
  Upload,
  FileText,
  AlertCircle,
  CheckCircle,
  Users,
  RefreshCw,
  ChevronDown
} from 'lucide-react'
import { useLeadMutations, useCheckDuplicateEmails, type LeadType, type Lead } from '../lib/hooks'
import { supabase } from '../lib/supabase'

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
  const [existingEmails, setExistingEmails] = useState<Set<string>>(new Set())
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

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
      setExistingEmails(existingSet)

      // Mark duplicates
      leads = leads.map(l => ({
        ...l,
        isExistingCustomer: existingSet.has(l.email.toLowerCase()),
      }))

      // Also check for existing leads
      const { data: existingLeads } = await supabase
        .from('leads')
        .select('email')
        .in('email', emails.map(e => e.toLowerCase()))

      const existingLeadEmails = new Set((existingLeads || []).map(l => l.email?.toLowerCase()))
      leads = leads.map(l => ({
        ...l,
        isDuplicate: existingLeadEmails.has(l.email.toLowerCase()),
      }))

      setParsedLeads(leads)
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV')
    }
  }

  const leadsToImport = useMemo(() => {
    return parsedLeads.filter(l => !l.isDuplicate && !l.isExistingCustomer)
  }, [parsedLeads])

  const handleImport = async () => {
    setStep('importing')
    setError(null)

    try {
      const config = sourceConfigs[source]
      const leadsData: Omit<Lead, 'id' | 'created_at' | 'updated_at'>[] = leadsToImport.map(l => ({
        email: l.email,
        name: l.name,
        phone: l.phone,
        lead_type: config.leadType,
        status: 'new',
        source_url: l.source_url,
        family_id: null,
        converted_at: null,
        num_children: null,
        service_interest: null,
        notes: l.notes,
        mailchimp_id: null,
        mailchimp_status: null,
        mailchimp_last_synced_at: null,
        mailchimp_tags: null,
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-white">Import Leads</h2>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

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
              <div className="grid grid-cols-3 gap-4">
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
                    {parsedLeads.length - leadsToImport.length}
                  </p>
                  <p className="text-sm text-zinc-400">Skipped (duplicates)</p>
                </div>
              </div>

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
                      <tr key={idx} className={lead.isDuplicate || lead.isExistingCustomer ? 'opacity-50' : ''}>
                        <td className="px-4 py-2 text-white">{lead.email}</td>
                        <td className="px-4 py-2 text-zinc-400">{lead.name || '-'}</td>
                        <td className="px-4 py-2">
                          {lead.isExistingCustomer ? (
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
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
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
                disabled={!csvText.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Parse & Preview
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
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
    </div>
  )
}
