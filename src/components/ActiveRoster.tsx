import { useState, useMemo, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { 
  Search, 
  Users, 
  BookOpen, 
  GraduationCap, 
  Monitor,
  Home,
  Laptop,
  Star,
  User,
  ChevronDown,
  ChevronRight,
  Clock,
  DollarSign,
  Plus
} from 'lucide-react'
import { useEnrollments, useActiveServices } from '../lib/hooks'
import type { Service, Enrollment } from '../lib/hooks'
import { queryKeys } from '../lib/queryClient'
import { EnrollmentDetailPanel } from './EnrollmentDetailPanel'
import { AddEnrollmentModal } from './AddEnrollmentModal'
import { EditEnrollmentModal } from './EditEnrollmentModal'
import { TransferTeacherModal } from './TransferTeacherModal'
import { EndEnrollmentModal } from './EndEnrollmentModal'

// Types
type EnrollmentStatus = 'trial' | 'active' | 'paused' | 'ended'

interface Student {
  id: string
  full_name: string
  grade_level: string | null
}

interface Family {
  id: string
  display_name: string
  primary_email: string | null
  primary_phone: string | null
}

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
}

interface TeacherAssignment {
  id: string
  enrollment_id: string
  teacher_id: string
  hourly_rate_teacher: number | null
  hours_per_week: number | null
  is_active: boolean
  start_date: string | null
  end_date: string | null
  notes?: string | null
  teacher: Teacher
}

interface EnrollmentWithRelations extends Enrollment {
  service: Service
  student: Student | null
  family: Family
  teacher_assignments: TeacherAssignment[]
}

const STATUS_COLORS: Record<EnrollmentStatus, string> = {
  active: 'bg-green-500/20 text-green-400',
  trial: 'bg-blue-500/20 text-blue-400',
  paused: 'bg-amber-500/20 text-amber-400',
  ended: 'bg-zinc-500/20 text-zinc-400',
}

// Service icons
const serviceIcons: Record<string, typeof BookOpen> = {
  learning_pod: Home,
  academic_coaching: GraduationCap,
  consulting_with_teacher: Users,
  consulting_only: Users,
  eaton_online: Monitor,
  eaton_hub: Star,
  elective_classes: Laptop,
}

export default function ActiveRoster() {
  const queryClient = useQueryClient()
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<'all' | EnrollmentStatus>('active')
  const [selectedService, setSelectedService] = useState('all')
  const [groupBy, setGroupBy] = useState<'service' | 'teacher' | 'none'>('service')
  
  // UI State
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  
  // Modal/Panel State
  const [selectedEnrollment, setSelectedEnrollment] = useState<EnrollmentWithRelations | null>(null)
  const [showDetailPanel, setShowDetailPanel] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showEndModal, setShowEndModal] = useState(false)
  const [currentAssignment, setCurrentAssignment] = useState<TeacherAssignment | null>(null)

  // Fetch data using React Query hooks
  const { data: services = [] } = useActiveServices()
  const { 
    data: enrollmentsData, 
    isLoading, 
    error 
  } = useEnrollments({ 
    status: selectedStatus !== 'all' ? selectedStatus : undefined,
    serviceId: selectedService !== 'all' ? selectedService : undefined
  })
  
  const enrollments = (enrollmentsData || []) as EnrollmentWithRelations[]

  // Initialize expanded groups when data loads
  useEffect(() => {
    if (enrollments.length > 0 && expandedGroups.size === 0) {
      const allGroups = new Set<string>()
      enrollments.forEach(e => {
        allGroups.add(e.service?.name || 'Unknown')
        const activeAssignment = e.teacher_assignments?.find((a: TeacherAssignment) => a.is_active)
        if (activeAssignment) {
          allGroups.add(activeAssignment.teacher?.display_name || 'Unassigned')
        } else {
          allGroups.add('Unassigned')
        }
      })
      setExpandedGroups(allGroups)
    }
  }, [enrollments, expandedGroups.size])

  // Filter enrollments (search is client-side)
  const filteredEnrollments = useMemo(() => {
    return enrollments.filter(enrollment => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const studentName = enrollment.student?.full_name?.toLowerCase() || ''
        const familyName = enrollment.family?.display_name?.toLowerCase() || ''
        const classTitle = enrollment.class_title?.toLowerCase() || ''
        const activeAssignment = enrollment.teacher_assignments?.find(a => a.is_active)
        const teacherName = activeAssignment?.teacher?.display_name?.toLowerCase() || ''
        
        if (!studentName.includes(query) && 
            !familyName.includes(query) && 
            !teacherName.includes(query) &&
            !classTitle.includes(query)) {
          return false
        }
      }
      
      return true
    })
  }, [enrollments, searchQuery])

  // Group enrollments
  const groupedEnrollments = useMemo(() => {
    if (groupBy === 'none') {
      return { 'All Enrollments': filteredEnrollments }
    }
    
    const groups: Record<string, EnrollmentWithRelations[]> = {}
    
    filteredEnrollments.forEach(enrollment => {
      let key: string
      
      if (groupBy === 'service') {
        key = enrollment.service?.name || 'Unknown Service'
      } else {
        const activeAssignment = enrollment.teacher_assignments?.find(a => a.is_active)
        key = activeAssignment?.teacher?.display_name || 'Unassigned'
      }
      
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(enrollment)
    })
    
    // Sort groups alphabetically, but put "Unassigned" last
    const sortedGroups: Record<string, EnrollmentWithRelations[]> = {}
    const keys = Object.keys(groups).sort((a, b) => {
      if (a === 'Unassigned') return 1
      if (b === 'Unassigned') return -1
      return a.localeCompare(b)
    })
    keys.forEach(key => {
      sortedGroups[key] = groups[key]
    })
    
    return sortedGroups
  }, [filteredEnrollments, groupBy])

  // Stats
  const stats = useMemo(() => {
    const uniqueStudents = new Set(filteredEnrollments.map(e => e.student_id || e.family_id))
    const uniqueFamilies = new Set(filteredEnrollments.map(e => e.family_id))
    const totalHours = filteredEnrollments.reduce((sum, e) => sum + (e.hours_per_week || 0), 0)
    
    return {
      enrollments: filteredEnrollments.length,
      students: uniqueStudents.size,
      families: uniqueFamilies.size,
      hoursPerWeek: totalHours
    }
  }, [filteredEnrollments])

  function toggleGroup(groupName: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupName)) {
        next.delete(groupName)
      } else {
        next.add(groupName)
      }
      return next
    })
  }

  function formatRate(enrollment: EnrollmentWithRelations): string {
    if (enrollment.hourly_rate_customer) {
      return `$${enrollment.hourly_rate_customer}/hr`
    }
    if (enrollment.monthly_rate) {
      return `$${enrollment.monthly_rate}/mo`
    }
    if (enrollment.weekly_tuition) {
      return `$${enrollment.weekly_tuition}/wk`
    }
    if (enrollment.daily_rate) {
      return `$${enrollment.daily_rate}/day`
    }
    return ''
  }

  function handleEnrollmentClick(enrollment: EnrollmentWithRelations) {
    setSelectedEnrollment(enrollment)
    setShowDetailPanel(true)
  }

  function handleEditEnrollment() {
    setShowDetailPanel(false)
    setShowEditModal(true)
  }

  // Handle transfer teacher - accepts any assignment-like object
  function handleTransferTeacher(assignment: any) {
    if (!assignment) return
    setCurrentAssignment(assignment as TeacherAssignment)
    setShowDetailPanel(false)
    setShowTransferModal(true)
  }

  function handleEndEnrollment() {
    setShowDetailPanel(false)
    setShowEndModal(true)
  }

  function handleModalSuccess() {
    queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.stats.roster() })
    setSelectedEnrollment(null)
    setCurrentAssignment(null)
  }

  return (
    <div className="h-full flex flex-col p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Active Roster</h1>
          <p className="text-sm text-gray-400 mt-1">
            {stats.enrollments} enrollments • {stats.families} families • {stats.hoursPerWeek} hrs/week
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Enrollment
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search students, families, teachers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Status Filter */}
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value as 'all' | EnrollmentStatus)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="paused">Paused</option>
          <option value="ended">Ended</option>
        </select>

        {/* Service Filter */}
        <select
          value={selectedService}
          onChange={(e) => setSelectedService(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Services</option>
          {services.map(service => (
            <option key={service.id} value={service.code}>{service.name}</option>
          ))}
        </select>

        {/* Group By */}
        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as 'service' | 'teacher' | 'none')}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
        >
          <option value="service">Group by Service</option>
          <option value="teacher">Group by Teacher</option>
          <option value="none">No Grouping</option>
        </select>
      </div>

      {/* Error State */}
      {error && (
        <div className="text-center py-12">
          <p className="text-red-400">{error instanceof Error ? error.message : 'Failed to load roster'}</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin"></div>
          <p className="text-gray-400 mt-2">Loading roster...</p>
        </div>
      )}

      {/* Roster List */}
      {!isLoading && !error && (
        <div className="space-y-4 flex-1 overflow-auto">
          {Object.entries(groupedEnrollments).map(([groupName, groupEnrollments]) => {
            const isExpanded = expandedGroups.has(groupName) || groupBy === 'none'
            const ServiceIcon = groupBy === 'service' 
              ? serviceIcons[services.find(s => s.name === groupName)?.code || ''] || BookOpen
              : User

            return (
              <div key={groupName} className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                {/* Group Header */}
                {groupBy !== 'none' && (
                  <button
                    onClick={() => toggleGroup(groupName)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-800 hover:bg-gray-750 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                      <ServiceIcon className="w-5 h-5 text-blue-400" />
                      <span className="font-medium text-white">{groupName}</span>
                      <span className="text-sm text-gray-500">
                        ({groupEnrollments.length} enrollment{groupEnrollments.length !== 1 ? 's' : ''})
                      </span>
                    </div>
                  </button>
                )}

                {/* Enrollments */}
                {isExpanded && (
                  <div className="divide-y divide-gray-700">
                    {groupEnrollments.map((enrollment) => {
                      const activeAssignment = enrollment.teacher_assignments?.find(a => a.is_active)
                      
                      return (
                        <div
                          key={enrollment.id}
                          onClick={() => handleEnrollmentClick(enrollment)}
                          className="px-4 py-3 hover:bg-gray-750 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              {/* Student/Family Info */}
                              <div className="min-w-[200px]">
                                <p className="font-medium text-white">
                                  {enrollment.student?.full_name || enrollment.family.display_name}
                                </p>
                                <p className="text-sm text-gray-400">
                                  {enrollment.student ? enrollment.family.display_name : ''}
                                  {enrollment.student?.grade_level && ` • ${enrollment.student.grade_level}`}
                                </p>
                              </div>

                              {/* Service (if not grouped by service) */}
                              {groupBy !== 'service' && (
                                <div className="min-w-[150px]">
                                  <p className="text-sm text-gray-300">{enrollment.service?.name}</p>
                                  {enrollment.class_title && (
                                    <p className="text-xs text-gray-500">{enrollment.class_title}</p>
                                  )}
                                </div>
                              )}

                              {/* Teacher (if not grouped by teacher) */}
                              {groupBy !== 'teacher' && (
                                <div className="min-w-[150px]">
                                  {activeAssignment ? (
                                    <div className="flex items-center gap-2 text-sm text-gray-300">
                                      <User className="w-3 h-3" />
                                      {activeAssignment.teacher?.display_name}
                                    </div>
                                  ) : (
                                    <span className="text-sm text-gray-500 italic">Unassigned</span>
                                  )}
                                </div>
                              )}

                              {/* Status */}
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[enrollment.status]}`}>
                                {enrollment.status}
                              </span>
                            </div>

                            {/* Rate & Hours */}
                            <div className="text-right">
                              <div className="flex items-center gap-1 text-gray-300">
                                <DollarSign className="w-3 h-3" />
                                <span className="text-sm">{formatRate(enrollment)}</span>
                              </div>
                              {enrollment.hours_per_week && (
                                <div className="flex items-center gap-1 text-gray-500 text-xs mt-1 justify-end">
                                  <Clock className="w-3 h-3" />
                                  {enrollment.hours_per_week} hrs/wk
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {/* Empty State */}
          {Object.keys(groupedEnrollments).length === 0 && (
            <div className="text-center py-12 bg-gray-800 border border-gray-700 rounded-lg">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No enrollments found</p>
              <p className="text-gray-500 text-sm mt-1">
                Try adjusting your filters or add a new enrollment
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Enrollment
              </button>
            </div>
          )}
        </div>
      )}

      {/* Footer Stats */}
      {!isLoading && !error && filteredEnrollments.length > 0 && (
        <div className="mt-6 text-center text-gray-500 text-sm">
          Showing {filteredEnrollments.length} enrollment{filteredEnrollments.length !== 1 ? 's' : ''} across {stats.families} famil{stats.families !== 1 ? 'ies' : 'y'}
        </div>
      )}

      {/* Detail Panel */}
      {showDetailPanel && selectedEnrollment && (
        <EnrollmentDetailPanel
          enrollment={selectedEnrollment as any}
          onClose={() => {
            setShowDetailPanel(false)
            setSelectedEnrollment(null)
          }}
          onEdit={handleEditEnrollment}
          onTransferTeacher={handleTransferTeacher}
          onEndEnrollment={handleEndEnrollment}
        />
      )}

      {/* Add Enrollment Modal */}
      <AddEnrollmentModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleModalSuccess}
      />

      {/* Edit Enrollment Modal */}
      <EditEnrollmentModal
        isOpen={showEditModal}
        enrollment={selectedEnrollment as any}
        onClose={() => {
          setShowEditModal(false)
          setSelectedEnrollment(null)
        }}
        onSuccess={handleModalSuccess}
      />

      {/* Transfer Teacher Modal */}
      <TransferTeacherModal
        isOpen={showTransferModal}
        currentAssignment={currentAssignment}
        enrollmentId={selectedEnrollment?.id || ''}
        studentName={selectedEnrollment?.student?.full_name || selectedEnrollment?.family.display_name || ''}
        serviceName={selectedEnrollment?.service?.name || ''}
        onClose={() => {
          setShowTransferModal(false)
          setCurrentAssignment(null)
          setSelectedEnrollment(null)
        }}
        onSuccess={handleModalSuccess}
      />

      {/* End Enrollment Modal */}
      <EndEnrollmentModal
        isOpen={showEndModal}
        enrollment={selectedEnrollment as any}
        onClose={() => {
          setShowEndModal(false)
          setSelectedEnrollment(null)
        }}
        onSuccess={handleModalSuccess}
      />
    </div>
  )
}