import { useState } from 'react'
import { X, Mail, Phone, MessageSquare, Pencil, Plus } from 'lucide-react'
import { useTeacherAssignmentsByTeacher, useTeacherPaymentsByTeacher } from '../lib/hooks'
import { EditTeacherModal } from './EditTeacherModal'
import { RecordTeacherPaymentModal } from './RecordTeacherPaymentModal'

interface Teacher {
  id: string
  display_name: string
  email: string | null
  phone: string | null
  role: string | null
  skillset: string | null
  preferred_comm_method: string | null
  status: 'active' | 'reserve' | 'inactive'
  default_hourly_rate: number | null
  max_hours_per_week: number | null
  payment_info_on_file: boolean
  hire_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  active_assignments?: number
  assigned_hours?: number
}

interface Assignment {
  id: string
  enrollment_id: string
  hourly_rate_teacher: number | null
  hours_per_week: number | null
  is_active: boolean
  student_name: string
  family_name: string
  service_name: string
}

interface Payment {
  id: string
  pay_period_start: string
  pay_period_end: string
  pay_date: string
  total_amount: number
  payment_method: string | null
  notes: string | null
}

type Tab = 'overview' | 'assignments' | 'payroll'

export default function TeacherDetailPanel({
  teacher,
  onClose,
  onTeacherUpdated,
}: {
  teacher: Teacher
  onClose: () => void
  onTeacherUpdated?: () => void
}) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  // Modal state
  const [showEditTeacher, setShowEditTeacher] = useState(false)
  const [showRecordPayment, setShowRecordPayment] = useState(false)

  // React Query - fetch assignments (enabled when on assignments tab)
  const { 
    data: rawAssignments = [], 
    isLoading: loadingAssignments 
  } = useTeacherAssignmentsByTeacher(teacher.id, {
    enabled: activeTab === 'assignments' || activeTab === 'overview'
  })

  // React Query - fetch payments (enabled when on payroll tab)
  const { 
    data: payments = [], 
    isLoading: loadingPayments 
  } = useTeacherPaymentsByTeacher(teacher.id, {
    enabled: activeTab === 'payroll'
  })

  // Transform assignments to match the Assignment interface
  const assignments: Assignment[] = rawAssignments.map((a: any) => ({
    id: a.id,
    enrollment_id: a.enrollment_id,
    hourly_rate_teacher: a.hourly_rate_teacher,
    hours_per_week: a.hours_per_week,
    is_active: a.is_active,
    student_name: a.enrollment?.student?.full_name || 'Unknown',
    family_name: a.enrollment?.family?.display_name || 'Unknown',
    service_name: a.enrollment?.service?.name || 'Unknown',
  }))

  // Calculate stats from assignments
  const activeAssignmentCount = assignments.filter(a => a.is_active).length
  const assignedHours = assignments
    .filter(a => a.is_active)
    .reduce((sum, a) => sum + (a.hours_per_week || 0), 0)

  // Merge computed stats with teacher data
  const teacherWithStats: Teacher = {
    ...teacher,
    active_assignments: activeAssignmentCount,
    assigned_hours: assignedHours,
  }

  const handleEditSuccess = () => {
    // Modal handles mutation and cache invalidation
    onTeacherUpdated?.()
  }

  const handlePaymentSuccess = () => {
    // Modal handles mutation and cache invalidation
    // React Query will refetch payments automatically
    onTeacherUpdated?.()
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'assignments', label: 'Assignments' },
    { key: 'payroll', label: 'Payroll' },
  ]

  return (
    <>
      <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-background border-l border-border shadow-xl z-40 flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-border p-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-semibold">{teacher.display_name}</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowEditTeacher(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={onClose}
                className="p-1 hover:bg-accent rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Contact Info */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
            {teacher.email && (
              <a href={`mailto:${teacher.email}`} className="flex items-center gap-1 hover:text-foreground">
                <Mail className="w-3.5 h-3.5" />
                {teacher.email}
              </a>
            )}
            {teacher.phone && (
              <a href={`tel:${teacher.phone}`} className="flex items-center gap-1 hover:text-foreground">
                <Phone className="w-3.5 h-3.5" />
                {teacher.phone}
              </a>
            )}
          </div>

          {/* Status Badge & Role */}
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              teacher.status === 'active' ? 'bg-green-500/20 text-green-400' :
              teacher.status === 'reserve' ? 'bg-blue-500/20 text-blue-400' :
              'bg-zinc-500/20 text-zinc-400'
            }`}>
              {teacher.status}
            </span>
            <span className="text-sm text-muted-foreground">
              {teacher.role || 'No role'}
            </span>
            {teacher.preferred_comm_method && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MessageSquare className="w-3 h-3" />
                {teacher.preferred_comm_method}
              </span>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  activeTab === tab.key
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto p-4">
          {activeTab === 'overview' && <OverviewTab teacher={teacherWithStats} />}
          {activeTab === 'assignments' && (
            <AssignmentsTab assignments={assignments} loading={loadingAssignments} />
          )}
          {activeTab === 'payroll' && (
            <PayrollTab 
              payments={payments as Payment[]} 
              loading={loadingPayments} 
              onRecordPayment={() => setShowRecordPayment(true)}
            />
          )}
        </div>
      </div>

      {/* Edit Teacher Modal */}
      <EditTeacherModal
        isOpen={showEditTeacher}
        teacher={teacher}
        onClose={() => setShowEditTeacher(false)}
        onSuccess={handleEditSuccess}
      />

      {/* Record Payment Modal */}
      <RecordTeacherPaymentModal
        isOpen={showRecordPayment}
        teacher={teacher}
        onClose={() => setShowRecordPayment(false)}
        onSuccess={handlePaymentSuccess}
      />
    </>
  )
}

// Overview Tab
function OverviewTab({ teacher }: { teacher: Teacher }) {
  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 bg-card border border-border rounded-lg">
          <div className="text-2xl font-bold">{teacher.active_assignments || 0}</div>
          <div className="text-sm text-muted-foreground">Active Students</div>
        </div>
        <div className="p-3 bg-card border border-border rounded-lg">
          <div className="text-2xl font-bold">
            {teacher.assigned_hours || 0}/{teacher.max_hours_per_week || '—'}
          </div>
          <div className="text-sm text-muted-foreground">Hours/Week</div>
        </div>
        <div className="p-3 bg-card border border-border rounded-lg">
          <div className="text-2xl font-bold">
            {teacher.default_hourly_rate ? `$${teacher.default_hourly_rate}` : '—'}
          </div>
          <div className="text-sm text-muted-foreground">Default Rate</div>
        </div>
        <div className="p-3 bg-card border border-border rounded-lg">
          <div className="text-2xl font-bold">
            {teacher.payment_info_on_file ? '✓' : '⚠'}
          </div>
          <div className="text-sm text-muted-foreground">Payment Info</div>
        </div>
      </div>

      {/* Hire Date */}
      {teacher.hire_date && (
        <div>
          <h4 className="text-sm font-medium mb-2">Hire Date</h4>
          <p className="text-sm text-muted-foreground">
            {new Date(teacher.hire_date).toLocaleDateString()}
          </p>
        </div>
      )}

      {/* Skillset */}
      {teacher.skillset && (
        <div>
          <h4 className="text-sm font-medium mb-2">Skillset</h4>
          <p className="text-sm text-muted-foreground bg-card border border-border rounded-lg p-3">
            {teacher.skillset}
          </p>
        </div>
      )}

      {/* Notes */}
      {teacher.notes && (
        <div>
          <h4 className="text-sm font-medium mb-2">Notes</h4>
          <p className="text-sm text-muted-foreground bg-card border border-border rounded-lg p-3">
            {teacher.notes}
          </p>
        </div>
      )}
    </div>
  )
}

// Assignments Tab
function AssignmentsTab({ 
  assignments, 
  loading 
}: { 
  assignments: Assignment[]
  loading: boolean 
}) {
  if (loading) {
    return <div className="text-muted-foreground text-center py-8">Loading assignments...</div>
  }

  if (assignments.length === 0) {
    return <div className="text-muted-foreground text-center py-8">No active assignments</div>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium">Current Assignments</h4>
        <button className="text-xs text-primary hover:underline">+ New Assignment</button>
      </div>

      {assignments.map(assignment => (
        <div
          key={assignment.id}
          className="p-3 bg-card border border-border rounded-lg"
        >
          <div className="flex items-start justify-between mb-1">
            <div>
              <div className="font-medium">{assignment.student_name}</div>
              <div className="text-sm text-muted-foreground">{assignment.family_name}</div>
            </div>
            <span className="text-xs bg-accent px-2 py-0.5 rounded">
              {assignment.service_name}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
            <span>{assignment.hours_per_week || 0} hrs/wk</span>
            <span>${assignment.hourly_rate_teacher || '—'}/hr</span>
          </div>
        </div>
      ))}

      <div className="text-sm text-muted-foreground pt-2 border-t border-border">
        Total: {assignments.reduce((sum, a) => sum + (a.hours_per_week || 0), 0)} hrs/wk
      </div>
    </div>
  )
}

// Payroll Tab
function PayrollTab({ 
  payments, 
  loading,
  onRecordPayment,
}: { 
  payments: Payment[]
  loading: boolean
  onRecordPayment: () => void
}) {
  if (loading) {
    return <div className="text-muted-foreground text-center py-8">Loading payroll...</div>
  }

  const totalPaid = payments.reduce((sum, p) => sum + (p.total_amount || 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Payment History</h4>
        <button 
          onClick={onRecordPayment}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Plus className="w-3 h-3" />
          Record Payment
        </button>
      </div>

      {payments.length === 0 ? (
        <div className="text-muted-foreground text-center py-8">No payment history</div>
      ) : (
        <>
          <div className="overflow-hidden border border-border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2 font-medium">Pay Date</th>
                  <th className="text-left p-2 font-medium">Period</th>
                  <th className="text-right p-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(payment => (
                  <tr key={payment.id} className="border-t border-border hover:bg-accent/50">
                    <td className="p-2">
                      {new Date(payment.pay_date).toLocaleDateString()}
                    </td>
                    <td className="p-2 text-muted-foreground">
                      {new Date(payment.pay_period_start).toLocaleDateString()} - {new Date(payment.pay_period_end).toLocaleDateString()}
                    </td>
                    <td className="p-2 text-right font-medium">
                      ${payment.total_amount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-sm text-muted-foreground pt-2">
            Total paid (shown): <span className="font-medium text-foreground">${totalPaid.toFixed(2)}</span>
          </div>
        </>
      )}
    </div>
  )
}