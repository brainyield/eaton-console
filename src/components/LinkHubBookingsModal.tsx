import { useState, useMemo } from 'react'
import { Search, UserPlus, Link2, Loader2, AlertTriangle, Check, ChevronRight } from 'lucide-react'
import { AccessibleModal } from './ui/AccessibleModal'
import {
  useFamilies,
  useFamilyMutations,
  useHubBookingMutations,
  type PendingHubSession,
} from '../lib/hooks'
import { formatNameLastFirst } from '../lib/utils'
import { useToast } from '../lib/toast'

interface LinkHubBookingsModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  unlinkedBookings: PendingHubSession[]
}

interface Invitee {
  key: string
  name: string
  email: string
  bookings: PendingHubSession[]
}

type Mode = 'list' | 'create' | 'search'

export function LinkHubBookingsModal({
  isOpen,
  onClose,
  onSuccess,
  unlinkedBookings,
}: LinkHubBookingsModalProps) {
  const { showError, showSuccess } = useToast()
  const [mode, setMode] = useState<Mode>('list')
  const [activeInviteeKey, setActiveInviteeKey] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null)
  const [isLinking, setIsLinking] = useState(false)
  const [linkedInvitees, setLinkedInvitees] = useState<Set<string>>(new Set())

  // Form state for creating new family
  const [formData, setFormData] = useState({
    display_name: '',
    primary_email: '',
    primary_contact_name: '',
  })

  const { createFamily } = useFamilyMutations()
  const { linkBookingsToFamily } = useHubBookingMutations()

  // Search for existing families
  const { data: families = [], isLoading: familiesLoading } = useFamilies({
    search: searchQuery,
    limit: 20,
  })

  // Get unique invitees from unlinked bookings
  const invitees = useMemo(() => {
    const map = new Map<string, Invitee>()

    unlinkedBookings.forEach(booking => {
      const key = booking.invitee_email?.toLowerCase() || `unknown-${booking.id}`
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: booking.family_name || 'Unknown',
          email: booking.invitee_email || '',
          bookings: [],
        })
      }
      map.get(key)!.bookings.push(booking)
    })

    return Array.from(map.values())
  }, [unlinkedBookings])

  // Get the active invitee
  const activeInvitee = invitees.find(p => p.key === activeInviteeKey)

  // Reset state when opening an invitee action
  const handleSelectInvitee = (invitee: Invitee, actionMode: 'create' | 'search') => {
    setActiveInviteeKey(invitee.key)
    setSearchQuery('')
    setSelectedFamilyId(null)
    if (actionMode === 'create') {
      setFormData({
        display_name: invitee.name,
        primary_email: invitee.email,
        primary_contact_name: invitee.name,
      })
    }
    setMode(actionMode)
  }

  // Go back to list
  const handleBackToList = () => {
    setMode('list')
    setActiveInviteeKey(null)
    setSearchQuery('')
    setSelectedFamilyId(null)
  }

  // Handle linking to existing family
  const handleLinkToFamily = async () => {
    if (!selectedFamilyId || !activeInvitee) return

    setIsLinking(true)
    try {
      const bookingIds = activeInvitee.bookings.map(b => b.id)
      await linkBookingsToFamily.mutateAsync({
        bookingIds,
        familyId: selectedFamilyId,
      })

      // Mark this invitee as linked
      setLinkedInvitees(prev => new Set([...prev, activeInvitee.key]))
      showSuccess(`Linked ${bookingIds.length} booking(s) for ${activeInvitee.name}`)

      // Go back to list to handle remaining invitees
      handleBackToList()

      // If all invitees are now linked, close the modal
      const remainingUnlinked = invitees.filter(i => !linkedInvitees.has(i.key) && i.key !== activeInvitee.key)
      if (remainingUnlinked.length === 0) {
        onSuccess()
        onClose()
      }
    } catch (error) {
      console.error('Failed to link bookings:', error)
      showError(error instanceof Error ? error.message : 'Failed to link bookings')
    } finally {
      setIsLinking(false)
    }
  }

  // Handle creating new family and linking
  const handleCreateAndLink = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.display_name.trim() || !activeInvitee) {
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
            payment_gateway: 'Calendly',
          },
          {
            onSuccess: resolve,
            onError: reject,
          }
        )
      })

      // Link the bookings to the new family
      const bookingIds = activeInvitee.bookings.map(b => b.id)
      await linkBookingsToFamily.mutateAsync({
        bookingIds,
        familyId: family.id,
      })

      // Mark this invitee as linked
      setLinkedInvitees(prev => new Set([...prev, activeInvitee.key]))
      showSuccess(`Created family and linked ${bookingIds.length} booking(s) for ${activeInvitee.name}`)

      // Go back to list to handle remaining invitees
      handleBackToList()

      // If all invitees are now linked, close the modal
      const remainingUnlinked = invitees.filter(i => !linkedInvitees.has(i.key) && i.key !== activeInvitee.key)
      if (remainingUnlinked.length === 0) {
        onSuccess()
        onClose()
      }
    } catch (error) {
      console.error('Failed to create family and link bookings:', error)
      showError(error instanceof Error ? error.message : 'Failed to create family')
    } finally {
      setIsLinking(false)
    }
  }

  // Calculate total for display
  const totalAmount = unlinkedBookings.reduce((sum, b) => sum + b.daily_rate, 0)

  // Count remaining unlinked invitees
  const remainingCount = invitees.filter(i => !linkedInvitees.has(i.key)).length

  const renderContent = () => {
    // Mode: List of invitees
    if (mode === 'list') {
      return (
        <div className="p-4 space-y-4">
          {/* Summary */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-amber-200 font-medium">
                  {remainingCount} invitee{remainingCount !== 1 ? 's' : ''} need{remainingCount === 1 ? 's' : ''} to be linked
                </p>
                <p className="text-sm text-amber-300/70 mt-1">
                  Link each invitee to a family to enable invoicing.
                </p>
              </div>
            </div>
          </div>

          {/* Invitee list */}
          <div className="space-y-2">
            {invitees.map(invitee => {
              const isLinked = linkedInvitees.has(invitee.key)
              const bookingTotal = invitee.bookings.reduce((sum, b) => sum + b.daily_rate, 0)

              return (
                <div
                  key={invitee.key}
                  className={`border rounded-lg overflow-hidden ${
                    isLinked
                      ? 'border-green-500/30 bg-green-500/5'
                      : 'border-zinc-700 bg-zinc-800/30'
                  }`}
                >
                  {/* Invitee header */}
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
                            {invitee.name}
                          </p>
                          <p className="text-sm text-zinc-400">{invitee.email || 'No email'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-zinc-400">
                          {invitee.bookings.length} session{invitee.bookings.length !== 1 ? 's' : ''}
                        </p>
                        <p className={`font-medium ${isLinked ? 'text-green-400' : 'text-green-400'}`}>
                          ${bookingTotal.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* Session details */}
                    <div className="mt-2 pt-2 border-t border-zinc-700/50">
                      <ul className="text-sm text-zinc-400 space-y-1">
                        {invitee.bookings.map(booking => (
                          <li key={booking.id} className="flex justify-between">
                            <span>{booking.student_name} - {new Date(booking.session_date).toLocaleDateString()}</span>
                            <span>${booking.daily_rate.toFixed(2)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Actions */}
                    {!isLinked && (
                      <div className="mt-3 pt-3 border-t border-zinc-700/50 flex gap-2">
                        <button
                          onClick={() => handleSelectInvitee(invitee, 'create')}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                        >
                          <UserPlus className="w-4 h-4" />
                          Create Family
                        </button>
                        <button
                          onClick={() => handleSelectInvitee(invitee, 'search')}
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
              {linkedInvitees.size > 0 ? 'Done' : 'Cancel'}
            </button>
          </div>
        </div>
      )
    }

    // Mode: Create new family for specific invitee
    if (mode === 'create' && activeInvitee) {
      return (
        <form onSubmit={handleCreateAndLink} className="p-4 space-y-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <button
              type="button"
              onClick={handleBackToList}
              className="hover:text-white transition-colors"
            >
              All Invitees
            </button>
            <ChevronRight className="w-4 h-4" />
            <span className="text-white">{activeInvitee.name}</span>
          </div>

          <p className="text-sm text-zinc-400">
            Create a new family for <span className="text-white font-medium">{activeInvitee.name}</span> and
            link their {activeInvitee.bookings.length} session(s).
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
              payment method <span className="text-blue-400">Calendly</span>
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

    // Mode: Search and link to existing family for specific invitee
    if (mode === 'search' && activeInvitee) {
      return (
        <div className="p-4 space-y-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <button
              type="button"
              onClick={handleBackToList}
              className="hover:text-white transition-colors"
            >
              All Invitees
            </button>
            <ChevronRight className="w-4 h-4" />
            <span className="text-white">{activeInvitee.name}</span>
          </div>

          <p className="text-sm text-zinc-400">
            Search for an existing family to link <span className="text-white font-medium">{activeInvitee.name}</span>'s
            {' '}{activeInvitee.bookings.length} session(s) to.
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
      title="Link Hub Sessions to Families"
      subtitle={`${unlinkedBookings.length} session(s) from ${invitees.length} invitee(s) • $${totalAmount.toFixed(2)}`}
      size="lg"
    >
      {renderContent()}
    </AccessibleModal>
  )
}
