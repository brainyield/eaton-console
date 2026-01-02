import { useState } from 'react'
import { DollarSign, AlertCircle } from 'lucide-react'
import { AccessibleModal } from './ui/AccessibleModal'
import { useActiveTeachers, usePayrollMutations } from '../lib/hooks'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

export default function PayrollAdjustmentModal({ onClose, onSuccess }: Props) {
  const [teacherId, setTeacherId] = useState('')
  const [amount, setAmount] = useState('')
  const [isPositive, setIsPositive] = useState(true)
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: teachers = [] } = useActiveTeachers()
  const { createAdjustment } = usePayrollMutations()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (!teacherId) {
      setError('Please select a teacher')
      return
    }
    const parsedAmount = parseFloat(amount)
    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount')
      return
    }
    if (!reason.trim()) {
      setError('Please provide a reason for this adjustment')
      return
    }

    setIsSubmitting(true)

    try {
      const adjustmentAmount = parsedAmount * (isPositive ? 1 : -1)

      await createAdjustment.mutateAsync({
        teacherId,
        amount: adjustmentAmount,
        reason: reason.trim(),
      })

      onSuccess()
    } catch (err: unknown) {
      console.error('Failed to create adjustment:', err)
      setError(err instanceof Error ? err.message : 'Failed to create adjustment')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AccessibleModal
      isOpen={true}
      onClose={onClose}
      title="Add Payroll Adjustment"
      size="md"
    >
      {/* Content */}
      <form onSubmit={handleSubmit}>
        <div className="p-6 space-y-5">
          {/* Teacher Select */}
          <div>
            <label htmlFor="teacher-select" className="block text-sm font-medium text-zinc-300 mb-2">
              Teacher
            </label>
            <select
              id="teacher-select"
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select a teacher...</option>
              {teachers.map(teacher => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.display_name}
                </option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label htmlFor="adjustment-amount" className="block text-sm font-medium text-zinc-300 mb-2">
              Amount
            </label>
            <div className="flex gap-2">
              {/* Sign Toggle */}
              <div className="flex rounded-lg overflow-hidden border border-zinc-700">
                <button
                  type="button"
                  onClick={() => setIsPositive(true)}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    isPositive
                      ? 'bg-green-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                  aria-pressed={isPositive}
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => setIsPositive(false)}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    !isPositive
                      ? 'bg-red-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                  aria-pressed={!isPositive}
                >
                  -
                </button>
              </div>

              {/* Amount Input */}
              <div className="relative flex-1">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" aria-hidden="true" />
                <input
                  type="number"
                  id="adjustment-amount"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              {isPositive ? 'Amount owed to teacher' : 'Deduction from teacher pay'}
            </p>
          </div>

          {/* Reason */}
          <div>
            <label htmlFor="adjustment-reason" className="block text-sm font-medium text-zinc-300 mb-2">
              Reason <span className="text-red-400">*</span>
            </label>
            <textarea
              id="adjustment-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Missed 2 hours from previous pay period"
              rows={3}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              required
            />
          </div>

          {/* Info Box */}
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" aria-hidden="true" />
              <div className="text-sm text-zinc-400">
                <p>
                  This adjustment will be automatically applied to the next payroll run.
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
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-zinc-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Adding...' : 'Add Adjustment'}
          </button>
        </div>
      </form>
    </AccessibleModal>
  )
}
