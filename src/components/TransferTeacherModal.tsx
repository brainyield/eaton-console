import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X, Search, User, ArrowRight } from 'lucide-react';
import { 
  useActiveTeachers, 
  useTeacherAssignmentMutations,
  type Teacher 
} from '../lib/hooks';
import { queryKeys } from '../lib/queryClient';

interface TeacherAssignment {
  id: string;
  enrollment_id: string;
  teacher_id: string;
  hourly_rate_teacher: number | null;
  hours_per_week: number | null;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  notes?: string | null;
  teacher: Teacher;
}

interface TransferTeacherModalProps {
  isOpen: boolean;
  currentAssignment: TeacherAssignment | null;
  enrollmentId: string;
  studentName: string;
  serviceName: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function TransferTeacherModal({
  isOpen,
  currentAssignment,
  enrollmentId,
  studentName,
  serviceName,
  onClose,
  onSuccess
}: TransferTeacherModalProps) {
  const queryClient = useQueryClient();
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [hoursPerWeek, setHoursPerWeek] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Fetch active teachers
  const { data: teachers = [], isLoading: loadingTeachers } = useActiveTeachers();

  // Mutation
  const { transferTeacher } = useTeacherAssignmentMutations();
  const isSubmitting = transferTeacher.isPending;

  // Filter teachers by search and exclude current teacher
  const filteredTeachers = useMemo(() => {
    return teachers.filter(teacher => {
      // Exclude current teacher
      if (currentAssignment && teacher.id === currentAssignment.teacher_id) {
        return false;
      }
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return teacher.display_name.toLowerCase().includes(query) ||
               teacher.email?.toLowerCase().includes(query);
      }
      return true;
    });
  }, [teachers, currentAssignment, searchQuery]);

  // Get selected teacher
  const selectedTeacher = useMemo(() => {
    return teachers.find(t => t.id === selectedTeacherId);
  }, [teachers, selectedTeacherId]);

  // Handle teacher selection - prefill rate
  function handleTeacherSelect(teacher: Teacher) {
    setSelectedTeacherId(teacher.id);
    if (teacher.default_hourly_rate && !hourlyRate) {
      setHourlyRate(teacher.default_hourly_rate.toString());
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTeacherId || !enrollmentId) return;

    setError(null);

    const effectiveDate = new Date().toISOString().split('T')[0];

    // FIXED: Updated to match new hook signature
    transferTeacher.mutate(
      {
        enrollmentId,
        oldTeacherId: currentAssignment?.teacher_id,
        newTeacherId: selectedTeacherId,
        hourlyRate: hourlyRate ? parseFloat(hourlyRate) : undefined,
        hoursPerWeek: hoursPerWeek 
          ? parseFloat(hoursPerWeek) 
          : currentAssignment?.hours_per_week || undefined,
        effectiveDate,
        endPrevious: !!currentAssignment
      },
      {
        onSuccess: () => {
          // Invalidate related queries
          queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.teacherAssignments.all });
          if (currentAssignment) {
            queryClient.invalidateQueries({ 
              queryKey: queryKeys.teacherAssignments.byTeacher(currentAssignment.teacher_id) 
            });
          }
          queryClient.invalidateQueries({ 
            queryKey: queryKeys.teacherAssignments.byTeacher(selectedTeacherId) 
          });
          queryClient.invalidateQueries({ 
            queryKey: queryKeys.teacherAssignments.byEnrollment(enrollmentId) 
          });

          onSuccess?.();
          handleClose();
        },
        onError: (err) => {
          console.error('Failed to transfer teacher:', err);
          setError(err instanceof Error ? err.message : 'Failed to transfer teacher');
        }
      }
    );
  }

  function handleClose() {
    setSelectedTeacherId(null);
    setSearchQuery('');
    setHourlyRate('');
    setHoursPerWeek('');
    setNotes('');
    setError(null);
    transferTeacher.reset();
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {currentAssignment ? 'Transfer Teacher' : 'Assign Teacher'}
            </h2>
            <p className="text-sm text-zinc-400 mt-0.5">
              {studentName} • {serviceName}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-zinc-400" />
          </button>
        </div>

        {/* Current Assignment */}
        {currentAssignment && (
          <div className="px-6 py-3 bg-zinc-800/50 border-b border-zinc-800">
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-2 text-zinc-400">
                <User className="w-4 h-4" />
                <span>Current:</span>
                <span className="text-white font-medium">
                  {currentAssignment.teacher.display_name}
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-600" />
              <span className="text-zinc-400">
                {selectedTeacher ? (
                  <span className="text-emerald-400">{selectedTeacher.display_name}</span>
                ) : (
                  'Select new teacher'
                )}
              </span>
            </div>
          </div>
        )}

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search teachers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Teacher List */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {loadingTeachers ? (
                <div className="text-center py-4 text-zinc-500">Loading teachers...</div>
              ) : filteredTeachers.length === 0 ? (
                <div className="text-center py-4 text-zinc-500">No teachers found</div>
              ) : (
                filteredTeachers.map(teacher => (
                  <button
                    key={teacher.id}
                    type="button"
                    onClick={() => handleTeacherSelect(teacher)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
                      selectedTeacherId === teacher.id
                        ? 'bg-blue-500/10 border-blue-500 text-white'
                        : 'bg-zinc-800 border-zinc-700 hover:border-zinc-600 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
                        <User className="w-4 h-4 text-zinc-400" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium">{teacher.display_name}</p>
                        {teacher.email && (
                          <p className="text-xs text-zinc-500">{teacher.email}</p>
                        )}
                      </div>
                    </div>
                    {teacher.default_hourly_rate && (
                      <span className="text-sm text-zinc-500">
                        ${teacher.default_hourly_rate}/hr
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Rate and Hours */}
            {selectedTeacherId && (
              <div className="space-y-4 pt-4 border-t border-zinc-800">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1">
                      Hourly Rate ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(e.target.value)}
                      placeholder="70.00"
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1">
                      Hours/Week
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={hoursPerWeek}
                      onChange={(e) => setHoursPerWeek(e.target.value)}
                      placeholder={currentAssignment?.hours_per_week?.toString() || '5'}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">
                    Notes (optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Transfer reason, schedule changes, etc."
                    rows={2}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedTeacherId || isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Transferring...' : currentAssignment ? 'Transfer Teacher' : 'Assign Teacher'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}