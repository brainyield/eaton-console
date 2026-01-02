import { useState } from 'react'
import { X, RefreshCw, AlertCircle } from 'lucide-react'
import { useLeadMutations, type LeadWithFamily, type LeadType, type LeadStatus } from '../lib/hooks'
import { isValidEmail, parseIntInRange, isValidUrl } from '../lib/validation'

interface EditLeadModalProps {
  lead: LeadWithFamily
  onClose: () => void
}

export function EditLeadModal({ lead, onClose }: EditLeadModalProps) {
  const { updateLead } = useLeadMutations()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: lead.name || '',
    email: lead.email,
    phone: lead.phone || '',
    lead_type: lead.lead_type,
    status: lead.status,
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
      await updateLead.mutateAsync({
        id: lead.id,
        name: formData.name.trim() || null,
        email: trimmedEmail.toLowerCase(),
        phone: formData.phone.trim() || null,
        lead_type: formData.lead_type as LeadType,
        status: formData.status as LeadStatus,
        source_url: formData.source_url.trim() || null,
        num_children: numChildren,
        service_interest: formData.service_interest.trim() || null,
        notes: formData.notes.trim() || null,
      })
      onClose()
    } catch (err) {
      console.error('Failed to update lead:', err)
      setError(err instanceof Error ? err.message : 'Failed to update lead. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-white">Edit Lead</h2>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="Enter name"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Email *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="(555) 555-5555"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Number of Children
              </label>
              <input
                type="number"
                value={formData.num_children}
                onChange={(e) => setFormData({ ...formData, num_children: e.target.value })}
                min="0"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Lead Type
              </label>
              <select
                value={formData.lead_type}
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
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as LeadStatus })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="converted">Converted</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Service Interest
              </label>
              <input
                type="text"
                value={formData.service_interest}
                onChange={(e) => setFormData({ ...formData, service_interest: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="e.g., Tutoring, Hub Drop-off"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Source URL
              </label>
              <input
                type="url"
                value={formData.source_url}
                onChange={(e) => setFormData({ ...formData, source_url: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="https://..."
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
                placeholder="Add any notes..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.email}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
