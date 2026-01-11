import { useState, useMemo } from 'react'
import {
  X,
  ChevronDown,
  ChevronRight,
  Clock,
  DollarSign,
  Download,
  Check,
  AlertCircle,
  Users,
  Edit2,
  CheckSquare,
  Square,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  usePayrollMutations,
  useInvoicesWithDetails,
} from '../lib/hooks'
import type {
  PayrollRunWithDetails,
  PayrollLineItemWithDetails,
  PayrollRunStatus,
  InvoiceWithDetails,
} from '../lib/hooks'
import { useToast } from '../lib/toast'
import BulkAdjustHoursModal from './BulkAdjustHoursModal'
import AddManualLineItemModal from './AddManualLineItemModal'

interface Props {
  run: PayrollRunWithDetails
  onClose: () => void
  onExportCSV: () => void
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

// ============================================================================
// Status Badge Component
// ============================================================================

const STATUS_CONFIG: Record<PayrollRunStatus, { bg: string; text: string }> = {
  draft: { bg: 'bg-zinc-500/20', text: 'text-zinc-300' },
  review: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  approved: { bg: 'bg-green-500/20', text: 'text-green-400' },
  paid: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
}

// ============================================================================
// Teacher Section Component
// ============================================================================

interface TeacherSectionProps {
  teacherId: string
  teacherName: string
  items: PayrollLineItemWithDetails[]
  isEditable: boolean
  isSelected: boolean
  onUpdateHours: (itemId: string, hours: number) => void
  onDeleteItem: (itemId: string) => void
  onToggleSelect: (teacherId: string) => void
}

function TeacherSection({
  teacherId,
  teacherName,
  items,
  isEditable,
  isSelected,
  onUpdateHours,
  onDeleteItem,
  onToggleSelect,
}: TeacherSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const totalHours = items.reduce((sum, item) => sum + item.actual_hours, 0)
  const totalAmount = items.reduce((sum, item) => sum + item.final_amount, 0)
  const hasAdjustments = items.some(item => item.adjustment_amount !== 0)

  const handleEditStart = (item: PayrollLineItemWithDetails) => {
    setEditingItemId(item.id)
    setEditValue(item.actual_hours.toString())
  }

  const handleEditSave = (itemId: string) => {
    const hours = parseFloat(editValue)
    if (!Number.isNaN(hours) && hours >= 0) {
      onUpdateHours(itemId, hours)
    }
    setEditingItemId(null)
  }

  const handleEditCancel = () => {
    setEditingItemId(null)
    setEditValue('')
  }

  return (
    <div className={`border rounded-lg overflow-hidden ${isSelected ? 'border-blue-500' : 'border-zinc-800'}`}>
      {/* Header */}
      <div className="flex items-center bg-zinc-900">
        {/* Selection Checkbox (only in editable mode) */}
        {isEditable && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleSelect(teacherId)
            }}
            className="p-4 text-zinc-400 hover:text-white transition-colors"
            aria-label={isSelected ? `Deselect ${teacherName}` : `Select ${teacherName}`}
          >
            {isSelected ? (
              <CheckSquare className="w-5 h-5 text-blue-400" aria-hidden="true" />
            ) : (
              <Square className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
        )}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex-1 flex items-center justify-between p-4 ${isEditable ? 'pl-0' : ''} hover:bg-zinc-800/50 transition-colors`}
        >
          <div className="flex items-center gap-3">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-zinc-500" aria-hidden="true" />
            ) : (
              <ChevronRight className="w-4 h-4 text-zinc-500" aria-hidden="true" />
            )}
            <span className="font-medium text-white">{teacherName}</span>
            {hasAdjustments && (
              <span className="px-1.5 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded">
                Adjusted
              </span>
            )}
          </div>
          <div className="flex items-center gap-6 text-sm">
            <span className="text-zinc-400">
              {totalHours.toFixed(1)} hrs
            </span>
            <span className="text-white font-medium">
              {formatCurrency(totalAmount)}
            </span>
          </div>
        </button>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-zinc-800 bg-zinc-950">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-zinc-500">
                <th className="px-4 py-2 text-left font-medium">Description</th>
                <th className="px-4 py-2 text-right font-medium">Rate</th>
                <th className="px-4 py-2 text-right font-medium">Hours</th>
                <th className="px-4 py-2 text-right font-medium">Amount</th>
                {isEditable && <th className="px-4 py-2 w-10"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {items.map(item => {
                // Manual line items have no teacher_assignment_id
                const isManualItem = !item.teacher_assignment_id
                return (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white">{item.description}</span>
                        {isManualItem && (
                          <span className="px-1.5 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded">
                            Manual
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        Rate from: {item.rate_source}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-zinc-300">
                      {formatCurrency(item.hourly_rate)}/hr
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingItemId === item.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleEditSave(item.id)
                              if (e.key === 'Escape') handleEditCancel()
                            }}
                            className="w-16 px-2 py-1 text-sm text-right bg-zinc-800 border border-zinc-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            autoFocus
                          />
                          <button
                            onClick={() => handleEditSave(item.id)}
                            className="p-1 text-green-400 hover:text-green-300"
                            aria-label="Save hours"
                          >
                            <Check className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button
                            onClick={handleEditCancel}
                            className="p-1 text-zinc-400 hover:text-zinc-300"
                            aria-label="Cancel edit"
                          >
                            <X className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-sm text-zinc-300">
                            {item.actual_hours.toFixed(1)}
                          </span>
                          {isEditable && (
                            <button
                              onClick={() => handleEditStart(item)}
                              className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                              aria-label="Edit hours"
                            >
                              <Edit2 className="w-3 h-3" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-white">
                        {formatCurrency(item.final_amount)}
                      </span>
                      {item.adjustment_amount !== 0 && (
                        <div className={`text-xs ${item.adjustment_amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {item.adjustment_amount > 0 ? '+' : ''}{formatCurrency(item.adjustment_amount)}
                        </div>
                      )}
                    </td>
                    {isEditable && (
                      <td className="px-4 py-3 text-right">
                        {isManualItem && (
                          <button
                            onClick={() => onDeleteItem(item.id)}
                            className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                            aria-label="Delete line item"
                            title="Delete manual line item"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Webhook Helper
// ============================================================================

interface TeacherPayrollData {
  teacherId: string
  teacherName: string
  teacherEmail: string
  totalHours: number
  totalAmount: number
  items: {
    student: string
    service: string
    hours: number
    rate: number
    amount: number
  }[]
}

async function triggerBulkPayrollNotifications(
  run: PayrollRunWithDetails,
  teacherGroups: [string, { name: string; items: PayrollLineItemWithDetails[] }][]
): Promise<void> {
  // Group data by teacher for individual notifications
  const teacherPayrollData: TeacherPayrollData[] = teacherGroups.map(([teacherId, group]) => {
    const teacher = group.items[0]?.teacher
    return {
      teacherId,
      teacherName: group.name,
      teacherEmail: teacher?.email || '',
      totalHours: group.items.reduce((sum, item) => sum + item.actual_hours, 0),
      totalAmount: group.items.reduce((sum, item) => sum + item.final_amount, 0),
      items: group.items.map(item => {
        // Determine the label based on item type:
        // - Student assignment: student name
        // - Service-level assignment: "Service Assignment"
        // - Manual line item: "Miscellaneous"
        const isManualItem = !item.teacher_assignment_id
        const studentLabel = item.enrollment?.student?.full_name
          || (isManualItem ? 'Miscellaneous' : 'Service Assignment')

        return {
          student: studentLabel,
          service: item.service?.name || item.description || 'Unknown',
          hours: item.actual_hours,
          rate: item.hourly_rate,
          amount: item.final_amount,
        }
      }),
    }
  })

  // Send notification for each teacher (fire and forget, don't block UI)
  const notifications = teacherPayrollData
    .filter(data => data.teacherEmail) // Only notify teachers with email
    .map(async (data) => {
      try {
        const payload = {
          payment_id: `bulk-${run.id}-${data.teacherId}`,
          teacher: {
            id: data.teacherId,
            name: data.teacherName,
            email: data.teacherEmail,
          },
          amounts: {
            total: data.totalAmount,
            hours: data.totalHours,
          },
          period: {
            start: run.period_start,
            end: run.period_end,
          },
          line_items: data.items,
          payment_method: 'Bulk Payroll',
          timestamp: new Date().toISOString(),
        }

        await fetch('https://eatonacademic.app.n8n.cloud/webhook/payroll-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } catch (err) {
        console.error(`Failed to notify teacher ${data.teacherName}:`, err)
        // Don't throw - continue with other notifications
      }
    })

  // Wait for all notifications to complete (but don't fail if some fail)
  await Promise.allSettled(notifications)
}

// ============================================================================
// Main Component
// ============================================================================

export default function PayrollRunDetail({ run, onClose, onExportCSV }: Props) {
  const { showError, showSuccess } = useToast()
  const { updateRunStatus, updateLineItem, deleteLineItem } = usePayrollMutations()
  const [isUpdating, setIsUpdating] = useState(false)
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<Set<string>>(new Set())
  const [showBulkAdjustModal, setShowBulkAdjustModal] = useState(false)
  const [showAddLineItemModal, setShowAddLineItemModal] = useState(false)

  // Group line items by teacher
  const teacherGroups = useMemo(() => {
    const groups: Record<string, { name: string; items: PayrollLineItemWithDetails[] }> = {}

    for (const item of run.line_items) {
      const teacherId = item.teacher_id
      if (!groups[teacherId]) {
        groups[teacherId] = {
          name: item.teacher?.display_name || 'Unknown Teacher',
          items: [],
        }
      }
      groups[teacherId].items.push(item)
    }

    // Sort by teacher name
    return Object.entries(groups).sort((a, b) => a[1].name.localeCompare(b[1].name))
  }, [run.line_items])

  // Fetch invoices for margin calculation
  const { data: periodInvoices = [] } = useInvoicesWithDetails()

  // Helper to parse date strings as UTC to avoid timezone issues
  const parseAsUTC = (dateStr: string): Date => new Date(dateStr + 'T00:00:00Z')

  // Calculate margin snapshot
  const marginSnapshot = useMemo(() => {
    // Filter invoices that overlap with this pay period
    // Use UTC parsing to ensure consistent date comparisons across timezones
    const relevantInvoices = periodInvoices.filter((inv: InvoiceWithDetails) => {
      if (!inv.period_start || !inv.period_end) return false
      const invStart = parseAsUTC(inv.period_start)
      const invEnd = parseAsUTC(inv.period_end)
      const runStart = parseAsUTC(run.period_start)
      const runEnd = parseAsUTC(run.period_end)
      // Check for any overlap (both boundaries inclusive)
      return invStart <= runEnd && invEnd >= runStart
    })

    const totalRevenue = relevantInvoices.reduce((sum: number, inv: InvoiceWithDetails) => sum + (inv.total_amount || 0), 0)
    const totalPayroll = run.total_adjusted
    const grossMargin = totalRevenue - totalPayroll
    const marginPercent = totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0

    return {
      totalRevenue,
      totalPayroll,
      grossMargin,
      marginPercent,
      invoiceCount: relevantInvoices.length,
    }
  }, [periodInvoices, run])

  const isEditable = run.status === 'review'

  // Selection handlers
  const handleToggleSelect = (teacherId: string) => {
    setSelectedTeacherIds(prev => {
      const next = new Set(prev)
      if (next.has(teacherId)) {
        next.delete(teacherId)
      } else {
        next.add(teacherId)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedTeacherIds.size === teacherGroups.length) {
      setSelectedTeacherIds(new Set())
    } else {
      setSelectedTeacherIds(new Set(teacherGroups.map(([id]) => id)))
    }
  }

  const selectedTeachers = teacherGroups
    .filter(([id]) => selectedTeacherIds.has(id))
    .map(([id, group]) => ({ id, name: group.name }))

  const handleUpdateHours = async (itemId: string, hours: number) => {
    try {
      await updateLineItem.mutateAsync({
        id: itemId,
        actualHours: hours,
      })
      showSuccess('Hours updated')
    } catch (error) {
      console.error('Failed to update hours:', error)
      showError(error instanceof Error ? error.message : 'Failed to update hours')
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this line item?')) return
    try {
      await deleteLineItem.mutateAsync(itemId)
      showSuccess('Line item deleted')
    } catch (error) {
      console.error('Failed to delete line item:', error)
      showError(error instanceof Error ? error.message : 'Failed to delete line item')
    }
  }

  const handleStatusChange = async (newStatus: PayrollRunStatus) => {
    setIsUpdating(true)
    try {
      await updateRunStatus.mutateAsync({
        id: run.id,
        status: newStatus,
        approvedBy: newStatus === 'approved' ? 'Admin' : undefined,
      })
      showSuccess(`Payroll run status updated to ${newStatus}`)

      // Trigger bulk notifications when payroll is marked as paid
      if (newStatus === 'paid') {
        triggerBulkPayrollNotifications(run, teacherGroups).catch(() => {
          // Silently handle notification errors - status was already updated successfully
        })
      }
    } catch (error) {
      console.error('Failed to update status:', error)
      showError(error instanceof Error ? error.message : 'Failed to update status')
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-3xl bg-zinc-900 border-l border-zinc-700 h-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Payroll: {formatDate(run.period_start)} - {formatDate(run.period_end)}
              </h2>
              <div className="flex items-center gap-3 mt-1">
                <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_CONFIG[run.status].bg} ${STATUS_CONFIG[run.status].text}`}>
                  {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                </span>
                <span className="text-sm text-zinc-400">
                  {run.teacher_count} teachers
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white transition-colors"
              aria-label="Close panel"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
                <Clock className="w-4 h-4" aria-hidden="true" />
                Total Hours
              </div>
              <div className="text-2xl font-semibold text-white">
                {run.total_hours.toFixed(1)}
              </div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
                <Users className="w-4 h-4" aria-hidden="true" />
                Teachers
              </div>
              <div className="text-2xl font-semibold text-white">
                {run.teacher_count}
              </div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
                <DollarSign className="w-4 h-4" aria-hidden="true" />
                Total Payroll
              </div>
              <div className="text-2xl font-semibold text-white">
                {formatCurrency(run.total_adjusted)}
              </div>
            </div>
          </div>

          {/* Margin Snapshot (show on approved and paid status) */}
          {(run.status === 'approved' || run.status === 'paid') && marginSnapshot.invoiceCount > 0 && (
            <div className="bg-zinc-800/30 border border-zinc-700 rounded-lg p-4">
              <h3 className="text-sm font-medium text-zinc-300 mb-3">Margin Snapshot</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-zinc-500">Revenue (invoiced)</div>
                  <div className="text-white font-medium">{formatCurrency(marginSnapshot.totalRevenue)}</div>
                </div>
                <div>
                  <div className="text-zinc-500">Payroll (this run)</div>
                  <div className="text-white font-medium">{formatCurrency(marginSnapshot.totalPayroll)}</div>
                </div>
                <div className="col-span-2 pt-2 border-t border-zinc-700">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Gross Margin</span>
                    <span className={`font-medium ${marginSnapshot.grossMargin >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(marginSnapshot.grossMargin)} ({marginSnapshot.marginPercent.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                Based on {marginSnapshot.invoiceCount} invoice{marginSnapshot.invoiceCount !== 1 ? 's' : ''} overlapping this period
              </p>
            </div>
          )}

          {/* Instructions and Bulk Actions (only in review mode) */}
          {run.status === 'review' && (
            <div className="space-y-3">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" aria-hidden="true" />
                  <div>
                    <h4 className="font-medium text-blue-400">Review Mode</h4>
                    <p className="text-sm text-zinc-400 mt-1">
                      Click on any teacher row to expand and edit hours individually.
                      Select multiple teachers to bulk adjust their hours.
                    </p>
                  </div>
                </div>
              </div>

              {/* Bulk Actions Toolbar */}
              <div className="flex items-center justify-between bg-zinc-800/50 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSelectAll}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-300 hover:text-white transition-colors"
                  >
                    {selectedTeacherIds.size === teacherGroups.length && teacherGroups.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-blue-400" aria-hidden="true" />
                    ) : (
                      <Square className="w-4 h-4" aria-hidden="true" />
                    )}
                    {selectedTeacherIds.size === teacherGroups.length && teacherGroups.length > 0
                      ? 'Deselect All'
                      : 'Select All'}
                  </button>
                  {selectedTeacherIds.size > 0 && (
                    <span className="text-sm text-zinc-400">
                      {selectedTeacherIds.size} teacher{selectedTeacherIds.size !== 1 ? 's' : ''} selected
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAddLineItemModal(true)}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-zinc-300 bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    Add Line Item
                  </button>
                  <button
                    onClick={() => setShowBulkAdjustModal(true)}
                    disabled={selectedTeacherIds.size === 0}
                    className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Bulk Adjust Hours
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Teacher List */}
          <div>
            <h3 className="text-sm font-medium text-zinc-300 mb-3">
              Teacher Breakdown
            </h3>
            <div className="space-y-2">
              {teacherGroups.map(([teacherId, group]) => (
                <TeacherSection
                  key={teacherId}
                  teacherId={teacherId}
                  teacherName={group.name}
                  items={group.items}
                  isEditable={isEditable}
                  isSelected={selectedTeacherIds.has(teacherId)}
                  onUpdateHours={handleUpdateHours}
                  onDeleteItem={handleDeleteItem}
                  onToggleSelect={handleToggleSelect}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Bulk Adjust Hours Modal */}
        {showBulkAdjustModal && (
          <BulkAdjustHoursModal
            runId={run.id}
            selectedTeachers={selectedTeachers}
            onClose={() => setShowBulkAdjustModal(false)}
            onSuccess={() => {
              setShowBulkAdjustModal(false)
              setSelectedTeacherIds(new Set())
              showSuccess(`Updated hours for ${selectedTeachers.length} teacher${selectedTeachers.length !== 1 ? 's' : ''}`)
            }}
          />
        )}

        {/* Add Manual Line Item Modal */}
        {showAddLineItemModal && (
          <AddManualLineItemModal
            runId={run.id}
            existingTeacherIds={teacherGroups.map(([id]) => id)}
            onClose={() => setShowAddLineItemModal(false)}
            onSuccess={() => {
              setShowAddLineItemModal(false)
              showSuccess('Line item added')
            }}
          />
        )}

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-zinc-900 border-t border-zinc-800 px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-zinc-400">
              Total: <span className="text-white font-semibold">{formatCurrency(run.total_adjusted)}</span>
            </div>
            <div className="flex gap-3">
              {run.status === 'draft' && (
                <button
                  onClick={() => handleStatusChange('review')}
                  disabled={isUpdating}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isUpdating ? 'Updating...' : 'Start Review'}
                </button>
              )}

              {run.status === 'review' && (
                <>
                  <button
                    onClick={() => handleStatusChange('draft')}
                    disabled={isUpdating}
                    className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors"
                  >
                    Back to Draft
                  </button>
                  <button
                    onClick={() => handleStatusChange('approved')}
                    disabled={isUpdating}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-500 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isUpdating ? 'Updating...' : 'Approve Payroll'}
                  </button>
                </>
              )}

              {run.status === 'approved' && (
                <>
                  <button
                    onClick={onExportCSV}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" aria-hidden="true" />
                    Export CSV
                  </button>
                  <button
                    onClick={() => handleStatusChange('paid')}
                    disabled={isUpdating}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isUpdating ? 'Updating...' : 'Mark as Paid'}
                  </button>
                </>
              )}

              {run.status === 'paid' && (
                <button
                  onClick={onExportCSV}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" aria-hidden="true" />
                  Export CSV
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
