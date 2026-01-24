import { useState, useEffect, useMemo } from 'react'
import { X, DollarSign, Calendar, AlertCircle } from 'lucide-react'
import { useTeacherAssignmentsByTeacher, useTeacherPaymentMutations } from '../lib/hooks'
import type { Teacher } from '../lib/hooks'
import { multiplyMoney } from '../lib/moneyUtils'
import { formatDateLocal } from '../lib/dateUtils'

interface LineItem {
  enrollment_id: string | null
  service_id: string
  description: string
  hours: number
  hourly_rate: number
  amount: number
}

interface RecordTeacherPaymentModalProps {
  isOpen: boolean
  teacher: Teacher
  onClose: () => void
  onSuccess?: () => void
}

export function RecordTeacherPaymentModal({
  isOpen,
  teacher,
  onClose,
  onSuccess,
}: RecordTeacherPaymentModalProps) {
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [error, setError] = useState<string | null>(null)
  
  // Form state
  const [payPeriodStart, setPayPeriodStart] = useState('')
  const [payPeriodEnd, setPayPeriodEnd] = useState('')
  const [payDate, setPayDate] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('ACH')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  // Fetch assignments using React Query
  const { data: assignmentsData, isLoading: loading } = useTeacherAssignmentsByTeacher(
    teacher.id,
    { enabled: isOpen }
  )

  // Get create payment mutation
  const { createPayment } = useTeacherPaymentMutations()

  // Use mutation's isPending for loading state (avoids manual state management issues)
  const saving = createPayment.isPending

  // Transform assignments data for display
  const assignments = useMemo(() => {
    if (!assignmentsData) return []
    return assignmentsData.map(a => ({
      id: a.id,
      enrollment_id: a.enrollment_id,
      hourly_rate_teacher: a.hourly_rate_teacher,
      hours_per_week: a.hours_per_week,
      student_name: a.enrollment?.student?.full_name || 'Unknown',
      family_name: a.enrollment?.family?.display_name || 'Unknown',
      service_id: a.enrollment?.service?.id || '',
      service_name: a.enrollment?.service?.name || 'Unknown',
      service_code: a.enrollment?.service?.code || '',
    }))
  }, [assignmentsData])

  // Set default dates (current week)
  useEffect(() => {
    if (isOpen) {
      const today = new Date()
      const dayOfWeek = today.getDay()

      // Get Monday of current week
      const monday = new Date(today)
      monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))

      // Get Friday of current week
      const friday = new Date(monday)
      friday.setDate(monday.getDate() + 4)

      // Use local date formatting to avoid timezone-related date shifts
      setPayPeriodStart(formatDateLocal(monday))
      setPayPeriodEnd(formatDateLocal(friday))
      setPayDate(formatDateLocal(today))
      setError(null)
    }
  }, [isOpen])

  // Auto-generate line items when assignments load
  useEffect(() => {
    if (assignments.length > 0) {
      const items: LineItem[] = assignments.map((a) => {
        const hours = a.hours_per_week || 0
        const rate = a.hourly_rate_teacher || teacher.default_hourly_rate || 0
        return {
          enrollment_id: a.enrollment_id,
          service_id: a.service_id,
          description: `${a.student_name} - ${a.service_name}: ${hours} hrs × $${rate.toFixed(2)}`,
          hours: hours,
          hourly_rate: rate,
          amount: multiplyMoney(hours, rate),
        }
      })
      setLineItems(items)
    }
  }, [assignments, teacher.default_hourly_rate])

  function updateLineItem(index: number, field: 'hours' | 'hourly_rate', value: number) {
    setLineItems(prev => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        [field]: value,
        amount: field === 'hours'
          ? multiplyMoney(value, updated[index].hourly_rate)
          : multiplyMoney(updated[index].hours, value),
      }
      // Update description
      const assignment = assignments[index]
      if (assignment) {
        const hours = field === 'hours' ? value : updated[index].hours
        const rate = field === 'hourly_rate' ? value : updated[index].hourly_rate
        updated[index].description = `${assignment.student_name} - ${assignment.service_name}: ${hours} hrs × $${rate.toFixed(2)}`
      }
      return updated
    })
  }

  const totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (lineItems.length === 0 || totalAmount === 0) {
      setError('No line items to record')
      return
    }

    // Prevent double submission
    if (saving) return

    try {
      // Include line_items in the mutation call (the mutation handles insertion)
      await createPayment.mutateAsync({
        teacher_id: teacher.id,
        pay_period_start: payPeriodStart,
        pay_period_end: payPeriodEnd,
        pay_date: payDate,
        total_amount: totalAmount,
        payment_method: paymentMethod || undefined,
        reference: reference || undefined,
        notes: notes || undefined,
        line_items: lineItems
          .filter(item => item.amount > 0)
          .map(item => ({
            description: item.description,
            hours: item.hours,
            hourly_rate: item.hourly_rate,
            amount: item.amount,
            service_id: item.service_id || undefined,
            enrollment_id: item.enrollment_id || undefined,
          })),
      })

      // Manual payments don't trigger notifications - bulk payroll handles that
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error('Error recording payment:', err)
      setError(err instanceof Error ? err.message : 'Failed to record payment. Please try again.')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-zinc-700">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Record Payment</h2>
            <p className="text-sm text-zinc-400">{teacher.display_name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-800 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-auto">
          <div className="p-4 space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-2 rounded">
                {error}
              </div>
            )}

            {/* Pay Period */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Period Start
                </label>
                <input
                  type="date"
                  value={payPeriodStart}
                  onChange={(e) => setPayPeriodStart(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Period End</label>
                <input
                  type="date"
                  value={payPeriodEnd}
                  onChange={(e) => setPayPeriodEnd(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Pay Date & Method */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Pay Date</label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ACH">ACH</option>
                  <option value="Zelle">Zelle</option>
                  <option value="Check">Check</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* Reference */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Reference / Confirmation #</label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g., Zelle confirmation number"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Line Items */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                <DollarSign className="w-4 h-4 inline mr-1" />
                Payment Breakdown
              </label>
              
              {loading ? (
                <div className="text-zinc-400 text-center py-4">Loading assignments...</div>
              ) : lineItems.length === 0 ? (
                <div className="text-zinc-400 text-center py-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
                  <AlertCircle className="w-5 h-5 inline mr-2" />
                  No active assignments found for this teacher
                </div>
              ) : (
                <div className="border border-zinc-700 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-800/50">
                      <tr>
                        <th className="text-left p-2 font-medium text-zinc-400">Student / Service</th>
                        <th className="text-right p-2 font-medium text-zinc-400 w-20">Hours</th>
                        <th className="text-right p-2 font-medium text-zinc-400 w-24">Rate</th>
                        <th className="text-right p-2 font-medium text-zinc-400 w-24">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((item, index) => (
                        <tr key={index} className="border-t border-zinc-700">
                          <td className="p-2">
                            <div className="font-medium text-zinc-100">{assignments[index]?.student_name}</div>
                            <div className="text-xs text-zinc-400">{assignments[index]?.service_name}</div>
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              value={item.hours}
                              onChange={(e) => updateLineItem(index, 'hours', parseFloat(e.target.value) || 0)}
                              step="0.5"
                              min="0"
                              className="w-full px-2 py-1 text-right bg-zinc-800 border border-zinc-700 rounded text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="p-2">
                            <div className="flex items-center">
                              <span className="text-zinc-400 mr-1">$</span>
                              <input
                                type="number"
                                value={item.hourly_rate}
                                onChange={(e) => updateLineItem(index, 'hourly_rate', parseFloat(e.target.value) || 0)}
                                step="5"
                                min="0"
                                className="w-full px-2 py-1 text-right bg-zinc-800 border border-zinc-700 rounded text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                          </td>
                          <td className="p-2 text-right font-medium text-zinc-100">
                            ${item.amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-zinc-800/30">
                      <tr className="border-t border-zinc-700">
                        <td colSpan={3} className="p-2 text-right font-medium text-zinc-400">Total:</td>
                        <td className="p-2 text-right font-bold text-lg text-zinc-100">${totalAmount.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Any additional notes..."
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 flex items-center justify-end gap-3 p-4 border-t border-zinc-700 bg-zinc-800/20">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || totalAmount === 0}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Recording...' : `Record Payment ($${totalAmount.toFixed(2)})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}