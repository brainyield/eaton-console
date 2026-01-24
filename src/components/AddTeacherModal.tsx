import { useState } from 'react'
import { AccessibleModal } from './ui/AccessibleModal'
import { ModalFooter } from './ui/ModalFooter'
import { useTeacherMutations } from '../lib/hooks'
import type { EmployeeStatus } from '../lib/hooks'
import { formatNameLastFirst } from '../lib/utils'
import { isValidEmail, parsePositiveFloat } from '../lib/validation'

interface AddTeacherModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function AddTeacherModal({ isOpen, onClose, onSuccess }: AddTeacherModalProps) {
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

  const { createTeacher } = useTeacherMutations()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.display_name.trim()) {
      setError('Teacher name is required')
      return
    }

    // Validate email format if provided
    const trimmedEmail = formData.email.trim()
    if (trimmedEmail && !isValidEmail(trimmedEmail)) {
      setError('Please enter a valid email address')
      return
    }

    // Validate hourly rate if provided
    const hourlyRate = parsePositiveFloat(formData.default_hourly_rate)
    if (formData.default_hourly_rate && hourlyRate === null) {
      setError('Hourly rate must be a valid positive number')
      return
    }
    if (hourlyRate !== null && hourlyRate > 500) {
      setError('Hourly rate seems too high (max $500/hr)')
      return
    }

    // Validate max hours per week if provided
    const maxHours = parsePositiveFloat(formData.max_hours_per_week)
    if (formData.max_hours_per_week && maxHours === null) {
      setError('Max hours per week must be a valid positive number')
      return
    }
    if (maxHours !== null && maxHours > 168) {
      setError('Max hours per week cannot exceed 168')
      return
    }

    createTeacher.mutate(
      {
        display_name: formatNameLastFirst(formData.display_name),
        email: trimmedEmail ? trimmedEmail.toLowerCase() : null,
        phone: formData.phone.trim() || null,
        role: formData.role || null,
        skillset: formData.skillset.trim() || null,
        preferred_comm_method: formData.preferred_comm_method || null,
        status: formData.status,
        default_hourly_rate: hourlyRate,
        max_hours_per_week: maxHours,
        payment_info_on_file: formData.payment_info_on_file,
        hire_date: formData.hire_date || null,
        notes: formData.notes.trim() || null,
      },
      {
        onSuccess: () => {
          // Reset form
          setFormData({
            display_name: '',
            email: '',
            phone: '',
            role: '',
            skillset: '',
            preferred_comm_method: '',
            status: 'active',
            default_hourly_rate: '',
            max_hours_per_week: '',
            payment_info_on_file: false,
            hire_date: '',
            notes: '',
          })
          onSuccess?.()
          onClose()
        },
        onError: (err: Error & { code?: string }) => {
          if (err.code === '23505') {
            setError('A teacher with this name already exists')
          } else {
            setError(err.message || 'Failed to create teacher')
          }
        },
      }
    )
  }

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Teacher"
      size="2xl"
    >
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-2 rounded" role="alert">
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
              value={formData.display_name}
              onChange={(e) =>
                setFormData({ ...formData, display_name: e.target.value })
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Last, First (e.g., Aviles, Wilmary)"
              autoFocus
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
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value as EmployeeStatus })
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="active">Active</option>
              <option value="reserve">Reserve</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="col-span-2">
            <label htmlFor="teacher-skillset" className="block text-sm font-medium text-zinc-400 mb-1">
              Skillset
            </label>
            <input
              id="teacher-skillset"
              type="text"
              value={formData.skillset}
              onChange={(e) =>
                setFormData({ ...formData, skillset: e.target.value })
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="e.g., K-8 All Subjects; High School Math & Science"
            />
          </div>

          <div>
            <label htmlFor="teacher-rate" className="block text-sm font-medium text-zinc-400 mb-1">
              Default Hourly Rate ($)
            </label>
            <input
              id="teacher-rate"
              type="number"
              step="0.01"
              min="0"
              value={formData.default_hourly_rate}
              onChange={(e) =>
                setFormData({ ...formData, default_hourly_rate: e.target.value })
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="e.g., 70.00"
            />
          </div>

          <div>
            <label htmlFor="teacher-max-hours" className="block text-sm font-medium text-zinc-400 mb-1">
              Max Hours/Week
            </label>
            <input
              id="teacher-max-hours"
              type="number"
              step="0.5"
              min="0"
              value={formData.max_hours_per_week}
              onChange={(e) =>
                setFormData({ ...formData, max_hours_per_week: e.target.value })
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="e.g., 30"
            />
          </div>

          <div>
            <label htmlFor="teacher-contact-method" className="block text-sm font-medium text-zinc-400 mb-1">
              Preferred Contact Method
            </label>
            <select
              id="teacher-contact-method"
              value={formData.preferred_comm_method}
              onChange={(e) =>
                setFormData({ ...formData, preferred_comm_method: e.target.value })
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select...</option>
              <option value="Email">Email</option>
              <option value="Text">Text</option>
              <option value="Call">Call</option>
              <option value="WhatsApp">WhatsApp</option>
            </select>
          </div>

          <div>
            <label htmlFor="teacher-hire-date" className="block text-sm font-medium text-zinc-400 mb-1">
              Hire Date
            </label>
            <input
              id="teacher-hire-date"
              type="date"
              value={formData.hire_date}
              onChange={(e) =>
                setFormData({ ...formData, hire_date: e.target.value })
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="payment_info"
              checked={formData.payment_info_on_file}
              onChange={(e) =>
                setFormData({ ...formData, payment_info_on_file: e.target.checked })
              }
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="payment_info" className="text-sm text-zinc-400">
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
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <ModalFooter
          onCancel={onClose}
          isSubmitting={createTeacher.isPending}
          submitText="Add Teacher"
          loadingText="Creating..."
        />
      </form>
    </AccessibleModal>
  )
}
