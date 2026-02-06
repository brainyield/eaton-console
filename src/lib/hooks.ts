import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import { queryKeys } from './queryClient'
import { searchGmail, getGmailThread, sendGmail } from './gmail'
import { getTodayString, parseLocalDate } from './dateUtils'
import { addMoney, centsToDollars, multiplyMoney, sumMoney } from './moneyUtils'
import { formatNameLastFirst } from './utils'
import type { GmailSearchParams } from '../types/gmail'

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type CustomerStatus = 'lead' | 'trial' | 'active' | 'paused' | 'churned'
export type EnrollmentStatus = 'trial' | 'active' | 'paused' | 'ended'
export type EmployeeStatus = 'active' | 'reserve' | 'inactive'
export type BillingFrequency = 'per_session' | 'weekly' | 'monthly' | 'bi_monthly' | 'annual' | 'one_time'
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'void'

// Insert types - required fields only, for use with mutations
export type FamilyInsert = Pick<Family, 'display_name'> & Partial<Omit<Family, 'id' | 'display_name' | 'created_at'>>
export type StudentInsert = Pick<Student, 'full_name' | 'family_id'> & Partial<Omit<Student, 'id' | 'full_name' | 'family_id' | 'created_at'>>
export type EnrollmentInsert = Pick<Enrollment, 'family_id' | 'service_id' | 'status'> & Partial<Omit<Enrollment, 'id' | 'family_id' | 'service_id' | 'status' | 'created_at'>>
export type TeacherInsert = Pick<Teacher, 'display_name'> & Partial<Omit<Teacher, 'id' | 'display_name' | 'created_at'>>

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

export interface Location {
  id: string
  code: string
  name: string
  address_line1: string | null
  city: string | null
  state: string | null
  zip: string | null
  phone: string | null
  is_active: boolean
  created_at: string
}

export interface Enrollment {
  id: string
  family_id: string
  student_id: string | null
  service_id: string
  location_id: string | null
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
// SMS TYPES
// =============================================================================

export type SmsStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'undelivered'
export type SmsMessageType = 'invoice_reminder' | 'event_reminder' | 'announcement' | 'custom' | 'bulk'

export interface SmsMessage {
  id: string
  family_id: string | null
  invoice_id: string | null
  sent_by: string | null
  to_phone: string
  from_phone: string
  message_body: string
  message_type: SmsMessageType
  status: SmsStatus
  twilio_sid: string | null
  error_code: string | null
  error_message: string | null
  template_key: string | null
  merge_data: unknown
  campaign_name: string | null
  sent_at: string | null
  delivered_at: string | null
  failed_at: string | null
  created_at: string
  updated_at: string
  // Joined fields
  family?: { display_name: string; primary_email: string | null }
}

export interface SmsMessageFilters {
  familyId?: string
  invoiceId?: string
  status?: SmsStatus
  messageType?: SmsMessageType
  dateFrom?: string
  dateTo?: string
  limit?: number
}

export interface SmsMedia {
  id: string
  sms_message_id: string
  storage_path: string
  public_url: string
  content_type: string | null
  file_size: number | null
  name: string | null
  created_at: string
}

export type SmsMessageInsert = Pick<SmsMessage, 'to_phone' | 'message_body' | 'message_type'> &
  Partial<Omit<SmsMessage, 'id' | 'to_phone' | 'message_body' | 'message_type' | 'created_at' | 'updated_at'>>

// Enrollment Onboarding - tracking forms and documents sent to families
export type OnboardingItemType = 'form' | 'document'
export type OnboardingItemStatus = 'pending' | 'sent' | 'completed'

export interface EnrollmentOnboarding {
  id: string
  enrollment_id: string
  item_type: OnboardingItemType
  item_key: string
  item_name: string
  form_url: string | null
  form_id: string | null
  document_url: string | null
  document_id: string | null
  merge_data: Record<string, unknown> | null
  status: OnboardingItemStatus
  sent_at: string | null
  sent_to: string | null
  reminder_count: number
  last_reminder_at: string | null
  completed_at: string | null
  workflow_execution_id: string | null
  created_at: string
  updated_at: string
}

// Service onboarding configuration - which forms/documents each service requires
export interface OnboardingItemConfig {
  key: string
  name: string
  formId?: string      // For Google Forms
  templateId?: string  // For Google Docs
}

export interface ServiceOnboardingConfig {
  forms: OnboardingItemConfig[]
  documents: OnboardingItemConfig[]
  mergeFields: string[]  // Fields needed for document merge
}

// Configuration mapping service codes to their onboarding requirements
// Service codes must match the 'code' column in the services table
export const SERVICE_ONBOARDING_CONFIG: Record<string, ServiceOnboardingConfig> = {
  learning_pod: {
    forms: [
      { key: 'lp_tos', name: 'Learning Pod Terms of Service Agreement', formId: '1Ayv9FEbeRsTI_gsMf8UWfQz13vFP5ZdoYeKSwZ4lv48' },
      { key: 'lp_enrollment', name: 'Learning Pod Enrollment Form', formId: '1IMbBq8aCNVnm6vdgiX-BQepAJG2iR5BPjJHWbuLlU8' },
      { key: 'lp_allergy', name: 'Learning Pod Allergy Notification Form', formId: '1vbfQKgbpWLV1MgLL5myzHWM62DfkQrMJyPfq1LX3sTI' },
      { key: 'lp_photo', name: 'Learning Pod Student Photo/Video Release', formId: '1Xe-LSy_fK8NepAXFjyPT0t4yYZmSAi53KeIKFG_BfMg' },
    ],
    documents: [],
    mergeFields: [],
  },
  consulting: {
    forms: [
      { key: 'hc_questionnaire', name: 'Homeschool Consulting Questionnaire', formId: '19m98i8Ax86VwRXg3ydgqTaUe751Or69Nfrabx3fv0J0' },
    ],
    documents: [
      { key: 'hc_agreement', name: 'Homeschool Consultation Agreement', templateId: '1rf816Hln05S55_zXonHmiMy13K_xkuJl3DUsB6ucIqI' },
    ],
    mergeFields: ['annual_fee', 'monthly_fee'],
  },
  academic_coaching: {
    forms: [],
    documents: [
      { key: 'ac_agreement', name: 'Academic Coach Hours Agreement', templateId: '1AAiZqXYOBcBcE7izmOdpKaBYXfO1WzgfAiio91LwgNo' },
    ],
    mergeFields: ['hourly_rate', 'hours_per_week'],
  },
  eaton_online: {
    forms: [],
    documents: [
      { key: 'eo_tos', name: 'Eaton Online Terms of Service', templateId: '1i_izsqCuNITYF5of4kHqQmaPr7g7MNiMhdTNPc4vu3o' },
    ],
    mergeFields: ['eo_program', 'eo_weekly_rate'],
  },
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

export function useFamilies(filters?: { status?: CustomerStatus | 'all'; search?: string; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.families.list(filters),
    queryFn: async () => {
      let query = supabase
        .from('families')
        .select('*')
        .order('display_name')
        .limit(filters?.limit ?? 500) // Default limit to prevent unbounded fetching

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
    mutationFn: async (data: FamilyInsert) => {
      const { data: family, error } = await supabase.from('families')
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
      const { data: family, error } = await supabase.from('families')
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
      // Invalidate dashboard stats when family status changes affect counts
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() })
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
    mutationFn: async (data: StudentInsert) => {
      // Check for duplicate student name within the same family
      // Normalize both input and existing names to "Last, First" format for comparison
      // This catches duplicates like "Celine Orellana" vs "Orellana, Celine"
      const { data: existingStudents, error: checkError } = await supabase
        .from('students')
        .select('id, full_name')
        .eq('family_id', data.family_id)

      if (checkError) throw checkError

      // Normalize the input name to "Last, First" format for comparison
      const inputNormalized = formatNameLastFirst(data.full_name).trim().toLowerCase()

      const duplicate = existingStudents?.find(s => {
        // Normalize existing student names the same way
        const existingNormalized = formatNameLastFirst(s.full_name).trim().toLowerCase()
        return existingNormalized === inputNormalized
      })

      if (duplicate) {
        throw new Error(`A student named "${duplicate.full_name}" already exists in this family. Please use a different name or edit the existing student.`)
      }

      const { data: student, error } = await supabase.from('students')
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
      const { data: student, error } = await supabase.from('students')
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
      const { data: enrollments, error: checkError } = await supabase
        .from('enrollments')
        .select('id, status')
        .eq('student_id', id)

      if (checkError) throw checkError

      if (enrollments && enrollments.length > 0) {
        const activeCount = enrollments.filter(e => e.status === 'active' || e.status === 'trial').length
        const endedCount = enrollments.filter(e => e.status === 'ended' || e.status === 'paused').length
        
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
      const { data: activeEnrollments, error: checkError } = await supabase
        .from('enrollments')
        .select('id')
        .eq('student_id', id)
        .in('status', ['active', 'trial'])
      
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

export function useTeachers(filters?: { status?: EmployeeStatus | 'all' }) {
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
    mutationFn: async (data: TeacherInsert) => {
      const { data: teacher, error } = await supabase.from('teachers')
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
      const { data: teacher, error } = await supabase.from('teachers')
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
      const { data: enrollmentAssignments, error: error1 } = await supabase
        .from('teacher_assignments')
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
      const { data: serviceAssignments, error: error2 } = await supabase
        .from('teacher_assignments')
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
export function useTeachersWithLoad(filters?: { status?: EmployeeStatus | 'all' }) {
  const teachersQuery = useTeachers(filters)
  
  return useQuery({
    queryKey: queryKeys.teachers.withLoad(filters),
    queryFn: async (): Promise<TeacherWithLoad[]> => {
      const teachers = teachersQuery.data
      if (!teachers || teachers.length === 0) return []
      
      // Fetch ALL active assignments in one query
      const { data: allEnrollmentAssignments, error: error1 } = await supabase
        .from('teacher_assignments')
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
      
      const { data: allServiceAssignments, error: error2 } = await supabase
        .from('teacher_assignments')
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
// LOCATIONS HOOKS
// =============================================================================

export function useActiveLocations() {
  return useQuery({
    queryKey: queryKeys.locations.active(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      return data as Location[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

// =============================================================================
// ENROLLMENT TYPES
// =============================================================================

export interface EnrollmentWithDetails extends Enrollment {
  student: Student | null
  family: Family
  service: Service
  location: Location | null
  teacher_assignments: (TeacherAssignment & { teacher: Teacher })[]
}

// =============================================================================
// ENROLLMENTS HOOKS
// =============================================================================

export function useEnrollments(filters?: { status?: EnrollmentStatus | 'all'; serviceId?: string; createdFrom?: string; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.enrollments.list(filters),
    queryFn: async () => {
      let query = supabase.from('enrollments')
        .select(`
          *,
          student:students(*),
          family:families(*),
          service:services(*),
          location:locations(*),
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

      if (filters?.createdFrom) {
        query = query.gte('created_at', filters.createdFrom)
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
      const { data, error } = await supabase.from('enrollments')
        .select(`
          *,
          student:students(*),
          service:services(*),
          location:locations(*),
          teacher_assignments(
            *,
            teacher:teachers(*)
          )
        `)
        .eq('family_id', familyId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as unknown as EnrollmentWithDetails[]
    },
    enabled: !!familyId,
  })
}

export function useEnrollment(id: string) {
  return useQuery({
    queryKey: queryKeys.enrollments.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('enrollments')
        .select(`
          *,
          student:students(*),
          family:families(*),
          service:services(*),
          location:locations(*),
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
    mutationFn: async (data: EnrollmentInsert & { teacher_id?: string; hourly_rate_teacher?: number }) => {
      const { teacher_id, hourly_rate_teacher, ...enrollmentData } = data

      // Create enrollment
      const { data: enrollment, error } = await supabase.from('enrollments')
        .insert(enrollmentData)
        .select()
        .single()
      if (error) throw error

      // Create teacher assignment if provided
      if (teacher_id) {
        const { error: assignError } = await supabase.from('teacher_assignments')
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
      // Invalidate reports - enrollments by service chart
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.enrollments() })
    },
  })

  const updateEnrollment = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Enrollment> }) => {
      const { data: enrollment, error } = await supabase.from('enrollments')
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return enrollment
    },
    onSuccess: (enrollment, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() })
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.detail(variables.id) })
      // Invalidate family/student-scoped enrollment queries
      if (enrollment.family_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.byFamily(enrollment.family_id) })
      }
      if (enrollment.student_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.byStudent(enrollment.student_id) })
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.billable() })
      // Invalidate reports - enrollments by service chart
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.enrollments() })
    },
  })

  const deleteEnrollment = useMutation({
    mutationFn: async (id: string) => {
      // Fetch the enrollment first to get family_id and student_id for invalidation
      const { data: enrollment, error: fetchError } = await supabase.from('enrollments')
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
      // Invalidate reports - enrollments by service chart
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.enrollments() })
    },
  })

  return { createEnrollment, updateEnrollment, deleteEnrollment }
}

// =============================================================================
// ENROLLMENT ONBOARDING HOOKS
// =============================================================================

/**
 * Fetch all onboarding items for an enrollment
 */
export function useEnrollmentOnboarding(enrollmentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.enrollments.onboarding(enrollmentId || ''),
    queryFn: async () => {
      if (!enrollmentId) return []
      const { data, error } = await supabase
        .from('enrollment_onboarding')
        .select('*')
        .eq('enrollment_id', enrollmentId)
        .order('item_type', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as EnrollmentOnboarding[]
    },
    enabled: !!enrollmentId,
  })
}

/**
 * Mutations for enrollment onboarding (send forms, update status, etc.)
 */
export function useOnboardingMutations() {
  const queryClient = useQueryClient()

  // Send onboarding forms/documents via the edge function
  const sendOnboarding = useMutation({
    mutationFn: async ({
      enrollmentId,
      itemKeys,
      mergeData,
    }: {
      enrollmentId: string
      itemKeys: string[]
      mergeData?: Record<string, unknown>
    }) => {
      const { data, error } = await supabase.functions.invoke('send-onboarding', {
        body: {
          enrollment_id: enrollmentId,
          item_keys: itemKeys,
          merge_data: mergeData,
        },
      })
      if (error) throw error
      return data as { success: boolean; items: EnrollmentOnboarding[]; warnings?: string[] }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.enrollments.onboarding(variables.enrollmentId),
      })
    },
  })

  // Manually refresh onboarding status (check form responses)
  const refreshOnboardingStatus = useMutation({
    mutationFn: async ({ enrollmentId }: { enrollmentId: string }) => {
      const { data, error } = await supabase.functions.invoke('check-onboarding-status', {
        body: { enrollment_id: enrollmentId },
      })
      if (error) throw error
      return data as { success: boolean; updated: number }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.enrollments.onboarding(variables.enrollmentId),
      })
    },
  })

  // Update a single onboarding item (for manual status changes)
  const updateOnboardingItem = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string
      updates: {
        status?: OnboardingItemStatus
        completed_at?: string | null
        sent_at?: string | null
        sent_to?: string | null
        reminder_count?: number
        last_reminder_at?: string | null
      }
    }) => {
      const { data: item, error } = await supabase
        .from('enrollment_onboarding')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return item as EnrollmentOnboarding
    },
    onSuccess: (item) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.enrollments.onboarding(item.enrollment_id),
      })
    },
  })

  return { sendOnboarding, refreshOnboardingStatus, updateOnboardingItem }
}

// =============================================================================
// TEACHER ASSIGNMENTS HOOKS
// =============================================================================

export function useTeacherAssignmentsByEnrollment(enrollmentId: string) {
  return useQuery({
    queryKey: queryKeys.teacherAssignments.byEnrollment(enrollmentId),
    queryFn: async () => {
      const { data, error } = await supabase.from('teacher_assignments')
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
      const { data, error } = await supabase.from('teacher_assignments')
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
      return data as unknown as (TeacherAssignment & { enrollment: EnrollmentWithDetails })[]
    },
    enabled: options?.enabled !== undefined ? options.enabled && !!teacherId : !!teacherId,
  })
}

export function useTeacherAssignmentMutations() {
  const queryClient = useQueryClient()

  const createAssignment = useMutation({
    mutationFn: async (data: Partial<TeacherAssignment>) => {
      const { data: assignment, error } = await supabase.from('teacher_assignments')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert(data as any)
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
      const { data: assignment, error } = await supabase.from('teacher_assignments')
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
        await supabase.from('teacher_assignments')
          .update({ is_active: false, end_date: today })
          .eq('enrollment_id', enrollmentId)
          .eq('teacher_id', oldTeacherId)
          .eq('is_active', true)
      }

      // Create new assignment
      const { data, error } = await supabase.from('teacher_assignments')
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

      const { error } = await supabase.from('teacher_assignments')
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
      const { error } = await supabase.from('teacher_assignments')
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
      const { data, error } = await supabase.from('teacher_payments')
        .select(`
          *,
          line_items:teacher_payment_line_items(*)
        `)
        .eq('teacher_id', teacherId)
        .order('pay_date', { ascending: false })

      if (error) throw error
      return data as (TeacherPayment & { line_items: unknown[] })[]
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
      const { data: payment, error } = await supabase.from('teacher_payments')
        .insert(cleanedPaymentData)
        .select()
        .single()
      if (error) throw error

      // Create line items
      if (line_items.length > 0) {
        const { error: itemsError } = await supabase.from('teacher_payment_line_items')
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
      // Invalidate reports - Teacher Payroll metric and payroll-by-month chart
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
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

export function useInvoices(filters?: { status?: InvoiceStatus | InvoiceStatus[] | 'all'; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.invoices.list(filters),
    queryFn: async () => {
      let query = supabase.from('invoices')
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
      const { data, error } = await supabase.from('invoices')
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
      let query = supabase.from('invoices')
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          query = query.in('status', filters.status as any)
        } else if (filters.status !== 'all') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          query = query.eq('status', filters.status as any)
        }
      }

      const { data, error } = await query
      if (error) throw error

      // Extract service codes from line items (only from enrollment relationships)
      return (data || []).map(inv => {
        const serviceCodes = new Set<string>()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inv.line_items?.forEach((li: any) => {
          const code = li.enrollment?.service?.code
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
      let query = supabase.from('enrollments')
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
      const { data, error } = await supabase.from('invoices')
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
      return (data || []).map(order => ({
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
      return (data || []).map(order => ({
        id: order.id,
        family_id: order.family_id,
        total_cents: order.total_cents,
        event_title: order.event?.title || 'Unknown Class',
      })) as PendingClassRegistrationFee[]
    },
  })
}

// Type for pending hub sessions (from Calendly bookings)
export interface PendingHubSession {
  id: string
  student_name: string
  family_id: string | null
  family_name: string
  session_date: string
  daily_rate: number
  invitee_email: string
}

// Default Hub daily rate
const DEFAULT_HUB_DAILY_RATE = 100

// Hook to fetch pending Hub drop-off bookings from Calendly
export function usePendingHubSessions() {
  return useQuery({
    queryKey: queryKeys.hubSessions.pending(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendly_bookings')
        .select(`
          id,
          scheduled_at,
          student_name,
          invitee_name,
          invitee_email,
          family_id,
          family:families(
            display_name
          )
        `)
        .eq('event_type', 'hub_dropoff')
        .eq('status', 'scheduled')
        .is('hub_session_id', null)
        .gte('scheduled_at', getTodayString())
        .order('scheduled_at', { ascending: true })

      if (error) throw error

      // Transform to flat structure
      return (data || []).map(booking => ({
        id: booking.id,
        student_name: booking.student_name || booking.invitee_name || 'Unknown Student',
        family_id: booking.family_id,
        family_name: booking.family?.display_name || booking.invitee_name || 'Unknown Family',
        session_date: booking.scheduled_at.split('T')[0],
        daily_rate: DEFAULT_HUB_DAILY_RATE,
        invitee_email: booking.invitee_email,
      })) as PendingHubSession[]
    },
  })
}

// Hook to link unlinked hub bookings to a family (similar to useEventOrderMutations)
export function useHubBookingMutations() {
  const queryClient = useQueryClient()

  const linkBookingsToFamily = useMutation({
    mutationFn: async ({
      bookingIds,
      familyId,
    }: {
      bookingIds: string[]
      familyId: string
    }) => {
      const { error } = await supabase.from('calendly_bookings')
        .update({ family_id: familyId })
        .in('id', bookingIds)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hubSessions.pending() })
      queryClient.invalidateQueries({ queryKey: queryKeys.families.all })
    },
  })

  return { linkBookingsToFamily }
}

// Hook to link unlinked event orders to a family (create family or link to existing)
export function useEventOrderMutations() {
  const queryClient = useQueryClient()

  const linkOrdersToFamily = useMutation({
    mutationFn: async ({
      orderIds,
      familyId,
    }: {
      orderIds: string[]
      familyId: string
    }) => {
      const { error } = await supabase.from('event_orders')
        .update({ family_id: familyId })
        .in('id', orderIds)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.eventOrders.pending() })
      queryClient.invalidateQueries({ queryKey: queryKeys.families.all })
    },
  })

  return { linkOrdersToFamily }
}

// Hook to fetch email history for an invoice
export function useInvoiceEmails(invoiceId: string) {
  return useQuery({
    queryKey: queryKeys.invoiceEmails.byInvoice(invoiceId),
    queryFn: async () => {
      const { data, error } = await supabase.from('invoice_emails')
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
      const { data, error } = await supabase.from('payments')
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
      const { data: invoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('id, invoice_number')
        .eq('family_id', familyId)

      if (invoicesError) throw invoicesError
      if (!invoices || invoices.length === 0) return []

      const invoiceIds = (invoices as { id: string; invoice_number: string }[]).map(inv => inv.id)
      const invoiceMap = new Map((invoices as { id: string; invoice_number: string }[]).map(inv => [inv.id, inv.invoice_number]))

      // Then get all emails for those invoices
      const { data: emails, error: emailsError } = await supabase.from('invoice_emails')
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
      const warnings: string[] = []

      for (const [familyId, group] of Object.entries(byFamily)) {
        try {
        // Create invoice
        const { data: invoice, error: invError } = await supabase.from('invoices')
          .insert({
            family_id: familyId,
            invoice_date: getTodayString(),
            due_date: dueDate,
            period_start: periodStart,
            period_end: periodEnd,
            status: 'draft',
            notes: null,
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
              for (const order of pendingOrders) {
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(lineItems as any[]).push({
            invoice_id: invoice.id,
            enrollment_id: null, // Registration fees don't link to enrollments
            description: `${regFee.student_name} - Registration Fee: ${regFee.event_title}`,
            quantity: 1,
            unit_price: amount,
            amount,
            sort_order: sortOrder++,
          })
        }

        const { error: itemsError } = await supabase.from('invoice_line_items')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .insert(lineItems as any)

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
        const { error: updateError } = await supabase.from('invoices')
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
          const { error: linkError } = await supabase.from('event_orders')
            .update({ invoice_id: invoice.id })
            .in('id', orderIds)

          if (linkError) {
            warnings.push(`Invoice for ${group.family?.display_name || 'Unknown'} created but failed to link registration fees: ${linkError.message}`)
          }
        }

        createdInvoices.push(invoice as unknown as Invoice)
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
        const error = new Error(`Generated ${createdInvoices.length} invoices, but ${failedFamilies.length} failed: ${failedFamilies.map(f => f.familyName).join(', ')}`) as Error & { createdInvoices?: Invoice[]; warnings?: string[] }
        // Attach the created invoices to the error so they can still be used
        error.createdInvoices = createdInvoices
        error.warnings = warnings
        throw error
      }

      return { invoices: createdInvoices, warnings }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
      // Invalidate families to update balance in Directory
      queryClient.invalidateQueries({ queryKey: queryKeys.families.all })
      // Invalidate dashboard stats so outstanding balance updates
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() })
    },
  })

  // Generate invoice for Step Up event orders
  const generateEventInvoice = useMutation({
    mutationFn: async ({
      familyId,
      familyName: _familyName,
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
      const { data: invoice, error: invError } = await supabase.from('invoices')
        .insert({
          family_id: familyId,
          invoice_date: getTodayString(),
          due_date: dueDate,
          status: 'draft',
          notes: null,
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

      const { error: itemsError } = await supabase.from('invoice_line_items')
        .insert(lineItems)

      if (itemsError) throw itemsError

      // Update invoice totals
      const { error: updateError } = await supabase.from('invoices')
        .update({
          subtotal,
          total_amount: subtotal,
        })
        .eq('id', invoice.id)

      if (updateError) throw updateError

      // Link event_orders to this invoice
      const { error: linkError } = await supabase.from('event_orders')
        .update({ invoice_id: invoice.id })
        .in('id', orderIds)

      if (linkError) throw linkError

      return invoice
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.eventOrders.pending() })
      // Invalidate families to update balance in Directory
      queryClient.invalidateQueries({ queryKey: queryKeys.families.all })
      // Invalidate dashboard stats so outstanding balance updates
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() })
    },
  })

  // Generate invoice for Hub sessions (from Calendly bookings)
  const generateHubInvoice = useMutation({
    mutationFn: async ({
      familyId,
      bookings,
      dueDate,
    }: {
      familyId: string
      bookings: { id: string; student_name: string; session_date: string; daily_rate: number }[]
      dueDate: string
    }) => {
      // Create invoice
      const { data: invoice, error: invError } = await supabase.from('invoices')
        .insert({
          family_id: familyId,
          invoice_date: getTodayString(),
          due_date: dueDate,
          status: 'draft',
          notes: null,
        })
        .select()
        .single()

      if (invError) throw invError

      // Create line items for each booking
      let subtotal = 0
      const lineItemsToInsert = bookings.map((booking, idx) => {
        subtotal = addMoney(subtotal, booking.daily_rate)

        // Format session date
        const sessionDate = new Date(booking.session_date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })

        return {
          invoice_id: invoice.id,
          enrollment_id: null as string | null,
          description: `${booking.student_name} - Eaton Hub (${sessionDate})`,
          quantity: 1,
          unit_price: booking.daily_rate,
          amount: booking.daily_rate,
          sort_order: idx,
        }
      })

      const { error: itemsError } = await supabase.from('invoice_line_items')
        .insert(lineItemsToInsert)

      if (itemsError) throw itemsError

      // Update invoice totals
      const { error: updateError } = await supabase.from('invoices')
        .update({
          subtotal,
          total_amount: subtotal,
        })
        .eq('id', invoice.id)

      if (updateError) throw updateError

      const warnings: string[] = []

      // Link calendly_bookings to this invoice and mark as completed
      // This allows syncing payment status when invoice is paid
      const bookingIds = bookings.map(b => b.id)
      const { error: linkError } = await supabase.from('calendly_bookings')
        .update({ status: 'completed', invoice_id: invoice.id })
        .in('id', bookingIds)

      if (linkError) {
        warnings.push('Invoice created but failed to link Hub session bookings: ' + linkError.message)
      }

      return { data: invoice, warnings }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.hubSessions.pending() })
      // Invalidate families to update balance in Directory
      queryClient.invalidateQueries({ queryKey: queryKeys.families.all })
      // Invalidate dashboard stats so outstanding balance updates
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() })
    },
  })

  const updateInvoice = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Invoice> }): Promise<{ data: Invoice; warnings: string[] }> => {
      const warnings: string[] = []
      const { data: invoice, error } = await supabase.from('invoices')
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error

      // Sync event_orders when invoice is marked as paid
      // This updates Step Up event registrations linked to this invoice
      if (data.status === 'paid') {
        const { error: syncError } = await supabase.from('event_orders')
          .update({
            payment_status: 'paid',
            paid_at: new Date().toISOString(),
          })
          .eq('invoice_id', id)

        if (syncError) {
          console.error('Failed to sync event_orders payment status:', syncError)
          warnings.push(`Invoice updated but failed to sync event orders: ${syncError.message}`)
        }

        // Note: calendly_bookings (Hub) are linked via invoice_id for reporting,
        // but their status stays 'completed'. The invoice is the source of truth for payment.
      }

      return { data: invoice as Invoice, warnings }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.eventOrders.pending() })
      // Invalidate families to update balance in Directory
      queryClient.invalidateQueries({ queryKey: queryKeys.families.all })
      // Invalidate dashboard stats so outstanding balance updates when invoices are sent
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() })
      // Invalidate reports - balance aging and revenue charts
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.balances() })
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
    },
    // Suppress global error toast - callers handle errors explicitly
    onError: (error) => {
      console.error('Invoice update failed:', error)
    },
  })

  const updateLineItem = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InvoiceLineItem> }) => {
      const { data: lineItem, error } = await supabase.from('invoice_line_items')
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
    // Suppress global error toast - callers handle errors explicitly
    onError: (error) => {
      console.error('Line item update failed:', error)
    },
  })

  const createLineItem = useMutation({
    mutationFn: async ({ invoiceId, data }: {
      invoiceId: string
      data: {
        description: string
        quantity: number
        unit_price: number
        amount: number
        enrollment_id?: string | null
        teacher_cost?: number | null
        profit?: number | null
        sort_order?: number
      }
    }) => {
      const { data: lineItem, error } = await supabase.from('invoice_line_items')
        .insert({
          ...data,
          invoice_id: invoiceId,
          enrollment_id: data.enrollment_id ?? null,
          teacher_cost: data.teacher_cost ?? null,
          profit: data.profit ?? null,
          sort_order: data.sort_order ?? 0,
        })
        .select()
        .single()
      if (error) throw error
      return lineItem
    },
    onSuccess: (lineItem) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
      if (lineItem.invoice_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(lineItem.invoice_id) })
      }
    },
    // Suppress global error toast - callers handle errors explicitly
    onError: (error) => {
      console.error('Line item creation failed:', error)
    },
  })

  const deleteLineItem = useMutation({
    mutationFn: async ({ id, invoiceId }: { id: string; invoiceId: string }) => {
      const { error } = await supabase.from('invoice_line_items').delete().eq('id', id)
      if (error) throw error
      return { id, invoiceId }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(variables.invoiceId) })
    },
    // Suppress global error toast - callers handle errors explicitly
    onError: (error) => {
      console.error('Line item deletion failed:', error)
    },
  })

  const deleteInvoice = useMutation({
    mutationFn: async (id: string) => {
      // Unlink any event_orders referencing this invoice first
      const { error: unlinkError } = await supabase.from('event_orders')
        .update({ invoice_id: null, payment_status: 'stepup_pending' })
        .eq('invoice_id', id)

      if (unlinkError) {
        throw new Error(`Failed to unlink event orders: ${unlinkError.message}`)
      }

      const { error } = await supabase.from('invoices').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.eventOrders.pending() })
      // Invalidate families to update balance in Directory
      queryClient.invalidateQueries({ queryKey: queryKeys.families.all })
      // Invalidate dashboard stats so outstanding balance updates
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() })
      // Invalidate reports - balance aging chart
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.balances() })
    },
  })

  const bulkDeleteInvoices = useMutation({
    mutationFn: async (ids: string[]) => {
      // Unlink any event_orders referencing these invoices first
      const { error: unlinkError } = await supabase.from('event_orders')
        .update({ invoice_id: null, payment_status: 'stepup_pending' })
        .in('invoice_id', ids)

      if (unlinkError) {
        throw new Error(`Failed to unlink event orders: ${unlinkError.message}`)
      }

      const { error } = await supabase.from('invoices').delete().in('id', ids)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.eventOrders.pending() })
      // Invalidate families to update balance in Directory
      queryClient.invalidateQueries({ queryKey: queryKeys.families.all })
      // Invalidate dashboard stats so outstanding balance updates
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() })
      // Invalidate reports - balance aging chart
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.balances() })
    },
  })

  const voidInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { data: invoice, error } = await supabase.from('invoices')
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
      // Invalidate families to update balance in Directory
      queryClient.invalidateQueries({ queryKey: queryKeys.families.all })
      // Invalidate dashboard stats so outstanding balance updates
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() })
      // Invalidate reports - balance aging chart
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.balances() })
    },
  })

  const bulkVoidInvoices = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('invoices')
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
      // Invalidate families to update balance in Directory
      queryClient.invalidateQueries({ queryKey: queryKeys.families.all })
      // Invalidate dashboard stats so outstanding balance updates
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() })
      // Invalidate reports - balance aging chart
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.balances() })
    },
  })

  // Consolidate multiple outstanding invoices for the same family into a single draft
  const consolidateInvoices = useMutation({
    mutationFn: async (invoiceIds: string[]): Promise<{ invoiceId: string; warnings: string[] }> => {
      const warnings: string[] = []

      if (invoiceIds.length < 2) {
        throw new Error('Must select at least 2 invoices to consolidate')
      }

      // Fetch all invoices with line items and payments
      const { data: invoices, error: fetchError } = await supabase
        .from('invoices')
        .select(`
          *,
          line_items:invoice_line_items(*),
          payments:payments(*)
        `)
        .in('id', invoiceIds)

      if (fetchError) throw fetchError
      if (!invoices || invoices.length < 2) {
        throw new Error('Could not fetch selected invoices')
      }

      // Validate all same family
      const familyIds = new Set(invoices.map(inv => inv.family_id))
      if (familyIds.size > 1) {
        throw new Error('All selected invoices must belong to the same family')
      }

      // Validate all outstanding
      const nonOutstanding = invoices.filter(inv =>
        !['sent', 'partial', 'overdue'].includes(inv.status)
      )
      if (nonOutstanding.length > 0) {
        throw new Error(`Cannot consolidate invoices with status: ${nonOutstanding.map(i => i.status).join(', ')}`)
      }

      const familyId = invoices[0].family_id

      // Calculate period span (earliest start, latest end)
      const periodStarts = invoices.map(i => i.period_start).filter(Boolean) as string[]
      const periodEnds = invoices.map(i => i.period_end).filter(Boolean) as string[]
      const periodStart = periodStarts.length > 0
        ? periodStarts.sort()[0]
        : null
      const periodEnd = periodEnds.length > 0
        ? periodEnds.sort()[periodEnds.length - 1]
        : null

      // Use EARLIEST due date so reminder urgency reflects the oldest debt
      const dueDates = invoices.map(i => i.due_date).filter(Boolean) as string[]
      const dueDate = dueDates.length > 0
        ? dueDates.sort()[0]
        : null

      // Generate consolidation note
      const invoiceNumbers = invoices
        .map(inv => inv.invoice_number || `ID:${inv.public_id}`)
        .sort()
        .join(', ')
      const consolidationNote = `Consolidated from: ${invoiceNumbers}`

      // Create new consolidated invoice (draft)
      const { data: newInvoice, error: createError } = await supabase
        .from('invoices')
        .insert({
          family_id: familyId,
          invoice_date: getTodayString(),
          due_date: dueDate,
          period_start: periodStart,
          period_end: periodEnd,
          status: 'draft' as const,
          notes: consolidationNote,
        })
        .select()
        .single()

      if (createError) throw createError

      // Copy all line items from originals, prepending the source invoice's period
      // so customers can identify which week/month each charge is for
      let sortOrder = 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allLineItems: any[] = []

      // Sort invoices by period_start so line items appear chronologically
      const sortedInvoices = [...invoices].sort((a, b) =>
        (a.period_start || '').localeCompare(b.period_start || '')
      )

      for (const invoice of sortedInvoices) {
        // Build period prefix like "Jan 6-12" or "Jan 6 - Feb 2"
        let periodPrefix = ''
        if (invoice.period_start && invoice.period_end) {
          const s = parseLocalDate(invoice.period_start)
          const e = parseLocalDate(invoice.period_end)
          const sMonth = s.toLocaleDateString('en-US', { month: 'short' })
          const eMonth = e.toLocaleDateString('en-US', { month: 'short' })
          if (sMonth === eMonth) {
            periodPrefix = `${sMonth} ${s.getDate()}-${e.getDate()}: `
          } else {
            periodPrefix = `${sMonth} ${s.getDate()} - ${eMonth} ${e.getDate()}: `
          }
        } else if (invoice.invoice_number) {
          // Fallback: use invoice number if no period dates
          periodPrefix = `${invoice.invoice_number}: `
        }

        const items = invoice.line_items || []
        for (const item of items) {
          allLineItems.push({
            invoice_id: newInvoice.id,
            enrollment_id: item.enrollment_id,
            description: periodPrefix + item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            amount: item.amount,
            teacher_cost: item.teacher_cost,
            profit: item.profit,
            sort_order: sortOrder++,
          })
        }
      }

      if (allLineItems.length === 0) {
        // Clean up the empty invoice
        await supabase.from('invoices').delete().eq('id', newInvoice.id)
        throw new Error('No line items found on selected invoices')
      }

      const { error: lineItemsError } = await supabase
        .from('invoice_line_items')
        .insert(allLineItems)

      if (lineItemsError) {
        await supabase.from('invoices').delete().eq('id', newInvoice.id)
        throw lineItemsError
      }

      // Calculate subtotal from line items
      const subtotal = sumMoney(allLineItems.map((item: { amount: number | null }) => item.amount || 0))

      // Transfer payments from originals to new invoice
      const allPayments = invoices.flatMap(inv => inv.payments || [])
      let totalPaid = 0

      if (allPayments.length > 0) {
        const { error: paymentTransferError } = await supabase
          .from('payments')
          .update({ invoice_id: newInvoice.id })
          .in('id', allPayments.map((p: { id: string }) => p.id))

        if (paymentTransferError) {
          warnings.push('Failed to transfer some payments to the consolidated invoice. Please verify payment records.')
        } else {
          totalPaid = sumMoney(allPayments.map((p: { amount: number }) => p.amount || 0))
        }
      }

      // Warn if payments exceed subtotal (overpayment from legacy data)
      if (totalPaid > subtotal) {
        warnings.push(`Consolidated invoice shows overpayment: $${totalPaid.toFixed(2)} paid on $${subtotal.toFixed(2)} total`)
      }

      // Update invoice totals
      const newStatus = totalPaid > 0 && totalPaid >= subtotal ? 'paid' : totalPaid > 0 ? 'partial' : 'draft'
      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          subtotal,
          total_amount: subtotal,
          amount_paid: totalPaid,
          status: newStatus as InvoiceStatus,
        })
        .eq('id', newInvoice.id)

      if (updateError) throw updateError

      // Void original invoices and reset their amount_paid since payments were transferred
      const { error: voidError } = await supabase
        .from('invoices')
        .update({ status: 'void', amount_paid: 0 })
        .in('id', invoiceIds)

      if (voidError) {
        warnings.push('Consolidated invoice created but failed to void originals. Please void them manually.')
      }

      return { invoiceId: newInvoice.id, warnings }
    },
    onSuccess: (result, invoiceIds) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(result.invoiceId) })
      invoiceIds.forEach(id => {
        queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(id) })
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.families.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() })
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.balances() })
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.invoicePayments.all })
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
    }): Promise<{ data: Invoice; warnings: string[] }> => {
      const warnings: string[] = []

      // First, get the invoice to know the current amounts
      const { data: invoice, error: fetchError } = await supabase.from('invoices')
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
      const { error: paymentError } = await supabase.from('payments')
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
      const { data: updatedInvoice, error: updateError } = await supabase.from('invoices')
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
        const { error: syncError } = await supabase.from('event_orders')
          .update({
            payment_status: 'paid',
            paid_at: new Date().toISOString(),
          })
          .eq('invoice_id', invoiceId)

        if (syncError) {
          console.error('Failed to sync event_orders payment status:', syncError)
          warnings.push(`Payment recorded but failed to sync event orders: ${syncError.message}`)
        }
      }

      return { data: updatedInvoice as Invoice, warnings }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(variables.invoiceId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() })
      queryClient.invalidateQueries({ queryKey: queryKeys.eventOrders.pending() })
      queryClient.invalidateQueries({ queryKey: queryKeys.invoicePayments.byInvoice(variables.invoiceId) })
      // Invalidate families to update balance in Directory
      queryClient.invalidateQueries({ queryKey: queryKeys.families.all })
      // Invalidate all reports - payments affect revenue (via DB trigger), balance aging, and location revenue
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
    },
  })

  // Recalculate invoice balance from payments - fixes corrupted invoices
  const recalculateInvoiceBalance = useMutation({
    mutationFn: async (invoiceId: string) => {
      // Get the invoice
      const { data: invoice, error: invoiceError } = await supabase.from('invoices')
        .select('id, total_amount, status')
        .eq('id', invoiceId)
        .single()

      if (invoiceError) throw invoiceError
      if (!invoice) throw new Error('Invoice not found')

      // Get total of all payments for this invoice
      const { data: payments, error: paymentsError } = await supabase.from('payments')
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
      const { data: updatedInvoice, error: updateError } = await supabase.from('invoices')
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
      // Invalidate families to update balance in Directory
      queryClient.invalidateQueries({ queryKey: queryKeys.families.all })
    },
  })

  const sendInvoice = useMutation({
    mutationFn: async (invoiceId: string) => {
      // First, get the full invoice with family and line items
      const { data: invoice, error: fetchError } = await supabase.from('invoices')
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        line_items: (invoice.line_items || []).map((li: any) => ({
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
      const { error: updateError } = await supabase.from('invoices')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          sent_to: invoice.family.primary_email,
        })
        .eq('id', invoiceId)

      if (updateError) throw updateError

      // Log to invoice_emails
      await supabase.from('invoice_emails').insert({
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
      await supabase.from('invoice_emails').insert({
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
      const { data: invoice, error: invError } = await supabase.from('invoices')
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

        const { error: itemsError } = await supabase.from('invoice_line_items')
          .insert(lineItemsToInsert)

        if (itemsError) throw itemsError
      }

      // 3. Create payment record if there was a payment
      if (payment && payment.amount > 0) {
        const { error: paymentError } = await supabase.from('payments')
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
        await supabase.from('invoice_emails').insert({
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
      // Invalidate families to update balance in Directory
      queryClient.invalidateQueries({ queryKey: queryKeys.families.all })
    },
  })

  return {
    generateDrafts,
    generateEventInvoice,
    generateHubInvoice,
    updateInvoice,
    updateLineItem,
    createLineItem,
    deleteLineItem,
    deleteInvoice,
    bulkDeleteInvoices,
    voidInvoice,
    bulkVoidInvoices,
    consolidateInvoices,
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
      const settings: Record<string, unknown> = {}
      ;(data || []).forEach(s => {
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
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      const { error } = await supabase.from('app_settings')
        .upsert({
          key,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          value: value as any,
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
  const s = parseLocalDate(start)
  const e = parseLocalDate(end)
  
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
    const d = parseLocalDate(dateStr)
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
// Helper to access payroll tables
const payrollDb = supabase

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
 * Fetch payroll line items for a specific teacher from paid payroll runs
 * This is used in TeacherDetailPanel to show bulk payroll history
 */
export interface TeacherPayrollLineItem {
  id: string
  payroll_run_id: string
  period_start: string
  period_end: string
  paid_at: string
  description: string
  actual_hours: number
  hourly_rate: number
  final_amount: number
  service_name: string | null
  student_name: string | null
}

export function usePayrollLineItemsByTeacher(teacherId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.payroll.byTeacher(teacherId),
    queryFn: async () => {
      // Fetch line items from paid payroll runs for this teacher
      const { data, error } = await payrollDb.from('payroll_line_item')
        .select(`
          id,
          payroll_run_id,
          description,
          actual_hours,
          hourly_rate,
          final_amount,
          service:services(name),
          enrollment:enrollments(student:students(full_name)),
          payroll_run:payroll_run!inner(
            period_start,
            period_end,
            paid_at,
            status
          )
        `)
        .eq('teacher_id', teacherId)
        .eq('payroll_run.status', 'paid')
        .order('payroll_run(paid_at)', { ascending: false })

      if (error) throw error

      // Transform the data to flatten the nested structure
      return (data || []).map(item => ({
        id: item.id,
        payroll_run_id: item.payroll_run_id,
        period_start: item.payroll_run?.period_start,
        period_end: item.payroll_run?.period_end,
        paid_at: item.payroll_run?.paid_at,
        description: item.description,
        actual_hours: item.actual_hours,
        hourly_rate: item.hourly_rate,
        final_amount: item.final_amount,
        service_name: item.service?.name || null,
        student_name: item.enrollment?.student?.full_name || null,
      })) as TeacherPayrollLineItem[]
    },
    enabled: options?.enabled !== undefined ? options.enabled && !!teacherId : !!teacherId,
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
    }): Promise<{ data: PayrollRun; warnings: string[] }> => {
      const warnings: string[] = []

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
      const { data: assignments, error: assignError } = await supabase.from('teacher_assignments')
        .select(`
          *,
          teacher:teachers(*),
          service:services(*),
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
        const calculatedAmount = multiplyMoney(hours, rate)

        // Build description
        // For student assignments: "Student Name - Service Name"
        // For service-level assignments: "Service Name" (e.g., "Eaton Hub", "Learning Pod")
        let description = ''
        if (assignment.enrollment?.student?.full_name) {
          description = assignment.enrollment.student.full_name
          const serviceName = assignment.enrollment?.service?.name
          if (serviceName) {
            description += ` - ${serviceName}`
          }
        } else if (assignment.service?.name) {
          // Service-level assignment (no student) - use service name directly
          description = assignment.service.name
        } else {
          description = assignment.teacher?.display_name || 'Unknown'
        }

        lineItems.push({
          payroll_run_id: run.id,
          teacher_id: assignment.teacher_id,
          teacher_assignment_id: assignment.id,
          enrollment_id: assignment.enrollment_id,
          service_id: assignment.enrollment?.service_id || assignment.service_id || null,
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .insert(lineItems as any)

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

        if (adjError) {
          console.error('Failed to link adjustments:', adjError)
          warnings.push(`Failed to link pending adjustments: ${adjError.message}`)
        }

        // Add adjustment amounts to corresponding teacher line items
        for (const adj of pendingAdjustments) {
          // Find existing line items for this teacher
          const teacherItems = lineItems.filter(li => li.teacher_id === adj.teacher_id)
          if (teacherItems.length > 0) {
            // Add adjustment to first line item for this teacher
            const firstItem = teacherItems[0]
            const { error: lineItemAdjError } = await payrollDb.from('payroll_line_item')
              .update({
                adjustment_amount: adj.amount,
                adjustment_note: adj.reason,
                final_amount: (firstItem.calculated_amount || 0) + adj.amount,
              })
              .eq('payroll_run_id', run.id)
              .eq('teacher_id', adj.teacher_id)
              .limit(1)

            if (lineItemAdjError) {
              console.error('Failed to apply adjustment to line item:', lineItemAdjError)
              warnings.push(`Failed to apply adjustment for teacher ${adj.teacher_id}: ${lineItemAdjError.message}`)
            }
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

      if (updateError) {
        console.error('Failed to update run totals:', updateError)
        warnings.push(`Payroll run created but failed to update totals: ${updateError.message}`)
      }

      return { data: run as PayrollRun, warnings }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payroll.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.payroll.pendingAdjustments() })
      // Invalidate reports - payroll by month chart
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
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

      // When status changes to 'paid', invalidate all teacher payroll queries
      // so TeacherDetailPanel's payroll tab updates automatically
      if (variables.status === 'paid') {
        queryClient.invalidateQueries({ queryKey: ['payroll', 'teacher'] })
        // Invalidate reports - payroll by month chart
        queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
      }
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
      const calculatedAmount = multiplyMoney(hours, current.hourly_rate)
      const finalAmount = addMoney(calculatedAmount, adjustment)

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

  /**
   * Bulk update hours for all line items belonging to selected teachers
   * Sets all their line items to the specified hours value (including 0)
   */
  const bulkUpdateTeacherHours = useMutation({
    mutationFn: async ({
      runId,
      teacherIds,
      hours,
    }: {
      runId: string
      teacherIds: string[]
      hours: number
    }) => {
      if (teacherIds.length === 0) {
        throw new Error('No teachers selected')
      }

      // Fetch all line items for these teachers in this run
      const { data: lineItems, error: fetchError } = await payrollDb.from('payroll_line_item')
        .select('id, hourly_rate, adjustment_amount')
        .eq('payroll_run_id', runId)
        .in('teacher_id', teacherIds)

      if (fetchError) throw fetchError
      if (!lineItems || lineItems.length === 0) {
        throw new Error('No line items found for selected teachers')
      }

      // Update each line item with new hours
      const updates = lineItems.map((item: { id: string; hourly_rate: number; adjustment_amount: number }) => {
        const calculatedAmount = multiplyMoney(hours, item.hourly_rate)
        const finalAmount = addMoney(calculatedAmount, item.adjustment_amount || 0)
        return payrollDb.from('payroll_line_item')
          .update({
            actual_hours: hours,
            calculated_amount: calculatedAmount,
            final_amount: finalAmount,
          })
          .eq('id', item.id)
      })

      // Execute all updates
      const results = await Promise.allSettled(updates)
      const failed = results.filter(r => r.status === 'rejected').length

      if (failed > 0) {
        throw new Error(`Failed to update ${failed} of ${lineItems.length} line items`)
      }

      // Recalculate run totals
      await recalculateRunTotals(runId)

      return { updated: lineItems.length, runId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payroll.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.payroll.runWithItems(data.runId) })
    },
  })

  /**
   * Create a manual line item for miscellaneous tasks (e.g., "Cleaning and organizing files")
   * Used for one-off tasks that aren't part of regular assignments
   */
  const createLineItem = useMutation({
    mutationFn: async ({
      runId,
      teacherId,
      description,
      hours,
      hourlyRate,
    }: {
      runId: string
      teacherId: string
      description: string
      hours: number
      hourlyRate: number
    }) => {
      const calculatedAmount = multiplyMoney(hours, hourlyRate)

      const { data, error } = await payrollDb.from('payroll_line_item')
        .insert({
          payroll_run_id: runId,
          teacher_id: teacherId,
          teacher_assignment_id: null, // Manual line items have no assignment
          enrollment_id: null,
          service_id: null,
          description,
          calculated_hours: hours,
          actual_hours: hours,
          hourly_rate: hourlyRate,
          rate_source: 'teacher', // Manual entries use teacher rate source
          calculated_amount: calculatedAmount,
          adjustment_amount: 0,
          final_amount: calculatedAmount,
        })
        .select()
        .single()

      if (error) throw error

      // Recalculate run totals
      await recalculateRunTotals(runId)

      return data as PayrollLineItem
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payroll.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.payroll.runWithItems(data.payroll_run_id) })
    },
  })

  /**
   * Delete a line item (only for manual items without assignment)
   */
  const deleteLineItem = useMutation({
    mutationFn: async (id: string) => {
      // First get the line item to verify it's deletable and get the run id
      const { data: item, error: fetchError } = await payrollDb.from('payroll_line_item')
        .select('payroll_run_id, teacher_assignment_id')
        .eq('id', id)
        .single()

      if (fetchError) throw fetchError

      // Only allow deleting manual line items (no assignment)
      if (item.teacher_assignment_id) {
        throw new Error('Cannot delete assignment-based line items')
      }

      const { error } = await payrollDb.from('payroll_line_item')
        .delete()
        .eq('id', id)

      if (error) throw error

      // Recalculate run totals
      await recalculateRunTotals(item.payroll_run_id)

      return { id, runId: item.payroll_run_id }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payroll.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.payroll.runWithItems(data.runId) })
    },
  })

  return {
    createPayrollRun,
    updateRunStatus,
    updateLineItem,
    createLineItem,
    deleteLineItem,
    createAdjustment,
    deletePayrollRun,
    bulkUpdateTeacherHours,
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

  const totalCalculated = items.reduce((sum, li) => sum + (li.calculated_amount || 0), 0)
  const totalAdjusted = items.reduce((sum, li) => sum + (li.final_amount || 0), 0)
  const totalHours = items.reduce((sum, li) => sum + (li.actual_hours || 0), 0)
  const teacherIds = new Set(items.map(li => li.teacher_id))

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
// LEADS (now stored as families with status='lead')
// =============================================================================

export type LeadType = 'exit_intent' | 'waitlist' | 'calendly_call' | 'event'
export type LeadStatus = 'new' | 'contacted' | 'converted' | 'closed'

/**
 * Lead data - now represented as a family with status='lead'
 * The family table contains all lead-specific fields after consolidation
 */
export interface LeadFamily {
  id: string
  // Family fields
  display_name: string
  primary_email: string | null
  primary_phone: string | null
  primary_contact_name: string | null
  status: CustomerStatus  // Will be 'lead' for leads
  notes: string | null
  created_at: string
  updated_at: string
  // Lead-specific fields
  lead_type: LeadType | null
  lead_status: LeadStatus | null
  source_url: string | null
  converted_at: string | null
  num_children: number | null
  children_ages: string | null
  preferred_days: string | null
  preferred_time: string | null
  service_interest: string | null
  calendly_event_uri: string | null
  calendly_invitee_uri: string | null
  scheduled_at: string | null
  // Mailchimp fields
  mailchimp_id: string | null
  mailchimp_status: string | null
  mailchimp_last_synced_at: string | null
  mailchimp_tags: string[] | null
  mailchimp_opens: number | null
  mailchimp_clicks: number | null
  mailchimp_engagement_score: number | null
  mailchimp_engagement_updated_at: string | null
  // Scoring
  lead_score: number | null
  pdf_email_sent_at: string | null
  // Computed fields (added by useLeads)
  contact_count?: number
  last_contacted_at?: string | null
  computed_score?: number
}

// Legacy alias for backwards compatibility during migration
export type Lead = LeadFamily
export type LeadWithFamily = LeadFamily

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
 * Leads are now stored as families with status='lead'
 * @param filters.limit - Maximum number of leads to fetch (default: 500)
 */
export function useLeads(filters?: { type?: string; status?: string; search?: string; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.leads.list(filters),
    queryFn: async () => {
      const limit = filters?.limit ?? 500 // Default limit to prevent unbounded fetching

      // Fetch lead-status families
      let query = supabase
        .from('families')
        .select('*')
        .eq('status', 'lead')  // Only families with lead status
        .order('created_at', { ascending: false })
        .limit(limit)

      if (filters?.type) {
        query = query.eq('lead_type', filters.type as LeadType)
      }
      if (filters?.status) {
        // Filter by lead_status (the pipeline status: new, contacted, etc.)
        query = query.eq('lead_status', filters.status as LeadStatus)
      }
      if (filters?.search) {
        query = query.or(`primary_email.ilike.%${filters.search}%,display_name.ilike.%${filters.search}%`)
      }

      const { data: leads, error: leadsError } = await query
      if (leadsError) throw leadsError

      // Fetch activity stats by family_id
      const familyIds = (leads || []).map(l => l.id)
      if (familyIds.length === 0) {
        return [] as LeadFamily[]
      }

      const { data: activityStats, error: statsError } = await supabase
        .from('lead_activities')
        .select('family_id, contacted_at')
        .in('family_id', familyIds)
        .order('contacted_at', { ascending: false })

      if (statsError) {
        // If activities table query fails, return leads without stats
        console.warn('Could not fetch activity stats:', statsError)
        return leads as LeadFamily[]
      }

      // Group stats by family_id
      const statsMap = new Map<string, { count: number; lastContacted: string | null }>()
      for (const activity of (activityStats || []) as { family_id: string; contacted_at: string }[]) {
        const existing = statsMap.get(activity.family_id)
        if (existing) {
          existing.count++
        } else {
          statsMap.set(activity.family_id, {
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
      }) as LeadFamily[]
    },
  })
}

/**
 * Fetch a single lead by ID (now queries families table)
 */
export function useLead(id: string) {
  return useQuery({
    queryKey: queryKeys.leads.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('families')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as LeadFamily
    },
    enabled: !!id,
  })
}

/**
 * Input type for creating a lead (family with status='lead')
 */
export interface CreateLeadInput {
  display_name: string
  primary_email: string | null
  primary_phone?: string | null
  primary_contact_name?: string | null
  lead_type: LeadType
  lead_status?: LeadStatus
  source_url?: string | null
  num_children?: number | null
  children_ages?: string | null
  preferred_days?: string | null
  preferred_time?: string | null
  service_interest?: string | null
  notes?: string | null
}

/**
 * Count of converted leads - families that have lead_status='converted'
 * This includes both leads that are still status='lead' AND those converted to 'active'
 * Used for the Marketing view's converted metric
 */
export function useConvertedLeadsCount() {
  return useQuery({
    queryKey: queryKeys.leads.converted(),
    queryFn: async () => {
      const { count, error } = await supabase
        .from('families')
        .select('*', { count: 'exact', head: true })
        .eq('lead_status', 'converted')
        .not('lead_type', 'is', null) // Must have a lead_type to be counted as a converted lead

      if (error) throw error
      return count || 0
    },
    staleTime: 60 * 1000, // 1 minute
  })
}

/**
 * Lead mutations for CRUD operations
 * Now operates on families table with status='lead'
 */
export function useLeadMutations() {
  const queryClient = useQueryClient()

  const createLead = useMutation({
    mutationFn: async (lead: CreateLeadInput) => {
      const { data, error } = await supabase
        .from('families')
        .insert({
          ...lead,
          status: 'lead' as CustomerStatus,
          lead_status: lead.lead_status || 'new',
        })
        .select()
        .single()
      if (error) throw error
      return data as LeadFamily
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() })
    },
  })

  const updateLead = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LeadFamily> & { id: string }) => {
      const { data, error } = await supabase
        .from('families')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as LeadFamily
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(variables.id) })
    },
  })

  const deleteLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('families')
        .delete()
        .eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() })
    },
  })

  const bulkCreateLeads = useMutation({
    mutationFn: async (leads: CreateLeadInput[]) => {
      const familyRecords = leads.map(lead => ({
        ...lead,
        status: 'lead' as CustomerStatus,
        lead_status: lead.lead_status || 'new',
      }))
      const { data, error } = await supabase
        .from('families')
        .insert(familyRecords)
        .select()
      if (error) throw error
      return data as LeadFamily[]
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() })
    },
  })

  /**
   * Convert a lead to a customer by updating the family status
   * @param familyId - The family ID (same as lead ID now)
   * @param targetStatus - The status to convert to (default: 'active')
   */
  const convertToCustomer = useMutation({
    mutationFn: async ({ familyId, targetStatus = 'active' }: { familyId: string; targetStatus?: CustomerStatus }) => {
      const { data, error } = await supabase
        .from('families')
        .update({
          status: targetStatus,
          lead_status: 'converted' as LeadStatus,
          converted_at: new Date().toISOString(),
        })
        .eq('id', familyId)
        .select()
        .single()
      if (error) throw error
      return data as LeadFamily
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(variables.familyId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.converted() })
      queryClient.invalidateQueries({ queryKey: queryKeys.families.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() })
    },
  })

  // Legacy alias for backwards compatibility
  const convertToFamily = convertToCustomer

  return {
    createLead,
    updateLead,
    deleteLead,
    bulkCreateLeads,
    convertToCustomer,
    convertToFamily, // Legacy alias
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

/**
 * Check for existing leads that might match when creating a new family.
 * Returns matching leads by email (primary or secondary) or normalized name.
 */
export interface MatchingLead {
  id: string
  display_name: string | null
  primary_email: string | null
  secondary_email: string | null
  primary_phone: string | null
  lead_status: LeadStatus | null
  lead_type: string | null
  created_at: string | null
  match_type: 'email' | 'name'
}

export function useCheckMatchingLeads() {
  return useMutation({
    mutationFn: async ({ email, name }: { email?: string; name?: string }): Promise<MatchingLead[]> => {
      const matches: MatchingLead[] = []

      // Check by email if provided
      if (email && email.trim()) {
        const lowerEmail = email.toLowerCase().trim()
        const { data: emailMatches, error: emailError } = await supabase
          .from('families')
          .select('id, display_name, primary_email, secondary_email, primary_phone, lead_status, lead_type, created_at')
          .eq('status', 'lead')
          .or(`primary_email.ilike.${lowerEmail},secondary_email.ilike.${lowerEmail}`)

        if (emailError) throw emailError

        if (emailMatches) {
          matches.push(...emailMatches.map(m => ({ ...m, match_type: 'email' as const })))
        }
      }

      // Check by normalized name if provided (and no email match found)
      if (name && name.trim() && matches.length === 0) {
        // Normalize the name to "Last, First" format for comparison
        const normalizedName = formatNameLastFirst(name).toLowerCase()

        // Also check without the comma format for partial matches
        const nameParts = name.toLowerCase().trim().split(/[\s,]+/).filter(Boolean)

        if (nameParts.length > 0) {
          // Build an OR query for name matching
          const { data: nameMatches, error: nameError } = await supabase
            .from('families')
            .select('id, display_name, primary_email, secondary_email, primary_phone, lead_status, lead_type, created_at')
            .eq('status', 'lead')
            .or(nameParts.map(part => `display_name.ilike.%${part}%`).join(','))

          if (nameError) throw nameError

          // Filter to only include good matches (all name parts present)
          if (nameMatches) {
            const goodMatches = nameMatches.filter(m => {
              const displayLower = (m.display_name || '').toLowerCase()
              return nameParts.every(part => displayLower.includes(part)) ||
                     displayLower === normalizedName
            })
            // Don't add duplicates (already matched by email)
            const existingIds = new Set(matches.map(m => m.id))
            matches.push(...goodMatches.filter(m => !existingIds.has(m.id)).map(m => ({ ...m, match_type: 'name' as const })))
          }
        }
      }

      return matches
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
  family_id: string  // Now uses family_id instead of lead_id
  lead_id?: string   // Legacy field, may be null
  contact_type: ContactType
  notes: string | null
  contacted_at: string
  created_at: string
}

/**
 * Fetch activities for a specific lead (by family_id)
 */
export function useLeadActivities(familyId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.leadActivities.byLead(familyId || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_activities')
        .select('*')
        .eq('family_id', familyId!)
        .order('contacted_at', { ascending: false })
      if (error) throw error
      return data as LeadActivity[]
    },
    enabled: !!familyId,
  })
}

/**
 * Lead activity mutations
 */
export function useLeadActivityMutations() {
  const queryClient = useQueryClient()

  const createActivity = useMutation({
    mutationFn: async (activity: { family_id: string; contact_type: ContactType; notes: string | null; contacted_at: string }) => {
      const { data, error } = await supabase
        .from('lead_activities')
        .insert(activity)
        .select()
        .single()
      if (error) throw error
      return data as LeadActivity
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leadActivities.byLead(variables.family_id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
    },
  })

  const deleteActivity = useMutation({
    mutationFn: async ({ id }: { id: string; familyId: string }) => {
      const { error } = await supabase
        .from('lead_activities')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leadActivities.byLead(variables.familyId) })
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
      // Fetch all families that were ever leads (lead_type is not null)
      const { data: leads, error } = await supabase
        .from('families')
        .select('id, lead_type, lead_status, created_at, converted_at, source_url')
        .not('lead_type', 'is', null)
        .order('created_at', { ascending: false })

      if (error) throw error

      const allLeads = leads || []
      const convertedLeads = allLeads.filter(l => l.lead_status === 'converted')

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
        new: allLeads.filter(l => l.lead_status === 'new').length,
        contacted: allLeads.filter(l => l.lead_status === 'contacted').length,
        converted: allLeads.filter(l => l.lead_status === 'converted').length,
        closed: allLeads.filter(l => l.lead_status === 'closed').length,
      }

      // By lead type
      const leadTypes: LeadType[] = ['event', 'calendly_call', 'waitlist', 'exit_intent']
      const byLeadType = leadTypes.map(type => {
        const typeLeads = allLeads.filter(l => l.lead_type === type)
        const typeConverted = typeLeads.filter(l => l.lead_status === 'converted')
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
  family_id: string  // Now uses family_id instead of lead_id
  lead_id?: string   // Legacy field, may be null
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
 * Fetch follow-ups for a specific lead (by family_id)
 */
export function useLeadFollowUps(familyId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.leadFollowUps.byLead(familyId || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_follow_ups')
        .select('*')
        .eq('family_id', familyId!)
        .order('due_date', { ascending: true })
        .order('due_time', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data as LeadFollowUp[]
    },
    enabled: !!familyId,
  })
}

/**
 * Fetch all upcoming (non-completed) follow-ups
 */
export function useUpcomingFollowUps() {
  return useQuery({
    queryKey: queryKeys.leadFollowUps.upcoming(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_follow_ups')
        .select(`
          *,
          family:families!lead_follow_ups_family_id_fkey (
            id,
            display_name,
            primary_email,
            primary_phone,
            lead_type,
            lead_status
          )
        `)
        .eq('completed', false)
        .order('due_date', { ascending: true })
        .limit(50)
      if (error) throw error

      // Calculate urgency and transform to UpcomingFollowUp format
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const weekFromNow = new Date(today)
      weekFromNow.setDate(weekFromNow.getDate() + 7)

      return (data || []).map(item => {
        const dueDate = new Date(item.due_date)
        dueDate.setHours(0, 0, 0, 0)

        let urgency: UpcomingFollowUp['urgency']
        if (dueDate < today) {
          urgency = 'overdue'
        } else if (dueDate.getTime() === today.getTime()) {
          urgency = 'today'
        } else if (dueDate.getTime() === tomorrow.getTime()) {
          urgency = 'tomorrow'
        } else if (dueDate < weekFromNow) {
          urgency = 'this_week'
        } else {
          urgency = 'later'
        }

        const family = item.family as {
          id: string
          display_name: string | null
          primary_email: string | null
          primary_phone: string | null
          lead_type: LeadType | null
          lead_status: LeadStatus | null
        } | null

        return {
          ...item,
          lead_name: family?.display_name || null,
          lead_email: family?.primary_email || '',
          lead_phone: family?.primary_phone || null,
          lead_type: family?.lead_type || 'exit_intent',
          lead_status: family?.lead_status || 'new',
          urgency,
        } as UpcomingFollowUp
      })
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
       
      const { data, error } = await supabase
        .from('lead_follow_ups')
        .insert(followUp)
        .select()
        .single()
      if (error) throw error
      return data as LeadFollowUp
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leadFollowUps.byLead(variables.family_id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.leadFollowUps.upcoming() })
    },
  })

  const updateFollowUp = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LeadFollowUp> & { id: string }) => {
       
      const { data, error } = await supabase
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
      queryClient.invalidateQueries({ queryKey: queryKeys.leadFollowUps.byLead(followUp.family_id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.leadFollowUps.upcoming() })
    },
  })

  const completeFollowUp = useMutation({
    mutationFn: async (id: string) => {
       
      const { data, error } = await supabase
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
      queryClient.invalidateQueries({ queryKey: queryKeys.leadFollowUps.byLead(followUp.family_id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.leadFollowUps.upcoming() })
    },
  })

  const deleteFollowUp = useMutation({
    mutationFn: async ({ id }: { id: string; familyId: string }) => {
       
      const { error } = await supabase
        .from('lead_follow_ups')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leadFollowUps.byLead(variables.familyId) })
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

// ============================================
// Email Campaign Hooks
// ============================================

export interface EmailCampaign {
  id: string
  mailchimp_campaign_id: string
  campaign_name: string
  subject_line: string | null
  preview_text: string | null
  campaign_type: string | null
  send_time: string | null
  emails_sent: number
  unique_opens: number
  total_opens: number
  open_rate: number
  unique_clicks: number
  total_clicks: number
  click_rate: number
  unsubscribes: number
  bounces: number
  is_ab_test: boolean
  winning_variant: string | null
  ab_test_results: unknown | null
  status: string
  last_synced_at: string
  created_at: string
  updated_at: string
}

export interface LeadCampaignEngagement {
  id: string
  family_id: string  // Now uses family_id instead of lead_id
  lead_id?: string   // Legacy field, may be null
  campaign_id: string
  was_sent: boolean
  opened: boolean
  first_opened_at: string | null
  open_count: number
  clicked: boolean
  first_clicked_at: string | null
  click_count: number
  clicked_links: unknown | null
  bounced: boolean
  unsubscribed: boolean
  created_at: string
  updated_at: string
  // Joined data
  family?: {
    id: string
    primary_email: string | null
    display_name: string
    lead_type: LeadType | null
    lead_status: LeadStatus | null
  }
  campaign?: {
    id: string
    campaign_name: string
    subject_line: string | null
    send_time: string | null
  }
}

/**
 * Fetch all email campaigns from the database
 * Note: Requires MIGRATION_CAMPAIGN_ANALYTICS.sql to be run first
 */
export function useEmailCampaigns() {
  return useQuery({
    queryKey: queryKeys.emailCampaigns.list(),
    queryFn: async () => {
       
      const { data, error } = await supabase
        .from('email_campaigns')
        .select('*')
        .order('send_time', { ascending: false })

      if (error) throw error
      return (data || []) as EmailCampaign[]
    },
  })
}

/**
 * Fetch campaign engagement for a specific campaign
 * Note: Requires MIGRATION_CAMPAIGN_ANALYTICS.sql to be run first
 */
export function useCampaignEngagement(campaignId: string) {
  return useQuery({
    queryKey: queryKeys.leadCampaignEngagement.byCampaign(campaignId),
    queryFn: async () => {

      const { data, error } = await supabase
        .from('lead_campaign_engagement')
        .select(`
          *,
          family:families(id, primary_email, display_name, lead_type, lead_status)
        `)
        .eq('campaign_id', campaignId)
        .order('open_count', { ascending: false })

      if (error) throw error
      return (data || []) as LeadCampaignEngagement[]
    },
    enabled: !!campaignId,
  })
}

/**
 * Fetch campaign engagement for a specific lead (family)
 * Note: Requires MIGRATION_CAMPAIGN_ANALYTICS.sql to be run first
 */
export function useLeadCampaignEngagement(familyId: string) {
  return useQuery({
    queryKey: queryKeys.leadCampaignEngagement.byLead(familyId),
    queryFn: async () => {

      const { data, error } = await supabase
        .from('lead_campaign_engagement')
        .select(`
          *,
          campaign:email_campaigns(id, campaign_name, subject_line, send_time)
        `)
        .eq('family_id', familyId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []) as LeadCampaignEngagement[]
    },
    enabled: !!familyId,
  })
}

// =============================================================================
// EVENTS HOOKS
// =============================================================================

export interface EventWithStats {
  id: string
  title: string
  description: string | null
  location: string | null
  start_at: string | null
  end_at: string | null
  ticket_price_cents: number | null
  event_type: string
  attendee_count: number
  revenue: number
}

export interface AttendeeWithDetails {
  id: string
  attendee_name: string
  attendee_age: number | null
  event_id: string
  event_title: string
  event_date: string | null
  event_location: string | null
  purchaser_name: string | null
  purchaser_email: string | null
  payment_status: string
  family_id: string | null
  family_name: string | null
}

// Database row types for Supabase queries
interface EventRow {
  id: string
  title: string
  description: string | null
  venue_name: string | null
  start_at: string | null
  end_at: string | null
  ticket_price_cents: number | null
  event_type: string
}

interface AttendeeRow {
  event_id: string
}

interface OrderRow {
  event_id: string
  total_cents: number | null
  payment_status: string
}

interface AttendeeListRow {
  attendee_id: string
  attendee_name: string
  attendee_age: number | null
  event_id: string
  event_title: string | null
  event_date: string | null
  venue_name: string | null
  purchaser_name: string | null
  purchaser_email: string | null
  payment_status: string | null
  family_id: string | null
  event_type: string
}

interface EventFamilyRow {
  id: string
  display_name: string | null
}

/**
 * Fetch all events with attendee counts and revenue
 */
export function useEvents() {
  return useQuery({
    queryKey: queryKeys.events.list(),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: events, error } = await supabase
        .from('event_events')
        .select('*')
        .eq('event_type', 'event')
        .order('start_at', { ascending: false })
        .returns<EventRow[]>()

      if (error) throw error

      const eventIds = (events || []).map(e => e.id)

      if (eventIds.length === 0) {
        return []
      }

      const { data: attendees } = await supabase
        .from('event_attendees')
        .select('event_id')
        .in('event_id', eventIds)
        .returns<AttendeeRow[]>()

      const { data: orders } = await supabase
        .from('event_orders')
        .select('event_id, total_cents, payment_status')
        .in('event_id', eventIds)
        .eq('payment_status', 'paid')
        .returns<OrderRow[]>()

      const attendeeCountMap = new Map<string, number>()
      const revenueMap = new Map<string, number>()

      ;(attendees || []).forEach(a => {
        const current = attendeeCountMap.get(a.event_id) || 0
        attendeeCountMap.set(a.event_id, current + 1)
      })

      ;(orders || []).forEach(o => {
        const current = revenueMap.get(o.event_id) || 0
        revenueMap.set(o.event_id, current + (o.total_cents || 0))
      })

      return (events || []).map(e => ({
        ...e,
        location: e.venue_name,
        attendee_count: attendeeCountMap.get(e.id) || 0,
        revenue: (revenueMap.get(e.id) || 0) / 100
      })) as EventWithStats[]
    }
  })
}

/**
 * Fetch all event attendees with details
 */
export function useAllAttendees() {
  return useQuery({
    queryKey: queryKeys.events.attendees(),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Use the event_attendee_list view which already joins events, orders, and attendees
      // and filters by payment_status IN ('paid', 'stepup_pending')
      const { data: attendeeList, error } = await supabase
        .from('event_attendee_list')
        .select('*')
        .eq('event_type', 'event')
        .order('event_date', { ascending: false })
        .returns<AttendeeListRow[]>()

      if (error) throw error
      if (!attendeeList || attendeeList.length === 0) return []

      // Get family names for attendees that have family_id
      const familyIds = [...new Set(attendeeList.map(a => a.family_id).filter(Boolean))] as string[]
      const { data: families } = familyIds.length > 0
        ? await supabase.from('families').select('id, display_name').in('id', familyIds).returns<EventFamilyRow[]>()
        : { data: [] as EventFamilyRow[] }

      const familyMap = new Map((families || []).map(f => [f.id, f]))

      return attendeeList.map(a => ({
        id: a.attendee_id,
        attendee_name: a.attendee_name,
        attendee_age: a.attendee_age,
        event_id: a.event_id,
        event_title: a.event_title || 'Unknown',
        event_date: a.event_date,
        event_location: a.venue_name,
        purchaser_name: a.purchaser_name,
        purchaser_email: a.purchaser_email,
        payment_status: a.payment_status || 'unknown',
        family_id: a.family_id,
        family_name: a.family_id ? familyMap.get(a.family_id)?.display_name : null
      })) as AttendeeWithDetails[]
    }
  })
}

// =============================================================================
// CHECK-IN TYPES (Teacher's Desk)
// =============================================================================

export type CheckinPeriodStatus = 'draft' | 'open' | 'closed'
export type CheckinInviteStatus = 'pending' | 'submitted'

export interface CheckinPeriod {
  id: string
  period_key: string           // '2026-01' format
  display_name: string         // 'January 2026'
  status: CheckinPeriodStatus
  opens_at: string | null
  closes_at: string | null
  created_at: string
  updated_at: string
}

export interface CheckinPeriodSummary extends CheckinPeriod {
  total_invites: number
  submitted_count: number
  pending_count: number
  sent_pending_count: number
  not_sent_count: number
}

export interface CheckinInvite {
  id: string
  period_id: string
  teacher_id: string
  status: CheckinInviteStatus
  sent_at: string | null
  submitted_at: string | null
  reminders_sent: number
  last_reminder_at: string | null
  created_at: string
}

export interface CheckinInviteWithTeacher extends CheckinInvite {
  teacher: {
    id: string
    display_name: string
    email: string | null
    status: string
    desk_token: string | null
  }
}

export interface CheckinResponse {
  id: string
  invite_id: string
  needs_resources: boolean
  resource_requests: string | null
  needs_training: boolean
  training_requests: string | null
  doing_bom_project: boolean | null
  general_notes: string | null
  submitted_at: string
  created_at: string
}

export interface CheckinStudentResource {
  id: string
  response_id: string
  student_id: string
  student_name: string
  grade_level: string | null
  ela_resources: string | null
  math_resources: string | null
  science_resources: string | null
  social_resources: string | null
  elearning_status: string | null
  created_at: string
}

export interface CheckinResponseWithResources extends CheckinResponse {
  student_resources: CheckinStudentResource[]
}

export interface TeacherStudent {
  student_id: string
  student_name: string
  grade_level: string | null
  family_name: string
  service_name: string
}

// =============================================================================
// CHECK-IN HOOKS
// =============================================================================

/**
 * Fetch all check-in periods with summary stats
 */
export function useCheckinPeriods() {
  return useQuery({
    queryKey: queryKeys.checkins.periodSummary(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checkin_period_summary')
        .select('*')
        .order('period_key', { ascending: false })

      if (error) throw error
      return data as CheckinPeriodSummary[]
    },
  })
}

/**
 * Fetch a single period by ID
 */
export function useCheckinPeriod(periodId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.checkins.periodDetail(periodId || ''),
    queryFn: async () => {
      if (!periodId) return null
      const { data, error } = await supabase
        .from('checkin_periods')
        .select('*')
        .eq('id', periodId)
        .single()

      if (error) throw error
      return data as CheckinPeriod
    },
    enabled: !!periodId,
  })
}

/**
 * Fetch invites for a period with teacher details
 */
export function useCheckinInvites(periodId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.checkins.invites(periodId || ''),
    queryFn: async () => {
      if (!periodId) return []
      const { data, error } = await supabase
        .from('checkin_invites')
        .select(`
          *,
          teacher:teachers(id, display_name, email, status, desk_token)
        `)
        .eq('period_id', periodId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as CheckinInviteWithTeacher[]
    },
    enabled: !!periodId,
  })
}

/**
 * Fetch a check-in response with student resources
 */
export function useCheckinResponse(inviteId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.checkins.responseWithResources(inviteId || ''),
    queryFn: async () => {
      if (!inviteId) return null

      // Get the response
      const { data: response, error: respError } = await supabase
        .from('checkin_responses')
        .select('*')
        .eq('invite_id', inviteId)
        .single()

      if (respError) {
        if (respError.code === 'PGRST116') return null // Not found
        throw respError
      }

      // Get student resources
      const { data: resources, error: resError } = await supabase
        .from('checkin_student_resources')
        .select('*')
        .eq('response_id', response.id)
        .order('student_name')

      if (resError) throw resError

      return {
        ...response,
        student_resources: resources || []
      } as CheckinResponseWithResources
    },
    enabled: !!inviteId,
  })
}

/**
 * Fetch active students for a teacher (for check-in form)
 */
export function useTeacherStudents(teacherId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.checkins.teacherStudents(teacherId || ''),
    queryFn: async () => {
      if (!teacherId) return []

      const { data, error } = await supabase
        .from('teacher_assignments')
        .select(`
          enrollment:enrollments!inner(
            student:students!inner(
              id,
              full_name,
              grade_level,
              family:families!inner(display_name)
            ),
            service:services!inner(name)
          )
        `)
        .eq('teacher_id', teacherId)
        .eq('is_active', true)
        .not('enrollment_id', 'is', null)

      if (error) throw error

      // Flatten and dedupe by student ID
      const studentMap = new Map<string, TeacherStudent>()

      for (const row of data || []) {
        const enrollment = row.enrollment as {
          student: { id: string; full_name: string; grade_level: string | null; family: { display_name: string } }
          service: { name: string }
        } | null

        if (enrollment?.student) {
          const student = enrollment.student
          if (!studentMap.has(student.id)) {
            studentMap.set(student.id, {
              student_id: student.id,
              student_name: student.full_name,
              grade_level: student.grade_level,
              family_name: student.family?.display_name || '',
              service_name: enrollment.service?.name || ''
            })
          }
        }
      }

      return Array.from(studentMap.values()).sort((a, b) =>
        a.student_name.localeCompare(b.student_name)
      )
    },
    enabled: !!teacherId,
  })
}

// =============================================================================
// CHECK-IN MUTATIONS
// =============================================================================

export function useCheckinMutations() {
  const queryClient = useQueryClient()

  // Create a new period
  const createPeriod = useMutation({
    mutationFn: async (data: { period_key: string; display_name: string; status?: CheckinPeriodStatus; opens_at?: string; closes_at?: string }) => {
      const { data: period, error } = await supabase
        .from('checkin_periods')
        .insert(data)
        .select()
        .single()

      if (error) throw error
      return period as CheckinPeriod
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.checkins.periods() })
      queryClient.invalidateQueries({ queryKey: queryKeys.checkins.periodSummary() })
    },
  })

  // Update a period
  const updatePeriod = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CheckinPeriod> }) => {
      const { data: period, error } = await supabase
        .from('checkin_periods')
        .update(data)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return period as CheckinPeriod
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.checkins.periods() })
      queryClient.invalidateQueries({ queryKey: queryKeys.checkins.periodSummary() })
      queryClient.invalidateQueries({ queryKey: queryKeys.checkins.periodDetail(variables.id) })
    },
  })

  // Delete a period
  const deletePeriod = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('checkin_periods')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.checkins.periods() })
      queryClient.invalidateQueries({ queryKey: queryKeys.checkins.periodSummary() })
    },
  })

  // Create invites for teachers
  const createInvites = useMutation({
    mutationFn: async ({ periodId, teacherIds }: { periodId: string; teacherIds: string[] }) => {
      const invites = teacherIds.map(teacherId => ({
        period_id: periodId,
        teacher_id: teacherId,
        status: 'pending' as const,
      }))

      const { data, error } = await supabase
        .from('checkin_invites')
        .insert(invites)
        .select()

      if (error) throw error
      return data as CheckinInvite[]
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.checkins.invites(variables.periodId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.checkins.periodSummary() })
    },
  })

  // Mark invites as sent (updates sent_at timestamp and sends emails via n8n)
  const markInvitesSent = useMutation({
    mutationFn: async ({
      invites,
      periodId,
      periodDisplayName
    }: {
      invites: CheckinInviteWithTeacher[]
      periodId: string
      periodDisplayName: string
    }): Promise<{ periodId: string; warnings: string[] }> => {
      const warnings: string[] = []
      const inviteIds = invites.map(i => i.id)

      // Update database first
      const { error } = await supabase
        .from('checkin_invites')
        .update({ sent_at: new Date().toISOString() })
        .in('id', inviteIds)

      if (error) throw error

      // Send emails via n8n webhook for each invite with an email
      // Use VITE_APP_URL in production to avoid localhost URLs in emails
      const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin
      for (const invite of invites) {
        if (invite.teacher?.email && invite.teacher?.desk_token) {
          try {
            await fetch('https://eatonacademic.app.n8n.cloud/webhook/checkin-notify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'invite',
                teacher: {
                  name: invite.teacher.display_name,
                  email: invite.teacher.email,
                },
                period: {
                  display_name: periodDisplayName,
                },
                desk_url: `${baseUrl}/desk/${invite.teacher.desk_token}`,
                checkin_url: `${baseUrl}/desk/${invite.teacher.desk_token}/checkin/${periodId}`,
              }),
            })
          } catch (webhookError) {
            // Log but don't fail the mutation - DB is already updated
            console.error('Failed to send invite email:', webhookError)
            warnings.push(`Failed to send email to ${invite.teacher.display_name}`)
          }
        }
      }

      return { periodId, warnings }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.checkins.invites(result.periodId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.checkins.periodSummary() })
    },
  })

  // Mark invites as reminded (updates reminder count and sends emails via n8n)
  const markInvitesReminded = useMutation({
    mutationFn: async ({
      invites,
      periodId,
      periodDisplayName
    }: {
      invites: CheckinInviteWithTeacher[]
      periodId: string
      periodDisplayName: string
    }): Promise<{ periodId: string; warnings: string[] }> => {
      const warnings: string[] = []
      const inviteIds = invites.map(i => i.id)

      // Get current reminder counts
      const { data: currentInvites, error: fetchError } = await supabase
        .from('checkin_invites')
        .select('id, reminders_sent')
        .in('id', inviteIds)

      if (fetchError) throw fetchError

      // Update each invite in database
      for (const dbInvite of currentInvites || []) {
        const { error } = await supabase
          .from('checkin_invites')
          .update({
            reminders_sent: (dbInvite.reminders_sent || 0) + 1,
            last_reminder_at: new Date().toISOString()
          })
          .eq('id', dbInvite.id)

        if (error) throw error
      }

      // Send reminder emails via n8n webhook for each invite with an email
      // Use VITE_APP_URL in production to avoid localhost URLs in emails
      const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin
      for (const invite of invites) {
        if (invite.teacher?.email && invite.teacher?.desk_token) {
          try {
            await fetch('https://eatonacademic.app.n8n.cloud/webhook/checkin-notify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'reminder',
                teacher: {
                  name: invite.teacher.display_name,
                  email: invite.teacher.email,
                },
                period: {
                  display_name: periodDisplayName,
                },
                desk_url: `${baseUrl}/desk/${invite.teacher.desk_token}`,
                checkin_url: `${baseUrl}/desk/${invite.teacher.desk_token}/checkin/${periodId}`,
              }),
            })
          } catch (webhookError) {
            // Log but don't fail the mutation - DB is already updated
            console.error('Failed to send reminder email:', webhookError)
            warnings.push(`Failed to send reminder to ${invite.teacher.display_name}`)
          }
        }
      }

      return { periodId, warnings }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.checkins.invites(result.periodId) })
    },
  })

  // Delete an invite
  const deleteInvite = useMutation({
    mutationFn: async ({ inviteId, periodId }: { inviteId: string; periodId: string }) => {
      const { error } = await supabase
        .from('checkin_invites')
        .delete()
        .eq('id', inviteId)

      if (error) throw error
      return { periodId }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.checkins.invites(result.periodId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.checkins.periodSummary() })
    },
  })

  return {
    createPeriod,
    updatePeriod,
    deletePeriod,
    createInvites,
    markInvitesSent,
    markInvitesReminded,
    deleteInvite,
  }
}

// =============================================================================
// TEACHER DESK HOOKS (Public Portal)
// =============================================================================

/**
 * Teacher info returned by token lookup
 */
export interface TeacherDeskInfo {
  id: string
  display_name: string
  email: string | null
  desk_token: string
  status: string
}

/**
 * Fetch teacher by their desk token (for public teacher portal)
 */
export function useTeacherByToken(token: string | undefined) {
  return useQuery({
    queryKey: queryKeys.teachers.byToken(token || ''),
    queryFn: async () => {
      if (!token) return null

      const { data, error } = await supabase
        .from('teachers')
        .select('id, display_name, email, desk_token, status')
        .eq('desk_token', token)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null // No rows found
        throw error
      }
      return data as TeacherDeskInfo
    },
    enabled: !!token,
  })
}

/**
 * Check-in invite with period info for teacher desk
 */
export interface TeacherInviteWithPeriod {
  id: string
  period_id: string
  teacher_id: string
  status: 'pending' | 'submitted'
  sent_at: string | null
  submitted_at: string | null
  reminders_sent: number
  last_reminder_at: string | null
  created_at: string
  period: {
    id: string
    period_key: string
    display_name: string
    status: 'draft' | 'open' | 'closed'
    opens_at: string | null
    closes_at: string | null
  }
}

/**
 * Fetch all check-in invites for a teacher (for their desk portal)
 */
export function useTeacherInvites(teacherId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.checkins.invitesByTeacher(teacherId || ''),
    queryFn: async () => {
      if (!teacherId) return []

      const { data, error } = await supabase
        .from('checkin_invites')
        .select(`
          id,
          period_id,
          teacher_id,
          status,
          sent_at,
          submitted_at,
          reminders_sent,
          last_reminder_at,
          created_at,
          period:checkin_periods!period_id (
            id,
            period_key,
            display_name,
            status,
            opens_at,
            closes_at
          )
        `)
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Transform the response to flatten the period relationship
      return (data || []).map(invite => ({
        ...invite,
        period: Array.isArray(invite.period) ? invite.period[0] : invite.period,
      })) as TeacherInviteWithPeriod[]
    },
    enabled: !!teacherId,
  })
}

// =============================================================================
// CHECK-IN FORM SUBMISSION (Teacher Portal)
// =============================================================================

interface CheckinFormSubmitData {
  inviteId: string
  periodId: string
  teacherId: string
  teacherName: string
  teacherEmail: string | null
  needsAssessment: {
    needs_resources: boolean
    resource_requests: string | null
    needs_training: boolean
    training_requests: string | null
    doing_bom_project: boolean | null
  }
  studentResources: Array<{
    student_id: string
    student_name: string
    grade_level: string | null
    ela_resources: string | null
    math_resources: string | null
    science_resources: string | null
    social_resources: string | null
    elearning_status: string | null
  }>
}

/**
 * Submit a check-in form (creates response, student resources, updates invite status)
 */
export function useCheckinFormSubmit() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CheckinFormSubmitData): Promise<{ responseId: string; needsTraining: boolean; warnings: string[] }> => {
      const warnings: string[] = []

      // 1. Create the checkin_response record
      const { data: response, error: responseError } = await supabase
        .from('checkin_responses')
        .insert({
          invite_id: data.inviteId,
          needs_resources: data.needsAssessment.needs_resources,
          resource_requests: data.needsAssessment.resource_requests,
          needs_training: data.needsAssessment.needs_training,
          training_requests: data.needsAssessment.training_requests,
          doing_bom_project: data.needsAssessment.doing_bom_project,
        })
        .select()
        .single()

      if (responseError) throw responseError

      // 2. Create student resource records
      if (data.studentResources.length > 0) {
        const studentResourceRecords = data.studentResources.map(sr => ({
          response_id: response.id,
          student_id: sr.student_id,
          student_name: sr.student_name,
          grade_level: sr.grade_level,
          ela_resources: sr.ela_resources,
          math_resources: sr.math_resources,
          science_resources: sr.science_resources,
          social_resources: sr.social_resources,
          elearning_status: sr.elearning_status,
        }))

        const { error: resourcesError } = await supabase
          .from('checkin_student_resources')
          .insert(studentResourceRecords)

        if (resourcesError) throw resourcesError
      }

      // 3. Update invite status to submitted
      const { error: inviteError } = await supabase
        .from('checkin_invites')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', data.inviteId)

      if (inviteError) throw inviteError

      // 4. If training was requested and teacher has email, send training webhook
      if (data.needsAssessment.needs_training && data.teacherEmail) {
        try {
          await fetch('https://eatonacademic.app.n8n.cloud/webhook/checkin-training', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              teacher: {
                name: data.teacherName,
                email: data.teacherEmail,
              },
              training_requests: data.needsAssessment.training_requests,
            }),
          })
        } catch (webhookError) {
          // Log but don't fail the mutation - submission is already complete
          console.error('Failed to send training request email:', webhookError)
          warnings.push('Check-in submitted but failed to send training request notification')
        }
      }

      return { responseId: response.id, needsTraining: data.needsAssessment.needs_training, warnings }
    },
    onSuccess: (_result, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: queryKeys.checkins.invites(variables.periodId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.checkins.invitesByTeacher(variables.teacherId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.checkins.periodSummary() })
      queryClient.invalidateQueries({ queryKey: queryKeys.checkins.response(variables.inviteId) })
    },
  })
}

// =============================================================================
// RECENTLY VIEWED HOOKS
// =============================================================================

export interface RecentItem {
  id: string
  name: string
  type: 'family' | 'enrollment' | 'teacher'
  href: string
  timestamp: number
}

const RECENTLY_VIEWED_STORAGE_KEY = 'recentlyViewed'
const RECENTLY_VIEWED_MAX_ITEMS = 5

function getStoredRecentItems(): RecentItem[] {
  try {
    const stored = localStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY)
    if (!stored) return []
    return JSON.parse(stored)
  } catch {
    return []
  }
}

function saveRecentItems(items: RecentItem[]): void {
  try {
    localStorage.setItem(RECENTLY_VIEWED_STORAGE_KEY, JSON.stringify(items))
  } catch {
    // localStorage might be full or unavailable - fail silently
  }
}

export function useRecentlyViewed() {
  const [items, setItems] = useState<RecentItem[]>(getStoredRecentItems)

  const addItem = useCallback((item: Omit<RecentItem, 'timestamp'>) => {
    setItems(current => {
      // Remove existing entry for this item (to move it to top)
      const filtered = current.filter(i => !(i.id === item.id && i.type === item.type))

      // Add new item at the beginning
      const newItems: RecentItem[] = [
        { ...item, timestamp: Date.now() },
        ...filtered
      ].slice(0, RECENTLY_VIEWED_MAX_ITEMS)

      // Save to localStorage
      saveRecentItems(newItems)

      return newItems
    })
  }, [])

  const clearItems = useCallback(() => {
    setItems([])
    localStorage.removeItem(RECENTLY_VIEWED_STORAGE_KEY)
  }, [])

  return { items, addItem, clearItems }
}

// Standalone function to add item (for use outside React components)
export function addRecentlyViewed(item: Omit<RecentItem, 'timestamp'>): void {
  const current = getStoredRecentItems()
  const filtered = current.filter(i => !(i.id === item.id && i.type === item.type))
  const newItems: RecentItem[] = [
    { ...item, timestamp: Date.now() },
    ...filtered
  ].slice(0, RECENTLY_VIEWED_MAX_ITEMS)
  saveRecentItems(newItems)
}

// =============================================================================
// FAMILY BALANCE CALCULATION
// =============================================================================

/**
 * Calculate outstanding balances for families from unpaid invoices.
 * Queries invoices directly to avoid the Cartesian product bug in family_overview view.
 */
export async function calculateFamilyBalances(familyIds: string[]): Promise<Map<string, number>> {
  const balanceMap = new Map<string, number>()
  if (familyIds.length === 0) return balanceMap

  const { data: invoices } = await supabase
    .from('invoices')
    .select('family_id, balance_due')
    .in('family_id', familyIds)
    .or('status.eq.sent,status.eq.partial,status.eq.overdue')

  if (invoices) {
    invoices.forEach(inv => {
      const current = balanceMap.get(inv.family_id) || 0
      balanceMap.set(inv.family_id, current + (Number(inv.balance_due) || 0))
    })
  }

  return balanceMap
}

// =============================================================================
// PAGINATED FAMILIES HOOK
// =============================================================================

export type DirectorySortField = 'display_name' | 'students' | 'status' | 'total_balance' | 'primary_email'
export type SortDirection = 'asc' | 'desc'

export interface DirectorySortConfig {
  field: DirectorySortField
  direction: SortDirection
}

export interface FamilyWithStudents extends Family {
  students: Student[]
  total_balance: number
  active_enrollment_count?: number
}

/**
 * Hook for paginated families with students and balance calculation.
 * Supports search (family name, email, phone, student names), status filtering,
 * sorting by various fields including balance, and pagination.
 */
export function usePaginatedFamilies(
  page: number,
  pageSize: number,
  statusFilter: CustomerStatus | 'all',
  sortConfig: DirectorySortConfig,
  searchQuery: string
) {
  return useQuery({
    queryKey: ['families', 'paginated', { page, pageSize, status: statusFilter, sort: sortConfig, search: searchQuery }],
    queryFn: async () => {
      // When searching, we need to search across all families including student names
      // This requires fetching more data and filtering client-side for student matches
      // Limit search results to prevent unbounded data fetching
      const SEARCH_LIMIT = 500

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()

        // Fetch families with students (with status filter if applicable)
        // Limited to prevent unbounded fetching on broad searches
        let familyQuery = supabase
          .from('families')
          .select(`*, students (*)`)
          .limit(SEARCH_LIMIT)

        if (statusFilter === 'all') {
          // Exclude leads from Directory - they belong in Marketing view
          familyQuery = familyQuery.in('status', ['trial', 'active', 'paused', 'churned'])
        } else {
          familyQuery = familyQuery.eq('status', statusFilter)
        }

        // Apply server-side filtering for family fields using OR
        familyQuery = familyQuery.or(
          `display_name.ilike.%${query}%,primary_email.ilike.%${query}%,primary_phone.ilike.%${query}%`
        )

        const { data: familyMatches, error: familyError } = await familyQuery
        if (familyError) throw familyError

        // Also search for families by student name (separate query since Supabase
        // doesn't support filtering parent by child fields easily)
        // Limited to prevent unbounded fetching
        const studentQuery = supabase
          .from('students')
          .select('family_id')
          .ilike('full_name', `%${query}%`)
          .limit(SEARCH_LIMIT)

        const { data: studentMatches } = await studentQuery
        const studentFamilyIds = new Set<string>((studentMatches || []).map((s) => s.family_id))

        // If we have student matches, fetch those families too
        let additionalFamilies: typeof familyMatches = []
        if (studentFamilyIds.size > 0) {
          // Filter out families we already have
          const existingIds = new Set((familyMatches || []).map((f) => f.id))
          const missingIds = [...studentFamilyIds].filter(id => !existingIds.has(id))

          // Limit to prevent fetching too many additional families
          const limitedMissingIds = missingIds.slice(0, SEARCH_LIMIT)

          if (limitedMissingIds.length > 0) {
            let additionalQuery = supabase
              .from('families')
              .select(`*, students (*)`)
              .in('id', limitedMissingIds)

            if (statusFilter === 'all') {
              // Exclude leads from Directory - they belong in Marketing view
              additionalQuery = additionalQuery.in('status', ['trial', 'active', 'paused', 'churned'])
            } else {
              additionalQuery = additionalQuery.eq('status', statusFilter)
            }

            const { data: additionalData } = await additionalQuery
            additionalFamilies = additionalData || []
          }
        }

        // Combine results
        const allMatches = [...(familyMatches || []), ...additionalFamilies]

        // Get balances for all matching families
        const familyIds = allMatches.map(f => f.id)
        const balanceMap = await calculateFamilyBalances(familyIds)

        // Merge balance into family data
        const familiesWithBalance = allMatches.map(f => ({
          ...f,
          total_balance: balanceMap.get(f.id) || 0
        })) as FamilyWithStudents[]

        // Apply sorting
        if (sortConfig.field === 'display_name') {
          familiesWithBalance.sort((a, b) => {
            const diff = a.display_name.localeCompare(b.display_name)
            return sortConfig.direction === 'asc' ? diff : -diff
          })
        } else if (sortConfig.field === 'total_balance') {
          familiesWithBalance.sort((a, b) => {
            const diff = a.total_balance - b.total_balance
            return sortConfig.direction === 'asc' ? diff : -diff
          })
        } else if (sortConfig.field === 'students') {
          familiesWithBalance.sort((a, b) => {
            const diff = a.students.length - b.students.length
            return sortConfig.direction === 'asc' ? diff : -diff
          })
        }

        // Paginate the results
        const totalCount = familiesWithBalance.length
        const startIdx = (page - 1) * pageSize
        const paginatedFamilies = familiesWithBalance.slice(startIdx, startIdx + pageSize)

        return { families: paginatedFamilies, totalCount }
      }

      // No search query - use original paginated approach
      // For balance sorting, we need a different approach:
      // 1. Get all family balances first
      // 2. Sort by balance
      // 3. Then paginate
      // Note: Limited to 2000 families for balance sorting to prevent memory issues
      const BALANCE_SORT_LIMIT = 2000

      if (sortConfig.field === 'total_balance') {
        // Get balances for families matching the filter (limited to prevent unbounded fetching)
        // Query invoices directly to avoid the Cartesian product bug in family_overview
        let familyQuery = supabase
          .from('families')
          .select('id', { count: 'exact' })
          .limit(BALANCE_SORT_LIMIT)

        if (statusFilter === 'all') {
          // Exclude leads from Directory - they belong in Marketing view
          familyQuery = familyQuery.in('status', ['trial', 'active', 'paused', 'churned'])
        } else {
          familyQuery = familyQuery.eq('status', statusFilter)
        }

        const { data: allFamilyIds, count } = await familyQuery
        const familyIds = (allFamilyIds || []).map((f) => f.id)

        // Get balances from invoices directly (no Cartesian product issue)
        const balanceMap = await calculateFamilyBalances(familyIds)

        // Sort family IDs by balance
        const sortedFamilyIds = familyIds.sort((a: string, b: string) => {
          const balA = balanceMap.get(a) || 0
          const balB = balanceMap.get(b) || 0
          const diff = balA - balB
          return sortConfig.direction === 'asc' ? diff : -diff
        })

        // Paginate the sorted IDs
        const startIdx = (page - 1) * pageSize
        const paginatedIds = sortedFamilyIds.slice(startIdx, startIdx + pageSize)

        if (paginatedIds.length === 0) {
          return { families: [], totalCount: count || 0 }
        }

        // Fetch full family data for paginated IDs
        const { data: familyData, error } = await supabase
          .from('families')
          .select(`*, students (*)`)
          .in('id', paginatedIds)

        if (error) throw error

        // Merge balance and maintain sort order
        const familiesWithBalance = paginatedIds.map((id) => {
          const family = (familyData || []).find((f) => f.id === id)
          return family ? {
            ...family,
            total_balance: balanceMap.get(id) || 0
          } : null
        }).filter(Boolean) as FamilyWithStudents[]

        return { families: familiesWithBalance, totalCount: count || 0 }
      }

      // For non-balance sorting, use original approach but fix balance calculation
      let query = supabase
        .from('families')
        .select(`
          *,
          students (*)
        `, { count: 'exact' })

      // Apply status filter - always exclude 'lead' status (leads belong in Marketing view)
      if (statusFilter === 'all') {
        query = query.in('status', ['trial', 'active', 'paused', 'churned'])
      } else {
        query = query.eq('status', statusFilter)
      }

      // Apply sorting (only for fields that can be sorted server-side)
      if (sortConfig.field === 'display_name') {
        query = query.order('display_name', { ascending: sortConfig.direction === 'asc' })
      } else if (sortConfig.field === 'primary_email') {
        query = query.order('primary_email', { ascending: sortConfig.direction === 'asc' })
      } else if (sortConfig.field === 'status') {
        query = query.order('status', { ascending: sortConfig.direction === 'asc' })
      } else {
        // Default sort for other fields
        query = query.order('display_name')
      }

      // Apply pagination
      query = query.range((page - 1) * pageSize, page * pageSize - 1)

      const { data, error, count } = await query

      if (error) throw error

      const familyData = data || []
      const familyIds = familyData.map(f => f.id)

      // Query invoices directly - NOT the family_overview VIEW
      // The VIEW has a Cartesian product bug that multiplies balances
      const balanceMap = await calculateFamilyBalances(familyIds)

      // Merge balance into family data
      const familiesWithBalance = familyData.map(f => ({
        ...f,
        total_balance: balanceMap.get(f.id) || 0
      })) as FamilyWithStudents[]

      // Client-side sorting for student count
      if (sortConfig.field === 'students') {
        familiesWithBalance.sort((a, b) => {
          const diff = a.students.length - b.students.length
          return sortConfig.direction === 'asc' ? diff : -diff
        })
      }

      return {
        families: familiesWithBalance,
        totalCount: count || 0
      }
    },
  })
}

// =============================================================================
// SELECTION STATE HOOK
// =============================================================================

export interface SelectionState<T extends string> {
  selectedIds: Set<T>
  toggle: (id: T) => void
  toggleAll: (ids: T[], enabled?: boolean) => void
  selectAll: (ids: T[]) => void
  deselectAll: () => void
  isSelected: (id: T) => boolean
  isAllSelected: (ids: T[]) => boolean
  count: number
  clear: () => void
}

/**
 * Hook for managing selection state with toggle/select-all logic.
 * Reusable across any list with checkboxes.
 */
export function useSelectionState<T extends string>(
  disabledIds?: Set<T>
): SelectionState<T> {
  const [selectedIds, setSelectedIds] = useState<Set<T>>(new Set())

  const toggle = useCallback((id: T) => {
    if (disabledIds?.has(id)) return
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [disabledIds])

  const toggleAll = useCallback((ids: T[], enabled?: boolean) => {
    const eligibleIds = disabledIds
      ? ids.filter(id => !disabledIds.has(id))
      : ids

    setSelectedIds(prev => {
      const allSelected = enabled ?? !eligibleIds.every(id => prev.has(id))
      const next = new Set(prev)
      eligibleIds.forEach(id => {
        if (allSelected) {
          next.add(id)
        } else {
          next.delete(id)
        }
      })
      return next
    })
  }, [disabledIds])

  const selectAll = useCallback((ids: T[]) => {
    const eligibleIds = disabledIds
      ? ids.filter(id => !disabledIds.has(id))
      : ids
    setSelectedIds(new Set(eligibleIds))
  }, [disabledIds])

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const isSelected = useCallback((id: T) => selectedIds.has(id), [selectedIds])

  const isAllSelected = useCallback((ids: T[]) => {
    const eligibleIds = disabledIds
      ? ids.filter(id => !disabledIds.has(id))
      : ids
    return eligibleIds.length > 0 && eligibleIds.every(id => selectedIds.has(id))
  }, [selectedIds, disabledIds])

  const clear = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  return {
    selectedIds,
    toggle,
    toggleAll,
    selectAll,
    deselectAll,
    isSelected,
    isAllSelected,
    count: selectedIds.size,
    clear,
  }
}

// =============================================================================
// GENERIC SORT UTILITIES
// =============================================================================

/**
 * Generic sort function for arrays of objects.
 * Supports string comparison, number comparison, and date comparison.
 */
export function sortBy<T>(
  items: T[],
  field: keyof T | ((item: T) => string | number | Date | null | undefined),
  direction: 'asc' | 'desc' = 'asc'
): T[] {
  const sorted = [...items]

  sorted.sort((a, b) => {
    const valueA = typeof field === 'function' ? field(a) : a[field]
    const valueB = typeof field === 'function' ? field(b) : b[field]

    // Handle null/undefined
    if (valueA == null && valueB == null) return 0
    if (valueA == null) return direction === 'asc' ? 1 : -1
    if (valueB == null) return direction === 'asc' ? -1 : 1

    let comparison = 0

    // Date comparison
    if (valueA instanceof Date && valueB instanceof Date) {
      comparison = valueA.getTime() - valueB.getTime()
    }
    // String comparison
    else if (typeof valueA === 'string' && typeof valueB === 'string') {
      comparison = valueA.localeCompare(valueB)
    }
    // Number comparison
    else if (typeof valueA === 'number' && typeof valueB === 'number') {
      comparison = valueA - valueB
    }
    // Fallback to string comparison
    else {
      comparison = String(valueA).localeCompare(String(valueB))
    }

    return direction === 'asc' ? comparison : -comparison
  })

  return sorted
}

/**
 * Multi-field sort function. Sorts by the first field, then by subsequent fields for ties.
 */
export function sortByMultiple<T>(
  items: T[],
  sortFields: Array<{
    field: keyof T | ((item: T) => string | number | Date | null | undefined)
    direction: 'asc' | 'desc'
  }>
): T[] {
  const sorted = [...items]

  sorted.sort((a, b) => {
    for (const { field, direction } of sortFields) {
      const valueA = typeof field === 'function' ? field(a) : a[field]
      const valueB = typeof field === 'function' ? field(b) : b[field]

      // Handle null/undefined
      if (valueA == null && valueB == null) continue
      if (valueA == null) return direction === 'asc' ? 1 : -1
      if (valueB == null) return direction === 'asc' ? -1 : 1

      let comparison = 0

      if (valueA instanceof Date && valueB instanceof Date) {
        comparison = valueA.getTime() - valueB.getTime()
      } else if (typeof valueA === 'string' && typeof valueB === 'string') {
        comparison = valueA.localeCompare(valueB)
      } else if (typeof valueA === 'number' && typeof valueB === 'number') {
        comparison = valueA - valueB
      } else {
        comparison = String(valueA).localeCompare(String(valueB))
      }

      if (comparison !== 0) {
        return direction === 'asc' ? comparison : -comparison
      }
    }
    return 0
  })

  return sorted
}

// =============================================================================
// BULK ACTION HOOK
// =============================================================================

export interface BulkActionResult {
  succeeded: number
  failed: number
  failedIds: string[]
}

export interface UseBulkActionOptions<T, R = void> {
  /** The async action to perform for each item */
  action: (id: string, data: T) => Promise<R>
  /** Callback when all actions complete successfully */
  onSuccess?: (result: BulkActionResult) => void
  /** Callback when some actions fail */
  onPartialSuccess?: (result: BulkActionResult) => void
  /** Callback when all actions fail */
  onError?: (error: Error, result: BulkActionResult) => void
}

/**
 * Hook for handling bulk actions (status updates, deletes, etc.) with
 * proper error tracking and partial success handling.
 */
export function useBulkAction<T = void, R = void>(options: UseBulkActionOptions<T, R>) {
  const [isExecuting, setIsExecuting] = useState(false)
  const [result, setResult] = useState<BulkActionResult | null>(null)

  const execute = useCallback(async (ids: string[], data: T): Promise<BulkActionResult> => {
    if (ids.length === 0) {
      return { succeeded: 0, failed: 0, failedIds: [] }
    }

    setIsExecuting(true)
    setResult(null)

    try {
      const results = await Promise.allSettled(
        ids.map(id => options.action(id, data))
      )

      const succeeded = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length
      const failedIds = ids.filter((_, i) => results[i].status === 'rejected')

      const actionResult: BulkActionResult = { succeeded, failed, failedIds }
      setResult(actionResult)

      if (failed === 0) {
        options.onSuccess?.(actionResult)
      } else if (succeeded > 0) {
        options.onPartialSuccess?.(actionResult)
      } else {
        const firstError = results.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined
        options.onError?.(
          firstError?.reason instanceof Error ? firstError.reason : new Error('All actions failed'),
          actionResult
        )
      }

      return actionResult
    } catch (error) {
      const actionResult: BulkActionResult = { succeeded: 0, failed: ids.length, failedIds: ids }
      setResult(actionResult)
      options.onError?.(error instanceof Error ? error : new Error('Bulk action failed'), actionResult)
      return actionResult
    } finally {
      setIsExecuting(false)
    }
  }, [options])

  const reset = useCallback(() => {
    setResult(null)
  }, [])

  return {
    execute,
    isExecuting,
    result,
    reset,
  }
}

// =============================================================================
// ADMIN UTILITIES - DUPLICATE DETECTION
// =============================================================================

export interface PotentialDuplicateFamily {
  family_1_id: string
  display_name: string
  email_1: string
  secondary_email_1: string | null
  family_2_id: string
  email_2: string
  secondary_email_2: string | null
  status_1: string
  status_2: string
  created_at_1: string
  created_at_2: string
}

/**
 * Hook to fetch potential duplicate families for admin review.
 * Returns families with matching names but different emails.
 * Note: Requires 20260121_add_duplicate_detection_view.sql migration to be applied.
 */
export function usePotentialDuplicates() {
  return useQuery({
    queryKey: queryKeys.admin.potentialDuplicates(),
    queryFn: async () => {
      // Using raw SQL query since the view/function may not be in generated types yet
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('get_potential_duplicate_families')

      if (error) {
        // If the function doesn't exist, return empty array
        if (error.message?.includes('does not exist')) {
          console.warn('get_potential_duplicate_families function not found - migration may not be applied')
          return [] as PotentialDuplicateFamily[]
        }
        throw error
      }
      return (data || []) as PotentialDuplicateFamily[]
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - not frequently changing
  })
}

export interface FamilyMergeLogEntry {
  id: string
  family_id: string | null
  matched_by: string
  original_email: string | null
  new_email: string | null
  purchaser_name: string | null
  source: string
  source_id: string | null
  created_at: string
}

/**
 * Hook to fetch family merge log for audit review.
 * Shows history of name-based matches and manual merges.
 * Note: Requires 20260121_add_duplicate_prevention_schema.sql migration to be applied.
 */
export function useFamilyMergeLog() {
  return useQuery({
    queryKey: queryKeys.admin.familyMergeLog(),
    queryFn: async () => {
      // Using raw SQL query since the table/function may not be in generated types yet
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('get_family_merge_log', { limit_count: 100 })

      if (error) {
        // If the function doesn't exist, return empty array
        if (error.message?.includes('does not exist')) {
          console.warn('get_family_merge_log function not found - migration may not be applied')
          return [] as FamilyMergeLogEntry[]
        }
        throw error
      }
      return (data || []) as FamilyMergeLogEntry[]
    },
    staleTime: 60 * 1000, // 1 minute
  })
}

// =============================================================================
// SMS HOOKS
// =============================================================================

// Note: SMS tables may not be in generated types yet. Using type assertions.
// Run `npm run db:types` after applying the migration to update types.

/**
 * Hook to fetch SMS messages with optional filtering.
 */
export function useSmsMessages(filters?: SmsMessageFilters) {
  return useQuery({
    queryKey: queryKeys.sms.messages(filters),
    queryFn: async () => {
      let query = supabase.from('sms_messages')
        .select(`
          *,
          family:families(display_name, primary_email)
        `)
        .order('created_at', { ascending: false })
        .limit(filters?.limit ?? 500)

      if (filters?.familyId) {
        query = query.eq('family_id', filters.familyId)
      }

      if (filters?.invoiceId) {
        query = query.eq('invoice_id', filters.invoiceId)
      }

      if (filters?.status) {
        query = query.eq('status', filters.status)
      }

      if (filters?.messageType) {
        query = query.eq('message_type', filters.messageType)
      }

      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom)
      }

      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo)
      }

      const { data, error } = await query
      if (error) {
        // If the table doesn't exist, return empty array
        if (error.message?.includes('does not exist')) {
          console.warn('sms_messages table not found - migration may not be applied')
          return [] as SmsMessage[]
        }
        throw error
      }
      return (data || []) as SmsMessage[]
    },
  })
}

/**
 * Hook to fetch SMS messages for a specific family.
 */
export function useSmsByFamily(familyId: string) {
  return useQuery({
    queryKey: queryKeys.sms.byFamily(familyId),
    queryFn: async () => {
      const { data, error } = await supabase.from('sms_messages')
        .select('*')
        .eq('family_id', familyId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        if (error.message?.includes('does not exist')) {
          return [] as SmsMessage[]
        }
        throw error
      }
      return (data || []) as SmsMessage[]
    },
    enabled: !!familyId,
  })
}

/**
 * Hook to fetch SMS messages for a specific invoice.
 */
export function useSmsByInvoice(invoiceId: string) {
  return useQuery({
    queryKey: queryKeys.sms.byInvoice(invoiceId),
    queryFn: async () => {
      const { data, error } = await supabase.from('sms_messages')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        if (error.message?.includes('does not exist')) {
          return [] as SmsMessage[]
        }
        throw error
      }
      return (data || []) as SmsMessage[]
    },
    enabled: !!invoiceId,
  })
}

/**
 * Hook for SMS mutations (send, update opt-out).
 */
export function useSmsMutations() {
  const queryClient = useQueryClient()

  const sendSms = useMutation({
    mutationFn: async (params: {
      familyId?: string
      familyIds?: string[]
      toPhone?: string
      messageBody: string
      messageType?: SmsMessageType
      invoiceId?: string
      templateKey?: string
      mergeData?: Record<string, unknown>
      campaignName?: string
      mediaUrls?: string[]
      sentBy?: string
    }) => {
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          familyId: params.familyId,
          familyIds: params.familyIds,
          toPhone: params.toPhone,
          messageBody: params.messageBody,
          messageType: params.messageType || 'custom',
          invoiceId: params.invoiceId,
          templateKey: params.templateKey,
          mergeData: params.mergeData,
          campaignName: params.campaignName,
          mediaUrls: params.mediaUrls,
          sentBy: params.sentBy || 'admin',
        },
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data as { success: boolean; sent: number; failed: number; skipped: number }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sms.all })
      if (variables.familyId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.sms.byFamily(variables.familyId) })
      }
      if (variables.invoiceId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.sms.byInvoice(variables.invoiceId) })
      }
    },
  })

  const updateOptOut = useMutation({
    mutationFn: async ({ familyId, optOut }: { familyId: string; optOut: boolean }) => {
      // Note: sms_opt_out fields may not be in generated types yet
      // Using raw SQL via rpc would be cleaner but update works with type assertion
      type FamilyUpdate = { sms_opt_out: boolean; sms_opt_out_at: string | null }
      const updateData: FamilyUpdate = {
        sms_opt_out: optOut,
        sms_opt_out_at: optOut ? new Date().toISOString() : null,
      }
      const { error } = await supabase
        .from('families')
        .update(updateData as unknown as Record<string, never>)
        .eq('id', familyId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.families.all })
    },
  })

  return {
    sendSms,
    updateOptOut,
  }
}

/**
 * Hook to fetch SMS media library.
 */
export function useSmsMedia() {
  return useQuery({
    queryKey: queryKeys.smsMedia.list(),
    queryFn: async () => {
      const { data, error } = await supabase.from('sms_media')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        if (error.message?.includes('does not exist')) {
          return [] as SmsMedia[]
        }
        throw error
      }
      return (data || []) as SmsMedia[]
    },
  })
}