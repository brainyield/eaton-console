import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Users,
  Search,
  Plus,
  Filter,
  ChevronDown,
  AlertCircle,
  Check,
  User,
  DollarSign,
  Clock,
  X,
  ClipboardCheck,
} from 'lucide-react'
import { useTeachersWithLoad, useActiveServices, type TeacherWithLoad } from '../lib/hooks'
import { AddTeacherModal } from './AddTeacherModal'
import TeacherDetailPanel from './TeacherDetailPanel'
import CheckinsTab from './CheckinsTab'

type StatusFilter = 'all' | 'active' | 'reserve' | 'inactive'
type MainTab = 'teachers' | 'checkins'

interface TeachersProps {
  selectedTeacherId?: string | null
  onSelectTeacher?: (id: string | null) => void
}

export default function Teachers({
  selectedTeacherId: externalSelectedId,
  onSelectTeacher: externalSetSelectedId
}: TeachersProps = {}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const mainTab = (searchParams.get('tab') as MainTab) || 'teachers'

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [showAddModal, setShowAddModal] = useState(false)
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [serviceFilter, setServiceFilter] = useState<string | null>(null)

  // Use external state if provided, otherwise use internal state
  const selectedTeacherId = externalSelectedId !== undefined ? externalSelectedId : internalSelectedId
  const setSelectedTeacherId = externalSetSelectedId || setInternalSelectedId

  // Handle main tab change
  const handleTabChange = (tab: MainTab) => {
    if (tab === 'teachers') {
      searchParams.delete('tab')
    } else {
      searchParams.set('tab', tab)
    }
    setSearchParams(searchParams)
  }

  // Fetch services for filter dropdown
  const { data: services } = useActiveServices()

  // Use the new hook that includes load calculations
  const { data: teachers, isLoading, error } = useTeachersWithLoad(
    statusFilter !== 'all' ? { status: statusFilter } : undefined
  )

  // Calculate service counts for filter dropdown
  const serviceTeacherCounts = useMemo(() => {
    if (!teachers || !services) return {}
    const counts: Record<string, number> = {}
    
    services.forEach(service => {
      counts[service.code] = teachers.filter(teacher => 
        teacher.allAssignments.some(a => {
          // Check both service-level assignments (service_id) and enrollment-level (service.code)
          if (a.service_id && a.service?.code === service.code) return true
          if (a.enrollment?.service?.code === service.code) return true
          return false
        })
      ).length
    })
    
    return counts
  }, [teachers, services])

  // Filter and search
  const filteredTeachers = useMemo(() => {
    if (!teachers) return []
    
    let result = [...teachers]
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(t => 
        t.display_name.toLowerCase().includes(query) ||
        t.email?.toLowerCase().includes(query) ||
        t.role?.toLowerCase().includes(query) ||
        t.skillset?.toLowerCase().includes(query)
      )
    }
    
    // Service filter
    if (serviceFilter) {
      result = result.filter(teacher => 
        teacher.allAssignments.some(a => {
          // Check both service-level assignments (service_id) and enrollment-level (service.code)
          if (a.service_id && a.service?.code === serviceFilter) return true
          if (a.enrollment?.service?.code === serviceFilter) return true
          return false
        })
      )
    }
    
    // Sort by name
    result.sort((a, b) => a.display_name.localeCompare(b.display_name))
    
    return result
  }, [teachers, searchQuery, serviceFilter])

  // Stats
  const stats = useMemo(() => {
    if (!teachers) return { total: 0, active: 0, reserve: 0, withPaymentInfo: 0 }
    return {
      total: teachers.length,
      active: teachers.filter(t => t.status === 'active').length,
      reserve: teachers.filter(t => t.status === 'reserve').length,
      withPaymentInfo: teachers.filter(t => t.payment_info_on_file).length,
    }
  }, [teachers])

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <span className="text-red-300">Error loading teachers: {error.message}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-900/50 rounded-lg">
            <Users className="h-6 w-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Teachers</h1>
            <p className="text-sm text-gray-400">
              {stats.total} teachers • {stats.active} active • {stats.reserve} reserve
            </p>
          </div>
        </div>
        {mainTab === 'teachers' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Teacher
          </button>
        )}
      </div>

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-zinc-700">
        <button
          onClick={() => handleTabChange('teachers')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            mainTab === 'teachers'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Users className="h-4 w-4" />
          Teachers
        </button>
        <button
          onClick={() => handleTabChange('checkins')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            mainTab === 'checkins'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <ClipboardCheck className="h-4 w-4" />
          Check-ins
        </button>
      </div>

      {/* Check-ins Tab Content */}
      {mainTab === 'checkins' && <CheckinsTab />}

      {/* Teachers Tab Content */}
      {mainTab === 'teachers' && (
        <>
          {/* Search and Filters */}
          <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search teachers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Status Tabs */}
        <div className="flex items-center bg-gray-800 rounded-lg p-1">
          {(['all', 'active', 'reserve', 'inactive'] as StatusFilter[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        <div className="relative">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
              showFilters || serviceFilter
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            <Filter className="h-4 w-4" />
            Filters
            {serviceFilter && (
              <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded">1</span>
            )}
            <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
          
          {/* Filter Dropdown */}
          {showFilters && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
              <div className="p-3 border-b border-gray-700">
                <div className="text-sm font-medium text-gray-300">Filter by Service</div>
              </div>
              <div className="p-2 max-h-64 overflow-y-auto">
                {services?.map(service => (
                  <button
                    key={service.code}
                    onClick={() => {
                      setServiceFilter(serviceFilter === service.code ? null : service.code)
                      setShowFilters(false)
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm transition-colors ${
                      serviceFilter === service.code
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <span>{service.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      serviceFilter === service.code
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-700 text-gray-400'
                    }`}>
                      {serviceTeacherCounts[service.code] || 0}
                    </span>
                  </button>
                ))}
              </div>
              {serviceFilter && (
                <div className="p-2 border-t border-gray-700">
                  <button
                    onClick={() => {
                      setServiceFilter(null)
                      setShowFilters(false)
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-gray-700 rounded transition-colors"
                  >
                    <X className="h-3 w-3" />
                    Clear Filter
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Active Filter Badge */}
      {serviceFilter && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Filtering by:</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-900/50 text-blue-300 border border-blue-700 rounded-lg text-sm">
            {services?.find(s => s.code === serviceFilter)?.name}
            <button
              onClick={() => setServiceFilter(null)}
              className="hover:text-white transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        </div>
      )}

      {/* Teacher Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg p-4 animate-pulse">
              <div className="h-5 bg-gray-700 rounded w-3/4 mb-3" />
              <div className="h-4 bg-gray-700 rounded w-1/2 mb-4" />
              <div className="space-y-2">
                <div className="h-3 bg-gray-700 rounded w-full" />
                <div className="h-3 bg-gray-700 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredTeachers.length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-400 mb-2">No teachers found</h3>
          <p className="text-gray-500">
            {searchQuery ? 'Try adjusting your search' : 'Add a teacher to get started'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTeachers.map((teacher) => (
            <TeacherCard
              key={teacher.id}
              teacher={teacher}
              onClick={() => setSelectedTeacherId(teacher.id)}
            />
          ))}
        </div>
      )}
        </>
      )}

      {/* Modals */}
      <AddTeacherModal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)} 
      />

      {selectedTeacherId && (
        <TeacherDetailPanel
          teacherId={selectedTeacherId}
          onClose={() => setSelectedTeacherId(null)}
        />
      )}
    </div>
  )
}

// ============================================================================
// TEACHER CARD COMPONENT
// ============================================================================

interface TeacherCardProps {
  teacher: TeacherWithLoad
  onClick: () => void
}

function TeacherCard({ teacher, onClick }: TeacherCardProps) {
  // Calculate capacity percentage
  const maxHours = teacher.max_hours_per_week ?? 30
  const capacityPercent = Math.min(100, (teacher.definedHours / maxHours) * 100)

  return (
    <div
      onClick={onClick}
      className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-gray-600 cursor-pointer transition-all group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate group-hover:text-blue-400 transition-colors">
            {teacher.display_name}
          </h3>
          <p className="text-sm text-gray-400 truncate">
            {teacher.role || 'Teacher'}
          </p>
        </div>
        <StatusBadge status={teacher.status} />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-300">
            {teacher.totalActiveStudents} student{teacher.totalActiveStudents !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-300">
            {teacher.hoursDisplay}/{maxHours} hrs
          </span>
        </div>
      </div>

      {/* Capacity Bar */}
      <div className="mb-3">
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              capacityPercent > 90
                ? 'bg-red-500'
                : capacityPercent > 70
                ? 'bg-amber-500'
                : 'bg-green-500'
            }`}
            style={{ width: `${capacityPercent}%` }}
          />
        </div>
      </div>

      {/* Rate and Payment Info */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1.5">
          <DollarSign className="h-4 w-4 text-gray-500" />
          <span className="text-gray-300">{teacher.rateDisplay}/hr</span>
        </div>
        <div className="flex items-center gap-1.5">
          {teacher.payment_info_on_file ? (
            <>
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-green-400">Payment info</span>
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <span className="text-amber-400">Need docs</span>
            </>
          )}
        </div>
      </div>

      {/* Service Badges (if has service-level assignments) */}
      {teacher.serviceAssignmentCount > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <div className="flex flex-wrap gap-1">
            {teacher.allAssignments
              .filter(a => a.service_id && !a.enrollment_id)
              .map(a => (
                <span
                  key={a.id}
                  className="px-2 py-0.5 text-xs rounded border bg-gray-700/50 text-gray-300 border-gray-600"
                >
                  {a.service?.name || 'Unknown'}
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// STATUS BADGE COMPONENT
// ============================================================================

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-900/50 text-green-400 border-green-700',
    reserve: 'bg-blue-900/50 text-blue-400 border-blue-700',
    inactive: 'bg-gray-900/50 text-gray-400 border-gray-600',
  }

  return (
    <span className={`px-2 py-0.5 text-xs rounded border ${colors[status] || colors.inactive}`}>
      {status}
    </span>
  )
}