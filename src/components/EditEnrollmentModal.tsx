import { useState, useEffect, useMemo } from 'react';
import { Loader2, Save, AlertCircle, User } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useEnrollmentMutations,
  useActiveTeachers,
  useTeacherAssignmentsByEnrollment,
  useTeacherAssignmentMutations,
  type Enrollment,
  type EnrollmentStatus,
  type BillingFrequency,
  type Service,
  type Teacher
} from '../lib/hooks';
import { queryKeys } from '../lib/queryClient';
import { getPeriodOptions, getDefaultPeriod, type ServiceCode } from '../lib/enrollmentPeriod';
import { getTodayString } from '../lib/dateUtils';
import { AccessibleModal } from './ui/AccessibleModal';

interface EnrollmentWithService extends Enrollment {
  service?: Service
}

interface EditEnrollmentModalProps {
  isOpen: boolean;
  enrollment: EnrollmentWithService | null;
  onClose: () => void;
  onSuccess?: () => void;
}

interface FormData {
  status: EnrollmentStatus;
  start_date: string;
  end_date: string;
  enrollment_period: string;
  hourly_rate_customer: string;
  hours_per_week: string;
  monthly_rate: string;
  weekly_tuition: string;
  daily_rate: string;
  billing_frequency: BillingFrequency | '';
  class_title: string;
  schedule_notes: string;
  notes: string;
  teacher_id: string;
  teacher_hourly_rate: string;
}

const STATUS_OPTIONS: { value: EnrollmentStatus; label: string }[] = [
  { value: 'trial', label: 'Trial' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'ended', label: 'Ended' },
];

const BILLING_FREQUENCY_OPTIONS: { value: BillingFrequency; label: string }[] = [
  { value: 'per_session', label: 'Per Session' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'bi_monthly', label: 'Bi-Monthly' },
  { value: 'annual', label: 'Annual' },
  { value: 'one_time', label: 'One Time' },
];

export function EditEnrollmentModal({
  isOpen,
  enrollment,
  onClose,
  onSuccess
}: EditEnrollmentModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<FormData>({
    status: 'active',
    start_date: '',
    end_date: '',
    enrollment_period: '',
    hourly_rate_customer: '',
    hours_per_week: '',
    monthly_rate: '',
    weekly_tuition: '',
    daily_rate: '',
    billing_frequency: '',
    class_title: '',
    schedule_notes: '',
    notes: '',
    teacher_id: '',
    teacher_hourly_rate: '',
  });
  const [error, setError] = useState<string | null>(null);

  // Fetch active teachers for the dropdown
  const { data: teachers = [] } = useActiveTeachers();

  // Fetch current teacher assignment for this enrollment
  const { data: currentAssignments = [] } = useTeacherAssignmentsByEnrollment(enrollment?.id || '');
  const currentActiveAssignment = currentAssignments.find(a => a.is_active);

  // Teacher assignment mutations
  const { createAssignment, updateAssignment } = useTeacherAssignmentMutations();

  // Get service code for period options
  const serviceCode = enrollment?.service?.code as ServiceCode | undefined;

  // Generate period options based on service type
  const periodOptions = useMemo(() => {
    if (!serviceCode) return [];
    return getPeriodOptions(serviceCode);
  }, [serviceCode]);

  // Mutations
  const { updateEnrollment } = useEnrollmentMutations();
  const isSubmitting = updateEnrollment.isPending || createAssignment.isPending || updateAssignment.isPending;

  // Populate form when enrollment changes
  useEffect(() => {
    if (enrollment) {
      // If no period is set, default based on service type
      let period = enrollment.enrollment_period || '';
      if (!period && serviceCode) {
        period = getDefaultPeriod(serviceCode);
      }

      setFormData({
        status: enrollment.status,
        start_date: enrollment.start_date || '',
        end_date: enrollment.end_date || '',
        enrollment_period: period,
        hourly_rate_customer: enrollment.hourly_rate_customer?.toString() || '',
        hours_per_week: enrollment.hours_per_week?.toString() || '',
        monthly_rate: enrollment.monthly_rate?.toString() || '',
        weekly_tuition: enrollment.weekly_tuition?.toString() || '',
        daily_rate: enrollment.daily_rate?.toString() || '',
        billing_frequency: enrollment.billing_frequency || '',
        class_title: enrollment.class_title || '',
        schedule_notes: enrollment.schedule_notes || '',
        notes: enrollment.notes || '',
        teacher_id: currentActiveAssignment?.teacher_id || '',
        teacher_hourly_rate: currentActiveAssignment?.hourly_rate_teacher?.toString() || '',
      });
    }
  }, [enrollment, serviceCode, currentActiveAssignment]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!enrollment) return;

    setError(null);

    // Build update data
    const updateData: Record<string, unknown> = {
      status: formData.status,
    };

    // Handle nullable fields
    updateData.start_date = formData.start_date || null;
    updateData.end_date = formData.end_date || null;
    updateData.enrollment_period = formData.enrollment_period || null;
    updateData.hourly_rate_customer = formData.hourly_rate_customer ? parseFloat(formData.hourly_rate_customer) : null;
    updateData.hours_per_week = formData.hours_per_week ? parseFloat(formData.hours_per_week) : null;
    updateData.monthly_rate = formData.monthly_rate ? parseFloat(formData.monthly_rate) : null;
    updateData.weekly_tuition = formData.weekly_tuition ? parseFloat(formData.weekly_tuition) : null;
    updateData.daily_rate = formData.daily_rate ? parseFloat(formData.daily_rate) : null;
    updateData.billing_frequency = formData.billing_frequency || null;
    updateData.class_title = formData.class_title.trim() || null;
    updateData.schedule_notes = formData.schedule_notes.trim() || null;
    updateData.notes = formData.notes.trim() || null;

    // Handle teacher assignment changes
    const teacherChanged = formData.teacher_id !== (currentActiveAssignment?.teacher_id || '');
    const teacherHourlyRate = formData.teacher_hourly_rate ? parseFloat(formData.teacher_hourly_rate) : null;

    // Track completed operations for partial failure reporting
    const completedOps: string[] = [];
    const failedOps: string[] = [];

    try {
      // Update enrollment first
      try {
        await new Promise<void>((resolve, reject) => {
          updateEnrollment.mutate(
            { id: enrollment.id, data: updateData },
            {
              onSuccess: () => resolve(),
              onError: (err) => reject(err)
            }
          );
        });
        completedOps.push('Enrollment details updated');
      } catch (err) {
        console.error('Failed to update enrollment:', err);
        // Enrollment update is critical - fail early
        throw new Error('Failed to update enrollment details. No changes were made.');
      }

      // Handle teacher assignment if changed
      if (teacherChanged) {
        if (formData.teacher_id) {
          // End current assignment if exists
          if (currentActiveAssignment) {
            try {
              await new Promise<void>((resolve, reject) => {
                updateAssignment.mutate(
                  {
                    id: currentActiveAssignment.id,
                    data: {
                      is_active: false,
                      end_date: getTodayString()
                    }
                  },
                  {
                    onSuccess: () => resolve(),
                    onError: (err) => reject(err)
                  }
                );
              });
              completedOps.push('Previous teacher assignment ended');
            } catch (err) {
              console.error('Failed to end previous assignment:', err);
              failedOps.push('End previous teacher assignment');
            }
          }

          // Create new assignment
          try {
            await new Promise<void>((resolve, reject) => {
              createAssignment.mutate(
                {
                  enrollment_id: enrollment.id,
                  teacher_id: formData.teacher_id,
                  hourly_rate_teacher: teacherHourlyRate,
                  hours_per_week: formData.hours_per_week ? parseFloat(formData.hours_per_week) : null,
                  is_active: true,
                  start_date: getTodayString(),
                },
                {
                  onSuccess: () => resolve(),
                  onError: (err) => reject(err)
                }
              );
            });
            completedOps.push('New teacher assigned');
          } catch (err) {
            console.error('Failed to create new assignment:', err);
            failedOps.push('Assign new teacher');
          }
        } else if (currentActiveAssignment) {
          // Just end the current assignment (removing teacher)
          try {
            await new Promise<void>((resolve, reject) => {
              updateAssignment.mutate(
                {
                  id: currentActiveAssignment.id,
                  data: {
                    is_active: false,
                    end_date: getTodayString()
                  }
                },
                {
                  onSuccess: () => resolve(),
                  onError: (err) => reject(err)
                }
              );
            });
            completedOps.push('Teacher assignment removed');
          } catch (err) {
            console.error('Failed to end assignment:', err);
            failedOps.push('Remove teacher assignment');
          }
        }
      } else if (currentActiveAssignment && formData.teacher_id) {
        // Teacher didn't change, but hourly rate might have
        const rateChanged = teacherHourlyRate !== currentActiveAssignment.hourly_rate_teacher;
        if (rateChanged) {
          try {
            await new Promise<void>((resolve, reject) => {
              updateAssignment.mutate(
                {
                  id: currentActiveAssignment.id,
                  data: { hourly_rate_teacher: teacherHourlyRate }
                },
                {
                  onSuccess: () => resolve(),
                  onError: (err) => reject(err)
                }
              );
            });
            completedOps.push('Teacher hourly rate updated');
          } catch (err) {
            console.error('Failed to update teacher rate:', err);
            failedOps.push('Update teacher hourly rate');
          }
        }
      }

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.byFamily(enrollment.family_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.detail(enrollment.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.roster() });
      queryClient.invalidateQueries({ queryKey: queryKeys.teacherAssignments.byEnrollment(enrollment.id) });

      // Report partial failures if any
      if (failedOps.length > 0) {
        setError(`Partial save: ${completedOps.join(', ')}. Failed: ${failedOps.join(', ')}. Please retry the failed operations.`);
      } else {
        onSuccess?.();
        handleClose();
      }
    } catch (err) {
      console.error('Error updating enrollment:', err);
      setError(err instanceof Error ? err.message : 'Failed to update enrollment. Please try again.');
    }
  }

  function handleClose() {
    setError(null);
    updateEnrollment.reset();
    onClose();
  }

  if (!enrollment) return null;

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Edit Enrollment"
      subtitle="Update enrollment details"
      size="lg"
    >
      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Status & Dates */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            Status & Dates
          </h3>

          <div>
            <label htmlFor="enrollment-status" className="block text-sm font-medium text-gray-300 mb-2">
              Status
            </label>
            <select
              id="enrollment-status"
              name="status"
              autoFocus
              value={formData.status}
              onChange={handleChange}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="start-date" className="block text-sm font-medium text-gray-300 mb-2">
                Start Date
              </label>
              <input
                id="start-date"
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="end-date" className="block text-sm font-medium text-gray-300 mb-2">
                End Date
              </label>
              <input
                id="end-date"
                type="date"
                name="end_date"
                value={formData.end_date}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label htmlFor="enrollment-period" className="block text-sm font-medium text-gray-300 mb-2">
              Enrollment Period
            </label>
            <select
              id="enrollment-period"
              name="enrollment_period"
              value={formData.enrollment_period}
              onChange={handleChange}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select period...</option>
              {periodOptions.map(period => (
                <option key={period} value={period}>{period}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {serviceCode && ['learning_pod', 'elective_classes'].includes(serviceCode)
                ? 'Semester (Fall/Spring/Summer)'
                : 'School Year'}
            </p>
          </div>
        </div>

        {/* Billing */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            Billing
          </h3>

          <div>
            <label htmlFor="billing-frequency" className="block text-sm font-medium text-gray-300 mb-2">
              Billing Frequency
            </label>
            <select
              id="billing-frequency"
              name="billing_frequency"
              value={formData.billing_frequency}
              onChange={handleChange}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Not specified</option>
              {BILLING_FREQUENCY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="hourly-rate" className="block text-sm font-medium text-gray-300 mb-2">
                Hourly Rate ($)
              </label>
              <input
                id="hourly-rate"
                type="number"
                step="0.01"
                min="0"
                name="hourly_rate_customer"
                value={formData.hourly_rate_customer}
                onChange={handleChange}
                placeholder="90.00"
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="hours-per-week" className="block text-sm font-medium text-gray-300 mb-2">
                Hours/Week
              </label>
              <input
                id="hours-per-week"
                type="number"
                step="0.5"
                min="0"
                name="hours_per_week"
                value={formData.hours_per_week}
                onChange={handleChange}
                placeholder="5"
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="monthly-rate" className="block text-sm font-medium text-gray-300 mb-2">
                Monthly Rate ($)
              </label>
              <input
                id="monthly-rate"
                type="number"
                step="0.01"
                min="0"
                name="monthly_rate"
                value={formData.monthly_rate}
                onChange={handleChange}
                placeholder="500.00"
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="daily-rate" className="block text-sm font-medium text-gray-300 mb-2">
                Daily Rate ($)
              </label>
              <input
                id="daily-rate"
                type="number"
                step="0.01"
                min="0"
                name="daily_rate"
                value={formData.daily_rate}
                onChange={handleChange}
                placeholder="100.00"
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Teacher Assignment */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            Teacher Assignment
          </h3>

          <div>
            <label htmlFor="assigned-teacher" className="block text-sm font-medium text-gray-300 mb-2">
              Assigned Teacher
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden="true" />
              <select
                id="assigned-teacher"
                name="teacher_id"
                value={formData.teacher_id}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">No teacher assigned</option>
                {(teachers as Teacher[]).map(teacher => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.display_name}
                    {teacher.default_hourly_rate && ` ($${teacher.default_hourly_rate}/hr)`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {formData.teacher_id && (
            <div>
              <label htmlFor="teacher-rate" className="block text-sm font-medium text-gray-300 mb-2">
                Teacher Hourly Rate ($)
              </label>
              <input
                id="teacher-rate"
                type="number"
                step="0.01"
                min="0"
                name="teacher_hourly_rate"
                value={formData.teacher_hourly_rate}
                onChange={handleChange}
                placeholder={
                  (teachers as Teacher[]).find(t => t.id === formData.teacher_id)?.default_hourly_rate?.toString() || '25.00'
                }
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">
                Leave blank to use teacher's default rate
              </p>
            </div>
          )}
        </div>

        {/* Additional Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            Additional Info
          </h3>

          <div>
            <label htmlFor="class-title" className="block text-sm font-medium text-gray-300 mb-2">
              Class Title
            </label>
            <input
              id="class-title"
              type="text"
              name="class_title"
              value={formData.class_title}
              onChange={handleChange}
              placeholder="e.g., Bitcoin 101"
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="schedule-notes" className="block text-sm font-medium text-gray-300 mb-2">
              Schedule Notes
            </label>
            <textarea
              id="schedule-notes"
              name="schedule_notes"
              value={formData.schedule_notes}
              onChange={handleChange}
              rows={2}
              placeholder="e.g., Mon/Wed 4pm, Fri 3pm"
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label htmlFor="enrollment-notes" className="block text-sm font-medium text-gray-300 mb-2">
              Notes
            </label>
            <textarea
              id="enrollment-notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={2}
              placeholder="Any additional notes..."
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div role="alert" className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" aria-hidden="true" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" aria-hidden="true" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>
    </AccessibleModal>
  );
}
