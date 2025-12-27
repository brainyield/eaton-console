import { useState, useEffect } from 'react'
import { X, AlertTriangle, Briefcase, GraduationCap, Trash2 } from 'lucide-react'
import {
  useTeacherAssignmentMutations,
  getServiceBadgeColor,
  getServiceShortName,
  type TeacherAssignmentWithDetails,
} from '../lib/hooks'

interface EditAssignmentModalProps {
  isOpen: boolean
  assignment: TeacherAssignmentWithDetails | null
  onClose: () => void
  onSuccess?: () => void
}

export function EditAssignmentModal({
  isOpen,
  assignment,
  onClose,
  onSuccess,
}: EditAssignmentModalProps) {
  // Form state
  const [hourlyRate, setHourlyRate] = useState('')
  const [hoursPerWeek, setHoursPerWeek] = useState('')
  const [notes, setNotes] = useState('')
  const [startDate, setStartDate] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Mutations
  const { updateAssignment, deleteAssignment } = useTeacherAssignmentMutations()
  const isSubmitting = updateAssignment.isPending || deleteAssignment.isPending

  // Populate form when assignment changes
  useEffect(() => {
    if (assignment) {
      setHourlyRate(assignment.hourly_rate_teacher?.toString() || '')
      setHoursPerWeek(assignment.hours_per_week?.toString() || '')
      setNotes(assignment.notes || '')
      setStartDate(assignment.start_date || '')
      setIsActive(assignment.is_active)
      setShowDeactivateConfirm(false)
      setShowDeleteConfirm(false)
      setError(null)
    }
  }, [assignment])

  // Determine assignment type
  const isServiceLevel = assignment?.service_id && !assignment?.enrollment_id
  const serviceCode = isServiceLevel
    ? assignment?.service?.code
    : assignment?.enrollment?.service?.code
  const serviceName = isServiceLevel
    ? assignment?.service?.name
    : assignment?.enrollment?.service?.name
  const studentName = assignment?.enrollment?.student?.full_name
  const familyName = assignment?.enrollment?.student?.family?.display_name

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!assignment) return

    setError(null)

    updateAssignment.mutate(
      {
        id: assignment.id,
        data: {
          hourly_rate_teacher: hourlyRate ? parseFloat(hourlyRate) : null,
          hours_per_week: hoursPerWeek ? parseFloat(hoursPerWeek) : null,
          notes: notes || null,
          start_date: startDate || null,
          is_active: isActive,
          end_date: !isActive ? new Date().toISOString().split('T')[0] : null,
        },
      },
      {
        onSuccess: () => {
          onSuccess?.()
          handleClose()
        },
        onError: (err) => {
          console.error('Failed to update assignment:', err)
          setError(err instanceof Error ? err.message : 'Failed to update assignment')
        },
      }
    )
  }

  function handleDeactivate() {
    if (!assignment) return

    setError(null)

    updateAssignment.mutate(
      {
        id: assignment.id,
        data: {
          is_active: false,
          end_date: new Date().toISOString().split('T')[0],
        },
      },
      {
        onSuccess: () => {
          onSuccess?.()
          handleClose()
        },
        onError: (err) => {
          console.error('Failed to deactivate assignment:', err)
          setError(err instanceof Error ? err.message : 'Failed to deactivate assignment')
        },
      }
    )
  }

  function handleDelete() {
    if (!assignment) return

    setError(null)

    deleteAssignment.mutate(assignment.id, {
      onSuccess: () => {
        onSuccess?.()
        handleClose()
      },
      onError: (err) => {
        console.error('Failed to delete assignment:', err)
        setError(err instanceof Error ? err.message : 'Failed to delete assignment')
      },
    })
  }

  function handleClose() {
    setHourlyRate('')
    setHoursPerWeek('')
    setNotes('')
    setStartDate('')
    setIsActive(true)
    setError(null)
    setShowDeactivateConfirm(false)
    setShowDeleteConfirm(false)
    updateAssignment.reset()
    deleteAssignment.reset()
    onClose()
  }

  if (!isOpen || !assignment) return null

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold text-white">Edit Assignment</h2>
            <div className="flex items-center gap-2 mt-1">
              {isServiceLevel ? (
                <Briefcase className="h-4 w-4 text-zinc-400" />
              ) : (
                <GraduationCap className="h-4 w-4 text-zinc-400" />
              )}
              <span className={`px-2 py-0.5 text-xs rounded border ${getServiceBadgeColor(serviceCode || '')}`}>
                {getServiceShortName(serviceCode || '')}
              </span>
              <span className="text-sm text-zinc-400">
                {isServiceLevel ? serviceName : studentName}
              </span>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Assignment Info (Read-Only) */}
            <div className="bg-zinc-800/50 rounded-lg p-4 space-y-2">
              {isServiceLevel ? (
                <div>
                  <span className="text-xs text-zinc-500">Service</span>
                  <p className="text-white font-medium">{serviceName}</p>
                </div>
              ) : (
                <>
                  <div>
                    <span className="text-xs text-zinc-500">Student</span>
                    <p className="text-white font-medium">{studentName}</p>
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500">Family</span>
                    <p className="text-zinc-400">{familyName}</p>
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500">Service</span>
                    <p className="text-zinc-400">{serviceName}</p>
                  </div>
                </>
              )}
            </div>

            {/* Editable Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">
                  Hourly Rate ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="70.00"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">
                  Hours/Week
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={hoursPerWeek}
                  onChange={(e) => setHoursPerWeek(e.target.value)}
                  placeholder="Leave blank for variable"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-zinc-500 mt-1">Leave blank for variable hours</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Schedule details, special instructions, etc."
                rows={3}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            {/* Status Toggle */}
            <div className="flex items-center justify-between py-3 border-t border-zinc-800">
              <div>
                <p className="text-sm font-medium text-white">Active Status</p>
                <p className="text-xs text-zinc-500">
                  {isActive ? 'Assignment is currently active' : 'Assignment is inactive'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isActive ? 'bg-green-600' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isActive ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Deactivate Confirmation */}
            {showDeactivateConfirm && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-amber-300 font-medium">Confirm Deactivation</p>
                    <p className="text-xs text-amber-300/70 mt-1">
                      This will end the assignment and set today as the end date. The assignment will no longer appear in active lists.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button
                        type="button"
                        onClick={handleDeactivate}
                        disabled={isSubmitting}
                        className="px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded-lg disabled:opacity-50"
                      >
                        {isSubmitting ? 'Deactivating...' : 'Yes, Deactivate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeactivateConfirm(false)}
                        className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Delete Confirmation (only for inactive assignments) */}
            {showDeleteConfirm && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <Trash2 className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-300 font-medium">Permanently Delete Assignment?</p>
                    <p className="text-xs text-red-300/70 mt-1">
                      This will permanently remove this assignment from the system. This action cannot be undone.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={isSubmitting}
                        className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg disabled:opacity-50"
                      >
                        {isSubmitting ? 'Deleting...' : 'Yes, Delete Permanently'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800">
            <div className="flex items-center gap-2">
              {/* Deactivate button for active assignments */}
              {assignment.is_active && !showDeactivateConfirm && !showDeleteConfirm && (
                <button
                  type="button"
                  onClick={() => setShowDeactivateConfirm(true)}
                  className="px-3 py-1.5 text-sm text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Deactivate
                </button>
              )}
              {/* Delete button for inactive assignments */}
              {!assignment.is_active && !showDeactivateConfirm && !showDeleteConfirm && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}