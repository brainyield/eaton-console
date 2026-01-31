import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { useLeadMutations, type LeadFamily, type LeadType, type LeadStatus } from '../lib/hooks'
import { isValidEmail, parseIntInRange, isValidUrl } from '../lib/validation'
import { AccessibleModal } from './ui/AccessibleModal'
import { ModalFooter } from './ui/ModalFooter'

interface EditLeadModalProps {
  lead: LeadFamily
  onClose: () => void
}

export function EditLeadModal({ lead, onClose }: EditLeadModalProps) {
  const { updateLead, convertToCustomer } = useLeadMutations()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: lead.primary_contact_name || '',
    email: lead.primary_email || '',
    phone: lead.primary_phone || '',
    lead_type: lead.lead_type,
    lead_status: lead.lead_status || 'new' as LeadStatus,
    source_url: lead.source_url || '',
    num_children: lead.num_children?.toString() || '',
    service_interest: lead.service_interest || '',
    notes: lead.notes || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate required fields
    const trimmedEmail = formData.email.trim()
    if (!trimmedEmail) {
      setError('Email is required')
      return
    }

    // Validate email format
    if (!isValidEmail(trimmedEmail)) {
      setError('Please enter a valid email address')
      return
    }

    // Validate source URL if provided
    if (formData.source_url && !isValidUrl(formData.source_url)) {
      setError('Please enter a valid URL for the source')
      return
    }

    // Validate num_children if provided (must be positive integer, max 20)
    let numChildren: number | null = null
    if (formData.num_children) {
      numChildren = parseIntInRange(formData.num_children, 0, 20)
      if (numChildren === null) {
        setError('Number of children must be between 0 and 20')
        return
      }
    }

    setIsSubmitting(true)

    try {
      // If status is changing to 'converted', use convertToCustomer which also sets status='active'
      if (formData.lead_status === 'converted' && lead.lead_status !== 'converted') {
        // First update the other fields
        await updateLead.mutateAsync({
          id: lead.id,
          primary_contact_name: formData.name.trim() || null,
          primary_email: trimmedEmail.toLowerCase(),
          primary_phone: formData.phone.trim() || null,
          lead_type: formData.lead_type as LeadType,
          source_url: formData.source_url.trim() || null,
          num_children: numChildren,
          service_interest: formData.service_interest.trim() || null,
          notes: formData.notes.trim() || null,
        })
        // Then convert to customer (sets status='active' and lead_status='converted')
        await convertToCustomer.mutateAsync({ familyId: lead.id })
      } else {
        await updateLead.mutateAsync({
          id: lead.id,
          primary_contact_name: formData.name.trim() || null,
          primary_email: trimmedEmail.toLowerCase(),
          primary_phone: formData.phone.trim() || null,
          lead_type: formData.lead_type as LeadType,
          lead_status: formData.lead_status as LeadStatus,
          source_url: formData.source_url.trim() || null,
          num_children: numChildren,
          service_interest: formData.service_interest.trim() || null,
          notes: formData.notes.trim() || null,
        })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update lead. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AccessibleModal
      isOpen={true}
      onClose={onClose}
      title="Edit Lead"
      size="lg"
    >
      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && (
          <div role="alert" className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label htmlFor="lead-name" className="block text-sm font-medium text-zinc-400 mb-1">
              Name
            </label>
            <input
              id="lead-name"
              type="text"
              autoFocus
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="Enter name"
            />
          </div>

          <div className="col-span-2">
            <label htmlFor="lead-email" className="block text-sm font-medium text-zinc-400 mb-1">
              Email *
            </label>
            <input
              id="lead-email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="lead-phone" className="block text-sm font-medium text-zinc-400 mb-1">
              Phone
            </label>
            <input
              id="lead-phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="(555) 555-5555"
            />
          </div>

          <div>
            <label htmlFor="num-children" className="block text-sm font-medium text-zinc-400 mb-1">
              Number of Children
            </label>
            <input
              id="num-children"
              type="number"
              value={formData.num_children}
              onChange={(e) => setFormData({ ...formData, num_children: e.target.value })}
              min="0"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="lead-type" className="block text-sm font-medium text-zinc-400 mb-1">
              Lead Type
            </label>
            <select
              id="lead-type"
              value={formData.lead_type || ''}
              onChange={(e) => setFormData({ ...formData, lead_type: e.target.value as LeadType })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="exit_intent">Exit Intent</option>
              <option value="waitlist">Waitlist</option>
              <option value="calendly_call">Calendly</option>
              <option value="event">Event</option>
            </select>
          </div>

          <div>
            <label htmlFor="lead-status" className="block text-sm font-medium text-zinc-400 mb-1">
              Status
            </label>
            <select
              id="lead-status"
              value={formData.lead_status}
              onChange={(e) => setFormData({ ...formData, lead_status: e.target.value as LeadStatus })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="converted">Converted</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div className="col-span-2">
            <label htmlFor="service-interest" className="block text-sm font-medium text-zinc-400 mb-1">
              Service Interest
            </label>
            <input
              id="service-interest"
              type="text"
              value={formData.service_interest}
              onChange={(e) => setFormData({ ...formData, service_interest: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="e.g., Tutoring, Hub Drop-off"
            />
          </div>

          <div className="col-span-2">
            <label htmlFor="source-url" className="block text-sm font-medium text-zinc-400 mb-1">
              Source URL
            </label>
            <input
              id="source-url"
              type="url"
              value={formData.source_url}
              onChange={(e) => setFormData({ ...formData, source_url: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="https://..."
            />
          </div>

          <div className="col-span-2">
            <label htmlFor="lead-notes" className="block text-sm font-medium text-zinc-400 mb-1">
              Notes
            </label>
            <textarea
              id="lead-notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
              placeholder="Add any notes..."
            />
          </div>
        </div>

        <ModalFooter
          onCancel={onClose}
          isSubmitting={isSubmitting}
          submitDisabled={!formData.email}
          submitText="Save Changes"
          loadingText="Saving..."
        />
      </form>
    </AccessibleModal>
  )
}
