import { useState } from 'react';
import { X, Loader2, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AddTeacherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type EmployeeStatus = 'active' | 'reserve' | 'inactive';

interface TeacherFormData {
  display_name: string;
  email: string;
  phone: string;
  role: string;
  skillset: string;
  preferred_comm_method: string;
  status: EmployeeStatus;
  default_hourly_rate: string;
  max_hours_per_week: string;
  payment_info_on_file: boolean;
  hire_date: string;
  notes: string;
}

const INITIAL_FORM_DATA: TeacherFormData = {
  display_name: '',
  email: '',
  phone: '',
  role: '',
  skillset: '',
  preferred_comm_method: '',
  status: 'active',
  default_hourly_rate: '',
  max_hours_per_week: '',
  payment_info_on_file: false,
  hire_date: '',
  notes: '',
};

const STATUS_OPTIONS: { value: EmployeeStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'reserve', label: 'Reserve' },
  { value: 'inactive', label: 'Inactive' },
];

const ROLE_OPTIONS = [
  '',
  'Academic Coach',
  'Learning Pod Teacher',
  'Elective Instructor',
  'Hub Supervisor',
  'Online Instructor',
  'Substitute',
];

const COMM_METHOD_OPTIONS = [
  '',
  'Email',
  'Text',
  'Call',
  'Email/Text',
  'WhatsApp',
];

export function AddTeacherModal({ isOpen, onClose, onSuccess }: AddTeacherModalProps) {
  const [formData, setFormData] = useState<TeacherFormData>(INITIAL_FORM_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setFormData((prev) => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
    setError(null);
  };

  const validateForm = (): string | null => {
    if (!formData.display_name.trim()) {
      return 'Teacher name is required';
    }
    if (formData.email && !formData.email.includes('@')) {
      return 'Please enter a valid email address';
    }
    if (formData.default_hourly_rate && isNaN(parseFloat(formData.default_hourly_rate))) {
      return 'Hourly rate must be a valid number';
    }
    if (formData.max_hours_per_week && isNaN(parseFloat(formData.max_hours_per_week))) {
      return 'Max hours must be a valid number';
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
      const insertData: Record<string, any> = {
        display_name: formData.display_name.trim(),
        status: formData.status,
        payment_info_on_file: formData.payment_info_on_file,
      };

      // Only include optional fields if they have values
      if (formData.email.trim()) {
        insertData.email = formData.email.trim().toLowerCase();
      }
      if (formData.phone.trim()) {
        insertData.phone = formData.phone.trim();
      }
      if (formData.role) {
        insertData.role = formData.role;
      }
      if (formData.skillset.trim()) {
        insertData.skillset = formData.skillset.trim();
      }
      if (formData.preferred_comm_method) {
        insertData.preferred_comm_method = formData.preferred_comm_method;
      }
      if (formData.default_hourly_rate) {
        insertData.default_hourly_rate = parseFloat(formData.default_hourly_rate);
      }
      if (formData.max_hours_per_week) {
        insertData.max_hours_per_week = parseFloat(formData.max_hours_per_week);
      }
      if (formData.hire_date) {
        insertData.hire_date = formData.hire_date;
      }
      if (formData.notes.trim()) {
        insertData.notes = formData.notes.trim();
      }

      const { error: insertError } = await (supabase.from('teachers') as any).insert(insertData);

      if (insertError) {
        // Check for unique constraint violation on name
        if (insertError.code === '23505') {
          throw new Error('A teacher with this name already exists');
        }
        throw insertError;
      }

      // Success - reset form and close
      setFormData(INITIAL_FORM_DATA);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error adding teacher:', err);
      setError(err.message || 'Failed to add teacher. Please try again.');
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
            <div className="p-2 bg-violet-500/10 rounded-lg">
              <UserPlus className="w-5 h-5 text-violet-500" />
            </div>
            <h2 className="text-lg font-semibold text-white">Add Teacher</h2>
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

            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
                Basic Information
              </h3>
              
              <div>
                <label htmlFor="display_name" className="block text-sm font-medium text-zinc-300 mb-1">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  id="display_name"
                  name="display_name"
                  value={formData.display_name}
                  onChange={handleChange}
                  placeholder="e.g., Aviles, Wilmary"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
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
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-zinc-300 mb-1">
                    Role
                  </label>
                  <select
                    id="role"
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option || '-- Select --'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="skillset" className="block text-sm font-medium text-zinc-300 mb-1">
                  Skillset
                </label>
                <textarea
                  id="skillset"
                  name="skillset"
                  value={formData.skillset}
                  onChange={handleChange}
                  rows={2}
                  placeholder="e.g., K-8 All Subjects; High School Math & Science"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
                Contact Information
              </h3>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="e.g., wilmary@email.com"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-zinc-300 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="(305) 555-1234"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label htmlFor="preferred_comm_method" className="block text-sm font-medium text-zinc-300 mb-1">
                    Preferred Contact
                  </label>
                  <select
                    id="preferred_comm_method"
                    name="preferred_comm_method"
                    value={formData.preferred_comm_method}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  >
                    {COMM_METHOD_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option || '-- Select --'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Compensation & Availability */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
                Compensation & Availability
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="default_hourly_rate" className="block text-sm font-medium text-zinc-300 mb-1">
                    Hourly Rate ($)
                  </label>
                  <input
                    type="text"
                    id="default_hourly_rate"
                    name="default_hourly_rate"
                    value={formData.default_hourly_rate}
                    onChange={handleChange}
                    placeholder="e.g., 70"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label htmlFor="max_hours_per_week" className="block text-sm font-medium text-zinc-300 mb-1">
                    Max Hours/Week
                  </label>
                  <input
                    type="text"
                    id="max_hours_per_week"
                    name="max_hours_per_week"
                    value={formData.max_hours_per_week}
                    onChange={handleChange}
                    placeholder="e.g., 30"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="hire_date" className="block text-sm font-medium text-zinc-300 mb-1">
                  Hire Date
                </label>
                <input
                  type="date"
                  id="hire_date"
                  name="hire_date"
                  value={formData.hire_date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="payment_info_on_file"
                  name="payment_info_on_file"
                  checked={formData.payment_info_on_file}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-violet-500 focus:ring-violet-500 focus:ring-offset-zinc-900"
                />
                <label htmlFor="payment_info_on_file" className="text-sm font-medium text-zinc-300">
                  Payment info on file (SSN, bank details collected)
                </label>
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
                  placeholder="Any additional notes about this teacher..."
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
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
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Add Teacher
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
