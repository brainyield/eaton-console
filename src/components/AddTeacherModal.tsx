import { useState } from 'react'
import { X } from 'lucide-react'
import { useTeacherMutations } from '../lib/hooks'
import type { EmployeeStatus } from '../lib/hooks'
import { formatNameLastFirst } from '../lib/utils'

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

    createTeacher.mutate(
      {
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-100">Add New Teacher</h2>
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
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as EmployeeStatus })
                }
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

          <div className="flex justify-end gap-2 pt-4 border-t border-zinc-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createTeacher.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {createTeacher.isPending ? 'Creating...' : 'Add Teacher'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
