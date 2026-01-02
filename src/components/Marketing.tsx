import { useState, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Search,
  Upload,
  Mail,
  MoreHorizontal,
  RefreshCw,
  X,
  Users,
  Clock,
  CheckCircle,
  Send,
  Trash2,
  ChevronDown,
  ChevronLeft,
  Bell,
  ChevronRight,
  Calendar,
  Circle
} from 'lucide-react'
import { useLeads, useLeadMutations, useUpcomingFollowUps, useFollowUpMutations, useEventLeads, getScoreLabel, getUrgencyColor, type LeadWithFamily, type LeadType, type LeadStatus } from '../lib/hooks'
import { dateAtMidnight, daysBetween, parseLocalDate } from '../lib/dateUtils'
import { useToast } from '../lib/toast'
import { LeadDetailPanel } from './LeadDetailPanel'
import { ImportLeadsModal } from './ImportLeadsModal'
import { EditLeadModal } from './EditLeadModal'
import { ConversionAnalytics } from './ConversionAnalytics'
import { bulkSyncLeadsToMailchimp, getEngagementLevel } from '../lib/mailchimp'
import { queryKeys } from '../lib/queryClient'
import { formatNameLastFirst } from '../lib/utils'

type EngagementFilter = '' | 'cold' | 'warm' | 'hot'
type SortOption = 'created_desc' | 'created_asc' | 'score_desc' | 'score_asc'
type TabType = 'leads' | 'event_leads' | 'analytics'

const LEADS_PAGE_SIZE = 50 // Number of leads per page

const scoreLabelColors: Record<'hot' | 'warm' | 'cold', string> = {
  hot: 'bg-red-500/20 text-red-400',
  warm: 'bg-orange-500/20 text-orange-400',
  cold: 'bg-zinc-500/20 text-zinc-400',
}

const leadTypeLabels: Record<LeadType, string> = {
  exit_intent: 'Exit Intent',
  waitlist: 'Waitlist',
  calendly_call: 'Calendly',
  event: 'Event',
}

const leadTypeColors: Record<LeadType, string> = {
  exit_intent: 'bg-purple-500/20 text-purple-400',
  waitlist: 'bg-green-500/20 text-green-400',
  calendly_call: 'bg-blue-500/20 text-blue-400',
  event: 'bg-orange-500/20 text-orange-400',
}

const statusLabels: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  converted: 'Converted',
  closed: 'Closed',
}

const statusColors: Record<LeadStatus, string> = {
  new: 'bg-yellow-500/20 text-yellow-400',
  contacted: 'bg-blue-500/20 text-blue-400',
  converted: 'bg-green-500/20 text-green-400',
  closed: 'bg-zinc-500/20 text-zinc-400',
}

export default function Marketing() {
  const queryClient = useQueryClient()
  const { showError, showSuccess, showWarning } = useToast()
  const [activeTab, setActiveTab] = useState<TabType>('leads')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<LeadType | ''>('')
  const [statusFilter, setStatusFilter] = useState<LeadStatus | ''>('')
  const [engagementFilter, setEngagementFilter] = useState<EngagementFilter>('')
  const [sortOption, setSortOption] = useState<SortOption>('score_desc')
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingLead, setEditingLead] = useState<LeadWithFamily | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkSyncing, setIsBulkSyncing] = useState(false)
  const [bulkSyncResult, setBulkSyncResult] = useState<{ success: number; failed: number } | null>(null)
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [showUpcomingFollowUps, setShowUpcomingFollowUps] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)

  const { data: allLeads = [], isLoading, error } = useLeads({
    type: typeFilter || undefined,
    status: statusFilter || undefined,
    search: search || undefined,
  })

  const { data: upcomingFollowUps = [] } = useUpcomingFollowUps()
  const { completeFollowUp } = useFollowUpMutations()
  const { data: eventLeads = [], isLoading: eventLeadsLoading } = useEventLeads()

  // Also fetch leads with lead_type='event' from the leads table
  const { data: eventTypeLeads = [] } = useLeads({ type: 'event' })

  // Filter and sort leads (client-side)
  const { leads, totalCount, totalPages } = useMemo(() => {
    // Exclude 'event' type leads - they are shown in the Event Leads tab
    let filtered = allLeads.filter(lead => lead.lead_type !== 'event')

    // Filter by engagement
    if (engagementFilter) {
      filtered = filtered.filter(lead => getEngagementLevel(lead.mailchimp_engagement_score) === engagementFilter)
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'score_desc':
          return (b.computed_score ?? 0) - (a.computed_score ?? 0)
        case 'score_asc':
          return (a.computed_score ?? 0) - (b.computed_score ?? 0)
        case 'created_asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'created_desc':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })

    // Paginate
    const totalCount = sorted.length
    const totalPages = Math.ceil(totalCount / LEADS_PAGE_SIZE)
    const startIdx = (currentPage - 1) * LEADS_PAGE_SIZE
    const paginated = sorted.slice(startIdx, startIdx + LEADS_PAGE_SIZE)

    return { leads: paginated, totalCount, totalPages }
  }, [allLeads, engagementFilter, sortOption, currentPage])

  // Reset page when filters change
  const resetPage = () => setCurrentPage(1)

  // Stats
  const stats = useMemo(() => {
    const all = allLeads || []
    return {
      total: all.length,
      new: all.filter(l => l.status === 'new').length,
      contacted: all.filter(l => l.status === 'contacted').length,
      converted: all.filter(l => l.status === 'converted').length,
    }
  }, [allLeads])

  const selectedLead = leads?.find(l => l.id === selectedLeadId)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getDaysInPipeline = (createdAt: string) => {
    // createdAt is a full ISO timestamp, so we parse it and normalize to midnight
    const created = dateAtMidnight(new Date(createdAt))
    const today = dateAtMidnight(new Date())
    return daysBetween(created, today)
  }

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(leads.map(l => l.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds)
    if (checked) {
      newSet.add(id)
    } else {
      newSet.delete(id)
    }
    setSelectedIds(newSet)
  }

  const isAllSelected = leads.length > 0 && leads.every(l => selectedIds.has(l.id))

  const { updateLead, deleteLead } = useLeadMutations()

  // Bulk status change with error tracking
  const handleBulkStatusChange = async (newStatus: LeadStatus) => {
    const selectedLeadIds = Array.from(selectedIds)
    if (selectedLeadIds.length === 0) return

    setIsBulkUpdating(true)
    setShowStatusDropdown(false)

    try {
      const results = await Promise.allSettled(
        selectedLeadIds.map(id => updateLead.mutateAsync({ id, status: newStatus }))
      )

      const succeeded = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length

      if (failed > 0) {
        // Keep failed items selected for retry
        const failedIds = selectedLeadIds.filter((_, i) => results[i].status === 'rejected')
        setSelectedIds(new Set(failedIds))
        showWarning(`Updated ${succeeded} leads. ${failed} failed to update.`)
      } else {
        setSelectedIds(new Set())
        showSuccess(`${succeeded} leads updated to ${newStatus}`)
      }
    } catch (err) {
      console.error('Failed to update leads:', err)
      showError(err instanceof Error ? err.message : 'Failed to update leads')
    } finally {
      setIsBulkUpdating(false)
    }
  }

  // Bulk delete with error tracking
  const handleBulkDelete = async () => {
    const selectedLeadIds = Array.from(selectedIds)
    if (selectedLeadIds.length === 0) return

    if (!confirm(`Are you sure you want to delete ${selectedLeadIds.length} lead(s)? This cannot be undone.`)) {
      return
    }

    setIsBulkDeleting(true)

    try {
      const results = await Promise.allSettled(
        selectedLeadIds.map(id => deleteLead.mutateAsync(id))
      )

      const succeeded = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length

      if (failed > 0) {
        // Keep failed items selected for retry
        const failedIds = selectedLeadIds.filter((_, i) => results[i].status === 'rejected')
        setSelectedIds(new Set(failedIds))
        showWarning(`Deleted ${succeeded} leads. ${failed} failed to delete.`)
      } else {
        setSelectedIds(new Set())
        showSuccess(`${succeeded} leads deleted`)
      }
    } catch (err) {
      console.error('Failed to delete leads:', err)
      showError(err instanceof Error ? err.message : 'Failed to delete leads')
    } finally {
      setIsBulkDeleting(false)
    }
  }

  // Bulk sync to Mailchimp
  const handleBulkSync = async () => {
    const selectedLeads = leads.filter(l => selectedIds.has(l.id))
    if (selectedLeads.length === 0) return

    setIsBulkSyncing(true)
    setBulkSyncResult(null)

    try {
      const result = await bulkSyncLeadsToMailchimp(
        selectedLeads.map(l => ({
          id: l.id,
          email: l.email,
          name: l.name,
          lead_type: l.lead_type,
        }))
      )
      setBulkSyncResult({ success: result.success, failed: result.failed })
      if (result.failed > 0) {
        // Keep failed items selected for retry by matching emails to lead IDs
        const failedEmails = new Set(
          result.details
            .filter(d => d.status === 'rejected')
            .map(d => d.email.toLowerCase())
        )
        const failedLeadIds = selectedLeads
          .filter(l => failedEmails.has(l.email.toLowerCase()))
          .map(l => l.id)
        if (failedLeadIds.length > 0) {
          setSelectedIds(new Set(failedLeadIds))
        }
        showWarning(`Synced ${result.success} leads. ${result.failed} failed.`)
      } else {
        setSelectedIds(new Set())
        showSuccess(`${result.success} leads synced to Mailchimp`)
      }
      // Refresh leads to show updated mailchimp status
      await queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
    } catch (err) {
      console.error('Failed to sync leads:', err)
      showError(err instanceof Error ? err.message : 'Failed to sync leads to Mailchimp')
      setBulkSyncResult({ success: 0, failed: selectedLeads.length })
    } finally {
      setIsBulkSyncing(false)
    }
  }

  return (
    <div className="flex h-full">
      {/* Main Content */}
      <div className={`flex-1 flex flex-col overflow-hidden ${selectedLeadId ? 'mr-96' : ''}`}>
        {/* Header */}
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-white">Marketing</h1>
              <p className="text-sm text-zinc-400 mt-1">Manage leads and marketing campaigns</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Tabs */}
              <div className="flex bg-zinc-800 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('leads')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'leads'
                      ? 'bg-zinc-700 text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Leads
                </button>
                <button
                  onClick={() => setActiveTab('event_leads')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'event_leads'
                      ? 'bg-zinc-700 text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Event Leads {(eventLeads.length + eventTypeLeads.length) > 0 && <span className="ml-1 px-1.5 py-0.5 text-xs bg-orange-500/20 text-orange-400 rounded">{eventLeads.length + eventTypeLeads.length}</span>}
                </button>
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'analytics'
                      ? 'bg-zinc-700 text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Analytics
                </button>
              </div>
              {activeTab === 'leads' && (
                <button
                  onClick={() => setShowImportModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Import Leads
                </button>
              )}
            </div>
          </div>

          {/* Stats Cards - only show on Leads tab */}
          {activeTab === 'leads' && (
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-700 rounded-lg">
                    <Users className="w-5 h-5 text-zinc-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-white">{stats.total}</p>
                    <p className="text-sm text-zinc-400">Total Leads</p>
                  </div>
                </div>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-500/20 rounded-lg">
                    <Clock className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-white">{stats.new}</p>
                    <p className="text-sm text-zinc-400">New</p>
                  </div>
                </div>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Mail className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-white">{stats.contacted}</p>
                    <p className="text-sm text-zinc-400">Contacted</p>
                  </div>
                </div>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-white">{stats.converted}</p>
                    <p className="text-sm text-zinc-400">Converted</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Leads Tab Content */}
        {activeTab === 'leads' && (
          <>
        {/* Upcoming Follow-ups */}
        {upcomingFollowUps.length > 0 && (
          <div className="border-b border-zinc-800">
            <button
              onClick={() => setShowUpcomingFollowUps(!showUpcomingFollowUps)}
              className="w-full px-4 py-2 flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-orange-400" />
                <span className="text-sm font-medium text-zinc-300">
                  Upcoming Follow-ups
                </span>
                <span className="px-1.5 py-0.5 text-xs bg-orange-500/20 text-orange-400 rounded">
                  {upcomingFollowUps.length}
                </span>
              </div>
              <ChevronRight className={`w-4 h-4 text-zinc-500 transition-transform ${showUpcomingFollowUps ? 'rotate-90' : ''}`} />
            </button>
            {showUpcomingFollowUps && (
              <div className="px-4 pb-3 space-y-2">
                {upcomingFollowUps.slice(0, 5).map((followUp) => (
                  <div
                    key={followUp.id}
                    className="flex items-center gap-3 p-2 bg-zinc-800/50 rounded-lg group"
                  >
                    <button
                      onClick={() => completeFollowUp.mutate(followUp.id)}
                      disabled={completeFollowUp.isPending}
                      className="flex-shrink-0 text-zinc-500 hover:text-green-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {completeFollowUp.isPending ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-zinc-200 truncate">{followUp.title}</span>
                        <span className={`px-1.5 py-0.5 text-[10px] rounded ${getUrgencyColor(followUp.urgency)}`}>
                          {followUp.urgency === 'overdue' ? 'Overdue' : followUp.urgency === 'today' ? 'Today' : followUp.urgency === 'tomorrow' ? 'Tomorrow' : 'This week'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <span>{followUp.lead_name ? formatNameLastFirst(followUp.lead_name) : followUp.lead_email}</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {parseLocalDate(followUp.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const lead = leads.find(l => l.id === followUp.lead_id)
                        if (lead) setSelectedLeadId(lead.id)
                      }}
                      className="flex-shrink-0 p-1 text-zinc-500 hover:text-white"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {upcomingFollowUps.length > 5 && (
                  <p className="text-xs text-zinc-500 text-center py-1">
                    +{upcomingFollowUps.length - 5} more follow-ups
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="p-4 border-b border-zinc-800 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); resetPage() }}
              className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value as LeadType | ''); resetPage() }}
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">All Types</option>
            <option value="exit_intent">Exit Intent</option>
            <option value="waitlist">Waitlist</option>
            <option value="calendly_call">Calendly</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as LeadStatus | ''); resetPage() }}
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="converted">Converted</option>
            <option value="closed">Closed</option>
          </select>

          <select
            value={engagementFilter}
            onChange={(e) => { setEngagementFilter(e.target.value as EngagementFilter); resetPage() }}
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">All Engagement</option>
            <option value="hot">Hot (6+)</option>
            <option value="warm">Warm (1-5)</option>
            <option value="cold">Cold (0)</option>
          </select>

          <select
            value={sortOption}
            onChange={(e) => { setSortOption(e.target.value as SortOption); resetPage() }}
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="score_desc">Score (High to Low)</option>
            <option value="score_asc">Score (Low to High)</option>
            <option value="created_desc">Newest First</option>
            <option value="created_asc">Oldest First</option>
          </select>

          {(typeFilter || statusFilter || engagementFilter || search) && (
            <button
              onClick={() => {
                setTypeFilter('')
                setStatusFilter('')
                setEngagementFilter('')
                setSearch('')
                resetPage()
              }}
              className="flex items-center gap-1 px-3 py-2 text-sm text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
              Clear filters
            </button>
          )}
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="px-4 py-3 bg-blue-900/30 border-b border-blue-800/50 flex items-center gap-4">
            <span className="text-sm text-blue-300 font-medium">
              {selectedIds.size} selected
            </span>

            {/* Status Change Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                disabled={isBulkUpdating}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 rounded-md text-white transition-colors disabled:opacity-50"
              >
                {isBulkUpdating ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Change Status
                <ChevronDown className="w-3 h-3" />
              </button>
              {showStatusDropdown && (
                <div className="absolute top-full left-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg z-10 py-1 min-w-[140px]">
                  {(['new', 'contacted', 'converted', 'closed'] as LeadStatus[]).map((status) => (
                    <button
                      key={status}
                      onClick={() => handleBulkStatusChange(status)}
                      disabled={isBulkUpdating}
                      className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white capitalize disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {status}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sync to Mailchimp */}
            <button
              onClick={handleBulkSync}
              disabled={isBulkSyncing}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 rounded-md text-white transition-colors disabled:opacity-50"
            >
              {isBulkSyncing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Sync to Mailchimp
            </button>

            {/* Delete */}
            <button
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-900/50 hover:bg-red-800/50 text-red-300 hover:text-red-200 rounded-md transition-colors disabled:opacity-50"
            >
              {isBulkDeleting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Delete
            </button>

            {/* Clear Selection */}
            <button
              onClick={() => setSelectedIds(new Set())}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
              Clear
            </button>

            {/* Sync Result */}
            {bulkSyncResult && (
              <span className={`text-sm ${bulkSyncResult.failed > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                {bulkSyncResult.success} synced{bulkSyncResult.failed > 0 && `, ${bulkSyncResult.failed} failed`}
              </span>
            )}
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-red-400">Failed to load leads. Make sure the leads table exists in your database.</p>
            </div>
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
              <Users className="w-12 h-12 mb-4" />
              <p className="text-lg">No leads found</p>
              <p className="text-sm mt-1">Import leads to get started</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-zinc-800/50 sticky top-0">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded bg-zinc-800 border-zinc-600 text-blue-500 focus:ring-blue-500"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Name / Email
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Last Contact
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    #
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Days
                  </th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => setSelectedLeadId(lead.id)}
                    className={`hover:bg-zinc-800/50 cursor-pointer transition-colors ${
                      selectedLeadId === lead.id ? 'bg-zinc-800' : ''
                    } ${selectedIds.has(lead.id) ? 'bg-blue-900/20' : ''}`}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(lead.id)}
                        onChange={(e) => handleSelectOne(lead.id, e.target.checked)}
                        className="rounded bg-zinc-800 border-zinc-600 text-blue-500 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-white">
                          {lead.name ? formatNameLastFirst(lead.name) : 'No name'}
                        </p>
                        <p className="text-sm text-zinc-400">{lead.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${leadTypeColors[lead.lead_type]}`}>
                        {leadTypeLabels[lead.lead_type]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusColors[lead.status]}`}>
                        {statusLabels[lead.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-sm font-medium text-white">{lead.computed_score ?? 0}</span>
                        <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded ${scoreLabelColors[getScoreLabel(lead.computed_score ?? 0)]}`}>
                          {getScoreLabel(lead.computed_score ?? 0).toUpperCase()}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {lead.phone || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {formatDate(lead.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {lead.last_contacted_at ? formatDate(lead.last_contacted_at) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400 text-center">
                      {lead.contact_count || 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {getDaysInPipeline(lead.created_at)}d
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingLead(lead)
                        }}
                        className="p-1 text-zinc-500 hover:text-white rounded"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-zinc-800 flex items-center justify-between">
              <div className="text-sm text-zinc-400">
                Showing {((currentPage - 1) * LEADS_PAGE_SIZE) + 1} to {Math.min(currentPage * LEADS_PAGE_SIZE, totalCount)} of {totalCount} leads
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-md text-zinc-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {/* Page numbers */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    // Show pages around current page
                    let pageNum: number
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-md text-zinc-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
          </>
        )}

        {/* Analytics Tab Content */}
        {activeTab === 'analytics' && (
          <ConversionAnalytics />
        )}

        {/* Event Leads Tab Content */}
        {activeTab === 'event_leads' && (
          <div className="space-y-6">
            {/* Event Type Leads from leads table */}
            {eventTypeLeads.length > 0 && (
              <div className="bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                <div className="p-4 border-b border-zinc-700/50">
                  <h3 className="text-lg font-semibold text-white">Event Leads</h3>
                  <p className="text-sm text-zinc-400 mt-1">
                    Leads captured from events that need follow-up.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-zinc-700/50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Score</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-700/50">
                      {eventTypeLeads.map((lead) => {
                        const scoreLabel = getScoreLabel(lead.computed_score ?? 0)
                        return (
                          <tr
                            key={lead.id}
                            className="hover:bg-zinc-700/30 transition-colors cursor-pointer"
                            onClick={() => setSelectedLeadId(lead.id)}
                          >
                            <td className="px-4 py-3">
                              <span className="font-medium text-white">{lead.name || 'Unknown'}</span>
                            </td>
                            <td className="px-4 py-3">
                              <a href={`mailto:${lead.email}`} className="text-blue-400 hover:text-blue-300" onClick={(e) => e.stopPropagation()}>
                                {lead.email}
                              </a>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 text-xs font-medium rounded ${statusColors[lead.status]}`}>
                                {statusLabels[lead.status]}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 text-xs font-medium rounded ${scoreLabelColors[scoreLabel]}`}>
                                {scoreLabel.charAt(0).toUpperCase() + scoreLabel.slice(1)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-zinc-400">
                              {new Date(lead.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Event Purchasers from event_leads view */}
            <div className="bg-zinc-800/50 rounded-lg border border-zinc-700/50">
              <div className="p-4 border-b border-zinc-700/50">
                <h3 className="text-lg font-semibold text-white">Event Purchasers Without Enrollments</h3>
                <p className="text-sm text-zinc-400 mt-1">
                  Families who have purchased event tickets but have no active enrollments - potential conversion opportunities.
                </p>
              </div>
              {eventLeadsLoading ? (
                <div className="p-8 text-center text-zinc-400">Loading...</div>
              ) : eventLeads.length === 0 ? (
                <div className="p-8 text-center text-zinc-400">
                  No event purchasers found without active enrollments.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-zinc-700/50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Family</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Phone</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Event Orders</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Total Spend</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Last Event Order</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-700/50">
                      {eventLeads.map((eventLead) => (
                        <tr key={eventLead.family_id} className="hover:bg-zinc-700/30 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-medium text-white">{eventLead.family_name || 'Unknown'}</span>
                          </td>
                          <td className="px-4 py-3">
                            {eventLead.primary_email ? (
                              <a href={`mailto:${eventLead.primary_email}`} className="text-blue-400 hover:text-blue-300">
                                {eventLead.primary_email}
                              </a>
                            ) : (
                              <span className="text-zinc-500">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {eventLead.primary_phone ? (
                              <a href={`tel:${eventLead.primary_phone}`} className="text-blue-400 hover:text-blue-300">
                                {eventLead.primary_phone}
                              </a>
                            ) : (
                              <span className="text-zinc-500">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 text-xs font-medium bg-orange-500/20 text-orange-400 rounded">
                              {eventLead.event_order_count || 0} orders
                            </span>
                          </td>
                          <td className="px-4 py-3 text-white">
                            ${(eventLead.total_event_spend || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-zinc-400">
                            {eventLead.last_event_order_at
                              ? new Date(eventLead.last_event_order_at).toLocaleDateString()
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedLead && (
        <LeadDetailPanel
          lead={selectedLead}
          onClose={() => setSelectedLeadId(null)}
          onEdit={() => setEditingLead(selectedLead)}
        />
      )}

      {/* Import Modal */}
      {showImportModal && (
        <ImportLeadsModal onClose={() => setShowImportModal(false)} />
      )}

      {/* Edit Modal */}
      {editingLead && (
        <EditLeadModal
          lead={editingLead}
          onClose={() => setEditingLead(null)}
        />
      )}
    </div>
  )
}
