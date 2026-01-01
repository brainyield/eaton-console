import { useState } from 'react'
import {
  X,
  Mail,
  Phone,
  Calendar,
  ExternalLink,
  Tag,
  Clock,
  UserPlus,
  RefreshCw,
  CheckCircle,
  Edit,
  Trash2,
  Link2,
  Send
} from 'lucide-react'
import { useLeadMutations, type LeadWithFamily, type LeadStatus } from '../lib/hooks'
import { syncLeadToMailchimp } from '../lib/mailchimp'

interface LeadDetailPanelProps {
  lead: LeadWithFamily
  onClose: () => void
  onEdit: () => void
}

const statusLabels: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  converted: 'Converted',
  closed: 'Closed',
}

const statusColors: Record<LeadStatus, string> = {
  new: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  contacted: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  converted: 'bg-green-500/20 text-green-400 border-green-500/30',
  closed: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
}

export function LeadDetailPanel({ lead, onClose, onEdit }: LeadDetailPanelProps) {
  const { updateLead, deleteLead } = useLeadMutations()
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  const handleStatusChange = async (newStatus: LeadStatus) => {
    await updateLead.mutateAsync({ id: lead.id, status: newStatus })
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this lead?')) return
    setIsDeleting(true)
    try {
      await deleteLead.mutateAsync(lead.id)
      onClose()
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSyncToMailchimp = async () => {
    setIsSyncing(true)
    setSyncError(null)
    try {
      await syncLeadToMailchimp({
        leadId: lead.id,
        email: lead.email,
        name: lead.name,
        lead_type: lead.lead_type,
        status: lead.status,
        phone: lead.phone,
      })
      // Refetch lead data to show updated mailchimp_id
      updateLead.mutate({ id: lead.id })
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Failed to sync')
    } finally {
      setIsSyncing(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
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
    <div className="fixed right-0 top-0 h-full w-96 bg-zinc-900 border-l border-zinc-800 flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 className="text-lg font-medium text-white">Lead Details</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-lg disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Name & Email */}
        <div>
          <h3 className="text-xl font-semibold text-white">
            {lead.name || 'No name'}
          </h3>
          <a
            href={`mailto:${lead.email}`}
            className="text-sm text-blue-400 hover:underline flex items-center gap-1 mt-1"
          >
            <Mail className="w-3 h-3" />
            {lead.email}
          </a>
          {lead.phone && (
            <a
              href={`tel:${lead.phone}`}
              className="text-sm text-zinc-400 hover:text-white flex items-center gap-1 mt-1"
            >
              <Phone className="w-3 h-3" />
              {lead.phone}
            </a>
          )}
        </div>

        {/* Status */}
        <div>
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Status
          </label>
          <div className="flex flex-wrap gap-2 mt-2">
            {(['new', 'contacted', 'converted', 'closed'] as LeadStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                  lead.status === status
                    ? statusColors[status]
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600'
                }`}
              >
                {statusLabels[status]}
              </button>
            ))}
          </div>
        </div>

        {/* Lead Info */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Type</span>
            <span className="text-white capitalize">{lead.lead_type.replace('_', ' ')}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Created</span>
            <span className="text-white">{formatDate(lead.created_at)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Days in pipeline</span>
            <span className="text-white">{getDaysInPipeline(lead.created_at)} days</span>
          </div>
          {lead.source_url && (
            <div className="text-sm">
              <span className="text-zinc-400 block mb-1">Source URL</span>
              <a
                href={lead.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline flex items-center gap-1 text-xs break-all"
              >
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                {lead.source_url.length > 50
                  ? lead.source_url.substring(0, 50) + '...'
                  : lead.source_url}
              </a>
            </div>
          )}
        </div>

        {/* Converted Family */}
        {lead.family && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
            <div className="flex items-center gap-2 text-green-400 text-sm font-medium mb-1">
              <CheckCircle className="w-4 h-4" />
              Converted to Customer
            </div>
            <p className="text-white font-medium">{lead.family.display_name}</p>
            {lead.converted_at && (
              <p className="text-xs text-zinc-400 mt-1">
                {formatDate(lead.converted_at)}
              </p>
            )}
          </div>
        )}

        {/* Additional Info */}
        {(lead.num_children || lead.service_interest) && (
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Additional Info
            </h4>
            {lead.num_children && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Number of children</span>
                <span className="text-white">{lead.num_children}</span>
              </div>
            )}
            {lead.service_interest && (
              <div className="text-sm">
                <span className="text-zinc-400 block mb-1">Service interest</span>
                <span className="text-white">{lead.service_interest}</span>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        {lead.notes && (
          <div>
            <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
              Notes
            </h4>
            <p className="text-sm text-zinc-300 whitespace-pre-wrap">{lead.notes}</p>
          </div>
        )}

        {/* Mailchimp Status */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Mailchimp
            </h4>
            <button
              onClick={handleSyncToMailchimp}
              disabled={isSyncing}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSyncing ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Send className="w-3 h-3" />
              )}
              {lead.mailchimp_id ? 'Re-sync' : 'Sync'}
            </button>
          </div>
          {syncError && (
            <p className="text-xs text-red-400 mb-2">{syncError}</p>
          )}
          {lead.mailchimp_id ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm text-zinc-300">Synced</span>
              </div>
              {lead.mailchimp_last_synced_at && (
                <p className="text-xs text-zinc-500">
                  Last synced: {formatDate(lead.mailchimp_last_synced_at)}
                </p>
              )}
              {lead.mailchimp_tags && lead.mailchimp_tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {lead.mailchimp_tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-800 text-zinc-400 text-xs rounded"
                    >
                      <Tag className="w-3 h-3" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-zinc-500" />
              <span className="text-sm text-zinc-500">Not synced</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      {lead.status !== 'converted' && (
        <div className="p-4 border-t border-zinc-800">
          <button
            onClick={() => {
              // TODO: Open convert to family modal
              alert('Convert to family feature coming soon')
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Convert to Customer
          </button>
        </div>
      )}
    </div>
  )
}
