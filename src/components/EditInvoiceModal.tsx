import { useState, useEffect } from 'react'
import {
  X,
  Plus,
  Trash2,
  Save,
  Loader2,
} from 'lucide-react'
import { useInvoiceMutations } from '../lib/hooks'
import type { InvoiceWithDetails } from '../lib/hooks'

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
  // State
  const [invoiceDate, setInvoiceDate] = useState(invoice.invoice_date || '')
  const [dueDate, setDueDate] = useState(invoice.due_date || '')
  const [periodStart, setPeriodStart] = useState(invoice.period_start || '')
  const [periodEnd, setPeriodEnd] = useState(invoice.period_end || '')
  const [notes, setNotes] = useState(invoice.notes || '')
  const [lineItems, setLineItems] = useState<LineItemEdit[]>([])
  const [isSaving, setIsSaving] = useState(false)

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
  const subtotal = lineItems
    .filter(item => !item.isDeleted)
    .reduce((sum, item) => sum + item.amount, 0)

  // Update amount when quantity or unit_price changes
  const updateLineItemAmount = (index: number, field: 'quantity' | 'unit_price', value: number) => {
    setLineItems(prev => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        [field]: value,
        amount: field === 'quantity' 
          ? value * updated[index].unit_price
          : updated[index].quantity * value,
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
  const updateLineItemAmountDirect = (index: number, amount: number) => {
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

  // Save changes
  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Update invoice details - FIX: wrap fields in data object
      await updateInvoice.mutateAsync({
        id: invoice.id,
        data: {
          invoice_date: invoiceDate,
          due_date: dueDate,
          period_start: periodStart,
          period_end: periodEnd,
          notes,
          subtotal,
          total_amount: subtotal,
        },
      })

      // Update line items
      for (const item of lineItems) {
        if (item.isDeleted && item.id) {
          // Delete existing item
          // Note: Would need a deleteLineItem mutation - for now skip
          console.log('Would delete:', item.id)
        } else if (item.isNew) {
          // Create new item
          // Note: Would need a createLineItem mutation - for now skip
          console.log('Would create:', item)
        } else if (item.id) {
          // Update existing item - FIX: wrap fields in data object
          await updateLineItem.mutateAsync({
            id: item.id,
            data: {
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              amount: item.amount,
            },
          })
        }
      }

      onSuccess()
    } catch (error) {
      console.error('Failed to save invoice:', error)
      alert('Failed to save changes. Check console for details.')
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
                            value={item.quantity}
                            onChange={e => updateLineItemAmount(index, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-zinc-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-500 mb-1">Unit Price</label>
                          <input
                            type="number"
                            step="0.01"
                            value={item.unit_price}
                            onChange={e => updateLineItemAmount(index, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-zinc-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-500 mb-1">Amount</label>
                          <input
                            type="number"
                            step="0.01"
                            value={item.amount}
                            onChange={e => updateLineItemAmountDirect(index, parseFloat(e.target.value) || 0)}
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