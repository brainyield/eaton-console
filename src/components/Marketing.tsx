import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  Search,
  Upload,
  Mail,
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
  Circle,
  ExternalLink,
  Edit
} from 'lucide-react'
import { useLeads, useLeadMutations, useUpcomingFollowUps, useFollowUpMutations, useEventLeads, useConvertedLeadsCount, getScoreLabel, getUrgencyColor, type LeadFamily, type LeadType, type LeadStatus } from '../lib/hooks'
import { dateAtMidnight, daysBetween, parseLocalDate } from '../lib/dateUtils'
import { useToast } from '../lib/toast'
import { LeadDetailPanel } from './LeadDetailPanel'
import { ImportLeadsModal } from './ImportLeadsModal'
import { EditLeadModal } from './EditLeadModal'
import { ConversionAnalytics } from './ConversionAnalytics'
import { CampaignAnalytics } from './CampaignAnalytics'
import { SortableTableHeader, useSortState } from './ui/SortableTableHeader'
import { bulkSyncLeadsToMailchimp, bulkSyncEngagement, getEngagementLevel } from '../lib/mailchimp'
import { queryKeys } from '../lib/queryClient'
import { formatNameLastFirst } from '../lib/utils'
import { useMultiSelection } from '../lib/useSelectionState'
import {
  LEAD_ENGAGEMENT_COLORS,
  LEAD_TYPE_COLORS,
  LEAD_STATUS_COLORS,
  LEAD_STATUS_LABELS,
} from './ui/StatusBadge'

type EngagementFilter = '' | 'cold' | 'warm' | 'hot'
type TabType = 'leads' | 'event_leads' | 'campaigns' | 'analytics'

// Lead table sort fields
type LeadSortField = 'name' | 'type' | 'status' | 'score' | 'phone' | 'created' | 'lastContact' | 'contacts' | 'days'

// Event leads table sort fields
type EventLeadSortField = 'name' | 'email' | 'status' | 'score' | 'created'

// Event purchasers table sort fields
type EventPurchaserSortField = 'family' | 'email' | 'phone' | 'orders' | 'spend' | 'lastOrder'

const LEADS_PAGE_SIZE = 50 // Number of leads per page

const leadTypeLabels: Record<LeadType, string> = {
  exit_intent: 'Exit Intent',
  waitlist: 'Waitlist',
  calendly_call: 'Calendly',
  event: 'Event',
}

export default function Marketing() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { showError, showSuccess, showWarning } = useToast()
  const [activeTab, setActiveTab] = useState<TabType>('leads')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<LeadType | ''>('')
  const [statusFilter, setStatusFilter] = useState<LeadStatus | ''>('')
  const [engagementFilter, setEngagementFilter] = useState<EngagementFilter>('')
  const { sort: leadsSort, handleSort: handleLeadsSort } = useSortState<LeadSortField>('score', 'desc')
  const { sort: eventLeadsSort, handleSort: handleEventLeadsSort } = useSortState<EventLeadSortField>('created', 'desc')
  const { sort: eventPurchasersSort, handleSort: handleEventPurchasersSort } = useSortState<EventPurchaserSortField>('lastOrder', 'desc')
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingLead, setEditingLead] = useState<LeadFamily | null>(null)
  const {
    selectedIds,
    setSelectedIds,
    toggleItem,
    selectAll,
    selectNone,
    isSelected,
    hasSelection,
    selectedCount,
  } = useMultiSelection<LeadFamily>()
  const [isBulkSyncing, setIsBulkSyncing] = useState(false)
  const [bulkSyncResult, setBulkSyncResult] = useState<{ success: number; failed: number } | null>(null)
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [showUpcomingFollowUps, setShowUpcomingFollowUps] = useState(true)
  const [showAllFollowUps, setShowAllFollowUps] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [isRefreshingEngagement, setIsRefreshingEngagement] = useState(false)
  const [engagementRefreshResult, setEngagementRefreshResult] = useState<{ success: number; failed: number } | null>(null)
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false)

  const { data: allLeads = [], isLoading, error } = useLeads({
    type: typeFilter || undefined,
    status: statusFilter || undefined,
    search: search || undefined,
  })

  const { data: upcomingFollowUps = [] } = useUpcomingFollowUps()
  const { completeFollowUp } = useFollowUpMutations()
  const { data: eventLeads = [], isLoading: eventLeadsLoading } = useEventLeads()
  const { data: convertedCount = 0 } = useConvertedLeadsCount()

  // Also fetch leads with lead_type='event' from the leads table
  const { data: eventTypeLeads = [] } = useLeads({ type: 'event' })

  // Filter and sort leads (client-side)
  const { leads, totalCount, totalPages } = useMemo(() => {
    // Exclude 'event' type leads by default - they have their own tab
    // But show them if the user explicitly filters by 'event' type
    let filtered = typeFilter === 'event'
      ? allLeads
      : allLeads.filter(lead => lead.lead_type !== 'event')

    // Filter by engagement
    if (engagementFilter) {
      filtered = filtered.filter(lead => getEngagementLevel(lead.mailchimp_engagement_score) === engagementFilter)
    }

    // Sort with multi-column support
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0
      const { field, direction } = leadsSort

      switch (field) {
        case 'name': {
          const nameA = (a.display_name || a.primary_email || '').toLowerCase()
          const nameB = (b.display_name || b.primary_email || '').toLowerCase()
          comparison = nameA.localeCompare(nameB)
          break
        }
        case 'type':
          comparison = (a.lead_type || '').localeCompare(b.lead_type || '')
          break
        case 'status':
          comparison = (a.lead_status || '').localeCompare(b.lead_status || '')
          break
        case 'score':
          comparison = (a.computed_score ?? 0) - (b.computed_score ?? 0)
          break
        case 'phone': {
          const phoneA = a.primary_phone || ''
          const phoneB = b.primary_phone || ''
          comparison = phoneA.localeCompare(phoneB)
          break
        }
        case 'created':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
        case 'lastContact': {
          const dateA = a.last_contacted_at ? new Date(a.last_contacted_at).getTime() : 0
          const dateB = b.last_contacted_at ? new Date(b.last_contacted_at).getTime() : 0
          comparison = dateA - dateB
          break
        }
        case 'contacts':
          comparison = (a.contact_count || 0) - (b.contact_count || 0)
          break
        case 'days':
          comparison = getDaysInPipeline(a.created_at) - getDaysInPipeline(b.created_at)
          break
        default:
          comparison = 0
      }

      return direction === 'asc' ? comparison : -comparison
    })

    // Paginate
    const totalCount = sorted.length
    const totalPages = Math.ceil(totalCount / LEADS_PAGE_SIZE)
    const startIdx = (currentPage - 1) * LEADS_PAGE_SIZE
    const paginated = sorted.slice(startIdx, startIdx + LEADS_PAGE_SIZE)

    return { leads: paginated, totalCount, totalPages }
  }, [allLeads, engagementFilter, leadsSort, currentPage, typeFilter])

  // Reset page when filters change
  const resetPage = () => setCurrentPage(1)

  // Auto-adjust page when filtered results decrease
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  // Stats - exclude event leads to match the table display
  // Note: convertedCount comes from useConvertedLeadsCount which counts ALL converted leads
  // (including those now with status='active'), not just leads still in the pipeline
  const stats = useMemo(() => {
    const nonEventLeads = (allLeads || []).filter(l => l.lead_type !== 'event')
    return {
      total: nonEventLeads.length,
      new: nonEventLeads.filter(l => l.lead_status === 'new').length,
      contacted: nonEventLeads.filter(l => l.lead_status === 'contacted').length,
      converted: convertedCount, // Use the count from all converted families
    }
  }, [allLeads, convertedCount])

  // Sort event type leads (imported event leads)
  const sortedEventTypeLeads = useMemo(() => {
    return [...eventTypeLeads].sort((a, b) => {
      let comparison = 0
      const { field, direction } = eventLeadsSort

      switch (field) {
        case 'name': {
          const nameA = (a.display_name || a.primary_email || '').toLowerCase()
          const nameB = (b.display_name || b.primary_email || '').toLowerCase()
          comparison = nameA.localeCompare(nameB)
          break
        }
        case 'email':
          comparison = (a.primary_email || '').toLowerCase().localeCompare((b.primary_email || '').toLowerCase())
          break
        case 'status':
          comparison = (a.lead_status || '').localeCompare(b.lead_status || '')
          break
        case 'score':
          comparison = (a.computed_score ?? 0) - (b.computed_score ?? 0)
          break
        case 'created':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
        default:
          comparison = 0
      }

      return direction === 'asc' ? comparison : -comparison
    })
  }, [eventTypeLeads, eventLeadsSort])

  // Sort event purchasers (families without enrollments)
  const sortedEventPurchasers = useMemo(() => {
    return [...eventLeads].sort((a, b) => {
      let comparison = 0
      const { field, direction } = eventPurchasersSort

      switch (field) {
        case 'family':
          comparison = (a.family_name || '').toLowerCase().localeCompare((b.family_name || '').toLowerCase())
          break
        case 'email':
          comparison = (a.primary_email || '').toLowerCase().localeCompare((b.primary_email || '').toLowerCase())
          break
        case 'phone':
          comparison = (a.primary_phone || '').localeCompare((b.primary_phone || ''))
          break
        case 'orders':
          comparison = (a.event_order_count || 0) - (b.event_order_count || 0)
          break
        case 'spend':
          comparison = (a.total_event_spend || 0) - (b.total_event_spend || 0)
          break
        case 'lastOrder': {
          const dateA = a.last_event_order_at ? new Date(a.last_event_order_at).getTime() : 0
          const dateB = b.last_event_order_at ? new Date(b.last_event_order_at).getTime() : 0
          comparison = dateA - dateB
          break
        }
        default:
          comparison = 0
      }

      return direction === 'asc' ? comparison : -comparison
    })
  }, [eventLeads, eventPurchasersSort])

  // Search in allLeads to find selected lead even if on different page
  const selectedLead = allLeads?.find(l => l.id === selectedLeadId)

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

  // Selection state - isAllSelected is a derived value
  const isAllSelected = leads.length > 0 && leads.every(l => isSelected(l.id))

  const { updateLead, deleteLead } = useLeadMutations()

  // Bulk status change with error tracking
  const handleBulkStatusChange = async (newStatus: LeadStatus) => {
    const selectedLeadIds = Array.from(selectedIds)
    if (selectedLeadIds.length === 0) return

    setIsBulkUpdating(true)
    setShowStatusDropdown(false)

    try {
      const results = await Promise.allSettled(
        selectedLeadIds.map(id => updateLead.mutateAsync({ id, lead_status: newStatus }))
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
      showError(err instanceof Error ? err.message : 'Failed to delete leads')
    } finally {
      setIsBulkDeleting(false)
    }
  }

  // Bulk sync to Mailchimp
  const handleBulkSync = async () => {
    const selectedLeads = leads.filter(l => isSelected(l.id))
    if (selectedLeads.length === 0) return

    if (!confirm(`Sync ${selectedLeads.length} lead(s) to Mailchimp? This will add/update them in your Mailchimp audience.`)) {
      return
    }

    setIsBulkSyncing(true)
    setBulkSyncResult(null)

    try {
      const result = await bulkSyncLeadsToMailchimp(
        selectedLeads.map(l => ({
          id: l.id,
          email: l.primary_email || '',
          name: l.primary_contact_name,
          lead_type: l.lead_type || 'exit_intent',
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
          .filter(l => failedEmails.has((l.primary_email || '').toLowerCase()))
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
      showError(err instanceof Error ? err.message : 'Failed to sync leads to Mailchimp')
      setBulkSyncResult({ success: 0, failed: selectedLeads.length })
    } finally {
      setIsBulkSyncing(false)
    }
  }

  // Get leads that are synced to Mailchimp (have mailchimp_id)
  const syncedLeads = useMemo(() =>
    allLeads.filter(l => l.mailchimp_id),
    [allLeads]
  )

  // Calculate staleness - oldest engagement update time
  const engagementStaleness = useMemo(() => {
    if (syncedLeads.length === 0) return null

    const now = Date.now()
    const leadsWithEngagement = syncedLeads.filter(l => l.mailchimp_engagement_updated_at)

    if (leadsWithEngagement.length === 0) {
      // No leads have been refreshed yet - consider very stale
      return { label: 'Never refreshed', color: 'text-red-400', hoursAgo: Infinity, staleCount: syncedLeads.length }
    }

    // Find the oldest engagement update
    let oldestTime = now
    let staleCount = 0
    const staleThreshold = 24 * 60 * 60 * 1000 // 24 hours

    for (const lead of syncedLeads) {
      if (lead.mailchimp_engagement_updated_at) {
        const updateTime = new Date(lead.mailchimp_engagement_updated_at).getTime()
        if (updateTime < oldestTime) oldestTime = updateTime
        if (now - updateTime > staleThreshold) staleCount++
      } else {
        staleCount++
      }
    }

    const hoursAgo = Math.floor((now - oldestTime) / (1000 * 60 * 60))

    let label: string
    let color: string

    if (hoursAgo < 1) {
      label = 'Just now'
      color = 'text-green-400'
    } else if (hoursAgo < 24) {
      label = `${hoursAgo}h ago`
      color = 'text-green-400'
    } else if (hoursAgo < 48) {
      label = `${Math.floor(hoursAgo / 24)}d ago`
      color = 'text-yellow-400'
    } else {
      label = `${Math.floor(hoursAgo / 24)}d ago`
      color = 'text-red-400'
    }

    return { label, color, hoursAgo, staleCount }
  }, [syncedLeads])

  // Handle bulk engagement refresh
  const handleRefreshAllEngagement = async () => {
    if (syncedLeads.length === 0) {
      showWarning('No leads are synced to Mailchimp yet')
      return
    }

    setIsRefreshingEngagement(true)
    setEngagementRefreshResult(null)

    try {
      // Batch in chunks of 50 to avoid rate limits
      const batchSize = 50
      let totalSuccess = 0
      let totalFailed = 0

      for (let i = 0; i < syncedLeads.length; i += batchSize) {
        const batch = syncedLeads.slice(i, i + batchSize).map(l => ({
          id: l.id,
          email: l.primary_email || '',
        }))

        const result = await bulkSyncEngagement(batch)
        totalSuccess += result.success
        totalFailed += result.failed
      }

      setEngagementRefreshResult({ success: totalSuccess, failed: totalFailed })

      if (totalFailed > 0) {
        showWarning(`Refreshed ${totalSuccess} leads. ${totalFailed} failed.`)
      } else {
        showSuccess(`Engagement data refreshed for ${totalSuccess} leads`)
      }

      // Refresh leads to show updated engagement scores
      await queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to refresh engagement data')
      setEngagementRefreshResult({ success: 0, failed: syncedLeads.length })
    } finally {
      setIsRefreshingEngagement(false)
    }
  }

  // Auto-refresh stale engagement data on mount (only once)
  useEffect(() => {
    const autoRefreshStaleEngagement = async () => {
      // Only run if we have synced leads and they haven't been refreshed recently
      if (!engagementStaleness || engagementStaleness.staleCount === 0) return
      if (isRefreshingEngagement || isAutoRefreshing) return

      // Only auto-refresh if there are stale leads (>24h old)
      if (engagementStaleness.hoursAgo < 24 && engagementStaleness.staleCount === 0) return

      const staleLeads = syncedLeads.filter(l => {
        if (!l.mailchimp_engagement_updated_at) return true
        const updateTime = new Date(l.mailchimp_engagement_updated_at).getTime()
        return Date.now() - updateTime > 24 * 60 * 60 * 1000
      })

      if (staleLeads.length === 0) return

      setIsAutoRefreshing(true)

      try {
        // Limit to 50 leads for auto-refresh to avoid long waits
        const batch = staleLeads.slice(0, 50).map(l => ({
          id: l.id,
          email: l.primary_email || '',
        }))

        await bulkSyncEngagement(batch)

        // Quietly refresh the leads data
        await queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
      } catch {
        // Silent fail for auto-refresh
      } finally {
        setIsAutoRefreshing(false)
      }
    }

    // Delay auto-refresh slightly to let the page load first
    const timer = setTimeout(autoRefreshStaleEngagement, 2000)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount

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
                  onClick={() => setActiveTab('campaigns')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'campaigns'
                      ? 'bg-zinc-700 text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Campaigns
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
                <>
                  {/* Engagement Refresh Button and Indicator */}
                  <div className="flex items-center gap-2">
                    {engagementStaleness && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-zinc-500">Engagement:</span>
                        <span className={engagementStaleness.color}>
                          {isAutoRefreshing ? 'Refreshing...' : engagementStaleness.label}
                        </span>
                        {engagementStaleness.staleCount > 0 && !isAutoRefreshing && (
                          <span className="text-zinc-500">
                            ({engagementStaleness.staleCount} stale)
                          </span>
                        )}
                      </div>
                    )}
                    <button
                      onClick={handleRefreshAllEngagement}
                      disabled={isRefreshingEngagement || syncedLeads.length === 0}
                      className="flex items-center gap-2 px-3 py-2 bg-zinc-700 text-zinc-200 rounded-lg hover:bg-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={syncedLeads.length === 0 ? 'No leads synced to Mailchimp' : `Refresh engagement for ${syncedLeads.length} leads`}
                    >
                      <RefreshCw className={`w-4 h-4 ${isRefreshingEngagement ? 'animate-spin' : ''}`} />
                      {isRefreshingEngagement ? 'Refreshing...' : 'Refresh Engagement'}
                    </button>
                    {engagementRefreshResult && (
                      <span className={`text-xs ${engagementRefreshResult.failed > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                        {engagementRefreshResult.success} updated
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Import Leads
                  </button>
                </>
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
                {(showAllFollowUps ? upcomingFollowUps : upcomingFollowUps.slice(0, 5)).map((followUp) => (
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
                        // Search in allLeads (may be filtered) to check if lead is visible
                        const lead = allLeads.find(l => l.id === followUp.family_id)
                        if (lead) {
                          setSelectedLeadId(lead.id)
                        } else {
                          // Lead exists but may be filtered out - select it anyway and notify user
                          setSelectedLeadId(followUp.family_id ?? null)
                          if (typeFilter || statusFilter || engagementFilter || search) {
                            showWarning('Lead may be hidden by current filters. Clear filters to see full details.')
                          }
                        }
                      }}
                      className="flex-shrink-0 p-1 text-zinc-500 hover:text-white"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {upcomingFollowUps.length > 5 && (
                  <button
                    onClick={() => setShowAllFollowUps(!showAllFollowUps)}
                    className="w-full text-xs text-blue-400 hover:text-blue-300 text-center py-1"
                  >
                    {showAllFollowUps
                      ? 'Show less'
                      : `Show all ${upcomingFollowUps.length} follow-ups`}
                  </button>
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
            <option value="event">Event</option>
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
        {hasSelection && (
          <div className="px-4 py-3 bg-blue-900/30 border-b border-blue-800/50 flex items-center gap-4">
            <span className="text-sm text-blue-300 font-medium">
              {selectedCount} selected
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
              onClick={selectNone}
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
                      onChange={(e) => e.target.checked ? selectAll(leads) : selectNone()}
                      className="rounded bg-zinc-800 border-zinc-600 text-blue-500 focus:ring-blue-500"
                    />
                  </th>
                  <SortableTableHeader
                    label="Name / Email"
                    field="name"
                    currentSort={leadsSort}
                    onSort={(f) => { handleLeadsSort(f as LeadSortField); resetPage() }}
                  />
                  <SortableTableHeader
                    label="Type"
                    field="type"
                    currentSort={leadsSort}
                    onSort={(f) => { handleLeadsSort(f as LeadSortField); resetPage() }}
                  />
                  <SortableTableHeader
                    label="Status"
                    field="status"
                    currentSort={leadsSort}
                    onSort={(f) => { handleLeadsSort(f as LeadSortField); resetPage() }}
                  />
                  <SortableTableHeader
                    label="Score"
                    field="score"
                    currentSort={leadsSort}
                    onSort={(f) => { handleLeadsSort(f as LeadSortField); resetPage() }}
                    className="text-center"
                  />
                  <SortableTableHeader
                    label="Phone"
                    field="phone"
                    currentSort={leadsSort}
                    onSort={(f) => { handleLeadsSort(f as LeadSortField); resetPage() }}
                  />
                  <SortableTableHeader
                    label="Created"
                    field="created"
                    currentSort={leadsSort}
                    onSort={(f) => { handleLeadsSort(f as LeadSortField); resetPage() }}
                  />
                  <SortableTableHeader
                    label="Last Contact"
                    field="lastContact"
                    currentSort={leadsSort}
                    onSort={(f) => { handleLeadsSort(f as LeadSortField); resetPage() }}
                  />
                  <SortableTableHeader
                    label="Contacts"
                    field="contacts"
                    currentSort={leadsSort}
                    onSort={(f) => { handleLeadsSort(f as LeadSortField); resetPage() }}
                    className="text-center"
                  />
                  <SortableTableHeader
                    label="Days"
                    field="days"
                    currentSort={leadsSort}
                    onSort={(f) => { handleLeadsSort(f as LeadSortField); resetPage() }}
                  />
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
                    } ${isSelected(lead.id) ? 'bg-blue-900/20' : ''}`}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected(lead.id)}
                        onChange={(e) => toggleItem(lead.id, e.target.checked)}
                        className="rounded bg-zinc-800 border-zinc-600 text-blue-500 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-white">
                          {lead.display_name}
                        </p>
                        {lead.primary_email && (
                          <p className="text-sm text-zinc-400">{lead.primary_email}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {lead.lead_type && (
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${LEAD_TYPE_COLORS[lead.lead_type]}`}>
                          {leadTypeLabels[lead.lead_type]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {lead.lead_status && (
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${LEAD_STATUS_COLORS[lead.lead_status]}`}>
                          {LEAD_STATUS_LABELS[lead.lead_status]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded ${LEAD_ENGAGEMENT_COLORS[getScoreLabel(lead.computed_score ?? 0)]}`}
                        title={`Score: ${lead.computed_score ?? 0}`}
                      >
                        {getScoreLabel(lead.computed_score ?? 0).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {lead.primary_phone || '-'}
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
                      {getDaysInPipeline(lead.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingLead(lead)
                        }}
                        className="p-1 text-zinc-500 hover:text-white rounded"
                        title="Edit lead"
                      >
                        <Edit className="w-4 h-4" />
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

        {/* Campaigns Tab Content */}
        {activeTab === 'campaigns' && (
          <CampaignAnalytics />
        )}

        {/* Event Leads Tab Content */}
        {activeTab === 'event_leads' && (
          <div className="p-6 space-y-6 overflow-auto">
            {/* Tab description */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <p className="text-sm text-blue-300">
                <strong>Event Leads</strong> shows two types of potential customers from events:
                imported leads from event forms, and existing families who purchased event tickets but don't have active enrollments.
              </p>
            </div>

            {/* Event Type Leads from leads table */}
            <div className="bg-zinc-800/50 rounded-lg border border-zinc-700/50">
              <div className="p-4 border-b border-zinc-700/50">
                <h3 className="text-lg font-semibold text-white">Imported Event Leads</h3>
                <p className="text-sm text-zinc-400 mt-1">
                  Leads captured from event sign-up forms that need follow-up to convert to enrollments.
                </p>
              </div>
              {eventTypeLeads.length === 0 ? (
                <div className="p-8 text-center text-zinc-400">
                  No imported event leads. Use "Import Leads" with the Event Orders source to add them.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-zinc-700/50">
                        <SortableTableHeader
                          label="Name"
                          field="name"
                          currentSort={eventLeadsSort}
                          onSort={(f) => handleEventLeadsSort(f as EventLeadSortField)}
                        />
                        <SortableTableHeader
                          label="Email"
                          field="email"
                          currentSort={eventLeadsSort}
                          onSort={(f) => handleEventLeadsSort(f as EventLeadSortField)}
                        />
                        <SortableTableHeader
                          label="Status"
                          field="status"
                          currentSort={eventLeadsSort}
                          onSort={(f) => handleEventLeadsSort(f as EventLeadSortField)}
                        />
                        <SortableTableHeader
                          label="Score"
                          field="score"
                          currentSort={eventLeadsSort}
                          onSort={(f) => handleEventLeadsSort(f as EventLeadSortField)}
                        />
                        <SortableTableHeader
                          label="Created"
                          field="created"
                          currentSort={eventLeadsSort}
                          onSort={(f) => handleEventLeadsSort(f as EventLeadSortField)}
                        />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-700/50">
                      {sortedEventTypeLeads.map((lead) => {
                        const scoreLabel = getScoreLabel(lead.computed_score ?? 0)
                        return (
                          <tr
                            key={lead.id}
                            className="hover:bg-zinc-700/30 transition-colors cursor-pointer"
                            onClick={() => setSelectedLeadId(lead.id)}
                          >
                            <td className="px-4 py-3">
                              <span className="font-medium text-white">{lead.display_name}</span>
                            </td>
                            <td className="px-4 py-3">
                              {lead.primary_email && (
                                <a href={`mailto:${lead.primary_email}`} className="text-blue-400 hover:text-blue-300" onClick={(e) => e.stopPropagation()}>
                                  {lead.primary_email}
                                </a>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {lead.lead_status && (
                                <span className={`px-2 py-1 text-xs font-medium rounded ${LEAD_STATUS_COLORS[lead.lead_status]}`}>
                                  {LEAD_STATUS_LABELS[lead.lead_status]}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 text-xs font-medium rounded ${LEAD_ENGAGEMENT_COLORS[scoreLabel]}`}>
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
              )}
            </div>

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
                        <SortableTableHeader
                          label="Family"
                          field="family"
                          currentSort={eventPurchasersSort}
                          onSort={(f) => handleEventPurchasersSort(f as EventPurchaserSortField)}
                        />
                        <SortableTableHeader
                          label="Email"
                          field="email"
                          currentSort={eventPurchasersSort}
                          onSort={(f) => handleEventPurchasersSort(f as EventPurchaserSortField)}
                        />
                        <SortableTableHeader
                          label="Phone"
                          field="phone"
                          currentSort={eventPurchasersSort}
                          onSort={(f) => handleEventPurchasersSort(f as EventPurchaserSortField)}
                        />
                        <SortableTableHeader
                          label="Event Orders"
                          field="orders"
                          currentSort={eventPurchasersSort}
                          onSort={(f) => handleEventPurchasersSort(f as EventPurchaserSortField)}
                        />
                        <SortableTableHeader
                          label="Total Spend"
                          field="spend"
                          currentSort={eventPurchasersSort}
                          onSort={(f) => handleEventPurchasersSort(f as EventPurchaserSortField)}
                        />
                        <SortableTableHeader
                          label="Last Event Order"
                          field="lastOrder"
                          currentSort={eventPurchasersSort}
                          onSort={(f) => handleEventPurchasersSort(f as EventPurchaserSortField)}
                        />
                        <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-700/50">
                      {sortedEventPurchasers.map((eventLead) => (
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
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => navigate(`/directory?family=${eventLead.family_id}`)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600 transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                              View Family
                            </button>
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
