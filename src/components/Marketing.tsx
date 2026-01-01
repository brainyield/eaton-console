import { useState, useMemo } from 'react'
import {
  Search,
  Upload,
  Filter,
  Mail,
  Phone,
  Calendar,
  ChevronDown,
  ExternalLink,
  MoreHorizontal,
  UserPlus,
  RefreshCw,
  X,
  Users,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { useLeads, type LeadWithFamily, type LeadType, type LeadStatus } from '../lib/hooks'
import { LeadDetailPanel } from './LeadDetailPanel'
import { ImportLeadsModal } from './ImportLeadsModal'
import { EditLeadModal } from './EditLeadModal'

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
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<LeadType | ''>('')
  const [statusFilter, setStatusFilter] = useState<LeadStatus | ''>('')
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingLead, setEditingLead] = useState<LeadWithFamily | null>(null)

  const { data: leads = [], isLoading, error } = useLeads({
    type: typeFilter || undefined,
    status: statusFilter || undefined,
    search: search || undefined,
  })

  // Stats
  const stats = useMemo(() => {
    const all = leads || []
    return {
      total: all.length,
      new: all.filter(l => l.status === 'new').length,
      contacted: all.filter(l => l.status === 'contacted').length,
      converted: all.filter(l => l.status === 'converted').length,
    }
  }, [leads])

  const selectedLead = leads?.find(l => l.id === selectedLeadId)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getDaysInPipeline = (createdAt: string) => {
    const created = new Date(createdAt)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - created.getTime())
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
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
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Import Leads
            </button>
          </div>

          {/* Stats Cards */}
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
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-zinc-800 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as LeadType | '')}
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
            onChange={(e) => setStatusFilter(e.target.value as LeadStatus | '')}
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="converted">Converted</option>
            <option value="closed">Closed</option>
          </select>

          {(typeFilter || statusFilter || search) && (
            <button
              onClick={() => {
                setTypeFilter('')
                setStatusFilter('')
                setSearch('')
              }}
              className="flex items-center gap-1 px-3 py-2 text-sm text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
              Clear filters
            </button>
          )}
        </div>

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
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Name / Email
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Created
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
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-white">
                          {lead.name || 'No name'}
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
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {lead.phone || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {formatDate(lead.created_at)}
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
        </div>
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
