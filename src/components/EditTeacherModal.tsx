import { useState, useEffect, useMemo } from 'react'
import { Trash2 } from 'lucide-react'
import { useTeacherMutations, useTeacherAssignments, useTeacherPaymentsByTeacher } from '../lib/hooks'
import type { Teacher, EmployeeStatus } from '../lib/hooks'
import { formatNameLastFirst } from '../lib/utils'
import { AccessibleModal, ConfirmationModal } from './ui/AccessibleModal'

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

  if (!teacher) return null

  // Build delete description
  let deleteDescription = ''
  if (validationCounts.total > 0) {
    const parts = []
    if (validationCounts.activeEnrollment > 0) {
      parts.push(`${validationCounts.activeEnrollment} active student assignment(s)`)
    }
    if (validationCounts.activeService > 0) {
      parts.push(`${validationCounts.activeService} active service assignment(s)`)
    }
    deleteDescription = `Cannot delete - has ${parts.join(' and ')}. End or transfer all active assignments before deleting this teacher.`
  } else if (validationCounts.payments > 0) {
    deleteDescription = `This will permanently delete ${teacher.display_name} and ${validationCounts.payments} payment record(s). This action cannot be undone.`
  } else {
    deleteDescription = `This will permanently delete ${teacher.display_name}. This action cannot be undone.`
  }

  // Build status warning description
  const statusWarningDescription = `${teacher.display_name} has ${validationCounts.activeEnrollment} student assignment(s) and ${validationCounts.activeService} service assignment(s). These assignments will remain linked but won't appear in new assignment dropdowns. Continue?`

  return (
    <>
      <AccessibleModal
        isOpen={isOpen}
        onClose={onClose}
        title="Edit Teacher"
        size="2xl"
      >
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div role="alert" className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-2 rounded">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label htmlFor="teacher-name" className="block text-sm font-medium text-zinc-400 mb-1">
                Name *
              </label>
              <input
                id="teacher-name"
                type="text"
                autoFocus
                value={formData.display_name}
                onChange={(e) =>
                  setFormData({ ...formData, display_name: e.target.value })
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
                placeholder="Last, First (e.g., Aviles, Wilmary)"
              />
            </div>

            <div>
              <label htmlFor="teacher-email" className="block text-sm font-medium text-zinc-400 mb-1">
                Email
              </label>
              <input
                id="teacher-email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="teacher-phone" className="block text-sm font-medium text-zinc-400 mb-1">
                Phone
              </label>
              <input
                id="teacher-phone"
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="teacher-role" className="block text-sm font-medium text-zinc-400 mb-1">
                Role
              </label>
              <select
                id="teacher-role"
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
              <label htmlFor="teacher-status" className="block text-sm font-medium text-zinc-400 mb-1">
                Status
              </label>
              <select
                id="teacher-status"
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
              <label htmlFor="skillset" className="block text-sm font-medium text-zinc-400 mb-1">
                Skillset
              </label>
              <input
                id="skillset"
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
              <label htmlFor="hourly-rate" className="block text-sm font-medium text-zinc-400 mb-1">
                Default Hourly Rate ($)
              </label>
              <input
                id="hourly-rate"
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
              <label htmlFor="max-hours" className="block text-sm font-medium text-zinc-400 mb-1">
                Max Hours/Week
              </label>
              <input
                id="max-hours"
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
              <label htmlFor="comm-method" className="block text-sm font-medium text-zinc-400 mb-1">
                Preferred Contact Method
              </label>
              <select
                id="comm-method"
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
              <label htmlFor="hire-date" className="block text-sm font-medium text-zinc-400 mb-1">
                Hire Date
              </label>
              <input
                id="hire-date"
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
              <label htmlFor="teacher-notes" className="block text-sm font-medium text-zinc-400 mb-1">
                Notes
              </label>
              <textarea
                id="teacher-notes"
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
              <Trash2 className="w-4 h-4" aria-hidden="true" />
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
      </AccessibleModal>

      {/* Status Change Warning Dialog */}
      <ConfirmationModal
        isOpen={showStatusWarning}
        onClose={cancelStatusChange}
        onConfirm={confirmStatusChange}
        title="Active Assignments Warning"
        description={statusWarningDescription}
        confirmLabel="Change Status Anyway"
        cancelLabel="Cancel"
        variant="warning"
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title={`Delete ${teacher.display_name}?`}
        description={deleteDescription}
        confirmLabel={canDelete ? 'Delete' : 'Cannot Delete'}
        variant={canDelete ? 'danger' : 'warning'}
        isLoading={deleteTeacher.isPending}
      />
    </>
  )
}
