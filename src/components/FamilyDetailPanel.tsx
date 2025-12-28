import { useState, useEffect } from 'react'
import { X, Mail, Phone, CreditCard, Calendar, Pencil, UserPlus, ChevronRight, GraduationCap, FileText, Clock, ExternalLink, Send, Bell, CheckCircle, AlertCircle } from 'lucide-react'
import { useEnrollmentsByFamily, useInvoicesByFamily, useInvoiceEmailsByFamily } from '../lib/hooks'
import type { Family, Student, CustomerStatus, EnrollmentStatus, InvoiceStatus } from '../types/database'
import { EditFamilyModal } from './EditFamilyModal'
import { AddStudentModal } from './AddStudentModal'
import { EditStudentModal } from './EditStudentModal'

interface FamilyWithStudents extends Family {
  students: Student[]
}

interface FamilyDetailPanelProps {
  family: FamilyWithStudents
  onClose: () => void
  onFamilyUpdated?: () => void
}

const STATUS_COLORS: Record<CustomerStatus, string> = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  trial: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  paused: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  churned: 'bg-red-500/20 text-red-400 border-red-500/30',
  lead: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

const ENROLLMENT_STATUS_COLORS: Record<EnrollmentStatus, string> = {
  active: 'bg-green-500/20 text-green-400',
  trial: 'bg-blue-500/20 text-blue-400',
  paused: 'bg-amber-500/20 text-amber-400',
  ended: 'bg-zinc-500/20 text-zinc-400',
}

const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-zinc-500/20 text-zinc-400',
  sent: 'bg-blue-500/20 text-blue-400',
  paid: 'bg-green-500/20 text-green-400',
  partial: 'bg-amber-500/20 text-amber-400',
  overdue: 'bg-red-500/20 text-red-400',
  void: 'bg-zinc-500/20 text-zinc-500 line-through',
}

const EMAIL_TYPE_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
  invoice: { color: 'bg-blue-900 text-blue-300', icon: Send, label: 'Invoice Sent' },
  reminder_7_day: { color: 'bg-sky-900 text-sky-300', icon: Clock, label: 'Friendly Reminder' },
  reminder_14_day: { color: 'bg-amber-900 text-amber-300', icon: Bell, label: 'Past Due Reminder' },
  reminder_overdue: { color: 'bg-red-900 text-red-300', icon: AlertCircle, label: 'Urgent Reminder' },
  payment_received: { color: 'bg-green-900 text-green-300', icon: CheckCircle, label: 'Payment Received' },
}

export function FamilyDetailPanel({ family, onClose, onFamilyUpdated }: FamilyDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'enrollments' | 'invoices' | 'history'>('overview')

  // Modal states
  const [showEditFamily, setShowEditFamily] = useState(false)
  const [showAddStudent, setShowAddStudent] = useState(false)
  const [showEditStudent, setShowEditStudent] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)

  // React Query - fetch enrollments for this family
 const { 
  data: enrollments = [] as any[], 
  isLoading: loadingEnrollments 
} = useEnrollmentsByFamily(family.id)

  // React Query - fetch invoices for this family
  const {
    data: invoices = [],
    isLoading: loadingInvoices
  } = useInvoicesByFamily(family.id)

  // React Query - fetch email history for this family
  const {
    data: emailHistory = [],
    isLoading: loadingEmails
  } = useInvoiceEmailsByFamily(family.id)

  // Reset selected student when family changes
  useEffect(() => {
    setSelectedStudent(null)
  }, [family.id])

  const handleFamilyEditSuccess = () => {
    // Modal handles mutation and cache invalidation
    // Parent will receive updated data via React Query
    onFamilyUpdated?.()
  }

  const handleStudentSuccess = () => {
    // Modal handles mutation and cache invalidation
    onFamilyUpdated?.()
  }

  const handleEditStudent = (student: Student) => {
    setSelectedStudent(student)
    setShowEditStudent(true)
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'enrollments', label: 'Enrollments' },
    { id: 'invoices', label: 'Invoices' },
    { id: 'history', label: 'History' },
  ] as const

  // Count active enrollments from React Query data
  const activeEnrollmentCount = enrollments.filter(e => e.status === 'active').length

  // Build a map of student_id -> enrollment info for display
  const studentEnrollmentMap = new Map<string, { total: number; active: number; services: string[] }>()
  enrollments.forEach((enrollment: any) => {
    const studentId = enrollment.student_id
    if (!studentId) return
    
    const existing = studentEnrollmentMap.get(studentId) || { total: 0, active: 0, services: [] }
    existing.total++
    if (enrollment.status === 'active' || enrollment.status === 'trial') {
      existing.active++
    }
    const serviceName = enrollment.service?.name || enrollment.class_title || 'Unknown'
    if (!existing.services.includes(serviceName)) {
      existing.services.push(serviceName)
    }
    studentEnrollmentMap.set(studentId, existing)
  })

  return (
    <>
      <div className="fixed right-0 top-0 h-full w-[480px] bg-zinc-900 border-l border-zinc-800 shadow-2xl flex flex-col z-40">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowEditFamily(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
          </div>
        </div>

        {/* Family Info */}
        <div className="px-6 py-4 border-b border-zinc-800">
          <div className="flex items-start justify-between mb-3">
            <h2 className="text-xl font-semibold text-white">{family.display_name}</h2>
            <span className={`text-sm font-medium rounded-full px-3 py-1 border ${STATUS_COLORS[family.status]}`}>
              {family.status}
            </span>
          </div>

          <div className="space-y-2 text-sm">
            {family.primary_email && (
              <div className="flex items-center gap-2 text-zinc-400">
                <Mail className="h-4 w-4" />
                <a href={`mailto:${family.primary_email}`} className="hover:text-white">
                  {family.primary_email}
                </a>
              </div>
            )}
            {family.primary_phone && (
              <div className="flex items-center gap-2 text-zinc-400">
                <Phone className="h-4 w-4" />
                <a href={`tel:${family.primary_phone}`} className="hover:text-white">
                  {family.primary_phone}
                </a>
              </div>
            )}
            {family.payment_gateway && (
              <div className="flex items-center gap-2 text-zinc-400">
                <CreditCard className="h-4 w-4" />
                <span>{family.payment_gateway}</span>
              </div>
            )}
            {family.last_contact_at && (
              <div className="flex items-center gap-2 text-zinc-400">
                <Calendar className="h-4 w-4" />
                <span>Last contact: {new Date(family.last_contact_at).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'text-white border-blue-500'
                  : 'text-zinc-400 border-transparent hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Students */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
                    Students ({family.students?.length || 0})
                  </h3>
                  <button 
                    onClick={() => setShowAddStudent(true)}
                    className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <UserPlus className="h-4 w-4" />
                    Add
                  </button>
                </div>
                <div className="space-y-2">
                  {!family.students || family.students.length === 0 ? (
                    <p className="text-sm text-zinc-500 py-3">No students yet</p>
                  ) : (
                    family.students.map((student) => {
                      const enrollmentInfo = studentEnrollmentMap.get(student.id)
                      return (
                      <div
                        key={student.id}
                        onClick={() => handleEditStudent(student)}
                        className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg cursor-pointer hover:bg-zinc-700/80 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-zinc-700 rounded-lg">
                            <GraduationCap className="h-4 w-4 text-zinc-400" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white">{student.full_name}</div>
                            <div className="text-xs text-zinc-400">
                              {[student.grade_level, student.age_group].filter(Boolean).join(' • ') || 'No grade info'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {enrollmentInfo && enrollmentInfo.active > 0 && (
                            <span className="text-xs text-green-400 bg-green-500/20 px-2 py-0.5 rounded" title={enrollmentInfo.services.join(', ')}>
                              {enrollmentInfo.active} active
                            </span>
                          )}
                          {enrollmentInfo && enrollmentInfo.total > 0 && enrollmentInfo.active === 0 && (
                            <span className="text-xs text-zinc-400 bg-zinc-700 px-2 py-0.5 rounded">
                              {enrollmentInfo.total} ended
                            </span>
                          )}
                          {!enrollmentInfo && (
                            <span className="text-xs text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded">
                              No enrollments
                            </span>
                          )}
                          {!student.active && (
                            <span className="text-xs text-zinc-500 bg-zinc-700 px-2 py-0.5 rounded">Inactive</span>
                          )}
                          <ChevronRight className="h-4 w-4 text-zinc-500" />
                        </div>
                      </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Quick Stats */}
              <div>
                <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">
                  Quick Stats
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-zinc-800 rounded-lg">
                    <div className="text-2xl font-semibold text-white">
                      {activeEnrollmentCount}
                    </div>
                    <div className="text-xs text-zinc-400">Active Enrollments</div>
                  </div>
                  <div className="p-3 bg-zinc-800 rounded-lg">
                    <div className="text-2xl font-semibold text-white">$0</div>
                    <div className="text-xs text-zinc-400">Outstanding Balance</div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {family.notes && (
                <div>
                  <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">
                    Notes
                  </h3>
                  <p className="text-sm text-zinc-300 bg-zinc-800 rounded-lg p-3">
                    {family.notes}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'enrollments' && (
            <div className="space-y-3">
              {loadingEnrollments ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
                </div>
              ) : enrollments.length === 0 ? (
                <p className="text-sm text-zinc-400 text-center py-8">No enrollments found</p>
              ) : (
                enrollments.map((enrollment: any) => (
                  <div
                    key={enrollment.id}
                    className="p-4 bg-zinc-800 rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-sm font-medium text-white">
                          {enrollment.service?.name || 'Unknown Service'}
                        </div>
                        {enrollment.class_title && (
                          <div className="text-xs text-zinc-400">{enrollment.class_title}</div>
                        )}
                      </div>
                      <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${ENROLLMENT_STATUS_COLORS[enrollment.status as EnrollmentStatus]}`}>
                        {enrollment.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-zinc-400">
                      {enrollment.monthly_rate && (
                        <span>${enrollment.monthly_rate}/mo</span>
                      )}
                      {enrollment.hourly_rate_customer && (
                        <span>${enrollment.hourly_rate_customer}/hr</span>
                      )}
                      {enrollment.hours_per_week && (
                        <span>{enrollment.hours_per_week} hrs/wk</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'invoices' && (
            <div className="space-y-3">
              {loadingInvoices ? (
                <div className="text-sm text-zinc-400 text-center py-8">Loading invoices...</div>
              ) : invoices.length === 0 ? (
                <div className="text-sm text-zinc-400 text-center py-8">No invoices found</div>
              ) : (
                invoices.map((invoice: any) => (
                  <div
                    key={invoice.id}
                    className="p-4 bg-zinc-800 rounded-lg hover:bg-zinc-750 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-zinc-400" />
                        <span className="text-sm font-medium text-white">
                          {invoice.invoice_number || `INV-${invoice.public_id?.slice(0, 6)}`}
                        </span>
                      </div>
                      <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${INVOICE_STATUS_COLORS[invoice.status as InvoiceStatus]}`}>
                        {invoice.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-zinc-400">
                        {invoice.invoice_date && new Date(invoice.invoice_date).toLocaleDateString()}
                        {invoice.period_start && invoice.period_end && (
                          <span className="ml-2">
                            ({new Date(invoice.period_start).toLocaleDateString()} - {new Date(invoice.period_end).toLocaleDateString()})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-medium ${invoice.balance_due > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                          ${invoice.total_amount?.toFixed(2)}
                        </span>
                        {invoice.public_id && (
                          <a
                            href={`/invoice/${invoice.public_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zinc-400 hover:text-white"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>
                    {invoice.balance_due > 0 && invoice.balance_due !== invoice.total_amount && (
                      <div className="mt-2 text-xs text-amber-400">
                        Balance due: ${invoice.balance_due.toFixed(2)}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              {loadingEmails ? (
                <div className="text-sm text-zinc-400 text-center py-8">Loading history...</div>
              ) : emailHistory.length === 0 ? (
                <div className="text-sm text-zinc-400 text-center py-8">No communication history</div>
              ) : (
                emailHistory.map((email: any) => {
                  const config = EMAIL_TYPE_CONFIG[email.email_type] || {
                    color: 'bg-zinc-700 text-zinc-300',
                    icon: Mail,
                    label: email.email_type
                  }
                  const EmailIcon = config.icon
                  const sentDate = new Date(email.sent_at)
                  const now = new Date()
                  const diffDays = Math.floor((now.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24))
                  
                  let timeDisplay = ''
                  if (diffDays === 0) timeDisplay = 'Today'
                  else if (diffDays === 1) timeDisplay = 'Yesterday'
                  else if (diffDays < 7) timeDisplay = `${diffDays} days ago`
                  else timeDisplay = sentDate.toLocaleDateString()
                  
                  return (
                    <div
                      key={email.id}
                      className="p-4 bg-zinc-800 rounded-lg"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${config.color}`}>
                          <EmailIcon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-white">{config.label}</span>
                            <span className="text-xs text-zinc-500">{timeDisplay}</span>
                          </div>
                          <div className="text-xs text-zinc-400 truncate">
                            {email.subject || `Invoice ${email.invoice_number}`}
                          </div>
                          <div className="text-xs text-zinc-500 mt-1">
                            To: {email.sent_to}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Family Modal */}
      <EditFamilyModal
        isOpen={showEditFamily}
        family={family}
        onClose={() => setShowEditFamily(false)}
        onSuccess={handleFamilyEditSuccess}
      />

      {/* Add Student Modal */}
      <AddStudentModal
        isOpen={showAddStudent}
        familyId={family.id}
        familyName={family.display_name}
        onClose={() => setShowAddStudent(false)}
        onSuccess={handleStudentSuccess}
      />

      {/* Edit Student Modal */}
      <EditStudentModal
        isOpen={showEditStudent}
        student={selectedStudent}
        familyId={family.id}
        familyName={family.display_name}
        onClose={() => {
          setShowEditStudent(false)
          setSelectedStudent(null)
        }}
        onSuccess={handleStudentSuccess}
      />
    </>
  )
}