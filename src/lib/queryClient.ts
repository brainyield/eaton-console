import { QueryClient, MutationCache } from '@tanstack/react-query'
import { getGlobalToast } from './toast'

// Extract user-friendly error message from various error types
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Handle Supabase/PostgreSQL errors
    const msg = error.message
    if (msg.includes('duplicate key')) return 'This record already exists'
    if (msg.includes('violates foreign key')) return 'Cannot delete: this record is referenced by other data'
    if (msg.includes('violates not-null')) return 'Required field is missing'
    if (msg.includes('JWT')) return 'Session expired. Please refresh the page.'
    return msg
  }
  if (typeof error === 'string') return error
  return 'An unexpected error occurred'
}

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
    mutations: {
      // Global mutation error handler - shows toast for unhandled errors
      onError: (error) => {
        console.error('Mutation error:', error)
        const showToast = getGlobalToast()
        if (showToast) {
          showToast(getErrorMessage(error), 'error')
        }
      },
    },
  },
  // MutationCache for more granular control
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      // Only show global error if mutation doesn't have its own onError handler
      if (!mutation.options.onError) {
        console.error('Unhandled mutation error:', error)
        const showToast = getGlobalToast()
        if (showToast) {
          showToast(getErrorMessage(error), 'error')
        }
      }
    },
  }),
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
    // NEW: For teacher desk token lookup
    byToken: (token: string) => ['teachers', 'byToken', token] as const,
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

  // Event Orders
  eventOrders: {
    all: ['event_orders'] as const,
    pending: () => ['event_orders', 'pending'] as const,
    pendingEvents: (familyId?: string) => ['event_orders', 'pending', 'events', familyId || 'all'] as const,
    pendingClasses: () => ['event_orders', 'pending', 'classes'] as const,
  },

  // Hub Sessions
  hubSessions: {
    all: ['hub_sessions'] as const,
    pending: () => ['hub_sessions', 'pending'] as const,
  },

  // Invoice Payments
  invoicePayments: {
    all: ['invoice_payments'] as const,
    byInvoice: (invoiceId: string) => ['invoice_payments', invoiceId] as const,
  },

  // Email Campaigns
  emailCampaigns: {
    all: ['email_campaigns'] as const,
    list: () => ['email_campaigns', 'list'] as const,
    detail: (id: string) => ['email_campaigns', 'detail', id] as const,
  },

  // Lead Campaign Engagement
  leadCampaignEngagement: {
    all: ['lead_campaign_engagement'] as const,
    byCampaign: (campaignId: string) => ['lead_campaign_engagement', 'campaign', campaignId] as const,
    byLead: (leadId: string) => ['lead_campaign_engagement', 'lead', leadId] as const,
  },

  // Events
  events: {
    all: ['events'] as const,
    list: () => ['events', 'list'] as const,
    detail: (id: string) => ['events', 'detail', id] as const,
    attendees: () => ['events', 'all-attendees'] as const,
  },

  // Reports
  reports: {
    all: ['reports'] as const,
    revenue: (startDate: string) => ['reports', 'revenue', startDate] as const,
    enrollments: () => ['reports', 'enrollments'] as const,
    balances: () => ['reports', 'balances'] as const,
    payroll: (startDate: string) => ['reports', 'payroll', startDate] as const,
  },

  // Check-ins (Teacher's Desk)
  checkins: {
    all: ['checkins'] as const,
    periods: () => ['checkins', 'periods'] as const,
    periodDetail: (id: string) => ['checkins', 'periods', id] as const,
    periodSummary: () => ['checkins', 'periods', 'summary'] as const,
    invites: (periodId: string) => ['checkins', 'invites', periodId] as const,
    invitesByTeacher: (teacherId: string) => ['checkins', 'invites', 'teacher', teacherId] as const,
    response: (inviteId: string) => ['checkins', 'response', inviteId] as const,
    responseWithResources: (inviteId: string) => ['checkins', 'response', inviteId, 'resources'] as const,
    teacherStudents: (teacherId: string) => ['checkins', 'teacherStudents', teacherId] as const,
  },
}