import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import { queryKeys } from './queryClient'
import { searchGmail, getGmailThread, sendGmail } from './gmail'
import { getTodayString } from './dateUtils'
import { addMoney, centsToDollars } from './moneyUtils'
import type { GmailSearchParams } from '../types/gmail'

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type CustomerStatus = 'trial' | 'active' | 'paused' | 'churned'
export type EnrollmentStatus = 'trial' | 'active' | 'paused' | 'ended'
export type EmployeeStatus = 'active' | 'reserve' | 'inactive'
export type BillingFrequency = 'per_session' | 'weekly' | 'monthly' | 'bi_monthly' | 'annual' | 'one_time'
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'void'

export interface Family {
  id: string
  display_name: string
  status: CustomerStatus
  primary_email: string | null
  primary_phone: string | null
  primary_contact_name: string | null
  payment_gateway: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  zip: string | null
  notes: string | null
  last_contact_at: string | null
  created_at: string
  updated_at: string
}

export interface Student {
  id: string
  family_id: string
  full_name: string
  dob: string | null
  grade_level: string | null
  age_group: string | null
  active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Teacher {
  id: string
  display_name: string
  email: string | null
  phone: string | null
  role: string | null
  skillset: string | null
  preferred_comm_method: string | null
  status: EmployeeStatus
  default_hourly_rate: number | null
  max_hours_per_week: number | null
  payment_info_on_file: boolean
  hire_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Service {
  id: string
  code: string
  name: string
  billing_frequency: BillingFrequency
  default_customer_rate: number | null
  default_teacher_rate: number | null
  requires_teacher: boolean
  description: string | null
  is_active: boolean
}

export interface Enrollment {
  id: string
  family_id: string
  student_id: string | null
  service_id: string
  status: EnrollmentStatus
  start_date: string | null
  end_date: string | null
  enrollment_period: string | null
  annual_fee: number | null
  monthly_rate: number | null
  weekly_tuition: number | null
  hourly_rate_customer: number | null
  hours_per_week: number | null
  daily_rate: number | null
  billing_frequency: BillingFrequency | null
  curriculum: string | null
  program_type: string | null
  class_title: string | null
  schedule_notes: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface TeacherAssignment {
  id: string
  enrollment_id: string | null
  teacher_id: string
  service_id: string | null  // NEW: For service-level assignments
  hourly_rate_teacher: number | null
  hours_per_week: number | null
  is_active: boolean
  start_date: string | null
  end_date: string | null
  notes: string | null
  created_at: string
}

export interface Invoice {
  id: string
  family_id: string
  invoice_number: string | null
  public_id: string | null
  invoice_date: string
  due_date: string | null
  period_start: string | null
  period_end: string | null
  subtotal: number | null
  total_amount: number | null
  amount_paid: number
  balance_due: number
  status: InvoiceStatus
  sent_at: string | null
  sent_to?: string | null
  viewed_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface InvoiceLineItem {
  id: string
  invoice_id: string
  enrollment_id: string | null
  description: string
  quantity: number
  unit_price: number | null
  amount: number | null
  teacher_cost: number | null
  profit: number | null
  sort_order: number
  created_at: string
  enrollment?: {
    service?: {
      code: string
      name: string
    }
  }
}

export interface TeacherPayment {
  id: string
  teacher_id: string
  pay_period_start: string
  pay_period_end: string
  pay_date: string
  total_amount: number
  payment_method: string | null
  reference: string | null
  notes: string | null
  created_at: string
}

// Invoice Email type for email history tracking
export interface InvoiceEmail {
  id: string
  invoice_id: string
  email_type: string
  sent_to: string
  sent_at: string
  subject: string | null
  opened_at: string | null
  clicked_at: string | null
  created_at: string
}

// =============================================================================
// TEACHER LOAD TYPES (NEW)
// =============================================================================

export interface TeacherAssignmentWithDetails {
  id: string
  teacher_id: string
  enrollment_id: string | null
  service_id: string | null
  hourly_rate_teacher: number | null
  hours_per_week: number | null
  is_active: boolean
  start_date: string | null
  end_date: string | null
  notes: string | null
  created_at: string
  // Joined data for enrollment-level
  enrollment?: {
    id: string
    student?: {
      id: string
      full_name: string
      family?: {
        id: string
        display_name: string
      }
    }
    service?: {
      id: string
      code: string
      name: string
    }
  }
  // Joined data for service-level
  service?: {
    id: string
    code: string
    name: string
  }
}

export interface TeacherWithLoad extends Teacher {
  // Assignment counts
  enrollmentAssignmentCount: number
  serviceAssignmentCount: number
  totalActiveStudents: number
  
  // Rate info
  minRate: number | null
  maxRate: number | null
  avgRate: number | null
  rateDisplay: string // e.g., "$65", "$65-80", or "N/A"
  
  // Hours info
  definedHours: number // Sum of hours where hours_per_week is set
  hasVariableHours: boolean // True if any assignment has NULL hours
  hoursDisplay: string // e.g., "24", "24+", or "Variable"
  
  // All assignments (for detail view)
  allAssignments: TeacherAssignmentWithDetails[]
}

// =============================================================================
// TEACHER LOAD HELPER FUNCTIONS (NEW)
// =============================================================================

function calculateTeacherLoad(
  teacher: Teacher,
  assignments: TeacherAssignmentWithDetails[]
): TeacherWithLoad {
  const activeAssignments = assignments.filter(a => a.is_active)
  
  // Count by type
  const enrollmentAssignments = activeAssignments.filter(a => a.enrollment_id !== null)
  const serviceAssignments = activeAssignments.filter(a => a.service_id !== null && a.enrollment_id === null)
  
  // Get unique students (only from enrollment assignments)
  const uniqueStudentIds = new Set(
    enrollmentAssignments
      .map(a => a.enrollment?.student?.id)
      .filter((id): id is string => id !== undefined)
  )
  
  // Calculate rates
  const rates = activeAssignments
    .map(a => a.hourly_rate_teacher)
    .filter((r): r is number => r !== null && r > 0)
  
  const minRate = rates.length > 0 ? Math.min(...rates) : null
  const maxRate = rates.length > 0 ? Math.max(...rates) : null
  const avgRate = rates.length > 0 
    ? Math.round(rates.reduce((sum, r) => sum + r, 0) / rates.length * 100) / 100
    : null
  
  // Rate display
  let rateDisplay = 'N/A'
  if (minRate !== null && maxRate !== null) {
    if (minRate === maxRate) {
      rateDisplay = `$${minRate}`
    } else {
      rateDisplay = `$${minRate}-${maxRate}`
    }
  }
  
  // Calculate hours
  const definedHours = activeAssignments.reduce((sum, a) => {
    return sum + (a.hours_per_week ?? 0)
  }, 0)
  
  const hasVariableHours = activeAssignments.some(a => 
    a.is_active && a.hourly_rate_teacher !== null && a.hours_per_week === null
  )
  
  // Hours display
  let hoursDisplay = definedHours > 0 ? definedHours.toString() : '0'
  if (hasVariableHours) {
    hoursDisplay = definedHours > 0 ? `${definedHours}+` : 'Variable'
  }
  
  return {
    ...teacher,
    enrollmentAssignmentCount: enrollmentAssignments.length,
    serviceAssignmentCount: serviceAssignments.length,
    totalActiveStudents: uniqueStudentIds.size,
    minRate,
    maxRate,
    avgRate,
    rateDisplay,
    definedHours,
    hasVariableHours,
    hoursDisplay,
    allAssignments: activeAssignments,
  }
}

// =============================================================================
// SERVICE BADGE HELPERS (NEW)
// =============================================================================

export function getServiceBadgeColor(code: string): string {
  const colors: Record<string, string> = {
    academic_coaching: 'bg-blue-900/50 text-blue-300 border-blue-700',
    learning_pod: 'bg-green-900/50 text-green-300 border-green-700',
    consulting: 'bg-pink-900/50 text-pink-300 border-pink-700',
    eaton_online: 'bg-purple-900/50 text-purple-300 border-purple-700',
    eaton_hub: 'bg-amber-900/50 text-amber-300 border-amber-700',
    elective_classes: 'bg-cyan-900/50 text-cyan-300 border-cyan-700',
  }
  return colors[code] || 'bg-gray-900/50 text-gray-300 border-gray-700'
}

export function getServiceShortName(code: string): string {
  const names: Record<string, string> = {
    academic_coaching: 'AC',
    learning_pod: 'Pod',
    consulting: 'Consult',
    eaton_online: 'Online',
    eaton_hub: 'Hub',
    elective_classes: 'Elective',
  }
  return names[code] || code
}

// =============================================================================
// FAMILIES HOOKS
// =============================================================================

export function useFamilies(filters?: { status?: string; search?: string; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.families.list(filters),
    queryFn: async () => {
      let query = supabase
        .from('families')
        .select('*')
        .order('display_name')
        .limit(filters?.limit ?? 500) // Default limit to prevent unbounded fetching

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status as 'trial' | 'active' | 'paused' | 'churned')
      }

      if (filters?.search) {
        query = query.or(`display_name.ilike.%${filters.search}%,primary_email.ilike.%${filters.search}%`)
      }

      const { data, error } = await query
      if (error) throw error
      return data as Family[]
    },
  })
}

export function useFamiliesWithStudents() {
  return useQuery({
    queryKey: queryKeys.families.withStudents(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('families')
        .select(`
          *,
          students(*)
        `)
        .in('status', ['active', 'trial'])
        .order('display_name')

      if (error) throw error
      return data as (Family & { students: Student[] })[]
    },
  })
}

export function useFamily(id: string) {
  return useQuery({
    queryKey: queryKeys.families.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('families')
        .select(`
          *,
          students(*)
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return data as Family & { students: Student[] }
    },
    enabled: !!id,
  })
}

export function useFamilyMutations() {
  const queryClient = useQueryClient()

  const createFamily = useMutation({
    mutationFn: async (data: Partial<Family>) => {
      const { data: family, error } = await (supabase.from('families') as any)
        .insert(data)
        .select()
        .single()
      if (error) throw error
      return family
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.families.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() })
    },
  })

  const updateFamily = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Family> }) => {
      const { data: family, error } = await (supabase.from('families') as any)
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return family
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.families.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.families.detail(variables.id) })
    },
  })

  const deleteFamily = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('families').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.families.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() })
    },
  })

  return { createFamily, updateFamily, deleteFamily }
}

// =============================================================================
// STUDENTS HOOKS
// =============================================================================

export function useStudentsByFamily(familyId: string) {
  return useQuery({
    queryKey: queryKeys.students.byFamily(familyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('family_id', familyId)
        .order('full_name')

      if (error) throw error
      return data as Student[]
    },
    enabled: !!familyId,
  })
}

export function useStudentMutations() {
  const queryClient = useQueryClient()

  const createStudent = useMutation({
    mutationFn: async (data: Partial<Student>) => {
      // Check for duplicate student name within the same family
      if (data.family_id && data.full_name) {
        const normalizedName = data.full_name.trim().toLowerCase()
        const { data: existingStudents, error: checkError } = await supabase
          .from('students')
          .select('id, full_name')
          .eq('family_id', data.family_id)

        if (checkError) throw checkError

        const duplicate = existingStudents?.find(
          (s: any) => s.full_name.trim().toLowerCase() === normalizedName
        )

        if (duplicate) {
          throw new Error(`A student named "${duplicate.full_name}" already exists in this family. Please use a different name or edit the existing student.`)
        }
      }

      const { data: student, error } = await (supabase.from('students') as any)
        .insert(data)
        .select()
        .single()
      if (error) throw error
      return student
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all })
      if (variables.family_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.students.byFamily(variables.family_id) })
        queryClient.invalidateQueries({ queryKey: queryKeys.families.detail(variables.family_id) })
      }
    },
  })

  const updateStudent = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Student> }) => {
      const { data: student, error } = await (supabase.from('students') as any)
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return student
    },
    onSuccess: (student) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.families.all })
      // Invalidate family detail to update student list in family view
      if (student.family_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.families.detail(student.family_id) })
        queryClient.invalidateQueries({ queryKey: queryKeys.students.byFamily(student.family_id) })
      }
    },
  })

  const deleteStudent = useMutation({
    mutationFn: async (id: string) => {
      // Check for active enrollments BEFORE deleting
      // The database has ON DELETE CASCADE which would silently delete enrollments!
      const { data: enrollments, error: checkError } = await (supabase
        .from('enrollments')
        .select('id, status')
        .eq('student_id', id) as any)
      
      if (checkError) throw checkError
      
      if (enrollments && enrollments.length > 0) {
        const activeCount = enrollments.filter((e: any) => e.status === 'active' || e.status === 'trial').length
        const endedCount = enrollments.filter((e: any) => e.status === 'ended' || e.status === 'paused').length
        
        if (activeCount > 0) {
          throw new Error(`Cannot delete student with ${activeCount} active enrollment${activeCount !== 1 ? 's' : ''}. End the enrollments first.`)
        }
        
        // Even ended enrollments are historical data - warn but allow
        if (endedCount > 0) {
          throw new Error(`This student has ${endedCount} historical enrollment${endedCount !== 1 ? 's' : ''}. Deleting will remove enrollment history. Use the 'Confirm Delete with History' option if you're sure.`)
        }
      }
      
      const { error } = await supabase.from('students').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.families.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all })
    },
  })

  // Force delete student even with historical enrollments (use with caution)
  const forceDeleteStudent = useMutation({
    mutationFn: async (id: string) => {
      // Only check for ACTIVE enrollments - block those
      const { data: activeEnrollments, error: checkError } = await (supabase
        .from('enrollments')
        .select('id')
        .eq('student_id', id)
        .in('status', ['active', 'trial']) as any)
      
      if (checkError) throw checkError
      
      if (activeEnrollments && activeEnrollments.length > 0) {
        throw new Error(`Cannot delete student with ${activeEnrollments.length} active enrollment${activeEnrollments.length !== 1 ? 's' : ''}. End the enrollments first.`)
      }
      
      // Proceed with delete - cascade will remove historical enrollments
      const { error } = await supabase.from('students').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.families.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all })
    },
  })

  return { createStudent, updateStudent, deleteStudent, forceDeleteStudent }
}

// =============================================================================
// TEACHERS HOOKS
// =============================================================================

export function useTeachers(filters?: { status?: string }) {
  return useQuery({
    queryKey: queryKeys.teachers.list(filters),
    queryFn: async () => {
      let query = supabase
        .from('teachers')
        .select('*')
        .order('display_name')

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status as 'active' | 'reserve' | 'inactive')
      }

      const { data, error } = await query
      if (error) throw error
      return data as Teacher[]
    },
  })
}

export function useActiveTeachers() {
  return useQuery({
    queryKey: queryKeys.teachers.active(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .eq('status', 'active')
        .order('display_name')

      if (error) throw error
      return data as Teacher[]
    },
  })
}

export function useTeacher(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.teachers.detail(id || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .eq('id', id!)
        .single()

      if (error) throw error
      return data as Teacher
    },
    enabled: !!id,
  })
}

export function useTeacherMutations() {
  const queryClient = useQueryClient()

  const createTeacher = useMutation({
    mutationFn: async (data: Partial<Teacher>) => {
      const { data: teacher, error } = await (supabase.from('teachers') as any)
        .insert(data)
        .select()
        .single()
      if (error) throw error
      return teacher
    },
    onSuccess: () => {
      // Invalidate teacher lists and related data
      queryClient.invalidateQueries({ queryKey: queryKeys.teachers.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() })
    },
  })

  const updateTeacher = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Teacher> }) => {
      const { data: teacher, error } = await (supabase.from('teachers') as any)
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return teacher
    },
    onSuccess: (_, variables) => {
      // Invalidate teacher-specific data
      queryClient.invalidateQueries({ queryKey: queryKeys.teachers.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.teachers.detail(variables.id) })
      
      // Invalidate enrollments (they include nested teacher data in assignments)
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all })
      
      // Invalidate teacher assignments (they include teacher data)
      queryClient.invalidateQueries({ queryKey: queryKeys.teacherAssignments.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.teacherAssignments.byTeacher(variables.id) })
      
      // Invalidate dashboard stats (teacher count)
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() })
    },
  })

  const deleteTeacher = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('teachers').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      // Invalidate teacher lists and related data
      queryClient.invalidateQueries({ queryKey: queryKeys.teachers.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.teacherAssignments.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() })
    },
  })

  return { createTeacher, updateTeacher, deleteTeacher }
}

// =============================================================================
// TEACHER LOAD HOOKS (NEW)
// =============================================================================

/**
 * Fetch all assignments for a specific teacher (both enrollment and service-level)
 */
export function useTeacherAssignments(teacherId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.teacherAssignments.byTeacher(teacherId || ''),
    queryFn: async (): Promise<TeacherAssignmentWithDetails[]> => {
      if (!teacherId) return []
      
      // Fetch enrollment-level assignments
      const { data: enrollmentAssignments, error: error1 } = await (supabase
        .from('teacher_assignments') as any)
        .select(`
          id,
          teacher_id,
          enrollment_id,
          service_id,
          hourly_rate_teacher,
          hours_per_week,
          is_active,
          start_date,
          end_date,
          notes,
          created_at,
          enrollment:enrollments(
            id,
            student:students(
              id,
              full_name,
              family:families(id, display_name)
            ),
            service:services(id, code, name)
          )
        `)
        .eq('teacher_id', teacherId)
        .not('enrollment_id', 'is', null)
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: false })
      
      if (error1) throw error1
      
      // Fetch service-level assignments
      const { data: serviceAssignments, error: error2 } = await (supabase
        .from('teacher_assignments') as any)
        .select(`
          id,
          teacher_id,
          enrollment_id,
          service_id,
          hourly_rate_teacher,
          hours_per_week,
          is_active,
          start_date,
          end_date,
          notes,
          created_at,
          service:services(id, code, name)
        `)
        .eq('teacher_id', teacherId)
        .not('service_id', 'is', null)
        .is('enrollment_id', null)
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: false })
      
      if (error2) throw error2
      
      // Combine results
      const combined = [
        ...(enrollmentAssignments || []),
        ...(serviceAssignments || []),
      ] as TeacherAssignmentWithDetails[]
      
      return combined
    },
    enabled: !!teacherId,
  })
}

/**
 * Fetch all teachers with their load calculations
 * This enhances the existing useTeachers hook for the Teachers view
 */
export function useTeachersWithLoad(filters?: { status?: string }) {
  const teachersQuery = useTeachers(filters)
  
  return useQuery({
    queryKey: queryKeys.teachers.withLoad(filters),
    queryFn: async (): Promise<TeacherWithLoad[]> => {
      const teachers = teachersQuery.data
      if (!teachers || teachers.length === 0) return []
      
      // Fetch ALL active assignments in one query
      const { data: allEnrollmentAssignments, error: error1 } = await (supabase
        .from('teacher_assignments') as any)
        .select(`
          id,
          teacher_id,
          enrollment_id,
          service_id,
          hourly_rate_teacher,
          hours_per_week,
          is_active,
          start_date,
          end_date,
          notes,
          created_at,
          enrollment:enrollments(
            id,
            student:students(
              id,
              full_name,
              family:families(id, display_name)
            ),
            service:services(id, code, name)
          )
        `)
        .eq('is_active', true)
        .not('enrollment_id', 'is', null)
      
      if (error1) throw error1
      
      const { data: allServiceAssignments, error: error2 } = await (supabase
        .from('teacher_assignments') as any)
        .select(`
          id,
          teacher_id,
          enrollment_id,
          service_id,
          hourly_rate_teacher,
          hours_per_week,
          is_active,
          start_date,
          end_date,
          notes,
          created_at,
          service:services(id, code, name)
        `)
        .eq('is_active', true)
        .not('service_id', 'is', null)
        .is('enrollment_id', null)
      
      if (error2) throw error2
      
      // Group assignments by teacher
      const assignmentsByTeacher = new Map<string, TeacherAssignmentWithDetails[]>()
      
      const enrollmentAssignmentsTyped = (allEnrollmentAssignments || []) as TeacherAssignmentWithDetails[]
      const serviceAssignmentsTyped = (allServiceAssignments || []) as TeacherAssignmentWithDetails[]
      
      for (const assignment of enrollmentAssignmentsTyped) {
        const existing = assignmentsByTeacher.get(assignment.teacher_id) || []
        existing.push(assignment)
        assignmentsByTeacher.set(assignment.teacher_id, existing)
      }
      
      for (const assignment of serviceAssignmentsTyped) {
        const existing = assignmentsByTeacher.get(assignment.teacher_id) || []
        existing.push(assignment)
        assignmentsByTeacher.set(assignment.teacher_id, existing)
      }
      
      // Calculate load for each teacher
      return teachers.map(teacher => {
        const assignments = assignmentsByTeacher.get(teacher.id) || []
        return calculateTeacherLoad(teacher, assignments)
      })
    },
    enabled: !!teachersQuery.data && teachersQuery.data.length > 0,
    staleTime: 30000, // 30 seconds
  })
}

/**
 * Fetch a single teacher with full load details
 */
export function useTeacherWithLoad(teacherId: string | undefined) {
  const teacherQuery = useTeacher(teacherId)
  const assignmentsQuery = useTeacherAssignments(teacherId)
  
  return useQuery({
    queryKey: queryKeys.teachers.withLoadSingle(teacherId || ''),
    queryFn: async (): Promise<TeacherWithLoad | null> => {
      if (!teacherQuery.data || !assignmentsQuery.data) return null
      return calculateTeacherLoad(teacherQuery.data, assignmentsQuery.data)
    },
    enabled: !!teacherQuery.data && !!assignmentsQuery.data,
  })
}

// =============================================================================
// SERVICES HOOKS
// =============================================================================

export function useServices() {
  return useQuery({
    queryKey: queryKeys.services.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('name')

      if (error) throw error
      return data as Service[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useActiveServices() {
  return useQuery({
    queryKey: queryKeys.services.active(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      return data as Service[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

// =============================================================================
// ENROLLMENT TYPES
// =============================================================================

export interface EnrollmentWithDetails extends Enrollment {
  student: Student | null
  family: Family | null
  service: Service
  teacher_assignments: (TeacherAssignment & { teacher: Teacher })[]
}

// =============================================================================
// ENROLLMENTS HOOKS
// =============================================================================

export function useEnrollments(filters?: { status?: string; serviceId?: string; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.enrollments.list(filters),
    queryFn: async () => {
      let query = (supabase.from('enrollments') as any)
        .select(`
          *,
          student:students(*),
          family:families(*),
          service:services(*),
          teacher_assignments(
            *,
            teacher:teachers(*)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(filters?.limit ?? 500) // Default limit to prevent unbounded fetching

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }

      if (filters?.serviceId) {
        query = query.eq('service_id', filters.serviceId)
      }

      const { data, error } = await query
      if (error) throw error
      return data as EnrollmentWithDetails[]
    },
  })
}

export function useEnrollmentsByFamily(familyId: string) {
  return useQuery({
    queryKey: queryKeys.enrollments.byFamily(familyId),
    queryFn: async () => {
      const { data, error } = await (supabase.from('enrollments') as any)
        .select(`
          *,
          student:students(*),
          service:services(*),
          teacher_assignments(
            *,
            teacher:teachers(*)
          )
        `)
        .eq('family_id', familyId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as EnrollmentWithDetails[]
    },
    enabled: !!familyId,
  })
}

export function useEnrollment(id: string) {
  return useQuery({
    queryKey: queryKeys.enrollments.detail(id),
    queryFn: async () => {
      const { data, error } = await (supabase.from('enrollments') as any)
        .select(`
          *,
          student:students(*),
          family:families(*),
          service:services(*),
          teacher_assignments(
            *,
            teacher:teachers(*)
          )
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return data as EnrollmentWithDetails
    },
    enabled: !!id,
  })
}

export function useEnrollmentMutations() {
  const queryClient = useQueryClient()

  const createEnrollment = useMutation({
    mutationFn: async (data: Partial<Enrollment> & { teacher_id?: string; hourly_rate_teacher?: number }) => {
      const { teacher_id, hourly_rate_teacher, ...enrollmentData } = data

      // Create enrollment
      const { data: enrollment, error } = await (supabase.from('enrollments') as any)
        .insert(enrollmentData)
        .select()
        .single()
      if (error) throw error

      // Create teacher assignment if provided
      if (teacher_id) {
        const { error: assignError } = await (supabase.from('teacher_assignments') as any)
          .insert({
            enrollment_id: enrollment.id,
            teacher_id,
            hourly_rate_teacher: hourly_rate_teacher || null,
            hours_per_week: enrollmentData.hours_per_week || null,
            is_active: true,
            start_date: enrollmentData.start_date,
          })
        if (assignError) throw assignError
      }

      return enrollment
    },
    onSuccess: (enrollment) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.teacherAssignments.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() })
      // Invalidate family/student-scoped enrollment queries
      if (enrollment.family_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.byFamily(enrollment.family_id) })
      }
      if (enrollment.student_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.byStudent(enrollment.student_id) })
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.billable() })
    },
  })

  const updateEnrollment = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Enrollment> }) => {
      const { data: enrollment, error } = await (supabase.from('enrollments') as any)
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return enrollment
    },
    onSuccess: (enrollment, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.detail(variables.id) })
      // Invalidate family/student-scoped enrollment queries
      if (enrollment.family_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.byFamily(enrollment.family_id) })
      }
      if (enrollment.student_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.byStudent(enrollment.student_id) })
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.billable() })
    },
  })

  const deleteEnrollment = useMutation({
    mutationFn: async (id: string) => {
      // Fetch the enrollment first to get family_id and student_id for invalidation
      const { data: enrollment, error: fetchError } = await (supabase.from('enrollments') as any)
        .select('family_id, student_id')
        .eq('id', id)
        .single()
      if (fetchError) throw fetchError

      const { error } = await supabase.from('enrollments').delete().eq('id', id)
      if (error) throw error

      return enrollment
    },
    onSuccess: (enrollment) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() })
      // Invalidate family/student-scoped enrollment queries
      if (enrollment?.family_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.byFamily(enrollment.family_id) })
      }
      if (enrollment?.student_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.byStudent(enrollment.student_id) })
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.billable() })
    },
  })

  return { createEnrollment, updateEnrollment, deleteEnrollment }
}

// =============================================================================
// TEACHER ASSIGNMENTS HOOKS
// =============================================================================

export function useTeacherAssignmentsByEnrollment(enrollmentId: string) {
  return useQuery({
    queryKey: queryKeys.teacherAssignments.byEnrollment(enrollmentId),
    queryFn: async () => {
      const { data, error } = await (supabase.from('teacher_assignments') as any)
        .select(`
          *,
          teacher:teachers(id, display_name, email, status)
        `)
        .eq('enrollment_id', enrollmentId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as (TeacherAssignment & { teacher: Teacher })[]
    },
    enabled: !!enrollmentId,
  })
}

// FIXED: Added options parameter to support { enabled } option
export function useTeacherAssignmentsByTeacher(
  teacherId: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.teacherAssignments.byTeacher(teacherId),
    queryFn: async () => {
      const { data, error } = await (supabase.from('teacher_assignments') as any)
        .select(`
          *,
          enrollment:enrollments(
            *,
            student:students(id, full_name, grade_level),
            family:families(id, display_name),
            service:services(id, code, name)
          )
        `)
        .eq('teacher_id', teacherId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as (TeacherAssignment & { enrollment: EnrollmentWithDetails })[]
    },
    enabled: options?.enabled !== undefined ? options.enabled && !!teacherId : !!teacherId,
  })
}

export function useTeacherAssignmentMutations() {
  const queryClient = useQueryClient()

  const createAssignment = useMutation({
    mutationFn: async (data: Partial<TeacherAssignment>) => {
      const { data: assignment, error } = await (supabase.from('teacher_assignments') as any)
        .insert(data)
        .select()
        .single()
      if (error) throw error
      return assignment
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teacherAssignments.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.teachers.all }) // Invalidate teacher load
    },
  })

  const updateAssignment = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TeacherAssignment> }) => {
      const { data: assignment, error } = await (supabase.from('teacher_assignments') as any)
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return assignment
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teacherAssignments.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.teachers.all }) // Invalidate teacher load
    },
  })

  // FIXED: Updated to support more parameters for TransferTeacherModal
  const transferTeacher = useMutation({
    mutationFn: async ({
      enrollmentId,
      oldTeacherId,
      newTeacherId,
      hourlyRate,
      hoursPerWeek,
      effectiveDate,
      endPrevious = true,
    }: {
      enrollmentId: string
      oldTeacherId?: string
      newTeacherId: string
      hourlyRate?: number
      hoursPerWeek?: number
      effectiveDate?: string
      endPrevious?: boolean
    }) => {
      const today = effectiveDate || getTodayString()
      
      // End old assignment if exists and endPrevious is true
      if (oldTeacherId && endPrevious) {
        await (supabase.from('teacher_assignments') as any)
          .update({ is_active: false, end_date: today })
          .eq('enrollment_id', enrollmentId)
          .eq('teacher_id', oldTeacherId)
          .eq('is_active', true)
      }

      // Create new assignment
      const { data, error } = await (supabase.from('teacher_assignments') as any)
        .insert({
          enrollment_id: enrollmentId,
          teacher_id: newTeacherId,
          hourly_rate_teacher: hourlyRate,
          hours_per_week: hoursPerWeek,
          is_active: true,
          start_date: today,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teacherAssignments.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.teachers.all }) // Invalidate teacher load
    },
  })

  // FIXED: Updated to accept object with enrollmentId and optional endDate
  const endAssignmentsByEnrollment = useMutation({
    mutationFn: async (
      params: string | { enrollmentId: string; endDate?: string }
    ) => {
      // Support both string (backward compat) and object (new usage)
      const enrollmentId = typeof params === 'string' ? params : params.enrollmentId
      const endDate = typeof params === 'string'
        ? getTodayString()
        : params.endDate || getTodayString()

      const { error } = await (supabase.from('teacher_assignments') as any)
        .update({ is_active: false, end_date: endDate })
        .eq('enrollment_id', enrollmentId)
        .eq('is_active', true)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teacherAssignments.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.teachers.all }) // Invalidate teacher load
    },
  })

  // Delete assignment permanently (use with caution - prefer deactivation)
  const deleteAssignment = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await (supabase.from('teacher_assignments') as any)
        .delete()
        .eq('id', assignmentId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teacherAssignments.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.teachers.all }) // Invalidate teacher load
    },
  })

  return { createAssignment, updateAssignment, transferTeacher, endAssignmentsByEnrollment, deleteAssignment }
}

// =============================================================================
// TEACHER PAYMENTS HOOKS
// =============================================================================

// FIXED: Added options parameter to support { enabled } option
export function useTeacherPaymentsByTeacher(
  teacherId: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.teacherPayments.byTeacher(teacherId),
    queryFn: async () => {
      const { data, error } = await (supabase.from('teacher_payments') as any)
        .select(`
          *,
          line_items:teacher_payment_line_items(*)
        `)
        .eq('teacher_id', teacherId)
        .order('pay_date', { ascending: false })

      if (error) throw error
      return data as (TeacherPayment & { line_items: any[] })[]
    },
    enabled: options?.enabled !== undefined ? options.enabled && !!teacherId : !!teacherId,
  })
}

export function useTeacherPaymentMutations() {
  const queryClient = useQueryClient()

  const createPayment = useMutation({
    mutationFn: async (data: {
      teacher_id: string
      pay_period_start: string
      pay_period_end: string
      pay_date: string
      total_amount: number
      payment_method?: string | null
      reference?: string | null
      notes?: string | null
      line_items: {
        description: string
        hours?: number
        hourly_rate?: number
        amount: number
        service_id?: string
        enrollment_id?: string
      }[]
    }) => {
      const { line_items, ...paymentData } = data

      // Convert null to undefined for optional fields
      const cleanedPaymentData = {
        ...paymentData,
        payment_method: paymentData.payment_method || undefined,
        reference: paymentData.reference || undefined,
        notes: paymentData.notes || undefined,
      }

      // Create payment
      const { data: payment, error } = await (supabase.from('teacher_payments') as any)
        .insert(cleanedPaymentData)
        .select()
        .single()
      if (error) throw error

      // Create line items
      if (line_items.length > 0) {
        const { error: itemsError } = await (supabase.from('teacher_payment_line_items') as any)
          .insert(line_items.map(li => ({
            ...li,
            teacher_payment_id: payment.id,
          })))
        if (itemsError) throw itemsError
      }

      return payment
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teacherPayments.all })
    },
  })

  return { createPayment }
}

// =============================================================================
// INVOICE TYPES
// =============================================================================

export interface BillableEnrollment extends Enrollment {
  student: Student | null
  family: Family | null
  service: Service
  teacher_assignments: (TeacherAssignment & { teacher: Teacher })[]
}

export interface InvoiceWithDetails extends Invoice {
  family: Family
  line_items: InvoiceLineItem[]
  services?: string[]
}

export interface InvoiceWithFamily extends Invoice {
  family: Family
}

// =============================================================================
// INVOICE HOOKS
// =============================================================================

export function useInvoices(filters?: { status?: string | string[]; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.invoices.list(filters),
    queryFn: async () => {
      let query = (supabase.from('invoices') as any)
        .select(`
          *,
          family:families(*)
        `)
        .order('invoice_date', { ascending: false })
        .limit(filters?.limit ?? 500) // Default limit to prevent unbounded fetching

      if (filters?.status) {
        if (Array.isArray(filters.status)) {
          query = query.in('status', filters.status)
        } else if (filters.status !== 'all') {
          query = query.eq('status', filters.status)
        }
      }

      const { data, error } = await query
      if (error) throw error
      return data as InvoiceWithFamily[]
    },
  })
}

export function useInvoicesByFamily(familyId: string) {
  return useQuery({
    queryKey: queryKeys.invoices.byFamily(familyId),
    queryFn: async () => {
      const { data, error } = await (supabase.from('invoices') as any)
        .select(`
          *,
          line_items:invoice_line_items(*)
        `)
        .eq('family_id', familyId)
        .order('invoice_date', { ascending: false })

      if (error) throw error
      return data as Invoice[]
    },
    enabled: !!familyId,
  })
}

export function useInvoicesWithDetails(filters?: { status?: string | string[] }) {
  return useQuery({
    queryKey: queryKeys.invoices.withDetails(filters),
    queryFn: async () => {
      let query = (supabase.from('invoices') as any)
        .select(`
          *,
          family:families(*),
          line_items:invoice_line_items(
            *,
            enrollment:enrollments(
              service:services(code, name)
            )
          )
        `)
        .order('invoice_date', { ascending: false })

      if (filters?.status) {
        if (Array.isArray(filters.status)) {
          query = query.in('status', filters.status)
        } else if (filters.status !== 'all') {
          query = query.eq('status', filters.status)
        }
      }

      const { data, error } = await query
      if (error) throw error

      // Extract service codes from line items
      return (data || []).map((inv: any) => {
        const serviceCodes = new Set<string>()
        inv.line_items?.forEach((li: InvoiceLineItem) => {
          const code = li.enrollment?.service?.code || extractServiceCodeFromDescription(li.description)
          if (code) serviceCodes.add(code)
        })
        return {
          ...inv,
          services: Array.from(serviceCodes),
        } as InvoiceWithDetails
      })
    },
  })
}

export function useBillableEnrollments(serviceFilter?: string) {
  return useQuery({
    queryKey: queryKeys.enrollments.billable(serviceFilter),
    queryFn: async () => {
      let query = (supabase.from('enrollments') as any)
        .select(`
          *,
          student:students(*),
          family:families(*),
          service:services(*),
          teacher_assignments(
            *,
            teacher:teachers(*)
          )
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (serviceFilter && serviceFilter !== 'all') {
        query = query.eq('service_id', serviceFilter)
      }

      const { data, error } = await query
      if (error) throw error
      return data as BillableEnrollment[]
    },
  })
}

export function useExistingInvoicesForPeriod(periodStart: string, periodEnd: string) {
  return useQuery({
    queryKey: queryKeys.invoices.byPeriod(periodStart, periodEnd),
    queryFn: async () => {
      const { data, error } = await (supabase.from('invoices') as any)
        .select(`
          *,
          line_items:invoice_line_items(enrollment_id)
        `)
        .eq('period_start', periodStart)
        .eq('period_end', periodEnd)
        .neq('status', 'void')

      if (error) throw error
      return data as (Invoice & { line_items: { enrollment_id: string }[] })[]
    },
    enabled: !!periodStart && !!periodEnd,
  })
}

// Type for pending event orders (Step Up orders awaiting invoice)
export interface PendingEventOrder {
  id: string
  event_id: string
  family_id: string | null
  purchaser_email: string
  purchaser_name: string | null
  quantity: number
  total_cents: number
  payment_status: string
  payment_method: string
  created_at: string
  event_title: string
  event_type: string
  event_date: string
  family_name: string | null
}

// Hook to fetch pending Step Up event orders for single events only (not classes)
// Classes are billed via Monthly invoices with registration fees
export function usePendingEventOrders(familyId?: string) {
  return useQuery({
    queryKey: queryKeys.eventOrders.pendingEvents(familyId),
    queryFn: async () => {
      let query = supabase
        .from('event_orders')
        .select(`
          id,
          event_id,
          family_id,
          purchaser_email,
          purchaser_name,
          quantity,
          total_cents,
          payment_status,
          payment_method,
          created_at,
          event:event_events!inner(
            title,
            event_type,
            start_at
          ),
          family:families(
            display_name
          )
        `)
        .eq('payment_method', 'stepup')
        .eq('payment_status', 'stepup_pending')
        .is('invoice_id', null)
        .eq('event.event_type', 'event') // Only single events, not classes

      if (familyId) {
        query = query.eq('family_id', familyId)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error

      // Transform to flat structure
      return (data || []).map((order: any) => ({
        id: order.id,
        event_id: order.event_id,
        family_id: order.family_id,
        purchaser_email: order.purchaser_email,
        purchaser_name: order.purchaser_name,
        quantity: order.quantity,
        total_cents: order.total_cents,
        payment_status: order.payment_status,
        payment_method: order.payment_method,
        created_at: order.created_at,
        event_title: order.event?.title || 'Unknown Event',
        event_type: order.event?.event_type || 'event',
        event_date: order.event?.start_at || '',
        family_name: order.family?.display_name || null,
      })) as PendingEventOrder[]
    },
  })
}

// Type for pending class registration fees
export interface PendingClassRegistrationFee {
  id: string
  family_id: string
  total_cents: number
  event_title: string
  student_name: string | null
  class_title: string | null
}

// Hook to fetch pending Step Up class registration fees
// These are event_orders for classes (not single events) that haven't been invoiced yet
export function usePendingClassRegistrationFees() {
  return useQuery({
    queryKey: queryKeys.eventOrders.pendingClasses(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_orders')
        .select(`
          id,
          family_id,
          total_cents,
          event:event_events!inner(
            title,
            event_type
          )
        `)
        .eq('payment_method', 'stepup')
        .eq('payment_status', 'stepup_pending')
        .is('invoice_id', null)
        .eq('event.event_type', 'class')

      if (error) throw error

      // Transform to flat structure
      return (data || []).map((order: any) => ({
        id: order.id,
        family_id: order.family_id,
        total_cents: order.total_cents,
        event_title: order.event?.title || 'Unknown Class',
      })) as PendingClassRegistrationFee[]
    },
  })
}

// Hook to fetch email history for an invoice
export function useInvoiceEmails(invoiceId: string) {
  return useQuery({
    queryKey: queryKeys.invoiceEmails.byInvoice(invoiceId),
    queryFn: async () => {
      const { data, error } = await (supabase.from('invoice_emails') as any)
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('sent_at', { ascending: false })

      if (error) throw error
      return data as InvoiceEmail[]
    },
    enabled: !!invoiceId,
  })
}

// Payment type for invoice payments
export interface InvoicePayment {
  id: string
  invoice_id: string
  amount: number
  payment_date: string
  payment_method: string | null
  notes: string | null
  created_at: string
}

// Hook to fetch payment history for an invoice
export function useInvoicePayments(invoiceId: string) {
  return useQuery({
    queryKey: queryKeys.invoicePayments.byInvoice(invoiceId),
    queryFn: async () => {
      const { data, error } = await (supabase.from('payments') as any)
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('payment_date', { ascending: false })

      if (error) throw error
      return data as InvoicePayment[]
    },
    enabled: !!invoiceId,
  })
}

// Get all invoice emails for a family (via invoices)
export function useInvoiceEmailsByFamily(familyId: string) {
  return useQuery({
    queryKey: queryKeys.invoiceEmails.byFamily(familyId),
    queryFn: async () => {
      // First get all invoice IDs for this family
      const { data: invoices, error: invoicesError } = await (supabase
        .from('invoices')
        .select('id, invoice_number')
        .eq('family_id', familyId) as any)

      if (invoicesError) throw invoicesError
      if (!invoices || invoices.length === 0) return []

      const invoiceIds = (invoices as { id: string; invoice_number: string }[]).map(inv => inv.id)
      const invoiceMap = new Map((invoices as { id: string; invoice_number: string }[]).map(inv => [inv.id, inv.invoice_number]))

      // Then get all emails for those invoices
      const { data: emails, error: emailsError } = await (supabase.from('invoice_emails') as any)
        .select('*')
        .in('invoice_id', invoiceIds)
        .order('sent_at', { ascending: false })

      if (emailsError) throw emailsError

      // Add invoice_number to each email for display
      return (emails || []).map((email: InvoiceEmail) => ({
        ...email,
        invoice_number: invoiceMap.get(email.invoice_id) || 'Unknown'
      }))
    },
    enabled: !!familyId,
  })
}

// Helper function to determine reminder type based on days overdue
export function getReminderType(dueDate: string): {
  type: 'reminder_7' | 'reminder_14' | 'reminder_30'
  label: string
  daysOverdue: number
} {
  // Parse due date and normalize to local midnight to avoid timezone issues
  // When dueDate is "YYYY-MM-DD", we want to compare it as local date
  const [year, month, day] = dueDate.split('-').map(Number)
  const due = new Date(year, month - 1, day) // Local midnight
  due.setHours(0, 0, 0, 0)

  const today = new Date()
  today.setHours(0, 0, 0, 0) // Local midnight

  const diffTime = today.getTime() - due.getTime()
  const daysOverdue = Math.round(diffTime / (1000 * 60 * 60 * 24))

  if (daysOverdue >= 30) {
    return { type: 'reminder_30', label: 'Urgent Reminder', daysOverdue }
  } else if (daysOverdue >= 14) {
    return { type: 'reminder_14', label: 'Past Due Reminder', daysOverdue }
  } else {
    return { type: 'reminder_7', label: 'Friendly Reminder', daysOverdue }
  }
}

export function useInvoiceMutations() {
  const queryClient = useQueryClient()

  const generateDrafts = useMutation({
    mutationFn: async ({
      enrollments,
      periodStart,
      periodEnd,
      dueDate,
      invoiceType,
      customAmounts,
    }: {
      enrollments: BillableEnrollment[]
      periodStart: string
      periodEnd: string
      dueDate: string
      invoiceType: 'weekly' | 'monthly' | 'events'
      customAmounts?: Record<string, { quantity: number; unitPrice: number; amount: number }>
    }) => {
      // Group enrollments by family
      const byFamily = enrollments.reduce((acc, e) => {
        const famId = e.family_id
        if (!acc[famId]) acc[famId] = { family: e.family, enrollments: [] }
        acc[famId].enrollments.push(e)
        return acc
      }, {} as Record<string, { family: Family | null; enrollments: BillableEnrollment[] }>)

      const createdInvoices: Invoice[] = []
      const failedFamilies: { familyName: string; error: string }[] = []

      for (const [familyId, group] of Object.entries(byFamily)) {
        try {
        // Create invoice
        const invoiceNote = invoiceType === 'weekly'
          ? `For the week of ${new Date(periodStart).toLocaleDateString()} - ${new Date(periodEnd).toLocaleDateString()}`
          : `For ${new Date(periodStart).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`

        const { data: invoice, error: invError } = await (supabase.from('invoices') as any)
          .insert({
            family_id: familyId,
            invoice_date: getTodayString(),
            due_date: dueDate,
            period_start: periodStart,
            period_end: periodEnd,
            status: 'draft',
            notes: invoiceNote,
          })
          .select()
          .single()

        if (invError) {
          failedFamilies.push({
            familyName: group.family?.display_name || 'Unknown family',
            error: invError.message || 'Failed to create invoice'
          })
          continue
        }

        // Create line items
        let subtotal = 0
        const lineItems = group.enrollments.map((enrollment, idx) => {
          // Check for custom amount override
          const customData = customAmounts?.[enrollment.id]

          let quantity: number
          let unitPrice: number
          let amount: number

          if (customData) {
            quantity = customData.quantity
            unitPrice = customData.unitPrice
            amount = customData.amount
          } else {
            // Default calculation
            const baseAmount = calculateEnrollmentAmount(enrollment, invoiceType)
            if (enrollment.service?.code === 'academic_coaching') {
              quantity = enrollment.hours_per_week || 0
              unitPrice = enrollment.hourly_rate_customer || 0
              amount = baseAmount
            } else {
              quantity = 1
              unitPrice = baseAmount
              amount = baseAmount
            }
          }

          subtotal = addMoney(subtotal, amount)

          return {
            invoice_id: invoice.id,
            enrollment_id: enrollment.id,
            description: buildLineItemDescriptionWithQuantity(enrollment, quantity, unitPrice, invoiceType),
            quantity,
            unit_price: unitPrice,
            amount,
            sort_order: idx,
          }
        })

        // For monthly invoices, check for pending class registration fees (Step Up)
        // These are event_orders for classes where invoice_id is NULL
        const pendingRegistrationFees: { id: string; event_title: string; total_cents: number; student_name: string }[] = []

        if (invoiceType === 'monthly') {
          // Find elective_classes enrollments in this group
          const electiveEnrollments = group.enrollments.filter(e => e.service?.code === 'elective_classes')

          if (electiveEnrollments.length > 0) {
            // Query for pending registration fees for this family
            // These are Step Up event orders for classes that haven't been invoiced yet
            const { data: pendingOrders } = await supabase
              .from('event_orders')
              .select(`
                id,
                total_cents,
                event:event_events!inner(
                  title,
                  event_type
                )
              `)
              .eq('family_id', familyId)
              .eq('payment_method', 'stepup')
              .eq('payment_status', 'stepup_pending')
              .is('invoice_id', null)
              .eq('event.event_type', 'class')

            if (pendingOrders && pendingOrders.length > 0) {
              // Match pending orders to enrollments by class title
              for (const order of pendingOrders as any[]) {
                const eventTitle = order.event?.title || ''
                // Find matching enrollment by class_title
                const matchingEnrollment = electiveEnrollments.find(e =>
                  e.class_title && (
                    eventTitle.toLowerCase().includes(e.class_title.toLowerCase()) ||
                    e.class_title.toLowerCase().includes(eventTitle.toLowerCase())
                  )
                )

                if (matchingEnrollment) {
                  pendingRegistrationFees.push({
                    id: order.id,
                    event_title: eventTitle,
                    total_cents: order.total_cents,
                    student_name: matchingEnrollment.student?.full_name || 'Student',
                  })
                }
              }
            }
          }
        }

        // Add registration fee line items
        let sortOrder = lineItems.length
        for (const regFee of pendingRegistrationFees) {
          const amount = centsToDollars(regFee.total_cents)
          subtotal = addMoney(subtotal, amount)
          lineItems.push({
            invoice_id: invoice.id,
            enrollment_id: null as any, // Registration fees don't link to enrollments
            description: `${regFee.student_name} - Registration Fee: ${regFee.event_title}`,
            quantity: 1,
            unit_price: amount,
            amount,
            sort_order: sortOrder++,
          })
        }

        const { error: itemsError } = await (supabase.from('invoice_line_items') as any)
          .insert(lineItems)

        if (itemsError) {
          // Clean up the created invoice since line items failed
          await supabase.from('invoices').delete().eq('id', invoice.id)
          failedFamilies.push({
            familyName: group.family?.display_name || 'Unknown family',
            error: itemsError.message || 'Failed to create line items'
          })
          continue
        }

        // Update invoice totals
        const { error: updateError } = await (supabase.from('invoices') as any)
          .update({
            subtotal,
            total_amount: subtotal,
          })
          .eq('id', invoice.id)

        if (updateError) {
          // Clean up - delete line items and invoice
          await supabase.from('invoice_line_items').delete().eq('invoice_id', invoice.id)
          await supabase.from('invoices').delete().eq('id', invoice.id)
          failedFamilies.push({
            familyName: group.family?.display_name || 'Unknown family',
            error: updateError.message || 'Failed to update invoice totals'
          })
          continue
        }

        // Link registration fee event_orders to this invoice
        if (pendingRegistrationFees.length > 0) {
          const orderIds = pendingRegistrationFees.map(f => f.id)
          await (supabase.from('event_orders') as any)
            .update({ invoice_id: invoice.id })
            .in('id', orderIds)
        }

        createdInvoices.push(invoice)
        } catch (err) {
          // Catch any unexpected errors in the family processing
          failedFamilies.push({
            familyName: group.family?.display_name || 'Unknown family',
            error: err instanceof Error ? err.message : 'Unknown error'
          })
        }
      }

      // If all families failed, throw an error
      if (createdInvoices.length === 0 && failedFamilies.length > 0) {
        throw new Error(`Failed to generate any invoices. Errors: ${failedFamilies.map(f => `${f.familyName}: ${f.error}`).join('; ')}`)
      }

      // If some families failed, throw an error with partial success info
      if (failedFamilies.length > 0) {
        const error = new Error(`Generated ${createdInvoices.length} invoices, but ${failedFamilies.length} failed: ${failedFamilies.map(f => f.familyName).join(', ')}`)
        // Attach the created invoices to the error so they can still be used
        ;(error as any).createdInvoices = createdInvoices
        throw error
      }

      return createdInvoices
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
    },
  })

  // Generate invoice for Step Up event orders
  const generateEventInvoice = useMutation({
    mutationFn: async ({
      familyId,
      familyName,
      orderIds,
      orders,
      dueDate,
    }: {
      familyId: string
      familyName: string
      orderIds: string[]
      orders: { id: string; event_title: string; event_date: string; total_cents: number }[]
      dueDate: string
    }) => {
      // Create invoice
      const invoiceNote = `Event registrations for ${familyName}`

      const { data: invoice, error: invError } = await (supabase.from('invoices') as any)
        .insert({
          family_id: familyId,
          invoice_date: getTodayString(),
          due_date: dueDate,
          status: 'draft',
          notes: invoiceNote,
        })
        .select()
        .single()

      if (invError) throw invError

      // Create line items for each event order
      let subtotal = 0
      const lineItems = orders.map((order, idx) => {
        const amount = centsToDollars(order.total_cents)
        subtotal = addMoney(subtotal, amount)

        // Format event date
        const eventDate = order.event_date
          ? new Date(order.event_date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })
          : ''

        return {
          invoice_id: invoice.id,
          enrollment_id: null, // Events are not enrollments
          description: `${order.event_title}${eventDate ? ` (${eventDate})` : ''} - Registration Fee`,
          quantity: 1,
          unit_price: amount,
          amount: amount,
          sort_order: idx,
        }
      })

      const { error: itemsError } = await (supabase.from('invoice_line_items') as any)
        .insert(lineItems)

      if (itemsError) throw itemsError

      // Update invoice totals
      const { error: updateError } = await (supabase.from('invoices') as any)
        .update({
          subtotal,
          total_amount: subtotal,
        })
        .eq('id', invoice.id)

      if (updateError) throw updateError

      // Link event_orders to this invoice
      const { error: linkError } = await (supabase.from('event_orders') as any)
        .update({ invoice_id: invoice.id })
        .in('id', orderIds)

      if (linkError) throw linkError

      return invoice
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.eventOrders.pending() })
    },
  })

  const updateInvoice = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Invoice> }) => {
      const { data: invoice, error } = await (supabase.from('invoices') as any)
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error

      // Sync event_orders when invoice is marked as paid
      // This updates Step Up event registrations linked to this invoice
      if (data.status === 'paid') {
        const { error: syncError } = await (supabase.from('event_orders') as any)
          .update({
            payment_status: 'paid',
            paid_at: new Date().toISOString(),
          })
          .eq('invoice_id', id)

        if (syncError) {
          console.error('Failed to sync event_orders payment status:', syncError)
          // Don't throw - the invoice update succeeded, this is a secondary operation
        }
      }

      return invoice
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.eventOrders.pending() })
    },
  })

  const updateLineItem = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InvoiceLineItem> }) => {
      const { data: lineItem, error } = await (supabase.from('invoice_line_items') as any)
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return lineItem
    },
    onSuccess: (lineItem) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
      // Invalidate the specific invoice detail to refresh line items
      if (lineItem.invoice_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(lineItem.invoice_id) })
      }
    },
  })

  const deleteInvoice = useMutation({
    mutationFn: async (id: string) => {
      // Unlink any event_orders referencing this invoice first
      await (supabase.from('event_orders') as any)
        .update({ invoice_id: null, payment_status: 'stepup_pending' })
        .eq('invoice_id', id)

      const { error } = await supabase.from('invoices').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.eventOrders.pending() })
    },
  })

  const bulkDeleteInvoices = useMutation({
    mutationFn: async (ids: string[]) => {
      // Unlink any event_orders referencing these invoices first
      await (supabase.from('event_orders') as any)
        .update({ invoice_id: null, payment_status: 'stepup_pending' })
        .in('invoice_id', ids)

      const { error } = await supabase.from('invoices').delete().in('id', ids)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.eventOrders.pending() })
    },
  })

  const voidInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { data: invoice, error } = await (supabase.from('invoices') as any)
        .update({ status: 'void' })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return invoice
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(id) })
    },
  })

  const bulkVoidInvoices = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await (supabase.from('invoices') as any)
        .update({ status: 'void' })
        .in('id', ids)
      if (error) throw error
      return ids
    },
    onSuccess: (ids) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
      // Invalidate detail for each voided invoice
      ids.forEach((id) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(id) })
      })
    },
  })

  // Record payment - supports both full and partial payments
  const recordPayment = useMutation({
    mutationFn: async ({
      invoiceId,
      amount,
      paymentMethod = 'manual',
      notes = 'Payment recorded manually'
    }: {
      invoiceId: string
      amount: number
      paymentMethod?: string
      notes?: string
    }) => {
      // First, get the invoice to know the current amounts
      const { data: invoice, error: fetchError } = await (supabase.from('invoices') as any)
        .select('id, total_amount, amount_paid, balance_due, status')
        .eq('id', invoiceId)
        .single()

      if (fetchError) throw fetchError
      if (!invoice) throw new Error('Invoice not found')

      // Check if invoice is already paid
      if (invoice.status === 'paid') {
        throw new Error('Invoice is already fully paid')
      }

      // Calculate current balance due (in case it's not set correctly)
      const currentBalanceDue = (invoice.total_amount || 0) - (invoice.amount_paid || 0)

      // Prevent overpayments - cap amount at current balance due
      const actualPaymentAmount = Math.min(amount, Math.max(0, currentBalanceDue))

      if (actualPaymentAmount <= 0) {
        throw new Error('Invoice has no balance due')
      }

      // Create a payment record
      const { error: paymentError } = await (supabase.from('payments') as any)
        .insert({
          invoice_id: invoiceId,
          amount: actualPaymentAmount,
          payment_date: getTodayString(),
          payment_method: paymentMethod,
          notes: notes,
        })

      if (paymentError) throw paymentError

      // Calculate new amounts
      const newAmountPaid = (invoice.amount_paid || 0) + actualPaymentAmount
      const newBalanceDue = (invoice.total_amount || 0) - newAmountPaid

      // Determine new status: paid if balance is 0, partial if some payment made
      const newStatus = newBalanceDue <= 0 ? 'paid' : 'partial'

      // Update the invoice status and amount_paid (balance_due is a computed column)
      const { data: updatedInvoice, error: updateError } = await (supabase.from('invoices') as any)
        .update({
          status: newStatus,
          amount_paid: newAmountPaid,
        })
        .eq('id', invoiceId)
        .select()
        .single()

      if (updateError) throw updateError

      // Sync event_orders when invoice is fully paid
      if (newStatus === 'paid') {
        const { error: syncError } = await (supabase.from('event_orders') as any)
          .update({
            payment_status: 'paid',
            paid_at: new Date().toISOString(),
          })
          .eq('invoice_id', invoiceId)

        if (syncError) {
          console.error('Failed to sync event_orders payment status:', syncError)
          // Don't throw - the invoice update succeeded
        }
      }

      return updatedInvoice
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(variables.invoiceId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() })
      queryClient.invalidateQueries({ queryKey: queryKeys.eventOrders.pending() })
      queryClient.invalidateQueries({ queryKey: queryKeys.invoicePayments.byInvoice(variables.invoiceId) })
    },
  })

  // Recalculate invoice balance from payments - fixes corrupted invoices
  const recalculateInvoiceBalance = useMutation({
    mutationFn: async (invoiceId: string) => {
      // Get the invoice
      const { data: invoice, error: invoiceError } = await (supabase.from('invoices') as any)
        .select('id, total_amount, status')
        .eq('id', invoiceId)
        .single()

      if (invoiceError) throw invoiceError
      if (!invoice) throw new Error('Invoice not found')

      // Get total of all payments for this invoice
      const { data: payments, error: paymentsError } = await (supabase.from('payments') as any)
        .select('amount')
        .eq('invoice_id', invoiceId)

      if (paymentsError) throw paymentsError

      // Calculate actual amount paid from payment records
      const actualAmountPaid = (payments || []).reduce((sum: number, p: { amount: number }) => sum + (p.amount || 0), 0)

      // Calculate correct balance due
      const totalAmount = invoice.total_amount || 0
      const correctBalanceDue = Math.max(0, totalAmount - actualAmountPaid)

      // Determine correct status
      let correctStatus = invoice.status
      if (correctBalanceDue <= 0 && actualAmountPaid > 0) {
        correctStatus = 'paid'
      } else if (actualAmountPaid > 0 && correctBalanceDue > 0) {
        correctStatus = 'partial'
      }

      // Update the invoice with correct amounts (balance_due is a computed column)
      const { data: updatedInvoice, error: updateError } = await (supabase.from('invoices') as any)
        .update({
          amount_paid: Math.min(actualAmountPaid, totalAmount), // Cap at total amount
          status: correctStatus,
        })
        .eq('id', invoiceId)
        .select()
        .single()

      if (updateError) throw updateError

      return updatedInvoice
    },
    onSuccess: (_, invoiceId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(invoiceId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() })
    },
  })

  const sendInvoice = useMutation({
    mutationFn: async (invoiceId: string) => {
      // First, get the full invoice with family and line items
      const { data: invoice, error: fetchError } = await (supabase.from('invoices') as any)
        .select(`
          *,
          family:families(*),
          line_items:invoice_line_items(*)
        `)
        .eq('id', invoiceId)
        .single()

      if (fetchError) throw fetchError
      if (!invoice.family?.primary_email) {
        throw new Error('Family has no email address')
      }

      // Prepare payload for n8n
      const payload = {
        type: 'send',
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number || `INV-${invoice.public_id}`,
        public_id: invoice.public_id,
        invoice_url: `https://eaton-console.vercel.app/invoice/${invoice.public_id}`,
        family: {
          id: invoice.family.id,
          name: invoice.family.display_name,
          email: invoice.family.primary_email,
          contact_name: invoice.family.primary_contact_name || invoice.family.display_name,
        },
        amounts: {
          subtotal: invoice.subtotal,
          total: invoice.total_amount,
          amount_paid: invoice.amount_paid,
          balance_due: invoice.balance_due,
        },
        dates: {
          invoice_date: invoice.invoice_date,
          due_date: invoice.due_date,
          period_start: invoice.period_start,
          period_end: invoice.period_end,
        },
        line_items: (invoice.line_items || []).map((li: InvoiceLineItem) => ({
          description: li.description,
          amount: li.amount,
        })),
      }

      // Send via n8n webhook
      const response = await fetch('https://eatonacademic.app.n8n.cloud/webhook/invoice-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`Failed to send invoice: ${response.statusText}`)
      }

      // Update invoice status
      const { error: updateError } = await (supabase.from('invoices') as any)
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          sent_to: invoice.family.primary_email,
        })
        .eq('id', invoiceId)

      if (updateError) throw updateError

      // Log to invoice_emails
      await (supabase.from('invoice_emails') as any).insert({
        invoice_id: invoiceId,
        email_type: 'invoice',
        sent_to: invoice.family.primary_email,
        sent_at: new Date().toISOString(),
        subject: `Invoice ${invoice.invoice_number || invoice.public_id} from Eaton Academic`,
      })

      return invoice
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.invoiceEmails.all })
    },
  })

  const bulkSendInvoices = useMutation({
    mutationFn: async (invoiceIds: string[]) => {
      const results = await Promise.allSettled(
        invoiceIds.map((id) => sendInvoice.mutateAsync(id))
      )

      const succeeded = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.filter((r) => r.status === 'rejected').length

      return { succeeded, failed, total: invoiceIds.length }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.invoiceEmails.all })
    },
  })

  // Send reminder for a single invoice
  const sendReminder = useMutation({
    mutationFn: async ({ 
      invoice, 
      reminderType 
    }: { 
      invoice: InvoiceWithFamily
      reminderType: 'reminder_7' | 'reminder_14' | 'reminder_30'
    }) => {
      if (!invoice.family?.primary_email) {
        throw new Error('Family has no email address')
      }

      const { daysOverdue } = getReminderType(invoice.due_date || '')

      // Prepare payload for n8n
      const payload = {
        type: reminderType,
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number || `INV-${invoice.public_id}`,
        public_id: invoice.public_id,
        invoice_url: `https://eaton-console.vercel.app/invoice/${invoice.public_id}`,
        family: {
          id: invoice.family.id,
          name: invoice.family.display_name,
          email: invoice.family.primary_email,
          contact_name: invoice.family.primary_contact_name || invoice.family.display_name,
        },
        amounts: {
          subtotal: invoice.subtotal,
          total: invoice.total_amount,
          amount_paid: invoice.amount_paid,
          balance_due: invoice.balance_due,
        },
        dates: {
          invoice_date: invoice.invoice_date,
          due_date: invoice.due_date,
          period_start: invoice.period_start,
          period_end: invoice.period_end,
        },
        days_overdue: daysOverdue,
      }

      // Send via n8n webhook
      const response = await fetch('https://eatonacademic.app.n8n.cloud/webhook/invoice-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`Failed to send reminder: ${response.statusText}`)
      }

      // Map reminder type to email_type for database
      const emailTypeMap = {
        'reminder_7': 'reminder_7_day',
        'reminder_14': 'reminder_14_day',
        'reminder_30': 'reminder_overdue',
      }

      // Log to invoice_emails
      await (supabase.from('invoice_emails') as any).insert({
        invoice_id: invoice.id,
        email_type: emailTypeMap[reminderType],
        sent_to: invoice.family.primary_email,
        sent_at: new Date().toISOString(),
        subject: `Payment Reminder: Invoice ${invoice.invoice_number || invoice.public_id}`,
      })

      return invoice
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.invoiceEmails.byInvoice(variables.invoice.id) })
    },
  })

  // Send reminders for multiple invoices at once (throttled to avoid overwhelming webhook)
  const bulkSendReminders = useMutation({
    mutationFn: async ({ invoices }: { invoices: InvoiceWithFamily[] }) => {
      const BATCH_SIZE = 5
      const BATCH_DELAY_MS = 500
      const allResults: PromiseSettledResult<unknown>[] = []

      // Process in batches to avoid overwhelming the webhook
      for (let i = 0; i < invoices.length; i += BATCH_SIZE) {
        const batch = invoices.slice(i, i + BATCH_SIZE)

        const batchResults = await Promise.allSettled(
          batch.map(async (invoice) => {
            // Determine reminder type based on days overdue
            const { type: reminderType } = getReminderType(invoice.due_date || '')

            // Use the single sendReminder logic
            return sendReminder.mutateAsync({ invoice, reminderType })
          })
        )

        allResults.push(...batchResults)

        // Add delay between batches (except for last batch)
        if (i + BATCH_SIZE < invoices.length) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS))
        }
      }

      const succeeded = allResults.filter((r) => r.status === 'fulfilled').length
      const failed = allResults.filter((r) => r.status === 'rejected').length

      return { succeeded, failed, total: invoices.length }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.invoiceEmails.all })
    },
  })

  // Create a historical invoice from Wave/Google Sheets data
  const createHistoricalInvoice = useMutation({
    mutationFn: async ({
      familyId,
      invoiceNumber,
      invoiceDate,
      dueDate,
      periodStart,
      periodEnd,
      lineItems,
      subtotal,
      totalAmount,
      status,
      sentAt,
      sentTo,
      amountPaid,
      payment,
      notes,
    }: {
      familyId: string
      invoiceNumber: string | null
      invoiceDate: string
      dueDate: string | null
      periodStart: string | null
      periodEnd: string | null
      lineItems: Array<{
        description: string
        quantity: number
        unit_price: number
        amount: number
      }>
      subtotal: number
      totalAmount: number
      status: InvoiceStatus
      sentAt: string | null
      sentTo: string | null
      amountPaid: number
      payment: {
        amount: number
        paymentDate: string
        paymentMethod: string | null
        reference: string | null
      } | null
      notes: string | null
    }) => {
      // 1. Create the invoice
      const { data: invoice, error: invError } = await (supabase.from('invoices') as any)
        .insert({
          family_id: familyId,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          due_date: dueDate,
          period_start: periodStart,
          period_end: periodEnd,
          subtotal,
          total_amount: totalAmount,
          amount_paid: amountPaid,
          status,
          sent_at: sentAt,
          sent_to: sentTo,
          notes,
        })
        .select()
        .single()

      if (invError) throw invError

      // 2. Create line items (no enrollment_id since these are historical)
      if (lineItems.length > 0) {
        const lineItemsToInsert = lineItems.map((item, idx) => ({
          invoice_id: invoice.id,
          enrollment_id: null, // Historical invoices don't link to enrollments
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.amount,
          sort_order: idx,
        }))

        const { error: itemsError } = await (supabase.from('invoice_line_items') as any)
          .insert(lineItemsToInsert)

        if (itemsError) throw itemsError
      }

      // 3. Create payment record if there was a payment
      if (payment && payment.amount > 0) {
        const { error: paymentError } = await (supabase.from('payments') as any)
          .insert({
            invoice_id: invoice.id,
            amount: payment.amount,
            payment_date: payment.paymentDate,
            payment_method: payment.paymentMethod,
            reference: payment.reference,
            notes: `Imported from historical system`,
          })

        if (paymentError) throw paymentError
      }

      // 4. Log email record if it was sent (for email history tracking)
      if (sentAt && sentTo) {
        await (supabase.from('invoice_emails') as any).insert({
          invoice_id: invoice.id,
          email_type: 'invoice',
          sent_to: sentTo,
          sent_at: sentAt,
          subject: `Invoice ${invoiceNumber || invoice.public_id} from Eaton Academic (Imported)`,
        })
      }

      return invoice
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.invoiceEmails.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() })
    },
  })

  return {
    generateDrafts,
    generateEventInvoice,
    updateInvoice,
    updateLineItem,
    deleteInvoice,
    bulkDeleteInvoices,
    voidInvoice,
    bulkVoidInvoices,
    recordPayment,
    recalculateInvoiceBalance,
    sendInvoice,
    bulkSendInvoices,
    // Reminder mutations
    sendReminder,
    bulkSendReminders,
    // Historical import
    createHistoricalInvoice,
  }
}

// =============================================================================
// INVOICE HELPER FUNCTIONS
// =============================================================================

function extractServiceCodeFromDescription(description: string): string | null {
  const lower = description.toLowerCase()
  if (lower.includes('academic coaching')) return 'academic_coaching'
  if (lower.includes('learning pod')) return 'learning_pod'
  if (lower.includes('consulting')) return 'consulting'
  if (lower.includes('hub')) return 'eaton_hub'
  if (lower.includes('online')) return 'eaton_online'
  if (lower.includes('elective')) return 'elective_classes'
  return null
}

function calculateEnrollmentAmount(
  enrollment: BillableEnrollment,
  _invoiceType: 'weekly' | 'monthly' | 'events'
): number {
  const service = enrollment.service
  const billingFreq = service?.billing_frequency

  // Special case: Academic Coaching always uses hours × rate
  if (service?.code === 'academic_coaching') {
    return (enrollment.hours_per_week || 0) * (enrollment.hourly_rate_customer || 0)
  }

  // Special case: Hub is per-session (tracked via hub_sessions table)
  if (service?.code === 'eaton_hub' || billingFreq === 'per_session') {
    return enrollment.daily_rate || 100
  }

  // Use billing frequency to determine which rate field to use
  if (billingFreq === 'weekly') {
    return enrollment.weekly_tuition || 0
  } else {
    // monthly, bi_monthly, annual, one_time all use monthly_rate
    return enrollment.monthly_rate || 0
  }
}

// Build description with quantity for multiplier support
function buildLineItemDescriptionWithQuantity(
  enrollment: BillableEnrollment,
  quantity: number,
  unitPrice: number,
  _invoiceType: 'weekly' | 'monthly' | 'events'
): string {
  const studentName = enrollment.student?.full_name || 'Unknown Student'
  const serviceName = enrollment.service?.name || 'Service'
  const serviceCode = enrollment.service?.code
  const billingFreq = enrollment.service?.billing_frequency

  // Academic Coaching always shows hours × rate breakdown
  if (serviceCode === 'academic_coaching') {
    return `${studentName} - ${serviceName}: ${quantity} hrs × $${unitPrice.toFixed(2)}`
  }

  // Eaton Online: show weeks × rate
  if (serviceCode === 'eaton_online' || billingFreq === 'weekly') {
    if (quantity === 1) {
      return `${studentName} - ${serviceName}: $${unitPrice.toFixed(2)}/week`
    }
    return `${studentName} - ${serviceName}: ${quantity} weeks × $${unitPrice.toFixed(2)}`
  }

  // Learning Pod: show sessions × rate if quantity > 1
  if (serviceCode === 'learning_pod') {
    if (quantity === 1) {
      return `${studentName} - ${serviceName}`
    }
    return `${studentName} - ${serviceName}: ${quantity} sessions × $${unitPrice.toFixed(2)}`
  }

  // Everything else (monthly, etc.) just shows service name
  // But if there's a custom quantity, show it
  if (quantity !== 1) {
    return `${studentName} - ${serviceName}: ${quantity} × $${unitPrice.toFixed(2)}`
  }
  return `${studentName} - ${serviceName}`
}

// =============================================================================
// SETTINGS HOOKS
// =============================================================================

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')

      if (error) throw error

      // Convert array to key-value map
      const settings: Record<string, any> = {}
      ;(data || []).forEach((s: any) => {
        settings[s.key] = s.value
      })
      return settings
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useSettingMutations() {
  const queryClient = useQueryClient()

  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { error } = await (supabase.from('app_settings') as any)
        .upsert({
          key,
          value,
          updated_at: new Date().toISOString(),
        })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all })
    },
  })

  return { updateSetting }
}

// =============================================================================
// TAGS HOOKS
// =============================================================================

export function useTags() {
  return useQuery({
    queryKey: queryKeys.tags.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .order('name')

      if (error) throw error
      return data
    },
    staleTime: 5 * 60 * 1000,
  })
}

// =============================================================================
// UTILITY HOOKS
// =============================================================================

export function useInvalidateQueries() {
  const queryClient = useQueryClient()

  return {
    invalidateFamilies: () => queryClient.invalidateQueries({ queryKey: queryKeys.families.all }),
    invalidateStudents: () => queryClient.invalidateQueries({ queryKey: queryKeys.students.all }),
    invalidateTeachers: () => queryClient.invalidateQueries({ queryKey: queryKeys.teachers.all }),
    invalidateEnrollments: () => queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all }),
    invalidateInvoices: () => queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all }),
    invalidateAll: () => queryClient.invalidateQueries(),
  }
}

// =============================================================================
// DATE HELPERS FOR INVOICE PERIODS
// =============================================================================

export function getWeekBounds(date: Date = new Date()): { start: Date; end: Date } {
  const d = new Date(date)
  const day = d.getDay()

  // Find Monday of this week
  const monday = new Date(d)
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)

  // Friday of this week - set to end of day to include all Friday work
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)
  friday.setHours(23, 59, 59, 999)

  return { start: monday, end: friday }
}

export function getNextMonday(date: Date = new Date()): Date {
  const d = new Date(date)
  // Set to noon to avoid DST boundary issues when adding days
  d.setHours(12, 0, 0, 0)
  const day = d.getDay()
  const diff = day === 0 ? 1 : 8 - day
  d.setDate(d.getDate() + diff)
  // Reset to start of day after calculation
  d.setHours(0, 0, 0, 0)
  return d
}

export function getLastFridayOfMonth(year: number, month: number): Date {
  // Start from last day of month
  const lastDay = new Date(year, month + 1, 0)
  const day = lastDay.getDay()
  
  // Work backwards to find Friday
  const diff = day >= 5 ? day - 5 : day + 2
  lastDay.setDate(lastDay.getDate() - diff)
  
  return lastDay
}

export function formatDateRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  
  const sMonth = s.toLocaleDateString('en-US', { month: 'short' })
  const eMonth = e.toLocaleDateString('en-US', { month: 'short' })
  
  if (sMonth === eMonth) {
    return `${sMonth} ${s.getDate()}-${e.getDate()}`
  }
  return `${sMonth} ${s.getDate()} - ${eMonth} ${e.getDate()}`
}

export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// =============================================================================
// GMAIL HOOKS
// =============================================================================

/**
 * Search Gmail for emails to/from a specific email address
 * Supports pagination via infinite query and custom search queries
 * @param options.maxPages - Maximum number of pages to allow loading (default: 50, max 1000 emails)
 */
export function useGmailSearch(
  email: string | undefined,
  options?: { query?: string; maxResults?: number; maxPages?: number }
) {
  const maxPages = options?.maxPages ?? 50 // Default to 50 pages (1000 emails max)

  return useInfiniteQuery({
    queryKey: [...queryKeys.gmail.search(email || ''), options?.query || ''],
    queryFn: ({ pageParam }) => {
      const params: GmailSearchParams = {
        email: email!,
        query: options?.query,
        maxResults: options?.maxResults || 20,
        pageToken: pageParam as string | undefined,
      }
      return searchGmail(params)
    },
    enabled: !!email,
    staleTime: 1000 * 60 * 2, // 2 minutes
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage, allPages) => {
      // Enforce max page limit to prevent unbounded memory accumulation
      if (allPages.length >= maxPages) {
        return undefined // Stop pagination
      }
      return lastPage.nextPageToken
    },
  })
}

/**
 * Fetch full email thread with message bodies
 */
export function useGmailThread(threadId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.gmail.thread(threadId || ''),
    queryFn: () => getGmailThread(threadId!),
    enabled: !!threadId,
  })
}

/**
 * Send a new email or reply to an existing thread
 */
export function useGmailSend() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: sendGmail,
    onSuccess: (_, variables) => {
      // Invalidate all gmail searches (since we don't know which queries are active)
      queryClient.invalidateQueries({ queryKey: queryKeys.gmail.all })
      // If this was a reply, also invalidate the thread
      if (variables.threadId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.gmail.thread(variables.threadId) })
      }
    },
  })
}

// =============================================================================
// PAYROLL TYPES
// =============================================================================

export type PayrollRunStatus = 'draft' | 'review' | 'approved' | 'paid'
export type RateSource = 'assignment' | 'service' | 'teacher'

export interface PayrollRun {
  id: string
  period_start: string
  period_end: string
  status: PayrollRunStatus
  total_calculated: number
  total_adjusted: number
  total_hours: number
  teacher_count: number
  approved_by: string | null
  approved_at: string | null
  paid_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface PayrollLineItem {
  id: string
  payroll_run_id: string
  teacher_id: string
  teacher_assignment_id: string | null
  enrollment_id: string | null
  service_id: string | null
  description: string
  calculated_hours: number
  actual_hours: number
  hourly_rate: number
  rate_source: RateSource
  calculated_amount: number
  adjustment_amount: number
  final_amount: number
  adjustment_note: string | null
  created_at: string
}

export interface PayrollAdjustment {
  id: string
  teacher_id: string
  source_payroll_run_id: string | null
  target_payroll_run_id: string | null
  amount: number
  reason: string
  created_by: string | null
  created_at: string
}

export interface PayrollLineItemWithDetails extends PayrollLineItem {
  teacher: Teacher
  service?: Service
  enrollment?: Enrollment & { student: Student | null }
}

export interface PayrollRunWithDetails extends PayrollRun {
  line_items: PayrollLineItemWithDetails[]
}

export interface PayrollAdjustmentWithTeacher extends PayrollAdjustment {
  teacher: Teacher
}

// =============================================================================
// PAYROLL HELPER FUNCTIONS
// =============================================================================

/**
 * Parse a date string as UTC midnight to avoid timezone issues
 */
function parseAsUTC(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00Z')
}

/**
 * Count weekdays (Monday-Friday) between two dates, inclusive
 * Uses UTC to avoid timezone-related off-by-one errors
 */
function countWeekdays(startDate: Date | string, endDate: Date | string): number {
  // Convert to UTC dates if strings are provided
  const start = typeof startDate === 'string' ? parseAsUTC(startDate) : new Date(Date.UTC(
    startDate.getFullYear(), startDate.getMonth(), startDate.getDate()
  ))
  const end = typeof endDate === 'string' ? parseAsUTC(endDate) : new Date(Date.UTC(
    endDate.getFullYear(), endDate.getMonth(), endDate.getDate()
  ))

  let count = 0
  const current = new Date(start)

  while (current <= end) {
    const dayOfWeek = current.getUTCDay()
    // 0 = Sunday, 6 = Saturday, so 1-5 are weekdays
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      count++
    }
    current.setUTCDate(current.getUTCDate() + 1)
  }

  return count
}

/**
 * Calculate hours for a pay period with proration for mid-period start/end
 * All dates are treated as inclusive (both start and end dates count)
 * Uses UTC parsing to avoid timezone-related boundary issues
 */
function calculatePeriodHours(
  hoursPerWeek: number | null,
  periodStart: string,
  periodEnd: string,
  assignmentStart: string | null,
  assignmentEnd: string | null
): { hours: number; isVariable: boolean } {
  if (hoursPerWeek === null) {
    return { hours: 0, isVariable: true }
  }

  // Parse all dates as UTC to ensure consistent comparison
  const pStart = parseAsUTC(periodStart)
  const pEnd = parseAsUTC(periodEnd)
  const aStart = assignmentStart ? parseAsUTC(assignmentStart) : null
  const aEnd = assignmentEnd ? parseAsUTC(assignmentEnd) : null

  // Calculate effective overlap period (both boundaries are inclusive)
  const effectiveStart = aStart && aStart > pStart ? aStart : pStart
  const effectiveEnd = aEnd && aEnd < pEnd ? aEnd : pEnd

  // If assignment doesn't overlap with period
  if (effectiveStart > effectiveEnd) {
    return { hours: 0, isVariable: false }
  }

  // Calculate weekdays (Mon-Fri) in effective period (inclusive of both dates)
  const weekdaysInPeriod = countWeekdays(effectiveStart, effectiveEnd)

  // Prorate: (hours_per_week / 5) * weekdaysInPeriod
  // Teachers work 5 days per week (Monday-Friday)
  const dailyHours = hoursPerWeek / 5
  const periodHours = dailyHours * weekdaysInPeriod

  // Round to 2 decimal places
  return {
    hours: Math.round(periodHours * 100) / 100,
    isVariable: false,
  }
}

/**
 * Resolve hourly rate from hierarchy: assignment -> service -> teacher default
 */
function resolveHourlyRate(assignment: {
  hourly_rate_teacher: number | null
  enrollment?: { service?: Service | null } | null
  service?: Service | null
  teacher?: Teacher | null
}): { rate: number; source: RateSource } {
  // 1. Check assignment rate
  if (assignment.hourly_rate_teacher && assignment.hourly_rate_teacher > 0) {
    return { rate: assignment.hourly_rate_teacher, source: 'assignment' }
  }

  // 2. Check service default rate
  const service = assignment.enrollment?.service || assignment.service
  if (service?.default_teacher_rate && service.default_teacher_rate > 0) {
    return { rate: service.default_teacher_rate, source: 'service' }
  }

  // 3. Fall back to teacher default
  if (assignment.teacher?.default_hourly_rate && assignment.teacher.default_hourly_rate > 0) {
    return { rate: assignment.teacher.default_hourly_rate, source: 'teacher' }
  }

  return { rate: 0, source: 'teacher' }
}

/**
 * Generate CSV content for Relay Financial export
 */
export function generatePayrollCSV(run: PayrollRunWithDetails): string {
  // Group line items by teacher and sum amounts
  const byTeacher = run.line_items.reduce((acc, item) => {
    if (!acc[item.teacher_id]) {
      acc[item.teacher_id] = {
        name: item.teacher?.display_name || 'Unknown Teacher',
        total: 0,
      }
    }
    acc[item.teacher_id].total += item.final_amount
    return acc
  }, {} as Record<string, { name: string; total: number }>)

  // Format period label
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  const periodLabel = `${formatDate(run.period_start)} - ${formatDate(run.period_end)}`

  // Generate CSV rows
  const headers = ['Name', 'Amount', 'Memo']
  const rows = Object.values(byTeacher)
    .filter(t => t.total > 0)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(teacher => `"${teacher.name}",${teacher.total.toFixed(2)},"Eaton Academy Payroll ${periodLabel}"`)

  return [headers.join(','), ...rows].join('\n')
}

/**
 * Trigger CSV download in browser
 */
export function downloadPayrollCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// =============================================================================
// PAYROLL HOOKS
// =============================================================================

/**
 * Fetch all payroll runs with optional status filter
 */
// Helper to access payroll tables (not yet in generated types)
const payrollDb = supabase as any

export function usePayrollRuns(filters?: { status?: string }) {
  return useQuery({
    queryKey: queryKeys.payroll.runs(filters),
    queryFn: async () => {
      let query = payrollDb.from('payroll_run')
        .select('*')
        .order('period_start', { ascending: false })

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }

      const { data, error } = await query
      if (error) throw error
      return data as PayrollRun[]
    },
  })
}

/**
 * Fetch a single payroll run with all line items and teacher details
 */
export function usePayrollRunWithItems(runId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.payroll.runWithItems(runId || ''),
    queryFn: async () => {
      if (!runId) return null

      // Fetch the run
      const { data: run, error: runError } = await payrollDb.from('payroll_run')
        .select('*')
        .eq('id', runId)
        .single()

      if (runError) throw runError

      // Fetch line items with related data
      const { data: lineItems, error: itemsError } = await payrollDb.from('payroll_line_item')
        .select(`
          *,
          teacher:teachers(*),
          service:services(*),
          enrollment:enrollments(*, student:students(*))
        `)
        .eq('payroll_run_id', runId)
        .order('teacher_id')

      if (itemsError) throw itemsError

      return {
        ...run,
        line_items: lineItems || [],
      } as PayrollRunWithDetails
    },
    enabled: !!runId,
  })
}

/**
 * Fetch pending adjustments that haven't been applied to a payroll run yet
 */
export function usePendingPayrollAdjustments(teacherId?: string) {
  return useQuery({
    queryKey: queryKeys.payroll.pendingAdjustments(teacherId),
    queryFn: async () => {
      let query = payrollDb.from('payroll_adjustment')
        .select(`
          *,
          teacher:teachers(id, display_name, email)
        `)
        .is('target_payroll_run_id', null)
        .order('created_at', { ascending: false })

      if (teacherId) {
        query = query.eq('teacher_id', teacherId)
      }

      const { data, error } = await query
      if (error) throw error
      return data as PayrollAdjustmentWithTeacher[]
    },
  })
}

/**
 * Payroll mutations for CRUD operations
 */
export function usePayrollMutations() {
  const queryClient = useQueryClient()

  /**
   * Create a new payroll run and auto-generate line items from active assignments
   */
  const createPayrollRun = useMutation({
    mutationFn: async ({
      periodStart,
      periodEnd,
    }: {
      periodStart: string
      periodEnd: string
    }) => {
      // 1. Create the payroll run
      const { data: run, error: runError } = await payrollDb.from('payroll_run')
        .insert({
          period_start: periodStart,
          period_end: periodEnd,
          status: 'draft',
        })
        .select()
        .single()

      if (runError) throw runError

      // 2. Fetch all active teacher assignments with related data
      const { data: assignments, error: assignError } = await (supabase.from('teacher_assignments') as any)
        .select(`
          *,
          teacher:teachers(*),
          enrollment:enrollments(
            *,
            student:students(full_name),
            service:services(*)
          )
        `)
        .eq('is_active', true)

      if (assignError) throw assignError

      // 3. Calculate and create line items for each assignment
      const lineItems: Partial<PayrollLineItem>[] = []

      for (const assignment of assignments || []) {
        const { hours, isVariable } = calculatePeriodHours(
          assignment.hours_per_week,
          periodStart,
          periodEnd,
          assignment.start_date,
          assignment.end_date
        )

        // Skip if no hours and not variable
        if (hours === 0 && !isVariable) continue

        const { rate, source } = resolveHourlyRate(assignment)
        const calculatedAmount = hours * rate

        // Build description
        let description = ''
        if (assignment.enrollment?.student?.full_name) {
          description = assignment.enrollment.student.full_name
        } else {
          description = assignment.teacher?.display_name || 'Unknown'
        }
        const serviceName = assignment.enrollment?.service?.name
        if (serviceName) {
          description += ` - ${serviceName}`
        }

        lineItems.push({
          payroll_run_id: run.id,
          teacher_id: assignment.teacher_id,
          teacher_assignment_id: assignment.id,
          enrollment_id: assignment.enrollment_id,
          service_id: assignment.enrollment?.service_id || null,
          description,
          calculated_hours: hours,
          actual_hours: hours, // Default actual = calculated
          hourly_rate: rate,
          rate_source: source,
          calculated_amount: calculatedAmount,
          adjustment_amount: 0,
          final_amount: calculatedAmount,
        })
      }

      // 4. Insert all line items
      if (lineItems.length > 0) {
        const { error: itemsError } = await payrollDb.from('payroll_line_item')
          .insert(lineItems)

        if (itemsError) throw itemsError
      }

      // 5. Apply pending adjustments to this run
      const { data: pendingAdjustments } = await payrollDb.from('payroll_adjustment')
        .select('*')
        .is('target_payroll_run_id', null)

      if (pendingAdjustments && pendingAdjustments.length > 0) {
        // Link adjustments to this run
        const { error: adjError } = await payrollDb.from('payroll_adjustment')
          .update({ target_payroll_run_id: run.id })
          .is('target_payroll_run_id', null)

        if (adjError) console.error('Failed to link adjustments:', adjError)

        // Add adjustment amounts to corresponding teacher line items
        for (const adj of pendingAdjustments) {
          // Find existing line items for this teacher
          const teacherItems = lineItems.filter(li => li.teacher_id === adj.teacher_id)
          if (teacherItems.length > 0) {
            // Add adjustment to first line item for this teacher
            const firstItem = teacherItems[0]
            await payrollDb.from('payroll_line_item')
              .update({
                adjustment_amount: adj.amount,
                adjustment_note: adj.reason,
                final_amount: (firstItem.calculated_amount || 0) + adj.amount,
              })
              .eq('payroll_run_id', run.id)
              .eq('teacher_id', adj.teacher_id)
              .limit(1)
          }
        }
      }

      // 6. Calculate and update run totals
      const totalCalculated = lineItems.reduce((sum, li) => sum + (li.calculated_amount || 0), 0)
      const totalAdjusted = lineItems.reduce((sum, li) => sum + (li.final_amount || 0), 0)
      const totalHours = lineItems.reduce((sum, li) => sum + (li.actual_hours || 0), 0)
      const teacherIds = new Set(lineItems.map(li => li.teacher_id))

      const { error: updateError } = await payrollDb.from('payroll_run')
        .update({
          total_calculated: totalCalculated,
          total_adjusted: totalAdjusted,
          total_hours: totalHours,
          teacher_count: teacherIds.size,
        })
        .eq('id', run.id)

      if (updateError) console.error('Failed to update run totals:', updateError)

      return run as PayrollRun
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payroll.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.payroll.pendingAdjustments() })
    },
  })

  /**
   * Update payroll run status (workflow transitions)
   */
  const updateRunStatus = useMutation({
    mutationFn: async ({
      id,
      status,
      approvedBy,
    }: {
      id: string
      status: PayrollRunStatus
      approvedBy?: string
    }) => {
      const updateData: Partial<PayrollRun> = { status }

      if (status === 'approved') {
        updateData.approved_by = approvedBy || null
        updateData.approved_at = new Date().toISOString()
      } else if (status === 'paid') {
        updateData.paid_at = new Date().toISOString()
      }

      const { data, error } = await payrollDb.from('payroll_run')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as PayrollRun
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payroll.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.payroll.runWithItems(variables.id) })
    },
  })

  /**
   * Update a line item (for hour adjustments during review)
   */
  const updateLineItem = useMutation({
    mutationFn: async ({
      id,
      actualHours,
      adjustmentAmount,
      adjustmentNote,
    }: {
      id: string
      actualHours?: number
      adjustmentAmount?: number
      adjustmentNote?: string
    }) => {
      // First fetch current item to recalculate
      const { data: current, error: fetchError } = await payrollDb.from('payroll_line_item')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError) throw fetchError

      const hours = actualHours ?? current.actual_hours
      const adjustment = adjustmentAmount ?? current.adjustment_amount
      const calculatedAmount = hours * current.hourly_rate
      const finalAmount = calculatedAmount + adjustment

      const { data, error } = await payrollDb.from('payroll_line_item')
        .update({
          actual_hours: hours,
          calculated_amount: calculatedAmount,
          adjustment_amount: adjustment,
          adjustment_note: adjustmentNote ?? current.adjustment_note,
          final_amount: finalAmount,
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      // Recalculate run totals
      await recalculateRunTotals(current.payroll_run_id)

      return data as PayrollLineItem
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payroll.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.payroll.runWithItems(data.payroll_run_id) })
    },
  })

  /**
   * Create a carry-forward adjustment for a future payroll run
   */
  const createAdjustment = useMutation({
    mutationFn: async ({
      teacherId,
      sourceRunId,
      amount,
      reason,
    }: {
      teacherId: string
      sourceRunId?: string
      amount: number
      reason: string
    }) => {
      const { data, error } = await payrollDb.from('payroll_adjustment')
        .insert({
          teacher_id: teacherId,
          source_payroll_run_id: sourceRunId || null,
          amount,
          reason,
        })
        .select()
        .single()

      if (error) throw error
      return data as PayrollAdjustment
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payroll.pendingAdjustments() })
    },
  })

  /**
   * Delete a payroll run (only allowed for draft status)
   */
  const deletePayrollRun = useMutation({
    mutationFn: async (id: string) => {
      // Line items will cascade delete due to foreign key constraint
      const { error } = await payrollDb.from('payroll_run')
        .delete()
        .eq('id', id)

      if (error) throw error
      return id
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payroll.all })
      // Clear cached detail data for the deleted run
      queryClient.invalidateQueries({ queryKey: queryKeys.payroll.runWithItems(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.payroll.runDetail(id) })
    },
  })

  return {
    createPayrollRun,
    updateRunStatus,
    updateLineItem,
    createAdjustment,
    deletePayrollRun,
  }
}

/**
 * Helper to recalculate run totals after line item changes
 */
async function recalculateRunTotals(runId: string) {
  const { data: items } = await payrollDb.from('payroll_line_item')
    .select('actual_hours, calculated_amount, final_amount, teacher_id')
    .eq('payroll_run_id', runId)

  if (!items) return

  const totalCalculated = items.reduce((sum: number, li: any) => sum + (li.calculated_amount || 0), 0)
  const totalAdjusted = items.reduce((sum: number, li: any) => sum + (li.final_amount || 0), 0)
  const totalHours = items.reduce((sum: number, li: any) => sum + (li.actual_hours || 0), 0)
  const teacherIds = new Set(items.map((li: any) => li.teacher_id))

  await payrollDb.from('payroll_run')
    .update({
      total_calculated: totalCalculated,
      total_adjusted: totalAdjusted,
      total_hours: totalHours,
      teacher_count: teacherIds.size,
    })
    .eq('id', runId)
}

// =============================================================================
// LEADS
// =============================================================================

export type LeadType = 'exit_intent' | 'waitlist' | 'calendly_call' | 'event'
export type LeadStatus = 'new' | 'contacted' | 'converted' | 'closed'

export interface Lead {
  id: string
  email: string
  name: string | null
  phone: string | null
  lead_type: LeadType
  status: LeadStatus
  source_url: string | null
  family_id: string | null
  converted_at: string | null
  num_children: number | null
  service_interest: string | null
  notes: string | null
  mailchimp_id: string | null
  mailchimp_status: string | null
  mailchimp_last_synced_at: string | null
  mailchimp_tags: string[] | null
  // Engagement fields - optional until migration is run
  mailchimp_opens?: number | null
  mailchimp_clicks?: number | null
  mailchimp_engagement_score?: number | null
  mailchimp_engagement_updated_at?: string | null
  // Lead score - optional until migration is run
  lead_score?: number | null
  created_at: string
  updated_at: string
}

export interface LeadWithFamily extends Lead {
  family?: {
    id: string
    display_name: string
  } | null
  days_in_pipeline?: number
  contact_count?: number
  last_contacted_at?: string | null
  // Computed score (calculated client-side if not in DB)
  computed_score?: number
}

/**
 * Calculate lead score client-side (fallback when DB score not available)
 * Scoring:
 * - Source Quality (0-30): event=30, calendly=25, waitlist=15, exit_intent=10
 * - Recency (0-25): 0-7 days=25, 8-14=20, 15-30=15, 31-60=10, 61-90=5, 90+=0
 * - Engagement (0-30): mailchimp_engagement_score capped at 30
 * - Contact Activity (0-15): 3 points per contact, max 5 contacts
 */
export function calculateLeadScore(lead: {
  lead_type: LeadType
  created_at: string
  mailchimp_engagement_score?: number | null
  contact_count?: number
}): number {
  let score = 0

  // Source quality (0-30)
  const sourceScores: Record<LeadType, number> = {
    event: 30,
    calendly_call: 25,
    waitlist: 15,
    exit_intent: 10,
  }
  score += sourceScores[lead.lead_type] || 5

  // Recency (0-25)
  const daysOld = Math.floor(
    (Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24)
  )
  if (daysOld <= 7) score += 25
  else if (daysOld <= 14) score += 20
  else if (daysOld <= 30) score += 15
  else if (daysOld <= 60) score += 10
  else if (daysOld <= 90) score += 5

  // Engagement (0-30, capped)
  score += Math.min(lead.mailchimp_engagement_score || 0, 30)

  // Contact activity (0-15, 3 points per contact, max 5)
  score += Math.min((lead.contact_count || 0) * 3, 15)

  return score
}

/**
 * Get score label based on score value
 */
export function getScoreLabel(score: number): 'hot' | 'warm' | 'cold' {
  if (score >= 60) return 'hot'
  if (score >= 30) return 'warm'
  return 'cold'
}

/**
 * Fetch leads with optional filters
 * @param filters.limit - Maximum number of leads to fetch (default: 500)
 */
export function useLeads(filters?: { type?: string; status?: string; search?: string; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.leads.list(filters),
    queryFn: async () => {
      const limit = filters?.limit ?? 500 // Default limit to prevent unbounded fetching

      // Fetch leads with family relationship
      let query = supabase
        .from('leads')
        .select(`
          *,
          family:families(id, display_name)
        `)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (filters?.type) {
        query = query.eq('lead_type', filters.type as LeadType)
      }
      if (filters?.status) {
        query = query.eq('status', filters.status as LeadStatus)
      }
      if (filters?.search) {
        query = query.or(`email.ilike.%${filters.search}%,name.ilike.%${filters.search}%`)
      }

      const { data: leads, error: leadsError } = await query
      if (leadsError) throw leadsError

      // Fetch activity stats only for the leads we have (not all activities)
      const leadIds = (leads || []).map(l => l.id)
      if (leadIds.length === 0) {
        return [] as LeadWithFamily[]
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: activityStats, error: statsError } = await (supabase as any)
        .from('lead_activities')
        .select('lead_id, contacted_at')
        .in('lead_id', leadIds)
        .order('contacted_at', { ascending: false })

      if (statsError) {
        // If activities table doesn't exist yet, return leads without stats
        console.warn('Could not fetch activity stats:', statsError)
        return leads as LeadWithFamily[]
      }

      // Group stats by lead_id
      const statsMap = new Map<string, { count: number; lastContacted: string | null }>()
      for (const activity of (activityStats || []) as { lead_id: string; contacted_at: string }[]) {
        const existing = statsMap.get(activity.lead_id)
        if (existing) {
          existing.count++
        } else {
          statsMap.set(activity.lead_id, {
            count: 1,
            lastContacted: activity.contacted_at,
          })
        }
      }

      // Merge stats into leads and calculate scores
      return (leads || []).map(lead => {
        const contactCount = statsMap.get(lead.id)?.count || 0
        const leadWithStats = {
          ...lead,
          contact_count: contactCount,
          last_contacted_at: statsMap.get(lead.id)?.lastContacted || null,
        }
        // Use DB score if available, otherwise calculate client-side
        const computedScore = lead.lead_score ?? calculateLeadScore({
          lead_type: (lead.lead_type || 'exit_intent') as LeadType,
          created_at: lead.created_at,
          mailchimp_engagement_score: lead.mailchimp_engagement_score,
          contact_count: contactCount,
        })
        return {
          ...leadWithStats,
          computed_score: computedScore,
        }
      }) as LeadWithFamily[]
    },
  })
}

/**
 * Fetch a single lead by ID
 */
export function useLead(id: string) {
  return useQuery({
    queryKey: queryKeys.leads.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          family:families(id, display_name, primary_email, primary_phone, status)
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      return data as LeadWithFamily
    },
    enabled: !!id,
  })
}

/**
 * Lead mutations for CRUD operations
 */
export function useLeadMutations() {
  const queryClient = useQueryClient()

  const createLead = useMutation({
    mutationFn: async (lead: Omit<Lead, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('leads')
        .insert(lead)
        .select()
        .single()
      if (error) throw error
      return data as Lead
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
    },
  })

  const updateLead = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Lead> & { id: string }) => {
      const { data, error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Lead
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(variables.id) })
    },
  })

  const deleteLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
      // Clear cached detail data for the deleted lead
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(id) })
    },
  })

  const bulkCreateLeads = useMutation({
    mutationFn: async (leads: Omit<Lead, 'id' | 'created_at' | 'updated_at'>[]) => {
      const { data, error } = await supabase
        .from('leads')
        .insert(leads)
        .select()
      if (error) throw error
      return data as Lead[]
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
    },
  })

  const convertToFamily = useMutation({
    mutationFn: async ({ leadId, familyId }: { leadId: string; familyId: string }) => {
      const { data, error } = await supabase
        .from('leads')
        .update({
          family_id: familyId,
          status: 'converted' as LeadStatus,
          converted_at: new Date().toISOString(),
        })
        .eq('id', leadId)
        .select()
        .single()
      if (error) throw error
      return data as Lead
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(variables.leadId) })
    },
  })

  return {
    createLead,
    updateLead,
    deleteLead,
    bulkCreateLeads,
    convertToFamily,
  }
}

/**
 * Check for existing customers by email (for deduplication during import)
 */
export function useCheckDuplicateEmails() {
  return useMutation({
    mutationFn: async (emails: string[]) => {
      const lowerEmails = emails.map(e => e.toLowerCase())
      const { data, error } = await supabase
        .from('families')
        .select('primary_email')
        .in('primary_email', lowerEmails)
      if (error) throw error
      return new Set((data || []).map(f => f.primary_email?.toLowerCase()))
    },
  })
}

// =============================================================================
// EVENT LEADS (from event_leads view)
// =============================================================================

export interface EventLead {
  family_id: string
  family_name: string | null
  primary_email: string | null
  primary_phone: string | null
  created_at: string | null
  event_order_count: number | null
  total_event_spend: number | null
  last_event_order_at: string | null
}

/**
 * Fetch event leads - families who have event orders but no active enrollments
 * These are potential leads for conversion to regular services
 */
export function useEventLeads() {
  return useQuery({
    queryKey: ['eventLeads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_leads')
        .select('*')
        .order('last_event_order_at', { ascending: false })
      if (error) throw error
      return (data || []) as EventLead[]
    },
  })
}

// =============================================================================
// LEAD ACTIVITY TYPES & HOOKS
// =============================================================================

export type ContactType = 'call' | 'email' | 'text' | 'other'

export interface LeadActivity {
  id: string
  lead_id: string
  contact_type: ContactType
  notes: string | null
  contacted_at: string
  created_at: string
}

/**
 * Fetch activities for a specific lead
 */
export function useLeadActivities(leadId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.leadActivities.byLead(leadId || ''),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('lead_activities')
        .select('*')
        .eq('lead_id', leadId)
        .order('contacted_at', { ascending: false })
      if (error) throw error
      return data as LeadActivity[]
    },
    enabled: !!leadId,
  })
}

/**
 * Lead activity mutations
 */
export function useLeadActivityMutations() {
  const queryClient = useQueryClient()

  const createActivity = useMutation({
    mutationFn: async (activity: Omit<LeadActivity, 'id' | 'created_at'>) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('lead_activities')
        .insert(activity)
        .select()
        .single()
      if (error) throw error
      return data as LeadActivity
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leadActivities.byLead(variables.lead_id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
    },
  })

  const deleteActivity = useMutation({
    mutationFn: async ({ id }: { id: string; leadId: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('lead_activities')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leadActivities.byLead(variables.leadId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
    },
  })

  return {
    createActivity,
    deleteActivity,
  }
}

// =============================================================================
// CONVERSION ANALYTICS
// =============================================================================

export interface ConversionStats {
  // Overall metrics
  totalLeads: number
  convertedLeads: number
  conversionRate: number
  avgDaysToConvert: number

  // Funnel breakdown
  funnel: {
    new: number
    contacted: number
    converted: number
    closed: number
  }

  // By lead type
  byLeadType: Array<{
    type: LeadType
    total: number
    converted: number
    rate: number
  }>

  // Monthly trend (last 6 months)
  monthlyTrend: Array<{
    month: string
    leads: number
    conversions: number
    rate: number
  }>

  // Top converting sources
  topSources: Array<{
    source: string
    conversions: number
  }>
}

/**
 * Fetch conversion analytics data
 */
export function useConversionAnalytics() {
  return useQuery({
    queryKey: [...queryKeys.leads.all, 'analytics'],
    queryFn: async () => {
      // Fetch all leads for analytics
      const { data: leads, error } = await supabase
        .from('leads')
        .select('id, lead_type, status, created_at, converted_at, source_url')
        .order('created_at', { ascending: false })

      if (error) throw error

      const allLeads = leads || []
      const convertedLeads = allLeads.filter(l => l.status === 'converted')

      // Calculate average days to convert
      const daysToConvert = convertedLeads
        .filter(l => l.converted_at)
        .map(l => {
          const created = new Date(l.created_at)
          const converted = new Date(l.converted_at!)
          // Use Math.round for consistent day calculations
          return Math.round((converted.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
        })
      const avgDaysToConvert = daysToConvert.length > 0
        ? Math.round(daysToConvert.reduce((a, b) => a + b, 0) / daysToConvert.length)
        : 0

      // Funnel breakdown
      const funnel = {
        new: allLeads.filter(l => l.status === 'new').length,
        contacted: allLeads.filter(l => l.status === 'contacted').length,
        converted: allLeads.filter(l => l.status === 'converted').length,
        closed: allLeads.filter(l => l.status === 'closed').length,
      }

      // By lead type
      const leadTypes: LeadType[] = ['event', 'calendly_call', 'waitlist', 'exit_intent']
      const byLeadType = leadTypes.map(type => {
        const typeLeads = allLeads.filter(l => l.lead_type === type)
        const typeConverted = typeLeads.filter(l => l.status === 'converted')
        return {
          type,
          total: typeLeads.length,
          converted: typeConverted.length,
          rate: typeLeads.length > 0 ? Math.round((typeConverted.length / typeLeads.length) * 100) : 0,
        }
      }).filter(t => t.total > 0)

      // Monthly trend (last 6 months)
      const now = new Date()
      const monthlyTrend: ConversionStats['monthlyTrend'] = []
      for (let i = 5; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59)
        const monthName = monthStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })

        const monthLeads = allLeads.filter(l => {
          const created = new Date(l.created_at)
          return created >= monthStart && created <= monthEnd
        })
        const monthConversions = convertedLeads.filter(l => {
          if (!l.converted_at) return false
          const converted = new Date(l.converted_at)
          return converted >= monthStart && converted <= monthEnd
        })

        monthlyTrend.push({
          month: monthName,
          leads: monthLeads.length,
          conversions: monthConversions.length,
          rate: monthLeads.length > 0 ? Math.round((monthConversions.length / monthLeads.length) * 100) : 0,
        })
      }

      // Top converting sources (from source_url)
      const sourceMap = new Map<string, number>()
      convertedLeads.forEach(lead => {
        const source = lead.source_url ? extractDomain(lead.source_url) : 'Direct'
        sourceMap.set(source, (sourceMap.get(source) || 0) + 1)
      })
      const topSources = Array.from(sourceMap.entries())
        .map(([source, conversions]) => ({ source, conversions }))
        .sort((a, b) => b.conversions - a.conversions)
        .slice(0, 5)

      return {
        totalLeads: allLeads.length,
        convertedLeads: convertedLeads.length,
        conversionRate: allLeads.length > 0 ? Math.round((convertedLeads.length / allLeads.length) * 100) : 0,
        avgDaysToConvert,
        funnel,
        byLeadType,
        monthlyTrend,
        topSources,
      } as ConversionStats
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Helper to extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace('www.', '')
  } catch {
    // URL parsing failed - likely a relative or malformed URL, extract first segment
    return url.split('/')[0] || 'Unknown'
  }
}

// =============================================================================
// LEAD FOLLOW-UPS
// =============================================================================

export type TaskPriority = 'low' | 'medium' | 'high'

export interface LeadFollowUp {
  id: string
  lead_id: string
  title: string
  description: string | null
  due_date: string
  due_time: string | null
  priority: TaskPriority
  completed: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface UpcomingFollowUp extends LeadFollowUp {
  lead_name: string | null
  lead_email: string
  lead_phone: string | null
  lead_type: LeadType
  lead_status: LeadStatus
  urgency: 'overdue' | 'today' | 'tomorrow' | 'this_week' | 'later'
}

/**
 * Fetch follow-ups for a specific lead
 */
export function useLeadFollowUps(leadId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.leadFollowUps.byLead(leadId || ''),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('lead_follow_ups')
        .select('*')
        .eq('lead_id', leadId)
        .order('due_date', { ascending: true })
        .order('due_time', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data as LeadFollowUp[]
    },
    enabled: !!leadId,
  })
}

/**
 * Fetch all upcoming (non-completed) follow-ups
 */
export function useUpcomingFollowUps() {
  return useQuery({
    queryKey: queryKeys.leadFollowUps.upcoming(),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('upcoming_follow_ups')
        .select('*')
        .limit(50)
      if (error) throw error
      return data as UpcomingFollowUp[]
    },
  })
}

/**
 * Follow-up mutations
 */
export function useFollowUpMutations() {
  const queryClient = useQueryClient()

  const createFollowUp = useMutation({
    mutationFn: async (followUp: Omit<LeadFollowUp, 'id' | 'created_at' | 'updated_at' | 'completed' | 'completed_at'>) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('lead_follow_ups')
        .insert(followUp)
        .select()
        .single()
      if (error) throw error
      return data as LeadFollowUp
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leadFollowUps.byLead(variables.lead_id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.leadFollowUps.upcoming() })
    },
  })

  const updateFollowUp = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LeadFollowUp> & { id: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('lead_follow_ups')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as LeadFollowUp
    },
    onSuccess: (followUp) => {
      // Use targeted invalidations instead of broad all
      queryClient.invalidateQueries({ queryKey: queryKeys.leadFollowUps.byLead(followUp.lead_id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.leadFollowUps.upcoming() })
    },
  })

  const completeFollowUp = useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('lead_follow_ups')
        .update({ completed: true, completed_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as LeadFollowUp
    },
    onSuccess: (followUp) => {
      // Use targeted invalidations instead of broad all
      queryClient.invalidateQueries({ queryKey: queryKeys.leadFollowUps.byLead(followUp.lead_id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.leadFollowUps.upcoming() })
    },
  })

  const deleteFollowUp = useMutation({
    mutationFn: async ({ id }: { id: string; leadId: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('lead_follow_ups')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leadFollowUps.byLead(variables.leadId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.leadFollowUps.upcoming() })
    },
  })

  return {
    createFollowUp,
    updateFollowUp,
    completeFollowUp,
    deleteFollowUp,
  }
}

/**
 * Get urgency color classes
 */
export function getUrgencyColor(urgency: UpcomingFollowUp['urgency']): string {
  switch (urgency) {
    case 'overdue':
      return 'text-red-400 bg-red-500/20'
    case 'today':
      return 'text-orange-400 bg-orange-500/20'
    case 'tomorrow':
      return 'text-yellow-400 bg-yellow-500/20'
    case 'this_week':
      return 'text-blue-400 bg-blue-500/20'
    default:
      return 'text-zinc-400 bg-zinc-500/20'
  }
}

/**
 * Get priority color classes
 */
export function getPriorityColor(priority: TaskPriority): string {
  switch (priority) {
    case 'high':
      return 'text-red-400'
    case 'medium':
      return 'text-yellow-400'
    case 'low':
      return 'text-zinc-400'
  }
}