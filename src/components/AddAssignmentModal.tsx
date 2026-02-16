import { useState, useMemo } from 'react'
import { Search, Briefcase, GraduationCap, User } from 'lucide-react'
import { AccessibleModal } from './ui/AccessibleModal'
import { ModalFooter } from './ui/ModalFooter'
import {
  useActiveServices,
  useEnrollments,
  useTeacherAssignments,
  useTeacherAssignmentMutations,
  getServiceBadgeColor,
  getServiceShortName,
  type Service,
  type EnrollmentWithDetails,
} from '../lib/hooks'
import { getTodayString } from '../lib/dateUtils'

interface AddAssignmentModalProps {
  isOpen: boolean
  teacherId: string
  teacherName: string
  defaultRate?: number | null
  onClose: () => void
  onSuccess?: () => void
}

type AssignmentMode = 'select' | 'service' | 'enrollment'

// Services that support service-level assignments
const SERVICE_LEVEL_SERVICES = ['learning_pod', 'elective_classes', 'eaton_hub', 'microschool']

export function AddAssignmentModal({
  isOpen,
  teacherId,
  teacherName,
  defaultRate,
  onClose,
  onSuccess,
}: AddAssignmentModalProps) {
  // Mode state
  const [mode, setMode] = useState<AssignmentMode>('select')

  // Selection state
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string | null>(null)

  // Form state
  const [hourlyRate, setHourlyRate] = useState(defaultRate?.toString() || '')
  const [hoursPerWeek, setHoursPerWeek] = useState('')
  const [notes, setNotes] = useState('')
  const [startDate, setStartDate] = useState(getTodayString())
  const [searchQuery, setSearchQuery] = useState('')

  // Error state
  const [error, setError] = useState<string | null>(null)

  // Data queries
  const { data: services = [] } = useActiveServices()
  const { data: enrollments = [], isLoading: loadingEnrollments } = useEnrollments({ status: 'active' })
  const { data: existingAssignments = [] } = useTeacherAssignments(teacherId)

  // Mutations
  const { createAssignment } = useTeacherAssignmentMutations()
  const isSubmitting = createAssignment.isPending

  // Filter services to only those that support service-level assignments
  const serviceLevelServices = useMemo(() => {
    return services.filter(s => SERVICE_LEVEL_SERVICES.includes(s.code))
  }, [services])

  // Get existing service-level assignment service IDs for this teacher
  const existingServiceIds = useMemo(() => {
    return new Set(
      existingAssignments
        .filter(a => a.service_id && !a.enrollment_id && a.is_active)
        .map(a => a.service_id)
    )
  }, [existingAssignments])

  // Get existing enrollment-level assignment enrollment IDs for this teacher
  const existingEnrollmentIds = useMemo(() => {
    return new Set(
      existingAssignments
        .filter(a => a.enrollment_id && a.is_active)
        .map(a => a.enrollment_id)
    )
  }, [existingAssignments])

  // Filter enrollments to exclude those already assigned to this teacher
  // and filter by search query
  const availableEnrollments = useMemo(() => {
    return enrollments.filter((e: EnrollmentWithDetails) => {
      // Exclude already assigned
      if (existingEnrollmentIds.has(e.id)) return false

      // Only show enrollments that require teacher (AC, EO, etc.)
      if (!e.service?.requires_teacher) return false

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const studentName = e.student?.full_name?.toLowerCase() || ''
        const familyName = e.family?.display_name?.toLowerCase() || ''
        const serviceName = e.service?.name?.toLowerCase() || ''
        return studentName.includes(query) || familyName.includes(query) || serviceName.includes(query)
      }

      return true
    })
  }, [enrollments, existingEnrollmentIds, searchQuery])

  // Get selected service
  const selectedService = useMemo(() => {
    return services.find(s => s.id === selectedServiceId)
  }, [services, selectedServiceId])

  // Get selected enrollment
  const selectedEnrollment = useMemo(() => {
    return enrollments.find((e: EnrollmentWithDetails) => e.id === selectedEnrollmentId)
  }, [enrollments, selectedEnrollmentId])

  function handleServiceSelect(service: Service) {
    setSelectedServiceId(service.id)
    if (service.default_teacher_rate && !hourlyRate) {
      setHourlyRate(service.default_teacher_rate.toString())
    }
  }

  function handleEnrollmentSelect(enrollment: EnrollmentWithDetails) {
    setSelectedEnrollmentId(enrollment.id)
    // Pre-fill hours from enrollment if available
    if (enrollment.hours_per_week && !hoursPerWeek) {
      setHoursPerWeek(enrollment.hours_per_week.toString())
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Validate based on mode
    if (mode === 'service' && !selectedServiceId) {
      setError('Please select a service')
      return
    }
    if (mode === 'enrollment' && !selectedEnrollmentId) {
      setError('Please select an enrollment')
      return
    }

    const assignmentData: Record<string, unknown> = {
      teacher_id: teacherId,
      hourly_rate_teacher: hourlyRate ? parseFloat(hourlyRate) : null,
      hours_per_week: hoursPerWeek ? parseFloat(hoursPerWeek) : null,
      notes: notes || null,
      start_date: startDate || null,
      is_active: true,
    }

    if (mode === 'service') {
      assignmentData.service_id = selectedServiceId
      assignmentData.enrollment_id = null
    } else if (mode === 'enrollment') {
      assignmentData.enrollment_id = selectedEnrollmentId
      assignmentData.service_id = null
    }

    createAssignment.mutate(assignmentData, {
      onSuccess: () => {
        onSuccess?.()
        handleClose()
      },
      onError: (err) => {
        console.error('Failed to create assignment:', err)
        setError(err instanceof Error ? err.message : 'Failed to create assignment')
      },
    })
  }

  function handleClose() {
    setMode('select')
    setSelectedServiceId(null)
    setSelectedEnrollmentId(null)
    setHourlyRate(defaultRate?.toString() || '')
    setHoursPerWeek('')
    setNotes('')
    setStartDate(getTodayString())
    setSearchQuery('')
    setError(null)
    createAssignment.reset()
    onClose()
  }

  function handleBack() {
    setMode('select')
    setSelectedServiceId(null)
    setSelectedEnrollmentId(null)
    setSearchQuery('')
    setError(null)
  }

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Assignment"
      subtitle={`Assign ${teacherName} to a service or student`}
      size="lg"
    >
      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Mode Selection */}
        {mode === 'select' && (
          <div className="p-6 space-y-4">
            <p className="text-sm text-zinc-400">Choose assignment type:</p>

            <button
              onClick={() => setMode('service')}
              className="w-full flex items-center gap-4 p-4 bg-zinc-800 border border-zinc-700 rounded-lg hover:border-zinc-600 transition-colors text-left"
            >
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Briefcase className="h-6 w-6 text-purple-400" aria-hidden="true" />
              </div>
              <div>
                <p className="font-medium text-white">Service Assignment</p>
                <p className="text-sm text-zinc-400">
                  Learning Pod, Elective Classes, Eaton Hub, Microschool
                </p>
              </div>
            </button>

            <button
              onClick={() => setMode('enrollment')}
              className="w-full flex items-center gap-4 p-4 bg-zinc-800 border border-zinc-700 rounded-lg hover:border-zinc-600 transition-colors text-left"
            >
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <GraduationCap className="h-6 w-6 text-blue-400" aria-hidden="true" />
              </div>
              <div>
                <p className="font-medium text-white">Student Assignment</p>
                <p className="text-sm text-zinc-400">
                  Academic Coaching, Eaton Online, etc.
                </p>
              </div>
            </button>
          </div>
        )}

        {/* Service Selection */}
        {mode === 'service' && !selectedServiceId && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <button
                onClick={handleBack}
                className="text-sm text-zinc-400 hover:text-white"
              >
                &larr; Back
              </button>
              <span className="text-sm text-zinc-500">Select a service</span>
            </div>

            <div className="space-y-2">
              {serviceLevelServices.map((service) => {
                const alreadyAssigned = existingServiceIds.has(service.id)
                return (
                  <button
                    key={service.id}
                    onClick={() => !alreadyAssigned && handleServiceSelect(service)}
                    disabled={alreadyAssigned}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
                      alreadyAssigned
                        ? 'bg-zinc-800/50 border-zinc-800 text-zinc-600 cursor-not-allowed'
                        : 'bg-zinc-800 border-zinc-700 hover:border-zinc-600 text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 text-xs rounded border ${getServiceBadgeColor(service.code)}`}>
                        {getServiceShortName(service.code)}
                      </span>
                      <span className="font-medium">{service.name}</span>
                    </div>
                    {alreadyAssigned && (
                      <span className="text-xs text-zinc-500">Already assigned</span>
                    )}
                    {service.default_teacher_rate && !alreadyAssigned && (
                      <span className="text-sm text-zinc-500">${service.default_teacher_rate}/hr</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Enrollment Selection */}
        {mode === 'enrollment' && !selectedEnrollmentId && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <button
                onClick={handleBack}
                className="text-sm text-zinc-400 hover:text-white"
              >
                &larr; Back
              </button>
              <span className="text-sm text-zinc-500">Select a student enrollment</span>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" aria-hidden="true" />
              <input
                type="text"
                id="enrollment-search"
                placeholder="Search students, families..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Enrollment List */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {loadingEnrollments ? (
                <div className="text-center py-4 text-zinc-500">Loading enrollments...</div>
              ) : availableEnrollments.length === 0 ? (
                <div className="text-center py-4 text-zinc-500">
                  {searchQuery ? 'No matching enrollments found' : 'No available enrollments'}
                </div>
              ) : (
                availableEnrollments.map((enrollment: EnrollmentWithDetails) => (
                  <button
                    key={enrollment.id}
                    onClick={() => handleEnrollmentSelect(enrollment)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-lg border bg-zinc-800 border-zinc-700 hover:border-zinc-600 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
                        <User className="w-4 h-4 text-zinc-400" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{enrollment.student?.full_name}</p>
                        <p className="text-xs text-zinc-500">{enrollment.family?.display_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-0.5 text-xs rounded border ${getServiceBadgeColor(enrollment.service?.code || '')}`}>
                        {getServiceShortName(enrollment.service?.code || '')}
                      </span>
                      {enrollment.hours_per_week && (
                        <p className="text-xs text-zinc-500 mt-1">{enrollment.hours_per_week} hrs/wk</p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Assignment Form */}
        {((mode === 'service' && selectedServiceId) || (mode === 'enrollment' && selectedEnrollmentId)) && (
          <form onSubmit={handleSubmit} className="flex flex-col">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleBack}
                  className="text-sm text-zinc-400 hover:text-white"
                >
                  &larr; Change selection
                </button>
              </div>

              {/* Selected Item Display */}
              <div className="bg-zinc-800/50 rounded-lg p-4">
                {mode === 'service' && selectedService && (
                  <div className="flex items-center gap-3">
                    <Briefcase className="h-5 w-5 text-purple-400" aria-hidden="true" />
                    <div>
                      <span className={`px-2 py-0.5 text-xs rounded border ${getServiceBadgeColor(selectedService.code)}`}>
                        {getServiceShortName(selectedService.code)}
                      </span>
                      <p className="text-white font-medium mt-1">{selectedService.name}</p>
                    </div>
                  </div>
                )}
                {mode === 'enrollment' && selectedEnrollment && (
                  <div className="flex items-center gap-3">
                    <GraduationCap className="h-5 w-5 text-blue-400" aria-hidden="true" />
                    <div>
                      <span className={`px-2 py-0.5 text-xs rounded border ${getServiceBadgeColor(selectedEnrollment.service?.code || '')}`}>
                        {getServiceShortName(selectedEnrollment.service?.code || '')}
                      </span>
                      <p className="text-white font-medium mt-1">{selectedEnrollment.student?.full_name}</p>
                      <p className="text-xs text-zinc-500">{selectedEnrollment.family?.display_name}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="hourly-rate" className="block text-sm font-medium text-zinc-400 mb-1">
                    Hourly Rate ($)
                  </label>
                  <input
                    type="number"
                    id="hourly-rate"
                    step="0.01"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    placeholder="70.00"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="hours-per-week" className="block text-sm font-medium text-zinc-400 mb-1">
                    Hours/Week
                  </label>
                  <input
                    type="number"
                    id="hours-per-week"
                    step="0.5"
                    value={hoursPerWeek}
                    onChange={(e) => setHoursPerWeek(e.target.value)}
                    placeholder="Variable"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="start-date" className="block text-sm font-medium text-zinc-400 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  id="start-date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-zinc-400 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Schedule details, special instructions, etc."
                  rows={2}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* Error */}
              {error && (
                <div role="alert" className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>

            <ModalFooter
              onCancel={handleClose}
              isSubmitting={isSubmitting}
              submitText="Create Assignment"
              loadingText="Creating..."
              className="px-6 py-4"
            />
          </form>
        )}
      </div>
    </AccessibleModal>
  )
}
