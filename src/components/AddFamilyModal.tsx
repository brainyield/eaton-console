import { useState } from 'react';
import { X, Loader2, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AddFamilyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type CustomerStatus = 'lead' | 'trial' | 'active' | 'paused' | 'churned';

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

const INITIAL_FORM_DATA: FamilyFormData = {
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
};

const STATUS_OPTIONS: { value: CustomerStatus; label: string }[] = [
  { value: 'lead', label: 'Lead' },
  { value: 'trial', label: 'Trial' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'churned', label: 'Churned' },
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

export function AddFamilyModal({ isOpen, onClose, onSuccess }: AddFamilyModalProps) {
  const [formData, setFormData] = useState<FamilyFormData>(INITIAL_FORM_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Prepare data - remove empty strings for optional fields
      const insertData: Record<string, any> = {
        display_name: formData.display_name.trim(),
        status: formData.status,
      };

      // Only include optional fields if they have values
      if (formData.primary_email.trim()) {
        insertData.primary_email = formData.primary_email.trim().toLowerCase();
      }
      if (formData.primary_phone.trim()) {
        insertData.primary_phone = formData.primary_phone.trim();
      }
      if (formData.primary_contact_name.trim()) {
        insertData.primary_contact_name = formData.primary_contact_name.trim();
      }
      if (formData.payment_gateway) {
        insertData.payment_gateway = formData.payment_gateway;
      }
      if (formData.address_line1.trim()) {
        insertData.address_line1 = formData.address_line1.trim();
      }
      if (formData.address_line2.trim()) {
        insertData.address_line2 = formData.address_line2.trim();
      }
      if (formData.city.trim()) {
        insertData.city = formData.city.trim();
      }
      if (formData.state.trim()) {
        insertData.state = formData.state.trim();
      }
      if (formData.zip.trim()) {
        insertData.zip = formData.zip.trim();
      }
      if (formData.notes.trim()) {
        insertData.notes = formData.notes.trim();
      }

      const { error: insertError } = await (supabase.from('families') as any).insert(insertData);

      if (insertError) {
        // Check for unique constraint violation on email
        if (insertError.code === '23505') {
          throw new Error('A family with this email already exists');
        }
        throw insertError;
      }

      // Success - reset form and close
      setFormData(INITIAL_FORM_DATA);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error adding family:', err);
      setError(err.message || 'Failed to add family. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData(INITIAL_FORM_DATA);
      setError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

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
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <UserPlus className="w-5 h-5 text-emerald-500" />
            </div>
            <h2 className="text-lg font-semibold text-white">Add Family</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
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
                  placeholder="e.g., Paz, LaDonna"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  autoFocus
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
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                  placeholder="e.g., LaDonna Paz"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                  placeholder="e.g., ladonna@email.com"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                  placeholder="e.g., (305) 555-1234"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                  placeholder="123 Main St"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                  placeholder="Apt 4B"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                    placeholder="Miami"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                    placeholder="33101"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                  placeholder="Any additional notes about this family..."
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800 bg-zinc-900">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Add Family
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
