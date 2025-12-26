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
} from 'lucide-react'
import type { InvoiceWithDetails } from '../lib/hooks'

// ============================================================================
// Types
// ============================================================================

interface Props {
  invoice: InvoiceWithDetails
  onClose: () => void
  onEdit: () => void
  onSend: () => void
  onDelete: () => void
  isSending?: boolean
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
// Component
// ============================================================================

export default function InvoiceDetailPanel({
  invoice,
  onClose,
  onEdit,
  onSend,
  onDelete,
  isSending = false,
}: Props) {
  const statusConfig = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.draft

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '-'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatPeriod = (start: string | null, end: string | null) => {
    if (!start || !end) return '-'
    const s = new Date(start)
    const e = new Date(end)
    return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  }

  const publicUrl = `${window.location.origin}/invoice/${invoice.public_id}`

  const isDraft = invoice.status === 'draft'
  const canSend = isDraft && invoice.family?.primary_email

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
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Family Info */}
          <div className="px-6 py-4 border-b border-zinc-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                <User className="w-5 h-5 text-zinc-400" />
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
                <Phone className="w-4 h-4" />
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
                  {new Date(invoice.sent_at).toLocaleDateString('en-US', {
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
                    <span className="text-white font-medium">
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
              <span className="text-white">{formatCurrency(invoice.subtotal)}</span>
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
                (invoice.balance_due || 0) > 0 ? 'text-amber-400' : 'text-green-400'
              }`}>
                {formatCurrency(invoice.balance_due)}
              </span>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="px-6 py-4 border-b border-zinc-800">
              <h3 className="text-sm font-medium text-zinc-400 mb-2">Notes</h3>
              <p className="text-sm text-white">{invoice.notes}</p>
            </div>
          )}
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
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Invoice
                </>
              )}
            </button>
          )}

          <button
            onClick={() => window.open(publicUrl, '_blank')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            View Public Invoice
          </button>

          {isDraft && (
            <button
              onClick={onEdit}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
            >
              <Edit2 className="w-4 h-4" />
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
            <Download className="w-4 h-4" />
            Download PDF
          </button>

          {isDraft && (
            <button
              onClick={onDelete}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete Draft
            </button>
          )}
        </div>
      </div>
    </>
  )
}
