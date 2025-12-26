import { useState, useEffect } from 'react'
import { X, Trash2 } from 'lucide-react'
import { useStudentMutations } from '../lib/hooks'
import type { Student } from '../lib/hooks'

// Extended Student type that includes homeschool_status which may exist in DB
interface StudentWithHomeschool extends Student {
  homeschool_status?: string | null
}

interface EditStudentModalProps {
  isOpen: boolean
  onClose: () => void
  student: StudentWithHomeschool | null
  familyId: string
  familyName: string
  onSuccess?: () => void
}

export function EditStudentModal({
  isOpen,
  onClose,
  student,
  familyId: _familyId, // Kept for API compatibility, not used in component
  familyName,
  onSuccess,
}: EditStudentModalProps) {
  const [formData, setFormData] = useState({
    full_name: '',
    grade_level: '',
    dob: '',
    age_group: '',
    homeschool_status: '',
    active: true,
    notes: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const { updateStudent, deleteStudent } = useStudentMutations()

  // Populate form when student changes
  useEffect(() => {
    if (student) {
      setFormData({
        full_name: student.full_name || '',
        grade_level: student.grade_level || '',
        dob: student.dob || '',
        age_group: student.age_group || '',
        homeschool_status: student.homeschool_status || '',
        active: student.active,
        notes: student.notes || '',
      })
    }
  }, [student])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!student) return
    setError(null)

    if (!formData.full_name.trim()) {
      setError('Student name is required')
      return
    }

    updateStudent.mutate(
      {
        id: student.id,
        data: {
          full_name: formData.full_name.trim(),
          grade_level: formData.grade_level || null,
          dob: formData.dob || null,
          age_group: formData.age_group || null,
          active: formData.active,
          notes: formData.notes.trim() || null,
        },
      },
      {
        onSuccess: () => {
          onSuccess?.()
          onClose()
        },
        onError: (err: Error) => {
          setError(err.message || 'Failed to update student')
        },
      }
    )
  }

  const handleDelete = () => {
    if (!student) return

    // FIX: deleteStudent expects just the id string, not an object
    deleteStudent.mutate(
      student.id,
      {
        onSuccess: () => {
          setShowDeleteConfirm(false)
          onSuccess?.()
          onClose()
        },
        onError: (err: Error & { code?: string }) => {
          if (err.code === '23503') {
            setError('Cannot delete student with existing enrollments')
          } else {
            setError(err.message || 'Failed to delete student')
          }
          setShowDeleteConfirm(false)
        },
      }
    )
  }

  if (!isOpen || !student) return null

  const gradeOptions = [
    'Pre-K',
    'Kindergarten',
    '1st',
    '2nd',
    '3rd',
    '4th',
    '5th',
    '6th',
    '7th',
    '8th',
    '9th',
    '10th',
    '11th',
    '12th',
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Edit Student</h2>
            <p className="text-sm text-zinc-400">{familyName}</p>
          </div>
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

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">
              Student Name *
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) =>
                setFormData({ ...formData, full_name: e.target.value })
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
              placeholder="Full name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Grade Level
              </label>
              <select
                value={formData.grade_level}
                onChange={(e) =>
                  setFormData({ ...formData, grade_level: e.target.value })
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
              >
                <option value="">Select grade...</option>
                {gradeOptions.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Date of Birth
              </label>
              <input
                type="date"
                value={formData.dob}
                onChange={(e) =>
                  setFormData({ ...formData, dob: e.target.value })
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Age Group
              </label>
              <select
                value={formData.age_group}
                onChange={(e) =>
                  setFormData({ ...formData, age_group: e.target.value })
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
              >
                <option value="">Select...</option>
                <option value="Elementary (K-5)">Elementary (K-5)</option>
                <option value="Middle School (6-8)">Middle School (6-8)</option>
                <option value="High School (9-12)">High School (9-12)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Homeschool Status
              </label>
              <select
                value={formData.homeschool_status}
                onChange={(e) =>
                  setFormData({ ...formData, homeschool_status: e.target.value })
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
              >
                <option value="">Select...</option>
                <option value="Homeschool">Homeschool</option>
                <option value="Public School">Public School</option>
                <option value="Private School">Private School</option>
                <option value="Charter School">Charter School</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active"
              checked={formData.active}
              onChange={(e) =>
                setFormData({ ...formData, active: e.target.checked })
              }
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="active" className="text-sm text-zinc-400">
              Active student
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={2}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
              placeholder="Learning preferences, special needs, etc."
            />
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-zinc-700">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete Student
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
                disabled={updateStudent.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {updateStudent.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 max-w-md">
              <h3 className="text-lg font-semibold text-zinc-100 mb-2">
                Delete Student?
              </h3>
              <p className="text-zinc-400 mb-4">
                This will permanently delete {student.full_name} and cannot be
                undone. Any associated enrollments must be deleted first.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-zinc-400 hover:text-zinc-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteStudent.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleteStudent.isPending ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}