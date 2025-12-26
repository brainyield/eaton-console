import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryClient'
import {
  Search,
  FileText,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Plus,
  Download,
  DollarSign,
  User,
  Mail,
  Check,
  Loader2,
} from 'lucide-react'

// Types based on database schema
interface Family {
  id: string
  display_name: string
  primary_email: string | null
  primary_phone: string | null
  primary_contact_name?: string | null
}

interface Invoice {
  id: string
  family_id: string
  invoice_number: string | null
  public_id: string
  invoice_date: string
  due_date: string | null
  period_start: string | null
  period_end: string | null
  subtotal: number | null
  total_amount: number | null
  amount_paid: number
  balance_due: number
  status: 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'void'
  sent_at: string | null
  sent_to: string | null
  notes: string | null
  created_at: string
  family?: Family
}

interface InvoiceLineItem {
  id: string
  invoice_id: string
  enrollment_id: string | null
  description: string
  quantity: number
  unit_price: number | null
  amount: number | null
  teacher_cost: number | null
  profit: number | null
}

interface Payment {
  id: string
  invoice_id: string
  amount: number
  payment_date: string
  payment_method: string | null
  reference: string | null
  notes: string | null
  created_at: string
}

type TabType = 'this-week' | 'this-month' | 'hub-sessions' | 'electives' | 'all' | 'overdue'

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: 'Draft', color: 'bg-zinc-600 text-zinc-200', icon: <FileText className="w-3 h-3" /> },
  sent: { label: 'Sent', color: 'bg-blue-600 text-blue-100', icon: <Send className="w-3 h-3" /> },
  paid: { label: 'Paid', color: 'bg-green-600 text-green-100', icon: <CheckCircle2 className="w-3 h-3" /> },
  partial: { label: 'Partial', color: 'bg-amber-600 text-amber-100', icon: <Clock className="w-3 h-3" /> },
  overdue: { label: 'Overdue', color: 'bg-red-600 text-red-100', icon: <AlertCircle className="w-3 h-3" /> },
  void: { label: 'Void', color: 'bg-zinc-700 text-zinc-400', icon: <X className="w-3 h-3" /> },
}

const PAYMENT_METHODS = ['Zelle', 'StepUp', 'Cash', 'Check', 'Bank Transfer', 'Stripe', 'PEP']

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0]
}

// ============================================================================
// HOOKS
// ============================================================================

function useInvoicesWithFamily(tab: TabType) {
  return useQuery({
    queryKey: ['invoices', 'withFamily', tab],
    queryFn: async () => {
      let query = supabase
        .from('invoices')
        .select(`
          *,
          family:families(id, display_name, primary_email, primary_phone, primary_contact_name)
        `)
        .order('invoice_date', { ascending: false })

      // Apply filters based on tab
      if (tab === 'overdue') {
        query = query.eq('status', 'overdue')
      } else if (tab === 'this-month') {
        const now = new Date()
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        query = query
          .gte('invoice_date', firstDay.toISOString().split('T')[0])
          .lte('invoice_date', lastDay.toISOString().split('T')[0])
      }

      const { data, error } = await query
      if (error) throw error
      return (data || []) as Invoice[]
    },
  })
}

function useInvoiceStats() {
  return useQuery({
    queryKey: ['invoices', 'stats'],
    queryFn: async () => {
      const { data } = await supabase
        .from('invoices')
        .select('status, balance_due')

      const allInvoices = data || []
      return {
        total: allInvoices.length,
        draft: allInvoices.filter((i: { status: string }) => i.status === 'draft').length,
        sent: allInvoices.filter((i: { status: string }) => i.status === 'sent').length,
        overdue: allInvoices.filter((i: { status: string }) => i.status === 'overdue').length,
        totalOutstanding: allInvoices
          .filter((i: { status: string }) => ['sent', 'partial', 'overdue'].includes(i.status))
          .reduce((sum: number, i: { balance_due: number }) => sum + (i.balance_due || 0), 0),
      }
    },
  })
}

function useInvoiceDetails(invoiceId: string | null) {
  return useQuery({
    queryKey: ['invoices', 'details', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return { lineItems: [], payments: [] }

      const [lineItemsResult, paymentsResult] = await Promise.all([
        supabase
          .from('invoice_line_items')
          .select('*')
          .eq('invoice_id', invoiceId)
          .order('sort_order'),
        supabase
          .from('payments')
          .select('*')
          .eq('invoice_id', invoiceId)
          .order('payment_date', { ascending: false }),
      ])

      return {
        lineItems: (lineItemsResult.data || []) as InvoiceLineItem[],
        payments: (paymentsResult.data || []) as Payment[],
      }
    },
    enabled: !!invoiceId,
  })
}

// ============================================================================
// RECORD PAYMENT MODAL
// ============================================================================
interface RecordPaymentModalProps {
  invoice: Invoice
  onClose: () => void
  onSuccess: () => void
}

function RecordPaymentModal({ invoice, onClose, onSuccess }: RecordPaymentModalProps) {
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState(invoice.balance_due.toString())
  const [paymentDate, setPaymentDate] = useState(formatDateForInput(new Date()))
  const [paymentMethod, setPaymentMethod] = useState('Zelle')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const paymentAmount = parseFloat(amount)
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      setError('Please enter a valid payment amount')
      setSaving(false)
      return
    }

    if (paymentAmount > invoice.balance_due) {
      setError(`Payment amount ($${paymentAmount.toFixed(2)}) exceeds balance due ($${invoice.balance_due.toFixed(2)})`)
      setSaving(false)
      return
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insertError } = await (supabase.from('payments') as any).insert({
        invoice_id: invoice.id,
        amount: paymentAmount,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        reference: reference || null,
        notes: notes || null,
      })

      if (insertError) {
        throw new Error(insertError.message)
      }

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })

      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error recording payment:', err)
      setError(err instanceof Error ? err.message : 'Failed to record payment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Record Payment</h2>
            <p className="text-sm text-zinc-400">
              {invoice.invoice_number || `#${invoice.public_id}`} • {invoice.family?.display_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="bg-zinc-800/50 rounded-lg p-3 flex justify-between items-center">
            <span className="text-sm text-zinc-400">Balance Due</span>
            <span className="text-lg font-bold text-amber-400">
              {formatCurrency(invoice.balance_due)}
            </span>
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg p-3 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Payment Amount
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={invoice.balance_due}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.00"
                required
              />
            </div>
            <button
              type="button"
              onClick={() => setAmount(invoice.balance_due.toString())}
              className="mt-1.5 text-xs text-blue-400 hover:text-blue-300"
            >
              Pay full balance ({formatCurrency(invoice.balance_due)})
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Payment Date
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={e => setPaymentDate(e.target.value)}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {PAYMENT_METHODS.map(method => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Reference / Confirmation # <span className="text-zinc-500">(optional)</span>
            </label>
            <input
              type="text"
              value={reference}
              onChange={e => setReference(e.target.value)}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Zelle confirmation number"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Notes <span className="text-zinc-500">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Any additional notes..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Record Payment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================================
// INVOICE DETAIL PANEL
// ============================================================================
interface InvoiceDetailPanelProps {
  invoice: Invoice
  lineItems: InvoiceLineItem[]
  payments: Payment[]
  onClose: () => void
  onSendInvoice: (invoiceId: string) => void
  sendingInvoiceId: string | null
  onRecordPayment: () => void
}

function InvoiceDetailPanel({
  invoice,
  lineItems,
  payments,
  onClose,
  onSendInvoice,
  sendingInvoiceId,
  onRecordPayment,
}: InvoiceDetailPanelProps) {
  const status = statusConfig[invoice.status] || statusConfig.draft
  const isSending = sendingInvoiceId === invoice.id

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-zinc-900 border-l border-zinc-700 shadow-xl overflow-auto z-40">
      <div className="sticky top-0 bg-zinc-900 border-b border-zinc-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              {invoice.invoice_number || `#${invoice.public_id}`}
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}
            >
              {status.icon}
              {status.label}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Family Info */}
        <div className="bg-zinc-800/50 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-zinc-700 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-zinc-400" />
            </div>
            <div>
              <div className="font-medium text-zinc-100">{invoice.family?.display_name}</div>
              <div className="text-sm text-zinc-400">{invoice.family?.primary_email}</div>
            </div>
          </div>
          {invoice.family?.primary_phone && (
            <div className="text-sm text-zinc-400">{invoice.family.primary_phone}</div>
          )}
        </div>

        {/* Invoice Details */}
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Invoice Date</span>
            <span className="text-zinc-100">{formatDate(invoice.invoice_date)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Due Date</span>
            <span className="text-zinc-100">{formatDate(invoice.due_date)}</span>
          </div>
          {invoice.period_start && invoice.period_end && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Period</span>
              <span className="text-zinc-100">
                {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
              </span>
            </div>
          )}
          {invoice.sent_at && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Sent</span>
              <span className="text-zinc-100">
                {new Date(invoice.sent_at).toLocaleString()}
              </span>
            </div>
          )}
          {invoice.sent_to && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Sent To</span>
              <span className="text-zinc-100">{invoice.sent_to}</span>
            </div>
          )}
        </div>

        {/* Line Items */}
        <div>
          <h3 className="text-sm font-medium text-zinc-400 mb-3">Line Items</h3>
          {lineItems.length === 0 ? (
            <div className="text-sm text-zinc-500 text-center py-4">No line items</div>
          ) : (
            <div className="space-y-2">
              {lineItems.map(item => (
                <div
                  key={item.id}
                  className="flex justify-between items-start text-sm bg-zinc-800/30 p-3 rounded-lg"
                >
                  <div>
                    <div className="text-zinc-100">{item.description}</div>
                    {item.quantity !== 1 && (
                      <div className="text-zinc-500">
                        {item.quantity} × {formatCurrency(item.unit_price)}
                      </div>
                    )}
                  </div>
                  <div className="text-zinc-100 font-medium">{formatCurrency(item.amount)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment History */}
        {payments.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Payment History</h3>
            <div className="space-y-2">
              {payments.map(payment => (
                <div
                  key={payment.id}
                  className="flex justify-between items-center text-sm bg-green-900/20 border border-green-800/30 p-3 rounded-lg"
                >
                  <div>
                    <div className="text-green-300 font-medium">
                      {formatCurrency(payment.amount)}
                    </div>
                    <div className="text-zinc-500 text-xs">
                      {formatDate(payment.payment_date)} • {payment.payment_method}
                      {payment.reference && ` • ${payment.reference}`}
                    </div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Totals */}
        <div className="border-t border-zinc-700 pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Subtotal</span>
            <span className="text-zinc-100">{formatCurrency(invoice.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Amount Paid</span>
            <span className="text-green-400">-{formatCurrency(invoice.amount_paid)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span className="text-zinc-100">Balance Due</span>
            <span className={invoice.balance_due > 0 ? 'text-amber-400' : 'text-green-400'}>
              {formatCurrency(invoice.balance_due)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {invoice.status === 'draft' && (
            <button
              onClick={() => onSendInvoice(invoice.id)}
              disabled={isSending}
              className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg transition-colors"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending Invoice...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Invoice
                </>
              )}
            </button>
          )}
          {['sent', 'partial', 'overdue'].includes(invoice.status) && invoice.balance_due > 0 && (
            <>
              <button
                onClick={onRecordPayment}
                className="w-full flex items-center justify-center gap-2 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <DollarSign className="w-4 h-4" />
                Record Payment
              </button>
              <button className="w-full flex items-center justify-center gap-2 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors">
                <Mail className="w-4 h-4" />
                Send Reminder
              </button>
            </>
          )}
          
          <a
            href={`/invoice/${invoice.public_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
          >
            <FileText className="w-4 h-4" />
            View Public Invoice
          </a>
          <button className="w-full flex items-center justify-center gap-2 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors">
            <Download className="w-4 h-4" />
            Download PDF
          </button>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div>
            <h3 className="text-sm font-medium text-zinc-400 mb-2">Notes</h3>
            <p className="text-sm text-zinc-300 bg-zinc-800/30 p-3 rounded-lg">{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function Invoicing() {
  const queryClient = useQueryClient()
  
  const [activeTab, setActiveTab] = useState<TabType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)

  // Send invoice state
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null)

  // Record payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  // Fetch invoices
  const { data: invoices = [], isLoading } = useInvoicesWithFamily(activeTab)
  
  // Fetch stats
  const { data: stats } = useInvoiceStats()

  // Fetch selected invoice details
  const { data: invoiceDetails } = useInvoiceDetails(selectedInvoice?.id || null)

  // Client-side search filtering
  const filteredInvoices = useMemo(() => {
    if (!searchQuery) return invoices
    const query = searchQuery.toLowerCase()
    return invoices.filter(invoice =>
      invoice.family?.display_name.toLowerCase().includes(query) ||
      invoice.invoice_number?.toLowerCase().includes(query) ||
      invoice.public_id.toLowerCase().includes(query)
    )
  }, [invoices, searchQuery])

  // ============================================================================
  // SEND INVOICE FUNCTION
  // ============================================================================
  async function sendInvoice(invoiceId: string) {
    setSendingInvoiceId(invoiceId)
    
    try {
      // Fetch invoice with family details
      const { data: rawInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          *,
          family:families(
            id,
            display_name,
            primary_email,
            primary_contact_name
          )
        `)
        .eq('id', invoiceId)
        .single()

      if (invoiceError) throw invoiceError

      const invoiceToSend = rawInvoice as Invoice & { family: Family | null }

      if (!invoiceToSend.family?.primary_email) {
        alert('Cannot send invoice: No email address on file for this family')
        return
      }

      // Fetch line items for the email
      const { data: lineItems } = await supabase
        .from('invoice_line_items')
        .select('description')
        .eq('invoice_id', invoiceId)

      // Build webhook payload
      const payload = {
        invoice_id: invoiceToSend.id,
        invoice_number: invoiceToSend.invoice_number || `#${invoiceToSend.public_id}`,
        public_id: invoiceToSend.public_id,
        invoice_url: `${window.location.origin}/invoice/${invoiceToSend.public_id}`,
        family: {
          id: invoiceToSend.family.id,
          name: invoiceToSend.family.display_name,
          email: invoiceToSend.family.primary_email,
          contact_name: invoiceToSend.family.primary_contact_name || invoiceToSend.family.display_name,
        },
        amounts: {
          subtotal: invoiceToSend.subtotal,
          total: invoiceToSend.total_amount,
          amount_paid: invoiceToSend.amount_paid,
          balance_due: invoiceToSend.balance_due,
        },
        dates: {
          invoice_date: invoiceToSend.invoice_date,
          due_date: invoiceToSend.due_date,
          period_start: invoiceToSend.period_start,
          period_end: invoiceToSend.period_end,
        },
        line_items: (lineItems || []).map((li: { description: string }) => ({ 
          description: li.description 
        })),
      }

      // Trigger n8n webhook
      const webhookResponse = await fetch(
        'https://eatonacademic.app.n8n.cloud/webhook/invoice-send',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )

      if (!webhookResponse.ok) {
        throw new Error('Failed to send invoice email')
      }

      // Update invoice status to 'sent'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase.from('invoices') as any)
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          sent_to: invoiceToSend.family.primary_email,
        })
        .eq('id', invoiceId)

      if (updateError) throw updateError

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['invoices'] })

      // Update selected invoice if it's the one we just sent
      if (selectedInvoice?.id === invoiceId) {
        setSelectedInvoice(prev => prev ? {
          ...prev,
          status: 'sent',
          sent_at: new Date().toISOString(),
          sent_to: invoiceToSend.family?.primary_email || null,
        } : null)
      }
    } catch (err) {
      console.error('Error sending invoice:', err)
      alert(err instanceof Error ? err.message : 'Failed to send invoice')
    } finally {
      setSendingInvoiceId(null)
    }
  }

  function handleSelectInvoice(invoice: Invoice) {
    setSelectedInvoice(invoice)
  }

  function handleClosePanel() {
    setSelectedInvoice(null)
  }

  function handlePaymentSuccess() {
    queryClient.invalidateQueries({ queryKey: ['invoices'] })
    if (selectedInvoice) {
      // Refetch the selected invoice
      queryClient.invalidateQueries({ queryKey: ['invoices', 'details', selectedInvoice.id] })
    }
  }

  // Tab counts
  const tabCounts = useMemo(() => ({
    all: stats?.total || 0,
    draft: stats?.draft || 0,
    overdue: stats?.overdue || 0,
  }), [stats])

  const tabs: { key: TabType; label: string; count?: number }[] = [
    { key: 'this-week', label: 'This Week' },
    { key: 'this-month', label: 'This Month' },
    { key: 'all', label: 'All Invoices', count: tabCounts.all },
    { key: 'overdue', label: 'Overdue', count: tabCounts.overdue },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-zinc-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Invoicing</h1>
            {stats && (
              <p className="text-sm text-zinc-400 mt-1">
                {formatCurrency(stats.totalOutstanding)} outstanding across {stats.sent + stats.overdue} invoices
              </p>
            )}
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm transition-colors">
            <Plus className="w-4 h-4" />
            Create Invoice
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search invoices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                activeTab === tab.key
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-1.5 text-xs text-zinc-500">({tab.count})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 overflow-auto ${selectedInvoice ? 'mr-96' : ''}`}>
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-zinc-400">
            No invoices found
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-zinc-800/50 sticky top-0">
              <tr className="border-b border-zinc-700">
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Invoice</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Family</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 uppercase">Amount</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 uppercase">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filteredInvoices.map(invoice => {
                const status = statusConfig[invoice.status] || statusConfig.draft
                return (
                  <tr
                    key={invoice.id}
                    onClick={() => handleSelectInvoice(invoice)}
                    className={`hover:bg-zinc-800/50 cursor-pointer ${
                      selectedInvoice?.id === invoice.id ? 'bg-zinc-800' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-zinc-100">
                        {invoice.invoice_number || `#${invoice.public_id}`}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-zinc-300">{invoice.family?.display_name}</div>
                      <div className="text-xs text-zinc-500">{invoice.family?.primary_email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-zinc-300">{formatDate(invoice.invoice_date)}</div>
                      {invoice.due_date && (
                        <div className="text-xs text-zinc-500">Due {formatDate(invoice.due_date)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}
                      >
                        {status.icon}
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-sm text-zinc-100">{formatCurrency(invoice.total_amount)}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className={`text-sm font-medium ${
                        invoice.balance_due > 0 ? 'text-amber-400' : 'text-green-400'
                      }`}>
                        {formatCurrency(invoice.balance_due)}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Panel */}
      {selectedInvoice && (
        <InvoiceDetailPanel
          invoice={selectedInvoice}
          lineItems={invoiceDetails?.lineItems || []}
          payments={invoiceDetails?.payments || []}
          onClose={handleClosePanel}
          onSendInvoice={sendInvoice}
          sendingInvoiceId={sendingInvoiceId}
          onRecordPayment={() => setShowPaymentModal(true)}
        />
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <RecordPaymentModal
          invoice={selectedInvoice}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  )
}