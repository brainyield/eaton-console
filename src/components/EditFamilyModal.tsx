import { useState, useEffect } from 'react'
import { useFamilyMutations } from '../lib/hooks'
import type { Family, CustomerStatus } from '../lib/hooks'
import { formatNameLastFirst } from '../lib/utils'
import { AccessibleModal, ConfirmationModal } from './ui/AccessibleModal'
import { ModalFooter } from './ui/ModalFooter'

interface EditFamilyModalProps {
  isOpen: boolean
  onClose: () => void
  family: Family | null
  onSuccess?: () => void
}

export function EditFamilyModal({ isOpen, onClose, family, onSuccess }: EditFamilyModalProps) {
  const [formData, setFormData] = useState({
    display_name: '',
    primary_email: '',
    primary_phone: '',
    primary_contact_name: '',
    status: 'active' as CustomerStatus,
    payment_gateway: '',
    address_line1: '',
    city: '',
    state: 'FL',
    zip: '',
    notes: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const { updateFamily, deleteFamily } = useFamilyMutations()

  // Populate form when family changes
  useEffect(() => {
    if (family) {
      setFormData({
        display_name: family.display_name || '',
        primary_email: family.primary_email || '',
        primary_phone: family.primary_phone || '',
        primary_contact_name: family.primary_contact_name || '',
        status: family.status,
        payment_gateway: family.payment_gateway || '',
        address_line1: family.address_line1 || '',
        city: family.city || '',
        state: family.state || 'FL',
        zip: family.zip || '',
        notes: family.notes || '',
      })
    }
  }, [family])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!family) return
    setError(null)

    if (!formData.display_name.trim()) {
      setError('Family name is required')
      return
    }

    updateFamily.mutate(
      {
        id: family.id,
        data: {
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
      },
      {
        onSuccess: () => {
          onSuccess?.()
          onClose()
        },
        onError: (err: Error & { code?: string }) => {
          if (err.code === '23505') {
            setError('A family with this email already exists')
          } else {
            setError(err.message || 'Failed to update family')
          }
        },
      }
    )
  }

  const handleDelete = () => {
    if (!family) return

    deleteFamily.mutate(family.id, {
      onSuccess: () => {
        setShowDeleteConfirm(false)
        onSuccess?.()
        onClose()
      },
      onError: (err: Error & { code?: string }) => {
        if (err.code === '23503') {
          setError('Cannot delete family with existing students or invoices')
        } else {
          setError(err.message || 'Failed to delete family')
        }
        setShowDeleteConfirm(false)
      },
    })
  }

  if (!family) return null

  return (
    <>
      <AccessibleModal
        isOpen={isOpen}
        onClose={onClose}
        title="Edit Family"
        size="2xl"
      >
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div role="alert" className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-2 rounded">
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
                autoFocus
                value={formData.display_name}
                onChange={(e) =>
                  setFormData({ ...formData, display_name: e.target.value })
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
                placeholder="Last, First (e.g., Smith, John)"
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
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-zinc-400 mb-1">
                Status
              </label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as CustomerStatus })
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
              >
                <option value="trial">Trial</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="churned">Churned</option>
              </select>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-400 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={formData.primary_email}
                onChange={(e) =>
                  setFormData({ ...formData, primary_email: e.target.value })
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-zinc-400 mb-1">
                Phone
              </label>
              <input
                id="phone"
                type="tel"
                value={formData.primary_phone}
                onChange={(e) =>
                  setFormData({ ...formData, primary_phone: e.target.value })
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
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
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
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
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
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
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
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
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
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
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="col-span-2">
              <label htmlFor="notes" className="block text-sm font-medium text-zinc-400 mb-1">
                Notes
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <ModalFooter
            onCancel={onClose}
            isSubmitting={updateFamily.isPending}
            submitText="Save Changes"
            loadingText="Saving..."
            deleteConfig={{
              onDelete: () => setShowDeleteConfirm(true),
              text: 'Delete Family',
            }}
          />
        </form>
      </AccessibleModal>

      {/* Delete Confirmation Dialog */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Family?"
        description={`This will permanently delete ${family.display_name} and cannot be undone. Any associated students, enrollments, and invoices must be deleted first.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleteFamily.isPending}
      />
    </>
  )
}
