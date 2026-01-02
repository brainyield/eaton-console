import { useState } from 'react'
import {
  X,
  Send,
  ExternalLink,
  Download,
  Edit2,
  Trash2,
  User,
  Phone,
  Loader2,
  Ban,
  Bell,
  Mail,
  Clock,
  CheckCircle,
  DollarSign,
  AlertTriangle,
  Wrench,
} from 'lucide-react'
import type { InvoiceWithDetails } from '../lib/hooks'
import { useInvoiceEmails, useInvoicePayments, getReminderType, useInvoiceMutations } from '../lib/hooks'
import { parseLocalDate } from '../lib/dateUtils'
import { useToast } from '../lib/toast'

// ============================================================================
// Types
// ============================================================================

interface Props {
  invoice: InvoiceWithDetails
  onClose: () => void
  onEdit: () => void
  onSend: () => void
  onDelete: () => void
  onVoid: () => void
  isSending?: boolean
  isVoiding?: boolean
}

// ============================================================================
// Status Badge
// ============================================================================

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-zinc-600', text: 'text-white', label: 'Draft' },
  sent: { bg: 'bg-blue-600', text: 'text-white', label: 'Sent' },
  paid: { bg: 'bg-green-600', text: 'text-white', label: 'Paid' },
  partial: { bg: 'bg-amber-600', text: 'text-white', label: 'Partial' },
  overdue: { bg: 'bg-red-600', text: 'text-white', label: 'Overdue' },
  void: { bg: 'bg-zinc-700', text: 'text-zinc-400', label: 'Void' },
}

// ============================================================================
// Helper Functions for Email History
// ============================================================================

function getEmailTypeLabel(emailType: string): string {
  const labels: Record<string, string> = {
    'invoice': 'Invoice Sent',
    'reminder_7_day': 'Friendly Reminder',
    'reminder_14_day': 'Past Due Reminder',
    'reminder_overdue': 'Urgent Reminder',
    'payment_received': 'Payment Confirmation',
  }
  return labels[emailType] || emailType
}

function getEmailTypeBadgeColor(emailType: string): string {
  const colors: Record<string, string> = {
    'invoice': 'bg-blue-500/20 text-blue-400',
    'reminder_7_day': 'bg-sky-500/20 text-sky-400',
    'reminder_14_day': 'bg-amber-500/20 text-amber-400',
    'reminder_overdue': 'bg-red-500/20 text-red-400',
    'payment_received': 'bg-green-500/20 text-green-400',
  }
  return colors[emailType] || 'bg-zinc-500/20 text-zinc-400'
}

function getEmailTypeIcon(emailType: string) {
  if (emailType.includes('reminder')) {
    return <Bell className="w-3.5 h-3.5" aria-hidden="true" />
  }
  if (emailType === 'payment_received') {
    return <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />
  }
  return <Mail className="w-3.5 h-3.5" aria-hidden="true" />
}

function formatEmailDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()

  // Compare dates at local midnight to get accurate day difference
  const dateAtMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const nowAtMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffDays = Math.round((nowAtMidnight.getTime() - dateAtMidnight.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
}

// ============================================================================
// Component
// ============================================================================

export default function InvoiceDetailPanel({
  invoice,
  onClose,
  onEdit,
  onSend,
  onDelete,
  onVoid,
  isSending = false,
  isVoiding = false,
}: Props) {
  const { showError, showSuccess } = useToast()
  const statusConfig = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.draft
  const [sendingReminder, setSendingReminder] = useState(false)
  const [recordingPayment, setRecordingPayment] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [fixingBalance, setFixingBalance] = useState(false)

  // Global processing state to prevent concurrent actions
  const isProcessing = sendingReminder || recordingPayment || fixingBalance || isSending || isVoiding

  // Fetch email history and payment history for this invoice
  const { data: emailHistory, isLoading: loadingEmails } = useInvoiceEmails(invoice?.id)
  const { data: paymentHistory, isLoading: loadingPayments } = useInvoicePayments(invoice?.id)
  const { sendReminder, recordPayment, recalculateInvoiceBalance } = useInvoiceMutations()

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '-'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    // Use parseLocalDate for YYYY-MM-DD strings to avoid timezone issues
    return parseLocalDate(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatPeriod = (start: string | null, end: string | null) => {
    if (!start || !end) return '-'
    // Use parseLocalDate for YYYY-MM-DD strings to avoid timezone issues
    const s = parseLocalDate(start)
    const e = parseLocalDate(end)
    return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  }

  const publicUrl = `${window.location.origin}/invoice/${invoice.public_id}`

  const isDraft = invoice.status === 'draft'
  const isVoid = invoice.status === 'void'
  const canSend = isDraft && invoice.family?.primary_email
  const canVoid = ['sent', 'partial', 'overdue'].includes(invoice.status)
  const canEdit = isDraft
  const canRemind = ['sent', 'partial', 'overdue'].includes(invoice.status)
  const balanceDue = invoice.balance_due ?? ((invoice.total_amount || 0) - (invoice.amount_paid || 0))
  const canRecordPayment = ['sent', 'partial', 'overdue'].includes(invoice.status) && balanceDue > 0
  const hasBalanceError = balanceDue < 0 || (invoice.amount_paid || 0) > (invoice.total_amount || 0)

  // Handler for sending individual reminder
  async function handleSendReminder() {
    if (!invoice || !invoice.family || isProcessing) return

    const { type, label, daysOverdue } = getReminderType(invoice.due_date || '')

    const confirmMsg = `Send "${label}" reminder to ${invoice.family.primary_email}?\n\nThis invoice is ${daysOverdue} days overdue.`
    if (!confirm(confirmMsg)) return

    setSendingReminder(true)
    try {
      await sendReminder.mutateAsync({
        invoice: invoice,
        reminderType: type
      })
      showSuccess('Reminder sent successfully!')
    } catch (error) {
      console.error('Failed to send reminder:', error)
      showError(error instanceof Error ? error.message : 'Failed to send reminder')
    } finally {
      setSendingReminder(false)
    }
  }

  // Open payment modal with balance due as default amount
  function openPaymentModal() {
    if (balanceDue <= 0) return
    setPaymentAmount(balanceDue.toFixed(2))
    setPaymentNotes('')
    setShowPaymentModal(true)
  }

  // Handler for fixing balance issues
  async function handleFixBalance() {
    if (!invoice || isProcessing) return

    const confirmMsg = `This will recalculate the invoice balance based on payment records. Continue?`
    if (!confirm(confirmMsg)) return

    setFixingBalance(true)
    try {
      await recalculateInvoiceBalance.mutateAsync(invoice.id)
      showSuccess('Invoice balance has been corrected!')
    } catch (error: any) {
      console.error('Failed to fix balance:', error)
      showError(error?.message || 'Failed to fix balance')
    } finally {
      setFixingBalance(false)
    }
  }

  // Handler for recording a payment
  async function handleRecordPayment() {
    if (!invoice || isProcessing) return

    const amount = parseFloat(paymentAmount)
    if (Number.isNaN(amount) || amount <= 0) {
      showError('Please enter a valid payment amount')
      return
    }

    if (balanceDue <= 0) {
      showError('This invoice has no balance due')
      setShowPaymentModal(false)
      return
    }

    if (amount > balanceDue) {
      showError(`Payment amount cannot exceed the balance due (${formatCurrency(balanceDue)})`)
      return
    }

    setRecordingPayment(true)
    try {
      await recordPayment.mutateAsync({
        invoiceId: invoice.id,
        amount: amount,
        notes: paymentNotes || undefined
      })
      setShowPaymentModal(false)
      setPaymentAmount('')
      setPaymentNotes('')
      const newStatus = amount >= balanceDue ? 'paid' : 'partial'
      showSuccess(`Payment of ${formatCurrency(amount)} recorded! Invoice is now ${newStatus}.`)
    } catch (error: any) {
      console.error('Failed to record payment:', error)
      showError(error?.message || 'Failed to record payment')
    } finally {
      setRecordingPayment(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-zinc-900 border-l border-zinc-700 z-50 flex flex-col shadow-xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-white font-mono">
                {invoice.invoice_number}
              </h2>
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusConfig.bg} ${statusConfig.text}`}>
                {statusConfig.label}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
            aria-label="Close panel"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Void Banner */}
          {isVoid && (
            <div className="px-6 py-3 bg-zinc-800 border-b border-zinc-700">
              <div className="flex items-center gap-2 text-zinc-400">
                <Ban className="w-4 h-4" aria-hidden="true" />
                <span className="text-sm">This invoice has been voided and is excluded from revenue calculations.</span>
              </div>
            </div>
          )}

          {/* Family Info */}
          <div className="px-6 py-4 border-b border-zinc-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                <User className="w-5 h-5 text-zinc-400" aria-hidden="true" />
              </div>
              <div>
                <div className="text-white font-medium">
                  {invoice.family?.display_name}
                </div>
                {invoice.family?.primary_email && (
                  <div className="text-sm text-zinc-500">
                    {invoice.family.primary_email}
                  </div>
                )}
              </div>
            </div>
            {invoice.family?.primary_phone && (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <Phone className="w-4 h-4" aria-hidden="true" />
                {invoice.family.primary_phone}
              </div>
            )}
          </div>

          {/* Invoice Details */}
          <div className="px-6 py-4 border-b border-zinc-800 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Invoice Date</span>
              <span className="text-white">{formatDate(invoice.invoice_date)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Due Date</span>
              <span className="text-white">{formatDate(invoice.due_date)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Period</span>
              <span className="text-white">{formatPeriod(invoice.period_start, invoice.period_end)}</span>
            </div>
            {invoice.sent_at && (
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Sent</span>
                <span className="text-white">
                  {new Date(invoice.sent_at).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )}
          </div>

          {/* Line Items */}
          <div className="px-6 py-4 border-b border-zinc-800">
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Line Items</h3>
            <div className="space-y-3">
              {invoice.line_items?.map((item, idx) => (
                <div key={item.id || idx} className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="text-sm text-white mb-1">{item.description}</div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">
                      {item.quantity} × {formatCurrency(item.unit_price)}
                    </span>
                    <span className={`font-medium ${isVoid ? 'text-zinc-500 line-through' : 'text-white'}`}>
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                </div>
              ))}
              {(!invoice.line_items || invoice.line_items.length === 0) && (
                <div className="text-sm text-zinc-500 text-center py-4">
                  No line items
                </div>
              )}
            </div>
          </div>

          {/* Totals */}
          <div className="px-6 py-4 border-b border-zinc-800 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Subtotal</span>
              <span className={isVoid ? 'text-zinc-500 line-through' : 'text-white'}>
                {formatCurrency(invoice.subtotal)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Amount Paid</span>
              <span className={invoice.amount_paid && invoice.amount_paid > 0 ? 'text-green-400' : 'text-zinc-500'}>
                {invoice.amount_paid && invoice.amount_paid > 0 ? `-${formatCurrency(invoice.amount_paid)}` : formatCurrency(0)}
              </span>
            </div>
            <div className="flex justify-between text-base pt-2 border-t border-zinc-700">
              <span className="text-white font-medium">Balance Due</span>
              <span className={`font-bold ${
                isVoid
                  ? 'text-zinc-500 line-through'
                  : hasBalanceError ? 'text-red-400'
                  : (invoice.balance_due || 0) > 0 ? 'text-amber-400' : 'text-green-400'
              }`}>
                {formatCurrency(invoice.balance_due)}
              </span>
            </div>

            {/* Balance Error Warning */}
            {hasBalanceError && (
              <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <div className="flex-1">
                    <p className="text-sm text-red-400 font-medium">Balance calculation error</p>
                    <p className="text-xs text-red-400/70 mt-1">
                      The amount paid exceeds the total. This may be due to duplicate payments.
                    </p>
                    <button
                      onClick={handleFixBalance}
                      disabled={fixingBalance}
                      className="mt-2 flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                    >
                      {fixingBalance ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                          Fixing...
                        </>
                      ) : (
                        <>
                          <Wrench className="w-3 h-3" aria-hidden="true" />
                          Recalculate Balance
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="px-6 py-4 border-b border-zinc-800">
              <h3 className="text-sm font-medium text-zinc-400 mb-2">Notes</h3>
              <p className="text-sm text-white">{invoice.notes}</p>
            </div>
          )}

          {/* Payment History Section */}
          {(paymentHistory && paymentHistory.length > 0) && (
            <div className="px-6 py-4 border-b border-zinc-800">
              <h3 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4" aria-hidden="true" />
                Payment History
              </h3>

              {loadingPayments ? (
                <div className="text-sm text-zinc-500">Loading...</div>
              ) : (
                <div className="space-y-2">
                  {paymentHistory.map((payment) => (
                    <div
                      key={payment.id}
                      className="p-3 bg-zinc-800/50 rounded-lg"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-sm font-medium text-green-400">
                            {formatCurrency(payment.amount)}
                          </div>
                          <div className="text-xs text-zinc-500 mt-0.5">
                            {parseLocalDate(payment.payment_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                            {payment.payment_method && ` • ${payment.payment_method}`}
                          </div>
                        </div>
                      </div>
                      {payment.notes && (
                        <p className="text-xs text-zinc-400 mt-2 italic">
                          {payment.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Email History Section */}
          <div className="px-6 py-4 border-b border-zinc-800">
            <h3 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
              <Mail className="w-4 h-4" aria-hidden="true" />
              Email History
            </h3>

            {loadingEmails ? (
              <div className="text-sm text-zinc-500">Loading...</div>
            ) : emailHistory && emailHistory.length > 0 ? (
              <div className="space-y-2">
                {emailHistory.map((email) => (
                  <div
                    key={email.id}
                    className="flex items-start justify-between p-3 bg-zinc-800/50 rounded-lg"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-1.5 rounded ${getEmailTypeBadgeColor(email.email_type)}`}>
                        {getEmailTypeIcon(email.email_type)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-zinc-200">
                          {getEmailTypeLabel(email.email_type)}
                        </div>
                        <div className="text-xs text-zinc-500">
                          Sent to: {email.sent_to}
                        </div>
                        {email.subject && (
                          <div className="text-xs text-zinc-500 mt-1 truncate max-w-[200px]">
                            {email.subject}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-zinc-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" aria-hidden="true" />
                      {formatEmailDate(email.sent_at)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-zinc-500 italic">No emails sent yet</div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-zinc-800 space-y-2">
          {canSend && (
            <button
              onClick={onSend}
              disabled={isSending}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" aria-hidden="true" />
                  Send Invoice
                </>
              )}
            </button>
          )}

          {/* Send Reminder button for outstanding invoices */}
          {canRemind && (
            <button
              onClick={handleSendReminder}
              disabled={sendingReminder}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {sendingReminder ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Sending...
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4" aria-hidden="true" />
                  Send Reminder
                </>
              )}
            </button>
          )}

          {/* Record Payment button for outstanding invoices */}
          {canRecordPayment && (
            <button
              onClick={openPaymentModal}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <DollarSign className="w-4 h-4" aria-hidden="true" />
              Record Payment
            </button>
          )}

          <button
            onClick={() => window.open(publicUrl, '_blank')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
          >
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
            View Public Invoice
          </button>

          {canEdit && (
            <button
              onClick={onEdit}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
            >
              <Edit2 className="w-4 h-4" aria-hidden="true" />
              Edit Invoice
            </button>
          )}

          <button
            onClick={() => {
              // TODO: Implement PDF download
              window.open(publicUrl + '?print=1', '_blank')
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Download PDF
          </button>

          {/* Void button for outstanding invoices */}
          {canVoid && (
            <button
              onClick={onVoid}
              disabled={isVoiding}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
            >
              {isVoiding ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Voiding...
                </>
              ) : (
                <>
                  <Ban className="w-4 h-4" aria-hidden="true" />
                  Void Invoice
                </>
              )}
            </button>
          )}

          {/* Delete button for drafts only */}
          {isDraft && (
            <button
              onClick={onDelete}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              Delete Draft
            </button>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-[60]"
            onClick={() => setShowPaymentModal(false)}
          />
          <div className="fixed inset-0 flex items-center justify-center z-[70] p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl w-full max-w-sm">
              <div className="px-6 py-4 border-b border-zinc-800">
                <h3 className="text-lg font-semibold text-white">Record Payment</h3>
                <p className="text-sm text-zinc-400 mt-1">
                  Balance Due: {formatCurrency(balanceDue)}
                </p>
              </div>

              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Payment Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full pl-8 pr-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="0.00"
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    Enter the full amount for complete payment, or a partial amount.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Notes <span className="text-zinc-500">(optional)</span>
                  </label>
                  <textarea
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                    placeholder="e.g., Partial payment via check #123"
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-zinc-800 flex gap-3">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRecordPayment}
                  disabled={recordingPayment || !paymentAmount}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {recordingPayment ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      Recording...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" aria-hidden="true" />
                      Record Payment
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}