import { useState, useMemo } from 'react'
import { MessageSquare, Search, Filter, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { useSmsMessages, type SmsStatus, type SmsMessageType } from '../lib/hooks'
import { SmsStatusBadge } from '../components/ui/SmsStatusBadge'
import { formatPhoneDisplay } from '../lib/phoneUtils'

// Format date for display
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function SmsLog() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<SmsStatus | ''>('')
  const [typeFilter, setTypeFilter] = useState<SmsMessageType | ''>('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: messages = [], isLoading, refetch, isRefetching } = useSmsMessages({ limit: 1000 })

  // Client-side filtering
  const filteredMessages = useMemo(() => {
    let filtered = messages

    // Status filter
    if (statusFilter) {
      filtered = filtered.filter((m) => m.status === statusFilter)
    }

    // Type filter
    if (typeFilter) {
      filtered = filtered.filter((m) => m.message_type === typeFilter)
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(
        (m) =>
          m.to_phone.includes(search) ||
          m.message_body.toLowerCase().includes(searchLower) ||
          m.family?.display_name?.toLowerCase().includes(searchLower) ||
          m.campaign_name?.toLowerCase().includes(searchLower)
      )
    }

    return filtered
  }, [messages, statusFilter, typeFilter, search])

  // Stats
  const stats = useMemo(() => {
    const total = messages.length
    const delivered = messages.filter((m) => m.status === 'delivered').length
    const failed = messages.filter((m) => m.status === 'failed' || m.status === 'undelivered').length
    const pending = messages.filter((m) => m.status === 'pending' || m.status === 'sent').length

    return { total, delivered, failed, pending }
  }, [messages])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
              <MessageSquare className="w-7 h-7" />
              SMS Log
            </h1>
            <p className="text-sm text-zinc-400 mt-1">View all sent SMS messages</p>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <div className="text-2xl font-semibold text-white">{stats.total}</div>
            <div className="text-xs text-zinc-400">Total Messages</div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <div className="text-2xl font-semibold text-green-400">{stats.delivered}</div>
            <div className="text-xs text-zinc-400">Delivered</div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <div className="text-2xl font-semibold text-blue-400">{stats.pending}</div>
            <div className="text-xs text-zinc-400">Pending/Sent</div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <div className="text-2xl font-semibold text-red-400">{stats.failed}</div>
            <div className="text-xs text-zinc-400">Failed</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-zinc-800 flex items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by phone, message, family..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as SmsStatus | '')}
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
            <option value="undelivered">Undelivered</option>
          </select>
        </div>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as SmsMessageType | '')}
          className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option value="">All Types</option>
          <option value="invoice_reminder">Invoice Reminder</option>
          <option value="event_reminder">Event Reminder</option>
          <option value="announcement">Announcement</option>
          <option value="custom">Custom</option>
          <option value="bulk">Bulk</option>
        </select>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="w-12 h-12 text-zinc-600 mb-3" />
            <p className="text-zinc-400">
              {search || statusFilter || typeFilter
                ? 'No messages match your filters'
                : 'No SMS messages yet'}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-zinc-800/50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Recipient
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Family
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider w-8">
                  {/* Expand */}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filteredMessages.map((msg) => {
                const isExpanded = expandedId === msg.id

                return (
                  <>
                    <tr
                      key={msg.id}
                      className="hover:bg-zinc-800/50 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : msg.id)}
                    >
                      <td className="px-4 py-3 text-sm text-zinc-400">{formatDate(msg.created_at)}</td>
                      <td className="px-4 py-3 text-sm text-white font-mono">
                        {formatPhoneDisplay(msg.to_phone)}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-300">
                        {msg.family?.display_name || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 bg-zinc-700 text-zinc-300 rounded">
                          {msg.message_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <SmsStatusBadge status={msg.status} />
                      </td>
                      <td className="px-4 py-3">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-zinc-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-zinc-400" />
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${msg.id}-expanded`}>
                        <td colSpan={6} className="px-4 py-4 bg-zinc-800/30">
                          <div className="space-y-3">
                            <div>
                              <div className="text-xs text-zinc-500 mb-1">Message</div>
                              <p className="text-sm text-zinc-300 whitespace-pre-wrap bg-zinc-800 p-3 rounded-lg">
                                {msg.message_body}
                              </p>
                            </div>

                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <div className="text-xs text-zinc-500 mb-1">Sent At</div>
                                <div className="text-zinc-300">
                                  {msg.sent_at ? formatDate(msg.sent_at) : '-'}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-zinc-500 mb-1">Delivered At</div>
                                <div className="text-zinc-300">
                                  {msg.delivered_at ? formatDate(msg.delivered_at) : '-'}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-zinc-500 mb-1">Sent By</div>
                                <div className="text-zinc-300">{msg.sent_by || '-'}</div>
                              </div>
                            </div>

                            {msg.error_message && (
                              <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg">
                                <div className="text-xs text-red-400 mb-1">Error</div>
                                <div className="text-sm text-red-300">{msg.error_message}</div>
                                {msg.error_code && (
                                  <div className="text-xs text-red-500 mt-1">
                                    Code: {msg.error_code}
                                  </div>
                                )}
                              </div>
                            )}

                            {msg.campaign_name && (
                              <div>
                                <div className="text-xs text-zinc-500 mb-1">Campaign</div>
                                <div className="text-sm text-zinc-300">{msg.campaign_name}</div>
                              </div>
                            )}

                            {msg.twilio_sid && (
                              <div>
                                <div className="text-xs text-zinc-500 mb-1">Twilio SID</div>
                                <div className="text-xs text-zinc-500 font-mono">{msg.twilio_sid}</div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer with count */}
      {filteredMessages.length > 0 && (
        <div className="px-6 py-3 border-t border-zinc-800 text-sm text-zinc-400">
          Showing {filteredMessages.length} of {messages.length} messages
        </div>
      )}
    </div>
  )
}
