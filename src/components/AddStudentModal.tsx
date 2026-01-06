import { useState } from 'react'
import { AccessibleModal } from './ui/AccessibleModal'
import { useStudentMutations } from '../lib/hooks'
import { formatNameLastFirst, getAgeGroup, AGE_GROUP_OPTIONS } from '../lib/utils'

interface AddStudentModalProps {
  isOpen: boolean
  onClose: () => void
  familyId: string
  familyName: string
  onSuccess?: () => void
}

export function AddStudentModal({
  isOpen,
  onClose,
  familyId,
  familyName,
  onSuccess,
}: AddStudentModalProps) {
  const [formData, setFormData] = useState({
    full_name: '',
    grade_level: '',
    dob: '',
    age_group: '',
    homeschool_status: '',
    notes: '',
  })
  const [error, setError] = useState<string | null>(null)

  const { createStudent } = useStudentMutations()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.full_name.trim()) {
      setError('Student name is required')
      return
    }

    createStudent.mutate(
      {
        family_id: familyId,
        full_name: formatNameLastFirst(formData.full_name),
        grade_level: formData.grade_level || null,
        dob: formData.dob || null,
        age_group: formData.age_group || null,
        notes: formData.notes.trim() || null,
        active: true,
      },
      {
        onSuccess: () => {
          // Reset form
          setFormData({
            full_name: '',
            grade_level: '',
            dob: '',
            age_group: '',
            homeschool_status: '',
            notes: '',
          })
          onSuccess?.()
          onClose()
        },
        onError: (err: Error) => {
          setError(err.message || 'Failed to add student')
        },
      }
    )
  }

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
    <AccessibleModal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Student"
      subtitle={`to ${familyName}`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-2 rounded" role="alert">
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
            value={formData.full_name}
            onChange={(e) =>
              setFormData({ ...formData, full_name: e.target.value })
            }
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="Last, First (e.g., Smith, Emma)"
            autoFocus
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
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
              onChange={(e) => {
                const newDob = e.target.value
                const calculatedAgeGroup = getAgeGroup(newDob)
                setFormData({
                  ...formData,
                  dob: newDob,
                  age_group: calculatedAgeGroup || formData.age_group,
                })
              }}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select...</option>
              {AGE_GROUP_OPTIONS.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
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
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select...</option>
              <option value="Homeschool">Homeschool</option>
              <option value="Public School">Public School</option>
              <option value="Private School">Private School</option>
              <option value="Charter School">Charter School</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="student-notes" className="block text-sm font-medium text-zinc-400 mb-1">
            Notes
          </label>
          <textarea
            id="student-notes"
            value={formData.notes}
            onChange={(e) =>
              setFormData({ ...formData, notes: e.target.value })
            }
            rows={2}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="Learning preferences, special needs, etc."
          />
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
            disabled={createStudent.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {createStudent.isPending ? 'Adding...' : 'Add Student'}
          </button>
        </div>
      </form>
    </AccessibleModal>
  )
}
