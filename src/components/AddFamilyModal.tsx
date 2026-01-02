import { useState, useEffect } from 'react'
import { AccessibleModal } from './ui/AccessibleModal'
import { useFamilyMutations } from '../lib/hooks'
import type { CustomerStatus } from '../lib/hooks'
import { formatNameLastFirst } from '../lib/utils'

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
    status: initialData?.status || 'lead' as CustomerStatus,
    payment_gateway: '',
    address_line1: '',
    city: '',
    state: 'FL',
    zip: '',
    notes: initialData?.notes || '',
  })
  const [error, setError] = useState<string | null>(null)

  const { createFamily } = useFamilyMutations()

  // Update form when initialData changes (e.g., opening modal with lead data)
  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({
        ...prev,
        display_name: initialData.display_name || '',
        primary_email: initialData.primary_email || '',
        primary_phone: initialData.primary_phone || '',
        primary_contact_name: initialData.primary_contact_name || '',
        status: initialData.status || 'lead',
        notes: initialData.notes || '',
      }))
    }
  }, [initialData])

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
            status: 'lead',
            payment_gateway: '',
            address_line1: '',
            city: '',
            state: 'FL',
            zip: '',
            notes: '',
          })
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
              <option value="lead">Lead</option>
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

        <div className="flex justify-end gap-2 pt-4 border-t border-zinc-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createFamily.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {createFamily.isPending ? 'Creating...' : 'Add Family'}
          </button>
        </div>
      </form>
    </AccessibleModal>
  )
}
