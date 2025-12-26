import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { queryKeys } from './queryClient'

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type CustomerStatus = 'lead' | 'trial' | 'active' | 'paused' | 'churned'
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
  enrollment_id: string
  teacher_id: string
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
  notes: string | null
  created_at: string
  updated_at: string
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

// =============================================================================
// FAMILIES HOOKS
// =============================================================================

export function useFamilies(filters?: { status?: string; search?: string }) {
  return useQuery({
    queryKey: queryKeys.families.list(filters),
    queryFn: async () => {
      let query = supabase
        .from('families')
        .select('*')
        .order('display_name')

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
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
        .in('status', ['active', 'trial', 'lead'])
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
      const { data: student, error } = await (supabase.from('students') as any)
        .insert(data)
        .select()
        .single()
      if (error) throw error
      return student
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.students.byFamily(data.family_id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.families.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() })
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.students.byFamily(data.family_id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.families.detail(data.family_id) })
    },
  })

  const deleteStudent = useMutation({
    mutationFn: async ({ id, familyId }: { id: string; familyId: string }) => {
      const { error } = await supabase.from('students').delete().eq('id', id)
      if (error) throw error
      return { familyId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.students.byFamily(data.familyId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.families.all })
    },
  })

  return { createStudent, updateStudent, deleteStudent }
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
        query = query.eq('status', filters.status)
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

export function useTeacher(id: string) {
  return useQuery({
    queryKey: queryKeys.teachers.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .eq('id', id)
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
      // Invalidate all teacher-related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.teachers.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.teachers.detail(variables.id) })
      // Also invalidate enrollments since they may display teacher data
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.teacherAssignments.all })
    },
  })

  const deleteTeacher = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('teachers').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teachers.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() })
    },
  })

  return { createTeacher, updateTeacher, deleteTeacher }
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
    staleTime: 5 * 60 * 1000, // Services rarely change, cache for 5 minutes
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
// ENROLLMENTS HOOKS
// =============================================================================

export function useEnrollments(filters?: { status?: string; serviceId?: string }) {
  return useQuery({
    queryKey: queryKeys.enrollments.list(filters),
    queryFn: async () => {
      let query = supabase
        .from('enrollments')
        .select(`
          *,
          service:services(*),
          student:students(*),
          family:families(id, display_name, primary_email, primary_phone),
          teacher_assignments(
            *,
            teacher:teachers(*)
          )
        `)
        .order('created_at', { ascending: false })

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }

      if (filters?.serviceId && filters.serviceId !== 'all') {
        query = query.eq('service_id', filters.serviceId)
      }

      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

export function useEnrollmentsByFamily(familyId: string) {
  return useQuery({
    queryKey: queryKeys.enrollments.byFamily(familyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          *,
          service:services(*),
          student:students(*)
        `)
        .eq('family_id', familyId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    },
    enabled: !!familyId,
  })
}

export function useEnrollment(id: string) {
  return useQuery({
    queryKey: queryKeys.enrollments.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          *,
          service:services(*),
          student:students(*),
          family:families(*),
          teacher_assignments(
            *,
            teacher:teachers(*)
          )
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export function useEnrollmentMutations() {
  const queryClient = useQueryClient()

  const createEnrollment = useMutation({
    mutationFn: async (data: Partial<Enrollment>) => {
      const { data: enrollment, error } = await (supabase.from('enrollments') as any)
        .insert(data)
        .select()
        .single()
      if (error) throw error
      return enrollment
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.byFamily(data.family_id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.roster() })
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
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.byFamily(data.family_id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.roster() })
    },
  })

  const deleteEnrollment = useMutation({
    mutationFn: async ({ id, familyId }: { id: string; familyId: string }) => {
      const { error } = await supabase.from('enrollments').delete().eq('id', id)
      if (error) throw error
      return { familyId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.byFamily(data.familyId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.roster() })
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
      const { data, error } = await supabase
        .from('teacher_assignments')
        .select(`
          *,
          teacher:teachers(*)
        `)
        .eq('enrollment_id', enrollmentId)
        .order('is_active', { ascending: false })
        .order('start_date', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!enrollmentId,
  })
}

export function useTeacherAssignmentsByTeacher(
  teacherId: string, 
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.teacherAssignments.byTeacher(teacherId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teacher_assignments')
        .select(`
          *,
          enrollment:enrollments (
            id,
            hourly_rate_customer,
            hours_per_week,
            student:students (id, full_name),
            family:families (id, display_name),
            service:services (id, name, code)
          )
        `)
        .eq('teacher_id', teacherId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: (options?.enabled !== false) && !!teacherId,
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teacherAssignments.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.teacherAssignments.byEnrollment(data.enrollment_id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.teacherAssignments.byTeacher(data.teacher_id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all })
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teacherAssignments.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.teacherAssignments.byEnrollment(data.enrollment_id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.teacherAssignments.byTeacher(data.teacher_id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all })
    },
  })

  const transferTeacher = useMutation({
    mutationFn: async ({ 
      currentAssignmentId, 
      enrollmentId, 
      newTeacherId,
      newRate,
      hoursPerWeek,
      effectiveDate,
      endPrevious
    }: { 
      currentAssignmentId?: string
      enrollmentId: string
      newTeacherId: string
      newRate?: number
      hoursPerWeek?: number
      effectiveDate: string
      endPrevious: boolean
    }) => {
      // End current assignment if requested
      if (currentAssignmentId && endPrevious) {
        await (supabase.from('teacher_assignments') as any)
          .update({ is_active: false, end_date: effectiveDate })
          .eq('id', currentAssignmentId)
      }

      // Create new assignment
      const newAssignment: Partial<TeacherAssignment> = {
        enrollment_id: enrollmentId,
        teacher_id: newTeacherId,
        is_active: true,
        start_date: effectiveDate,
      }
      if (newRate) newAssignment.hourly_rate_teacher = newRate
      if (hoursPerWeek) newAssignment.hours_per_week = hoursPerWeek

      const { data, error } = await (supabase.from('teacher_assignments') as any)
        .insert(newAssignment)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teacherAssignments.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all })
    },
  })

  // NEW: End all active assignments for an enrollment
  const endAssignmentsByEnrollment = useMutation({
    mutationFn: async ({ 
      enrollmentId, 
      endDate 
    }: { 
      enrollmentId: string
      endDate: string 
    }) => {
      const { data, error } = await (supabase.from('teacher_assignments') as any)
        .update({ is_active: false, end_date: endDate })
        .eq('enrollment_id', enrollmentId)
        .eq('is_active', true)
        .select()

      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teacherAssignments.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.teacherAssignments.byEnrollment(variables.enrollmentId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all })
    },
  })

  return { createAssignment, updateAssignment, transferTeacher, endAssignmentsByEnrollment }
}

// =============================================================================
// INVOICES HOOKS
// =============================================================================

export function useInvoices(filters?: { status?: string; familyId?: string }) {
  return useQuery({
    queryKey: queryKeys.invoices.list(filters),
    queryFn: async () => {
      let query = supabase
        .from('invoices')
        .select(`
          *,
          family:families(id, display_name, primary_email)
        `)
        .order('invoice_date', { ascending: false })

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }

      if (filters?.familyId) {
        query = query.eq('family_id', filters.familyId)
      }

      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

export function useInvoicesByFamily(familyId: string) {
  return useQuery({
    queryKey: queryKeys.invoices.byFamily(familyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('family_id', familyId)
        .order('invoice_date', { ascending: false })

      if (error) throw error
      return data as Invoice[]
    },
    enabled: !!familyId,
  })
}

// =============================================================================
// TEACHER PAYMENTS HOOKS
// =============================================================================

export function useTeacherPaymentsByTeacher(
  teacherId: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.teacherPayments.byTeacher(teacherId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teacher_payments')
        .select('*')
        .eq('teacher_id', teacherId)
        .order('pay_date', { ascending: false })

      if (error) throw error
      return data as TeacherPayment[]
    },
    enabled: (options?.enabled !== false) && !!teacherId,
  })
}

export function useTeacherPaymentMutations() {
  const queryClient = useQueryClient()

  const createPayment = useMutation({
    mutationFn: async (data: Partial<TeacherPayment>) => {
      const { data: payment, error } = await (supabase.from('teacher_payments') as any)
        .insert(data)
        .select()
        .single()
      if (error) throw error
      return payment
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teacherPayments.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.teacherPayments.byTeacher(data.teacher_id) })
    },
  })

  return { createPayment }
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
      
      // Convert to key-value map
      const settings: Record<string, any> = {}
      // Cast data since app_settings may not be in generated types
      const rows = data as { key: string; value: any }[] | null
      rows?.forEach(row => {
        settings[row.key] = row.value
      })
      return settings
    },
    staleTime: 5 * 60 * 1000, // Cache settings for 5 minutes
  })
}

export function useSettingMutations() {
  const queryClient = useQueryClient()

  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { error } = await (supabase.from('app_settings') as any)
        .upsert({ key, value, updated_at: new Date().toISOString() })
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
      // Cast since tags may not be in generated types
      return data as { id: string; name: string; color: string }[] | null
    },
    staleTime: 5 * 60 * 1000,
  })
}

// =============================================================================
// UTILITY: Manual invalidation for complex scenarios
// =============================================================================

export function useInvalidateQueries() {
  const queryClient = useQueryClient()

  return {
    invalidateAll: () => {
      queryClient.invalidateQueries()
    },
    invalidateFamilies: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.families.all })
    },
    invalidateTeachers: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teachers.all })
    },
    invalidateEnrollments: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all })
    },
    invalidateInvoices: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
    },
    invalidateDashboard: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() })
    },
  }
}