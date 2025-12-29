import { useState, useEffect, useMemo } from 'react'
import { X, Trash2, AlertTriangle, Users, Briefcase, DollarSign, AlertCircle } from 'lucide-react'
import { useTeacherMutations, useTeacherAssignments, useTeacherPaymentsByTeacher } from '../lib/hooks'
import type { Teacher, EmployeeStatus } from '../lib/hooks'
import { formatNameLastFirst } from '../lib/utils'

interface EditTeacherModalProps {
  isOpen: boolean
  onClose: () => void
  teacher: Teacher | null
  onSuccess?: () => void
}

export function EditTeacherModal({
  isOpen,
  onClose,
  teacher,
}: EditTeacherModalProps) {
  const [formData, setFormData] = useState({
    display_name: '',
    email: '',
    phone: '',
    role: '',
    skillset: '',
    preferred_comm_method: '',
    status: 'active' as EmployeeStatus,
    default_hourly_rate: '',
    max_hours_per_week: '',
    payment_info_on_file: false,
    hire_date: '',
    notes: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showStatusWarning, setShowStatusWarning] = useState(false)
  const [pendingStatusChange, setPendingStatusChange] = useState<EmployeeStatus | null>(null)

  const { updateTeacher, deleteTeacher } = useTeacherMutations()
  
  // Fetch assignments and payments for validation
  const { data: assignments } = useTeacherAssignments(teacher?.id)
  const { data: payments } = useTeacherPaymentsByTeacher(teacher?.id || '')

  // Calculate counts for validation messages
  const validationCounts = useMemo(() => {
    if (!assignments) return { activeEnrollment: 0, activeService: 0, total: 0, payments: 0 }
    
    const activeAssignments = assignments.filter(a => a.is_active)
    const enrollmentAssignments = activeAssignments.filter(a => a.enrollment_id !== null)
    const serviceAssignments = activeAssignments.filter(a => a.service_id !== null && a.enrollment_id === null)
    
    return {
      activeEnrollment: enrollmentAssignments.length,
      activeService: serviceAssignments.length,
      total: activeAssignments.length,
      payments: payments?.length || 0,
    }
  }, [assignments, payments])

  // Get service names for service-level assignments
  const serviceNames = useMemo(() => {
    if (!assignments) return []
    const activeServiceAssignments = assignments.filter(
      a => a.is_active && a.service_id !== null && a.enrollment_id === null
    )
    return [...new Set(activeServiceAssignments.map(a => a.service?.name).filter(Boolean))]
  }, [assignments])

  // Populate form when teacher changes
  useEffect(() => {
    if (teacher) {
      setFormData({
        display_name: teacher.display_name || '',
        email: teacher.email || '',
        phone: teacher.phone || '',
        role: teacher.role || '',
        skillset: teacher.skillset || '',
        preferred_comm_method: teacher.preferred_comm_method || '',
        status: teacher.status,
        default_hourly_rate: teacher.default_hourly_rate?.toString() || '',
        max_hours_per_week: teacher.max_hours_per_week?.toString() || '',
        payment_info_on_file: teacher.payment_info_on_file,
        hire_date: teacher.hire_date || '',
        notes: teacher.notes || '',
      })
    }
  }, [teacher])

  // Handle status change - check for active assignments first
  const handleStatusChange = (newStatus: EmployeeStatus) => {
    // If changing FROM active TO something else, check for active assignments
    if (teacher?.status === 'active' && newStatus !== 'active' && validationCounts.total > 0) {
      setPendingStatusChange(newStatus)
      setShowStatusWarning(true)
    } else {
      setFormData({ ...formData, status: newStatus })
    }
  }

  // Confirm status change after warning
  const confirmStatusChange = () => {
    if (pendingStatusChange) {
      setFormData({ ...formData, status: pendingStatusChange })
    }
    setShowStatusWarning(false)
    setPendingStatusChange(null)
  }

  // Cancel status change
  const cancelStatusChange = () => {
    setShowStatusWarning(false)
    setPendingStatusChange(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!teacher) return
    setError(null)

    if (!formData.display_name.trim()) {
      setError('Teacher name is required')
      return
    }

    updateTeacher.mutate(
      {
        id: teacher.id,
        data: {
          display_name: formatNameLastFirst(formData.display_name),
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          role: formData.role || null,
          skillset: formData.skillset.trim() || null,
          preferred_comm_method: formData.preferred_comm_method || null,
          status: formData.status,
          default_hourly_rate: formData.default_hourly_rate
            ? parseFloat(formData.default_hourly_rate)
            : null,
          max_hours_per_week: formData.max_hours_per_week
            ? parseFloat(formData.max_hours_per_week)
            : null,
          payment_info_on_file: formData.payment_info_on_file,
          hire_date: formData.hire_date || null,
          notes: formData.notes.trim() || null,
        },
      },
      {
        onSuccess: () => {
          onClose()
        },
        onError: (err: Error & { code?: string }) => {
          if (err.code === '23505') {
            setError('A teacher with this name already exists')
          } else {
            setError(err.message || 'Failed to update teacher')
          }
        },
      }
    )
  }

  const handleDelete = () => {
    if (!teacher) return

    deleteTeacher.mutate(teacher.id, {
      onSuccess: () => {
        setShowDeleteConfirm(false)
        onClose()
      },
      onError: (err: Error & { code?: string }) => {
        if (err.code === '23503') {
          setError('Cannot delete teacher with active assignments. Please end or transfer all assignments first.')
        } else {
          setError(err.message || 'Failed to delete teacher')
        }
        setShowDeleteConfirm(false)
      },
    })
  }

  // Can delete only if no active assignments
  const canDelete = validationCounts.total === 0

  if (!isOpen || !teacher) return null

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-100">Edit Teacher</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-800 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-2 rounded">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={formData.display_name}
                onChange={(e) =>
                  setFormData({ ...formData, display_name: e.target.value })
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
                placeholder="Last, First (e.g., Aviles, Wilmary)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Role
              </label>
              <select
                value={formData.role}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value })
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
              >
                <option value="">Select role...</option>
                <option value="Academic Coach">Academic Coach</option>
                <option value="Pod Teacher">Pod Teacher</option>
                <option value="Online Instructor">Online Instructor</option>
                <option value="Hub Staff">Hub Staff</option>
                <option value="Elective Instructor">Elective Instructor</option>
                <option value="Consultant">Consultant</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleStatusChange(e.target.value as EmployeeStatus)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
              >
                <option value="active">Active</option>
                <option value="reserve">Reserve</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Skillset
              </label>
              <input
                type="text"
                value={formData.skillset}
                onChange={(e) =>
                  setFormData({ ...formData, skillset: e.target.value })
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
                placeholder="e.g., K-8 All Subjects; High School Math & Science"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Default Hourly Rate ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.default_hourly_rate}
                onChange={(e) =>
                  setFormData({ ...formData, default_hourly_rate: e.target.value })
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
                placeholder="e.g., 70.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Max Hours/Week
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={formData.max_hours_per_week}
                onChange={(e) =>
                  setFormData({ ...formData, max_hours_per_week: e.target.value })
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
                placeholder="e.g., 30"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Preferred Contact Method
              </label>
              <select
                value={formData.preferred_comm_method}
                onChange={(e) =>
                  setFormData({ ...formData, preferred_comm_method: e.target.value })
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
              >
                <option value="">Select...</option>
                <option value="Email">Email</option>
                <option value="Text">Text</option>
                <option value="Call">Call</option>
                <option value="WhatsApp">WhatsApp</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Hire Date
              </label>
              <input
                type="date"
                value={formData.hire_date}
                onChange={(e) =>
                  setFormData({ ...formData, hire_date: e.target.value })
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="payment_info_edit"
                checked={formData.payment_info_on_file}
                onChange={(e) =>
                  setFormData({ ...formData, payment_info_on_file: e.target.checked })
                }
                className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="payment_info_edit" className="text-sm text-zinc-400">
                Payment information on file
              </label>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-zinc-700">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete Teacher
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-zinc-400 hover:text-zinc-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateTeacher.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {updateTeacher.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>

        {/* Status Change Warning Dialog */}
        {showStatusWarning && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <div 
              className="bg-zinc-900 border border-amber-600/50 rounded-lg p-6 max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-semibold text-zinc-100">
                    Active Assignments Warning
                  </h3>
                  <p className="text-zinc-400 text-sm mt-1">
                    {teacher?.display_name} has active assignments:
                  </p>
                </div>
              </div>
              
              <div className="bg-zinc-800/50 rounded-lg p-3 mb-4 space-y-2">
                {validationCounts.activeEnrollment > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-blue-400" />
                    <span className="text-zinc-300">
                      {validationCounts.activeEnrollment} student assignment{validationCounts.activeEnrollment !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
                {validationCounts.activeService > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Briefcase className="w-4 h-4 text-green-400" />
                    <span className="text-zinc-300">
                      {validationCounts.activeService} service assignment{validationCounts.activeService !== 1 ? 's' : ''}
                      {serviceNames.length > 0 && (
                        <span className="text-zinc-500 ml-1">
                          ({serviceNames.join(', ')})
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>

              <p className="text-amber-200/80 text-sm mb-4">
                These assignments will remain linked to {teacher?.display_name}, but they won't appear in new assignment dropdowns. Continue?
              </p>
              
              <div className="flex justify-end gap-2">
                <button
                  onClick={cancelStatusChange}
                  className="px-4 py-2 text-zinc-400 hover:text-zinc-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmStatusChange}
                  className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors"
                >
                  Change Status Anyway
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <div 
              className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-zinc-100 mb-2">
                Delete {teacher.display_name}?
              </h3>
              
              {/* Show what's blocking deletion or what will be affected */}
              {(validationCounts.total > 0 || validationCounts.payments > 0) ? (
                <div className="mb-4">
                  <div className="bg-zinc-800/50 rounded-lg p-3 mb-3 space-y-2">
                    {validationCounts.activeEnrollment > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4 text-blue-400" />
                        <span className="text-zinc-300">
                          {validationCounts.activeEnrollment} active student assignment{validationCounts.activeEnrollment !== 1 ? 's' : ''}
                        </span>
                        {validationCounts.total > 0 && (
                          <span className="text-red-400 text-xs ml-auto">Blocking</span>
                        )}
                      </div>
                    )}
                    {validationCounts.activeService > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <Briefcase className="w-4 h-4 text-green-400" />
                        <span className="text-zinc-300">
                          {validationCounts.activeService} active service assignment{validationCounts.activeService !== 1 ? 's' : ''}
                          {serviceNames.length > 0 && (
                            <span className="text-zinc-500 ml-1">
                              ({serviceNames.join(', ')})
                            </span>
                          )}
                        </span>
                        {validationCounts.total > 0 && (
                          <span className="text-red-400 text-xs ml-auto">Blocking</span>
                        )}
                      </div>
                    )}
                    {validationCounts.payments > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="w-4 h-4 text-amber-400" />
                        <span className="text-zinc-300">
                          {validationCounts.payments} payment record{validationCounts.payments !== 1 ? 's' : ''}
                        </span>
                        <span className="text-amber-400 text-xs ml-auto">Will be deleted</span>
                      </div>
                    )}
                  </div>

                  {validationCounts.total > 0 ? (
                    <div className="flex items-start gap-2 text-amber-200/80 text-sm">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>
                        End or transfer all active assignments before deleting this teacher.
                      </span>
                    </div>
                  ) : (
                    <p className="text-zinc-400 text-sm">
                      This will permanently delete the teacher and their payment history. This cannot be undone.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-zinc-400 mb-4">
                  This will permanently delete {teacher.display_name}. This action cannot be undone.
                </p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-zinc-400 hover:text-zinc-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteTeacher.isPending || !canDelete}
                  className={`px-4 py-2 rounded transition-colors ${
                    canDelete
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                  } disabled:opacity-50`}
                  title={!canDelete ? 'End all active assignments first' : ''}
                >
                  {deleteTeacher.isPending ? 'Deleting...' : canDelete ? 'Delete' : 'Cannot Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}