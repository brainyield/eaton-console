import { useState, useEffect, useCallback } from 'react'
import { AccessibleModal } from './ui/AccessibleModal'
import { ModalFooter } from './ui/ModalFooter'
import { useFamilyMutations, useCheckMatchingLeads, useLeadMutations } from '../lib/hooks'
import type { CustomerStatus, MatchingLead } from '../lib/hooks'
import { formatNameLastFirst } from '../lib/utils'
import { AlertTriangle, UserCheck } from 'lucide-react'

interface InitialFamilyData {
  display_name?: string
  primary_email?: string
  primary_phone?: string
  primary_contact_name?: string
  status?: CustomerStatus
  notes?: string
}

interface AddFamilyModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (familyId: string) => void
  initialData?: InitialFamilyData
}

export function AddFamilyModal({ isOpen, onClose, onSuccess, initialData }: AddFamilyModalProps) {
  const [formData, setFormData] = useState({
    display_name: initialData?.display_name || '',
    primary_email: initialData?.primary_email || '',
    primary_phone: initialData?.primary_phone || '',
    primary_contact_name: initialData?.primary_contact_name || '',
    status: initialData?.status || 'trial' as CustomerStatus,
    payment_gateway: '',
    address_line1: '',
    city: '',
    state: 'FL',
    zip: '',
    notes: initialData?.notes || '',
  })
  const [error, setError] = useState<string | null>(null)
  const [matchingLeads, setMatchingLeads] = useState<MatchingLead[]>([])
  const [isConverting, setIsConverting] = useState(false)

  const { createFamily } = useFamilyMutations()
  const checkMatchingLeads = useCheckMatchingLeads()
  const { convertToCustomer } = useLeadMutations()

  // Update form when initialData changes (e.g., opening modal with lead data)
  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({
        ...prev,
        display_name: initialData.display_name || '',
        primary_email: initialData.primary_email || '',
        primary_phone: initialData.primary_phone || '',
        primary_contact_name: initialData.primary_contact_name || '',
        status: initialData.status || 'trial',
        notes: initialData.notes || '',
      }))
    }
  }, [initialData])

  // Reset matching leads when modal closes
  useEffect(() => {
    if (!isOpen) {
      setMatchingLeads([])
      setError(null)
    }
  }, [isOpen])

  // Debounced check for matching leads
  const checkForMatches = useCallback(async (email: string, name: string) => {
    if (!email.trim() && !name.trim()) {
      setMatchingLeads([])
      return
    }

    try {
      const matches = await checkMatchingLeads.mutateAsync({
        email: email.trim() || undefined,
        name: name.trim() || undefined,
      })
      setMatchingLeads(matches)
    } catch {
      // Silently fail - this is just a helpful warning
      setMatchingLeads([])
    }
  }, [checkMatchingLeads])

  // Debounce the check
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForMatches(formData.primary_email, formData.display_name)
    }, 500)

    return () => clearTimeout(timer)
  }, [formData.primary_email, formData.display_name, checkForMatches])

  const handleConvertLead = async (lead: MatchingLead) => {
    setIsConverting(true)
    setError(null)

    try {
      await convertToCustomer.mutateAsync({
        familyId: lead.id,
        targetStatus: formData.status,
      })
      onSuccess?.(lead.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to convert lead')
    } finally {
      setIsConverting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.display_name.trim()) {
      setError('Family name is required')
      return
    }

    createFamily.mutate(
      {
        display_name: formatNameLastFirst(formData.display_name),
        primary_email: formData.primary_email.trim() || null,
        primary_phone: formData.primary_phone.trim() || null,
        primary_contact_name: formatNameLastFirst(formData.primary_contact_name) || null,
        status: formData.status,
        payment_gateway: formData.payment_gateway || null,
        address_line1: formData.address_line1.trim() || null,
        city: formData.city.trim() || null,
        state: formData.state || null,
        zip: formData.zip.trim() || null,
        notes: formData.notes.trim() || null,
      },
      {
        onSuccess: (createdFamily) => {
          // Reset form
          setFormData({
            display_name: '',
            primary_email: '',
            primary_phone: '',
            primary_contact_name: '',
            status: 'trial',
            payment_gateway: '',
            address_line1: '',
            city: '',
            state: 'FL',
            zip: '',
            notes: '',
          })
          setMatchingLeads([])
          onSuccess?.(createdFamily.id)
          onClose()
        },
        onError: (err: Error & { code?: string }) => {
          if (err.code === '23505') {
            setError('A family with this email already exists')
          } else {
            setError(err.message || 'Failed to create family')
          }
        },
      }
    )
  }

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Family"
      size="2xl"
    >
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-2 rounded" role="alert">
            {error}
          </div>
        )}

        {/* Warning: Matching leads found */}
        {matchingLeads.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500 rounded-lg p-4" role="alert">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-amber-500 font-medium mb-2">
                  Potential matching lead{matchingLeads.length > 1 ? 's' : ''} found
                </p>
                <p className="text-sm text-zinc-400 mb-3">
                  This person may already exist as a lead. Consider converting the lead instead of creating a duplicate.
                </p>
                <div className="space-y-2">
                  {matchingLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="flex items-center justify-between bg-zinc-800/50 rounded px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-zinc-200 truncate">
                          {lead.display_name || 'Unknown'}
                        </div>
                        <div className="text-xs text-zinc-500 truncate">
                          {lead.primary_email || lead.primary_phone || 'No contact info'}
                          {' · '}
                          <span className="capitalize">{lead.lead_status}</span> lead
                          {lead.lead_type && ` · ${lead.lead_type.replace('_', ' ')}`}
                          {' · '}
                          Matched by {lead.match_type}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleConvertLead(lead)}
                        disabled={isConverting}
                        className="ml-3 flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-green-800 text-white text-sm rounded transition-colors"
                      >
                        <UserCheck className="w-4 h-4" />
                        {isConverting ? 'Converting...' : 'Convert'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label htmlFor="family-name" className="block text-sm font-medium text-zinc-400 mb-1">
              Family Name *
            </label>
            <input
              id="family-name"
              type="text"
              value={formData.display_name}
              onChange={(e) =>
                setFormData({ ...formData, display_name: e.target.value })
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Last, First (e.g., Smith, John)"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="primary-contact" className="block text-sm font-medium text-zinc-400 mb-1">
              Primary Contact Name
            </label>
            <input
              id="primary-contact"
              type="text"
              value={formData.primary_contact_name}
              onChange={(e) =>
                setFormData({ ...formData, primary_contact_name: e.target.value })
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="family-status" className="block text-sm font-medium text-zinc-400 mb-1">
              Status
            </label>
            <select
              id="family-status"
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value as CustomerStatus })
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="trial">Trial</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="churned">Churned</option>
            </select>
          </div>

          <div>
            <label htmlFor="family-email" className="block text-sm font-medium text-zinc-400 mb-1">
              Email
            </label>
            <input
              id="family-email"
              type="email"
              value={formData.primary_email}
              onChange={(e) =>
                setFormData({ ...formData, primary_email: e.target.value })
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="family-phone" className="block text-sm font-medium text-zinc-400 mb-1">
              Phone
            </label>
            <input
              id="family-phone"
              type="tel"
              value={formData.primary_phone}
              onChange={(e) =>
                setFormData({ ...formData, primary_phone: e.target.value })
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="payment-method" className="block text-sm font-medium text-zinc-400 mb-1">
              Payment Method
            </label>
            <select
              id="payment-method"
              value={formData.payment_gateway}
              onChange={(e) =>
                setFormData({ ...formData, payment_gateway: e.target.value })
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select...</option>
              <option value="StepUp">StepUp</option>
              <option value="Zelle">Zelle</option>
              <option value="Cash">Cash</option>
              <option value="Check">Check</option>
              <option value="Stripe">Stripe</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </div>

          <div className="col-span-2">
            <label htmlFor="address" className="block text-sm font-medium text-zinc-400 mb-1">
              Address
            </label>
            <input
              id="address"
              type="text"
              value={formData.address_line1}
              onChange={(e) =>
                setFormData({ ...formData, address_line1: e.target.value })
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Street address"
            />
          </div>

          <div>
            <label htmlFor="city" className="block text-sm font-medium text-zinc-400 mb-1">
              City
            </label>
            <input
              id="city"
              type="text"
              value={formData.city}
              onChange={(e) =>
                setFormData({ ...formData, city: e.target.value })
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="state" className="block text-sm font-medium text-zinc-400 mb-1">
                State
              </label>
              <input
                id="state"
                type="text"
                value={formData.state}
                onChange={(e) =>
                  setFormData({ ...formData, state: e.target.value })
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="zip" className="block text-sm font-medium text-zinc-400 mb-1">
                ZIP
              </label>
              <input
                id="zip"
                type="text"
                value={formData.zip}
                onChange={(e) =>
                  setFormData({ ...formData, zip: e.target.value })
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="col-span-2">
            <label htmlFor="family-notes" className="block text-sm font-medium text-zinc-400 mb-1">
              Notes
            </label>
            <textarea
              id="family-notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <ModalFooter
          onCancel={onClose}
          isSubmitting={createFamily.isPending || isConverting}
          submitText={matchingLeads.length > 0 ? 'Create Anyway' : 'Add Family'}
          loadingText="Creating..."
        />
      </form>
    </AccessibleModal>
  )
}
