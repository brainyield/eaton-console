import { useState, useMemo, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Search,
  FileText,
  Send,
  Trash2,
  ChevronUp,
  ChevronDown,
  Plus,
  Check,
  Clock,
  AlertCircle,
  RefreshCw,
  Ban,
  Bell,
  History,
} from 'lucide-react'
import { useInvoicesWithDetails, useInvoiceMutations } from '../lib/hooks'
import type { InvoiceWithDetails } from '../lib/hooks'
import GenerateDraftsModal from './GenerateDraftsModal'
import InvoiceDetailPanel from './InvoiceDetailPanel'
import EditInvoiceModal from './EditInvoiceModal'
import ImportHistoricalInvoiceModal from './ImportHistoricalInvoiceModal'

// ============================================================================
// Types
// ============================================================================

type TabKey = 'drafts' | 'outstanding' | 'paid' | 'voided' | 'all'
type SortField = 'invoice_number' | 'family' | 'period' | 'due_date' | 'amount' | 'balance' | 'status'
type SortDirection = 'asc' | 'desc'

interface SortConfig {
  field: SortField
  direction: SortDirection
}

// ============================================================================
// Service Badge Component
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
// Status Badge Component
// ============================================================================

const STATUS_CONFIG: Record<string, { bg: string; text: string; icon: typeof Clock }> = {
  draft: { bg: 'bg-zinc-500/20', text: 'text-zinc-300', icon: FileText },
  sent: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: Send },
  paid: { bg: 'bg-green-500/20', text: 'text-green-400', icon: Check },
  partial: { bg: 'bg-amber-500/20', text: 'text-amber-400', icon: Clock },
  overdue: { bg: 'bg-red-500/20', text: 'text-red-400', icon: AlertCircle },
  void: { bg: 'bg-zinc-700/50', text: 'text-zinc-500', icon: Ban },
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft
  const Icon = config.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
      <Icon className="w-3 h-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
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
// Main Component
// ============================================================================

export default function Invoicing() {
  const [searchParams, setSearchParams] = useSearchParams()

  // State
  const [activeTab, setActiveTab] = useState<TabKey>('drafts')
  const [searchQuery, setSearchQuery] = useState('')
  const [serviceFilter, setServiceFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('') // For filtering within outstanding tab
  const [sort, setSort] = useState<SortConfig>({ field: 'due_date', direction: 'asc' })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithDetails | null>(null)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<InvoiceWithDetails | null>(null)
  const [sendingReminders, setSendingReminders] = useState(false)

  // Handle URL params for deep linking from Command Center
  useEffect(() => {
    const status = searchParams.get('status')
    const filter = searchParams.get('filter')

    if (status || filter) {
      // Handle special filters like "unopened"
      if (filter === 'unopened') {
        setActiveTab('outstanding')
        setStatusFilter('unopened')
      } else if (status === 'overdue' || status === 'sent' || status === 'partial') {
        setActiveTab('outstanding')
        setStatusFilter(status)
      } else if (status === 'draft') {
        setActiveTab('drafts')
      } else if (status === 'paid') {
        setActiveTab('paid')
      } else if (status === 'void') {
        setActiveTab('voided')
      }
      // Clear URL params after applying
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // Data fetching - get all invoices, filter in component
  const { data: allInvoices = [], isLoading, refetch } = useInvoicesWithDetails()
  const { 
    deleteInvoice, 
    bulkDeleteInvoices, 
    sendInvoice, 
    bulkSendInvoices,
    voidInvoice,
    bulkVoidInvoices,
    bulkSendReminders,
  } = useInvoiceMutations()

  // Tab counts - with explicit type annotations
  const counts = useMemo(() => {
    return {
      drafts: allInvoices.filter((i: InvoiceWithDetails) => i.status === 'draft').length,
      outstanding: allInvoices.filter((i: InvoiceWithDetails) => ['sent', 'partial', 'overdue'].includes(i.status)).length,
      paid: allInvoices.filter((i: InvoiceWithDetails) => i.status === 'paid').length,
      voided: allInvoices.filter((i: InvoiceWithDetails) => i.status === 'void').length,
      all: allInvoices.filter((i: InvoiceWithDetails) => i.status !== 'void').length, // Exclude voided from "All" count
    }
  }, [allInvoices])

  // Filter invoices by tab - with explicit type annotations
  const tabFilteredInvoices = useMemo(() => {
    let filtered: InvoiceWithDetails[]
    switch (activeTab) {
      case 'drafts':
        filtered = allInvoices.filter((i: InvoiceWithDetails) => i.status === 'draft')
        break
      case 'outstanding':
        filtered = allInvoices.filter((i: InvoiceWithDetails) => ['sent', 'partial', 'overdue'].includes(i.status))
        // Apply status filter within outstanding tab
        if (statusFilter) {
          if (statusFilter === 'unopened') {
            // Unopened = sent but never viewed
            filtered = filtered.filter((i: InvoiceWithDetails) => i.sent_at && !i.viewed_at)
          } else {
            filtered = filtered.filter((i: InvoiceWithDetails) => i.status === statusFilter)
          }
        }
        break
      case 'paid':
        filtered = allInvoices.filter((i: InvoiceWithDetails) => i.status === 'paid')
        break
      case 'voided':
        filtered = allInvoices.filter((i: InvoiceWithDetails) => i.status === 'void')
        break
      case 'all':
      default:
        filtered = allInvoices.filter((i: InvoiceWithDetails) => i.status !== 'void') // Exclude voided from "All"
        break
    }
    return filtered
  }, [allInvoices, activeTab, statusFilter])

  // Apply search and service filters - with explicit type annotations
  const filteredInvoices = useMemo(() => {
    let result = tabFilteredInvoices

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter((i: InvoiceWithDetails) =>
        i.invoice_number?.toLowerCase().includes(q) ||
        i.family?.display_name?.toLowerCase().includes(q) ||
        i.family?.primary_email?.toLowerCase().includes(q)
      )
    }

    if (serviceFilter) {
      result = result.filter((i: InvoiceWithDetails) => i.services?.includes(serviceFilter))
    }

    return result
  }, [tabFilteredInvoices, searchQuery, serviceFilter])

  // Sort invoices
  const sortedInvoices = useMemo(() => {
    const sorted = [...filteredInvoices]
    sorted.sort((a, b) => {
      let comparison = 0
      switch (sort.field) {
        case 'invoice_number':
          comparison = (a.invoice_number || '').localeCompare(b.invoice_number || '')
          break
        case 'family':
          comparison = (a.family?.display_name || '').localeCompare(b.family?.display_name || '')
          break
        case 'period':
          comparison = (a.period_start || '').localeCompare(b.period_start || '')
          break
        case 'due_date':
          comparison = (a.due_date || '').localeCompare(b.due_date || '')
          break
        case 'amount':
          comparison = (a.total_amount || 0) - (b.total_amount || 0)
          break
        case 'balance':
          comparison = (a.balance_due || 0) - (b.balance_due || 0)
          break
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '')
          break
      }
      return sort.direction === 'asc' ? comparison : -comparison
    })
    return sorted
  }, [filteredInvoices, sort])

  // Handlers
  const handleSort = useCallback((field: SortField) => {
    setSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }, [])

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === sortedInvoices.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(sortedInvoices.map((i: InvoiceWithDetails) => i.id)))
    }
  }, [sortedInvoices, selectedIds])

  const handleSelectOne = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this invoice?')) return
    await deleteInvoice.mutateAsync(id)
    setSelectedInvoice(null)
  }, [deleteInvoice])

  const handleBulkDelete = useCallback(async () => {
    if (!confirm(`Delete ${selectedIds.size} invoices?`)) return
    await bulkDeleteInvoices.mutateAsync(Array.from(selectedIds))
    setSelectedIds(new Set())
  }, [bulkDeleteInvoices, selectedIds])

  const handleVoid = useCallback(async (id: string) => {
    if (!confirm('Void this invoice? This will mark it as void but preserve the record.')) return
    await voidInvoice.mutateAsync(id)
    setSelectedInvoice(null)
  }, [voidInvoice])

  const handleBulkVoid = useCallback(async () => {
    if (!confirm(`Void ${selectedIds.size} invoices? This will mark them as void but preserve the records.`)) return
    await bulkVoidInvoices.mutateAsync(Array.from(selectedIds))
    setSelectedIds(new Set())
  }, [bulkVoidInvoices, selectedIds])

  const handleSend = useCallback(async (id: string) => {
    await sendInvoice.mutateAsync(id)
    setSelectedInvoice(null)
  }, [sendInvoice])

  const handleBulkSend = useCallback(async () => {
    if (!confirm(`Send ${selectedIds.size} invoices?`)) return
    await bulkSendInvoices.mutateAsync(Array.from(selectedIds))
    setSelectedIds(new Set())
  }, [bulkSendInvoices, selectedIds])

  // NEW: Handle bulk send reminders - with explicit type
  const handleBulkSendReminders = useCallback(async () => {
    if (selectedIds.size === 0) return
    
    // Get the full invoice objects for selected IDs
    const invoicesToRemind = allInvoices.filter((inv: InvoiceWithDetails) => 
      selectedIds.has(inv.id) && 
      ['sent', 'partial', 'overdue'].includes(inv.status)
    )

    if (invoicesToRemind.length === 0) {
      alert('No outstanding invoices selected')
      return
    }

    const confirmMsg = `Send payment reminders to ${invoicesToRemind.length} families?\n\nReminder type will be based on how overdue each invoice is.`
    if (!confirm(confirmMsg)) return

    setSendingReminders(true)
    try {
      const result = await bulkSendReminders.mutateAsync({ invoices: invoicesToRemind })
      alert(`Reminders sent!\n✓ ${result.succeeded} succeeded\n✗ ${result.failed} failed`)
      setSelectedIds(new Set())
    } catch (error) {
      console.error('Failed to send reminders:', error)
      alert('Failed to send some reminders. Check console for details.')
    } finally {
      setSendingReminders(false)
    }
  }, [selectedIds, allInvoices, bulkSendReminders])

  // Clear selection and filters when changing tabs
  const handleTabChange = useCallback((tab: TabKey) => {
    setActiveTab(tab)
    setSelectedIds(new Set())
    setSelectedInvoice(null)
    setStatusFilter('') // Clear status filter when switching tabs
  }, [])

  // Format helpers
  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '-'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatPeriod = (start: string | null, end: string | null) => {
    if (!start || !end) return '-'
    const s = new Date(start)
    const e = new Date(end)
    const sMonth = s.toLocaleDateString('en-US', { month: 'short' })
    const eMonth = e.toLocaleDateString('en-US', { month: 'short' })
    if (sMonth === eMonth) {
      return `${sMonth} ${s.getDate()}-${e.getDate()}`
    }
    return `${sMonth} ${s.getDate()} - ${eMonth} ${e.getDate()}`
  }

  // Outstanding balance total (exclude voided) - with explicit type
  const outstandingTotal = useMemo(() => {
    return allInvoices
      .filter((i: InvoiceWithDetails) => ['sent', 'partial', 'overdue'].includes(i.status))
      .reduce((sum: number, i: InvoiceWithDetails) => sum + (i.balance_due || 0), 0)
  }, [allInvoices])

  // Tab configuration
  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'drafts', label: 'Drafts', count: counts.drafts },
    { key: 'outstanding', label: 'Outstanding', count: counts.outstanding },
    { key: 'paid', label: 'Paid', count: counts.paid },
    { key: 'voided', label: 'Voided', count: counts.voided },
    { key: 'all', label: 'All', count: counts.all },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Invoicing</h1>
            <p className="text-sm text-zinc-400 mt-1">
              {formatCurrency(outstandingTotal)} outstanding across {counts.outstanding} invoice{counts.outstanding !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
              title="Import a historical invoice from your previous system"
            >
              <History className="w-4 h-4" />
              Import Historical
            </button>
            <button
              onClick={() => setShowGenerateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Generate Drafts
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4 mt-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search invoices..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            />
          </div>

           <select
            value={serviceFilter}
            onChange={e => setServiceFilter(e.target.value)}
            className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-zinc-500"
          >
            <option value="">All Services</option>
            <option value="academic_coaching">Academic Coaching</option>
            <option value="learning_pod">Learning Pod</option>
            <option value="consulting">Consulting</option>
            <option value="eaton_hub">Eaton Hub</option>
            <option value="eaton_online">Eaton Online</option>
            <option value="elective_classes">Elective Classes</option>
          </select>

          {/* Status filter - only show when on outstanding tab */}
          {activeTab === 'outstanding' && (
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className={`px-3 py-2 bg-zinc-900 border rounded-lg text-white focus:outline-none focus:border-zinc-500 ${
                statusFilter ? 'border-blue-500' : 'border-zinc-700'
              }`}
            >
              <option value="">All Statuses</option>
              <option value="sent">Sent</option>
              <option value="partial">Partial</option>
              <option value="overdue">Overdue</option>
              <option value="unopened">Unopened (never viewed)</option>
            </select>
          )}

          {(searchQuery || serviceFilter || statusFilter) && (
            <button
              onClick={() => {
                setSearchQuery('')
                setServiceFilter('')
                setStatusFilter('')
              }}
              className="px-3 py-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors text-sm"
            >
              Clear Filters
            </button>
          )}
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

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="px-6 py-3 bg-zinc-800/50 border-b border-zinc-700 flex items-center gap-4">
          <span className="text-sm text-zinc-300">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2">
            {/* Draft actions */}
            {activeTab === 'drafts' && (
              <>
                <button
                  onClick={handleBulkSend}
                  disabled={bulkSendInvoices.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  Send Selected
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleteInvoices.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </>
            )}
            
            {/* Outstanding actions - Reminder and Void buttons */}
            {activeTab === 'outstanding' && (
              <>
                <button
                  onClick={handleBulkSendReminders}
                  disabled={sendingReminders}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                >
                  <Bell className="w-4 h-4" />
                  {sendingReminders ? 'Sending...' : 'Send Reminder'}
                </button>
                <button
                  onClick={handleBulkVoid}
                  disabled={bulkVoidInvoices.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-600 hover:bg-zinc-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                >
                  <Ban className="w-4 h-4" />
                  Void Selected
                </button>
              </>
            )}
          </div>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-sm text-zinc-400 hover:text-white"
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-zinc-900/50 sticky top-0">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.size === sortedInvoices.length && sortedInvoices.length > 0}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-zinc-900"
                />
              </th>
              <SortableHeader field="invoice_number" label="Invoice" sort={sort} onSort={handleSort} />
              <SortableHeader field="family" label="Family" sort={sort} onSort={handleSort} />
              <SortableHeader field="period" label="Period" sort={sort} onSort={handleSort} />
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Services
              </th>
              <SortableHeader field="due_date" label="Due" sort={sort} onSort={handleSort} />
              <SortableHeader field="status" label="Status" sort={sort} onSort={handleSort} />
              <SortableHeader field="amount" label="Amount" sort={sort} onSort={handleSort} className="text-right" />
              <SortableHeader field="balance" label="Balance" sort={sort} onSort={handleSort} className="text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-zinc-500">
                  Loading invoices...
                </td>
              </tr>
            ) : sortedInvoices.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-zinc-500">
                  {activeTab === 'drafts' ? (
                    <div>
                      <p>No draft invoices</p>
                      <button
                        onClick={() => setShowGenerateModal(true)}
                        className="mt-2 text-blue-400 hover:text-blue-300"
                      >
                        Generate drafts →
                      </button>
                    </div>
                  ) : activeTab === 'voided' ? (
                    'No voided invoices'
                  ) : (
                    'No invoices found'
                  )}
                </td>
              </tr>
            ) : (
              sortedInvoices.map((invoice: InvoiceWithDetails) => (
                <tr
                  key={invoice.id}
                  onClick={() => setSelectedInvoice(invoice)}
                  className={`cursor-pointer transition-colors ${
                    selectedInvoice?.id === invoice.id
                      ? 'bg-zinc-800'
                      : invoice.status === 'void' 
                        ? 'hover:bg-zinc-800/30 opacity-60' 
                        : 'hover:bg-zinc-800/50'
                  }`}
                >
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(invoice.id)}
                      onChange={() => handleSelectOne(invoice.id)}
                      className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-zinc-900"
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-white">
                    {invoice.invoice_number}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-white">{invoice.family?.display_name}</div>
                    <div className="text-xs text-zinc-500">{invoice.family?.primary_email}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-300">
                    {formatPeriod(invoice.period_start, invoice.period_end)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {invoice.services?.map((code: string) => (
                        <ServiceBadge key={code} code={code} />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-300">
                    {formatDate(invoice.due_date)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={invoice.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-white">
                    {formatCurrency(invoice.total_amount)}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right font-medium ${
                    invoice.status === 'void' 
                      ? 'text-zinc-500 line-through'
                      : (invoice.balance_due || 0) > 0 ? 'text-amber-400' : 'text-green-400'
                  }`}>
                    {formatCurrency(invoice.balance_due)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Panel */}
      {selectedInvoice && (
        <InvoiceDetailPanel
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onEdit={() => setEditingInvoice(selectedInvoice)}
          onSend={() => handleSend(selectedInvoice.id)}
          onDelete={() => handleDelete(selectedInvoice.id)}
          onVoid={() => handleVoid(selectedInvoice.id)}
          isSending={sendInvoice.isPending}
          isVoiding={voidInvoice.isPending}
        />
      )}

      {/* Generate Drafts Modal */}
      {showGenerateModal && (
        <GenerateDraftsModal
          onClose={() => setShowGenerateModal(false)}
          onSuccess={() => {
            setShowGenerateModal(false)
            setActiveTab('drafts')
          }}
        />
      )}

      {/* Edit Invoice Modal */}
      {editingInvoice && (
        <EditInvoiceModal
          invoice={editingInvoice}
          onClose={() => setEditingInvoice(null)}
          onSuccess={() => {
            setEditingInvoice(null)
            refetch()
          }}
        />
      )}

      {/* Import Historical Invoice Modal */}
      {showImportModal && (
        <ImportHistoricalInvoiceModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false)
            setActiveTab('outstanding') // Show imported invoice in Outstanding tab
          }}
        />
      )}
    </div>
  )
}