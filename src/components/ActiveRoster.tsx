import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import {
  Search,
  Filter,
  Users,
  GraduationCap,
  BookOpen,
  Monitor,
  Calendar,
  ChevronDown,
  ChevronRight,
  User,
  Mail,
  Phone,
  Clock,
  DollarSign,
  X,
} from 'lucide-react'

// Types
interface EnrollmentWithDetails {
  id: string
  status: 'trial' | 'active' | 'paused' | 'ended'
  start_date: string | null
  hours_per_week: number | null
  hourly_rate_customer: number | null
  monthly_rate: number | null
  weekly_tuition: number | null
  schedule_notes: string | null
  class_title: string | null
  student: {
    id: string
    full_name: string
    grade_level: string | null
    age_group: string | null
  } | null
  family: {
    id: string
    display_name: string
    primary_email: string | null
    primary_phone: string | null
    status: string
  }
  service: {
    id: string
    code: string
    name: string
  }
  teacher_assignments: {
    id: string
    is_active: boolean
    hours_per_week: number | null
    hourly_rate_teacher: number | null
    teacher: {
      id: string
      display_name: string
    }
  }[]
}

// Service code to icon mapping
const serviceIcons: Record<string, typeof BookOpen> = {
  learning_pod: Users,
  academic_coaching: GraduationCap,
  consulting_with_teacher: BookOpen,
  consulting_only: BookOpen,
  eaton_online: Monitor,
  eaton_hub: Calendar,
  elective_classes: Calendar,
}

// Service code to color mapping
const serviceColors: Record<string, string> = {
  learning_pod: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  academic_coaching: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  consulting_with_teacher: 'bg-green-500/20 text-green-400 border-green-500/30',
  consulting_only: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  eaton_online: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  eaton_hub: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  elective_classes: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
}

// Status badge colors
const statusColors: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400',
  trial: 'bg-blue-500/20 text-blue-400',
  paused: 'bg-yellow-500/20 text-yellow-400',
  ended: 'bg-gray-500/20 text-gray-400',
}

export default function ActiveRoster() {
  const [enrollments, setEnrollments] = useState<EnrollmentWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedService, setSelectedService] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('active')
  const [groupBy, setGroupBy] = useState<'service' | 'teacher' | 'none'>('service')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [services, setServices] = useState<{ id: string; code: string; name: string }[]>([])

  // Fetch services for filter dropdown
  useEffect(() => {
    async function fetchServices() {
      const { data } = await supabase
        .from('services')
        .select('id, code, name')
        .eq('is_active', true)
        .order('name')
      if (data) setServices(data)
    }
    fetchServices()
  }, [])

  // Fetch enrollments with all related data
  useEffect(() => {
    async function fetchEnrollments() {
      setLoading(true)
      setError(null)

      try {
        let query = supabase
          .from('enrollments')
          .select(`
            id,
            status,
            start_date,
            hours_per_week,
            hourly_rate_customer,
            monthly_rate,
            weekly_tuition,
            schedule_notes,
            class_title,
            student:students (
              id,
              full_name,
              grade_level,
              age_group
            ),
            family:families (
              id,
              display_name,
              primary_email,
              primary_phone,
              status
            ),
            service:services (
              id,
              code,
              name
            ),
            teacher_assignments (
              id,
              is_active,
              hours_per_week,
              hourly_rate_teacher,
              teacher:teachers (
                id,
                display_name
              )
            )
          `)
          .order('created_at', { ascending: false })

        // Filter by status
        if (selectedStatus !== 'all') {
          query = query.eq('status', selectedStatus)
        } else {
          // Exclude 'ended' by default when showing 'all'
          query = query.in('status', ['active', 'trial', 'paused'])
        }

        // Filter by service
        if (selectedService !== 'all') {
          const service = services.find(s => s.code === selectedService)
          if (service) {
            query = query.eq('service_id', service.id)
          }
        }

        const { data, error: fetchError } = await query

        if (fetchError) throw fetchError

        setEnrollments(data as EnrollmentWithDetails[] || [])
        
        // Auto-expand all groups initially
        if (data && data.length > 0) {
          const groups = new Set<string>()
          data.forEach((e: EnrollmentWithDetails) => {
            if (groupBy === 'service') {
              groups.add(e.service?.code || 'unknown')
            } else if (groupBy === 'teacher') {
              const teacherName = e.teacher_assignments?.find(ta => ta.is_active)?.teacher?.display_name || 'Unassigned'
              groups.add(teacherName)
            }
          })
          setExpandedGroups(groups)
        }
      } catch (err) {
        console.error('Error fetching enrollments:', err)
        setError('Failed to load roster')
      } finally {
        setLoading(false)
      }
    }

    fetchEnrollments()
  }, [selectedService, selectedStatus, services])

  // Filter enrollments by search term
  const filteredEnrollments = useMemo(() => {
    if (!searchTerm) return enrollments

    const term = searchTerm.toLowerCase()
    return enrollments.filter(e => {
      const studentName = e.student?.full_name?.toLowerCase() || ''
      const familyName = e.family?.display_name?.toLowerCase() || ''
      const teacherName = e.teacher_assignments?.find(ta => ta.is_active)?.teacher?.display_name?.toLowerCase() || ''
      const className = e.class_title?.toLowerCase() || ''
      
      return (
        studentName.includes(term) ||
        familyName.includes(term) ||
        teacherName.includes(term) ||
        className.includes(term)
      )
    })
  }, [enrollments, searchTerm])

  // Group enrollments
  const groupedEnrollments = useMemo(() => {
    if (groupBy === 'none') {
      return { 'All Enrollments': filteredEnrollments }
    }

    const groups: Record<string, EnrollmentWithDetails[]> = {}

    filteredEnrollments.forEach(enrollment => {
      let key: string

      if (groupBy === 'service') {
        key = enrollment.service?.name || 'Unknown Service'
      } else if (groupBy === 'teacher') {
        const activeAssignment = enrollment.teacher_assignments?.find(ta => ta.is_active)
        key = activeAssignment?.teacher?.display_name || 'Unassigned'
      } else {
        key = 'All'
      }

      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(enrollment)
    })

    // Sort groups by name
    const sortedGroups: Record<string, EnrollmentWithDetails[]> = {}
    Object.keys(groups).sort().forEach(key => {
      sortedGroups[key] = groups[key]
    })

    return sortedGroups
  }, [filteredEnrollments, groupBy])

  // Toggle group expansion
  const toggleGroup = (groupName: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName)
    } else {
      newExpanded.add(groupName)
    }
    setExpandedGroups(newExpanded)
  }

  // Stats
  const stats = useMemo(() => {
    const uniqueStudents = new Set(filteredEnrollments.map(e => e.student?.id).filter(Boolean))
    const uniqueFamilies = new Set(filteredEnrollments.map(e => e.family?.id).filter(Boolean))
    const totalHours = filteredEnrollments.reduce((sum, e) => sum + (e.hours_per_week || 0), 0)
    
    return {
      enrollments: filteredEnrollments.length,
      students: uniqueStudents.size,
      families: uniqueFamilies.size,
      totalHours,
    }
  }, [filteredEnrollments])

  // Format rate display
  const formatRate = (enrollment: EnrollmentWithDetails) => {
    if (enrollment.hourly_rate_customer && enrollment.hours_per_week) {
      return `${enrollment.hours_per_week}hrs × $${enrollment.hourly_rate_customer}/hr`
    }
    if (enrollment.monthly_rate) {
      return `$${enrollment.monthly_rate}/mo`
    }
    if (enrollment.weekly_tuition) {
      return `$${enrollment.weekly_tuition}/wk`
    }
    return '—'
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Active Roster</h1>
          <p className="text-gray-400 text-sm mt-1">
            Currently enrolled students and their services
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="text-2xl font-bold text-white">{stats.enrollments}</div>
          <div className="text-gray-400 text-sm">Enrollments</div>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="text-2xl font-bold text-white">{stats.students}</div>
          <div className="text-gray-400 text-sm">Students</div>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="text-2xl font-bold text-white">{stats.families}</div>
          <div className="text-gray-400 text-sm">Families</div>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="text-2xl font-bold text-white">{stats.totalHours}</div>
          <div className="text-gray-400 text-sm">Hours/Week</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search students, families, teachers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Status Filter */}
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="paused">Paused</option>
          <option value="all">All (excl. Ended)</option>
        </select>

        {/* Service Filter */}
        <select
          value={selectedService}
          onChange={(e) => setSelectedService(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Services</option>
          {services.map(service => (
            <option key={service.id} value={service.code}>
              {service.name}
            </option>
          ))}
        </select>

        {/* Group By */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as 'service' | 'teacher' | 'none')}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="service">Group by Service</option>
            <option value="teacher">Group by Teacher</option>
            <option value="none">No Grouping</option>
          </select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="text-center py-12">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin"></div>
          <p className="text-gray-400 mt-2">Loading roster...</p>
        </div>
      )}

      {/* Roster List */}
      {!loading && !error && (
        <div className="space-y-4">
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
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-800 hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                      <ServiceIcon className="w-5 h-5 text-gray-400" />
                      <span className="font-medium text-white">{groupName}</span>
                      <span className="text-gray-500 text-sm">
                        ({groupEnrollments.length} enrollment{groupEnrollments.length !== 1 ? 's' : ''})
                      </span>
                    </div>
                  </button>
                )}

                {/* Group Content */}
                {isExpanded && (
                  <div className="divide-y divide-gray-700">
                    {groupEnrollments.map(enrollment => {
                      const activeTeacher = enrollment.teacher_assignments?.find(ta => ta.is_active)
                      const ServiceIconInner = serviceIcons[enrollment.service?.code || ''] || BookOpen
                      const serviceColor = serviceColors[enrollment.service?.code || ''] || 'bg-gray-500/20 text-gray-400'

                      return (
                        <div
                          key={enrollment.id}
                          className="px-4 py-3 hover:bg-gray-700/50 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            {/* Left: Student & Family Info */}
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1">
                                <span className="font-medium text-white">
                                  {enrollment.student?.full_name || 'No Student'}
                                </span>
                                {enrollment.student?.grade_level && (
                                  <span className="text-gray-500 text-sm">
                                    {enrollment.student.grade_level}
                                  </span>
                                )}
                                <span className={`px-2 py-0.5 rounded text-xs ${statusColors[enrollment.status]}`}>
                                  {enrollment.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-gray-400">
                                <span className="flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  {enrollment.family?.display_name}
                                </span>
                                {enrollment.family?.primary_email && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="w-3 h-3" />
                                    {enrollment.family.primary_email}
                                  </span>
                                )}
                                {enrollment.family?.primary_phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {enrollment.family.primary_phone}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Middle: Service & Class */}
                            <div className="flex-1 px-4">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs ${serviceColor}`}>
                                  <ServiceIconInner className="w-3 h-3" />
                                  {enrollment.service?.name}
                                </span>
                                {enrollment.class_title && (
                                  <span className="text-gray-400 text-sm">
                                    {enrollment.class_title}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-sm text-gray-400">
                                {activeTeacher && (
                                  <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {activeTeacher.teacher?.display_name}
                                  </span>
                                )}
                                {enrollment.schedule_notes && (
                                  <span className="flex items-center gap-1 text-gray-500">
                                    <Calendar className="w-3 h-3" />
                                    {enrollment.schedule_notes}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Right: Rate Info */}
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
                Try adjusting your filters
              </p>
            </div>
          )}
        </div>
      )}

      {/* Footer Stats */}
      {!loading && !error && filteredEnrollments.length > 0 && (
        <div className="mt-6 text-center text-gray-500 text-sm">
          Showing {filteredEnrollments.length} enrollment{filteredEnrollments.length !== 1 ? 's' : ''} across {stats.families} famil{stats.families !== 1 ? 'ies' : 'y'}
        </div>
      )}
    </div>
  )
}