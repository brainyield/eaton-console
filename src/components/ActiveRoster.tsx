import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
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
  Plus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  X
} from 'lucide-react'
import { useEnrollments, useActiveServices, useActiveLocations } from '../lib/hooks'
import type { Service, Enrollment, Location, EnrollmentStatus } from '../lib/hooks'
import { queryKeys } from '../lib/queryClient'
import { getTodayString, formatDateLocal } from '../lib/dateUtils'
import { calculateAge, getAgeGroupSortValue } from '../lib/utils'
import { EnrollmentDetailPanel } from './EnrollmentDetailPanel'
import { AddEnrollmentModal } from './AddEnrollmentModal'
import { EditEnrollmentModal } from './EditEnrollmentModal'
import { TransferTeacherModal } from './TransferTeacherModal'
import { EndEnrollmentModal } from './EndEnrollmentModal'
import { ENROLLMENT_STATUS_COLORS } from './ui/StatusBadge'

// Types
type SortField = 'student' | 'family' | 'teacher' | 'hours' | 'rate' | 'status' | 'grade' | 'class' | 'age_group'
type SortDirection = 'asc' | 'desc'

interface SortConfig {
  field: SortField
  direction: SortDirection
}

interface Student {
  id: string
  full_name: string
  grade_level: string | null
  age_group: string | null
  dob: string | null
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
  location: Location | null
}

// Service icons
const serviceIcons: Record<string, typeof BookOpen> = {
  learning_pod: Home,
  academic_coaching: GraduationCap,
  consulting: Users,
  eaton_online: Monitor,
  eaton_hub: Star,
  elective_classes: Laptop,
}

export default function ActiveRoster() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  // URL-based filters
  const newThisMonth = searchParams.get('newThisMonth') === 'true'

  // Calculate month start for "new this month" filter
  const monthStart = useMemo(() => {
    if (!newThisMonth) return undefined
    const now = new Date()
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    return formatDateLocal(firstOfMonth)
  }, [newThisMonth])

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<'all' | EnrollmentStatus>(newThisMonth ? 'all' : 'active')
  const [selectedServiceCode, setSelectedServiceCode] = useState('all')
  const [groupBy, setGroupBy] = useState<'service' | 'teacher' | 'none'>('service')

  // UI State - FIX #1: Initialize as EMPTY set (all groups collapsed)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // FIX #2: Sorting state per group
  const [sortConfigs, setSortConfigs] = useState<Record<string, SortConfig>>({})

  // Modal/Panel State
  const [selectedEnrollment, setSelectedEnrollment] = useState<EnrollmentWithRelations | null>(null)
  const [showDetailPanel, setShowDetailPanel] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showEndModal, setShowEndModal] = useState(false)
  const [currentAssignment, setCurrentAssignment] = useState<TeacherAssignment | null>(null)

  // Fetch services for the filter dropdown
  const { data: services = [] } = useActiveServices()

  // Fetch locations for the filter dropdown
  const { data: locations = [] } = useActiveLocations()
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all')

  // FIX #3 & #4: Get service ID from service code for the query
  const selectedServiceId = useMemo(() => {
    if (selectedServiceCode === 'all') return undefined
    const service = services.find(s => s.code === selectedServiceCode)
    return service?.id
  }, [selectedServiceCode, services])

  // Fetch enrollments - now passing actual service ID
  const {
    data: enrollmentsData,
    isLoading,
    error
  } = useEnrollments({
    status: selectedStatus !== 'all' ? selectedStatus : undefined,
    serviceId: selectedServiceId,
    createdFrom: monthStart
  })

  // Clear the newThisMonth filter
  function clearNewThisMonthFilter() {
    searchParams.delete('newThisMonth')
    setSearchParams(searchParams)
    setSelectedStatus('active')
  }
  
  const enrollments = (enrollmentsData || []) as EnrollmentWithRelations[]

  // FIX #1: REMOVED the useEffect that auto-expands all groups
  // Groups now start collapsed by default

  // Filter enrollments (search and location are client-side)
  const filteredEnrollments = useMemo(() => {
    return enrollments.filter(enrollment => {
      // Location filter
      if (selectedLocationId !== 'all') {
        // Handle 'none' to filter for NULL location_id
        if (selectedLocationId === 'none') {
          if (enrollment.location_id !== null) return false
        } else {
          if (enrollment.location_id !== selectedLocationId) return false
        }
      }

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
  }, [enrollments, searchQuery, selectedLocationId])

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
    // Calculate total hours from active teacher assignments, not enrollments
    const totalHours = filteredEnrollments.reduce((sum, e) => {
      const activeAssignment = e.teacher_assignments?.find(a => a.is_active)
      return sum + (activeAssignment?.hours_per_week || 0)
    }, 0)
    
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

  // FIX #2: Handle sorting within a group
  function handleSort(groupKey: string, field: SortField) {
    setSortConfigs(prev => {
      const currentConfig = prev[groupKey]
      let newDirection: SortDirection = 'asc'
      
      if (currentConfig?.field === field) {
        newDirection = currentConfig.direction === 'asc' ? 'desc' : 'asc'
      }
      
      return {
        ...prev,
        [groupKey]: { field, direction: newDirection }
      }
    })
  }

  // FIX #2: Get sorted enrollments for a group
  function getSortedEnrollments(groupKey: string, enrollments: EnrollmentWithRelations[]) {
    const config = sortConfigs[groupKey]
    if (!config) return enrollments

    return [...enrollments].sort((a, b) => {
      let aValue: string | number = ''
      let bValue: string | number = ''

      switch (config.field) {
        case 'student':
          aValue = a.student?.full_name || a.family?.display_name || ''
          bValue = b.student?.full_name || b.family?.display_name || ''
          break
        case 'family':
          aValue = a.family?.display_name || ''
          bValue = b.family?.display_name || ''
          break
        case 'teacher':
          aValue = a.teacher_assignments?.find(ta => ta.is_active)?.teacher?.display_name || 'zzz'
          bValue = b.teacher_assignments?.find(ta => ta.is_active)?.teacher?.display_name || 'zzz'
          break
        case 'hours':
          // Use assignment hours, not enrollment hours
          aValue = a.teacher_assignments?.find(ta => ta.is_active)?.hours_per_week || 0
          bValue = b.teacher_assignments?.find(ta => ta.is_active)?.hours_per_week || 0
          break
        case 'rate':
          aValue = a.hourly_rate_customer || a.monthly_rate || a.weekly_tuition || a.daily_rate || 0
          bValue = b.hourly_rate_customer || b.monthly_rate || b.weekly_tuition || b.daily_rate || 0
          break
        case 'status':
          aValue = a.status || ''
          bValue = b.status || ''
          break
        case 'grade':
          aValue = a.student?.grade_level || 'zzz'
          bValue = b.student?.grade_level || 'zzz'
          break
        case 'class':
          aValue = a.class_title || 'zzz'
          bValue = b.class_title || 'zzz'
          break
        case 'age_group':
          // Use numeric sort values for proper age group ordering
          aValue = getAgeGroupSortValue(a.student?.age_group)
          bValue = getAgeGroupSortValue(b.student?.age_group)
          break
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return config.direction === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      return config.direction === 'asc' 
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number)
    })
  }

  // FIX #2: Render sort icon
  function renderSortIcon(groupKey: string, field: SortField) {
    const config = sortConfigs[groupKey]
    if (config?.field !== field) {
      return <ArrowUpDown className="w-3 h-3 text-gray-500" aria-hidden="true" />
    }
    return config.direction === 'asc'
      ? <ArrowUp className="w-3 h-3 text-blue-400" aria-hidden="true" />
      : <ArrowDown className="w-3 h-3 text-blue-400" aria-hidden="true" />
  }

  function formatRate(enrollment: EnrollmentWithRelations): string {
    if (enrollment.hourly_rate_customer) {
      return `$${enrollment.hourly_rate_customer.toFixed(2)}/hr`
    }
    if (enrollment.monthly_rate) {
      return `$${enrollment.monthly_rate.toFixed(2)}/mo`
    }
    if (enrollment.weekly_tuition) {
      return `$${enrollment.weekly_tuition.toFixed(2)}/wk`
    }
    if (enrollment.daily_rate) {
      return `$${enrollment.daily_rate.toFixed(2)}/day`
    }
    return ''
  }

  // Service-specific column configuration
  type ServiceColumnConfig = {
    showGrade?: boolean
    showTeacher?: boolean
    showHours?: boolean
    showRate?: boolean
    showClass?: boolean
    showAgeGroup?: boolean
  }

  function getServiceColumns(serviceCode: string | undefined): ServiceColumnConfig {
    switch (serviceCode) {
      case 'academic_coaching':
        return { showTeacher: true, showHours: true, showRate: true }
      case 'eaton_online':
        return { showGrade: true, showTeacher: true, showHours: true, showRate: true }
      case 'consulting':
        return { showRate: true }
      case 'learning_pod':
        return { showAgeGroup: true, showRate: true }
      case 'elective_classes':
        return { showClass: true, showRate: true }
      case 'eaton_hub':
        return {} // Only Student, Family, Status
      default:
        return { showTeacher: true, showHours: true, showRate: true }
    }
  }

  // CSV Export function
  function exportServiceToCSV(serviceName: string, serviceCode: string | undefined, enrollments: EnrollmentWithRelations[]) {
    const columns = getServiceColumns(serviceCode)
    const today = getTodayString()
    const filename = `${serviceName.toLowerCase().replace(/\s+/g, '-')}-roster-${today}.csv`

    // Build headers
    const headers: string[] = ['Student Name', 'Grade Level', 'Family Name', 'Family Email']
    if (columns.showAgeGroup) headers.push('Age Group')
    if (columns.showClass) headers.push('Class')
    if (columns.showTeacher) headers.push('Teacher')
    if (columns.showHours) headers.push('Hrs/Week')
    if (columns.showRate) headers.push('Rate')
    headers.push('Status')
    headers.push('Location')

    // Build rows
    const rows = enrollments.map(enrollment => {
      const activeAssignment = enrollment.teacher_assignments?.find(a => a.is_active)
      const row: string[] = [
        enrollment.student?.full_name || enrollment.family?.display_name || '',
        enrollment.student?.grade_level || '',
        enrollment.family?.display_name || '',
        enrollment.family?.primary_email || '',
      ]
      if (columns.showAgeGroup) row.push(enrollment.student?.age_group || '')
      if (columns.showClass) row.push(enrollment.class_title || '')
      if (columns.showTeacher) row.push(activeAssignment?.teacher?.display_name || 'Unassigned')
      if (columns.showHours) row.push(activeAssignment?.hours_per_week?.toString() || '')
      if (columns.showRate) row.push(formatRate(enrollment))
      row.push(enrollment.status)
      row.push(enrollment.location?.name || '')
      return row
    })

    // Generate CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
  }

  function handleEnrollmentClick(enrollment: EnrollmentWithRelations) {
    setSelectedEnrollment(enrollment)
    setShowDetailPanel(true)
  }

  function handleEditEnrollment() {
    setShowDetailPanel(false)
    setShowEditModal(true)
  }

  function handleTransferTeacher(assignment: TeacherAssignment) {
    setCurrentAssignment(assignment)
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
            {stats.enrollments} enrollment{stats.enrollments !== 1 ? 's' : ''} • {stats.families} famil{stats.families !== 1 ? 'ies' : 'y'}
            {stats.hoursPerWeek > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">
                {stats.hoursPerWeek.toFixed(2)} hrs/week
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Add Enrollment
        </button>
      </div>

      {/* Active Filter Badge */}
      {newThisMonth && (
        <div className="mb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-full text-sm">
            <span>New Enrollments This Month</span>
            <button
              onClick={clearNewThisMonthFilter}
              className="hover:bg-green-500/30 rounded-full p-0.5 transition-colors"
              title="Clear filter"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden="true" />
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

        {/* Service Filter - FIX #3: Use service.code as value */}
        <select
          value={selectedServiceCode}
          onChange={(e) => setSelectedServiceCode(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Services</option>
          {services.map(service => (
            <option key={service.id} value={service.code}>{service.name}</option>
          ))}
        </select>

        {/* Location Filter */}
        <select
          value={selectedLocationId}
          onChange={(e) => setSelectedLocationId(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Locations</option>
          {locations.map(loc => (
            <option key={loc.id} value={loc.id}>{loc.name}</option>
          ))}
          <option value="none">No Location</option>
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
            const sortedEnrollments = getSortedEnrollments(groupName, groupEnrollments)

            return (
              <div key={groupName} className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                {/* Group Header */}
                {groupBy !== 'none' && (
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-800">
                    <button
                      onClick={() => toggleGroup(groupName)}
                      className="flex items-center gap-3 hover:bg-gray-750 transition-colors rounded -ml-2 px-2 py-1"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" aria-hidden="true" />
                      )}
                      <ServiceIcon className="w-5 h-5 text-blue-400" aria-hidden="true" />
                      <span className="font-medium text-white">{groupName}</span>
                      <span className="text-sm text-gray-500">
                        ({groupEnrollments.length} enrollment{groupEnrollments.length !== 1 ? 's' : ''})
                      </span>
                    </button>
                    {groupBy === 'service' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          const serviceCode = services.find(s => s.name === groupName)?.code
                          exportServiceToCSV(groupName, serviceCode, sortedEnrollments)
                        }}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                        title={`Download ${groupName} roster as CSV`}
                        aria-label={`Download ${groupName} roster as CSV`}
                      >
                        <Download className="w-4 h-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )}

                {/* Service-specific Table Header + Enrollments */}
                {isExpanded && (() => {
                  const serviceCode = groupBy === 'service'
                    ? services.find(s => s.name === groupName)?.code
                    : undefined
                  const columns = getServiceColumns(serviceCode)

                  return (
                    <div>
                      {/* Table Header with Sort Controls */}
                      <div className="flex items-center gap-4 px-4 py-2 bg-gray-900/50 border-b border-gray-700 text-xs text-gray-400 uppercase tracking-wider">
                        <button
                          className="flex-[2] flex items-center gap-1 hover:text-white text-left min-w-0"
                          onClick={() => handleSort(groupName, 'student')}
                        >
                          Student {renderSortIcon(groupName, 'student')}
                        </button>
                        {columns.showGrade && (
                          <button
                            className="w-16 flex items-center gap-1 hover:text-white justify-center"
                            onClick={() => handleSort(groupName, 'grade')}
                          >
                            Grade {renderSortIcon(groupName, 'grade')}
                          </button>
                        )}
                        {columns.showClass && (
                          <button
                            className="flex-1 flex items-center gap-1 hover:text-white text-left min-w-0"
                            onClick={() => handleSort(groupName, 'class')}
                          >
                            Class {renderSortIcon(groupName, 'class')}
                          </button>
                        )}
                        {columns.showAgeGroup && (
                          <button
                            className="w-24 flex items-center gap-1 hover:text-white text-left"
                            onClick={() => handleSort(groupName, 'age_group')}
                          >
                            Age Group {renderSortIcon(groupName, 'age_group')}
                          </button>
                        )}
                        <button
                          className="flex-[2] flex items-center gap-1 hover:text-white text-left min-w-0"
                          onClick={() => handleSort(groupName, 'family')}
                        >
                          Family {renderSortIcon(groupName, 'family')}
                        </button>
                        {groupBy !== 'service' && (
                          <div className="flex-1 min-w-0">Service</div>
                        )}
                        {columns.showTeacher && groupBy !== 'teacher' && (
                          <button
                            className="flex-1 flex items-center gap-1 hover:text-white text-left min-w-0"
                            onClick={() => handleSort(groupName, 'teacher')}
                          >
                            Teacher {renderSortIcon(groupName, 'teacher')}
                          </button>
                        )}
                        {columns.showHours && (
                          <button
                            className="w-16 flex items-center gap-1 hover:text-white text-right justify-end"
                            onClick={() => handleSort(groupName, 'hours')}
                          >
                            Hrs/Wk {renderSortIcon(groupName, 'hours')}
                          </button>
                        )}
                        {columns.showRate && (
                          <button
                            className="w-24 flex items-center gap-1 hover:text-white text-right justify-end"
                            onClick={() => handleSort(groupName, 'rate')}
                          >
                            Rate {renderSortIcon(groupName, 'rate')}
                          </button>
                        )}
                        <button
                          className="w-20 flex items-center gap-1 hover:text-white text-left"
                          onClick={() => handleSort(groupName, 'status')}
                        >
                          Status {renderSortIcon(groupName, 'status')}
                        </button>
                      </div>

                      {/* Enrollment Rows */}
                      <div className="divide-y divide-gray-700">
                        {sortedEnrollments.map((enrollment) => {
                          const activeAssignment = enrollment.teacher_assignments?.find(a => a.is_active)

                          return (
                            <div
                              key={enrollment.id}
                              onClick={() => handleEnrollmentClick(enrollment)}
                              className="flex items-center gap-4 px-4 py-3 hover:bg-gray-750 cursor-pointer transition-colors"
                            >
                              {/* Student Name */}
                              <div className="flex-[2] min-w-0">
                                <p className="font-medium text-white truncate">
                                  {enrollment.student?.full_name || enrollment.family.display_name}
                                  {enrollment.student && calculateAge(enrollment.student.dob) !== null && (
                                    <span className="text-gray-500 font-normal ml-1">({calculateAge(enrollment.student.dob)})</span>
                                  )}
                                </p>
                              </div>

                              {/* Grade (for Eaton Online) */}
                              {columns.showGrade && (
                                <div className="w-16 text-center">
                                  <span className="text-sm text-gray-300">
                                    {enrollment.student?.grade_level || '-'}
                                  </span>
                                </div>
                              )}

                              {/* Class (for Elective Classes) */}
                              {columns.showClass && (
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-gray-300 truncate">
                                    {enrollment.class_title || '-'}
                                  </p>
                                </div>
                              )}

                              {/* Age Group (for Learning Pod) */}
                              {columns.showAgeGroup && (
                                <div className="w-24">
                                  <span className="text-sm text-gray-300">
                                    {enrollment.student?.age_group || '-'}
                                  </span>
                                </div>
                              )}

                              {/* Family */}
                              <div className="flex-[2] min-w-0">
                                <p className="text-sm text-gray-300 truncate">
                                  {enrollment.family.display_name}
                                </p>
                              </div>

                              {/* Service (if not grouped by service) */}
                              {groupBy !== 'service' && (
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-gray-300 truncate">{enrollment.service?.name}</p>
                                  {enrollment.class_title && (
                                    <p className="text-xs text-gray-500 truncate">{enrollment.class_title}</p>
                                  )}
                                </div>
                              )}

                              {/* Teacher */}
                              {columns.showTeacher && groupBy !== 'teacher' && (
                                <div className="flex-1 min-w-0">
                                  {activeAssignment ? (
                                    <div className="flex items-center gap-2 text-sm text-gray-300">
                                      <User className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                                      <span className="truncate">{activeAssignment.teacher?.display_name}</span>
                                    </div>
                                  ) : (
                                    <span className="text-sm text-gray-500 italic">Unassigned</span>
                                  )}
                                </div>
                              )}

                              {/* Hours */}
                              {columns.showHours && (
                                <div className="w-16 text-right">
                                  {activeAssignment?.hours_per_week ? (
                                    <div className="flex items-center gap-1 text-gray-400 text-sm justify-end">
                                      <Clock className="w-3 h-3" aria-hidden="true" />
                                      {activeAssignment.hours_per_week}
                                    </div>
                                  ) : (
                                    <span className="text-gray-600">-</span>
                                  )}
                                </div>
                              )}

                              {/* Rate */}
                              {columns.showRate && (
                                <div className="w-24 text-right">
                                  <div className="flex items-center gap-1 text-gray-300 justify-end">
                                    <DollarSign className="w-3 h-3" aria-hidden="true" />
                                    <span className="text-sm">{formatRate(enrollment)}</span>
                                  </div>
                                </div>
                              )}

                              {/* Status */}
                              <div className="w-20">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${ENROLLMENT_STATUS_COLORS[enrollment.status as EnrollmentStatus]}`}>
                                  {enrollment.status}
                                </span>
                              </div>

                              {/* Location Badge (for in-person services) */}
                              {enrollment.location && (
                                <div className="w-20">
                                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-400">
                                    {enrollment.location.code === 'kendall' ? 'KDL' :
                                     enrollment.location.code === 'homestead' ? 'HMS' :
                                     enrollment.location.code === 'remote' ? 'RMT' :
                                     enrollment.location.name.slice(0, 3).toUpperCase()}
                                  </span>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )
          })}

          {/* Empty State */}
          {Object.keys(groupedEnrollments).length === 0 && (
            <div className="text-center py-12 bg-gray-800 border border-gray-700 rounded-lg">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" aria-hidden="true" />
              <p className="text-gray-400">No enrollments found</p>
              <p className="text-gray-500 text-sm mt-1">
                Try adjusting your filters or add a new enrollment
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
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
          enrollment={selectedEnrollment}
          onClose={() => {
            setShowDetailPanel(false)
            setSelectedEnrollment(null)
          }}
          onEdit={handleEditEnrollment}
          onTransferTeacher={(assignment) => handleTransferTeacher(assignment as unknown as TeacherAssignment)}
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
        enrollment={selectedEnrollment}
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
        studentName={selectedEnrollment?.student?.full_name || selectedEnrollment?.family?.display_name || ''}
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
        enrollment={selectedEnrollment}
        onClose={() => {
          setShowEndModal(false)
          setSelectedEnrollment(null)
        }}
        onSuccess={handleModalSuccess}
      />
    </div>
  )
}