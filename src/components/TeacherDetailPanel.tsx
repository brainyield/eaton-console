import { useState, useMemo } from 'react'
import {
  X,
  User,
  Mail,
  Phone,
  Clock,
  DollarSign,
  CreditCard,
  Edit2,
  ChevronUp,
  ChevronDown,
  Briefcase,
  GraduationCap,
  Plus,
} from 'lucide-react'
import {
  useTeacherWithLoad,
  useTeacherAssignments,
  useTeacherPaymentsByTeacher,
  getServiceBadgeColor,
  getServiceShortName,
  type TeacherAssignmentWithDetails,
} from '../lib/hooks'
import { EditTeacherModal } from './EditTeacherModal'
import { RecordTeacherPaymentModal } from './RecordTeacherPaymentModal'
import { EditAssignmentModal } from './EditAssignmentModal'
import { AddAssignmentModal } from './AddAssignmentModal'

interface TeacherDetailPanelProps {
  teacherId: string
  onClose: () => void
}

type Tab = 'overview' | 'assignments' | 'payroll' | 'history'

export default function TeacherDetailPanel({ teacherId, onClose }: TeacherDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showEditAssignmentModal, setShowEditAssignmentModal] = useState(false)
  const [showAddAssignmentModal, setShowAddAssignmentModal] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState<TeacherAssignmentWithDetails | null>(null)

  const { data: teacher, isLoading: teacherLoading } = useTeacherWithLoad(teacherId)
  const { data: assignments } = useTeacherAssignments(teacherId)
  const { data: payments, isLoading: paymentsLoading } = useTeacherPaymentsByTeacher(teacherId)

  // Handler for clicking an assignment card
  const handleAssignmentClick = (assignment: TeacherAssignmentWithDetails) => {
    setSelectedAssignment(assignment)
    setShowEditAssignmentModal(true)
  }

  if (teacherLoading || !teacher) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
        <div className="w-full max-w-2xl bg-gray-900 border-l border-gray-700 p-6 animate-pulse">
          <div className="h-8 bg-gray-700 rounded w-1/2 mb-4" />
          <div className="space-y-3">
            <div className="h-4 bg-gray-700 rounded w-3/4" />
            <div className="h-4 bg-gray-700 rounded w-1/2" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-gray-900 border-l border-gray-700 h-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-4 z-10">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-xl font-bold text-white">{teacher.display_name}</h2>
              <p className="text-sm text-gray-400">{teacher.role || 'Teacher'}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowEditModal(true)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <Edit2 className="h-4 w-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Contact Info */}
          <div className="flex flex-wrap gap-4 text-sm">
            {teacher.email && (
              <a
                href={`mailto:${teacher.email}`}
                className="flex items-center gap-1.5 text-gray-400 hover:text-blue-400"
              >
                <Mail className="h-4 w-4" />
                {teacher.email}
              </a>
            )}
            {teacher.phone && (
              <a
                href={`tel:${teacher.phone}`}
                className="flex items-center gap-1.5 text-gray-400 hover:text-blue-400"
              >
                <Phone className="h-4 w-4" />
                {teacher.phone}
              </a>
            )}
            {teacher.preferred_comm_method && (
              <span className="flex items-center gap-1.5 text-gray-500">
                Prefers: {teacher.preferred_comm_method}
              </span>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 -mb-4 border-b border-gray-700">
            {(['overview', 'assignments', 'payroll'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {activeTab === 'overview' && (
            <OverviewTab teacher={teacher} />
          )}
          {activeTab === 'assignments' && (
            <AssignmentsTab
              assignments={assignments || []}
              onAssignmentClick={handleAssignmentClick}
              onAddAssignment={() => setShowAddAssignmentModal(true)}
            />
          )}
          {activeTab === 'payroll' && (
            <PayrollTab
              payments={payments || []}
              isLoading={paymentsLoading}
              onRecordPayment={() => setShowPaymentModal(true)}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <EditTeacherModal
        isOpen={showEditModal}
        teacher={teacher}
        onClose={() => setShowEditModal(false)}
      />

      <RecordTeacherPaymentModal
        isOpen={showPaymentModal}
        teacher={teacher}
        onClose={() => setShowPaymentModal(false)}
      />

      <EditAssignmentModal
        isOpen={showEditAssignmentModal}
        assignment={selectedAssignment}
        onClose={() => {
          setShowEditAssignmentModal(false)
          setSelectedAssignment(null)
        }}
      />

      <AddAssignmentModal
        isOpen={showAddAssignmentModal}
        teacherId={teacherId}
        teacherName={teacher.display_name}
        defaultRate={teacher.default_hourly_rate}
        onClose={() => setShowAddAssignmentModal(false)}
      />
    </div>
  )
}

// ============================================================================
// OVERVIEW TAB
// ============================================================================

function OverviewTab({ teacher }: { teacher: any }) {
  const maxHours = teacher.max_hours_per_week ?? 30

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          icon={<User className="h-5 w-5" />}
          label="Active Students"
          value={teacher.totalActiveStudents.toString()}
          sublabel={`${teacher.enrollmentAssignmentCount} assignments`}
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="Hours/Week"
          value={teacher.hoursDisplay}
          sublabel={`of ${maxHours} max${teacher.hasVariableHours ? ' (+ variable)' : ''}`}
        />
        <StatCard
          icon={<DollarSign className="h-5 w-5" />}
          label="Rate Range"
          value={teacher.rateDisplay}
          sublabel={teacher.avgRate ? `Avg: $${teacher.avgRate}/hr` : undefined}
        />
        <StatCard
          icon={<CreditCard className="h-5 w-5" />}
          label="Payment Info"
          value={teacher.payment_info_on_file ? 'On File' : 'Missing'}
          valueClass={teacher.payment_info_on_file ? 'text-green-400' : 'text-amber-400'}
        />
      </div>

      {/* Service Assignments Summary */}
      {teacher.serviceAssignmentCount > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Service Assignments</h3>
          <div className="flex flex-wrap gap-2">
            {teacher.allAssignments
              .filter((a: TeacherAssignmentWithDetails) => a.service_id && !a.enrollment_id)
              .map((a: TeacherAssignmentWithDetails) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-700/50 rounded-lg border border-gray-600"
                >
                  <span className="text-sm font-medium text-white">
                    {a.service?.name}
                  </span>
                  <span className="text-xs text-gray-400">
                    {a.hours_per_week ? `${a.hours_per_week}h` : 'Variable'} × ${a.hourly_rate_teacher}/hr
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Skillset */}
      {teacher.skillset && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Skillset</h3>
          <p className="text-gray-300">{teacher.skillset}</p>
        </div>
      )}

      {/* Notes */}
      {teacher.notes && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Notes</h3>
          <p className="text-gray-300 whitespace-pre-wrap">{teacher.notes}</p>
        </div>
      )}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  sublabel,
  valueClass = 'text-white',
}: {
  icon: React.ReactNode
  label: string
  value: string
  sublabel?: string
  valueClass?: string
}) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center gap-2 text-gray-400 mb-2">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${valueClass}`}>{value}</div>
      {sublabel && <div className="text-sm text-gray-500 mt-1">{sublabel}</div>}
    </div>
  )
}

// ============================================================================
// ASSIGNMENTS TAB
// ============================================================================

function AssignmentsTab({
  assignments,
  onAssignmentClick,
  onAddAssignment,
}: {
  assignments: TeacherAssignmentWithDetails[]
  onAssignmentClick: (assignment: TeacherAssignmentWithDetails) => void
  onAddAssignment: () => void
}) {
  const [showInactive, setShowInactive] = useState(false)

  // Separate active and inactive
  const activeAssignments = assignments.filter(a => a.is_active)
  const inactiveAssignments = assignments.filter(a => !a.is_active)

  // Filter based on toggle
  const displayedAssignments = showInactive ? assignments : activeAssignments

  const enrollmentAssignments = displayedAssignments.filter(a => a.enrollment_id)
  const serviceAssignments = displayedAssignments.filter(a => a.service_id && !a.enrollment_id)

  // Calculate totals from ACTIVE assignments only
  const totalHours = activeAssignments.reduce((sum, a) => sum + (a.hours_per_week ?? 0), 0)
  const hasVariable = activeAssignments.some(a => a.hours_per_week === null)

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">
          {activeAssignments.length} active assignment{activeAssignments.length !== 1 ? 's' : ''}
          <span className="ml-2">
            • Total: {totalHours} hrs/wk{hasVariable ? ' (+ variable)' : ''}
          </span>
        </div>
        <button
          onClick={onAddAssignment}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Assignment
        </button>
      </div>

      {/* Show Inactive Toggle - only show if there are inactive assignments */}
      {inactiveAssignments.length > 0 && (
        <div className="flex items-center gap-2 py-2 px-3 bg-gray-800/50 border border-gray-700 rounded-lg">
          <button
            onClick={() => setShowInactive(!showInactive)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              showInactive ? 'bg-amber-600' : 'bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                showInactive ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
          <span className="text-sm text-gray-400">
            Show inactive ({inactiveAssignments.length})
          </span>
          {showInactive && (
            <span className="text-xs text-amber-400 ml-auto">
              Click assignment to delete
            </span>
          )}
        </div>
      )}

      {/* Service-Level Assignments */}
      {serviceAssignments.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Service Assignments ({serviceAssignments.filter(a => a.is_active).length})
            {showInactive && serviceAssignments.some(a => !a.is_active) && (
              <span className="text-xs text-amber-400">
                +{serviceAssignments.filter(a => !a.is_active).length} inactive
              </span>
            )}
          </h3>
          <div className="space-y-2">
            {serviceAssignments.map((assignment) => (
              <ServiceAssignmentCard
                key={assignment.id}
                assignment={assignment}
                onClick={() => onAssignmentClick(assignment)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Enrollment-Level Assignments */}
      {enrollmentAssignments.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            Student Assignments ({enrollmentAssignments.filter(a => a.is_active).length})
            {showInactive && enrollmentAssignments.some(a => !a.is_active) && (
              <span className="text-xs text-amber-400">
                +{enrollmentAssignments.filter(a => !a.is_active).length} inactive
              </span>
            )}
          </h3>
          <div className="space-y-2">
            {enrollmentAssignments.map((assignment) => (
              <EnrollmentAssignmentCard
                key={assignment.id}
                assignment={assignment}
                onClick={() => onAssignmentClick(assignment)}
              />
            ))}
          </div>
        </div>
      )}

      {displayedAssignments.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          {showInactive ? 'No assignments' : 'No active assignments'}
        </div>
      )}
    </div>
  )
}

function ServiceAssignmentCard({
  assignment,
  onClick,
}: {
  assignment: TeacherAssignmentWithDetails
  onClick: () => void
}) {
  const serviceCode = assignment.service?.code || 'unknown'
  const serviceName = assignment.service?.name || 'Unknown Service'
  const isInactive = !assignment.is_active

  return (
    <button
      onClick={onClick}
      className={`w-full text-left border rounded-lg p-4 transition-colors cursor-pointer ${
        isInactive
          ? 'bg-gray-800/30 border-gray-700/50 opacity-60 hover:border-red-500/50 hover:opacity-80'
          : 'bg-gray-800 border-gray-700 hover:border-blue-500/50 hover:bg-gray-800/80'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 text-xs rounded border ${getServiceBadgeColor(serviceCode)}`}>
            {getServiceShortName(serviceCode)}
          </span>
          <span className={`font-medium ${isInactive ? 'text-gray-400 line-through' : 'text-white'}`}>
            {serviceName}
          </span>
          {isInactive && (
            <span className="px-2 py-0.5 text-xs bg-gray-700 text-gray-400 rounded">
              Inactive
            </span>
          )}
        </div>
        <div className="text-sm text-gray-400">
          {assignment.hours_per_week ? (
            <span>{assignment.hours_per_week} hrs/session × ${assignment.hourly_rate_teacher}/hr</span>
          ) : (
            <span>Variable hrs × ${assignment.hourly_rate_teacher}/hr</span>
          )}
        </div>
      </div>
      {assignment.notes && (
        <p className="text-sm text-gray-500 mt-2">{assignment.notes}</p>
      )}
      {isInactive && assignment.end_date && (
        <p className="text-xs text-gray-500 mt-2">
          Ended: {new Date(assignment.end_date).toLocaleDateString()}
        </p>
      )}
    </button>
  )
}

function EnrollmentAssignmentCard({
  assignment,
  onClick,
}: {
  assignment: TeacherAssignmentWithDetails
  onClick: () => void
}) {
  const student = assignment.enrollment?.student
  const family = student?.family
  const service = assignment.enrollment?.service

  const serviceCode = service?.code || 'unknown'
  const isInactive = !assignment.is_active

  return (
    <button
      onClick={onClick}
      className={`w-full text-left border rounded-lg p-4 transition-colors cursor-pointer ${
        isInactive
          ? 'bg-gray-800/30 border-gray-700/50 opacity-60 hover:border-red-500/50 hover:opacity-80'
          : 'bg-gray-800 border-gray-700 hover:border-blue-500/50 hover:bg-gray-800/80'
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className={`font-medium ${isInactive ? 'text-gray-400 line-through' : 'text-white'}`}>
              {student?.full_name || 'Unknown Student'}
            </span>
            <span className={`px-2 py-0.5 text-xs rounded border ${getServiceBadgeColor(serviceCode)}`}>
              {getServiceShortName(serviceCode)}
            </span>
            {isInactive && (
              <span className="px-2 py-0.5 text-xs bg-gray-700 text-gray-400 rounded">
                Inactive
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-1">{family?.display_name || 'Unknown Family'}</p>
        </div>
        <div className="text-right text-sm">
          <div className="text-gray-300">
            {assignment.hours_per_week ? `${assignment.hours_per_week} hrs/wk` : 'Variable'}
          </div>
          <div className="text-gray-500">
            × ${assignment.hourly_rate_teacher}/hr
          </div>
        </div>
      </div>
      {isInactive && assignment.end_date && (
        <p className="text-xs text-gray-500 mt-2">
          Ended: {new Date(assignment.end_date).toLocaleDateString()}
        </p>
      )}
    </button>
  )
}

// ============================================================================
// PAYROLL TAB
// ============================================================================

type PayrollSortKey = 'pay_date' | 'pay_period_start' | 'total_amount'
type SortDirection = 'asc' | 'desc'

function PayrollTab({
  payments,
  isLoading,
  onRecordPayment,
}: {
  payments: any[]
  isLoading: boolean
  onRecordPayment: () => void
}) {
  const [sortKey, setSortKey] = useState<PayrollSortKey>('pay_date')
  const [sortDir, setSortDir] = useState<SortDirection>('desc')

  const sortedPayments = useMemo(() => {
    if (!payments) return []
    return [...payments].sort((a, b) => {
      let aVal = a[sortKey]
      let bVal = b[sortKey]

      // Handle dates
      if (sortKey === 'pay_date' || sortKey === 'pay_period_start') {
        aVal = new Date(aVal).getTime()
        bVal = new Date(bVal).getTime()
      }

      // Handle numbers
      if (typeof aVal === 'string' && !isNaN(parseFloat(aVal))) {
        aVal = parseFloat(aVal)
        bVal = parseFloat(bVal)
      }

      if (sortDir === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
      }
    })
  }, [payments, sortKey, sortDir])

  const toggleSort = (key: PayrollSortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const SortIcon = ({ columnKey }: { columnKey: PayrollSortKey }) => {
    if (sortKey !== columnKey) return null
    return sortDir === 'asc' ? (
      <ChevronUp className="h-3 w-3" />
    ) : (
      <ChevronDown className="h-3 w-3" />
    )
  }

  // Calculate total paid
  const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0)

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-800 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">
          {payments.length} payment{payments.length !== 1 ? 's' : ''} recorded
        </div>
        <button
          onClick={onRecordPayment}
          className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          + Record Payment
        </button>
      </div>

      {/* Table */}
      {payments.length > 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white"
                  onClick={() => toggleSort('pay_date')}
                >
                  <div className="flex items-center gap-1">
                    Pay Date
                    <SortIcon columnKey="pay_date" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white"
                  onClick={() => toggleSort('pay_period_start')}
                >
                  <div className="flex items-center gap-1">
                    Period
                    <SortIcon columnKey="pay_period_start" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white"
                  onClick={() => toggleSort('total_amount')}
                >
                  <div className="flex items-center gap-1 justify-end">
                    Amount
                    <SortIcon columnKey="total_amount" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Method
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {sortedPayments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-700/50">
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {formatDate(payment.pay_date)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {formatDateRange(payment.pay_period_start, payment.pay_period_end)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-green-400">
                    ${parseFloat(payment.total_amount).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {payment.payment_method || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Total */}
          <div className="border-t border-gray-700 px-4 py-3 flex items-center justify-between bg-gray-800/50">
            <span className="text-sm font-medium text-gray-400">Total Paid</span>
            <span className="text-lg font-bold text-green-400">
              ${totalPaid.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          No payment history
        </div>
      )}
    </div>
  )
}

// ============================================================================
// HELPERS
// ============================================================================

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateRange(start: string, end: string): string {
  if (!start || !end) return '—'
  const startDate = new Date(start)
  const endDate = new Date(end)

  const startStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return `${startStr} - ${endStr}`
}