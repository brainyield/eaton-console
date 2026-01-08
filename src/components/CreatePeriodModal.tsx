import { useState, useMemo, useEffect } from 'react'
import { AccessibleModal } from './ui/AccessibleModal'
import { useCheckinMutations, useCheckinPeriods } from '../lib/hooks'
import { useToast } from '../lib/toast'

interface CreatePeriodModalProps {
  isOpen: boolean
  onClose: () => void
}

// Generate period suggestions for the next 3 months
function getNextPeriods(): Array<{ key: string; display: string }> {
  const periods: Array<{ key: string; display: string }> = []
  const now = new Date()

  for (let i = 0; i < 3; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const monthName = date.toLocaleString('en-US', { month: 'long' })

    periods.push({
      key: `${year}-${String(month).padStart(2, '0')}`,
      display: `${monthName} ${year}`,
    })
  }

  return periods
}

export default function CreatePeriodModal({ isOpen, onClose }: CreatePeriodModalProps) {
  const { showToast } = useToast()
  const { createPeriod } = useCheckinMutations()
  const { data: existingPeriods } = useCheckinPeriods()

  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null)
  const [customPeriodKey, setCustomPeriodKey] = useState('')
  const [customDisplayName, setCustomDisplayName] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get suggested periods and filter out existing ones
  const suggestions = useMemo(() => {
    const next = getNextPeriods()
    if (!existingPeriods) return next

    const existingKeys = new Set(existingPeriods.map(p => p.period_key))
    return next.filter(p => !existingKeys.has(p.key))
  }, [existingPeriods])

  // Auto-select first available suggestion
  useEffect(() => {
    if (suggestions.length > 0 && !selectedPeriod && !useCustom) {
      setSelectedPeriod(suggestions[0].key)
    }
  }, [suggestions, selectedPeriod, useCustom])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    let periodKey: string
    let displayName: string

    if (useCustom) {
      // Validate custom period
      if (!customPeriodKey.match(/^\d{4}-\d{2}$/)) {
        setError('Period key must be in YYYY-MM format (e.g., 2026-01)')
        return
      }
      if (!customDisplayName.trim()) {
        setError('Display name is required')
        return
      }
      periodKey = customPeriodKey
      displayName = customDisplayName.trim()
    } else {
      if (!selectedPeriod) {
        setError('Please select a period')
        return
      }
      const suggestion = suggestions.find(s => s.key === selectedPeriod)
      if (!suggestion) {
        setError('Invalid period selected')
        return
      }
      periodKey = suggestion.key
      displayName = suggestion.display
    }

    // Check if period already exists
    if (existingPeriods?.some(p => p.period_key === periodKey)) {
      setError('This period already exists')
      return
    }

    createPeriod.mutate(
      { period_key: periodKey, display_name: displayName },
      {
        onSuccess: () => {
          showToast(`Created ${displayName}`, 'success')
          handleClose()
        },
        onError: (err) => {
          setError(err.message || 'Failed to create period')
        },
      }
    )
  }

  const handleClose = () => {
    setSelectedPeriod(null)
    setCustomPeriodKey('')
    setCustomDisplayName('')
    setUseCustom(false)
    setError(null)
    onClose()
  }

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create Check-in Period"
      size="md"
    >
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-2 rounded text-sm">
            {error}
          </div>
        )}

        {/* Quick Select */}
        {!useCustom && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-zinc-400">
              Select Period
            </label>

            {suggestions.length === 0 ? (
              <p className="text-sm text-zinc-500">
                All upcoming periods already exist.{' '}
                <button
                  type="button"
                  onClick={() => setUseCustom(true)}
                  className="text-blue-400 hover:text-blue-300"
                >
                  Create custom period
                </button>
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {suggestions.map(period => (
                  <button
                    key={period.key}
                    type="button"
                    onClick={() => setSelectedPeriod(period.key)}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      selectedPeriod === period.key
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600'
                    }`}
                  >
                    {period.display}
                  </button>
                ))}
              </div>
            )}

            {suggestions.length > 0 && (
              <button
                type="button"
                onClick={() => setUseCustom(true)}
                className="text-sm text-zinc-500 hover:text-zinc-300"
              >
                Or enter custom period →
              </button>
            )}
          </div>
        )}

        {/* Custom Period */}
        {useCustom && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setUseCustom(false)}
              className="text-sm text-zinc-500 hover:text-zinc-300"
            >
              ← Back to quick select
            </button>

            <div>
              <label htmlFor="period-key" className="block text-sm font-medium text-zinc-400 mb-1">
                Period Key (YYYY-MM)
              </label>
              <input
                id="period-key"
                type="text"
                value={customPeriodKey}
                onChange={(e) => setCustomPeriodKey(e.target.value)}
                placeholder="2026-01"
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="display-name" className="block text-sm font-medium text-zinc-400 mb-1">
                Display Name
              </label>
              <input
                id="display-name"
                type="text"
                value={customDisplayName}
                onChange={(e) => setCustomDisplayName(e.target.value)}
                placeholder="January 2026"
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-zinc-700">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createPeriod.isPending || (!useCustom && !selectedPeriod)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {createPeriod.isPending ? 'Creating...' : 'Create Period'}
          </button>
        </div>
      </form>
    </AccessibleModal>
  )
}
