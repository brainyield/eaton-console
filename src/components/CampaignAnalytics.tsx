import { useState, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  RefreshCw,
  Mail,
  MousePointerClick,
  Eye,
  Users,
  TrendingUp,
  ChevronRight,
  AlertCircle,
  CheckCircle,
} from 'lucide-react'
import { useEmailCampaigns, useCampaignEngagement, type EmailCampaign } from '../lib/hooks'
import { syncCampaigns, syncCampaignActivity } from '../lib/mailchimp'
import { queryKeys } from '../lib/queryClient'
import { useToast } from '../lib/toast'
import { formatNameLastFirst } from '../lib/utils'
import { SortableTableHeader, useSortState } from './ui/SortableTableHeader'

// Campaign table sort fields
type CampaignSortField = 'campaign' | 'sent' | 'emails' | 'opens' | 'openRate' | 'clicks' | 'clickRate'

// Lead engagement table sort fields
type EngagementSortField = 'lead' | 'opens' | 'clicks' | 'firstOpened' | 'status'

export function CampaignAnalytics() {
  const queryClient = useQueryClient()
  const { showSuccess, showError, showWarning } = useToast()
  const { data: campaigns = [], isLoading, error } = useEmailCampaigns()

  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ synced: number; failed: number } | null>(null)
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const [isSyncingActivity, setIsSyncingActivity] = useState(false)
  const { sort: campaignSort, handleSort: handleCampaignSort } = useSortState<CampaignSortField>('sent', 'desc')

  // Find the selected campaign
  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId)

  // Sort campaigns
  const sortedCampaigns = useMemo(() => {
    return [...campaigns].sort((a, b) => {
      let comparison = 0
      const { field, direction } = campaignSort

      switch (field) {
        case 'campaign':
          comparison = a.campaign_name.toLowerCase().localeCompare(b.campaign_name.toLowerCase())
          break
        case 'sent': {
          const dateA = a.send_time ? new Date(a.send_time).getTime() : 0
          const dateB = b.send_time ? new Date(b.send_time).getTime() : 0
          comparison = dateA - dateB
          break
        }
        case 'emails':
          comparison = a.emails_sent - b.emails_sent
          break
        case 'opens':
          comparison = a.unique_opens - b.unique_opens
          break
        case 'openRate':
          comparison = (a.open_rate || 0) - (b.open_rate || 0)
          break
        case 'clicks':
          comparison = a.unique_clicks - b.unique_clicks
          break
        case 'clickRate':
          comparison = (a.click_rate || 0) - (b.click_rate || 0)
          break
        default:
          comparison = 0
      }

      return direction === 'asc' ? comparison : -comparison
    })
  }, [campaigns, campaignSort])

  // Calculate aggregate stats
  const stats = {
    totalCampaigns: campaigns.length,
    totalSent: campaigns.reduce((sum, c) => sum + c.emails_sent, 0),
    avgOpenRate: campaigns.length > 0
      ? (campaigns.reduce((sum, c) => sum + (c.open_rate || 0), 0) / campaigns.length * 100).toFixed(1)
      : '0',
    avgClickRate: campaigns.length > 0
      ? (campaigns.reduce((sum, c) => sum + (c.click_rate || 0), 0) / campaigns.length * 100).toFixed(1)
      : '0',
  }

  const handleSyncCampaigns = async () => {
    setIsSyncing(true)
    setSyncResult(null)

    try {
      const result = await syncCampaigns(30)
      setSyncResult({ synced: result.synced, failed: result.failed })

      if (result.failed > 0) {
        showWarning(`Synced ${result.synced} campaigns. ${result.failed} failed.`)
      } else if (result.synced > 0) {
        showSuccess(`${result.synced} campaigns synced from Mailchimp`)
      } else {
        showSuccess('Campaigns are up to date')
      }

      await queryClient.invalidateQueries({ queryKey: queryKeys.emailCampaigns.all })
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to sync campaigns')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleSyncCampaignActivity = async (campaign: EmailCampaign) => {
    setIsSyncingActivity(true)

    try {
      const result = await syncCampaignActivity(
        campaign.mailchimp_campaign_id,
        campaign.id
      )

      showSuccess(`Synced activity for ${result.leads_matched} leads`)

      // Refresh the campaign engagement data
      await queryClient.invalidateQueries({
        queryKey: queryKeys.leadCampaignEngagement.byCampaign(campaign.id),
      })
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to sync activity')
    } finally {
      setIsSyncingActivity(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const formatPercent = (rate: number | null) => {
    if (rate === null || rate === undefined) return '-'
    return `${(rate * 100).toFixed(1)}%`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-red-400">Failed to load campaigns. Run the migration first.</p>
        <button
          onClick={handleSyncCampaigns}
          disabled={isSyncing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {isSyncing ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Sync from Mailchimp
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 overflow-auto">
      {/* Header with Sync Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Campaign Analytics</h2>
          <p className="text-sm text-zinc-400">Track email campaign performance and lead engagement</p>
        </div>
        <div className="flex items-center gap-3">
          {syncResult && (
            <span className={`text-xs ${syncResult.failed > 0 ? 'text-amber-400' : 'text-green-400'}`}>
              {syncResult.synced} synced
            </span>
          )}
          <button
            onClick={handleSyncCampaigns}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Campaigns'}
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-zinc-800/50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Mail className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{stats.totalCampaigns}</p>
              <p className="text-sm text-zinc-400">Campaigns</p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-800/50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Users className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{stats.totalSent.toLocaleString()}</p>
              <p className="text-sm text-zinc-400">Emails Sent</p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-800/50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Eye className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{stats.avgOpenRate}%</p>
              <p className="text-sm text-zinc-400">Avg Open Rate</p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-800/50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <MousePointerClick className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{stats.avgClickRate}%</p>
              <p className="text-sm text-zinc-400">Avg Click Rate</p>
            </div>
          </div>
        </div>
      </div>

      {/* Campaigns Table */}
      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 bg-zinc-800/50 rounded-lg">
          <Mail className="w-12 h-12 text-zinc-600 mb-4" />
          <p className="text-zinc-400 text-lg">No campaigns synced yet</p>
          <p className="text-zinc-500 text-sm mt-1">Click "Sync Campaigns" to fetch from Mailchimp</p>
        </div>
      ) : (
        <div className="bg-zinc-800/50 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-zinc-800">
              <tr>
                <SortableTableHeader
                  label="Campaign"
                  field="campaign"
                  currentSort={campaignSort}
                  onSort={(f) => handleCampaignSort(f as CampaignSortField)}
                />
                <SortableTableHeader
                  label="Sent"
                  field="sent"
                  currentSort={campaignSort}
                  onSort={(f) => handleCampaignSort(f as CampaignSortField)}
                />
                <SortableTableHeader
                  label="Emails"
                  field="emails"
                  currentSort={campaignSort}
                  onSort={(f) => handleCampaignSort(f as CampaignSortField)}
                  className="text-center"
                />
                <SortableTableHeader
                  label="Opens"
                  field="opens"
                  currentSort={campaignSort}
                  onSort={(f) => handleCampaignSort(f as CampaignSortField)}
                  className="text-center"
                />
                <SortableTableHeader
                  label="Open Rate"
                  field="openRate"
                  currentSort={campaignSort}
                  onSort={(f) => handleCampaignSort(f as CampaignSortField)}
                  className="text-center"
                />
                <SortableTableHeader
                  label="Clicks"
                  field="clicks"
                  currentSort={campaignSort}
                  onSort={(f) => handleCampaignSort(f as CampaignSortField)}
                  className="text-center"
                />
                <SortableTableHeader
                  label="Click Rate"
                  field="clickRate"
                  currentSort={campaignSort}
                  onSort={(f) => handleCampaignSort(f as CampaignSortField)}
                  className="text-center"
                />
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-700/50">
              {sortedCampaigns.map((campaign) => (
                <tr
                  key={campaign.id}
                  onClick={() => setSelectedCampaignId(
                    selectedCampaignId === campaign.id ? null : campaign.id
                  )}
                  className={`hover:bg-zinc-700/30 cursor-pointer transition-colors ${
                    selectedCampaignId === campaign.id ? 'bg-zinc-700/50' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-white">{campaign.campaign_name}</p>
                      {campaign.subject_line && (
                        <p className="text-sm text-zinc-400 truncate max-w-xs">
                          {campaign.subject_line}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400">
                    {formatDate(campaign.send_time)}
                  </td>
                  <td className="px-4 py-3 text-center text-white">
                    {campaign.emails_sent.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center text-white">
                    {campaign.unique_opens.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      campaign.open_rate > 0.25 ? 'bg-green-500/20 text-green-400' :
                      campaign.open_rate > 0.15 ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-zinc-500/20 text-zinc-400'
                    }`}>
                      {formatPercent(campaign.open_rate)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-white">
                    {campaign.unique_clicks.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      campaign.click_rate > 0.05 ? 'bg-green-500/20 text-green-400' :
                      campaign.click_rate > 0.02 ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-zinc-500/20 text-zinc-400'
                    }`}>
                      {formatPercent(campaign.click_rate)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight className={`w-4 h-4 text-zinc-500 transition-transform ${
                      selectedCampaignId === campaign.id ? 'rotate-90' : ''
                    }`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Selected Campaign Detail */}
      {selectedCampaign && (
        <CampaignDetail
          campaign={selectedCampaign}
          onSyncActivity={() => handleSyncCampaignActivity(selectedCampaign)}
          isSyncingActivity={isSyncingActivity}
        />
      )}
    </div>
  )
}

// Campaign Detail Component
function CampaignDetail({
  campaign,
  onSyncActivity,
  isSyncingActivity,
}: {
  campaign: EmailCampaign
  onSyncActivity: () => void
  isSyncingActivity: boolean
}) {
  const { data: engagement = [], isLoading } = useCampaignEngagement(campaign.id)
  const { sort: engagementSort, handleSort: handleEngagementSort } = useSortState<EngagementSortField>('status', 'desc')

  const engagedLeads = engagement.filter(e => e.opened || e.clicked)
  const clickedLeads = engagement.filter(e => e.clicked)

  // Sort engagement data
  const sortedEngagement = useMemo(() => {
    return [...engagement].sort((a, b) => {
      let comparison = 0
      const { field, direction } = engagementSort

      switch (field) {
        case 'lead': {
          const nameA = (a.lead?.name || a.lead?.email || '').toLowerCase()
          const nameB = (b.lead?.name || b.lead?.email || '').toLowerCase()
          comparison = nameA.localeCompare(nameB)
          break
        }
        case 'opens':
          comparison = (a.open_count || 0) - (b.open_count || 0)
          break
        case 'clicks':
          comparison = (a.click_count || 0) - (b.click_count || 0)
          break
        case 'firstOpened': {
          const dateA = a.first_opened_at ? new Date(a.first_opened_at).getTime() : 0
          const dateB = b.first_opened_at ? new Date(b.first_opened_at).getTime() : 0
          comparison = dateA - dateB
          break
        }
        case 'status': {
          // Sort by engagement level: clicked > opened > sent
          const getStatusRank = (e: typeof a) => {
            if (e.clicked) return 2
            if (e.opened) return 1
            return 0
          }
          comparison = getStatusRank(a) - getStatusRank(b)
          break
        }
        default:
          comparison = 0
      }

      return direction === 'asc' ? comparison : -comparison
    })
  }, [engagement, engagementSort])

  return (
    <div className="bg-zinc-800/50 rounded-lg border border-zinc-700/50">
      <div className="p-4 border-b border-zinc-700/50 flex items-center justify-between">
        <div>
          <h3 className="font-medium text-white">{campaign.campaign_name}</h3>
          <p className="text-sm text-zinc-400">{campaign.subject_line}</p>
        </div>
        <button
          onClick={onSyncActivity}
          disabled={isSyncingActivity}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-zinc-700 text-zinc-200 rounded-lg hover:bg-zinc-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncingActivity ? 'animate-spin' : ''}`} />
          {isSyncingActivity ? 'Syncing...' : 'Sync Lead Activity'}
        </button>
      </div>

      {/* Campaign Stats */}
      <div className="p-4 grid grid-cols-5 gap-4 border-b border-zinc-700/50">
        <div>
          <p className="text-xs text-zinc-500 uppercase">Total Sent</p>
          <p className="text-lg font-semibold text-white">{campaign.emails_sent.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 uppercase">Opens</p>
          <p className="text-lg font-semibold text-white">
            {campaign.unique_opens.toLocaleString()}
            <span className="text-sm text-zinc-400 ml-1">({(campaign.open_rate * 100).toFixed(1)}%)</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 uppercase">Clicks</p>
          <p className="text-lg font-semibold text-white">
            {campaign.unique_clicks.toLocaleString()}
            <span className="text-sm text-zinc-400 ml-1">({(campaign.click_rate * 100).toFixed(1)}%)</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 uppercase">Unsubscribes</p>
          <p className="text-lg font-semibold text-white">{campaign.unsubscribes}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 uppercase">Bounces</p>
          <p className="text-lg font-semibold text-white">{campaign.bounces}</p>
        </div>
      </div>

      {/* Lead Engagement */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-zinc-300">Lead Engagement</h4>
          <div className="flex items-center gap-4 text-xs text-zinc-400">
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" /> {engagedLeads.length} opened
            </span>
            <span className="flex items-center gap-1">
              <MousePointerClick className="w-3 h-3" /> {clickedLeads.length} clicked
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-5 h-5 text-zinc-500 animate-spin" />
          </div>
        ) : engagement.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No lead activity synced yet</p>
            <p className="text-xs mt-1">Click "Sync Lead Activity" to fetch engagement data</p>
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/50 sticky top-0">
                <tr>
                  <SortableTableHeader
                    label="Lead"
                    field="lead"
                    currentSort={engagementSort}
                    onSort={(f) => handleEngagementSort(f as EngagementSortField)}
                    className="px-3 py-2 text-xs"
                  />
                  <SortableTableHeader
                    label="Opens"
                    field="opens"
                    currentSort={engagementSort}
                    onSort={(f) => handleEngagementSort(f as EngagementSortField)}
                    className="text-center px-3 py-2 text-xs"
                  />
                  <SortableTableHeader
                    label="Clicks"
                    field="clicks"
                    currentSort={engagementSort}
                    onSort={(f) => handleEngagementSort(f as EngagementSortField)}
                    className="text-center px-3 py-2 text-xs"
                  />
                  <SortableTableHeader
                    label="First Opened"
                    field="firstOpened"
                    currentSort={engagementSort}
                    onSort={(f) => handleEngagementSort(f as EngagementSortField)}
                    className="px-3 py-2 text-xs"
                  />
                  <SortableTableHeader
                    label="Status"
                    field="status"
                    currentSort={engagementSort}
                    onSort={(f) => handleEngagementSort(f as EngagementSortField)}
                    className="px-3 py-2 text-xs"
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {sortedEngagement.map((e) => (
                  <tr key={e.id} className="hover:bg-zinc-700/20">
                    <td className="px-3 py-2">
                      <div>
                        <p className="text-white">
                          {e.lead?.name ? formatNameLastFirst(e.lead.name) : e.lead?.email || 'Unknown'}
                        </p>
                        {e.lead?.name && (
                          <p className="text-xs text-zinc-500">{e.lead.email}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {e.opened ? (
                        <span className="text-green-400">{e.open_count}</span>
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {e.clicked ? (
                        <span className="text-blue-400">{e.click_count}</span>
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">
                      {e.first_opened_at
                        ? new Date(e.first_opened_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })
                        : '-'}
                    </td>
                    <td className="px-3 py-2">
                      {e.clicked ? (
                        <span className="flex items-center gap-1 text-blue-400">
                          <MousePointerClick className="w-3 h-3" /> Clicked
                        </span>
                      ) : e.opened ? (
                        <span className="flex items-center gap-1 text-green-400">
                          <Eye className="w-3 h-3" /> Opened
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-zinc-500">
                          <CheckCircle className="w-3 h-3" /> Sent
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
