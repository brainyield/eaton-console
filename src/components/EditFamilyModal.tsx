import { useState, useEffect } from 'react';
import { X, Loader2, Save, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

type CustomerStatus = 'lead' | 'trial' | 'active' | 'paused' | 'churned';

interface Family {
  id: string;
  display_name: string;
  status: CustomerStatus;
  primary_email: string | null;
  primary_phone: string | null;
  primary_contact_name: string | null;
  payment_gateway: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
}

interface EditFamilyModalProps {
  isOpen: boolean;
  family: Family | null;
  onClose: () => void;
  onSuccess: () => void;
  onDelete?: () => void;
}

interface FamilyFormData {
  display_name: string;
  status: CustomerStatus;
  primary_email: string;
  primary_phone: string;
  primary_contact_name: string;
  payment_gateway: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
}

const STATUS_OPTIONS: { value: CustomerStatus; label: string; color: string }[] = [
  { value: 'lead', label: 'Lead', color: 'bg-zinc-500' },
  { value: 'trial', label: 'Trial', color: 'bg-blue-500' },
  { value: 'active', label: 'Active', color: 'bg-emerald-500' },
  { value: 'paused', label: 'Paused', color: 'bg-amber-500' },
  { value: 'churned', label: 'Churned', color: 'bg-red-500' },
];

const PAYMENT_GATEWAY_OPTIONS = [
  '',
  'StepUp',
  'PEP',
  'Zelle',
  'Cash',
  'Check',
  'Bank Transfer',
  'Stripe',
];

export function EditFamilyModal({ isOpen, family, onClose, onSuccess, onDelete }: EditFamilyModalProps) {
  const [formData, setFormData] = useState<FamilyFormData>({
    display_name: '',
    status: 'lead',
    primary_email: '',
    primary_phone: '',
    primary_contact_name: '',
    payment_gateway: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: 'FL',
    zip: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populate form when family changes
  useEffect(() => {
    if (family) {
      setFormData({
        display_name: family.display_name || '',
        status: family.status || 'lead',
        primary_email: family.primary_email || '',
        primary_phone: family.primary_phone || '',
        primary_contact_name: family.primary_contact_name || '',
        payment_gateway: family.payment_gateway || '',
        address_line1: family.address_line1 || '',
        address_line2: family.address_line2 || '',
        city: family.city || '',
        state: family.state || 'FL',
        zip: family.zip || '',
        notes: family.notes || '',
      });
      setError(null);
      setShowDeleteConfirm(false);
    }
  }, [family]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const validateForm = (): string | null => {
    if (!formData.display_name.trim()) {
      return 'Family name is required';
    }
    if (formData.primary_email && !formData.primary_email.includes('@')) {
      return 'Please enter a valid email address';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!family) return;

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const updateData: Record<string, any> = {
        display_name: formData.display_name.trim(),
        status: formData.status,
        primary_email: formData.primary_email.trim().toLowerCase() || null,
        primary_phone: formData.primary_phone.trim() || null,
        primary_contact_name: formData.primary_contact_name.trim() || null,
        payment_gateway: formData.payment_gateway || null,
        address_line1: formData.address_line1.trim() || null,
        address_line2: formData.address_line2.trim() || null,
        city: formData.city.trim() || null,
        state: formData.state.trim() || null,
        zip: formData.zip.trim() || null,
        notes: formData.notes.trim() || null,
      };

      const { error: updateError } = await (supabase.from('families') as any)
        .update(updateData)
        .eq('id', family.id);

      if (updateError) {
        if (updateError.code === '23505') {
          throw new Error('A family with this email already exists');
        }
        throw updateError;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error updating family:', err);
      setError(err.message || 'Failed to update family. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!family || !onDelete) return;

    setIsDeleting(true);
    setError(null);

    try {
      const { error: deleteError } = await (supabase.from('families') as any)
        .delete()
        .eq('id', family.id);

      if (deleteError) {
        throw deleteError;
      }

      onDelete();
      onClose();
    } catch (err: any) {
      console.error('Error deleting family:', err);
      setError(err.message || 'Failed to delete family. Please try again.');
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting && !isDeleting) {
      setError(null);
      setShowDeleteConfirm(false);
      onClose();
    }
  };

  if (!isOpen || !family) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40"
        onClick={handleClose}
      />
      
      {/* Slide-over Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-zinc-900 border-l border-zinc-800 z-50 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white">Edit Family</h2>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full text-white ${
              STATUS_OPTIONS.find(s => s.value === formData.status)?.color || 'bg-zinc-500'
            }`}>
              {STATUS_OPTIONS.find(s => s.value === formData.status)?.label}
            </span>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting || isDeleting}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Primary Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
                Primary Information
              </h3>
              
              <div>
                <label htmlFor="display_name" className="block text-sm font-medium text-zinc-300 mb-1">
                  Family Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  id="display_name"
                  name="display_name"
                  value={formData.display_name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-zinc-300 mb-1">
                    Status
                  </label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="payment_gateway" className="block text-sm font-medium text-zinc-300 mb-1">
                    Payment Method
                  </label>
                  <select
                    id="payment_gateway"
                    name="payment_gateway"
                    value={formData.payment_gateway}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {PAYMENT_GATEWAY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option || '-- Select --'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
                Contact Information
              </h3>

              <div>
                <label htmlFor="primary_contact_name" className="block text-sm font-medium text-zinc-300 mb-1">
                  Primary Contact Name
                </label>
                <input
                  type="text"
                  id="primary_contact_name"
                  name="primary_contact_name"
                  value={formData.primary_contact_name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="primary_email" className="block text-sm font-medium text-zinc-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="primary_email"
                  name="primary_email"
                  value={formData.primary_email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="primary_phone" className="block text-sm font-medium text-zinc-300 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  id="primary_phone"
                  name="primary_phone"
                  value={formData.primary_phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
                Address
              </h3>

              <div>
                <label htmlFor="address_line1" className="block text-sm font-medium text-zinc-300 mb-1">
                  Street Address
                </label>
                <input
                  type="text"
                  id="address_line1"
                  name="address_line1"
                  value={formData.address_line1}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="address_line2" className="block text-sm font-medium text-zinc-300 mb-1">
                  Apt/Suite/Unit
                </label>
                <input
                  type="text"
                  id="address_line2"
                  name="address_line2"
                  value={formData.address_line2}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-6 gap-4">
                <div className="col-span-3">
                  <label htmlFor="city" className="block text-sm font-medium text-zinc-300 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="col-span-1">
                  <label htmlFor="state" className="block text-sm font-medium text-zinc-300 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    id="state"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    maxLength={2}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="col-span-2">
                  <label htmlFor="zip" className="block text-sm font-medium text-zinc-300 mb-1">
                    ZIP
                  </label>
                  <input
                    type="text"
                    id="zip"
                    name="zip"
                    value={formData.zip}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
                Notes
              </h3>

              <div>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            {/* Danger Zone */}
            {onDelete && (
              <div className="space-y-4 pt-4 border-t border-zinc-800">
                <h3 className="text-sm font-medium text-red-400 uppercase tracking-wider">
                  Danger Zone
                </h3>

                {showDeleteConfirm ? (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg space-y-3">
                    <p className="text-sm text-red-400">
                      Are you sure you want to delete this family? This will also delete all associated students and enrollments. This action cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isDeleting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          'Yes, Delete Family'
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={isDeleting}
                        className="px-3 py-1.5 text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Family
                  </button>
                )}
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800 bg-zinc-900">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting || isDeleting}
            className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={isSubmitting || isDeleting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
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
    </>
  );
}
