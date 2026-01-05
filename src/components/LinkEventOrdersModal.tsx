import { useState, useMemo } from 'react'
import { Search, UserPlus, Link2, Loader2, AlertTriangle, Check, ChevronRight } from 'lucide-react'
import { AccessibleModal } from './ui/AccessibleModal'
import {
  useFamilies,
  useFamilyMutations,
  useEventOrderMutations,
  type PendingEventOrder,
} from '../lib/hooks'
import { formatNameLastFirst } from '../lib/utils'
import { useToast } from '../lib/toast'
import { centsToDollars } from '../lib/moneyUtils'

interface LinkEventOrdersModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  unlinkedOrders: PendingEventOrder[]
}

interface Purchaser {
  key: string
  name: string
  email: string
  orders: PendingEventOrder[]
}

type Mode = 'list' | 'create' | 'search'

export function LinkEventOrdersModal({
  isOpen,
  onClose,
  onSuccess,
  unlinkedOrders,
}: LinkEventOrdersModalProps) {
  const { showError, showSuccess } = useToast()
  const [mode, setMode] = useState<Mode>('list')
  const [activePurchaserKey, setActivePurchaserKey] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null)
  const [isLinking, setIsLinking] = useState(false)
  const [linkedPurchasers, setLinkedPurchasers] = useState<Set<string>>(new Set())

  // Form state for creating new family
  const [formData, setFormData] = useState({
    display_name: '',
    primary_email: '',
    primary_contact_name: '',
  })

  const { createFamily } = useFamilyMutations()
  const { linkOrdersToFamily } = useEventOrderMutations()

  // Search for existing families
  const { data: families = [], isLoading: familiesLoading } = useFamilies({
    search: searchQuery,
    limit: 20,
  })

  // Get unique purchasers from unlinked orders
  const purchasers = useMemo(() => {
    const map = new Map<string, Purchaser>()

    unlinkedOrders.forEach(order => {
      const key = order.purchaser_email?.toLowerCase() || `unknown-${order.id}`
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: order.purchaser_name || 'Unknown',
          email: order.purchaser_email || '',
          orders: [],
        })
      }
      map.get(key)!.orders.push(order)
    })

    return Array.from(map.values())
  }, [unlinkedOrders])

  // Get the active purchaser
  const activePurchaser = purchasers.find(p => p.key === activePurchaserKey)

  // Reset state when opening a purchaser action
  const handleSelectPurchaser = (purchaser: Purchaser, actionMode: 'create' | 'search') => {
    setActivePurchaserKey(purchaser.key)
    setSearchQuery('')
    setSelectedFamilyId(null)
    if (actionMode === 'create') {
      setFormData({
        display_name: purchaser.name,
        primary_email: purchaser.email,
        primary_contact_name: purchaser.name,
      })
    }
    setMode(actionMode)
  }

  // Go back to list
  const handleBackToList = () => {
    setMode('list')
    setActivePurchaserKey(null)
    setSearchQuery('')
    setSelectedFamilyId(null)
  }

  // Handle linking to existing family
  const handleLinkToFamily = async () => {
    if (!selectedFamilyId || !activePurchaser) return

    setIsLinking(true)
    try {
      const orderIds = activePurchaser.orders.map(o => o.id)
      await linkOrdersToFamily.mutateAsync({
        orderIds,
        familyId: selectedFamilyId,
      })

      // Mark this purchaser as linked
      setLinkedPurchasers(prev => new Set([...prev, activePurchaser.key]))
      showSuccess(`Linked ${orderIds.length} order(s) for ${activePurchaser.name}`)

      // Go back to list to handle remaining purchasers
      handleBackToList()

      // If all purchasers are now linked, close the modal
      const remainingUnlinked = purchasers.filter(p => !linkedPurchasers.has(p.key) && p.key !== activePurchaser.key)
      if (remainingUnlinked.length === 0) {
        onSuccess()
        onClose()
      }
    } catch (error) {
      console.error('Failed to link orders:', error)
      showError(error instanceof Error ? error.message : 'Failed to link orders')
    } finally {
      setIsLinking(false)
    }
  }

  // Handle creating new family and linking
  const handleCreateAndLink = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.display_name.trim() || !activePurchaser) {
      showError('Family name is required')
      return
    }

    setIsLinking(true)
    try {
      // Create the family
      const family = await new Promise<{ id: string }>((resolve, reject) => {
        createFamily.mutate(
          {
            display_name: formatNameLastFirst(formData.display_name),
            primary_email: formData.primary_email.trim() || null,
            primary_contact_name: formatNameLastFirst(formData.primary_contact_name) || null,
            status: 'active',
            payment_gateway: 'StepUp',
          },
          {
            onSuccess: resolve,
            onError: reject,
          }
        )
      })

      // Link the orders to the new family
      const orderIds = activePurchaser.orders.map(o => o.id)
      await linkOrdersToFamily.mutateAsync({
        orderIds,
        familyId: family.id,
      })

      // Mark this purchaser as linked
      setLinkedPurchasers(prev => new Set([...prev, activePurchaser.key]))
      showSuccess(`Created family and linked ${orderIds.length} order(s) for ${activePurchaser.name}`)

      // Go back to list to handle remaining purchasers
      handleBackToList()

      // If all purchasers are now linked, close the modal
      const remainingUnlinked = purchasers.filter(p => !linkedPurchasers.has(p.key) && p.key !== activePurchaser.key)
      if (remainingUnlinked.length === 0) {
        onSuccess()
        onClose()
      }
    } catch (error) {
      console.error('Failed to create family and link orders:', error)
      showError(error instanceof Error ? error.message : 'Failed to create family')
    } finally {
      setIsLinking(false)
    }
  }

  // Calculate total for display
  const totalAmount = centsToDollars(
    unlinkedOrders.reduce((sum, o) => sum + o.total_cents, 0)
  )

  // Count remaining unlinked purchasers
  const remainingCount = purchasers.filter(p => !linkedPurchasers.has(p.key)).length

  const renderContent = () => {
    // Mode: List of purchasers
    if (mode === 'list') {
      return (
        <div className="p-4 space-y-4">
          {/* Summary */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-amber-200 font-medium">
                  {remainingCount} purchaser{remainingCount !== 1 ? 's' : ''} need{remainingCount === 1 ? 's' : ''} to be linked
                </p>
                <p className="text-sm text-amber-300/70 mt-1">
                  Link each purchaser to a family to enable invoicing.
                </p>
              </div>
            </div>
          </div>

          {/* Purchaser list */}
          <div className="space-y-2">
            {purchasers.map(purchaser => {
              const isLinked = linkedPurchasers.has(purchaser.key)
              const orderTotal = centsToDollars(
                purchaser.orders.reduce((sum, o) => sum + o.total_cents, 0)
              )

              return (
                <div
                  key={purchaser.key}
                  className={`border rounded-lg overflow-hidden ${
                    isLinked
                      ? 'border-green-500/30 bg-green-500/5'
                      : 'border-zinc-700 bg-zinc-800/30'
                  }`}
                >
                  {/* Purchaser header */}
                  <div className="px-4 py-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        {isLinked && (
                          <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                        <div>
                          <p className={`font-medium ${isLinked ? 'text-green-300' : 'text-white'}`}>
                            {purchaser.name}
                          </p>
                          <p className="text-sm text-zinc-400">{purchaser.email || 'No email'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-zinc-400">
                          {purchaser.orders.length} order{purchaser.orders.length !== 1 ? 's' : ''}
                        </p>
                        <p className={`font-medium ${isLinked ? 'text-green-400' : 'text-green-400'}`}>
                          ${orderTotal.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* Order details */}
                    <div className="mt-2 pt-2 border-t border-zinc-700/50">
                      <ul className="text-sm text-zinc-400 space-y-1">
                        {purchaser.orders.map(order => (
                          <li key={order.id} className="flex justify-between">
                            <span>{order.event_title}</span>
                            <span>${(order.total_cents / 100).toFixed(2)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Actions */}
                    {!isLinked && (
                      <div className="mt-3 pt-3 border-t border-zinc-700/50 flex gap-2">
                        <button
                          onClick={() => handleSelectPurchaser(purchaser, 'create')}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                        >
                          <UserPlus className="w-4 h-4" />
                          Create Family
                        </button>
                        <button
                          onClick={() => handleSelectPurchaser(purchaser, 'search')}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                          <Link2 className="w-4 h-4" />
                          Link Existing
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="flex justify-end pt-4 border-t border-zinc-700">
            <button
              onClick={onClose}
              className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
            >
              {linkedPurchasers.size > 0 ? 'Done' : 'Cancel'}
            </button>
          </div>
        </div>
      )
    }

    // Mode: Create new family for specific purchaser
    if (mode === 'create' && activePurchaser) {
      return (
        <form onSubmit={handleCreateAndLink} className="p-4 space-y-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <button
              type="button"
              onClick={handleBackToList}
              className="hover:text-white transition-colors"
            >
              All Purchasers
            </button>
            <ChevronRight className="w-4 h-4" />
            <span className="text-white">{activePurchaser.name}</span>
          </div>

          <p className="text-sm text-zinc-400">
            Create a new family for <span className="text-white font-medium">{activePurchaser.name}</span> and
            link their {activePurchaser.orders.length} order(s).
          </p>

          <div className="space-y-3">
            <div>
              <label htmlFor="family-name" className="block text-sm font-medium text-zinc-400 mb-1">
                Family Name *
              </label>
              <input
                id="family-name"
                type="text"
                value={formData.display_name}
                onChange={e => setFormData({ ...formData, display_name: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
                placeholder="Last, First (e.g., Smith, John)"
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="primary-email" className="block text-sm font-medium text-zinc-400 mb-1">
                Email
              </label>
              <input
                id="primary-email"
                type="email"
                value={formData.primary_email}
                onChange={e => setFormData({ ...formData, primary_email: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="contact-name" className="block text-sm font-medium text-zinc-400 mb-1">
                Contact Name
              </label>
              <input
                id="contact-name"
                type="text"
                value={formData.primary_contact_name}
                onChange={e => setFormData({ ...formData, primary_contact_name: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="bg-zinc-800/50 rounded-lg p-3 text-sm">
            <p className="text-zinc-400">
              Will create family with status <span className="text-green-400">Active</span> and
              payment method <span className="text-blue-400">StepUp</span>
            </p>
          </div>

          <div className="flex justify-between pt-4 border-t border-zinc-700">
            <button
              type="button"
              onClick={handleBackToList}
              className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
              disabled={isLinking}
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isLinking || !formData.display_name.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isLinking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Create & Link
                </>
              )}
            </button>
          </div>
        </form>
      )
    }

    // Mode: Search and link to existing family for specific purchaser
    if (mode === 'search' && activePurchaser) {
      return (
        <div className="p-4 space-y-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <button
              type="button"
              onClick={handleBackToList}
              className="hover:text-white transition-colors"
            >
              All Purchasers
            </button>
            <ChevronRight className="w-4 h-4" />
            <span className="text-white">{activePurchaser.name}</span>
          </div>

          <p className="text-sm text-zinc-400">
            Search for an existing family to link <span className="text-white font-medium">{activePurchaser.name}</span>'s
            {' '}{activePurchaser.orders.length} order(s) to.
          </p>

          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>

          {/* Family list */}
          <div className="max-h-64 overflow-y-auto space-y-1">
            {familiesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
              </div>
            ) : families.length === 0 ? (
              <p className="text-center text-zinc-500 py-8">
                {searchQuery ? 'No families found' : 'Type to search for families'}
              </p>
            ) : (
              families.map(family => (
                <button
                  key={family.id}
                  onClick={() => setSelectedFamilyId(family.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    selectedFamilyId === family.id
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-zinc-800 text-zinc-300'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{family.display_name}</p>
                      <p className={`text-sm ${selectedFamilyId === family.id ? 'text-blue-200' : 'text-zinc-500'}`}>
                        {family.primary_email || 'No email'}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      family.status === 'active' ? 'bg-green-500/20 text-green-400' :
                      family.status === 'trial' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-zinc-500/20 text-zinc-400'
                    }`}>
                      {family.status}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="flex justify-between pt-4 border-t border-zinc-700">
            <button
              type="button"
              onClick={handleBackToList}
              className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
              disabled={isLinking}
            >
              Back
            </button>
            <button
              onClick={handleLinkToFamily}
              disabled={isLinking || !selectedFamilyId}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isLinking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Linking...
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4" />
                  Link to Family
                </>
              )}
            </button>
          </div>
        </div>
      )
    }

    return null
  }

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={onClose}
      title="Link Event Orders to Families"
      subtitle={`${unlinkedOrders.length} order(s) from ${purchasers.length} purchaser(s) • $${totalAmount.toFixed(2)}`}
      size="lg"
    >
      {renderContent()}
    </AccessibleModal>
  )
}
