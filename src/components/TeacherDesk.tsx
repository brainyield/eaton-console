import { useMemo, useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  User,
  ClipboardCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  GraduationCap,
  ChevronRight,
  Calendar,
  BookOpen,
  X,
} from 'lucide-react'
import {
  useTeacherByToken,
  useTeacherInvites,
  useTeacherStudents,
  type TeacherInviteWithPeriod,
  type TeacherStudent,
} from '../lib/hooks'
import { formatDateLocal } from '../lib/dateUtils'

interface TeacherDeskProps {
  token: string
}

// =============================================================================
// INVALID TOKEN VIEW
// =============================================================================

function InvalidTokenView() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="w-16 h-16 bg-red-900/50 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Invalid or Expired Link</h1>
        <p className="text-zinc-400 mb-6">
          This desk link is not valid. Please contact your administrator if you believe this is an error.
        </p>
        <div className="text-sm text-zinc-500">
          If you've lost your link, please reach out to get a new one.
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// LOADING VIEW
// =============================================================================

function LoadingView() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="animate-pulse text-zinc-400">Loading your desk...</div>
    </div>
  )
}

// =============================================================================
// STUDENT CARD
// =============================================================================

function StudentCard({ student }: { student: TeacherStudent }) {
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 hover:border-zinc-600 transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-zinc-700 rounded-full flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-zinc-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-zinc-100 truncate">{student.student_name}</h4>
          <div className="flex items-center gap-2 mt-1 text-sm text-zinc-400">
            {student.grade_level && (
              <span className="flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5" />
                {student.grade_level}
              </span>
            )}
            {student.service_name && (
              <>
                {student.grade_level && <span className="text-zinc-600">•</span>}
                <span>{student.service_name}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// TASK CARD (Check-in)
// =============================================================================

interface TaskCardProps {
  invite: TeacherInviteWithPeriod
  token: string
  isPending: boolean
}

function TaskCard({ invite, token, isPending }: TaskCardProps) {
  const dueDate = invite.period.closes_at
    ? formatDateLocal(new Date(invite.period.closes_at))
    : null

  return (
    <div className={`bg-zinc-800 border rounded-lg p-4 transition-colors ${
      isPending ? 'border-zinc-700 hover:border-zinc-600' : 'border-zinc-700/50'
    }`}>
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isPending ? 'bg-blue-900/50' : 'bg-green-900/50'
        }`}>
          {isPending ? (
            <ClipboardCheck className="w-5 h-5 text-blue-400" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-green-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Stacks on mobile, side-by-side on larger screens */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h4 className="font-medium text-zinc-100">Monthly Check-in</h4>
              <p className="text-sm text-zinc-400 mt-0.5">{invite.period.display_name}</p>
            </div>

            {isPending ? (
              <Link
                to={`/desk/${token}/checkin/${invite.period_id}`}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors w-full sm:w-auto"
              >
                Complete
                <ChevronRight className="w-4 h-4" />
              </Link>
            ) : (
              <span className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-900/30 text-green-400 text-sm rounded-lg w-full sm:w-auto">
                <CheckCircle2 className="w-4 h-4" />
                Completed
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 mt-3 text-sm text-zinc-500">
            {isPending && dueDate && (
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Due: {dueDate}
              </span>
            )}
            {!isPending && invite.submitted_at && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Submitted: {formatDateLocal(new Date(invite.submitted_at))}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function TeacherDesk({ token }: TeacherDeskProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [showSuccessToast, setShowSuccessToast] = useState(false)

  const { data: teacher, isLoading: teacherLoading, error: teacherError } = useTeacherByToken(token)
  const { data: invites, isLoading: invitesLoading } = useTeacherInvites(teacher?.id)
  const { data: students, isLoading: studentsLoading } = useTeacherStudents(teacher?.id)

  // Show success toast if redirected from form submission
  useEffect(() => {
    if (searchParams.get('submitted') === 'true') {
      setShowSuccessToast(true)
      // Clear the query param
      setSearchParams({}, { replace: true })
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => setShowSuccessToast(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [searchParams, setSearchParams])

  // Separate pending and completed invites
  const { pendingInvites, completedInvites } = useMemo(() => {
    if (!invites) return { pendingInvites: [], completedInvites: [] }

    const pending: TeacherInviteWithPeriod[] = []
    const completed: TeacherInviteWithPeriod[] = []

    invites.forEach(invite => {
      // Only show invites for open periods as pending
      if (invite.status === 'pending' && invite.period.status === 'open') {
        pending.push(invite)
      } else if (invite.status === 'submitted') {
        completed.push(invite)
      }
    })

    // Sort pending by closes_at (earliest first)
    pending.sort((a, b) => {
      if (!a.period.closes_at) return 1
      if (!b.period.closes_at) return -1
      return new Date(a.period.closes_at).getTime() - new Date(b.period.closes_at).getTime()
    })

    // Sort completed by submitted_at (most recent first)
    completed.sort((a, b) => {
      if (!a.submitted_at) return 1
      if (!b.submitted_at) return -1
      return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
    })

    return { pendingInvites: pending, completedInvites: completed }
  }, [invites])

  // Show loading state while fetching teacher
  if (teacherLoading) {
    return <LoadingView />
  }

  // Show invalid token if teacher not found or error
  if (teacherError || !teacher) {
    return <InvalidTokenView />
  }

  const isLoading = invitesLoading || studentsLoading

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-900/50 rounded-full flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Teacher's Desk</h1>
                <p className="text-sm text-zinc-400">Welcome back, {teacher.display_name}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* My Students */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap className="w-5 h-5 text-zinc-400" />
            <h2 className="text-lg font-semibold text-white">
              My Students
              {students && students.length > 0 && (
                <span className="ml-2 text-sm font-normal text-zinc-400">
                  ({students.length} active)
                </span>
              )}
            </h2>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 animate-pulse">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-zinc-700 rounded-full" />
                    <div className="flex-1">
                      <div className="h-4 bg-zinc-700 rounded w-24 mb-2" />
                      <div className="h-3 bg-zinc-700 rounded w-16" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : students && students.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {students.map(student => (
                <StudentCard key={student.student_id} student={student} />
              ))}
            </div>
          ) : (
            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-6 text-center">
              <User className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-zinc-500">No students assigned yet</p>
            </div>
          )}
        </section>

        {/* Pending Tasks */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-white">Pending Tasks</h2>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-zinc-700 rounded-lg" />
                  <div className="flex-1">
                    <div className="h-4 bg-zinc-700 rounded w-32 mb-2" />
                    <div className="h-3 bg-zinc-700 rounded w-24" />
                  </div>
                </div>
              </div>
            </div>
          ) : pendingInvites.length > 0 ? (
            <div className="space-y-3">
              {pendingInvites.map(invite => (
                <TaskCard key={invite.id} invite={invite} token={token} isPending={true} />
              ))}
            </div>
          ) : (
            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-6 text-center">
              <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="text-zinc-400">All caught up! No pending tasks.</p>
            </div>
          )}
        </section>

        {/* Completed Tasks */}
        {completedInvites.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              <h2 className="text-lg font-semibold text-white">Completed</h2>
            </div>

            <div className="space-y-3">
              {completedInvites.map(invite => (
                <TaskCard key={invite.id} invite={invite} token={token} isPending={false} />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 mt-12">
        <div className="max-w-4xl mx-auto px-6 py-6 text-center text-sm text-zinc-500">
          Eaton Academic &copy; {new Date().getFullYear()}
        </div>
      </footer>

      {/* Success Toast */}
      {showSuccessToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="flex items-center gap-3 bg-green-900 border border-green-700 text-green-100 px-4 py-3 rounded-lg shadow-lg">
            <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
            <span>Check-in submitted successfully!</span>
            <button
              onClick={() => setShowSuccessToast(false)}
              className="ml-2 text-green-400 hover:text-green-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
