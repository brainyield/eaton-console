import { useState, useEffect } from 'react';
import { X, Loader2, Save, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

type EmployeeStatus = 'active' | 'reserve' | 'inactive';

interface Teacher {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  skillset: string | null;
  preferred_comm_method: string | null;
  status: EmployeeStatus;
  default_hourly_rate: number | null;
  max_hours_per_week: number | null;
  payment_info_on_file: boolean;
  hire_date: string | null;
  notes: string | null;
}

interface EditTeacherModalProps {
  isOpen: boolean;
  teacher: Teacher | null;
  onClose: () => void;
  onSuccess: () => void;
  onDelete?: () => void;
}

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

const STATUS_OPTIONS: { value: EmployeeStatus; label: string; color: string }[] = [
  { value: 'active', label: 'Active', color: 'bg-emerald-500' },
  { value: 'reserve', label: 'Reserve', color: 'bg-blue-500' },
  { value: 'inactive', label: 'Inactive', color: 'bg-zinc-500' },
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

export function EditTeacherModal({ isOpen, teacher, onClose, onSuccess, onDelete }: EditTeacherModalProps) {
  const [formData, setFormData] = useState<TeacherFormData>({
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
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populate form when teacher changes
  useEffect(() => {
    if (teacher) {
      setFormData({
        display_name: teacher.display_name || '',
        email: teacher.email || '',
        phone: teacher.phone || '',
        role: teacher.role || '',
        skillset: teacher.skillset || '',
        preferred_comm_method: teacher.preferred_comm_method || '',
        status: teacher.status || 'active',
        default_hourly_rate: teacher.default_hourly_rate?.toString() || '',
        max_hours_per_week: teacher.max_hours_per_week?.toString() || '',
        payment_info_on_file: teacher.payment_info_on_file || false,
        hire_date: teacher.hire_date || '',
        notes: teacher.notes || '',
      });
      setError(null);
      setShowDeleteConfirm(false);
    }
  }, [teacher]);

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
    
    if (!teacher) return;

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
        payment_info_on_file: formData.payment_info_on_file,
        email: formData.email.trim().toLowerCase() || null,
        phone: formData.phone.trim() || null,
        role: formData.role || null,
        skillset: formData.skillset.trim() || null,
        preferred_comm_method: formData.preferred_comm_method || null,
        default_hourly_rate: formData.default_hourly_rate ? parseFloat(formData.default_hourly_rate) : null,
        max_hours_per_week: formData.max_hours_per_week ? parseFloat(formData.max_hours_per_week) : null,
        hire_date: formData.hire_date || null,
        notes: formData.notes.trim() || null,
      };

      const { error: updateError } = await (supabase.from('teachers') as any)
        .update(updateData)
        .eq('id', teacher.id);

      if (updateError) {
        if (updateError.code === '23505') {
          throw new Error('A teacher with this name already exists');
        }
        throw updateError;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error updating teacher:', err);
      setError(err.message || 'Failed to update teacher. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!teacher || !onDelete) return;

    setIsDeleting(true);
    setError(null);

    try {
      const { error: deleteError } = await (supabase.from('teachers') as any)
        .delete()
        .eq('id', teacher.id);

      if (deleteError) {
        throw deleteError;
      }

      onDelete();
      onClose();
    } catch (err: any) {
      console.error('Error deleting teacher:', err);
      // Check for foreign key constraint
      if (err.code === '23503') {
        setError('Cannot delete teacher with active assignments. Remove assignments first.');
      } else {
        setError(err.message || 'Failed to delete teacher. Please try again.');
      }
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

  if (!isOpen || !teacher) return null;

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
            <h2 className="text-lg font-semibold text-white">Edit Teacher</h2>
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
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
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
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
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
                      Are you sure you want to delete this teacher? This will fail if they have active assignments. This action cannot be undone.
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
                          'Yes, Delete Teacher'
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
                    Delete Teacher
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
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
