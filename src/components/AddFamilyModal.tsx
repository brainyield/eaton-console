import { useState } from 'react'
import { X } from 'lucide-react'
import { useFamilyMutations } from '../lib/hooks'
import type { CustomerStatus } from '../lib/hooks'

interface AddFamilyModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function AddFamilyModal({ isOpen, onClose, onSuccess }: AddFamilyModalProps) {
  const [formData, setFormData] = useState({
    display_name: '',
    primary_email: '',
    primary_phone: '',
    primary_contact_name: '',
    status: 'lead' as CustomerStatus,
    payment_gateway: '',
    address_line1: '',
    city: '',
    state: 'FL',
    zip: '',
    notes: '',
  })
  const [error, setError] = useState<string | null>(null)

  const { createFamily } = useFamilyMutations()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.display_name.trim()) {
      setError('Family name is required')
      return
    }

    createFamily.mutate(
      {
        display_name: formData.display_name.trim(),
        primary_email: formData.primary_email.trim() || null,
        primary_phone: formData.primary_phone.trim() || null,
        primary_contact_name: formData.primary_contact_name.trim() || null,
        status: formData.status,
        payment_gateway: formData.payment_gateway || null,
        address_line1: formData.address_line1.trim() || null,
        city: formData.city.trim() || null,
        state: formData.state || null,
        zip: formData.zip.trim() || null,
        notes: formData.notes.trim() || null,
      },
      {
        onSuccess: () => {
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
          onSuccess?.()
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-100">Add New Family</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-800 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-2 rounded">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Family Name *
              </label>
              <input
                type="text"
                value={formData.display_name}
                onChange={(e) =>
                  setFormData({ ...formData, display_name: e.target.value })
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
                placeholder="Last, First (e.g., Smith, John)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Primary Contact Name
              </label>
              <input
                type="text"
                value={formData.primary_contact_name}
                onChange={(e) =>
                  setFormData({ ...formData, primary_contact_name: e.target.value })
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as CustomerStatus })
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
              >
                <option value="lead">Lead</option>
                <option value="trial">Trial</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="churned">Churned</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.primary_email}
                onChange={(e) =>
                  setFormData({ ...formData, primary_email: e.target.value })
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={formData.primary_phone}
                onChange={(e) =>
                  setFormData({ ...formData, primary_phone: e.target.value })
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Payment Method
              </label>
              <select
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
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Address
              </label>
              <input
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
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                City
              </label>
              <input
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
                <label className="block text-sm font-medium text-zinc-400 mb-1">
                  State
                </label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) =>
                    setFormData({ ...formData, state: e.target.value })
                  }
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">
                  ZIP
                </label>
                <input
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
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
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
      </div>
    </div>
  )
}
