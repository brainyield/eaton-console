import { useState } from 'react';
import { Loader2, UserMinus, AlertCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { AccessibleModal } from './ui/AccessibleModal';
import {
  useEnrollmentMutations,
  useTeacherAssignmentMutations,
  type Enrollment
} from '../lib/hooks';
import { queryKeys } from '../lib/queryClient';
import { getTodayString } from '../lib/dateUtils';

interface EndEnrollmentModalProps {
  isOpen: boolean;
  enrollment: Enrollment | null;
  studentName?: string;
  serviceName?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function EndEnrollmentModal({
  isOpen,
  enrollment,
  studentName,
  serviceName,
  onClose,
  onSuccess
}: EndEnrollmentModalProps) {
  const queryClient = useQueryClient();
  const [endDate, setEndDate] = useState(getTodayString());
  const [error, setError] = useState<string | null>(null);

  // Mutations
  const { updateEnrollment } = useEnrollmentMutations();
  const { endAssignmentsByEnrollment } = useTeacherAssignmentMutations();

  const isSubmitting = updateEnrollment.isPending || endAssignmentsByEnrollment.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!enrollment) return;

    setError(null);

    // Capture original state for potential rollback
    const originalStatus = enrollment.status;
    const originalEndDate = enrollment.end_date;
    let enrollmentUpdated = false;

    try {
      // End the enrollment
      await updateEnrollment.mutateAsync({
        id: enrollment.id,
        data: {
          status: 'ended',
          end_date: endDate,
        }
      });
      enrollmentUpdated = true;

      // End all active teacher assignments for this enrollment
      await endAssignmentsByEnrollment.mutateAsync({
        enrollmentId: enrollment.id,
        endDate: endDate,
      });

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.byFamily(enrollment.family_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.teacherAssignments.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.roster() });

      onSuccess?.();
      handleClose();
    } catch (err) {
      console.error('Error ending enrollment:', err);

      // If enrollment was updated but assignments failed, attempt rollback
      if (enrollmentUpdated) {
        try {
          await updateEnrollment.mutateAsync({
            id: enrollment.id,
            data: {
              status: originalStatus,
              end_date: originalEndDate,
            }
          });
          setError('Failed to end teacher assignments. Enrollment has been restored to its original state.');
        } catch (rollbackErr) {
          console.error('Rollback failed:', rollbackErr);
          setError('Failed to end teacher assignments. Enrollment status may be inconsistent - please check and try again.');
        }
      } else {
        setError(err instanceof Error ? err.message : 'Failed to end enrollment. Please try again.');
      }
    }
  }

  function handleClose() {
    setEndDate(getTodayString());
    setError(null);
    updateEnrollment.reset();
    endAssignmentsByEnrollment.reset();
    onClose();
  }

  if (!enrollment) return null;

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={handleClose}
      title="End Enrollment"
      subtitle="This action cannot be undone"
      size="md"
    >
      {/* Content */}
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Confirmation Message */}
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm text-gray-300">
            Are you sure you want to end this enrollment?
          </p>
          {(studentName || serviceName) && (
            <p className="mt-2 text-sm text-white font-medium">
              {studentName && <span>{studentName}</span>}
              {studentName && serviceName && <span> &mdash; </span>}
              {serviceName && <span>{serviceName}</span>}
            </p>
          )}
          <p className="mt-3 text-xs text-gray-400">
            This will set the enrollment status to "Ended" and deactivate any associated teacher assignments.
          </p>
        </div>

        {/* End Date */}
        <div>
          <label htmlFor="end-date" className="block text-sm font-medium text-gray-300 mb-2">
            End Date
          </label>
          <input
            type="date"
            id="end-date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
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
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Ending...
              </>
            ) : (
              <>
                <UserMinus className="w-4 h-4" aria-hidden="true" />
                End Enrollment
              </>
            )}
          </button>
        </div>
      </form>
    </AccessibleModal>
  );
}
