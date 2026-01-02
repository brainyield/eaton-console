import { useState, useEffect } from 'react'
import {
  X,
  Plus,
  Trash2,
  Save,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { useInvoiceMutations } from '../lib/hooks'
import type { InvoiceWithDetails } from '../lib/hooks'
import { multiplyMoney, sumMoney } from '../lib/moneyUtils'
import { parsePositiveFloat, isValidDateRange } from '../lib/validation'
import { useToast } from '../lib/toast'

// ============================================================================
// Types
// ============================================================================

interface Props {
  invoice: InvoiceWithDetails
  onClose: () => void
  onSuccess: () => void
}

interface LineItemEdit {
  id?: string
  description: string
  quantity: number
  unit_price: number
  amount: number
  isNew?: boolean
  isDeleted?: boolean
}

// ============================================================================
// Component
// ============================================================================

export default function EditInvoiceModal({ invoice, onClose, onSuccess }: Props) {
  const { showError, showWarning } = useToast()

  // State
  const [invoiceDate, setInvoiceDate] = useState(invoice.invoice_date || '')
  const [dueDate, setDueDate] = useState(invoice.due_date || '')
  const [periodStart, setPeriodStart] = useState(invoice.period_start || '')
  const [periodEnd, setPeriodEnd] = useState(invoice.period_end || '')
  const [notes, setNotes] = useState(invoice.notes || '')
  const [lineItems, setLineItems] = useState<LineItemEdit[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const { updateInvoice, updateLineItem } = useInvoiceMutations()

  // Initialize line items from invoice
  useEffect(() => {
    const items = (invoice.line_items || []).map(item => ({
      id: item.id,
      description: item.description || '',
      quantity: item.quantity || 1,
      unit_price: item.unit_price || 0,
      amount: item.amount || 0,
    }))
    setLineItems(items)
  }, [invoice.line_items])

  // Calculate total
  const subtotal = sumMoney(
    lineItems.filter(item => !item.isDeleted).map(item => item.amount)
  )

  // Update amount when quantity or unit_price changes
  const updateLineItemAmount = (index: number, field: 'quantity' | 'unit_price', valueStr: string) => {
    // Parse and validate - allow 0 but not negative
    const value = parsePositiveFloat(valueStr) ?? 0
    setValidationError(null) // Clear validation error on input change

    setLineItems(prev => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        [field]: value,
        amount: field === 'quantity'
          ? multiplyMoney(value, updated[index].unit_price)
          : multiplyMoney(updated[index].quantity, value),
      }
      return updated
    })
  }

  // Update description
  const updateLineItemDescription = (index: number, description: string) => {
    setLineItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], description }
      return updated
    })
  }

  // Update amount directly (override calculated)
  const updateLineItemAmountDirect = (index: number, amountStr: string) => {
    // Parse and validate - allow 0 but not negative
    const amount = parsePositiveFloat(amountStr) ?? 0
    setValidationError(null) // Clear validation error on input change

    setLineItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], amount }
      return updated
    })
  }

  // Add new line item
  const addLineItem = () => {
    setLineItems(prev => [
      ...prev,
      {
        description: '',
        quantity: 1,
        unit_price: 0,
        amount: 0,
        isNew: true,
      },
    ])
  }

  // Remove line item
  const removeLineItem = (index: number) => {
    setLineItems(prev => {
      const updated = [...prev]
      if (updated[index].id) {
        // Existing item - mark as deleted
        updated[index] = { ...updated[index], isDeleted: true }
      } else {
        // New item - remove from array
        updated.splice(index, 1)
      }
      return updated
    })
  }

  // Save changes with error tracking and partial failure handling
  const handleSave = async () => {
    setValidationError(null)

    // Validate date ranges
    if (invoiceDate && dueDate && !isValidDateRange(invoiceDate, dueDate)) {
      setValidationError('Invoice date must be before or equal to due date')
      return
    }

    if (periodStart && periodEnd && !isValidDateRange(periodStart, periodEnd)) {
      setValidationError('Period start date must be before or equal to period end date')
      return
    }

    // Validate line items have no negative amounts
    const activeItems = lineItems.filter(item => !item.isDeleted)
    const hasNegativeAmount = activeItems.some(item => item.amount < 0 || item.quantity < 0 || item.unit_price < 0)
    if (hasNegativeAmount) {
      setValidationError('Line item amounts, quantities, and prices must be positive')
      return
    }

    // Validate at least one line item if not all deleted
    if (activeItems.length === 0 && lineItems.some(item => item.id)) {
      setValidationError('Invoice must have at least one line item')
      return
    }

    setIsSaving(true)
    const errors: string[] = []
    let invoiceUpdated = false

    try {
      // Update invoice details first
      await updateInvoice.mutateAsync({
        id: invoice.id,
        data: {
          invoice_date: invoiceDate,
          due_date: dueDate,
          period_start: periodStart,
          period_end: periodEnd,
          notes: notes.trim(),
          subtotal,
          total_amount: subtotal,
        },
      })
      invoiceUpdated = true

      // Update line items with individual error tracking
      const lineItemsToUpdate = lineItems.filter(item => item.id && !item.isDeleted && !item.isNew)

      for (const item of lineItemsToUpdate) {
        try {
          await updateLineItem.mutateAsync({
            id: item.id!,
            data: {
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              amount: item.amount,
            },
          })
        } catch (err) {
          errors.push(`Failed to update line item: ${item.description || item.id}`)
          console.error(`Failed to update line item ${item.id}:`, err)
        }
      }

      // Handle new items (log for now - would need createLineItem mutation)
      const newItems = lineItems.filter(item => item.isNew && !item.isDeleted)
      if (newItems.length > 0) {
        console.log('New items to create:', newItems)
      }

      // Handle deleted items (log for now - would need deleteLineItem mutation)
      const deletedItems = lineItems.filter(item => item.isDeleted && item.id)
      if (deletedItems.length > 0) {
        console.log('Items to delete:', deletedItems)
      }

      // Report results
      if (errors.length > 0) {
        showWarning(`Invoice saved with ${errors.length} error(s). Please review and retry failed items.`)
      } else {
        onSuccess()
      }
    } catch (error) {
      console.error('Failed to save invoice:', error)
      if (invoiceUpdated) {
        showError('Invoice header was saved but line items could not be updated. Please try again.')
      } else {
        showError(error instanceof Error ? error.message : 'Failed to save changes')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/60" onClick={onClose} />

        {/* Modal */}
        <div className="relative bg-zinc-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700">
            <h2 className="text-xl font-semibold text-white">
              Edit Invoice {invoice.invoice_number}
            </h2>
            <button
              onClick={onClose}
              className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">
                  Invoice Date
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={e => setInvoiceDate(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-zinc-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-zinc-500"
                />
              </div>
            </div>

            {/* Period */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">
                  Period Start
                </label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={e => setPeriodStart(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-zinc-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">
                  Period End
                </label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={e => setPeriodEnd(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-zinc-500"
                />
              </div>
            </div>

            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-zinc-400">
                  Line Items
                </label>
                <button
                  onClick={addLineItem}
                  className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </button>
              </div>

              <div className="space-y-3">
                {lineItems.map((item, index) => (
                  !item.isDeleted && (
                    <div
                      key={item.id || `new-${index}`}
                      className="bg-zinc-800/50 rounded-lg p-4 space-y-3"
                    >
                      {/* Description */}
                      <div>
                        <input
                          type="text"
                          value={item.description}
                          onChange={e => updateLineItemDescription(index, e.target.value)}
                          placeholder="Description"
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                        />
                      </div>

                      {/* Quantity, Rate, Amount */}
                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs text-zinc-500 mb-1">Quantity</label>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={item.quantity}
                            onChange={e => updateLineItemAmount(index, 'quantity', e.target.value)}
                            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-zinc-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-500 mb-1">Unit Price</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unit_price}
                            onChange={e => updateLineItemAmount(index, 'unit_price', e.target.value)}
                            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-zinc-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-500 mb-1">Amount</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.amount}
                            onChange={e => updateLineItemAmountDirect(index, e.target.value)}
                            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-zinc-500"
                          />
                        </div>
                        <div className="flex items-end">
                          <button
                            onClick={() => removeLineItem(index)}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                ))}

                {lineItems.filter(i => !i.isDeleted).length === 0 && (
                  <div className="text-center text-zinc-500 py-8">
                    No line items. Click "Add Item" to add one.
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Invoice notes (visible to customer)"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 resize-none"
              />
            </div>

            {/* Validation Error */}
            {validationError && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {validationError}
              </div>
            )}

            {/* Total */}
            <div className="flex justify-between items-center pt-4 border-t border-zinc-700">
              <span className="text-lg font-medium text-zinc-400">Total</span>
              <span className="text-2xl font-bold text-white">
                {formatCurrency(subtotal)}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-zinc-700 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}