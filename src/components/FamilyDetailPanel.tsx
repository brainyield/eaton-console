import { useEffect, useState } from 'react'
import { X, Mail, Phone, CreditCard, Calendar, Pencil, UserPlus, ChevronRight, GraduationCap } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Family, Student, Enrollment, Service, CustomerStatus, EnrollmentStatus } from '../types/database'
import { EditFamilyModal } from './EditFamilyModal'
import { AddStudentModal } from './AddStudentModal'
import { EditStudentModal } from './EditStudentModal'

interface FamilyWithStudents extends Family {
  students: Student[]
}

interface EnrollmentWithService extends Enrollment {
  service: Service
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

export function FamilyDetailPanel({ family: initialFamily, onClose, onFamilyUpdated }: FamilyDetailPanelProps) {
  const [family, setFamily] = useState<FamilyWithStudents>(initialFamily)
  const [activeTab, setActiveTab] = useState<'overview' | 'enrollments' | 'invoices' | 'history'>('overview')
  const [enrollments, setEnrollments] = useState<EnrollmentWithService[]>([])
  const [loadingEnrollments, setLoadingEnrollments] = useState(true)

  // Modal states
  const [showEditFamily, setShowEditFamily] = useState(false)
  const [showAddStudent, setShowAddStudent] = useState(false)
  const [showEditStudent, setShowEditStudent] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)

  // Update local family when prop changes
  useEffect(() => {
    setFamily(initialFamily)
  }, [initialFamily])

  useEffect(() => {
    fetchEnrollments()
  }, [family.id])

  async function fetchFamilyDetails() {
    try {
      const { data, error } = await supabase
        .from('families')
        .select(`*, students (*)`)
        .eq('id', family.id)
        .single()

      if (!error && data) {
        setFamily(data as FamilyWithStudents)
      }
    } catch (err) {
      console.error('Error fetching family details:', err)
    }
  }

  async function fetchEnrollments() {
    setLoadingEnrollments(true)
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          *,
          service:services(*)
        `)
        .eq('family_id', family.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setEnrollments(data as EnrollmentWithService[] || [])
    } catch (err) {
      console.error('Error fetching enrollments:', err)
    } finally {
      setLoadingEnrollments(false)
    }
  }

  const handleFamilyEditSuccess = () => {
    fetchFamilyDetails()
    onFamilyUpdated?.()
  }

  const handleFamilyDelete = () => {
    onClose()
    onFamilyUpdated?.()
  }

  const handleStudentSuccess = () => {
    fetchFamilyDetails()
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
                    Students ({family.students.length})
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
                  {family.students.length === 0 ? (
                    <p className="text-sm text-zinc-500 py-3">No students yet</p>
                  ) : (
                    family.students.map((student) => (
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
                          {!student.active && (
                            <span className="text-xs text-zinc-500 bg-zinc-700 px-2 py-0.5 rounded">Inactive</span>
                          )}
                          <ChevronRight className="h-4 w-4 text-zinc-500" />
                        </div>
                      </div>
                    ))
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
                      {enrollments.filter(e => e.status === 'active').length}
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
                enrollments.map((enrollment) => (
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
                      <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${ENROLLMENT_STATUS_COLORS[enrollment.status]}`}>
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
            <div className="text-sm text-zinc-400 text-center py-8">
              Invoice history coming soon
            </div>
          )}

          {activeTab === 'history' && (
            <div className="text-sm text-zinc-400 text-center py-8">
              Communication history coming soon
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
        onDelete={handleFamilyDelete}
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
        familyName={family.display_name}
        onClose={() => {
          setShowEditStudent(false)
          setSelectedStudent(null)
        }}
        onSuccess={handleStudentSuccess}
        onDelete={handleStudentSuccess}
      />
    </>
  )
}