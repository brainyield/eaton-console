import { useState } from 'react';
import { X, Loader2, GraduationCap } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AddStudentModalProps {
  isOpen: boolean;
  familyId: string;
  familyName: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface StudentFormData {
  full_name: string;
  dob: string;
  grade_level: string;
  age_group: string;
  homeschool_status: string;
  notes: string;
}

const INITIAL_FORM_DATA: StudentFormData = {
  full_name: '',
  dob: '',
  grade_level: '',
  age_group: '',
  homeschool_status: '',
  notes: '',
};

const GRADE_LEVEL_OPTIONS = [
  '',
  'Pre-K',
  'Kindergarten',
  '1st Grade',
  '2nd Grade',
  '3rd Grade',
  '4th Grade',
  '5th Grade',
  '6th Grade',
  '7th Grade',
  '8th Grade',
  '9th Grade',
  '10th Grade',
  '11th Grade',
  '12th Grade',
];

const AGE_GROUP_OPTIONS = [
  '',
  '4-5',
  '6-8',
  '9-11',
  '12-14',
  '15-17',
  '18+',
];

const HOMESCHOOL_STATUS_OPTIONS = [
  '',
  'Registered',
  'Pending Registration',
  'Not Registered',
  'Umbrella School',
  'Virtual School',
];

export function AddStudentModal({ isOpen, familyId, familyName, onClose, onSuccess }: AddStudentModalProps) {
  const [formData, setFormData] = useState<StudentFormData>(INITIAL_FORM_DATA);
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
    if (!formData.full_name.trim()) {
      return 'Student name is required';
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
        family_id: familyId,
        full_name: formData.full_name.trim(),
        active: true,
      };

      // Only include optional fields if they have values
      if (formData.dob) {
        insertData.dob = formData.dob;
      }
      if (formData.grade_level) {
        insertData.grade_level = formData.grade_level;
      }
      if (formData.age_group) {
        insertData.age_group = formData.age_group;
      }
      if (formData.homeschool_status) {
        insertData.homeschool_status = formData.homeschool_status;
      }
      if (formData.notes.trim()) {
        insertData.notes = formData.notes.trim();
      }

      const { error: insertError } = await (supabase.from('students') as any).insert(insertData);

      if (insertError) {
        throw insertError;
      }

      // Success - reset form and close
      setFormData(INITIAL_FORM_DATA);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error adding student:', err);
      setError(err.message || 'Failed to add student. Please try again.');
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
        className="fixed inset-0 bg-black/50 z-50"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <GraduationCap className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Add Student</h2>
                <p className="text-sm text-zinc-400">{familyName}</p>
              </div>
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
          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="full_name" className="block text-sm font-medium text-zinc-300 mb-1">
                  Student Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  id="full_name"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  placeholder="e.g., Jayna Paz"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="dob" className="block text-sm font-medium text-zinc-300 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    id="dob"
                    name="dob"
                    value={formData.dob}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label htmlFor="age_group" className="block text-sm font-medium text-zinc-300 mb-1">
                    Age Group
                  </label>
                  <select
                    id="age_group"
                    name="age_group"
                    value={formData.age_group}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {AGE_GROUP_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option || '-- Select --'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="grade_level" className="block text-sm font-medium text-zinc-300 mb-1">
                    Grade Level
                  </label>
                  <select
                    id="grade_level"
                    name="grade_level"
                    value={formData.grade_level}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {GRADE_LEVEL_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option || '-- Select --'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="homeschool_status" className="block text-sm font-medium text-zinc-300 mb-1">
                    Homeschool Status
                  </label>
                  <select
                    id="homeschool_status"
                    name="homeschool_status"
                    value={formData.homeschool_status}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {HOMESCHOOL_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option || '-- Select --'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-zinc-300 mb-1">
                  Notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Learning preferences, special needs, etc."
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
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
                disabled={isSubmitting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <GraduationCap className="w-4 h-4" />
                    Add Student
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
