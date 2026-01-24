import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  X,
  Mail,
  Phone,
  ExternalLink,
  Tag,
  UserPlus,
  RefreshCw,
  CheckCircle,
  Edit,
  Trash2,
  Send,
  MessageSquare,
  PhoneCall,
  Plus,
  Clock,
  Calendar,
  AlertCircle,
  Circle
} from 'lucide-react'
import { useLeadMutations, useLeadActivities, useLeadActivityMutations, useLeadFollowUps, useFollowUpMutations, getPriorityColor, type LeadFamily, type LeadStatus, type ContactType, type TaskPriority } from '../lib/hooks'
import { parseLocalDate, daysBetween, dateAtMidnight } from '../lib/dateUtils'
import { syncLeadToMailchimp, syncLeadEngagement, getEngagementLevel } from '../lib/mailchimp'
import { queryKeys } from '../lib/queryClient'
import { useToast } from '../lib/toast'
import {
  LEAD_ENGAGEMENT_COLORS_WITH_BORDER,
  LEAD_STATUS_COLORS_WITH_BORDER,
  LEAD_STATUS_LABELS,
} from './ui/StatusBadge'

const contactTypeIcons: Record<ContactType, typeof Phone> = {
  call: PhoneCall,
  email: Mail,
  text: MessageSquare,
  other: MessageSquare,
}

const contactTypeLabels: Record<ContactType, string> = {
  call: 'Call',
  email: 'Email',
  text: 'Text',
  other: 'Other',
}

interface LeadDetailPanelProps {
  lead: LeadFamily
  onClose: () => void
  onEdit: () => void
}

export function LeadDetailPanel({ lead, onClose, onEdit }: LeadDetailPanelProps) {
  const queryClient = useQueryClient()
  const { showError, showSuccess } = useToast()
  const { updateLead, deleteLead, convertToCustomer } = useLeadMutations()
  const { data: activities, isLoading: activitiesLoading } = useLeadActivities(lead.id)
  const { createActivity } = useLeadActivityMutations()
  const { data: followUps, isLoading: followUpsLoading } = useLeadFollowUps(lead.id)
  const { createFollowUp, completeFollowUp, deleteFollowUp } = useFollowUpMutations()

  const [isDeleting, setIsDeleting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isSyncingEngagement, setIsSyncingEngagement] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [showActivityForm, setShowActivityForm] = useState(false)
  const [activityType, setActivityType] = useState<ContactType>('call')
  const [activityNotes, setActivityNotes] = useState('')
  const [isLoggingActivity, setIsLoggingActivity] = useState(false)

  // Follow-up form state
  const [showFollowUpForm, setShowFollowUpForm] = useState(false)
  const [followUpTitle, setFollowUpTitle] = useState('')
  const [followUpDueDate, setFollowUpDueDate] = useState('')
  const [followUpPriority, setFollowUpPriority] = useState<TaskPriority>('medium')
  const [isCreatingFollowUp, setIsCreatingFollowUp] = useState(false)

  const handleStatusChange = async (newStatus: LeadStatus) => {
    await updateLead.mutateAsync({ id: lead.id, lead_status: newStatus })
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
        email: lead.primary_email || '',
        name: lead.primary_contact_name,
        lead_type: lead.lead_type || 'exit_intent',
        status: lead.lead_status || undefined,
        phone: lead.primary_phone,
      })
      // Refetch lead data to show updated mailchimp_id
      await queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Failed to sync')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleSyncEngagement = async () => {
    if (!lead.mailchimp_id) return
    setIsSyncingEngagement(true)
    setSyncError(null)
    try {
      await syncLeadEngagement(lead.id, lead.primary_email || '')
      await queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Failed to sync engagement')
    } finally {
      setIsSyncingEngagement(false)
    }
  }

  const handleConvertToCustomer = async () => {
    try {
      await convertToCustomer.mutateAsync({ familyId: lead.id })
      showSuccess('Lead converted to customer successfully')
      // Refresh lead data and close the panel since they're now a customer
      await queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.families.all })
      onClose()
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to convert lead')
    }
  }

  const handleLogActivity = async () => {
    if (!activityType) return
    setIsLoggingActivity(true)
    // Capture current status to avoid stale closure
    const currentStatus = lead.lead_status
    const familyId = lead.id
    let activityCreated = false
    try {
      await createActivity.mutateAsync({
        family_id: familyId,
        contact_type: activityType,
        notes: activityNotes.trim() || null,
        contacted_at: new Date().toISOString(),
      })
      activityCreated = true
      // Auto-update status to contacted if still new (using captured value)
      if (currentStatus === 'new') {
        await updateLead.mutateAsync({ id: familyId, lead_status: 'contacted' })
      }
      setActivityNotes('')
      setShowActivityForm(false)
      showSuccess('Activity logged')
    } catch (err) {
      if (activityCreated) {
        // Activity was logged but status update failed - still close form since activity is saved
        setActivityNotes('')
        setShowActivityForm(false)
        showError('Activity logged, but failed to update status to contacted')
      } else {
        showError(err instanceof Error ? err.message : 'Failed to log activity')
      }
    } finally {
      setIsLoggingActivity(false)
    }
  }

  const handleCreateFollowUp = async () => {
    if (!followUpTitle.trim() || !followUpDueDate) return
    setIsCreatingFollowUp(true)
    try {
      await createFollowUp.mutateAsync({
        family_id: lead.id,
        title: followUpTitle.trim(),
        description: null,
        due_date: followUpDueDate,
        due_time: null,
        priority: followUpPriority,
      })
      setFollowUpTitle('')
      setFollowUpDueDate('')
      setFollowUpPriority('medium')
      setShowFollowUpForm(false)
      showSuccess('Follow-up created')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to create follow-up')
    } finally {
      setIsCreatingFollowUp(false)
    }
  }

  const handleCompleteFollowUp = async (id: string) => {
    try {
      await completeFollowUp.mutateAsync(id)
      showSuccess('Follow-up completed')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to complete follow-up')
    }
  }

  const handleDeleteFollowUp = async (id: string) => {
    if (!confirm('Delete this follow-up?')) return
    try {
      await deleteFollowUp.mutateAsync({ id, familyId: lead.id })
      showSuccess('Follow-up deleted')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete follow-up')
    }
  }

  const getFollowUpUrgency = (dueDate: string): string => {
    const due = parseLocalDate(dueDate)
    const today = dateAtMidnight(new Date())
    const diffDays = daysBetween(today, due)

    if (diffDays < 0) return 'text-red-400'
    if (diffDays === 0) return 'text-orange-400'
    if (diffDays === 1) return 'text-yellow-400'
    return 'text-zinc-400'
  }

  const formatFollowUpDate = (dueDate: string): string => {
    const due = parseLocalDate(dueDate)
    const today = dateAtMidnight(new Date())
    const diffDays = daysBetween(today, due)

    if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Tomorrow'
    return due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
    // createdAt is a full ISO timestamp, so we parse it and normalize to midnight
    const created = dateAtMidnight(new Date(createdAt))
    const today = dateAtMidnight(new Date())
    return daysBetween(created, today)
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
            {lead.display_name || 'No name'}
          </h3>
          {lead.primary_email && (
            <a
              href={`mailto:${lead.primary_email}`}
              className="text-sm text-blue-400 hover:underline flex items-center gap-1 mt-1"
            >
              <Mail className="w-3 h-3" />
              {lead.primary_email}
            </a>
          )}
          {lead.primary_phone && (
            <a
              href={`tel:${lead.primary_phone}`}
              className="text-sm text-zinc-400 hover:text-white flex items-center gap-1 mt-1"
            >
              <Phone className="w-3 h-3" />
              {lead.primary_phone}
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
                  lead.lead_status === status
                    ? LEAD_STATUS_COLORS_WITH_BORDER[status]
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600'
                }`}
              >
                {LEAD_STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </div>

        {/* Lead Info */}
        <div className="space-y-3">
          {lead.lead_type && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">Type</span>
              <span className="text-white capitalize">{lead.lead_type.replace('_', ' ')}</span>
            </div>
          )}
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

        {/* Converted Status */}
        {lead.lead_status === 'converted' && lead.converted_at && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
            <div className="flex items-center gap-2 text-green-400 text-sm font-medium mb-1">
              <CheckCircle className="w-4 h-4" />
              Converted to Customer
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              {formatDate(lead.converted_at)}
            </p>
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

        {/* Contact Activity */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Contact Activity
            </h4>
            <button
              onClick={() => setShowActivityForm(!showActivityForm)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700"
            >
              <Plus className="w-3 h-3" />
              Log Contact
            </button>
          </div>

          {/* Activity Form */}
          {showActivityForm && (
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 mb-3 space-y-3">
              <div className="flex gap-2">
                {(['call', 'email', 'text', 'other'] as ContactType[]).map((type) => {
                  const Icon = contactTypeIcons[type]
                  return (
                    <button
                      key={type}
                      onClick={() => setActivityType(type)}
                      className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded border transition-colors ${
                        activityType === type
                          ? 'bg-blue-600/20 text-blue-400 border-blue-500/30'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      {contactTypeLabels[type]}
                    </button>
                  )
                })}
              </div>
              <textarea
                value={activityNotes}
                onChange={(e) => setActivityNotes(e.target.value)}
                placeholder="Add notes about this contact..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
                rows={2}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowActivityForm(false)}
                  className="px-3 py-1 text-xs text-zinc-400 hover:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogActivity}
                  disabled={isLoggingActivity}
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoggingActivity ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          )}

          {/* Activity Timeline */}
          {activitiesLoading ? (
            <p className="text-xs text-zinc-500">Loading activities...</p>
          ) : activities && activities.length > 0 ? (
            <div className="space-y-2">
              {activities.map((activity) => {
                const Icon = contactTypeIcons[activity.contact_type]
                return (
                  <div
                    key={activity.id}
                    className="flex gap-3 p-2 bg-zinc-800/30 rounded-lg"
                  >
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-zinc-700/50 rounded-full">
                      <Icon className="w-4 h-4 text-zinc-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-zinc-300 font-medium">
                          {contactTypeLabels[activity.contact_type]}
                        </span>
                        <span className="text-zinc-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(activity.contacted_at)}
                        </span>
                      </div>
                      {activity.notes && (
                        <p className="text-xs text-zinc-400 mt-1">{activity.notes}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-zinc-500">No contact activity logged yet</p>
          )}
        </div>

        {/* Follow-ups */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Follow-ups
            </h4>
            <button
              onClick={() => setShowFollowUpForm(!showFollowUpForm)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          </div>

          {/* Follow-up Form */}
          {showFollowUpForm && (
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 mb-3 space-y-3">
              <input
                type="text"
                value={followUpTitle}
                onChange={(e) => setFollowUpTitle(e.target.value)}
                placeholder="Follow-up title..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
              />
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-zinc-500 block mb-1">Due Date</label>
                  <input
                    type="date"
                    value={followUpDueDate}
                    onChange={(e) => setFollowUpDueDate(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-zinc-600"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-zinc-500 block mb-1">Priority</label>
                  <select
                    value={followUpPriority}
                    onChange={(e) => setFollowUpPriority(e.target.value as TaskPriority)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-zinc-600"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowFollowUpForm(false)}
                  className="px-3 py-1 text-xs text-zinc-400 hover:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateFollowUp}
                  disabled={isCreatingFollowUp || !followUpTitle.trim() || !followUpDueDate}
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {isCreatingFollowUp ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          )}

          {/* Follow-ups List */}
          {followUpsLoading ? (
            <p className="text-xs text-zinc-500">Loading follow-ups...</p>
          ) : followUps && followUps.length > 0 ? (
            <div className="space-y-2">
              {followUps.filter(f => !f.completed).map((followUp) => (
                <div
                  key={followUp.id}
                  className="flex items-start gap-2 p-2 bg-zinc-800/30 rounded-lg group"
                >
                  <button
                    onClick={() => handleCompleteFollowUp(followUp.id)}
                    className="flex-shrink-0 mt-0.5 text-zinc-500 hover:text-green-400"
                  >
                    <Circle className="w-4 h-4" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200">{followUp.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs flex items-center gap-1 ${getFollowUpUrgency(followUp.due_date)}`}>
                        <Calendar className="w-3 h-3" />
                        {formatFollowUpDate(followUp.due_date)}
                      </span>
                      {followUp.priority !== 'medium' && (
                        <span className={`text-xs flex items-center gap-1 ${getPriorityColor(followUp.priority)}`}>
                          <AlertCircle className="w-3 h-3" />
                          {followUp.priority}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteFollowUp(followUp.id)}
                    className="flex-shrink-0 p-1 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {/* Completed follow-ups */}
              {followUps.filter(f => f.completed).length > 0 && (
                <div className="pt-2 mt-2 border-t border-zinc-800">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Completed</p>
                  {followUps.filter(f => f.completed).slice(0, 3).map((followUp) => (
                    <div
                      key={followUp.id}
                      className="flex items-center gap-2 py-1 text-xs text-zinc-500"
                    >
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      <span className="line-through">{followUp.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-zinc-500">No follow-ups scheduled</p>
          )}
        </div>

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
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm text-zinc-300">Synced</span>
              </div>
              {lead.mailchimp_last_synced_at && (
                <p className="text-xs text-zinc-500">
                  Last synced: {formatDate(lead.mailchimp_last_synced_at)}
                </p>
              )}

              {/* Engagement Stats */}
              <div className="bg-zinc-800/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Engagement</span>
                  <button
                    onClick={handleSyncEngagement}
                    disabled={isSyncingEngagement}
                    className="flex items-center gap-1 px-2 py-0.5 text-xs bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600 disabled:opacity-50"
                  >
                    {isSyncingEngagement ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    Refresh
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${LEAD_ENGAGEMENT_COLORS_WITH_BORDER[getEngagementLevel(lead.mailchimp_engagement_score)]}`}>
                    {getEngagementLevel(lead.mailchimp_engagement_score).toUpperCase()}
                  </span>
                  <span className="text-xs text-zinc-400">
                    Score: {lead.mailchimp_engagement_score || 0}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center justify-between bg-zinc-800 rounded px-2 py-1">
                    <span className="text-zinc-400">Opens</span>
                    <span className="text-zinc-200">{lead.mailchimp_opens || 0}</span>
                  </div>
                  <div className="flex items-center justify-between bg-zinc-800 rounded px-2 py-1">
                    <span className="text-zinc-400">Clicks</span>
                    <span className="text-zinc-200">{lead.mailchimp_clicks || 0}</span>
                  </div>
                </div>
                {lead.mailchimp_engagement_updated_at && (
                  <p className="text-xs text-zinc-500">
                    Updated: {formatDate(lead.mailchimp_engagement_updated_at)}
                  </p>
                )}
              </div>

              {lead.mailchimp_tags && lead.mailchimp_tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
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
      {lead.lead_status !== 'converted' && (
        <div className="p-4 border-t border-zinc-800">
          <button
            onClick={handleConvertToCustomer}
            disabled={convertToCustomer.isPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {convertToCustomer.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            Convert to Customer
          </button>
        </div>
      )}
    </div>
  )
}
