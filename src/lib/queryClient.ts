import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 30 seconds
      staleTime: 30 * 1000,
      // Cache data for 5 minutes
      gcTime: 5 * 60 * 1000,
      // Refetch when window regains focus
      refetchOnWindowFocus: true,
      // Retry failed requests once
      retry: 1,
    },
  },
})

// Query key factory for consistent keys across the app
export const queryKeys = {
  // Families
  families: {
    all: ['families'] as const,
    list: (filters?: { status?: string; search?: string }) => 
      ['families', 'list', filters] as const,
    detail: (id: string) => ['families', 'detail', id] as const,
    withStudents: () => ['families', 'withStudents'] as const,
  },
  
  // Students
  students: {
    all: ['students'] as const,
    byFamily: (familyId: string) => ['students', 'byFamily', familyId] as const,
    detail: (id: string) => ['students', 'detail', id] as const,
  },
  
  // Teachers
  teachers: {
    all: ['teachers'] as const,
    list: (filters?: { status?: string }) => 
      ['teachers', 'list', filters] as const,
    detail: (id: string) => ['teachers', 'detail', id] as const,
    active: () => ['teachers', 'active'] as const,
    // NEW: For teachers with load calculations
    withLoad: (filters?: { status?: string }) =>
      ['teachers', 'withLoad', filters] as const,
    withLoadSingle: (id: string) =>
      ['teachers', 'withLoad', 'single', id] as const,
  },
  
  // Services
  services: {
    all: ['services'] as const,
    active: () => ['services', 'active'] as const,
  },
  
  // Enrollments
  enrollments: {
    all: ['enrollments'] as const,
    list: (filters?: { status?: string; serviceId?: string }) => 
      ['enrollments', 'list', filters] as const,
    detail: (id: string) => ['enrollments', 'detail', id] as const,
    byFamily: (familyId: string) => ['enrollments', 'byFamily', familyId] as const,
    byStudent: (studentId: string) => ['enrollments', 'byStudent', studentId] as const,
    // NEW: For billable enrollments in invoice generation
    billable: (serviceFilter?: string) => 
      serviceFilter 
        ? ['enrollments', 'billable', serviceFilter] as const 
        : ['enrollments', 'billable'] as const,
  },
  
  // Teacher Assignments
  teacherAssignments: {
    all: ['teacher-assignments'] as const,
    byEnrollment: (enrollmentId: string) => ['teacher-assignments', 'enrollment', enrollmentId] as const,
    byTeacher: (teacherId: string) => ['teacher-assignments', 'teacher', teacherId] as const,
    // NEW: For service-level assignments
    serviceLevel: () => ['teacher-assignments', 'serviceLevel'] as const,
    serviceLevelByTeacher: (teacherId: string) => ['teacher-assignments', 'serviceLevel', teacherId] as const,
  },
  
  // Invoices
  invoices: {
    all: ['invoices'] as const,
    list: (filters?: { status?: string | string[]; familyId?: string }) =>
      ['invoices', 'list', filters] as const,
    detail: (id: string) => ['invoices', 'detail', id] as const,
    byFamily: (familyId: string) => ['invoices', 'byFamily', familyId] as const,
    // NEW: For invoices with line items and derived services
    withDetails: (filters?: { status?: string | string[] }) =>
      filters 
        ? ['invoices', 'withDetails', filters] as const 
        : ['invoices', 'withDetails'] as const,
    // NEW: For checking duplicate invoices by period
    byPeriod: (periodStart: string, periodEnd: string) =>
      ['invoices', 'byPeriod', periodStart, periodEnd] as const,
  },

  // Invoice Emails
  invoiceEmails: {
    all: ['invoiceEmails'] as const,
    byInvoice: (invoiceId: string) => ['invoiceEmails', 'byInvoice', invoiceId] as const,
    byFamily: (familyId: string) => ['invoiceEmails', 'byFamily', familyId] as const,
  },
  
  // Teacher Payments
  teacherPayments: {
    all: ['teacherPayments'] as const,
    byTeacher: (teacherId: string) => 
      ['teacherPayments', 'byTeacher', teacherId] as const,
  },
  
  // App Settings
  settings: {
    all: ['settings'] as const,
    byKey: (key: string) => ['settings', key] as const,
  },
  
  // Tags
  tags: {
    all: ['tags'] as const,
  },
  
  // Dashboard/Stats
  stats: {
    dashboard: () => ['stats', 'dashboard'] as const,
    roster: () => ['stats', 'roster'] as const,
  },

  // Gmail
  gmail: {
    all: ['gmail'] as const,
    search: (email: string) => ['gmail', 'search', email] as const,
    thread: (threadId: string) => ['gmail', 'thread', threadId] as const,
  },

  // Payroll
  payroll: {
    all: ['payroll'] as const,
    runs: (filters?: { status?: string }) =>
      ['payroll', 'runs', filters] as const,
    runDetail: (id: string) => ['payroll', 'run', id] as const,
    runWithItems: (id: string) => ['payroll', 'run', id, 'items'] as const,
    lineItems: (runId: string) => ['payroll', 'lineItems', runId] as const,
    byTeacher: (teacherId: string) => ['payroll', 'teacher', teacherId] as const,
    pendingAdjustments: (teacherId?: string) =>
      teacherId
        ? ['payroll', 'adjustments', 'pending', teacherId] as const
        : ['payroll', 'adjustments', 'pending'] as const,
  },

  // Leads
  leads: {
    all: ['leads'] as const,
    list: (filters?: { type?: string; status?: string; search?: string }) =>
      ['leads', 'list', filters] as const,
    detail: (id: string) => ['leads', 'detail', id] as const,
    pipeline: () => ['leads', 'pipeline'] as const,
  },

  // Lead Activities
  leadActivities: {
    all: ['leadActivities'] as const,
    byLead: (leadId: string) => ['leadActivities', 'byLead', leadId] as const,
  },

  // Lead Follow-ups
  leadFollowUps: {
    all: ['leadFollowUps'] as const,
    byLead: (leadId: string) => ['leadFollowUps', 'byLead', leadId] as const,
    upcoming: () => ['leadFollowUps', 'upcoming'] as const,
  },
}