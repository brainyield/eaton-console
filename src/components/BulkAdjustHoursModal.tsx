import { useState } from 'react'
import { Clock, AlertCircle } from 'lucide-react'
import { AccessibleModal } from './ui/AccessibleModal'
import { ModalFooter } from './ui/ModalFooter'
import { usePayrollMutations } from '../lib/hooks'

interface Props {
  runId: string
  selectedTeachers: { id: string; name: string }[]
  onClose: () => void
  onSuccess: () => void
}

export default function BulkAdjustHoursModal({
  runId,
  selectedTeachers,
  onClose,
  onSuccess,
}: Props) {
  const [hours, setHours] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { bulkUpdateTeacherHours } = usePayrollMutations()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const parsedHours = parseFloat(hours)
    if (hours === '' || Number.isNaN(parsedHours) || parsedHours < 0) {
      setError('Please enter a valid number of hours (0 or greater)')
      return
    }

    setIsSubmitting(true)

    try {
      await bulkUpdateTeacherHours.mutateAsync({
        runId,
        teacherIds: selectedTeachers.map(t => t.id),
        hours: parsedHours,
      })

      onSuccess()
    } catch (err: unknown) {
      console.error('Failed to bulk update hours:', err)
      setError(err instanceof Error ? err.message : 'Failed to update hours')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AccessibleModal
      isOpen={true}
      onClose={onClose}
      title="Bulk Adjust Hours"
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <div className="p-6 space-y-5">
          {/* Selected Teachers */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Selected Teachers ({selectedTeachers.length})
            </label>
            <div className="bg-zinc-800/50 rounded-lg p-3 max-h-32 overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {selectedTeachers.map(teacher => (
                  <span
                    key={teacher.id}
                    className="inline-flex items-center px-2 py-1 text-xs font-medium bg-zinc-700 text-zinc-200 rounded"
                  >
                    {teacher.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Hours Input */}
          <div>
            <label htmlFor="hours-input" className="block text-sm font-medium text-zinc-300 mb-2">
              Hours per Student
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" aria-hidden="true" />
              <input
                type="number"
                id="hours-input"
                step="0.5"
                min="0"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="0"
                className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              This will set each student's hours to this value for all selected teachers.
              Use 0 to zero out all hours.
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" aria-hidden="true" />
              <div className="text-sm text-zinc-400">
                <p>
                  This will update <strong className="text-white">all line items</strong> for the selected teachers.
                  Amounts will be recalculated based on each student's hourly rate.
                </p>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div role="alert" className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4">
          <ModalFooter
            onCancel={onClose}
            isSubmitting={isSubmitting}
            submitText="Update Hours"
            loadingText="Updating..."
          />
        </div>
      </form>
    </AccessibleModal>
  )
}
