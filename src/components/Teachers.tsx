import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import TeacherDetailPanel from './TeacherDetailPanel'
import { AddTeacherModal } from './AddTeacherModal'
import { Search, Plus, Filter } from 'lucide-react'

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
  // Computed from assignments
  active_assignments?: number
  assigned_hours?: number
}

interface AssignmentData {
  teacher_id: string
  hours_per_week: number | null
  is_active: boolean
}

interface TeachersProps {
  selectedTeacherId?: string | null
  onSelectTeacher?: (id: string | null) => void
}

type TabFilter = 'all' | 'active' | 'reserve'

export default function Teachers({ selectedTeacherId, onSelectTeacher }: TeachersProps) {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<TabFilter>('all')
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null)

  // Modal state
  const [showAddTeacher, setShowAddTeacher] = useState(false)

  useEffect(() => {
    fetchTeachers()
  }, [])

  // Handle external selection (from CommandPalette)
  useEffect(() => {
    if (selectedTeacherId && teachers.length > 0) {
      const teacher = teachers.find(t => t.id === selectedTeacherId)
      if (teacher) {
        setSelectedTeacher(teacher)
      } else {
        // Teacher not found in list, fetch directly
        fetchTeacherById(selectedTeacherId)
      }
    }
  }, [selectedTeacherId, teachers])

  async function fetchTeacherById(id: string) {
    const { data, error } = await supabase
      .from('teachers')
      .select('*')
      .eq('id', id)
      .single()

    if (!error && data) {
      const teacherData = data as Teacher
      
      // Also fetch assignment data for this teacher
      const { data: assignmentData } = await supabase
        .from('teacher_assignments')
        .select('teacher_id, hours_per_week, is_active')
        .eq('teacher_id', id)
        .eq('is_active', true)

      const assignments = (assignmentData || []) as AssignmentData[]
      const teacherWithLoad: Teacher = {
        ...teacherData,
        active_assignments: assignments.length,
        assigned_hours: assignments.reduce((sum, a) => sum + (a.hours_per_week || 0), 0)
      }
      setSelectedTeacher(teacherWithLoad)
    }
  }

  async function fetchTeachers() {
    setLoading(true)
    
    // Fetch teachers
    const { data: teacherData, error: teacherError } = await supabase
      .from('teachers')
      .select('*')
      .order('display_name')

    if (teacherError) {
      console.error('Error fetching teachers:', teacherError)
      setLoading(false)
      return
    }

    // Fetch assignment counts per teacher
    const { data: assignmentData, error: assignmentError } = await supabase
      .from('teacher_assignments')
      .select('teacher_id, hours_per_week, is_active')
      .eq('is_active', true)

    if (assignmentError) {
      console.error('Error fetching assignments:', assignmentError)
    }

    // Cast the data to our known types
    const typedTeachers = (teacherData || []) as Teacher[]
    const typedAssignments = (assignmentData || []) as AssignmentData[]

    // Merge assignment data into teachers
    const teachersWithLoad: Teacher[] = typedTeachers.map((teacher) => {
      const assignments = typedAssignments.filter((a) => a.teacher_id === teacher.id)
      return {
        ...teacher,
        active_assignments: assignments.length,
        assigned_hours: assignments.reduce((sum, a) => sum + (a.hours_per_week || 0), 0)
      }
    })

    setTeachers(teachersWithLoad)
    setLoading(false)
  }

  const handleSelectTeacher = (teacher: Teacher | null) => {
    setSelectedTeacher(teacher)
    onSelectTeacher?.(teacher?.id || null)
  }

  const handleClosePanel = () => {
    setSelectedTeacher(null)
    onSelectTeacher?.(null)
  }

  const handleTeacherUpdated = () => {
    // Refresh the list and re-fetch selected teacher if needed
    fetchTeachers()
    if (selectedTeacher) {
      fetchTeacherById(selectedTeacher.id)
    }
  }

  // Filter teachers based on search and tab
  const filteredTeachers = teachers.filter(teacher => {
    // Tab filter
    if (activeTab === 'active' && teacher.status !== 'active') return false
    if (activeTab === 'reserve' && teacher.status !== 'reserve') return false

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        teacher.display_name.toLowerCase().includes(query) ||
        teacher.email?.toLowerCase().includes(query) ||
        teacher.role?.toLowerCase().includes(query) ||
        teacher.skillset?.toLowerCase().includes(query)
      )
    }

    return true
  })

  const tabs: { key: TabFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All Teachers', count: teachers.length },
    { key: 'active', label: 'Active', count: teachers.filter(t => t.status === 'active').length },
    { key: 'reserve', label: 'Reserve', count: teachers.filter(t => t.status === 'reserve').length },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold">Teachers</h1>
          <button 
            onClick={() => setShowAddTeacher(true)}
            className="flex items-center gap-2 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-md text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Teacher
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search teachers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <button className="flex items-center gap-2 px-3 py-2 border border-border rounded-md text-sm hover:bg-accent">
            <Filter className="w-4 h-4" />
            Filters
          </button>
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
              <span className="ml-1.5 text-xs text-muted-foreground">({tab.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Teacher Cards Grid */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Loading teachers...
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No teachers found
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTeachers.map(teacher => (
              <TeacherCard
                key={teacher.id}
                teacher={teacher}
                isSelected={selectedTeacher?.id === teacher.id}
                onClick={() => handleSelectTeacher(teacher)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedTeacher && (
        <TeacherDetailPanel
          teacher={selectedTeacher}
          onClose={handleClosePanel}
          onTeacherUpdated={handleTeacherUpdated}
        />
      )}

      {/* Add Teacher Modal */}
      <AddTeacherModal
        isOpen={showAddTeacher}
        onClose={() => setShowAddTeacher(false)}
        onSuccess={() => {
          fetchTeachers()
        }}
      />
    </div>
  )
}

// Teacher Card Component
function TeacherCard({ 
  teacher, 
  isSelected,
  onClick 
}: { 
  teacher: Teacher
  isSelected?: boolean
  onClick: () => void 
}) {
  const loadPercent = teacher.max_hours_per_week 
    ? Math.min(100, ((teacher.assigned_hours || 0) / teacher.max_hours_per_week) * 100)
    : 0

  return (
    <div
      onClick={onClick}
      className={`p-4 bg-card border rounded-lg hover:border-accent cursor-pointer transition-colors ${
        isSelected ? 'border-accent bg-accent/10' : 'border-border'
      }`}
    >
      {/* Name & Status */}
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-medium">{teacher.display_name}</h3>
        <StatusBadge status={teacher.status} />
      </div>

      {/* Role */}
      <p className="text-sm text-muted-foreground mb-3">
        {teacher.role || 'No role assigned'}
      </p>

      {/* Stats */}
      <div className="space-y-2 mb-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Students</span>
          <span>{teacher.active_assignments || 0}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Hours/week</span>
          <span>
            {teacher.assigned_hours || 0}/{teacher.max_hours_per_week || '—'}
          </span>
        </div>
      </div>

      {/* Load Bar */}
      {teacher.max_hours_per_week && (
        <div className="mb-3">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                loadPercent >= 90 ? 'bg-status-churned' :
                loadPercent >= 70 ? 'bg-status-paused' :
                'bg-status-active'
              }`}
              style={{ width: `${loadPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Rate & Payment Info */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {teacher.default_hourly_rate 
            ? `$${teacher.default_hourly_rate}/hr` 
            : 'Rate TBD'}
        </span>
        {teacher.payment_info_on_file ? (
          <span className="text-status-active text-xs">✓ Payment info</span>
        ) : (
          <span className="text-status-paused text-xs">⚠ Need docs</span>
        )}
      </div>
    </div>
  )
}

// Status Badge Component
function StatusBadge({ status }: { status: Teacher['status'] }) {
  const styles = {
    active: 'bg-status-active/20 text-status-active',
    reserve: 'bg-status-trial/20 text-status-trial',
    inactive: 'bg-muted text-muted-foreground',
  }

  return (
    <span className={`px-2 py-0.5 text-xs rounded-full ${styles[status]}`}>
      {status}
    </span>
  )
}