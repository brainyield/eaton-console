import { useState, useEffect } from 'react'
import { DollarSign, Clock, AlertCircle } from 'lucide-react'
import { AccessibleModal } from './ui/AccessibleModal'
import { ModalFooter } from './ui/ModalFooter'
import { useActiveTeachers, usePayrollMutations } from '../lib/hooks'
import { multiplyMoney } from '../lib/moneyUtils'
import type { Teacher } from '../lib/hooks'

interface Props {
  runId: string
  existingTeacherIds: string[] // Teachers already in the payroll run
  onClose: () => void
  onSuccess: () => void
}

export default function AddManualLineItemModal({
  runId,
  existingTeacherIds,
  onClose,
  onSuccess,
}: Props) {
  const [teacherId, setTeacherId] = useState('')
  const [description, setDescription] = useState('')
  const [hours, setHours] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: teachers = [] } = useActiveTeachers()
  const { createLineItem } = usePayrollMutations()

  // Auto-populate hourly rate when teacher is selected
  useEffect(() => {
    if (teacherId) {
      const selectedTeacher = teachers.find((t: Teacher) => t.id === teacherId)
      if (selectedTeacher?.default_hourly_rate) {
        setHourlyRate(selectedTeacher.default_hourly_rate.toString())
      }
    }
  }, [teacherId, teachers])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (!teacherId) {
      setError('Please select a teacher')
      return
    }
    if (!description.trim()) {
      setError('Please enter a description')
      return
    }
    const parsedHours = parseFloat(hours)
    if (!hours || Number.isNaN(parsedHours) || parsedHours <= 0) {
      setError('Please enter valid hours')
      return
    }
    const parsedRate = parseFloat(hourlyRate)
    if (!hourlyRate || Number.isNaN(parsedRate) || parsedRate <= 0) {
      setError('Please enter a valid hourly rate')
      return
    }

    setIsSubmitting(true)

    try {
      await createLineItem.mutateAsync({
        runId,
        teacherId,
        description: description.trim(),
        hours: parsedHours,
        hourlyRate: parsedRate,
      })

      onSuccess()
    } catch (err: unknown) {
      console.error('Failed to create line item:', err)
      setError(err instanceof Error ? err.message : 'Failed to create line item')
    } finally {
      setIsSubmitting(false)
    }
  }

  const calculatedAmount = (() => {
    const h = parseFloat(hours)
    const r = parseFloat(hourlyRate)
    if (!Number.isNaN(h) && !Number.isNaN(r) && h > 0 && r > 0) {
      return multiplyMoney(h, r)
    }
    return 0
  })()

  return (
    <AccessibleModal
      isOpen={true}
      onClose={onClose}
      title="Add Manual Line Item"
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <div className="p-6 space-y-5">
          {/* Teacher Select */}
          <div>
            <label htmlFor="teacher-select" className="block text-sm font-medium text-zinc-300 mb-2">
              Teacher <span className="text-red-400">*</span>
            </label>
            <select
              id="teacher-select"
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select a teacher...</option>
              {teachers.map((teacher: Teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.display_name}
                  {existingTeacherIds.includes(teacher.id) ? '' : ' (new)'}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="line-item-description" className="block text-sm font-medium text-zinc-300 mb-2">
              Description <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              id="line-item-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Cleaning and organizing files on 01/05/26"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Hours and Rate - Side by side */}
          <div className="grid grid-cols-2 gap-4">
            {/* Hours */}
            <div>
              <label htmlFor="line-item-hours" className="block text-sm font-medium text-zinc-300 mb-2">
                Hours <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" aria-hidden="true" />
                <input
                  type="number"
                  id="line-item-hours"
                  step="0.5"
                  min="0"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="0.0"
                  className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            {/* Hourly Rate */}
            <div>
              <label htmlFor="line-item-rate" className="block text-sm font-medium text-zinc-300 mb-2">
                Rate/hr <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" aria-hidden="true" />
                <input
                  type="number"
                  id="line-item-rate"
                  step="0.01"
                  min="0"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Calculated Total */}
          {calculatedAmount > 0 && (
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-400">Calculated Amount</span>
                <span className="text-lg font-semibold text-white">
                  ${calculatedAmount.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" aria-hidden="true" />
              <div className="text-sm text-zinc-400">
                <p>
                  Manual line items are for one-off tasks not part of regular assignments.
                  They will be included in the payroll notification email and CSV export.
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
            submitText="Add Line Item"
            loadingText="Adding..."
          />
        </div>
      </form>
    </AccessibleModal>
  )
}
