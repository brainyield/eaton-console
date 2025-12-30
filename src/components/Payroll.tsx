import { useState, useMemo } from 'react'
import {
  Plus,
  Clock,
  Check,
  FileText,
  DollarSign,
  ChevronUp,
  ChevronDown,
  Users,
  Calendar,
  AlertCircle,
  Trash2,
} from 'lucide-react'
import {
  usePayrollRuns,
  usePayrollRunWithItems,
  usePendingPayrollAdjustments,
  usePayrollMutations,
  generatePayrollCSV,
  downloadPayrollCSV,
} from '../lib/hooks'
import type { PayrollRunStatus, PayrollRunWithDetails } from '../lib/hooks'
import CreatePayrollRunModal from './CreatePayrollRunModal'
import PayrollRunDetail from './PayrollRunDetail'
import PayrollAdjustmentModal from './PayrollAdjustmentModal'

// ============================================================================
// Types
// ============================================================================

type TabKey = 'current' | 'history' | 'adjustments'
type SortField = 'period' | 'teachers' | 'hours' | 'amount' | 'status'
type SortDirection = 'asc' | 'desc'

interface SortConfig {
  field: SortField
  direction: SortDirection
}

// ============================================================================
// Status Badge Component
// ============================================================================

const STATUS_CONFIG: Record<PayrollRunStatus, { bg: string; text: string; icon: typeof Clock; label: string }> = {
  draft: { bg: 'bg-zinc-500/20', text: 'text-zinc-300', icon: FileText, label: 'Draft' },
  review: { bg: 'bg-amber-500/20', text: 'text-amber-400', icon: Clock, label: 'In Review' },
  approved: { bg: 'bg-green-500/20', text: 'text-green-400', icon: Check, label: 'Approved' },
  paid: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: DollarSign, label: 'Paid' },
}

function StatusBadge({ status }: { status: PayrollRunStatus }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft
  const Icon = config.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  )
}

// ============================================================================
// Sortable Header Component
// ============================================================================

interface SortableHeaderProps {
  field: SortField
  label: string
  sort: SortConfig
  onSort: (field: SortField) => void
  className?: string
}

function SortableHeader({ field, label, sort, onSort, className = '' }: SortableHeaderProps) {
  const isActive = sort.field === field
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-zinc-200 select-none ${className}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <span className={`transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
          {sort.direction === 'asc' ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </span>
      </div>
    </th>
  )
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

// ============================================================================
// Main Component
// ============================================================================

export default function Payroll() {
  // State
  const [activeTab, setActiveTab] = useState<TabKey>('current')
  const [sort, setSort] = useState<SortConfig>({ field: 'period', direction: 'desc' })
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

  // Data fetching
  const { data: allRuns = [], isLoading } = usePayrollRuns()
  const { data: pendingAdjustments = [] } = usePendingPayrollAdjustments()
  const { data: selectedRunDetails } = usePayrollRunWithItems(selectedRunId || undefined)
  const { deletePayrollRun } = usePayrollMutations()

  // Get current (non-paid) run if exists
  const currentRun = useMemo(() => {
    return allRuns.find(r => r.status !== 'paid')
  }, [allRuns])

  // History = paid runs
  const historyRuns = useMemo(() => {
    return allRuns.filter(r => r.status === 'paid')
  }, [allRuns])

  // Tab counts
  const counts = useMemo(() => ({
    current: currentRun ? 1 : 0,
    history: historyRuns.length,
    adjustments: pendingAdjustments.length,
  }), [currentRun, historyRuns, pendingAdjustments])

  // Sort handler
  const handleSort = (field: SortField) => {
    setSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  // Sort history runs
  const sortedHistoryRuns = useMemo(() => {
    const sorted = [...historyRuns]
    sorted.sort((a, b) => {
      let comparison = 0
      switch (sort.field) {
        case 'period':
          comparison = new Date(a.period_start).getTime() - new Date(b.period_start).getTime()
          break
        case 'teachers':
          comparison = a.teacher_count - b.teacher_count
          break
        case 'hours':
          comparison = a.total_hours - b.total_hours
          break
        case 'amount':
          comparison = a.total_adjusted - b.total_adjusted
          break
        case 'status':
          comparison = a.status.localeCompare(b.status)
          break
      }
      return sort.direction === 'asc' ? comparison : -comparison
    })
    return sorted
  }, [historyRuns, sort])

  // Handle delete draft run
  const handleDeleteRun = async (runId: string) => {
    if (!confirm('Are you sure you want to delete this draft payroll run?')) return
    try {
      await deletePayrollRun.mutateAsync(runId)
    } catch (error) {
      console.error('Failed to delete payroll run:', error)
      alert('Failed to delete payroll run')
    }
  }

  // Handle CSV export
  const handleExportCSV = (run: PayrollRunWithDetails) => {
    const csv = generatePayrollCSV(run)
    const filename = `payroll-${run.period_start}-to-${run.period_end}.csv`
    downloadPayrollCSV(csv, filename)
  }

  // Tab change handler
  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab)
  }

  // Tabs configuration
  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'current', label: 'Current', count: counts.current },
    { key: 'history', label: 'History', count: counts.history },
    { key: 'adjustments', label: 'Adjustments', count: counts.adjustments },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Payroll</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Manage bi-weekly teacher payroll
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAdjustmentModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Adjustment
            </button>
            {!currentRun && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Payroll Run
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-4">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.key
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              {tab.label}
              <span className={`ml-2 px-1.5 py-0.5 text-xs rounded ${
                activeTab === tab.key ? 'bg-zinc-600' : 'bg-zinc-800'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-zinc-400">Loading payroll data...</div>
          </div>
        ) : activeTab === 'current' ? (
          // Current Run Tab
          <div>
            {currentRun ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-lg font-semibold text-white">
                        {formatDate(currentRun.period_start)} - {formatDate(currentRun.period_end)}
                      </h2>
                      <StatusBadge status={currentRun.status} />
                    </div>
                    <div className="flex items-center gap-6 text-sm text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {currentRun.teacher_count} teachers
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {currentRun.total_hours.toFixed(1)} hours
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        {formatCurrency(currentRun.total_adjusted)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {currentRun.status === 'draft' && (
                      <button
                        onClick={() => handleDeleteRun(currentRun.id)}
                        className="p-2 text-zinc-400 hover:text-red-400 transition-colors"
                        title="Delete draft"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedRunId(currentRun.id)}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
                    >
                      {currentRun.status === 'draft' ? 'Review & Edit' :
                       currentRun.status === 'review' ? 'Continue Review' :
                       currentRun.status === 'approved' ? 'Export & Pay' : 'View Details'}
                    </button>
                  </div>
                </div>

                {/* Progress indicator */}
                <div className="mt-6">
                  <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
                    <span>Progress</span>
                    <span>
                      {currentRun.status === 'draft' ? '1/4' :
                       currentRun.status === 'review' ? '2/4' :
                       currentRun.status === 'approved' ? '3/4' : '4/4'}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {(['draft', 'review', 'approved', 'paid'] as PayrollRunStatus[]).map((step) => {
                      const stepOrder = { draft: 0, review: 1, approved: 2, paid: 3 }
                      const currentOrder = stepOrder[currentRun.status]
                      const thisOrder = stepOrder[step]
                      const isComplete = thisOrder < currentOrder
                      const isCurrent = thisOrder === currentOrder
                      return (
                        <div
                          key={step}
                          className={`flex-1 h-2 rounded ${
                            isComplete ? 'bg-green-500' :
                            isCurrent ? 'bg-blue-500' :
                            'bg-zinc-700'
                          }`}
                        />
                      )
                    })}
                  </div>
                  <div className="flex justify-between text-xs text-zinc-500 mt-1">
                    <span>Draft</span>
                    <span>Review</span>
                    <span>Approved</span>
                    <span>Paid</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 border-dashed rounded-lg p-12 text-center">
                <Calendar className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No Active Payroll Run</h3>
                <p className="text-zinc-400 mb-6">
                  Create a new payroll run to calculate teacher pay for the next period.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New Payroll Run
                </button>
              </div>
            )}

            {/* Pending adjustments warning */}
            {pendingAdjustments.length > 0 && (
              <div className="mt-4 bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-400">Pending Adjustments</h4>
                    <p className="text-sm text-zinc-400 mt-1">
                      {pendingAdjustments.length} adjustment{pendingAdjustments.length !== 1 ? 's' : ''} will be applied to the next payroll run.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'history' ? (
          // History Tab
          <div>
            {sortedHistoryRuns.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                No completed payroll runs yet.
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-zinc-800/50">
                    <tr>
                      <SortableHeader field="period" label="Period" sort={sort} onSort={handleSort} />
                      <SortableHeader field="teachers" label="Teachers" sort={sort} onSort={handleSort} />
                      <SortableHeader field="hours" label="Hours" sort={sort} onSort={handleSort} />
                      <SortableHeader field="amount" label="Amount" sort={sort} onSort={handleSort} />
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                        Paid On
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {sortedHistoryRuns.map(run => (
                      <tr
                        key={run.id}
                        className="hover:bg-zinc-800/50 transition-colors cursor-pointer"
                        onClick={() => setSelectedRunId(run.id)}
                      >
                        <td className="px-4 py-3">
                          <span className="text-white font-medium">
                            {formatDate(run.period_start)} - {formatDate(run.period_end)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-300">
                          {run.teacher_count}
                        </td>
                        <td className="px-4 py-3 text-zinc-300">
                          {run.total_hours.toFixed(1)}
                        </td>
                        <td className="px-4 py-3 text-zinc-300">
                          {formatCurrency(run.total_adjusted)}
                        </td>
                        <td className="px-4 py-3 text-zinc-400 text-sm">
                          {run.paid_at ? formatDateFull(run.paid_at) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedRunId(run.id)
                            }}
                            className="text-sm text-blue-400 hover:text-blue-300"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          // Adjustments Tab
          <div>
            {pendingAdjustments.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                No pending adjustments.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingAdjustments.map(adj => (
                  <div
                    key={adj.id}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">
                            {adj.teacher?.display_name || 'Unknown Teacher'}
                          </span>
                          <span className={`font-semibold ${adj.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {adj.amount >= 0 ? '+' : ''}{formatCurrency(adj.amount)}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-400 mt-1">{adj.reason}</p>
                      </div>
                      <div className="text-xs text-zinc-500">
                        {formatDateFull(adj.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6">
              <button
                onClick={() => setShowAdjustmentModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Adjustment
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreatePayrollRunModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => setShowCreateModal(false)}
        />
      )}

      {showAdjustmentModal && (
        <PayrollAdjustmentModal
          onClose={() => setShowAdjustmentModal(false)}
          onSuccess={() => setShowAdjustmentModal(false)}
        />
      )}

      {selectedRunId && selectedRunDetails && (
        <PayrollRunDetail
          run={selectedRunDetails}
          onClose={() => setSelectedRunId(null)}
          onExportCSV={() => handleExportCSV(selectedRunDetails)}
        />
      )}
    </div>
  )
}
