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
  sent_to?: string | null
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

// =============================================================================
// ENHANCED INVOICING TYPES
// =============================================================================

export interface InvoiceWithDetails extends Invoice {
  family: Family
  line_items: InvoiceLineItem[]
  services?: string[] // Derived from line items
}

export interface BillableEnrollment extends Enrollment {
  student: Student
  family: Family
  service: Service
  teacher_assignments?: {
    teacher: { display_name: string }
    hourly_rate_teacher: number
  }[]
}

export interface DraftPreviewItem {
  enrollment_id: string
  family_id: string
  family_name: string
  student_name: string
  service_code: string
  service_name: string
  description: string
  amount: number
  hours?: number
  rate?: number
  has_existing_invoice: boolean
}

export interface GenerateDraftsParams {
  period_start: string
  period_end: string
  period_note: string
  due_date: string
  enrollment_ids: string[]
  invoice_type: 'weekly' | 'monthly'
}

// =============================================================================
// ENHANCED INVOICE QUERIES
// =============================================================================

/**
 * Fetch invoices with full details including line items and derived service list
 */
export function useInvoicesWithDetails(filters?: {
  status?: string | string[]
  service_code?: string
  search?: string
  date_from?: string
  date_to?: string
}) {
  return useQuery({
    queryKey: [...queryKeys.invoices.all, 'details', filters],
    queryFn: async () => {
      // First get invoices with family info
      let query = (supabase.from('invoices') as any)
        .select(`
          *,
          family:families!inner(
            id,
            display_name,
            primary_email,
            primary_phone,
            status
          )
        `)
        .order('invoice_date', { ascending: false })

      // Apply status filter
      if (filters?.status) {
        if (Array.isArray(filters.status)) {
          query = query.in('status', filters.status)
        } else {
          query = query.eq('status', filters.status)
        }
      }

      // Apply date filters
      if (filters?.date_from) {
        query = query.gte('invoice_date', filters.date_from)
      }
      if (filters?.date_to) {
        query = query.lte('invoice_date', filters.date_to)
      }

      const { data: invoices, error } = await query

      if (error) throw error
      if (!invoices) return []

      // Fetch line items for all invoices
      const invoiceIds = (invoices as any[]).map((inv: any) => inv.id)
      const { data: lineItems, error: lineError } = await (supabase.from('invoice_line_items') as any)
        .select(`
          *,
          enrollment:enrollments(
            service:services(code, name)
          )
        `)
        .in('invoice_id', invoiceIds)

      if (lineError) throw lineError

      // Group line items by invoice and extract service codes
      const lineItemsByInvoice = new Map<string, any[]>()
      const servicesByInvoice = new Map<string, Set<string>>()

      ;(lineItems as any[] || []).forEach((item: any) => {
        const invoiceId = item.invoice_id
        if (!lineItemsByInvoice.has(invoiceId)) {
          lineItemsByInvoice.set(invoiceId, [])
          servicesByInvoice.set(invoiceId, new Set())
        }
        lineItemsByInvoice.get(invoiceId)!.push(item)
        
        // Extract service code from enrollment or description
        const serviceCode = item.enrollment?.service?.code || 
          extractServiceCodeFromDescription(item.description)
        if (serviceCode) {
          servicesByInvoice.get(invoiceId)!.add(serviceCode)
        }
      })

      // Combine data
      const result: InvoiceWithDetails[] = (invoices as any[]).map((inv: any) => ({
        ...inv,
        line_items: lineItemsByInvoice.get(inv.id) || [],
        services: Array.from(servicesByInvoice.get(inv.id) || [])
      }))

      // Apply service filter (post-query since it's derived)
      if (filters?.service_code) {
        return result.filter(inv => 
          inv.services?.includes(filters.service_code!)
        )
      }

      // Apply search filter
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase()
        return result.filter(inv =>
          inv.invoice_number?.toLowerCase().includes(searchLower) ||
          inv.family?.display_name?.toLowerCase().includes(searchLower) ||
          inv.family?.primary_email?.toLowerCase().includes(searchLower)
        )
      }

      return result
    },
  })
}

/**
 * Get billable enrollments for draft generation
 */
export function useBillableEnrollments(serviceFilter?: 'weekly' | 'monthly' | 'all') {
  return useQuery({
    queryKey: [...queryKeys.enrollments.all, 'billable', serviceFilter],
    queryFn: async () => {
      let query = (supabase.from('enrollments') as any)
        .select(`
          *,
          student:students!inner(id, full_name, grade_level),
          family:families!inner(id, display_name, primary_email, status),
          service:services!inner(id, code, name, billing_frequency),
          teacher_assignments(
            teacher:teachers(display_name),
            hourly_rate_teacher,
            is_active
          )
        `)
        .eq('status', 'active')

      // Filter by billing frequency
      if (serviceFilter === 'weekly') {
        query = query.eq('service.billing_frequency', 'weekly')
      } else if (serviceFilter === 'monthly') {
        query = query.in('service.billing_frequency', ['monthly', 'bi_monthly', 'annual'])
      }

      const { data, error } = await query.order('family(display_name)')

      if (error) throw error
      return (data || []) as BillableEnrollment[]
    },
  })
}

/**
 * Check for existing invoices in a period
 */
export function useExistingInvoicesForPeriod(periodStart: string, periodEnd: string) {
  return useQuery({
    queryKey: [...queryKeys.invoices.all, 'period', periodStart, periodEnd],
    queryFn: async () => {
      const { data, error } = await (supabase.from('invoices') as any)
        .select('id, family_id, invoice_number')
        .eq('period_start', periodStart)
        .eq('period_end', periodEnd)

      if (error) throw error
      return (data || []) as { id: string; family_id: string; invoice_number: string }[]
    },
    enabled: !!periodStart && !!periodEnd,
  })
}

// =============================================================================
// INVOICE MUTATIONS
// =============================================================================

export function useInvoiceMutations() {
  const queryClient = useQueryClient()

  const generateDrafts = useMutation({
    mutationFn: async (params: GenerateDraftsParams) => {
      const { period_start, period_end, period_note, due_date, enrollment_ids } = params

      // Fetch enrollments with all needed data
      const { data: enrollments, error: enrollError } = await (supabase.from('enrollments') as any)
        .select(`
          *,
          student:students(id, full_name),
          family:families(id, display_name, primary_email),
          service:services(id, code, name, billing_frequency)
        `)
        .in('id', enrollment_ids)

      if (enrollError) throw enrollError
      if (!enrollments?.length) throw new Error('No enrollments found')

      // Get next invoice number
      const { data: settings } = await (supabase.from('app_settings') as any)
        .select('value')
        .eq('key', 'invoice_defaults')
        .single()

      let nextNumber = settings?.value?.next_number || 1
      const prefix = settings?.value?.number_prefix || 'INV-'

      // Group enrollments by family
      const byFamily = new Map<string, any[]>()
      ;(enrollments as any[]).forEach((e: any) => {
        const familyId = e.family?.id
        if (!familyId) return
        if (!byFamily.has(familyId)) byFamily.set(familyId, [])
        byFamily.get(familyId)!.push(e)
      })

      const createdInvoices: string[] = []

      // Create one invoice per family
      for (const [familyId, familyEnrollments] of byFamily) {
        // Calculate line items
        const lineItems = familyEnrollments.map((e: any) => {
          const amount = calculateEnrollmentAmount(e as BillableEnrollment, params.invoice_type)
          const description = buildLineItemDescription(e as BillableEnrollment, params.invoice_type)
          return {
            enrollment_id: e.id,
            description,
            quantity: e.service?.code === 'academic_coaching' ? (e.hours_per_week || 0) : 1,
            unit_price: e.service?.code === 'academic_coaching' 
              ? (e.hourly_rate_customer || 0) 
              : amount,
            amount,
          }
        })

        const subtotal = lineItems.reduce((sum: number, li: any) => sum + (li.amount || 0), 0)
        const invoiceNumber = `${prefix}${String(nextNumber).padStart(4, '0')}`

        // Create invoice
        const { data: invoice, error: invError } = await (supabase.from('invoices') as any)
          .insert({
            family_id: familyId,
            invoice_number: invoiceNumber,
            invoice_date: new Date().toISOString().split('T')[0],
            due_date,
            period_start,
            period_end,
            subtotal,
            total_amount: subtotal,
            status: 'draft',
            notes: period_note,
          })
          .select()
          .single()

        if (invError) throw invError

        // Create line items
        const { error: itemsError } = await (supabase.from('invoice_line_items') as any)
          .insert(lineItems.map((li: any, idx: number) => ({
            ...li,
            invoice_id: invoice.id,
            sort_order: idx,
          })))

        if (itemsError) throw itemsError

        createdInvoices.push(invoice.id)
        nextNumber++
      }

      // Update next invoice number
      await (supabase.from('app_settings') as any)
        .update({
          value: { ...settings?.value, next_number: nextNumber },
          updated_at: new Date().toISOString(),
        })
        .eq('key', 'invoice_defaults')

      return createdInvoices
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all })
    },
  })

  const updateInvoice = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Invoice> & { id: string }) => {
      const { data: result, error } = await (supabase.from('invoices') as any)
        .update(data)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
    },
  })

  const updateLineItem = useMutation({
    mutationFn: async ({ id, ...data }: Partial<InvoiceLineItem> & { id: string }) => {
      const { data: result, error } = await (supabase.from('invoice_line_items') as any)
        .update(data)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      // Recalculate invoice totals
      const { data: invoice } = await (supabase.from('invoices') as any)
        .select('id')
        .eq('id', result.invoice_id)
        .single()

      if (invoice) {
        const { data: items } = await (supabase.from('invoice_line_items') as any)
          .select('amount')
          .eq('invoice_id', invoice.id)

        const subtotal = (items as any[] || []).reduce((sum: number, i: any) => sum + (i.amount || 0), 0)
        await (supabase.from('invoices') as any)
          .update({ subtotal, total_amount: subtotal })
          .eq('id', invoice.id)
      }

      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
    },
  })

  const deleteInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('invoices') as any)
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
    },
  })

  const bulkDeleteInvoices = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await (supabase.from('invoices') as any)
        .delete()
        .in('id', ids)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
    },
  })

  const sendInvoice = useMutation({
    mutationFn: async (invoiceId: string) => {
      // Fetch full invoice data for webhook
      const { data: invoice, error } = await (supabase.from('invoices') as any)
        .select(`
          *,
          family:families(id, display_name, primary_email, primary_contact_name, primary_phone),
          line_items:invoice_line_items(description, amount)
        `)
        .eq('id', invoiceId)
        .single()

      if (error) throw error
      if (!invoice.family?.primary_email) {
        throw new Error('Family has no email address')
      }

      const invoiceUrl = `${window.location.origin}/invoice/${invoice.public_id}`

      // Send via n8n webhook
      await fetch('https://eatonacademic.app.n8n.cloud/webhook/invoice-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          public_id: invoice.public_id,
          invoice_url: invoiceUrl,
          family: {
            id: invoice.family.id,
            name: invoice.family.display_name,
            email: invoice.family.primary_email,
            contact_name: invoice.family.primary_contact_name,
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
          line_items: invoice.line_items,
        }),
      })

      // Update invoice status
      const { error: updateError } = await (supabase.from('invoices') as any)
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          sent_to: invoice.family.primary_email,
        })
        .eq('id', invoiceId)

      if (updateError) throw updateError

      return invoice
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
    },
  })

  const bulkSendInvoices = useMutation({
    mutationFn: async (invoiceIds: string[]) => {
      const results = []
      for (const id of invoiceIds) {
        try {
          await sendInvoice.mutateAsync(id)
          results.push({ id, success: true })
        } catch (error) {
          results.push({ id, success: false, error })
        }
      }
      return results
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
    },
  })

  return {
    generateDrafts,
    updateInvoice,
    updateLineItem,
    deleteInvoice,
    bulkDeleteInvoices,
    sendInvoice,
    bulkSendInvoices,
  }
}

// =============================================================================
// INVOICE HELPER FUNCTIONS
// =============================================================================

function extractServiceCodeFromDescription(description: string): string | null {
  const lower = description.toLowerCase()
  if (lower.includes('academic coaching')) return 'academic_coaching'
  if (lower.includes('learning pod')) return 'learning_pod'
  if (lower.includes('consulting')) {
    return lower.includes('teacher') ? 'consulting_with_teacher' : 'consulting_only'
  }
  if (lower.includes('hub')) return 'eaton_hub'
  if (lower.includes('online')) return 'eaton_online'
  if (lower.includes('elective')) return 'elective_classes'
  return null
}

function calculateEnrollmentAmount(
  enrollment: BillableEnrollment,
  _invoiceType: 'weekly' | 'monthly'
): number {
  const service = enrollment.service
  const billingFreq = service?.billing_frequency

  // Special case: Academic Coaching always uses hours × rate
  // (even if billing_frequency changes, this service is hour-based)
  if (service?.code === 'academic_coaching') {
    return (enrollment.hours_per_week || 0) * (enrollment.hourly_rate_customer || 0)
  }

  // Special case: Hub is per-session (tracked via hub_sessions table)
  if (service?.code === 'eaton_hub' || billingFreq === 'per_session') {
    return enrollment.daily_rate || 100
  }

  // Use billing frequency to determine which rate field to use
  // This allows changing a service from weekly to monthly without code changes
  if (billingFreq === 'weekly') {
    return enrollment.weekly_tuition || 0
  } else {
    // monthly, bi_monthly, annual, one_time all use monthly_rate
    return enrollment.monthly_rate || 0
  }
}

function buildLineItemDescription(
  enrollment: BillableEnrollment,
  _invoiceType: 'weekly' | 'monthly'
): string {
  const studentName = enrollment.student?.full_name || 'Unknown Student'
  const serviceName = enrollment.service?.name || 'Service'
  const serviceCode = enrollment.service?.code
  const billingFreq = enrollment.service?.billing_frequency

  // Academic Coaching always shows hours × rate breakdown
  if (serviceCode === 'academic_coaching') {
    const hours = enrollment.hours_per_week || 0
    const rate = enrollment.hourly_rate_customer || 0
    return `${studentName} - ${serviceName}: ${hours} hrs × $${rate.toFixed(2)}`
  }

  // Weekly billed services show weekly rate
  if (billingFreq === 'weekly') {
    const weeklyRate = enrollment.weekly_tuition || 0
    return `${studentName} - ${serviceName}: $${weeklyRate.toFixed(2)}/week`
  }

  // Everything else (monthly, etc.) just shows service name
  return `${studentName} - ${serviceName}`
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
  
  // Friday of this week
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)
  
  return { start: monday, end: friday }
}

export function getNextMonday(date: Date = new Date()): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? 1 : 8 - day
  d.setDate(d.getDate() + diff)
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