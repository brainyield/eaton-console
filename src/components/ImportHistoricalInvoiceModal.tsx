import { useState, useMemo } from 'react'
import {
  X,
  Plus,
  Trash2,
  Upload,
  Loader2,
  Search,
  Check,
  History,
  AlertCircle,
} from 'lucide-react'
import { useFamiliesWithStudents, useInvoiceMutations } from '../lib/hooks'
import type { Family } from '../lib/hooks'
import { getTodayString } from '../lib/dateUtils'
import { multiplyMoney } from '../lib/moneyUtils'

// ============================================================================
// Types
// ============================================================================

interface Props {
  onClose: () => void
  onSuccess: () => void
}

interface LineItemInput {
  id: string
  description: string
  quantity: number
  unit_price: number
  amount: number
}

// ============================================================================
// Component
// ============================================================================

export default function ImportHistoricalInvoiceModal({ onClose, onSuccess }: Props) {
  // Family selection state
  const [familySearch, setFamilySearch] = useState('')
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null)
  const [showFamilyDropdown, setShowFamilyDropdown] = useState(false)

  // Invoice details state
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [notes, setNotes] = useState('')

  // Line items state
  const [lineItems, setLineItems] = useState<LineItemInput[]>([
    { id: crypto.randomUUID(), description: '', quantity: 1, unit_price: 0, amount: 0 }
  ])

  // Payment/status state
  const [markAsSent, setMarkAsSent] = useState(true)
  const [sentDate, setSentDate] = useState(getTodayString())
  const [amountPaid, setAmountPaid] = useState(0)
  const [paymentDate, setPaymentDate] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentReference, setPaymentReference] = useState('')

  // UI state
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Data fetching
  const { data: families = [] } = useFamiliesWithStudents()
  const { createHistoricalInvoice } = useInvoiceMutations()

  // Filtered families for search
  const filteredFamilies = useMemo(() => {
    if (!familySearch.trim()) return families.slice(0, 10)
    const q = familySearch.toLowerCase()
    return families.filter(f =>
      f.display_name.toLowerCase().includes(q) ||
      f.primary_email?.toLowerCase().includes(q)
    ).slice(0, 10)
  }, [families, familySearch])

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0)
  const balanceDue = subtotal - amountPaid

  // Determine invoice status based on amounts
  const computedStatus = useMemo(() => {
    if (!markAsSent) return 'draft'
    if (amountPaid >= subtotal && subtotal > 0) return 'paid'
    if (amountPaid > 0) return 'partial'
    // Check if overdue - compare dates at local midnight to avoid timezone issues
    if (dueDate) {
      const [year, month, day] = dueDate.split('-').map(Number)
      const due = new Date(year, month - 1, day)
      due.setHours(0, 0, 0, 0)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (due < today) return 'overdue'
    }
    return 'sent'
  }, [markAsSent, amountPaid, subtotal, dueDate])

  // Update line item amount when quantity or unit_price changes
  const updateLineItem = (id: string, field: keyof LineItemInput, value: string | number) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item
      
      const updated = { ...item, [field]: value }

      // Auto-calculate amount when quantity or unit_price changes
      if (field === 'quantity' || field === 'unit_price') {
        updated.amount = multiplyMoney(updated.quantity, updated.unit_price)
      }

      return updated
    }))
  }

  // Add new line item
  const addLineItem = () => {
    setLineItems(prev => [
      ...prev,
      { id: crypto.randomUUID(), description: '', quantity: 1, unit_price: 0, amount: 0 }
    ])
  }

  // Remove line item
  const removeLineItem = (id: string) => {
    if (lineItems.length === 1) return // Keep at least one
    setLineItems(prev => prev.filter(item => item.id !== id))
  }

  // Handle save
  const handleSave = async () => {
    setError(null)

    // Validation
    if (!selectedFamily) {
      setError('Please select a family')
      return
    }
    if (!invoiceDate) {
      setError('Please enter an invoice date')
      return
    }
    if (lineItems.every(item => !item.description || item.amount === 0)) {
      setError('Please add at least one line item with a description and amount')
      return
    }
    if (markAsSent && !sentDate) {
      setError('Please enter the date the invoice was originally sent')
      return
    }

    setIsSaving(true)

    try {
      await createHistoricalInvoice.mutateAsync({
        familyId: selectedFamily.id,
        invoiceNumber: invoiceNumber || null,
        invoiceDate,
        dueDate: dueDate || null,
        periodStart: periodStart || null,
        periodEnd: periodEnd || null,
        notes: notes || null,
        lineItems: lineItems.filter(item => item.description && item.amount > 0).map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.amount,
        })),
        subtotal,
        totalAmount: subtotal,
        amountPaid,
        status: computedStatus as 'draft' | 'sent' | 'paid' | 'partial' | 'overdue',
        sentAt: markAsSent ? new Date(`${sentDate}T12:00:00`).toISOString() : null,
        sentTo: markAsSent ? selectedFamily.primary_email : null,
        // Payment info (if amount paid > 0)
        payment: amountPaid > 0 ? {
          amount: amountPaid,
          paymentDate: paymentDate || invoiceDate,
          paymentMethod: paymentMethod || null,
          reference: paymentReference || null,
        } : null,
      })

      onSuccess()
    } catch (err) {
      console.error('Failed to create historical invoice:', err)
      setError(err instanceof Error ? err.message : 'Failed to create invoice')
    } finally {
      setIsSaving(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/60" onClick={onClose} />

        {/* Modal */}
        <div className="relative bg-zinc-900 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <History className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Import Historical Invoice
                </h2>
                <p className="text-sm text-zinc-400">
                  Import an invoice from your previous system (Wave/Google Sheets)
                </p>
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
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Family Selection */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Family <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                {selectedFamily ? (
                  <div className="flex items-center justify-between px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg">
                    <div>
                      <div className="text-white font-medium">{selectedFamily.display_name}</div>
                      <div className="text-sm text-zinc-400">{selectedFamily.primary_email}</div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedFamily(null)
                        setFamilySearch('')
                      }}
                      className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="text"
                      value={familySearch}
                      onChange={e => {
                        setFamilySearch(e.target.value)
                        setShowFamilyDropdown(true)
                      }}
                      onFocus={() => setShowFamilyDropdown(true)}
                      placeholder="Search families..."
                      className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                    />
                    {showFamilyDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredFamilies.length === 0 ? (
                          <div className="px-4 py-3 text-zinc-500">No families found</div>
                        ) : (
                          filteredFamilies.map(family => (
                            <button
                              key={family.id}
                              onClick={() => {
                                setSelectedFamily(family)
                                setShowFamilyDropdown(false)
                                setFamilySearch('')
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-zinc-700 transition-colors"
                            >
                              <div className="text-white">{family.display_name}</div>
                              <div className="text-sm text-zinc-400">{family.primary_email}</div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Invoice Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">
                  Invoice Number
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={e => setInvoiceNumber(e.target.value)}
                  placeholder="e.g., WAVE-1234"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                />
                <p className="mt-1 text-xs text-zinc-500">Original invoice number from Wave</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">
                  Invoice Date <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={e => setInvoiceDate(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-zinc-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
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
              <div className="grid grid-cols-2 gap-2">
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
                {lineItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-zinc-800/50 rounded-lg p-4 space-y-3"
                  >
                    {/* Description */}
                    <div>
                      <input
                        type="text"
                        value={item.description}
                        onChange={e => updateLineItem(item.id, 'description', e.target.value)}
                        placeholder="Description (e.g., 'Academic Coaching - December 2024')"
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
                          onChange={e => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
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
                          onChange={e => updateLineItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
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
                          onChange={e => updateLineItem(item.id, 'amount', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-zinc-500"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          onClick={() => removeLineItem(item.id)}
                          disabled={lineItems.length === 1}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
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
                rows={2}
                placeholder="Optional notes (visible to customer on invoice page)"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 resize-none"
              />
            </div>

            {/* Send Status Section */}
            <div className="p-4 bg-zinc-800/50 rounded-lg space-y-4">
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={markAsSent}
                    onChange={e => setMarkAsSent(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
                <div>
                  <span className="text-white font-medium">Mark as already sent</span>
                  <p className="text-sm text-zinc-400">Invoice was already sent to the customer via Wave</p>
                </div>
              </div>

              {markAsSent && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1">
                      Original Send Date
                    </label>
                    <input
                      type="date"
                      value={sentDate}
                      onChange={e => setSentDate(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-zinc-500"
                    />
                  </div>
                  <div className="flex items-end">
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-400" />
                      <span className="text-zinc-400">
                        Will be sent to: <span className="text-white">{selectedFamily?.primary_email || '(select family)'}</span>
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Payment Section */}
            <div className="p-4 bg-zinc-800/50 rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-white font-medium">Payment Received</span>
                <span className="text-sm text-zinc-400">Record any payments already made</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">
                    Amount Paid
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amountPaid}
                    onChange={e => setAmountPaid(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-zinc-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              {amountPaid > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1">
                      Payment Method
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-zinc-500"
                    >
                      <option value="">Select method...</option>
                      <option value="Zelle">Zelle</option>
                      <option value="StepUp">StepUp</option>
                      <option value="Cash">Cash</option>
                      <option value="Check">Check</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1">
                      Reference/Confirmation
                    </label>
                    <input
                      type="text"
                      value={paymentReference}
                      onChange={e => setPaymentReference(e.target.value)}
                      placeholder="Optional"
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="p-4 bg-zinc-800 rounded-lg space-y-3">
              <div className="flex justify-between items-center text-zinc-400">
                <span>Subtotal</span>
                <span className="text-white">{formatCurrency(subtotal)}</span>
              </div>
              {amountPaid > 0 && (
                <div className="flex justify-between items-center text-zinc-400">
                  <span>Amount Paid</span>
                  <span className="text-green-400">- {formatCurrency(amountPaid)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-3 border-t border-zinc-700">
                <span className="text-lg font-medium text-zinc-400">Balance Due</span>
                <span className={`text-2xl font-bold ${balanceDue > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                  {formatCurrency(balanceDue)}
                </span>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <span className="text-sm text-zinc-400">Status:</span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  computedStatus === 'paid' ? 'bg-green-500/20 text-green-400' :
                  computedStatus === 'partial' ? 'bg-amber-500/20 text-amber-400' :
                  computedStatus === 'overdue' ? 'bg-red-500/20 text-red-400' :
                  computedStatus === 'sent' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-zinc-500/20 text-zinc-400'
                }`}>
                  {computedStatus.charAt(0).toUpperCase() + computedStatus.slice(1)}
                </span>
              </div>
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
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Import Invoice
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
