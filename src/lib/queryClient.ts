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
  },
  
  // Teacher Assignments
  teacherAssignments: {
  all: ['teacher-assignments'] as const,
  byEnrollment: (enrollmentId: string) => [...queryKeys.teacherAssignments.all, 'enrollment', enrollmentId] as const,
  byTeacher: (teacherId: string) => [...queryKeys.teacherAssignments.all, 'teacher', teacherId] as const,
},
  
  // Invoices
  invoices: {
    all: ['invoices'] as const,
    list: (filters?: { status?: string; familyId?: string }) => 
      ['invoices', 'list', filters] as const,
    detail: (id: string) => ['invoices', 'detail', id] as const,
    byFamily: (familyId: string) => ['invoices', 'byFamily', familyId] as const,
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
}
