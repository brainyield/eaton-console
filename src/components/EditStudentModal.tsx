import { useState, useEffect } from 'react';
import { X, Loader2, Save, Trash2, GraduationCap } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Student {
  id: string;
  family_id: string;
  full_name: string;
  dob: string | null;
  grade_level: string | null;
  age_group: string | null;
  homeschool_status: string | null;
  active: boolean;
  notes: string | null;
}

interface EditStudentModalProps {
  isOpen: boolean;
  student: Student | null;
  familyName: string;
  onClose: () => void;
  onSuccess: () => void;
  onDelete?: () => void;
}

interface StudentFormData {
  full_name: string;
  dob: string;
  grade_level: string;
  age_group: string;
  homeschool_status: string;
  active: boolean;
  notes: string;
}

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

export function EditStudentModal({ isOpen, student, familyName, onClose, onSuccess, onDelete }: EditStudentModalProps) {
  const [formData, setFormData] = useState<StudentFormData>({
    full_name: '',
    dob: '',
    grade_level: '',
    age_group: '',
    homeschool_status: '',
    active: true,
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populate form when student changes
  useEffect(() => {
    if (student) {
      setFormData({
        full_name: student.full_name || '',
        dob: student.dob || '',
        grade_level: student.grade_level || '',
        age_group: student.age_group || '',
        homeschool_status: student.homeschool_status || '',
        active: student.active,
        notes: student.notes || '',
      });
      setError(null);
      setShowDeleteConfirm(false);
    }
  }, [student]);

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
    if (!formData.full_name.trim()) {
      return 'Student name is required';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!student) return;

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const updateData: Record<string, any> = {
        full_name: formData.full_name.trim(),
        dob: formData.dob || null,
        grade_level: formData.grade_level || null,
        age_group: formData.age_group || null,
        homeschool_status: formData.homeschool_status || null,
        active: formData.active,
        notes: formData.notes.trim() || null,
      };

      const { error: updateError } = await (supabase.from('students') as any)
        .update(updateData)
        .eq('id', student.id);

      if (updateError) {
        throw updateError;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error updating student:', err);
      setError(err.message || 'Failed to update student. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!student || !onDelete) return;

    setIsDeleting(true);
    setError(null);

    try {
      const { error: deleteError } = await (supabase.from('students') as any)
        .delete()
        .eq('id', student.id);

      if (deleteError) {
        throw deleteError;
      }

      onDelete();
      onClose();
    } catch (err: any) {
      console.error('Error deleting student:', err);
      setError(err.message || 'Failed to delete student. Please try again.');
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

  if (!isOpen || !student) return null;

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
                <h2 className="text-lg font-semibold text-white">Edit Student</h2>
                <p className="text-sm text-zinc-400">{familyName}</p>
              </div>
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
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="active"
                  name="active"
                  checked={formData.active}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-zinc-900"
                />
                <label htmlFor="active" className="text-sm font-medium text-zinc-300">
                  Active Student
                </label>
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
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Danger Zone */}
              {onDelete && (
                <div className="pt-4 border-t border-zinc-800">
                  {showDeleteConfirm ? (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg space-y-3">
                      <p className="text-sm text-red-400">
                        Are you sure you want to delete this student? This will also delete all associated enrollments. This action cannot be undone.
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
                            'Yes, Delete'
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
                      Delete Student
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
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
          </form>
        </div>
      </div>
    </>
  );
}
