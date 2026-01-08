import { useState, useMemo } from 'react'
import {
  Calendar,
  Plus,
  Send,
  Bell,
  Check,
  Clock,
  AlertCircle,
  ChevronDown,
  Users,
  Eye,
  Trash2,
  Play,
  Lock,
  MoreHorizontal,
  UserPlus,
} from 'lucide-react'
import {
  useCheckinPeriods,
  useCheckinInvites,
  useActiveTeachers,
  useCheckinMutations,
  type CheckinPeriodSummary,
  type CheckinInviteWithTeacher,
} from '../lib/hooks'
import { useToast } from '../lib/toast'
import { formatDateLocal } from '../lib/dateUtils'
import CreatePeriodModal from './CreatePeriodModal'
import CheckinResponsePanel from './CheckinResponsePanel'

// =============================================================================
// TYPES
// =============================================================================

type PeriodAction = 'open' | 'close' | 'delete'

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function PeriodStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: typeof Clock }> = {
    draft: { bg: 'bg-zinc-500/20', text: 'text-zinc-400', icon: Clock },
    open: { bg: 'bg-green-500/20', text: 'text-green-400', icon: Play },
    closed: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: Lock },
  }

  const { bg, text, icon: Icon } = config[status] || config.draft

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${bg} ${text}`}>
      <Icon className="w-3 h-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function InviteStatusBadge({ invite }: { invite: CheckinInviteWithTeacher }) {
  if (invite.status === 'submitted') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-green-500/20 text-green-400">
        <Check className="w-3 h-3" />
        Submitted
      </span>
    )
  }

  if (invite.sent_at) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-amber-500/20 text-amber-400">
        <Clock className="w-3 h-3" />
        Pending
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-zinc-500/20 text-zinc-400">
      <AlertCircle className="w-3 h-3" />
      Not Sent
    </span>
  )
}

// =============================================================================
// STATS CARDS
// =============================================================================

interface StatsCardsProps {
  period: CheckinPeriodSummary | null
}

function StatsCards({ period }: StatsCardsProps) {
  if (!period) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 animate-pulse">
            <div className="h-4 bg-zinc-700 rounded w-20 mb-2" />
            <div className="h-8 bg-zinc-700 rounded w-12" />
          </div>
        ))}
      </div>
    )
  }

  const stats = [
    { label: 'Total Teachers', value: period.total_invites, color: 'text-zinc-100' },
    { label: 'Submitted', value: period.submitted_count, color: 'text-green-400' },
    { label: 'Pending', value: period.sent_pending_count, color: 'text-amber-400' },
    { label: 'Not Sent', value: period.not_sent_count, color: 'text-zinc-400' },
  ]

  return (
    <div className="grid grid-cols-4 gap-4">
      {stats.map(stat => (
        <div key={stat.label} className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
          <div className="text-sm text-zinc-400 mb-1">{stat.label}</div>
          <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
        </div>
      ))}
    </div>
  )
}

// =============================================================================
// INVITE TABLE
// =============================================================================

interface InviteTableProps {
  invites: CheckinInviteWithTeacher[]
  periodStatus: string
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onSelectAll: () => void
  onViewResponse: (inviteId: string) => void
  onDeleteInvite: (inviteId: string) => void
}

function InviteTable({
  invites,
  periodStatus,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onViewResponse,
  onDeleteInvite,
}: InviteTableProps) {
  const allSelected = invites.length > 0 && invites.every(i => selectedIds.has(i.id))

  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-700">
            <th className="w-10 px-4 py-3 text-left">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onSelectAll}
                className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-blue-500 focus:ring-blue-500"
              />
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Teacher</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Status</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Sent</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Reminders</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Submitted</th>
            <th className="w-20 px-4 py-3 text-right text-sm font-medium text-zinc-400">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-700">
          {invites.map(invite => (
            <tr key={invite.id} className="hover:bg-zinc-750">
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(invite.id)}
                  onChange={() => onToggleSelect(invite.id)}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-blue-500 focus:ring-blue-500"
                />
              </td>
              <td className="px-4 py-3">
                <div className="font-medium text-zinc-100">{invite.teacher.display_name}</div>
                <div className="text-sm text-zinc-500">{invite.teacher.email || 'No email'}</div>
              </td>
              <td className="px-4 py-3">
                <InviteStatusBadge invite={invite} />
              </td>
              <td className="px-4 py-3 text-sm text-zinc-400">
                {invite.sent_at ? formatDateLocal(new Date(invite.sent_at)) : '—'}
              </td>
              <td className="px-4 py-3 text-sm text-zinc-400">
                {invite.reminders_sent}
              </td>
              <td className="px-4 py-3 text-sm text-zinc-400">
                {invite.submitted_at ? formatDateLocal(new Date(invite.submitted_at)) : '—'}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  {invite.status === 'submitted' && (
                    <button
                      onClick={() => onViewResponse(invite.id)}
                      className="p-1.5 text-zinc-400 hover:text-blue-400 hover:bg-zinc-700 rounded transition-colors"
                      title="View Response"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  {periodStatus === 'draft' && (
                    <button
                      onClick={() => onDeleteInvite(invite.id)}
                      className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-700 rounded transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {invites.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                No teachers invited yet. Click "Add Teachers" to get started.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// =============================================================================
// ADD TEACHERS DROPDOWN
// =============================================================================

interface AddTeachersDropdownProps {
  periodId: string
  existingTeacherIds: Set<string>
  onClose: () => void
}

function AddTeachersDropdown({ periodId, existingTeacherIds, onClose }: AddTeachersDropdownProps) {
  const { data: teachers, isLoading } = useActiveTeachers()
  const { createInvites } = useCheckinMutations()
  const { showToast } = useToast()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const availableTeachers = useMemo(() => {
    if (!teachers) return []
    return teachers.filter(t => !existingTeacherIds.has(t.id))
  }, [teachers, existingTeacherIds])

  const handleToggle = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  const handleSelectAll = () => {
    if (selectedIds.size === availableTeachers.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(availableTeachers.map(t => t.id)))
    }
  }

  const handleAdd = () => {
    if (selectedIds.size === 0) return

    createInvites.mutate(
      { periodId, teacherIds: Array.from(selectedIds) },
      {
        onSuccess: () => {
          showToast(`Added ${selectedIds.size} teacher(s) to period`, 'success')
          onClose()
        },
        onError: (err) => {
          showToast(err.message || 'Failed to add teachers', 'error')
        },
      }
    )
  }

  if (isLoading) {
    return (
      <div className="absolute right-0 top-full mt-2 w-80 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-zinc-700 rounded w-32" />
          <div className="h-8 bg-zinc-700 rounded" />
          <div className="h-8 bg-zinc-700 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50">
      <div className="p-3 border-b border-zinc-700 flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-300">Add Teachers</span>
        <button
          onClick={handleSelectAll}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          {selectedIds.size === availableTeachers.length ? 'Deselect All' : 'Select All'}
        </button>
      </div>
      <div className="max-h-64 overflow-y-auto p-2">
        {availableTeachers.length === 0 ? (
          <div className="text-sm text-zinc-500 text-center py-4">
            All active teachers already added
          </div>
        ) : (
          availableTeachers.map(teacher => (
            <label
              key={teacher.id}
              className="flex items-center gap-3 px-2 py-2 rounded hover:bg-zinc-700 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(teacher.id)}
                onChange={() => handleToggle(teacher.id)}
                className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-blue-500 focus:ring-blue-500"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-zinc-200 truncate">{teacher.display_name}</div>
                <div className="text-xs text-zinc-500 truncate">{teacher.email || 'No email'}</div>
              </div>
            </label>
          ))
        )}
      </div>
      <div className="p-3 border-t border-zinc-700 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200"
        >
          Cancel
        </button>
        <button
          onClick={handleAdd}
          disabled={selectedIds.size === 0 || createInvites.isPending}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {createInvites.isPending ? 'Adding...' : `Add ${selectedIds.size || ''} Teacher${selectedIds.size !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function CheckinsTab() {
  const { showToast } = useToast()
  const { data: periods, isLoading: periodsLoading } = useCheckinPeriods()
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAddTeachers, setShowAddTeachers] = useState(false)
  const [selectedInviteIds, setSelectedInviteIds] = useState<Set<string>>(new Set())
  const [viewingResponseId, setViewingResponseId] = useState<string | null>(null)
  const [showPeriodMenu, setShowPeriodMenu] = useState(false)

  const {
    updatePeriod,
    deletePeriod,
    markInvitesSent,
    markInvitesReminded,
    deleteInvite,
  } = useCheckinMutations()

  // Auto-select first period when loaded
  const selectedPeriod = useMemo(() => {
    if (!periods || periods.length === 0) return null
    if (selectedPeriodId) {
      return periods.find(p => p.id === selectedPeriodId) || periods[0]
    }
    return periods[0]
  }, [periods, selectedPeriodId])

  // Fetch invites for selected period
  const { data: invites, isLoading: invitesLoading } = useCheckinInvites(selectedPeriod?.id)

  // Existing teacher IDs for the selected period
  const existingTeacherIds = useMemo(() => {
    if (!invites) return new Set<string>()
    return new Set(invites.map(i => i.teacher_id))
  }, [invites])

  // Get selected invites that can be acted upon
  const selectedPendingInvites = useMemo(() => {
    if (!invites) return []
    return invites.filter(i => selectedInviteIds.has(i.id) && i.status === 'pending')
  }, [invites, selectedInviteIds])

  const selectedNotSentInvites = useMemo(() => {
    return selectedPendingInvites.filter(i => !i.sent_at)
  }, [selectedPendingInvites])

  const selectedSentInvites = useMemo(() => {
    return selectedPendingInvites.filter(i => i.sent_at)
  }, [selectedPendingInvites])

  // Handlers
  const handleToggleSelect = (id: string) => {
    const newSet = new Set(selectedInviteIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedInviteIds(newSet)
  }

  const handleSelectAll = () => {
    if (!invites) return
    if (selectedInviteIds.size === invites.length) {
      setSelectedInviteIds(new Set())
    } else {
      setSelectedInviteIds(new Set(invites.map(i => i.id)))
    }
  }

  const handlePeriodAction = (action: PeriodAction) => {
    if (!selectedPeriod) return
    setShowPeriodMenu(false)

    if (action === 'delete') {
      if (!confirm(`Delete "${selectedPeriod.display_name}"? This cannot be undone.`)) return
      deletePeriod.mutate(selectedPeriod.id, {
        onSuccess: () => {
          showToast('Period deleted', 'success')
          setSelectedPeriodId(null)
        },
        onError: (err) => showToast(err.message, 'error'),
      })
      return
    }

    const newStatus = action === 'open' ? 'open' : 'closed'
    updatePeriod.mutate(
      { id: selectedPeriod.id, data: { status: newStatus } },
      {
        onSuccess: () => showToast(`Period ${newStatus === 'open' ? 'opened' : 'closed'}`, 'success'),
        onError: (err) => showToast(err.message, 'error'),
      }
    )
  }

  const handleSendInvites = () => {
    if (!selectedPeriod || selectedNotSentInvites.length === 0) return

    markInvitesSent.mutate(
      {
        invites: selectedNotSentInvites,
        periodId: selectedPeriod.id,
        periodDisplayName: selectedPeriod.display_name,
      },
      {
        onSuccess: () => {
          showToast(`Sent ${selectedNotSentInvites.length} invite(s)`, 'success')
          setSelectedInviteIds(new Set())
        },
        onError: (err) => showToast(err.message, 'error'),
      }
    )
  }

  const handleSendReminders = () => {
    if (!selectedPeriod || selectedSentInvites.length === 0) return

    markInvitesReminded.mutate(
      {
        invites: selectedSentInvites,
        periodId: selectedPeriod.id,
        periodDisplayName: selectedPeriod.display_name,
      },
      {
        onSuccess: () => {
          showToast(`Sent ${selectedSentInvites.length} reminder(s)`, 'success')
          setSelectedInviteIds(new Set())
        },
        onError: (err) => showToast(err.message, 'error'),
      }
    )
  }

  const handleDeleteInvite = (inviteId: string) => {
    if (!selectedPeriod) return
    if (!confirm('Remove this teacher from the period?')) return

    deleteInvite.mutate(
      { inviteId, periodId: selectedPeriod.id },
      {
        onSuccess: () => showToast('Teacher removed', 'success'),
        onError: (err) => showToast(err.message, 'error'),
      }
    )
  }

  // Loading state
  if (periodsLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-zinc-800 rounded animate-pulse w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 bg-zinc-800 rounded animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-zinc-800 rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-zinc-400" />
            <select
              value={selectedPeriod?.id || ''}
              onChange={(e) => {
                setSelectedPeriodId(e.target.value)
                setSelectedInviteIds(new Set())
              }}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
            >
              {(!periods || periods.length === 0) && (
                <option value="">No periods yet</option>
              )}
              {periods?.map(p => (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                </option>
              ))}
            </select>
          </div>

          {selectedPeriod && (
            <>
              <PeriodStatusBadge status={selectedPeriod.status} />

              {/* Period Actions Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowPeriodMenu(!showPeriodMenu)}
                  className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded transition-colors"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {showPeriodMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowPeriodMenu(false)}
                    />
                    <div className="absolute left-0 top-full mt-1 w-40 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50">
                      {selectedPeriod.status === 'draft' && (
                        <button
                          onClick={() => handlePeriodAction('open')}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 rounded-t-lg"
                        >
                          <Play className="w-4 h-4" />
                          Open Period
                        </button>
                      )}
                      {selectedPeriod.status === 'open' && (
                        <button
                          onClick={() => handlePeriodAction('close')}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
                        >
                          <Lock className="w-4 h-4" />
                          Close Period
                        </button>
                      )}
                      {selectedPeriod.status === 'draft' && (
                        <button
                          onClick={() => handlePeriodAction('delete')}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-zinc-700 rounded-b-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete Period
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Period
        </button>
      </div>

      {/* Stats Cards */}
      <StatsCards period={selectedPeriod || null} />

      {/* Bulk Actions */}
      {selectedPeriod && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {selectedNotSentInvites.length > 0 && selectedPeriod.status !== 'closed' && (
              <button
                onClick={handleSendInvites}
                disabled={markInvitesSent.isPending}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                Send Invites ({selectedNotSentInvites.length})
              </button>
            )}
            {selectedSentInvites.length > 0 && selectedPeriod.status !== 'closed' && (
              <button
                onClick={handleSendReminders}
                disabled={markInvitesReminded.isPending}
                className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded transition-colors disabled:opacity-50"
              >
                <Bell className="w-4 h-4" />
                Send Reminders ({selectedSentInvites.length})
              </button>
            )}
            {selectedInviteIds.size > 0 && (
              <span className="text-sm text-zinc-500">
                {selectedInviteIds.size} selected
              </span>
            )}
          </div>

          {selectedPeriod.status !== 'closed' && (
            <div className="relative">
              <button
                onClick={() => setShowAddTeachers(!showAddTeachers)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-300 hover:text-white border border-zinc-700 hover:border-zinc-600 rounded transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Add Teachers
                <ChevronDown className={`w-4 h-4 transition-transform ${showAddTeachers ? 'rotate-180' : ''}`} />
              </button>

              {showAddTeachers && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowAddTeachers(false)}
                  />
                  <AddTeachersDropdown
                    periodId={selectedPeriod.id}
                    existingTeacherIds={existingTeacherIds}
                    onClose={() => setShowAddTeachers(false)}
                  />
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Invites Table */}
      {selectedPeriod && (
        invitesLoading ? (
          <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-8 animate-pulse">
            <div className="h-40 bg-zinc-700 rounded" />
          </div>
        ) : (
          <InviteTable
            invites={invites || []}
            periodStatus={selectedPeriod.status}
            selectedIds={selectedInviteIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            onViewResponse={setViewingResponseId}
            onDeleteInvite={handleDeleteInvite}
          />
        )
      )}

      {/* Empty State */}
      {!selectedPeriod && !periodsLoading && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-zinc-400 mb-2">No check-in periods</h3>
          <p className="text-zinc-500 mb-4">
            Create a period to start collecting monthly check-ins from teachers
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create First Period
          </button>
        </div>
      )}

      {/* Modals */}
      <CreatePeriodModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />

      {viewingResponseId && (
        <CheckinResponsePanel
          inviteId={viewingResponseId}
          onClose={() => setViewingResponseId(null)}
        />
      )}
    </div>
  )
}
