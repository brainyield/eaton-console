import { useState, useMemo } from 'react'
import { X, Calendar, Users, AlertCircle } from 'lucide-react'
import { usePayrollMutations, usePendingPayrollAdjustments } from '../lib/hooks'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

// Helper to get default bi-weekly period dates
function getDefaultPeriodDates(): { start: string; end: string } {
  const today = new Date()
  const dayOfWeek = today.getDay() // 0 = Sunday

  // Find the most recent Monday
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const monday = new Date(today)
  monday.setDate(today.getDate() - daysFromMonday)

  // If we're in the second week of a bi-weekly period, go back one more week
  const weekNumber = Math.floor((monday.getTime() - new Date(2024, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))
  if (weekNumber % 2 === 1) {
    monday.setDate(monday.getDate() - 7)
  }

  // Period start is the Monday
  const periodStart = monday.toISOString().split('T')[0]

  // Period end is 13 days later (2 weeks - 1 day = Sunday)
  const periodEnd = new Date(monday)
  periodEnd.setDate(monday.getDate() + 13)
  const periodEndStr = periodEnd.toISOString().split('T')[0]

  return { start: periodStart, end: periodEndStr }
}

export default function CreatePayrollRunModal({ onClose, onSuccess }: Props) {
  const defaultDates = useMemo(() => getDefaultPeriodDates(), [])

  const [periodStart, setPeriodStart] = useState(defaultDates.start)
  const [periodEnd, setPeriodEnd] = useState(defaultDates.end)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { createPayrollRun } = usePayrollMutations()
  const { data: pendingAdjustments = [] } = usePendingPayrollAdjustments()

  // Calculate days in period
  const daysInPeriod = useMemo(() => {
    const start = new Date(periodStart)
    const end = new Date(periodEnd)
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }, [periodStart, periodEnd])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      // Validate dates
      if (new Date(periodEnd) <= new Date(periodStart)) {
        throw new Error('End date must be after start date')
      }

      await createPayrollRun.mutateAsync({
        periodStart,
        periodEnd,
      })

      onSuccess()
    } catch (err: any) {
      console.error('Failed to create payroll run:', err)
      setError(err.message || 'Failed to create payroll run')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg mx-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700">
          <h2 className="text-lg font-semibold text-white">New Payroll Run</h2>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            {/* Period Selection */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-3">
                Pay Period
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Start Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="date"
                      value={periodStart}
                      onChange={(e) => setPeriodStart(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">End Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="date"
                      value={periodEnd}
                      onChange={(e) => setPeriodEnd(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                {daysInPeriod} days in period
              </p>
            </div>

            {/* Info Box */}
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
                <Users className="w-4 h-4" />
                What will be generated
              </h3>
              <ul className="text-sm text-zinc-400 space-y-1">
                <li>- Line items for all active teacher assignments</li>
                <li>- Hours calculated from weekly schedules</li>
                <li>- Rates resolved from assignment/service/teacher defaults</li>
              </ul>
            </div>

            {/* Pending Adjustments Warning */}
            {pendingAdjustments.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-400 text-sm">
                      {pendingAdjustments.length} Pending Adjustment{pendingAdjustments.length !== 1 ? 's' : ''}
                    </h4>
                    <p className="text-xs text-zinc-400 mt-1">
                      These will be automatically applied to this payroll run:
                    </p>
                    <ul className="text-xs text-zinc-400 mt-2 space-y-1">
                      {pendingAdjustments.slice(0, 3).map(adj => (
                        <li key={adj.id}>
                          {adj.teacher?.display_name}: {adj.amount >= 0 ? '+' : ''}{adj.amount.toFixed(2)}
                        </li>
                      ))}
                      {pendingAdjustments.length > 3 && (
                        <li>...and {pendingAdjustments.length - 3} more</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
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
              {isSubmitting ? 'Generating...' : 'Generate Payroll Run'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
