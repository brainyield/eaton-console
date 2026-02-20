import { useState, useEffect, useMemo } from 'react'
import { useTeacherMutations, useTeacherAssignments, useTeacherPaymentsByTeacher, usePayrollLineItemsByTeacher } from '../lib/hooks'
import type { Teacher, EmployeeStatus } from '../lib/hooks'
import { formatNameLastFirst } from '../lib/utils'
import { AccessibleModal, ConfirmationModal } from './ui/AccessibleModal'
import { ModalFooter } from './ui/ModalFooter'

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
  const { data: batchPayrollItems } = usePayrollLineItemsByTeacher(teacher?.id || '', { enabled: !!teacher })

  // Calculate counts for validation messages
  const validationCounts = useMemo(() => {
    if (!assignments) return { activeEnrollment: 0, activeService: 0, total: 0, legacyPayments: 0, batchPayrollItems: 0, payments: 0 }

    const activeAssignments = assignments.filter(a => a.is_active)
    const enrollmentAssignments = activeAssignments.filter(a => a.enrollment_id !== null)
    const serviceAssignments = activeAssignments.filter(a => a.service_id !== null && a.enrollment_id === null)

    return {
      activeEnrollment: enrollmentAssignments.length,
      activeService: serviceAssignments.length,
      total: activeAssignments.length,
      legacyPayments: payments?.length || 0,
      batchPayrollItems: batchPayrollItems?.length || 0,
      payments: (payments?.length || 0) + (batchPayrollItems?.length || 0),
    }
  }, [assignments, payments, batchPayrollItems])


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

  // Can delete only if no active assignments and no payroll history
  const canDelete = validationCounts.total === 0 && validationCounts.payments === 0

  if (!teacher) return null

  // Build delete description
  const deleteDescriptionParts: string[] = []
  if (validationCounts.total > 0) {
    const assignmentParts = []
    if (validationCounts.activeEnrollment > 0) {
      assignmentParts.push(`${validationCounts.activeEnrollment} active student assignment${validationCounts.activeEnrollment !== 1 ? 's' : ''}`)
    }
    if (validationCounts.activeService > 0) {
      assignmentParts.push(`${validationCounts.activeService} active service assignment${validationCounts.activeService !== 1 ? 's' : ''}`)
    }
    deleteDescriptionParts.push(`Cannot delete — has ${assignmentParts.join(' and ')}. End or transfer all active assignments first.`)
  }
  if (validationCounts.payments > 0) {
    const payrollParts = []
    if (validationCounts.legacyPayments > 0) {
      payrollParts.push(`${validationCounts.legacyPayments} legacy payment${validationCounts.legacyPayments !== 1 ? 's' : ''}`)
    }
    if (validationCounts.batchPayrollItems > 0) {
      payrollParts.push(`${validationCounts.batchPayrollItems} batch payroll record${validationCounts.batchPayrollItems !== 1 ? 's' : ''}`)
    }
    deleteDescriptionParts.push(`Cannot delete — has payroll history (${payrollParts.join(' and ')}). Deactivate this teacher instead.`)
  }
  const deleteDescription = deleteDescriptionParts.length > 0
    ? deleteDescriptionParts.join(' ')
    : `This will permanently delete ${teacher.display_name}. This action cannot be undone.`

  // Build status warning description
  const statusWarningDescription = `${teacher.display_name} has ${validationCounts.activeEnrollment} student assignment${validationCounts.activeEnrollment !== 1 ? 's' : ''} and ${validationCounts.activeService} service assignment${validationCounts.activeService !== 1 ? 's' : ''}. These assignments will remain linked but won't appear in new assignment dropdowns. Continue?`

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

          <ModalFooter
            onCancel={onClose}
            isSubmitting={updateTeacher.isPending}
            submitText="Save Changes"
            loadingText="Saving..."
            deleteConfig={{
              onDelete: () => setShowDeleteConfirm(true),
              text: 'Delete Teacher',
            }}
          />
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
