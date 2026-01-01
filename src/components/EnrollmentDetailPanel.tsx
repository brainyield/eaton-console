import { useState } from 'react';
import {
  X,
  Mail,
  Phone,
  Clock,
  User,
  Users,
  GraduationCap,
  BookOpen,
  Pencil,
  UserMinus,
  ArrowRightLeft,
  MoreVertical,
  AlertCircle
} from 'lucide-react';
import { useTeacherAssignmentsByEnrollment } from '../lib/hooks';
import { EmailHistory } from './email';

// Types
type EnrollmentStatus = 'trial' | 'active' | 'paused' | 'ended';

interface Service {
  id: string;
  code: string;
  name: string;
  billing_frequency: string;
}

interface Student {
  id: string;
  full_name: string;
  grade_level: string | null;
}

interface Family {
  id: string;
  display_name: string;
  primary_email: string | null;
  primary_phone: string | null;
}

interface Teacher {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  default_hourly_rate: number | null;
}

interface TeacherAssignment {
  id: string;
  teacher_id: string;
  hourly_rate_teacher: number | null;
  hours_per_week: number | null;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  teacher: Teacher;
}

interface Enrollment {
  id: string;
  family_id: string;
  student_id: string | null;
  service_id: string;
  status: EnrollmentStatus;
  start_date: string | null;
  end_date: string | null;
  monthly_rate: number | null;
  weekly_tuition: number | null;
  hourly_rate_customer: number | null;
  hours_per_week: number | null;
  daily_rate: number | null;
  billing_frequency: string | null;
  class_title: string | null;
  schedule_notes: string | null;
  notes: string | null;
  service: Service;
  student: Student | null;
  family: Family;
}

interface EnrollmentDetailPanelProps {
  enrollment: Enrollment;
  onClose: () => void;
  onEdit: () => void;
  onTransferTeacher: (assignment: TeacherAssignment) => void;
  onEndEnrollment: () => void;
}

const STATUS_COLORS: Record<EnrollmentStatus, string> = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  trial: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  paused: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  ended: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

export function EnrollmentDetailPanel({ 
  enrollment, 
  onClose, 
  onEdit,
  onTransferTeacher,
  onEndEnrollment,
}: EnrollmentDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'schedule' | 'billing' | 'history'>('overview');
  const [showActionsMenu, setShowActionsMenu] = useState(false);

  // React Query - fetch teacher assignments for this enrollment
  const { 
    data: assignments = [], 
    isLoading: loadingAssignments 
  } = useTeacherAssignmentsByEnrollment(enrollment.id);

  function formatRate(): string {
    if (enrollment.hourly_rate_customer && enrollment.hours_per_week) {
      return `$${enrollment.hourly_rate_customer}/hr × ${enrollment.hours_per_week} hrs/wk`;
    }
    if (enrollment.monthly_rate) {
      return `$${enrollment.monthly_rate}/mo`;
    }
    if (enrollment.weekly_tuition) {
      return `$${enrollment.weekly_tuition}/wk`;
    }
    if (enrollment.daily_rate) {
      return `$${enrollment.daily_rate}/day`;
    }
    return 'Rate not set';
  }

  function formatWeeklyRevenue(): string | null {
    if (enrollment.hourly_rate_customer && enrollment.hours_per_week) {
      return `$${(enrollment.hourly_rate_customer * enrollment.hours_per_week).toFixed(2)}/wk`;
    }
    return null;
  }

  // Cast assignments to the expected type
  const typedAssignments = assignments as TeacherAssignment[];
  const activeAssignment = typedAssignments.find(a => a.is_active);
  const pastAssignments = typedAssignments.filter(a => !a.is_active);

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-gray-900 border-l border-gray-700 z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-4 z-10">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onClose}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
              <span>Close</span>
            </button>
            
            {/* Actions Menu */}
            <div className="relative">
              <button
                onClick={() => setShowActionsMenu(!showActionsMenu)}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <span>Actions</span>
                <MoreVertical className="w-4 h-4" />
              </button>
              
              {showActionsMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowActionsMenu(false)} 
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 py-1">
                    <button
                      onClick={() => {
                        setShowActionsMenu(false);
                        onEdit();
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                    >
                      <Pencil className="w-4 h-4" />
                      Edit Enrollment
                    </button>
                    {activeAssignment && (
                      <button
                        onClick={() => {
                          setShowActionsMenu(false);
                          onTransferTeacher(activeAssignment);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                        Transfer Teacher
                      </button>
                    )}
                    {enrollment.status !== 'ended' && (
                      <button
                        onClick={() => {
                          setShowActionsMenu(false);
                          onEndEnrollment();
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-gray-700 hover:text-red-300"
                      >
                        <UserMinus className="w-4 h-4" />
                        End Enrollment
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Service & Status */}
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gray-800 rounded-lg">
              <BookOpen className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {enrollment.service.name}
              </h2>
              {enrollment.class_title && (
                <p className="text-sm text-gray-400">{enrollment.class_title}</p>
              )}
            </div>
            <span className={`ml-auto text-sm font-medium rounded-full px-3 py-1 border ${STATUS_COLORS[enrollment.status]}`}>
              {enrollment.status}
            </span>
          </div>

          {/* Student & Family Info */}
          <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
            {enrollment.student && (
              <div className="flex items-center gap-1">
                <GraduationCap className="w-4 h-4" />
                <span>{enrollment.student.full_name}</span>
                {enrollment.student.grade_level && (
                  <span className="text-gray-500">({enrollment.student.grade_level})</span>
                )}
              </div>
            )}
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{enrollment.family.display_name}</span>
            </div>
          </div>

          {/* Contact Info */}
          <div className="flex flex-col gap-2 text-sm">
            {enrollment.family.primary_email && (
              <a
                href={`mailto:${enrollment.family.primary_email}`}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <Mail className="w-4 h-4 flex-shrink-0" />
                <span>{enrollment.family.primary_email}</span>
              </a>
            )}
            {enrollment.family.primary_phone && (
              <a
                href={`tel:${enrollment.family.primary_phone}`}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <Phone className="w-4 h-4 flex-shrink-0" />
                <span>{enrollment.family.primary_phone}</span>
              </a>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-700 px-6">
          <div className="flex gap-1">
            {(['overview', 'schedule', 'billing', 'history'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? 'text-white border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Current Teacher */}
              <div>
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Current Teacher
                </h3>
                {loadingAssignments ? (
                  <div className="bg-gray-800 rounded-lg p-4 text-center text-gray-400">
                    Loading...
                  </div>
                ) : activeAssignment ? (
                  <div className="bg-gray-800 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-700 rounded-lg">
                          <User className="w-5 h-5 text-gray-300" />
                        </div>
                        <div>
                          <p className="font-medium text-white">
                            {activeAssignment.teacher.display_name}
                          </p>
                          <div className="flex items-center gap-3 text-sm text-gray-400 mt-1">
                            {activeAssignment.hourly_rate_teacher && (
                              <span>${activeAssignment.hourly_rate_teacher}/hr</span>
                            )}
                            {activeAssignment.hours_per_week && (
                              <span>{activeAssignment.hours_per_week} hrs/wk</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => onTransferTeacher(activeAssignment)}
                        className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                        Transfer
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-800 rounded-lg p-4 flex items-center gap-3 text-gray-400">
                    <AlertCircle className="w-5 h-5 text-amber-400" />
                    <span>No teacher assigned</span>
                    <button
                      onClick={() => onEdit()}
                      className="ml-auto text-sm text-blue-400 hover:text-blue-300"
                    >
                      Assign Teacher
                    </button>
                  </div>
                )}

                {/* Past Assignments */}
                {pastAssignments.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-gray-500 mb-2">Previous Teachers</p>
                    <div className="space-y-2">
                      {pastAssignments.map(assignment => (
                        <div key={assignment.id} className="bg-gray-800/50 rounded-lg p-3 flex items-center gap-3">
                          <User className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-400">
                            {assignment.teacher.display_name}
                          </span>
                          {assignment.start_date && assignment.end_date && (
                            <span className="text-xs text-gray-500 ml-auto">
                              {new Date(assignment.start_date).toLocaleDateString()} - {new Date(assignment.end_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Billing Summary */}
              <div>
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Billing
                </h3>
                <div className="bg-gray-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Rate</span>
                    <span className="text-white font-medium">{formatRate()}</span>
                  </div>
                  {formatWeeklyRevenue() && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Weekly Revenue</span>
                      <span className="text-emerald-400 font-medium">{formatWeeklyRevenue()}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Billing Frequency</span>
                    <span className="text-white">{enrollment.billing_frequency || enrollment.service.billing_frequency}</span>
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div>
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Dates
                </h3>
                <div className="bg-gray-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Start Date</span>
                    <span className="text-white">
                      {enrollment.start_date 
                        ? new Date(enrollment.start_date).toLocaleDateString() 
                        : 'Not set'}
                    </span>
                  </div>
                  {enrollment.end_date && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">End Date</span>
                      <span className="text-white">
                        {new Date(enrollment.end_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              {(enrollment.schedule_notes || enrollment.notes) && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                    Notes
                  </h3>
                  <div className="bg-gray-800 rounded-lg p-4 space-y-3">
                    {enrollment.schedule_notes && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Schedule</p>
                        <p className="text-gray-300 text-sm">{enrollment.schedule_notes}</p>
                      </div>
                    )}
                    {enrollment.notes && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">General</p>
                        <p className="text-gray-300 text-sm">{enrollment.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">Schedule details</p>
              {enrollment.schedule_notes ? (
                <div className="mt-4 bg-gray-800 rounded-lg p-4 text-left">
                  <p className="text-gray-300">{enrollment.schedule_notes}</p>
                </div>
              ) : (
                <p className="text-gray-500 text-sm mt-2">No schedule notes available</p>
              )}
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Customer Rate</h4>
                <div className="grid grid-cols-2 gap-4">
                  {enrollment.hourly_rate_customer && (
                    <div>
                      <p className="text-xs text-gray-500">Hourly Rate</p>
                      <p className="text-lg font-medium text-white">${enrollment.hourly_rate_customer}</p>
                    </div>
                  )}
                  {enrollment.hours_per_week && (
                    <div>
                      <p className="text-xs text-gray-500">Hours/Week</p>
                      <p className="text-lg font-medium text-white">{enrollment.hours_per_week}</p>
                    </div>
                  )}
                  {enrollment.monthly_rate && (
                    <div>
                      <p className="text-xs text-gray-500">Monthly Rate</p>
                      <p className="text-lg font-medium text-white">${enrollment.monthly_rate}</p>
                    </div>
                  )}
                  {enrollment.weekly_tuition && (
                    <div>
                      <p className="text-xs text-gray-500">Weekly Tuition</p>
                      <p className="text-lg font-medium text-white">${enrollment.weekly_tuition}</p>
                    </div>
                  )}
                </div>
              </div>

              {activeAssignment && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-400 mb-3">Teacher Cost</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {activeAssignment.hourly_rate_teacher && (
                      <div>
                        <p className="text-xs text-gray-500">Teacher Rate</p>
                        <p className="text-lg font-medium text-white">${activeAssignment.hourly_rate_teacher}/hr</p>
                      </div>
                    )}
                    {activeAssignment.hours_per_week && (
                      <div>
                        <p className="text-xs text-gray-500">Weekly Cost</p>
                        <p className="text-lg font-medium text-amber-400">
                          ${(activeAssignment.hourly_rate_teacher || 0) * (activeAssignment.hours_per_week || 0)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Profit calculation */}
              {activeAssignment && enrollment.hourly_rate_customer && enrollment.hours_per_week && activeAssignment.hourly_rate_teacher && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-emerald-400 mb-3">Weekly Margin</h4>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Revenue - Cost</span>
                    <span className="text-xl font-bold text-emerald-400">
                      ${((enrollment.hourly_rate_customer - activeAssignment.hourly_rate_teacher) * enrollment.hours_per_week).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <EmailHistory
              email={enrollment.family.primary_email}
              familyId={enrollment.family_id}
            />
          )}
        </div>
      </div>
    </>
  );
}