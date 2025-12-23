import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, DollarSign, Calendar, AlertCircle } from 'lucide-react'

interface Teacher {
  id: string
  display_name: string
  email: string | null
  default_hourly_rate: number | null
}

interface Assignment {
  id: string
  enrollment_id: string
  hourly_rate_teacher: number | null
  hours_per_week: number | null
  student_name: string
  family_name: string
  service_id: string
  service_name: string
  service_code: string
}

interface LineItem {
  enrollment_id: string
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
  onSuccess: () => void
}

export function RecordTeacherPaymentModal({
  isOpen,
  teacher,
  onClose,
  onSuccess,
}: RecordTeacherPaymentModalProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  
  // Form state
  const [payPeriodStart, setPayPeriodStart] = useState('')
  const [payPeriodEnd, setPayPeriodEnd] = useState('')
  const [payDate, setPayDate] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Zelle')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

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
      
      setPayPeriodStart(monday.toISOString().split('T')[0])
      setPayPeriodEnd(friday.toISOString().split('T')[0])
      setPayDate(today.toISOString().split('T')[0])
      
      fetchAssignments()
    }
  }, [isOpen, teacher.id])

  async function fetchAssignments() {
    setLoading(true)
    
    const { data, error } = await supabase
      .from('teacher_assignments')
      .select(`
        id,
        enrollment_id,
        hourly_rate_teacher,
        hours_per_week,
        enrollment:enrollments (
          student:students (full_name),
          family:families (display_name),
          service:services (id, name, code)
        )
      `)
      .eq('teacher_id', teacher.id)
      .eq('is_active', true)

    if (error) {
      console.error('Error fetching assignments:', error)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formatted = ((data || []) as any[]).map((a) => ({
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
      
      setAssignments(formatted)
      
      // Auto-generate line items from assignments
      const items: LineItem[] = formatted.map((a: Assignment) => {
        const hours = a.hours_per_week || 0
        const rate = a.hourly_rate_teacher || teacher.default_hourly_rate || 0
        return {
          enrollment_id: a.enrollment_id,
          service_id: a.service_id,
          description: `${a.student_name} - ${a.service_name}: ${hours} hrs × $${rate.toFixed(2)}`,
          hours: hours,
          hourly_rate: rate,
          amount: hours * rate,
        }
      })
      
      setLineItems(items)
    }
    
    setLoading(false)
  }

  function updateLineItem(index: number, field: 'hours' | 'hourly_rate', value: number) {
    setLineItems(prev => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        [field]: value,
        amount: field === 'hours' 
          ? value * updated[index].hourly_rate 
          : updated[index].hours * value,
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
  const totalHours = lineItems.reduce((sum, item) => sum + item.hours, 0)

  // Trigger n8n payroll notification
  async function triggerPayrollNotification(paymentId: string) {
    try {
      const payload = {
        payment_id: paymentId,
        teacher: {
          id: teacher.id,
          name: teacher.display_name,
          email: teacher.email,
        },
        amounts: {
          total: totalAmount,
          hours: totalHours,
        },
        period: {
          start: payPeriodStart,
          end: payPeriodEnd,
        },
        line_items: lineItems.filter(li => li.amount > 0).map((li, idx) => ({
          student: assignments[idx]?.student_name || 'Unknown',
          service: assignments[idx]?.service_name || 'Unknown',
          hours: li.hours,
          rate: li.hourly_rate,
          amount: li.amount,
        })),
        payment_method: paymentMethod,
        timestamp: new Date().toISOString(),
      }

      console.log('Triggering n8n webhook with payload:', payload)

      const response = await fetch('https://eatonacademic.app.n8n.cloud/webhook/payroll-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      console.log('n8n webhook response:', response.status)
    } catch (error) {
      console.error('Failed to trigger payroll notification:', error)
      // Don't throw - notification failure shouldn't block payment
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (lineItems.length === 0 || totalAmount === 0) {
      alert('No line items to record')
      return
    }
    
    setSaving(true)
    
    try {
      // 1. Create the teacher_payments record
      const { data: paymentData, error: paymentError } = await (supabase
        .from('teacher_payments') as any)
        .insert({
          teacher_id: teacher.id,
          pay_period_start: payPeriodStart,
          pay_period_end: payPeriodEnd,
          pay_date: payDate,
          total_amount: totalAmount,
          payment_method: paymentMethod || null,
          reference: reference || null,
          notes: notes || null,
        })
        .select('id')
        .single()

      if (paymentError) throw paymentError

      const paymentId = paymentData.id

      // 2. Create line items
      const lineItemsToInsert = lineItems
        .filter(item => item.amount > 0)
        .map(item => ({
          teacher_payment_id: paymentId,
          service_id: item.service_id || null,
          enrollment_id: item.enrollment_id || null,
          description: item.description,
          hours: item.hours,
          hourly_rate: item.hourly_rate,
          amount: item.amount,
        }))

      if (lineItemsToInsert.length > 0) {
        const { error: lineItemsError } = await (supabase
          .from('teacher_payment_line_items') as any)
          .insert(lineItemsToInsert)

        if (lineItemsError) throw lineItemsError
      }

      // 3. Trigger n8n notification
      await triggerPayrollNotification(paymentId)

      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error recording payment:', error)
      alert('Failed to record payment. Please try again.')
    } finally {
      setSaving(false)
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
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-background border border-border rounded-lg shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold">Record Payment</h2>
            <p className="text-sm text-muted-foreground">{teacher.display_name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-auto">
          <div className="p-4 space-y-4">
            {/* Pay Period */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Period Start
                </label>
                <input
                  type="date"
                  value={payPeriodStart}
                  onChange={(e) => setPayPeriodStart(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Period End</label>
                <input
                  type="date"
                  value={payPeriodEnd}
                  onChange={(e) => setPayPeriodEnd(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Pay Date & Method */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Pay Date</label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
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
              <label className="block text-sm font-medium mb-1">Reference / Confirmation #</label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g., Zelle confirmation number"
                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Line Items */}
            <div>
              <label className="block text-sm font-medium mb-2">
                <DollarSign className="w-4 h-4 inline mr-1" />
                Payment Breakdown
              </label>
              
              {loading ? (
                <div className="text-muted-foreground text-center py-4">Loading assignments...</div>
              ) : lineItems.length === 0 ? (
                <div className="text-muted-foreground text-center py-4 bg-muted/20 rounded-lg border border-border">
                  <AlertCircle className="w-5 h-5 inline mr-2" />
                  No active assignments found for this teacher
                </div>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2 font-medium">Student / Service</th>
                        <th className="text-right p-2 font-medium w-20">Hours</th>
                        <th className="text-right p-2 font-medium w-24">Rate</th>
                        <th className="text-right p-2 font-medium w-24">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((item, index) => (
                        <tr key={index} className="border-t border-border">
                          <td className="p-2">
                            <div className="font-medium">{assignments[index]?.student_name}</div>
                            <div className="text-xs text-muted-foreground">{assignments[index]?.service_name}</div>
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              value={item.hours}
                              onChange={(e) => updateLineItem(index, 'hours', parseFloat(e.target.value) || 0)}
                              step="0.5"
                              min="0"
                              className="w-full px-2 py-1 text-right bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </td>
                          <td className="p-2">
                            <div className="flex items-center">
                              <span className="text-muted-foreground mr-1">$</span>
                              <input
                                type="number"
                                value={item.hourly_rate}
                                onChange={(e) => updateLineItem(index, 'hourly_rate', parseFloat(e.target.value) || 0)}
                                step="5"
                                min="0"
                                className="w-full px-2 py-1 text-right bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            </div>
                          </td>
                          <td className="p-2 text-right font-medium">
                            ${item.amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/30">
                      <tr className="border-t border-border">
                        <td colSpan={3} className="p-2 text-right font-medium">Total:</td>
                        <td className="p-2 text-right font-bold text-lg">${totalAmount.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-1">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Any additional notes..."
                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 flex items-center justify-end gap-3 p-4 border-t border-border bg-muted/20">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || totalAmount === 0}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Recording...' : `Record Payment ($${totalAmount.toFixed(2)})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}