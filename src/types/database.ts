// Enum types matching database
export type CustomerStatus = 'lead' | 'trial' | 'active' | 'paused' | 'churned'
export type EnrollmentStatus = 'trial' | 'active' | 'paused' | 'ended'
export type EmployeeStatus = 'active' | 'reserve' | 'inactive'
export type BillingFrequency = 'per_session' | 'weekly' | 'monthly' | 'bi_monthly' | 'annual' | 'one_time'
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'void'
export type CommChannel = 'email' | 'sms' | 'call' | 'in_person' | 'other'
export type CommDirection = 'inbound' | 'outbound'
export type WorkflowStatus = 'queued' | 'running' | 'success' | 'error'

// Service codes
export type ServiceCode = 
  | 'learning_pod'
  | 'academic_coaching'
  | 'consulting_with_teacher'
  | 'consulting_only'
  | 'eaton_online'
  | 'eaton_hub'
  | 'elective_classes'

// Table row types
export interface Service {
  id: string
  code: ServiceCode
  name: string
  billing_frequency: BillingFrequency
  default_customer_rate: number | null
  default_teacher_rate: number | null
  requires_teacher: boolean
  description: string | null
  is_active: boolean
  created_at: string
}

export interface Tag {
  id: string
  name: string
  color: string
  created_at: string
}

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
  state: string
  zip: string | null
  last_contact_at: string | null
  reengagement_flag: boolean
  notes: string | null
  legacy_lookup_key: string | null
  created_at: string
  updated_at: string
}

export interface FamilyContact {
  id: string
  family_id: string
  name: string
  role: string | null
  email: string | null
  phone: string | null
  is_primary: boolean
  created_at: string
}

export interface Student {
  id: string
  family_id: string
  full_name: string
  dob: string | null
  grade_level: string | null
  age_group: string | null
  homeschool_status: string | null
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

export interface TeacherHours {
  id: string
  teacher_assignment_id: string
  week_start: string
  week_end: string
  agreed_hours: number | null
  hours_worked: number | null
  hour_adjustments: number | null
  invoice_line_item_id: string | null
  teacher_payment_line_item_id: string | null
  notes: string | null
  created_at: string
}

export interface HubSession {
  id: string
  student_id: string
  session_date: string
  daily_rate: number
  invoice_line_item_id: string | null
  teacher_id: string | null
  notes: string | null
  created_at: string
}

export interface Invoice {
  id: string
  family_id: string
  invoice_number: string | null
  public_id: string
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
  sent_to: string | null
  viewed_at: string | null
  pdf_storage_path: string | null
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
}

export interface Payment {
  id: string
  invoice_id: string
  amount: number
  payment_date: string
  payment_method: string | null
  reference: string | null
  notes: string | null
  created_at: string
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

export interface TeacherPaymentLineItem {
  id: string
  teacher_payment_id: string
  service_id: string | null
  enrollment_id: string | null
  description: string
  hours: number | null
  hourly_rate: number | null
  amount: number
  created_at: string
}

export interface EmailTemplate {
  id: string
  template_key: string
  name: string
  subject: string
  body_html: string
  body_text: string | null
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WorkflowRun {
  id: string
  workflow_key: string
  status: WorkflowStatus
  payload: Record<string, unknown> | null
  response: Record<string, unknown> | null
  error_message: string | null
  triggered_by: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface Communication {
  id: string
  family_id: string
  channel: CommChannel
  direction: CommDirection
  subject: string | null
  summary: string | null
  workflow_run_id: string | null
  logged_at: string
  created_at: string
}

export interface SavedView {
  id: string
  name: string
  entity_type: string
  filter_config: Record<string, unknown>
  column_config: Record<string, unknown> | null
  sort_config: Record<string, unknown> | null
  is_default: boolean
  created_at: string
}

export interface AppSetting {
  key: string
  value: Record<string, unknown>
  description: string | null
  updated_at: string
}

// Extended types with relations (for joins)
export interface FamilyWithStudents extends Family {
  students: Student[]
}

export interface FamilyWithEnrollments extends Family {
  students: Student[]
  enrollments: (Enrollment & { service: Service })[]
}

export interface EnrollmentWithDetails extends Enrollment {
  service: Service
  student: Student | null
  teacher_assignments: (TeacherAssignment & { teacher: Teacher })[]
}

export interface TeacherWithAssignments extends Teacher {
  teacher_assignments: (TeacherAssignment & { 
    enrollment: Enrollment & { 
      student: Student | null
      service: Service 
    }
  })[]
}

// View types
export interface FamilyOverview {
  id: string
  display_name: string
  status: CustomerStatus
  primary_email: string | null
  primary_phone: string | null
  payment_gateway: string | null
  last_contact_at: string | null
  student_count: number
  active_enrollment_count: number
  total_balance: number
}

export interface TeacherLoad {
  id: string
  display_name: string
  role: string | null
  status: EmployeeStatus
  max_hours_per_week: number | null
  active_assignments: number
  assigned_hours_per_week: number
  available_hours: number | null
}

// Database type for Supabase client
export interface Database {
  public: {
    Tables: {
      services: {
        Row: Service
        Insert: Omit<Service, 'id' | 'created_at'>
        Update: Partial<Omit<Service, 'id' | 'created_at'>>
      }
      tags: {
        Row: Tag
        Insert: Omit<Tag, 'id' | 'created_at'>
        Update: Partial<Omit<Tag, 'id' | 'created_at'>>
      }
      families: {
        Row: Family
        Insert: Omit<Family, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Family, 'id' | 'created_at' | 'updated_at'>>
      }
      family_contacts: {
        Row: FamilyContact
        Insert: Omit<FamilyContact, 'id' | 'created_at'>
        Update: Partial<Omit<FamilyContact, 'id' | 'created_at'>>
      }
      students: {
        Row: Student
        Insert: Omit<Student, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Student, 'id' | 'created_at' | 'updated_at'>>
      }
      teachers: {
        Row: Teacher
        Insert: Omit<Teacher, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Teacher, 'id' | 'created_at' | 'updated_at'>>
      }
      enrollments: {
        Row: Enrollment
        Insert: Omit<Enrollment, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Enrollment, 'id' | 'created_at' | 'updated_at'>>
      }
      teacher_assignments: {
        Row: TeacherAssignment
        Insert: Omit<TeacherAssignment, 'id' | 'created_at'>
        Update: Partial<Omit<TeacherAssignment, 'id' | 'created_at'>>
      }
      teacher_hours: {
        Row: TeacherHours
        Insert: Omit<TeacherHours, 'id' | 'created_at'>
        Update: Partial<Omit<TeacherHours, 'id' | 'created_at'>>
      }
      hub_sessions: {
        Row: HubSession
        Insert: Omit<HubSession, 'id' | 'created_at'>
        Update: Partial<Omit<HubSession, 'id' | 'created_at'>>
      }
      invoices: {
        Row: Invoice
        Insert: Omit<Invoice, 'id' | 'created_at' | 'updated_at' | 'public_id' | 'balance_due'>
        Update: Partial<Omit<Invoice, 'id' | 'created_at' | 'updated_at' | 'public_id' | 'balance_due'>>
      }
      invoice_line_items: {
        Row: InvoiceLineItem
        Insert: Omit<InvoiceLineItem, 'id' | 'created_at'>
        Update: Partial<Omit<InvoiceLineItem, 'id' | 'created_at'>>
      }
      payments: {
        Row: Payment
        Insert: Omit<Payment, 'id' | 'created_at'>
        Update: Partial<Omit<Payment, 'id' | 'created_at'>>
      }
      teacher_payments: {
        Row: TeacherPayment
        Insert: Omit<TeacherPayment, 'id' | 'created_at'>
        Update: Partial<Omit<TeacherPayment, 'id' | 'created_at'>>
      }
      teacher_payment_line_items: {
        Row: TeacherPaymentLineItem
        Insert: Omit<TeacherPaymentLineItem, 'id' | 'created_at'>
        Update: Partial<Omit<TeacherPaymentLineItem, 'id' | 'created_at'>>
      }
      email_templates: {
        Row: EmailTemplate
        Insert: Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'>>
      }
      workflow_runs: {
        Row: WorkflowRun
        Insert: Omit<WorkflowRun, 'id' | 'created_at'>
        Update: Partial<Omit<WorkflowRun, 'id' | 'created_at'>>
      }
      communications: {
        Row: Communication
        Insert: Omit<Communication, 'id' | 'created_at'>
        Update: Partial<Omit<Communication, 'id' | 'created_at'>>
      }
      saved_views: {
        Row: SavedView
        Insert: Omit<SavedView, 'id' | 'created_at'>
        Update: Partial<Omit<SavedView, 'id' | 'created_at'>>
      }
      app_settings: {
        Row: AppSetting
        Insert: Omit<AppSetting, 'updated_at'>
        Update: Partial<Omit<AppSetting, 'updated_at'>>
      }
    }
    Views: {
      family_overview: {
        Row: FamilyOverview
      }
      teacher_load: {
        Row: TeacherLoad
      }
    }
    Enums: {
      customer_status: CustomerStatus
      enrollment_status: EnrollmentStatus
      employee_status: EmployeeStatus
      billing_frequency: BillingFrequency
      invoice_status: InvoiceStatus
      comm_channel: CommChannel
      comm_direction: CommDirection
      workflow_status: WorkflowStatus
    }
  }
}