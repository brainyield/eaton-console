import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { useStudentMutations } from '../lib/hooks'
import { supabase } from '../lib/supabase'
import type { Student } from '../lib/hooks'
import { formatNameLastFirst } from '../lib/utils'
import { AccessibleModal, ConfirmationModal } from './ui/AccessibleModal'

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
  const [showForceDeleteConfirm, setShowForceDeleteConfirm] = useState(false)

  const { updateStudent, deleteStudent, forceDeleteStudent } = useStudentMutations()

  // Fetch enrollments for this student to show in delete confirmation
  const { data: studentEnrollments = [] } = useQuery({
    queryKey: ['enrollments', 'byStudent', student?.id],
    queryFn: async () => {
      if (!student?.id) return []
      const { data, error } = await (supabase
        .from('enrollments')
        .select('id, status, service:services(name), class_title')
        .eq('student_id', student.id) as any)
      if (error) throw error
      return data || []
    },
    enabled: !!student?.id && isOpen,
  })

  const activeEnrollments = studentEnrollments.filter((e: any) => e.status === 'active' || e.status === 'trial')
  const historicalEnrollments = studentEnrollments.filter((e: any) => e.status === 'ended' || e.status === 'paused')

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
          full_name: formatNameLastFirst(formData.full_name),
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

    deleteStudent.mutate(
      student.id,
      {
        onSuccess: () => {
          setShowDeleteConfirm(false)
          onSuccess?.()
          onClose()
        },
        onError: (err: Error) => {
          // Check if this is a "has historical enrollments" error
          if (err.message.includes('historical enrollment')) {
            setShowDeleteConfirm(false)
            setShowForceDeleteConfirm(true)
          } else {
            setError(err.message || 'Failed to delete student')
            setShowDeleteConfirm(false)
          }
        },
      }
    )
  }

  const handleForceDelete = () => {
    if (!student) return

    forceDeleteStudent.mutate(
      student.id,
      {
        onSuccess: () => {
          setShowForceDeleteConfirm(false)
          onSuccess?.()
          onClose()
        },
        onError: (err: Error) => {
          setError(err.message || 'Failed to delete student')
          setShowForceDeleteConfirm(false)
        },
      }
    )
  }

  if (!student) return null

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

  // Build delete confirmation description
  let deleteDescription = ''
  let canDelete = true
  if (activeEnrollments.length > 0) {
    canDelete = false
    deleteDescription = `Cannot delete - has ${activeEnrollments.length} active enrollment(s). End these enrollments first before deleting the student.`
  } else if (historicalEnrollments.length > 0) {
    deleteDescription = `Warning: This student has ${historicalEnrollments.length} historical enrollment(s). Deleting will also remove their enrollment history. This cannot be undone.`
  } else {
    deleteDescription = `This will permanently delete ${student.full_name}. This cannot be undone.`
  }

  return (
    <>
      <AccessibleModal
        isOpen={isOpen}
        onClose={onClose}
        title="Edit Student"
        subtitle={familyName}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div role="alert" className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-2 rounded">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="student-name" className="block text-sm font-medium text-zinc-400 mb-1">
              Student Name *
            </label>
            <input
              id="student-name"
              type="text"
              autoFocus
              value={formData.full_name}
              onChange={(e) =>
                setFormData({ ...formData, full_name: e.target.value })
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
              placeholder="Last, First (e.g., Smith, Emma)"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="grade-level" className="block text-sm font-medium text-zinc-400 mb-1">
                Grade Level
              </label>
              <select
                id="grade-level"
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
              <label htmlFor="dob" className="block text-sm font-medium text-zinc-400 mb-1">
                Date of Birth
              </label>
              <input
                id="dob"
                type="date"
                value={formData.dob}
                onChange={(e) =>
                  setFormData({ ...formData, dob: e.target.value })
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="age-group" className="block text-sm font-medium text-zinc-400 mb-1">
                Age Group
              </label>
              <select
                id="age-group"
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
              <label htmlFor="homeschool-status" className="block text-sm font-medium text-zinc-400 mb-1">
                Homeschool Status
              </label>
              <select
                id="homeschool-status"
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
            <label htmlFor="notes" className="block text-sm font-medium text-zinc-400 mb-1">
              Notes
            </label>
            <textarea
              id="notes"
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
              <Trash2 className="w-4 h-4" aria-hidden="true" />
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
      </AccessibleModal>

      {/* Delete Confirmation Dialog */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Student?"
        description={deleteDescription}
        confirmLabel={canDelete ? 'Delete' : 'Cannot Delete'}
        variant={activeEnrollments.length > 0 ? 'warning' : 'danger'}
        isLoading={deleteStudent.isPending}
      />

      {/* Force Delete Confirmation Dialog (for historical enrollments) */}
      <ConfirmationModal
        isOpen={showForceDeleteConfirm}
        onClose={() => setShowForceDeleteConfirm(false)}
        onConfirm={handleForceDelete}
        title="Confirm Delete with History?"
        description={`This will permanently delete ${student?.full_name} and ${historicalEnrollments.length} historical enrollment(s). This action cannot be undone and historical enrollment data will be lost.`}
        confirmLabel="Delete Permanently"
        variant="danger"
        isLoading={forceDeleteStudent.isPending}
      />
    </>
  )
}
