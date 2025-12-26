import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  X,
  AlertTriangle,
  Check,
  Loader2,
} from 'lucide-react'
import {
  useBillableEnrollments,
  useExistingInvoicesForPeriod,
  useInvoiceMutations,
  getWeekBounds,
  getNextMonday,
} from '../lib/hooks'
import type { BillableEnrollment } from '../lib/hooks'

// ============================================================================
// Types
// ============================================================================

type InvoiceType = 'weekly' | 'monthly'

interface DraftPreviewItem {
  enrollment: BillableEnrollment
  selected: boolean
  hasExisting: boolean
  amount: number
  description: string
}

// ============================================================================
// Service Badge (inline for this modal)
// ============================================================================

const SERVICE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  academic_coaching: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'AC' },
  learning_pod: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Pod' },
  consulting: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Consult' },
  eaton_hub: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Hub' },
  eaton_online: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', label: 'Online' },
  elective_classes: { bg: 'bg-pink-500/20', text: 'text-pink-400', label: 'Elective' },
}

function ServiceBadge({ code }: { code: string }) {
  const config = SERVICE_COLORS[code] || { bg: 'bg-zinc-500/20', text: 'text-zinc-400', label: code }
  return (
    <span className={`inline-flex px-1.5 py-0.5 text-xs font-medium rounded ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  )
}

// ============================================================================
// Helper Functions
// ============================================================================

function calculateAmount(enrollment: BillableEnrollment): number {
  const service = enrollment.service

  switch (service?.code) {
    case 'academic_coaching':
      return (enrollment.hours_per_week || 0) * (enrollment.hourly_rate_customer || 0)
    case 'eaton_online':
      return enrollment.weekly_tuition || 0
    case 'learning_pod':
    case 'learning_pod':
    case 'consulting':
    case 'elective_classes':
      return enrollment.monthly_rate || 0
      return enrollment.daily_rate || 100
    default:
      return enrollment.monthly_rate || 0
  }
}

function buildDescription(enrollment: BillableEnrollment): string {
  const studentName = enrollment.student?.full_name || 'Unknown'
  const serviceName = enrollment.service?.name || 'Service'
  const serviceCode = enrollment.service?.code

  switch (serviceCode) {
    case 'academic_coaching':
      const hours = enrollment.hours_per_week || 0
      const rate = enrollment.hourly_rate_customer || 0
      return `${studentName} - ${serviceName}: ${hours} hrs × $${rate.toFixed(2)}`
    case 'eaton_online':
      const weeklyRate = enrollment.weekly_tuition || 0
      return `${studentName} - ${serviceName}: $${weeklyRate.toFixed(2)}/week`
    default:
      return `${studentName} - ${serviceName}`
  }
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function getMonthBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return { start, end }
}

// ============================================================================
// Component
// ============================================================================

interface Props {
  onClose: () => void
  onSuccess: () => void
}

export default function GenerateDraftsModal({ onClose, onSuccess }: Props) {
  // State
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('weekly')
  const [periodStart, setPeriodStart] = useState<string>('')
  const [periodEnd, setPeriodEnd] = useState<string>('')
  const [dueDate, setDueDate] = useState<string>('')
  const [periodNote, setPeriodNote] = useState<string>('')
  const [selectedEnrollments, setSelectedEnrollments] = useState<Set<string>>(new Set())
  const [serviceFilter, setServiceFilter] = useState<string>('')

  // Initialize dates based on invoice type
  useEffect(() => {
    const today = new Date()
    
    if (invoiceType === 'weekly') {
      // Get this week's bounds (Mon-Fri)
      const { start, end } = getWeekBounds(today)
      setPeriodStart(formatDate(start))
      setPeriodEnd(formatDate(end))
      
      // Due date is next Monday
      const nextMon = getNextMonday(end)
      setDueDate(formatDate(nextMon))
      
      // Note format
      const startStr = start.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
      const endStr = end.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
      setPeriodNote(`For the week of ${startStr} - ${endStr}`)
      
    } else {
      // Monthly: current month bounds
      const { start, end } = getMonthBounds(today)
      setPeriodStart(formatDate(start))
      setPeriodEnd(formatDate(end))
      
      // Due date is Monday after month ends
      const nextMon = getNextMonday(end)
      setDueDate(formatDate(nextMon))
      
      // Note format
      const monthYear = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      setPeriodNote(`For ${monthYear}`)
    }
  }, [invoiceType])

  // Data fetching
  const { data: enrollments = [], isLoading: enrollmentsLoading } = useBillableEnrollments(
    invoiceType === 'weekly' ? 'weekly' : 'monthly'
  )

  const { data: existingInvoices = [] } = useExistingInvoicesForPeriod(periodStart, periodEnd)

  const { generateDrafts } = useInvoiceMutations()

  // Build preview items
  const previewItems = useMemo(() => {
    const existingFamilyIds = new Set(existingInvoices.map(i => i.family_id))

    return enrollments
      .filter(e => {
        // Filter by service if selected
        if (serviceFilter && e.service?.code !== serviceFilter) return false
        // Only active families
        if (e.family?.status !== 'active') return false
        return true
      })
      .map(enrollment => ({
        enrollment,
        selected: selectedEnrollments.has(enrollment.id),
        hasExisting: existingFamilyIds.has(enrollment.family?.id || ''),
        amount: calculateAmount(enrollment),
        description: buildDescription(enrollment),
      }))
      .sort((a, b) => {
        // Sort: non-existing first, then by family name
        if (a.hasExisting !== b.hasExisting) return a.hasExisting ? 1 : -1
        return (a.enrollment.family?.display_name || '').localeCompare(
          b.enrollment.family?.display_name || ''
        )
      })
  }, [enrollments, existingInvoices, serviceFilter, selectedEnrollments])

  // Auto-select non-existing enrollments when preview changes
  useEffect(() => {
    const autoSelect = new Set<string>()
    previewItems.forEach(item => {
      if (!item.hasExisting) {
        autoSelect.add(item.enrollment.id)
      }
    })
    setSelectedEnrollments(autoSelect)
  }, [previewItems.length]) // Only on count change to avoid infinite loop

  // Group by family for display
  const groupedByFamily = useMemo(() => {
    const grouped = new Map<string, DraftPreviewItem[]>()
    
    previewItems.forEach(item => {
      const familyId = item.enrollment.family?.id || 'unknown'
      if (!grouped.has(familyId)) {
        grouped.set(familyId, [])
      }
      grouped.get(familyId)!.push(item)
    })

    return Array.from(grouped.entries()).map(([familyId, items]) => ({
      familyId,
      familyName: items[0].enrollment.family?.display_name || 'Unknown',
      items,
      totalAmount: items.reduce((sum, i) => sum + (selectedEnrollments.has(i.enrollment.id) ? i.amount : 0), 0),
      hasExisting: items.some(i => i.hasExisting),
      allSelected: items.every(i => selectedEnrollments.has(i.enrollment.id)),
      someSelected: items.some(i => selectedEnrollments.has(i.enrollment.id)),
    }))
  }, [previewItems, selectedEnrollments])

  // Counts
  const selectedCount = selectedEnrollments.size
  const totalAmount = previewItems
    .filter(i => selectedEnrollments.has(i.enrollment.id))
    .reduce((sum, i) => sum + i.amount, 0)
  const familyCount = new Set(
    previewItems
      .filter(i => selectedEnrollments.has(i.enrollment.id))
      .map(i => i.enrollment.family?.id)
  ).size

  // Handlers
  const handleToggleEnrollment = useCallback((id: string) => {
    setSelectedEnrollments(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleToggleFamily = useCallback((familyId: string) => {
    const familyEnrollments = previewItems
      .filter(i => i.enrollment.family?.id === familyId)
      .map(i => i.enrollment.id)
    
    const allSelected = familyEnrollments.every(id => selectedEnrollments.has(id))
    
    setSelectedEnrollments(prev => {
      const next = new Set(prev)
      familyEnrollments.forEach(id => {
        if (allSelected) {
          next.delete(id)
        } else {
          next.add(id)
        }
      })
      return next
    })
  }, [previewItems, selectedEnrollments])

  const handleSelectAll = useCallback(() => {
    if (selectedCount === previewItems.filter(i => !i.hasExisting).length) {
      setSelectedEnrollments(new Set())
    } else {
      setSelectedEnrollments(new Set(
        previewItems.filter(i => !i.hasExisting).map(i => i.enrollment.id)
      ))
    }
  }, [previewItems, selectedCount])

  const handleGenerate = useCallback(async () => {
    if (selectedCount === 0) return

    try {
      await generateDrafts.mutateAsync({
        period_start: periodStart,
        period_end: periodEnd,
        period_note: periodNote,
        due_date: dueDate,
        enrollment_ids: Array.from(selectedEnrollments),
        invoice_type: invoiceType,
      })
      onSuccess()
    } catch (error) {
      console.error('Failed to generate drafts:', error)
      alert('Failed to generate drafts. Check console for details.')
    }
  }, [selectedCount, generateDrafts, periodStart, periodEnd, periodNote, dueDate, selectedEnrollments, invoiceType, onSuccess])

  // Service filter options based on invoice type
  const serviceOptions = invoiceType === 'weekly'
    ? [
        { value: '', label: 'All Weekly Services' },
        { value: 'academic_coaching', label: 'Academic Coaching' },
        { value: 'eaton_online', label: 'Eaton Online' },
      ]
    : [
        { value: '', label: 'All Monthly Services' },
        { value: 'learning_pod', label: 'Learning Pod' },
        { value: 'consulting', label: 'Consulting' },
        { value: 'elective_classes', label: 'Elective Classes' },
      ]

  const existingCount = previewItems.filter(i => i.hasExisting).length

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/60" onClick={onClose} />

        {/* Modal */}
        <div className="relative bg-zinc-900 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700">
            <h2 className="text-xl font-semibold text-white">Generate Invoice Drafts</h2>
            <button
              onClick={onClose}
              className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Configuration */}
          <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-800/30">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Invoice Type */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Invoice Type
                </label>
                <select
                  value={invoiceType}
                  onChange={e => {
                    setInvoiceType(e.target.value as InvoiceType)
                    setServiceFilter('')
                  }}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-zinc-500"
                >
                  <option value="weekly">Weekly (AC, Online)</option>
                  <option value="monthly">Monthly (Pod, Consult, etc.)</option>
                </select>
              </div>

              {/* Period Start */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Period Start
                </label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={e => setPeriodStart(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-zinc-500"
                />
              </div>

              {/* Period End */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Period End
                </label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={e => setPeriodEnd(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-zinc-500"
                />
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-zinc-500"
                />
              </div>
            </div>

            {/* Note and Service Filter */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Invoice Note
                </label>
                <input
                  type="text"
                  value={periodNote}
                  onChange={e => setPeriodNote(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-zinc-500"
                  placeholder="e.g., For the week of 12/23/2025 - 12/27/2025"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Filter by Service
                </label>
                <select
                  value={serviceFilter}
                  onChange={e => setServiceFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-zinc-500"
                >
                  {serviceOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Preview Header */}
          <div className="px-6 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-800/20">
            <div className="flex items-center gap-4">
              <span className="text-sm text-zinc-400">
                {enrollmentsLoading ? 'Loading...' : (
                  <>
                    <span className="text-white font-medium">{familyCount}</span> families,{' '}
                    <span className="text-white font-medium">{selectedCount}</span> enrollments selected
                  </>
                )}
              </span>
              {existingCount > 0 && (
                <span className="flex items-center gap-1 text-xs text-amber-400">
                  <AlertTriangle className="w-3 h-3" />
                  {existingCount} already have invoices for this period
                </span>
              )}
            </div>
            <button
              onClick={handleSelectAll}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              {selectedCount === previewItems.filter(i => !i.hasExisting).length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          {/* Preview List */}
          <div className="flex-1 overflow-y-auto px-6 py-4 min-h-[300px] max-h-[400px]">
            {enrollmentsLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
              </div>
            ) : previewItems.length === 0 ? (
              <div className="flex items-center justify-center h-full text-zinc-500">
                No active enrollments found for {invoiceType} billing
              </div>
            ) : (
              <div className="space-y-3">
                {groupedByFamily.map(group => (
                  <div
                    key={group.familyId}
                    className={`border rounded-lg overflow-hidden ${
                      group.hasExisting 
                        ? 'border-amber-500/30 bg-amber-500/5' 
                        : 'border-zinc-700 bg-zinc-800/30'
                    }`}
                  >
                    {/* Family Header */}
                    <div
                      className="flex items-center justify-between px-4 py-2 bg-zinc-800/50 cursor-pointer"
                      onClick={() => handleToggleFamily(group.familyId)}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={group.allSelected}
                          onChange={() => handleToggleFamily(group.familyId)}
                          onClick={e => e.stopPropagation()}
                          className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-zinc-900"
                        />
                        <span className="font-medium text-white">{group.familyName}</span>
                        {group.hasExisting && (
                          <span className="flex items-center gap-1 text-xs text-amber-400">
                            <AlertTriangle className="w-3 h-3" />
                            Invoice exists
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-zinc-400">
                        ${group.totalAmount.toFixed(2)}
                      </span>
                    </div>

                    {/* Enrollments */}
                    <div className="divide-y divide-zinc-800">
                      {group.items.map(item => (
                        <div
                          key={item.enrollment.id}
                          className={`flex items-center justify-between px-4 py-2 ${
                            item.hasExisting ? 'opacity-50' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={selectedEnrollments.has(item.enrollment.id)}
                              onChange={() => handleToggleEnrollment(item.enrollment.id)}
                              disabled={item.hasExisting}
                              className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-zinc-900 disabled:opacity-50"
                            />
                            <ServiceBadge code={item.enrollment.service?.code || ''} />
                            <span className="text-sm text-zinc-300">
                              {item.enrollment.student?.full_name}
                            </span>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-white">
                              ${item.amount.toFixed(2)}
                            </div>
                            {item.enrollment.service?.code === 'academic_coaching' && (
                              <div className="text-xs text-zinc-500">
                                {item.enrollment.hours_per_week} hrs × ${item.enrollment.hourly_rate_customer?.toFixed(2)}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-zinc-700 bg-zinc-800/30 flex items-center justify-between">
            <div className="text-sm text-zinc-400">
              {selectedCount > 0 && (
                <>
                  Will create <span className="text-white font-medium">{familyCount}</span> invoice{familyCount !== 1 ? 's' : ''} totaling{' '}
                  <span className="text-green-400 font-medium">${totalAmount.toFixed(2)}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={selectedCount === 0 || generateDrafts.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generateDrafts.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Generate {familyCount} Draft{familyCount !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
