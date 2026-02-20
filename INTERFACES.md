# INTERFACES.md — Eaton Console Architecture Reference

> Single source of truth for how every module, service, and integration in this system talks to everything else.
> Describes interfaces only — not implementation details. Input > magic > output.
> Last updated: 2026-02-19

---

## System Map

```
                                    EXTERNAL SERVICES
                    ┌─────────────────────────────────────────────┐
                    │  Calendly   Stripe   Twilio   Mailchimp     │
                    │  Google Forms   Gmail (via N8N)              │
                    └────┬──────────┬────────┬────────┬───────────┘
                         │          │        │        │
                    ┌────▼──────────▼────────▼────────▼───────────┐
                    │        SUPABASE EDGE FUNCTIONS               │
                    │  calendly-webhook    stripe-webhook          │
                    │  send-sms            twilio-status-webhook   │
                    │  twilio-opt-out      mailchimp               │
                    │  ingest-lead         create-checkout-session │
                    │  send-onboarding     check-onboarding-status │
                    │  form-submitted      get-pending-onboarding  │
                    │  mark-invoice-viewed                         │
                    └────┬───────────────────────┬────────────────┘
                         │                       │
                    ┌────▼───────────────────────▼────────────────┐
                    │           SUPABASE DATABASE                  │
                    │                                              │
                    │  Tables: families, students, enrollments,    │
                    │  invoices, payments, teachers, services,     │
                    │  sms_messages, revenue_records, payroll_*,   │
                    │  lead_activities, lead_follow_ups,           │
                    │  enrollment_onboarding, calendly_bookings,   │
                    │  event_orders, checkin_*, app_settings       │
                    │                                              │
                    │  Triggers: T1 invoice_number, T2 revenue,   │
                    │  T3 payment→invoice, T4/T5 lead_convert,     │
                    │  T6 mailchimp_sync, T7-T10 event_reg,        │
                    │  T11 desk_token, T12 updated_at (×13)        │
                    │                                              │
                    │  RPCs: get_revenue_by_month,                 │
                    │        get_revenue_by_location               │
                    └────┬───────────────────────┬────────────────┘
                         │                       │
                    ┌────▼───────────────────────▼────────────────┐
                    │           REACT QUERY LAYER                  │
                    │  hooks.ts (80+ hooks)                        │
                    │  queryClient.ts (30+ query key namespaces)   │
                    └────┬───────────────────────┬────────────────┘
                         │                       │
       ┌─────────────────┤                       ├──────────────────┐
       │                 │                       │                  │
  ┌────▼────┐  ┌─────────▼──────┐  ┌────────────▼────┐  ┌─────────▼──────┐
  │  Pages  │  │  Detail Panels │  │     Modals      │  │   Utilities    │
  │ 12 views│  │  6 panels      │  │  26+ dialogs    │  │  dateUtils     │
  │         │  │                │  │                  │  │  moneyUtils    │
  └─────────┘  └────────────────┘  └──────────────────┘  │  phoneUtils    │
                                                          │  smsTemplates  │
       ┌──────────────────────────────────────────┐       │  invoicePdf    │
       │          N8N CLOUD WORKFLOWS              │       │  validation    │
       │  gmail-search / gmail-thread / gmail-send │       └────────────────┘
       │  invoice-send / payroll-notification      │
       │  checkin-notify / checkin-training         │
       │  newsletter (zueutqemoLNaAPk7)            │
       └───────────────────────────────────────────┘
```

### Data Flow Summary

```
User Action → React Component → Hook (mutation) → Supabase / Edge Function / N8N
                                                        │
                                                   DB Trigger fires
                                                        │
                                              Secondary effects
                                        (revenue records, lead conversion,
                                         mailchimp sync, invoice numbers)
```

### Public Routes (no auth)

```
/desk/:token              → TeacherDesk (teacher check-in portal)
/desk/:token/checkin/:id  → CheckinForm (teacher assessment form)
/invoice/:publicId        → PublicInvoicePage (customer invoice view + Stripe pay)
```

---

## Modules

### 1. Supabase Client

| Field | Value |
|-------|-------|
| **What** | Typed Supabase client for all database operations |
| **File** | `src/lib/supabase.ts` |
| **Inputs** | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` env vars |
| **Outputs** | `supabase` client instance (typed with `Database` from `supabase.ts`) |
| **Talks to** | Every hook, every edge function invocation |
| **External deps** | Supabase PostgreSQL (project ref `lxebvngzgabuqfugyqfj`) |

---

### 2. React Query Layer

| Field | Value |
|-------|-------|
| **What** | Server state management with 80+ hooks and 30+ query key namespaces |
| **Files** | `src/lib/hooks.ts`, `src/lib/queryClient.ts` |

#### 2a. Query Client (`queryClient.ts`)

| Field | Value |
|-------|-------|
| **What** | React Query configuration and query key factory |
| **Inputs** | None |
| **Outputs** | `queryClient` instance, `queryKeys` factory object |
| **Talks to** | All hooks in `hooks.ts`, global error handler via `getGlobalToast()` |
| **Config** | `staleTime: 30s`, `gcTime: 5min`, `refetchOnWindowFocus: true`, `retry: 1` |

**Query Key Namespaces:**

| Namespace | Keys |
|-----------|------|
| `families` | `all`, `list(filters)`, `detail(id)`, `withStudents()` |
| `students` | `all`, `byFamily(id)`, `detail(id)` |
| `teachers` | `all`, `list(filters)`, `detail(id)`, `active()`, `withLoad(filters)`, `withLoadSingle(id)`, `byToken(token)` |
| `services` | `all`, `active()` |
| `locations` | `all`, `active()` |
| `enrollments` | `all`, `list(filters)`, `detail(id)`, `byFamily(id)`, `byStudent(id)`, `billable(serviceFilter)`, `onboarding(id)` |
| `teacherAssignments` | `all`, `byEnrollment(id)`, `byTeacher(id)`, `serviceLevel()`, `serviceLevelByTeacher(id)` |
| `invoices` | `all`, `list(filters)`, `detail(id)`, `byFamily(id)`, `withDetails(filters)`, `byPeriod(start, end)` |
| `invoiceEmails` | `all`, `byInvoice(id)`, `byFamily(id)` |
| `invoicePayments` | `all`, `byInvoice(id)` |
| `teacherPayments` | `all`, `byTeacher(id)` |
| `payroll` | `all`, `runs(filters)`, `runDetail(id)`, `runWithItems(id)`, `lineItems(id)`, `byTeacher(id)`, `pendingAdjustments(teacherId)` |
| `leads` | `all`, `list(filters)`, `detail(id)`, `pipeline()`, `converted()` |
| `leadActivities` | `all`, `byLead(id)` |
| `leadFollowUps` | `all`, `byLead(id)`, `upcoming()` |
| `eventOrders` | `all`, `pending()`, `pendingEvents(familyId)`, `pendingClasses()` |
| `hubSessions` | `all`, `pending()` |
| `emailCampaigns` | `all`, `list()`, `detail(id)` |
| `leadCampaignEngagement` | `all`, `byCampaign(id)`, `byLead(id)` |
| `events` | `all`, `list()`, `detail(id)`, `attendees()` |
| `reports` | `all`, `revenue(startDate)`, `enrollments()`, `balances()`, `payroll(startDate)`, `location(startDate)` |
| `checkins` | `all`, `periods()`, `periodDetail(id)`, `periodSummary()`, `invites(periodId)`, `invitesByTeacher(teacherId)`, `response(inviteId)`, `responseWithResources(inviteId)`, `teacherStudents(teacherId)` |
| `admin` | `all`, `potentialDuplicates()`, `familyMergeLog()` |
| `sms` | `all`, `messages(filters)`, `byFamily(id)`, `byInvoice(id)` |
| `smsMedia` | `all`, `list()` |
| `gmail` | `all`, `search(email)`, `thread(threadId)` |
| `settings` | `all`, `byKey(key)` |
| `tags` | `all` |
| `stats` | `dashboard()` (60s staleTime), `roster()` |

#### 2b. Hooks (`hooks.ts`)

| Field | Value |
|-------|-------|
| **What** | Centralized data fetching and mutation hooks for all domains |
| **Inputs** | Filter params, entity IDs, mutation payloads |
| **Outputs** | Query results `{ data, isLoading, error }`, mutation functions returning `{ data, warnings: string[] }` |
| **Talks to** | Supabase client, `gmail.ts`, `mailchimp.ts`, `smsTemplates.ts`, all utility modules |
| **External deps** | Supabase (all tables), N8N (via `gmail.ts`), Mailchimp (via `mailchimp.ts`) |

**Complete Hook Catalog (by domain):**

---

##### Families

| Hook | Type | Inputs | Returns | Tables |
|------|------|--------|---------|--------|
| `useFamilies(filters?)` | Query | `{ status?, search? }` | `Family[]` | `families` |
| `useFamiliesWithStudents()` | Query | — | `(Family & { students: Student[] })[]` | `families`, `students` |
| `useFamily(id)` | Query | `familyId: string` | `Family \| null` | `families` |
| `usePaginatedFamilies(page, pageSize, statusFilter, sortConfig, searchQuery)` | Query | page number, page size, status or `'all'`, `DirectorySortConfig`, search string | `{ families: FamilyWithStudents[], totalCount: number }` | `families`, `students`, `invoices` (for balance) |

| Mutation Hook | Function | Inputs | Returns | Invalidates |
|---------------|----------|--------|---------|-------------|
| `useFamilyMutations()` | `createFamily` | `FamilyInsert` | `Family` | `families.*`, `stats.dashboard()` |
| | `updateFamily` | `{ id, data: Partial<Family> }` | `Family` | `families.*`, `stats.dashboard()` |
| | `deleteFamily` | `id: string` | `void` | `families.*`, `students.*`, `enrollments.*`, `stats.dashboard()` |

---

##### Students

| Hook | Type | Inputs | Returns | Tables |
|------|------|--------|---------|--------|
| `useStudentsByFamily(familyId)` | Query | `familyId: string` | `Student[]` | `students` |

| Mutation Hook | Function | Inputs | Returns | Invalidates |
|---------------|----------|--------|---------|-------------|
| `useStudentMutations()` | `createStudent` | `StudentInsert` (includes duplicate-check logic) | `Student` | `students.*`, `families.detail(familyId)` |
| | `updateStudent` | `{ id, data }` | `Student` | `students.*`, `families.detail(familyId)` |
| | `deleteStudent` | `id: string` | `void` | `students.*` |
| | `forceDeleteStudent` | `id: string` (deletes enrollments + assignments first) | `void` | `students.*`, `enrollments.*`, `teacherAssignments.*` |

---

##### Teachers

| Hook | Type | Inputs | Returns | Tables |
|------|------|--------|---------|--------|
| `useTeachers(filters?)` | Query | `{ status?, search? }` | `Teacher[]` | `teachers` |
| `useActiveTeachers()` | Query | — | `Teacher[]` (status='active') | `teachers` |
| `useTeacher(id)` | Query | `teacherId: string` | `Teacher \| null` | `teachers` |
| `useTeachersWithLoad(filters?)` | Query | `{ status?, serviceId? }` | `TeacherWithLoad[]` (joins assignments, enrollments, students, services) | `teachers`, `teacher_assignments`, `enrollments`, `students`, `services` |
| `useTeacherWithLoad(teacherId)` | Query | `teacherId: string` | `TeacherWithLoad \| null` | same as above |
| `useTeacherByToken(token)` | Query | `token: string` (desk_token) | `TeacherDeskInfo \| null` | `teachers` |

| Mutation Hook | Function | Inputs | Returns | Invalidates |
|---------------|----------|--------|---------|-------------|
| `useTeacherMutations()` | `createTeacher` | `TeacherInsert` | `Teacher` | `teachers.*` |
| | `updateTeacher` | `{ id, data }` | `Teacher` | `teachers.*` |
| | `deleteTeacher` | `id: string` | `void` | `teachers.*` |

---

##### Services & Locations

| Hook | Type | Inputs | Returns | Tables |
|------|------|--------|---------|--------|
| `useServices()` | Query | — | `Service[]` | `services` |
| `useActiveServices()` | Query | — | `Service[]` (status='active') | `services` |
| `useActiveLocations()` | Query | — | `Location[]` (is_active=true) | `locations` |

---

##### Enrollments

| Hook | Type | Inputs | Returns | Tables |
|------|------|--------|---------|--------|
| `useEnrollments(filters?)` | Query | `{ status?, serviceId?, familyId? }` | `Enrollment[]` (joins student, family, service) | `enrollments`, `students`, `families`, `services` |
| `useEnrollmentsByFamily(familyId)` | Query | `familyId: string` | `Enrollment[]` (joins student, service) | `enrollments`, `students`, `services` |
| `useEnrollment(id)` | Query | `enrollmentId: string` | `Enrollment \| null` | `enrollments` |
| `useBillableEnrollments(serviceFilter?)` | Query | `serviceId?: string` | `Enrollment[]` (status='active', joins family, student, service) | `enrollments`, `families`, `students`, `services` |
| `useExistingInvoicesForPeriod(start, end)` | Query | `start: string`, `end: string` (YYYY-MM-DD) | `Invoice[]` (drafts/sent in date range) | `invoices` |

| Mutation Hook | Function | Inputs | Returns | Invalidates |
|---------------|----------|--------|---------|-------------|
| `useEnrollmentMutations()` | `createEnrollment` | `EnrollmentInsert` | `Enrollment` | `enrollments.*`, `stats.dashboard()` |
| | `updateEnrollment` | `{ id, data }` | `Enrollment` | `enrollments.*` |
| | `deleteEnrollment` | `id: string` | `void` | `enrollments.*`, `teacherAssignments.*`, `stats.dashboard()` |

---

##### Onboarding

| Hook | Type | Inputs | Returns | Tables |
|------|------|--------|---------|--------|
| `useEnrollmentOnboarding(enrollmentId)` | Query | `enrollmentId: string` | `EnrollmentOnboarding[]` | `enrollment_onboarding` |

| Mutation Hook | Function | Inputs | Returns | Invalidates |
|---------------|----------|--------|---------|-------------|
| `useOnboardingMutations()` | `sendOnboarding` | `{ enrollmentId, familyId, studentName, serviceConfig }` (calls `send-onboarding` edge function) | `{ success }` | `enrollments.onboarding(enrollmentId)` |
| | `refreshOnboardingStatus` | `{ enrollmentId }` (calls `check-onboarding-status` edge function) | `{ statuses }` | `enrollments.onboarding(enrollmentId)` |
| | `updateOnboardingItem` | `{ id, data }` | `EnrollmentOnboarding` | `enrollments.onboarding(enrollmentId)` |

---

##### Teacher Assignments

| Hook | Type | Inputs | Returns | Tables |
|------|------|--------|---------|--------|
| `useTeacherAssignmentsByEnrollment(enrollmentId)` | Query | `enrollmentId: string` | `TeacherAssignment[]` (joins teacher) | `teacher_assignments`, `teachers` |
| `useTeacherAssignmentsByTeacher(teacherId, options?)` | Query | `teacherId: string`, `{ includeInactive? }` | `TeacherAssignment[]` (joins enrollment → student, family, service) | `teacher_assignments`, `enrollments`, `students`, `families`, `services` |

| Mutation Hook | Function | Inputs | Returns | Invalidates |
|---------------|----------|--------|---------|-------------|
| `useTeacherAssignmentMutations()` | `createAssignment` | `{ enrollment_id, teacher_id, hours_per_week, ... }` | `TeacherAssignment` | `teacherAssignments.*`, `teachers.*` |
| | `updateAssignment` | `{ id, data }` (syncs `enrollments.hours_per_week` if changed) | `TeacherAssignment` | `teacherAssignments.*`, `enrollments.*`, `teachers.*` |
| | `transferTeacher` | `{ assignmentId, newTeacherId }` (ends old, creates new) | `TeacherAssignment` | `teacherAssignments.*`, `teachers.*` |
| | `endAssignmentsByEnrollment` | `enrollmentId: string` (sets `is_active=false`, `end_date=today`) | `void` | `teacherAssignments.*`, `teachers.*` |
| | `deleteAssignment` | `id: string` | `void` | `teacherAssignments.*`, `teachers.*` |

---

##### Teacher Payments (Legacy — Sep–Dec 2025)

| Hook | Type | Inputs | Returns | Tables |
|------|------|--------|---------|--------|
| `useTeacherPaymentsByTeacher(teacherId, options?)` | Query | `teacherId: string`, `{ startDate?, endDate? }` | `TeacherPayment[]` | `teacher_payments` |

| Mutation Hook | Function | Inputs | Returns | Invalidates |
|---------------|----------|--------|---------|-------------|
| `useTeacherPaymentMutations()` | `createPayment` | `TeacherPaymentInsert` | `TeacherPayment` | `teacherPayments.*` |

---

##### Invoices

**Query hooks:**

| Hook | Inputs | Returns | Tables |
|------|--------|---------|--------|
| `useInvoices(filters?)` | `{ status?, familyId?, dateFrom?, dateTo? }` | `Invoice[]` | `invoices` |
| `useInvoicesByFamily(familyId)` | `familyId: string` | `Invoice[]` | `invoices` |
| `useInvoicesWithDetails(filters?)` | `{ status?, familyId? }` | `Invoice[]` (joins line_items, payments, family, emails) | `invoices`, `invoice_line_items`, `payments`, `families`, `invoice_emails` |
| `useExistingInvoicesForPeriod(start, end)` | `start, end: string` | `Invoice[]` (draft/sent in range) | `invoices` |
| `usePendingEventOrders(familyId?)` | `familyId?: string` | `EventOrder[]` (paid, no invoice_id) | `event_orders` |
| `usePendingClassRegistrationFees()` | — | Class registration orders not yet invoiced | `event_orders`, `event_attendees` |
| `usePendingHubSessions()` | — | Hub sessions not yet invoiced | `hub_sessions` |
| `useInvoiceEmails(invoiceId)` | `invoiceId: string` | `InvoiceEmail[]` | `invoice_emails` |
| `useInvoicePayments(invoiceId)` | `invoiceId: string` | `Payment[]` | `payments` |
| `useInvoiceEmailsByFamily(familyId)` | `familyId: string` | `InvoiceEmail[]` | `invoice_emails`, `invoices` |

**Mutation hook — `useInvoiceMutations()`:**

| Function | Inputs | Returns | Invalidates |
|----------|--------|---------|-------------|
| `generateDrafts` | `{ enrollments, period_start, period_end, ... }` (batch creates invoices + line items) | `{ data: Invoice[], warnings }` | `invoices.*`, `stats.dashboard()` |
| `generateEventInvoice` | `{ familyId, orderIds, ... }` | `{ data: Invoice, warnings }` | `invoices.*`, `eventOrders.*`, `stats.dashboard()` |
| `generateHubInvoice` | `{ familyId, sessionIds, ... }` | `{ data: Invoice, warnings }` | `invoices.*`, `hubSessions.*`, `stats.dashboard()` |
| `updateInvoice` | `{ id, data, lineItems? }` | `{ data: Invoice, warnings }` | `invoices.*` |
| `updateLineItem` | `{ id, data }` | `InvoiceLineItem` | `invoices.*` |
| `createLineItem` | `InvoiceLineItemInsert` | `InvoiceLineItem` | `invoices.*` |
| `deleteLineItem` | `id: string` | `void` | `invoices.*` |
| `deleteInvoice` | `id: string` | `void` | `invoices.*`, `stats.dashboard()` |
| `bulkDeleteInvoices` | `ids: string[]` | `void` | `invoices.*`, `stats.dashboard()` |
| `voidInvoice` | `id: string` (resets amount_paid, deletes payments) | `void` | `invoices.*`, `stats.dashboard()` |
| `bulkVoidInvoices` | `ids: string[]` | `void` | `invoices.*`, `stats.dashboard()` |
| `consolidateInvoices` | `{ invoiceIds, familyId }` (merges line items into one invoice) | `{ data: Invoice, warnings }` | `invoices.*`, `stats.dashboard()` |
| `recordPayment` | `{ invoice_id, amount, method, ... }` (inserts payment → triggers T3) | `{ data: Payment, warnings }` | `invoices.*`, `stats.dashboard()` |
| `recalculateInvoiceBalance` | `invoiceId: string` (sums payments, updates amount_paid) | `void` | `invoices.*` |
| `sendInvoice` | `{ invoiceId, recipientEmail, ... }` (calls N8N webhook, records invoice_email) | `{ data, warnings }` | `invoices.*`, `invoiceEmails.*` |
| `bulkSendInvoices` | `{ invoiceIds }` | `{ sent, failed, warnings }` | `invoices.*`, `invoiceEmails.*` |
| `sendReminder` | `{ invoiceId, recipientEmail, reminderType }` (calls N8N webhook) | `{ data, warnings }` | `invoices.*`, `invoiceEmails.*` |
| `bulkSendReminders` | `{ invoiceIds }` | `{ sent, failed, warnings }` | `invoices.*`, `invoiceEmails.*` |
| `createHistoricalInvoice` | `{ familyId, ... }` (backdated, status='paid', skips triggers) | `Invoice` | `invoices.*`, `stats.dashboard()` |

**Event/Hub order linking:**

| Mutation Hook | Function | Inputs | Returns | Invalidates |
|---------------|----------|--------|---------|-------------|
| `useEventOrderMutations()` | `linkOrdersToFamily` | `{ orderIds, familyId }` | `void` | `eventOrders.*`, `families.detail(familyId)` |
| `useHubBookingMutations()` | `linkBookingsToFamily` | `{ sessionIds, familyId }` | `void` | `hubSessions.*`, `families.detail(familyId)` |

---

##### Payroll (Jan 2026+)

**Query hooks:**

| Hook | Inputs | Returns | Tables |
|------|--------|---------|--------|
| `usePayrollRuns(filters?)` | `{ status?, dateFrom?, dateTo? }` | `PayrollRun[]` | `payroll_run` |
| `usePayrollRunWithItems(runId)` | `runId: string` | `PayrollRun & { line_items: PayrollLineItem[] }` (joins teacher) | `payroll_run`, `payroll_line_item`, `teachers` |
| `usePayrollLineItemsByTeacher(teacherId, options?)` | `teacherId: string`, `{ limit? }` | `PayrollLineItem[]` (joins payroll_run) | `payroll_line_item`, `payroll_run` |
| `usePendingPayrollAdjustments(teacherId?)` | `teacherId?: string` | `PayrollAdjustment[]` (status='pending') | `payroll_adjustment` |

**Mutation hook — `usePayrollMutations()`:**

| Function | Inputs | Returns | Invalidates |
|----------|--------|---------|-------------|
| `createPayrollRun` | `{ period_start, period_end, teacherIds?, serviceFilter? }` (auto-generates line items from assignments using rate resolution: assignment → service → teacher default) | `{ data: PayrollRun, warnings }` | `payroll.*`, `reports.all` |
| `updateRunStatus` | `{ runId, status }` | `PayrollRun` | `payroll.*`, `reports.all` |
| `updateLineItem` | `{ id, data }` | `PayrollLineItem` | `payroll.*` |
| `createLineItem` | `PayrollLineItemInsert` | `PayrollLineItem` | `payroll.*` |
| `deleteLineItem` | `id: string` | `void` | `payroll.*` |
| `createAdjustment` | `{ teacher_id, amount, reason, ... }` | `PayrollAdjustment` | `payroll.*` |
| `deletePayrollRun` | `runId: string` (cascades: deletes line items) | `void` | `payroll.*`, `reports.all` |
| `bulkUpdateTeacherHours` | `{ lineItemUpdates: { id, hours }[] }` | `void` | `payroll.*` |

**Exported utilities (non-hook):** `calculatePeriodHours(start, end, hoursPerWeek)`, `resolveHourlyRate(assignment, service, teacher)`, `generatePayrollCSV(run, items)`, `downloadPayrollCSV(run, items)`

---

##### Leads

**Query hooks:**

| Hook | Inputs | Returns | Tables |
|------|--------|---------|--------|
| `useLeads(filters?)` | `{ lead_status?, lead_type?, search?, dateFrom?, dateTo? }` | `LeadFamily[]` (families with status='lead', includes computed `lead_score`) | `families` |
| `useLead(id)` | `familyId: string` | `LeadFamily \| null` (includes score breakdown) | `families` |
| `useConvertedLeadsCount()` | — | `number` (count of `lead_status='converted'`) | `families` |
| `useCheckDuplicateEmails()` | — (lazy mutation) | `{ mutateAsync(email) }` → `{ exists, familyId? }` | `families` |
| `useCheckMatchingLeads()` | — (lazy mutation) | `{ mutateAsync({ email, name }) }` → `LeadFamily[]` | `families` |
| `useEventLeads()` | — | `EventLead[]` (event attendees without linked families) | `event_attendees`, `event_orders`, `event_events` |

**Mutation hook — `useLeadMutations()`:**

| Function | Inputs | Returns | Invalidates |
|----------|--------|---------|-------------|
| `createLead` | `CreateLeadInput` (email duplicate check, formats name, sets status='lead') | `Family` | `leads.*`, `families.*`, `stats.dashboard()` |
| `updateLead` | `{ id, data }` | `Family` | `leads.*`, `families.*` |
| `deleteLead` | `id: string` | `void` | `leads.*`, `families.*`, `stats.dashboard()` |
| `bulkCreateLeads` | `CreateLeadInput[]` (skips duplicates per email) | `{ created: Family[], skipped: string[], warnings }` | `leads.*`, `families.*`, `stats.dashboard()` |
| `convertToCustomer` | `{ familyId }` (sets `status='active'`, `lead_status='converted'`, `converted_at=now`) | `Family` | `leads.*`, `families.*`, `stats.dashboard()` |

**Lead score calculation:** `calculateLeadScore(family)` → `0–100` based on source quality (0–25), recency (0–25), engagement (0–25), contact completeness (0–25). Labels: Hot ≥70, Warm ≥40, Cold <40.

---

##### Lead Activities

| Hook | Type | Inputs | Returns | Tables |
|------|------|--------|---------|--------|
| `useLeadActivities(familyId)` | Query | `familyId: string` | `LeadActivity[]` (ordered by created_at desc) | `lead_activities` |

| Mutation Hook | Function | Inputs | Returns | Invalidates |
|---------------|----------|--------|---------|-------------|
| `useLeadActivityMutations()` | `createActivity` | `{ family_id, activity_type, notes?, metadata? }` | `LeadActivity` | `leadActivities.*` |
| | `deleteActivity` | `id: string` | `void` | `leadActivities.*` |

---

##### Conversion Analytics

| Hook | Type | Inputs | Returns | Tables |
|------|------|--------|---------|--------|
| `useConversionAnalytics()` | Query | — | `ConversionStats` (pipeline counts by stage, conversion rates, avg time to convert) | `families`, `lead_activities` |

---

##### Lead Follow-ups

| Hook | Type | Inputs | Returns | Tables |
|------|------|--------|---------|--------|
| `useLeadFollowUps(familyId)` | Query | `familyId: string` | `LeadFollowUp[]` | `lead_follow_ups` |
| `useUpcomingFollowUps()` | Query | — | `LeadFollowUp[]` (joins family, due within 7 days, not completed) | `lead_follow_ups`, `families` |

| Mutation Hook | Function | Inputs | Returns | Invalidates |
|---------------|----------|--------|---------|-------------|
| `useFollowUpMutations()` | `createFollowUp` | `{ family_id, follow_up_type, due_date, notes?, priority? }` | `LeadFollowUp` | `leadFollowUps.*` |
| | `updateFollowUp` | `{ id, data }` | `LeadFollowUp` | `leadFollowUps.*` |
| | `completeFollowUp` | `{ id, outcome }` (sets completed_at) | `LeadFollowUp` | `leadFollowUps.*` |
| | `deleteFollowUp` | `id: string` | `void` | `leadFollowUps.*` |

---

##### Email Campaigns

| Hook | Type | Inputs | Returns | Tables |
|------|------|--------|---------|--------|
| `useEmailCampaigns()` | Query | — | `EmailCampaign[]` | `email_campaigns` |
| `useCampaignEngagement(campaignId)` | Query | `campaignId: string` | `LeadCampaignEngagement[]` | `lead_campaign_engagement` |
| `useLeadCampaignEngagement(familyId)` | Query | `familyId: string` | `LeadCampaignEngagement[]` (joins email_campaigns) | `lead_campaign_engagement`, `email_campaigns` |

---

##### Events

| Hook | Type | Inputs | Returns | Tables/Views |
|------|------|--------|---------|--------------|
| `useEvents()` | Query | — | `EventWithStats[]` (event_type='event', includes attendee_count, revenue) | `event_events`, `event_attendees`, `event_orders` |
| `useAllAttendees()` | Query | — | `AttendeeWithDetails[]` (event_type='event', paid/stepup_pending, joins families) | `event_attendee_list` (view), `families` |

---

##### Check-ins (Teacher's Desk)

**Admin-side query hooks:**

| Hook | Inputs | Returns | Tables |
|------|--------|---------|--------|
| `useCheckinPeriods()` | — | `CheckinPeriodSummary[]` (includes invite/submission counts) | `checkin_period_summary` (view) |
| `useCheckinPeriod(periodId)` | `periodId: string` | `CheckinPeriod` | `checkin_periods` |
| `useCheckinInvites(periodId)` | `periodId: string` | `CheckinInviteWithTeacher[]` (joins teacher) | `checkin_invites`, `teachers` |
| `useCheckinResponse(inviteId)` | `inviteId: string` | `CheckinResponseWithResources \| null` (joins student_resources) | `checkin_responses`, `checkin_student_resources` |
| `useTeacherStudents(teacherId)` | `teacherId: string` | `TeacherStudent[]` (active assignments → enrollment → student, deduplicated) | `teacher_assignments`, `enrollments`, `students`, `families`, `services` |

**Teacher portal (public) query hooks:**

| Hook | Inputs | Returns | Tables |
|------|--------|---------|--------|
| `useTeacherByToken(token)` | `token: string` (desk_token) | `TeacherDeskInfo \| null` | `teachers` |
| `useTeacherInvites(teacherId)` | `teacherId: string` | `TeacherInviteWithPeriod[]` (joins checkin_periods) | `checkin_invites`, `checkin_periods` |

**Mutation hook — `useCheckinMutations()`:**

| Function | Inputs | Returns | Invalidates |
|----------|--------|---------|-------------|
| `createPeriod` | `{ period_key, display_name, status?, opens_at?, closes_at? }` | `CheckinPeriod` | `checkins.periods()`, `checkins.periodSummary()` |
| `updatePeriod` | `{ id, data }` | `CheckinPeriod` | `checkins.periods()`, `checkins.periodSummary()`, `checkins.periodDetail(id)` |
| `deletePeriod` | `id: string` | `void` | `checkins.periods()`, `checkins.periodSummary()` |
| `createInvites` | `{ periodId, teacherIds }` | `CheckinInvite[]` | `checkins.invites(periodId)`, `checkins.periodSummary()` |
| `markInvitesSent` | `{ invites, periodId, periodDisplayName }` (updates sent_at, sends emails via N8N `checkin-notify` webhook) | `{ periodId, warnings }` | `checkins.invites(periodId)`, `checkins.periodSummary()` |
| `markInvitesReminded` | `{ invites, periodId, periodDisplayName }` (increments reminders_sent, sends reminder via N8N) | `{ periodId, warnings }` | `checkins.invites(periodId)` |
| `deleteInvite` | `{ inviteId, periodId }` | `void` | `checkins.invites(periodId)`, `checkins.periodSummary()` |

**Form submission — `useCheckinFormSubmit()`:**

| Inputs | Returns | Invalidates |
|--------|---------|-------------|
| `CheckinFormSubmitData` (inviteId, periodId, teacherId, needsAssessment, studentResources) — creates response + student_resources, updates invite status to 'submitted', optionally sends training webhook | `{ responseId, needsTraining, warnings }` | `checkins.invites(periodId)`, `checkins.invitesByTeacher(teacherId)`, `checkins.periodSummary()`, `checkins.response(inviteId)` |

---

##### SMS

| Hook | Type | Inputs | Returns | Tables |
|------|------|--------|---------|--------|
| `useSmsMessages(filters?)` | Query | `{ familyId?, invoiceId?, status?, messageType?, dateFrom?, dateTo?, limit? }` | `SmsMessage[]` (joins family, sms_media) | `sms_messages`, `families`, `sms_media` |
| `useSmsByFamily(familyId)` | Query | `familyId: string` | `SmsMessage[]` (limit 50, joins sms_media) | `sms_messages`, `sms_media` |
| `useSmsByInvoice(invoiceId)` | Query | `invoiceId: string` | `SmsMessage[]` (limit 50, joins sms_media) | `sms_messages`, `sms_media` |
| `useSmsMedia()` | Query | — | `SmsMedia[]` | `sms_media` |

| Mutation Hook | Function | Inputs | Returns | Invalidates |
|---------------|----------|--------|---------|-------------|
| `useSmsMutations()` | `sendSms` | `{ familyId?, familyIds?, toPhone?, messageBody, messageType?, invoiceId?, templateKey?, mergeData?, campaignName?, mediaUrls?, sentBy? }` (calls `send-sms` edge function) | `{ success, sent, failed, skipped }` | `sms.all`, `sms.byFamily(familyId)`, `sms.byInvoice(invoiceId)` |
| | `updateOptOut` | `{ familyId, optOut: boolean }` (updates `sms_opt_out` on family) | `void` | `families.all` |

---

##### Gmail

| Hook | Type | Inputs | Returns | External |
|------|------|--------|---------|----------|
| `useGmailSearch(email, options?)` | Infinite Query | `email: string`, `{ enabled? }` | `GmailThread[]` (paginated via N8N webhook) | N8N `gmail-search` webhook |
| `useGmailThread(threadId)` | Query | `threadId: string` | `GmailThread` (full thread with messages via N8N webhook) | N8N `gmail-thread` webhook |

| Mutation Hook | Function | Inputs | Returns | External |
|---------------|----------|--------|---------|----------|
| `useGmailSend()` | `mutateAsync` | `{ to, subject, body, threadId? }` | `{ success }` | N8N `gmail-send` webhook |

---

##### Settings & Tags

| Hook | Type | Inputs | Returns | Tables |
|------|------|--------|---------|--------|
| `useSettings()` | Query | — | `AppSetting[]` | `app_settings` |
| `useTags()` | Query | — | `string[]` (distinct tags from families) | `families` |

| Mutation Hook | Function | Inputs | Returns | Invalidates |
|---------------|----------|--------|---------|-------------|
| `useSettingMutations()` | `updateSetting` | `{ key, value }` | `AppSetting` | `settings.*` |

---

##### Admin Utilities

| Hook | Type | Inputs | Returns | Source |
|------|------|--------|---------|--------|
| `usePotentialDuplicates()` | Query | — | `PotentialDuplicateFamily[]` (families with same name, different emails). 5min staleTime. | RPC `get_potential_duplicate_families` |
| `useFamilyMergeLog()` | Query | — | `FamilyMergeLogEntry[]` (last 100 merge events). 1min staleTime. | RPC `get_family_merge_log` |
| `useRecentlyViewed()` | Local State | — | `{ items: RecentItem[], addItem(item), clearItems() }` (max 5, localStorage) | `localStorage` |

**Standalone:** `addRecentlyViewed(item)` — non-hook version for use outside React components.

---

##### Cache Utility

| Hook | Type | Returns |
|------|------|---------|
| `useInvalidateQueries()` | Utility | `{ invalidateFamilies, invalidateStudents, invalidateTeachers, invalidateEnrollments, invalidateInvoices, invalidatePayroll, invalidateLeads, invalidateAll }` — convenience wrappers for `queryClient.invalidateQueries()` |

---

##### Generic Hooks (non-domain)

| Hook / Utility | Type | Inputs | Returns |
|----------------|------|--------|---------|
| `useSelectionState<T>(disabledIds?)` | Local State | `disabledIds?: Set<T>` | `SelectionState<T>` — `{ selectedIds, toggle, toggleAll, selectAll, deselectAll, isSelected, isAllSelected, count, clear }` |
| `useBulkAction<T, R>(options)` | Local State | `{ action, onSuccess?, onPartialSuccess?, onError? }` | `{ execute(ids, data), isExecuting, result: BulkActionResult, reset }` — runs actions via `Promise.allSettled` |
| `sortBy(items, field, direction)` | Pure Function | array, field key or accessor, `'asc'`/`'desc'` | sorted copy of array |
| `sortByMultiple(items, sortFields)` | Pure Function | array, `[{ field, direction }]` | sorted copy (multi-key) |
| `calculateFamilyBalances(familyIds)` | Async Utility | `string[]` | `Map<string, number>` — sums `balance_due` from unpaid invoices per family |

---

### 3. Utility Modules

#### 3a. Date Utilities (`dateUtils.ts`)

| Field | Value |
|-------|-------|
| **What** | Timezone-safe date formatting and parsing |
| **Inputs** | `Date` objects, `YYYY-MM-DD` strings |
| **Outputs** | Formatted date strings, parsed `Date` objects, boolean comparisons |
| **Talks to** | Every component/hook that handles dates |
| **External deps** | None |

**Functions:** `formatDateLocal()`, `parseLocalDate()`, `getTodayString()`, `isToday()`, `isPast()`, `isFuture()`, `daysBetween()`, `addDays()`, `getWeekStart()`, `getWeekEnd()`, `dateAtMidnight()`, `parseUTCDate()`

#### 3b. Money Utilities (`moneyUtils.ts`)

| Field | Value |
|-------|-------|
| **What** | Floating-point safe money arithmetic and formatting |
| **Inputs** | Numbers (dollars), strings (user input) |
| **Outputs** | Rounded dollar amounts, formatted currency strings |
| **Talks to** | Invoicing, payroll, reports, SMS templates |
| **External deps** | None |

**Functions:** `multiplyMoney()`, `addMoney()`, `subtractMoney()`, `sumMoney()`, `centsToDollars()`, `dollarsToCents()`, `formatCurrency()`, `formatMoneyValue()`, `formatRate()`, `parseMoneyInput()`, `calculatePercentage()`, `formatPercentage()`

#### 3c. Phone Utilities (`phoneUtils.ts`)

| Field | Value |
|-------|-------|
| **What** | US phone number normalization and formatting |
| **Inputs** | Raw phone strings in any format |
| **Outputs** | E.164 format (`+1XXXXXXXXXX`) for storage, `(555) 123-4567` for display |
| **Talks to** | SMS compose, family forms, edge functions |
| **External deps** | None |

**Functions:** `normalizePhone()`, `formatPhoneDisplay()`, `isValidPhone()`, `getPhoneLast4()`

#### 3d. Name/Age Utilities (`utils.ts`)

| Field | Value |
|-------|-------|
| **What** | Name normalization and age group classification |
| **Inputs** | Name strings, DOB strings |
| **Outputs** | `"Last, First"` format, age numbers, age group labels |
| **Talks to** | Directory, family forms, roster, lead matching |
| **External deps** | None |

**Functions:** `formatNameLastFirst()`, `calculateAge()`, `getAgeGroup()`, `getAgeGroupSortValue()`
**Constants:** `AGE_GROUP_OPTIONS`, `AGE_GROUP_ORDER`

#### 3e. SMS Templates (`smsTemplates.ts`)

| Field | Value |
|-------|-------|
| **What** | Type-safe SMS message templates with merge fields and cost estimation |
| **Inputs** | Template key, merge data object |
| **Outputs** | Rendered message string, segment count, cost estimate |
| **Talks to** | SMS compose modal, quick send page, hooks |
| **External deps** | None |

**Templates:** `invoiceReminderTemplate`, `eventReminderTemplate`, `announcementTemplate`
**Functions:** `getTemplate()`, `generateMessage()`, `calculateSegments()`, `estimateCost()`
**Pricing:** SMS $0.0079/segment, MMS $0.02/message

#### 3f. Enrollment Period (`enrollmentPeriod.ts`)

| Field | Value |
|-------|-------|
| **What** | Semester/school year period logic for invoicing |
| **Inputs** | Service code, optional date |
| **Outputs** | Period string (`"Fall 2025"`, `"2025-2026"`), period options list |
| **Talks to** | Enrollment forms, invoice generation |
| **External deps** | None |

**Functions:** `getPeriodTypeForService()`, `getCurrentPeriod()`, `getPeriodOptions()`, `getDefaultPeriod()`
**Period types:** Semester (Fall Aug-Dec, Spring Jan-May, Summer Jun-Jul), School Year (Aug-Jul)

#### 3g. Invoice PDF (`invoicePdf.ts`)

| Field | Value |
|-------|-------|
| **What** | PDF generation for invoices |
| **Inputs** | `InvoiceWithDetails` object (invoice + line items + family) |
| **Outputs** | Downloaded PDF file via jsPDF |
| **Talks to** | Invoice detail panel |
| **External deps** | `jspdf` library |

**Function:** `generateInvoicePdf(invoice)` → `{ success, error? }`

#### 3h. Validation (`validation.ts`)

| Field | Value |
|-------|-------|
| **What** | Input validation utilities for forms |
| **Inputs** | User-entered strings |
| **Outputs** | Booleans, parsed numbers, validation results |
| **Talks to** | All form modals |
| **External deps** | None |

**Functions:** `isValidEmail()`, `validateEmail()`, `parsePositiveFloat()`, `parsePositiveInt()`, `isValidDateString()`, `isValidDateRange()`, `isValidPhone()`, `isValidUrl()`, `isNotEmpty()`, `isWithinLength()`, `createValidationResult()`

#### 3i. Toast Notifications (`toast.tsx`)

| Field | Value |
|-------|-------|
| **What** | Toast context provider for success/error/warning notifications |
| **Inputs** | Message string, type |
| **Outputs** | Auto-dismissing toast UI (4 seconds) |
| **Talks to** | All components via `useToast()`, queryClient error handler via `getGlobalToast()` |
| **External deps** | None |

#### 3j. Chart Theme (`chartTheme.ts`)

| Field | Value |
|-------|-------|
| **What** | Dark mode styling constants for Recharts visualizations |
| **Inputs** | None |
| **Outputs** | Color palettes, style objects, axis formatters |
| **Talks to** | Reports page |
| **External deps** | None |

**Constants:** `CHART_COLORS`, `PIE_COLORS`, `SERVICE_COLORS`, `LOCATION_COLORS`, `TOOLTIP_STYLE`, `AXIS_STYLE`, `GRID_STYLE`

#### 3k. Status Colors (`statusColors.ts`)

| Field | Value |
|-------|-------|
| **What** | Tailwind CSS class maps for all entity statuses |
| **Inputs** | Status string |
| **Outputs** | Tailwind class string |
| **Talks to** | StatusBadge component, all list views |
| **External deps** | None |

**Maps:** `CUSTOMER_STATUS_COLORS`, `ENROLLMENT_STATUS_COLORS`, `INVOICE_STATUS_COLORS`, `LEAD_STATUS_COLORS`, `LEAD_ENGAGEMENT_COLORS`, `LEAD_TYPE_COLORS` (each with `_WITH_BORDER` variant)
**Labels:** `CUSTOMER_STATUS_LABELS`, `ENROLLMENT_STATUS_LABELS`, `INVOICE_STATUS_LABELS`, `LEAD_STATUS_LABELS`

#### 3l. Selection State (`useSelectionState.ts`)

| Field | Value |
|-------|-------|
| **What** | Reusable hooks for table selection and group expansion state |
| **Inputs** | Item arrays, initial state |
| **Outputs** | Selection state + toggle/select/clear functions |
| **Talks to** | Directory, Invoicing, Marketing (any list with checkboxes) |
| **External deps** | None |

**Hooks:** `useMultiSelection()`, `useSingleSelection()`, `useExpandedGroups()`

---

### 4. Gmail Integration

| Field | Value |
|-------|-------|
| **What** | Gmail API integration proxied through N8N webhooks |
| **File** | `src/lib/gmail.ts` |
| **Inputs** | Email address (search), thread ID (fetch), email payload (send) |
| **Outputs** | Message lists, full threads with bodies, send confirmation |
| **Talks to** | `useGmailSearch`, `useGmailThread`, `useGmailSend` hooks; email compose modal |
| **External deps** | N8N Cloud (3 webhook endpoints) |

**Endpoints:**

| Function | Method | N8N Webhook Path | Request | Response |
|----------|--------|------------------|---------|----------|
| `searchGmail()` | POST | `/gmail-search` | `{ email, query, maxResults, pageToken }` | `{ success, messages[], nextPageToken? }` |
| `getGmailThread()` | POST | `/gmail-thread` | `{ threadId }` | `{ success, thread: { id, messages[] } }` |
| `sendGmail()` | POST | `/gmail-send` | `{ threadId?, to, subject, body, htmlBody? }` | `{ success, messageId, threadId }` |

**Timeout:** 30 seconds (AbortController)

---

### 5. Mailchimp Integration

| Field | Value |
|-------|-------|
| **What** | Mailchimp subscriber management and campaign tracking via Edge Function |
| **File** | `src/lib/mailchimp.ts` |
| **Inputs** | Lead/family data, email, tags, campaign IDs |
| **Outputs** | Sync results, subscriber info, campaign stats, engagement scores |
| **Talks to** | Lead detail panel, Marketing page, DB trigger `trigger_sync_family_status_to_mailchimp` |
| **External deps** | Supabase Edge Function `mailchimp` → Mailchimp API v3 (`us13.api.mailchimp.com`) |

**Audience:** `693d484108` ("Eaton Academic LLC"), server `us13`

**Functions → Edge Function Actions:**

| Client Function | Edge Action | Purpose |
|----------------|-------------|---------|
| `syncLeadToMailchimp()` | `sync_lead` | Upsert subscriber with lead tags |
| `bulkSyncLeadsToMailchimp()` | `bulk_sync` | Batch sync multiple leads |
| `addTagsToSubscriber()` | `add_tags` | Add tags to subscriber |
| `getSubscriber()` | `get_subscriber` | Get subscriber record with merge fields |
| `getSubscriberActivity()` | `get_activity` | Get subscriber activity history |
| `getCampaigns()` | `get_campaigns` | List campaigns |
| `getAudienceStats()` | `get_audience_stats` | Audience-level metrics |
| `syncLeadEngagement()` | `sync_engagement` | Calculate engagement score (opens=1pt, clicks=3pts) |
| `bulkSyncEngagement()` | `bulk_sync_engagement` | Batch engagement sync |
| `syncCampaigns()` | `sync_campaigns` | Sync campaign data to DB |
| `getCampaignReport()` | `get_campaign_report` | Single campaign report |
| `syncCampaignActivity()` | `sync_campaign_activity` | Sync per-lead campaign interactions |

**Tag behavior:** Status tags (`active-family`, `lead`, `churned`) are swapped (old removed, new added). Other tags are preserved additively.

**Important:** Client remaps `leadId` → `familyId` before calling edge function. Edge function expects `familyId`.

---

### 6. Page Components

#### 6a. Command Center (`CommandCenter.tsx`)

| Field | Value |
|-------|-------|
| **What** | Admin dashboard with KPIs, alerts, and action items |
| **Route** | `/` |
| **Inputs** | Dashboard stats query (60s staleTime) |
| **Outputs** | Metric cards, alert list, quick-action links |
| **Talks to** | `queryKeys.stats.dashboard()`, navigates to Directory/Invoicing/Marketing |
| **External deps** | None |

**Metrics displayed:** Active students/families/teachers, outstanding balance, overdue invoices, MRR, gross profit margin (90-day), new enrollments, lead counts by type, unopened invoices, families needing reengagement

#### 6b. Directory (`Directory.tsx`)

| Field | Value |
|-------|-------|
| **What** | Family directory with search, filter, sort, bulk actions |
| **Route** | `/directory` |
| **Inputs** | `usePaginatedFamilies()` (25/page), status filters, search query |
| **Outputs** | Paginated family table, bulk action results, CSV export |
| **Talks to** | `FamilyDetailPanel`, `AddFamilyModal` |
| **External deps** | None |

**Bulk actions:** Status change (active/trial/paused/churned), delete (validates no enrollments/invoices), CSV export

#### 6c. Active Roster (`Roster.tsx`)

| Field | Value |
|-------|-------|
| **What** | Currently enrolled students grouped by service/teacher |
| **Route** | `/roster` |
| **Inputs** | `useEnrollments({ status: 'active' })`, `useTeachers()` |
| **Outputs** | Grouped roster view |
| **Talks to** | `EnrollmentDetailPanel` |
| **External deps** | None |

#### 6d. Events (`Events.tsx`)

| Field | Value |
|-------|-------|
| **What** | Event and attendee management with dual-view tabs |
| **Route** | `/events` |
| **Inputs** | `useEvents()`, `useAllAttendees()` |
| **Outputs** | Event list with stats (attendee count, revenue), attendee list |
| **Talks to** | `EventDetailPanel`, navigates to Directory on family click |
| **External deps** | None |

#### 6e. Marketing (`Marketing.tsx`)

| Field | Value |
|-------|-------|
| **What** | Lead management dashboard with conversion tracking |
| **Route** | `/marketing` |
| **Inputs** | `useLeads()`, `useEventLeads()`, `useUpcomingFollowUps()`, `useConvertedLeadsCount()` |
| **Outputs** | Lead pipeline view, conversion analytics, campaign stats |
| **Talks to** | `LeadDetailPanel`, `ImportLeadsModal`, `EditLeadModal`, Mailchimp (bulk sync) |
| **External deps** | Mailchimp (via `mailchimp.ts`) |

**Tabs:** leads, event_leads, campaigns, analytics
**Filters:** Type (exit_intent/waitlist/calendly_call/event), status (new/contacted/converted/closed), engagement (cold/warm/hot)

#### 6f. Invoicing (`Invoicing.tsx`)

| Field | Value |
|-------|-------|
| **What** | Invoice lifecycle management with tabs, bulk actions, reminders |
| **Route** | `/invoicing` |
| **Inputs** | `useInvoicesWithDetails()`, deep-link params (`?status=draft&filter=unopened`) |
| **Outputs** | Invoice tables by status, bulk send/void results |
| **Talks to** | `InvoiceDetailPanel`, `GenerateDraftsModal`, `EditInvoiceModal`, `ImportHistoricalInvoiceModal`, N8N (`invoice-send` webhook) |
| **External deps** | N8N (invoice email sending) |

**Tabs:** drafts, outstanding, paid, voided, all
**Bulk actions:** Send, send reminders (7-day/14-day/overdue), void, consolidate

#### 6g. Payroll (`Payroll.tsx`)

| Field | Value |
|-------|-------|
| **What** | Payroll run management with current/history views |
| **Route** | `/payroll` |
| **Inputs** | `usePayrollRuns()`, `usePayrollRunWithItems()`, `usePendingPayrollAdjustments()` |
| **Outputs** | Run details, CSV export, adjustment list |
| **Talks to** | `CreatePayrollRunModal`, `PayrollRunDetail`, `PayrollAdjustmentModal`, N8N (`payroll-notification` webhook) |
| **External deps** | N8N (payroll notifications) |

**Tabs:** current, history, adjustments
**Statuses:** draft → review → approved → paid

#### 6h. Teachers (`Teachers.tsx`)

| Field | Value |
|-------|-------|
| **What** | Teacher roster with load calculations and check-in management |
| **Route** | `/teachers` |
| **Inputs** | `useTeachersWithLoad()`, `useActiveServices()` |
| **Outputs** | Teacher list with computed weekly hours/cost |
| **Talks to** | `AddTeacherModal`, `TeacherDetailPanel`, `CheckinsTab` |
| **External deps** | None |

**Tabs:** teachers, checkins
**Filters:** Status (active/reserve/inactive), service

#### 6i. Reports (`Reports.tsx`)

| Field | Value |
|-------|-------|
| **What** | Business analytics dashboard with 6+ Recharts visualizations |
| **Route** | `/reports` |
| **Inputs** | `get_revenue_by_month` RPC, `get_revenue_by_location` RPC, enrollment/payroll/balance queries |
| **Outputs** | Line charts, bar charts, pie charts |
| **Talks to** | `queryKeys.reports.*`, chart theme utilities |
| **External deps** | None |

**Charts:** Revenue by Month, Revenue by Service, Enrollments by Service, Balance Aging, Payroll by Month, Revenue by Location
**Date ranges:** 3m, 6m, YTD, All Time

#### 6j. Settings (`Settings.tsx`)

| Field | Value |
|-------|-------|
| **What** | App configuration for business info, invoicing, payments, rates, locations |
| **Route** | `/settings` |
| **Inputs** | `app_settings` table, `locations` table |
| **Outputs** | Saved configuration values |
| **Talks to** | Supabase (`app_settings`, `locations` tables) |
| **External deps** | None |

**Tabs:** business, invoicing, payments, rates, locations

#### 6k. SMS Log (`pages/SmsLog.tsx`)

| Field | Value |
|-------|-------|
| **What** | SMS message audit log viewer |
| **Route** | `/sms-log` |
| **Inputs** | `useSmsMessages({ limit: 1000 })` |
| **Outputs** | Filterable/searchable SMS history |
| **Talks to** | `SmsStatusBadge` |
| **External deps** | None |

**Filters:** Status (pending/sent/delivered/failed/undelivered), type (invoice_reminder/event_reminder/announcement/custom)

#### 6l. Quick Send (`pages/QuickSend.tsx`)

| Field | Value |
|-------|-------|
| **What** | Bulk SMS campaign composer with preview and cost estimation |
| **Route** | `/quick-send` |
| **Inputs** | `useFamilies()`, SMS template utilities |
| **Outputs** | Bulk SMS send results with per-recipient tracking |
| **Talks to** | `useSmsMutations()`, `calculateSegments()`, `estimateCost()` |
| **External deps** | Twilio (via `send-sms` edge function) |

---

### 7. Detail Panels

#### 7a. Family Detail Panel (`FamilyDetailPanel.tsx`)

| Field | Value |
|-------|-------|
| **What** | Right-side panel showing family info, students, enrollments, invoices, SMS, email history |
| **Inputs** | Family ID |
| **Outputs** | Read-only display with action buttons |
| **Talks to** | `useEnrollmentsByFamily()`, `useInvoicesByFamily()`, `useSmsByFamily()`, `useGmailSearch()` |
| **Opens modals** | `EditFamilyModal`, `AddStudentModal`, `EditStudentModal`, `SmsComposeModal`, `EmailComposeModal` |

**Tabs:** overview, enrollments, invoices, sms, history

#### 7b. Invoice Detail Panel (`InvoiceDetailPanel.tsx`)

| Field | Value |
|-------|-------|
| **What** | Invoice details with line items, payments, emails, SMS |
| **Inputs** | Invoice ID |
| **Outputs** | Read-only display with action buttons |
| **Talks to** | `useInvoiceEmails()`, `useInvoicePayments()`, `useSmsByInvoice()`, `useInvoiceMutations()` |
| **Actions** | Edit, send, remind, record payment, void, delete, download PDF, send SMS |

#### 7c. Lead Detail Panel (`LeadDetailPanel.tsx`)

| Field | Value |
|-------|-------|
| **What** | Lead info with engagement metrics, activity log, follow-ups |
| **Inputs** | Lead (family) ID |
| **Outputs** | Read-only display with action buttons |
| **Talks to** | `useLeadActivities()`, `useLeadFollowUps()`, Mailchimp (`syncLeadToMailchimp`, `syncLeadEngagement`) |
| **Actions** | Edit, change status, log activity, sync Mailchimp, create follow-up, convert to customer, delete |

#### 7d. Teacher Detail Panel (`TeacherDetailPanel.tsx`)

| Field | Value |
|-------|-------|
| **What** | Teacher info with assignments, payroll history, payment records |
| **Inputs** | Teacher ID |
| **Outputs** | Read-only display with action buttons |
| **Talks to** | `useTeacherWithLoad()`, `useTeacherAssignments()`, `useTeacherPaymentsByTeacher()`, `usePayrollLineItemsByTeacher()` |
| **Actions** | Edit, add assignment, edit assignment, record payment |

**Tabs:** overview, assignments, payroll, history

#### 7e. Enrollment Detail Panel (`EnrollmentDetailPanel.tsx`)

| Field | Value |
|-------|-------|
| **What** | Enrollment details with schedule, billing, onboarding forms, email history |
| **Inputs** | Enrollment ID |
| **Outputs** | Read-only display with action buttons |
| **Talks to** | `useTeacherAssignmentsByEnrollment()`, `useEnrollmentOnboarding()`, `useOnboardingMutations()` |
| **Actions** | Edit, transfer teacher, end enrollment, send onboarding forms |

**Tabs:** overview, schedule, billing, forms, history

#### 7f. Event Detail Panel (`EventDetailPanel.tsx`)

| Field | Value |
|-------|-------|
| **What** | Event details with attendees and revenue |
| **Inputs** | Event ID |
| **Outputs** | Read-only display |
| **Talks to** | `useEvents()`, `useAllAttendees()` |

---

### 8. Modals (CRUD Dialogs)

All modals use `AccessibleModal` wrapper with focus trap, Escape key, and ARIA attributes.

| Modal | Domain | Operation | Key Tables | Notes |
|-------|--------|-----------|------------|-------|
| `AddFamilyModal` | Family | Create | `families` | Checks for matching leads; offers conversion |
| `EditFamilyModal` | Family | Update | `families` | |
| `AddStudentModal` | Student | Create | `students` | |
| `EditStudentModal` | Student | Update | `students` | |
| `ImportLeadsModal` | Lead | Bulk Create | `families` | CSV import |
| `EditLeadModal` | Lead | Update | `families` | Status, type, contact info |
| `AddEnrollmentModal` | Enrollment | Create | `enrollments`, `teacher_assignments` | Assigns teacher, may generate first invoice draft |
| `EditEnrollmentModal` | Enrollment | Update | `enrollments` | Dates, rates, teacher |
| `EndEnrollmentModal` | Enrollment | Update | `enrollments` | Sets `end_date` |
| `AddAssignmentModal` | Assignment | Create | `teacher_assignments` | |
| `EditAssignmentModal` | Assignment | Update | `teacher_assignments` | Hours, rate |
| `TransferTeacherModal` | Assignment | Update | `teacher_assignments` | Change teacher on enrollment |
| `EditInvoiceModal` | Invoice | Update | `invoices`, `invoice_line_items` | Amount, dates, line items |
| `GenerateDraftsModal` | Invoice | Bulk Create | `invoices`, `invoice_line_items` | Batch generate from active enrollments |
| `ImportHistoricalInvoiceModal` | Invoice | Create | `invoices` | Past invoices for data cleanup |
| `AddManualLineItemModal` | Invoice | Create | `invoice_line_items` | Custom line item |
| `AddTeacherModal` | Teacher | Create | `teachers` | |
| `EditTeacherModal` | Teacher | Update | `teachers` | |
| `RecordTeacherPaymentModal` | Payment | Create | `teacher_payments` | Legacy payment system |
| `BulkAdjustHoursModal` | Assignment | Bulk Update | `teacher_assignments` | |
| `CreatePayrollRunModal` | Payroll | Create | `payroll_run`, `payroll_line_item` | Pulls hours from assignments |
| `PayrollAdjustmentModal` | Payroll | Create | `payroll_adjustment` | Pending → approved/rejected |
| `CreatePeriodModal` | Check-in | Create | `checkin_periods` | Check-in period creation |
| `EmailThreadModal` | Email | Read | — | Full email thread viewer (via N8N) |
| `SmsComposeModal` | SMS | Create | `sms_messages` | Single or bulk send via Twilio |
| `EmailComposeModal` | Email | Create | — | Via N8N Gmail webhook |
| `SendFormsModal` | Onboarding | Create | `enrollment_onboarding` | Google Forms via edge function |
| `LinkEventOrdersModal` | Events | Update | `event_orders` | Link EventBrite orders to families |
| `LinkHubBookingsModal` | Events | Update | `hub_sessions` | Link Calendly bookings to hub sessions |

---

### 9. Public Pages (No Auth)

#### 9a. Teacher Desk (`/desk/:token`)

| Field | Value |
|-------|-------|
| **What** | Public teacher portal for viewing check-in invites and submitting responses |
| **Inputs** | URL token (auto-generated per teacher) |
| **Outputs** | Check-in invite list, submitted responses |
| **Talks to** | `useTeacherByToken()`, `useCheckinInvitesByTeacher()` |
| **External deps** | None |

#### 9b. Check-in Form (`/desk/:token/checkin/:periodId`)

| Field | Value |
|-------|-------|
| **What** | Public assessment form for teachers to submit student check-ins |
| **Inputs** | Teacher token + period ID |
| **Outputs** | Submitted check-in response with student assessments |
| **Talks to** | `useCheckinFormSubmit()`, N8N (`checkin-training` webhook for training requests) |
| **External deps** | N8N (training notifications) |

#### 9c. Public Invoice (`/invoice/:publicId`)

| Field | Value |
|-------|-------|
| **What** | Customer-facing invoice view with Stripe payment |
| **Inputs** | Invoice public ID |
| **Outputs** | Invoice display, payment redirect |
| **Talks to** | `mark-invoice-viewed` edge function, `create-checkout-session` edge function |
| **External deps** | Stripe Checkout |

---

### 10. UI Components

| Component | File | Purpose |
|-----------|------|---------|
| `AccessibleModal` | `ui/AccessibleModal.tsx` | Modal wrapper with focus trap, Escape key, ARIA attributes |
| `AccessibleSlidePanel` | `ui/AccessibleSlidePanel.tsx` | Right-side detail panel wrapper |
| `SortableTableHeader` | `ui/SortableTableHeader.tsx` | Table header with sort indicators |
| `FamilyItemGroup` | `ui/FamilyItemGroup.tsx` | Reusable family row renderer |
| `SmsStatusBadge` | `ui/SmsStatusBadge.tsx` | SMS delivery status badge |
| `StatusBadge` | `components/StatusBadge.tsx` | Universal status badge (family, enrollment, invoice, lead, payroll) |
| `CommandPalette` | `components/CommandPalette.tsx` | Global search (Cmd+K) — queries families, students, teachers via Supabase |

---

### 11. Auth Gate

| Field | Value |
|-------|-------|
| **What** | Client-side password gate protecting all admin routes |
| **File** | `components/AdminGate.tsx` |
| **Inputs** | `VITE_ADMIN_PASSWORD` env var, localStorage `eaton_admin_auth` |
| **Outputs** | Password prompt or renders children |
| **Talks to** | All admin routes (wraps Layout) |
| **External deps** | None |
| **Security** | Client-side only, NOT cryptographically secure. 30-day localStorage TTL. |

---

## Edge Functions

### 12. Calendly Webhook

| Field | Value |
|-------|-------|
| **What** | Handles Calendly invitee booking events and auto-creates leads |
| **File** | `supabase/functions/calendly-webhook/index.ts` |
| **Endpoint** | `POST /functions/v1/calendly-webhook` |
| **Auth** | `verify_jwt = false` |
| **Inputs** | `{ event: 'invitee.created' \| 'invitee.canceled', payload: { invitee: { name, email, text_reminder_number? }, scheduled_event: { start_time, name, location }, questions_and_answers? } }` |
| **Outputs** | `{ success, action: 'created' \| 'canceled' \| 'exists' }` |
| **Talks to** | `families`, `calendly_bookings`, `family_merge_log` |
| **External deps** | Calendly (receives webhooks from) |

**Key behavior:** Matches leads by email (primary + secondary) or name normalization. Phone extracted from `scheduled_event.location.location` (outbound calls) > `text_reminder_number` > form answers.

### 13. Ingest Lead

| Field | Value |
|-------|-------|
| **What** | N8N integration for intake form leads (exit intent, waitlist) |
| **File** | `supabase/functions/ingest-lead/index.ts` |
| **Endpoint** | `POST /functions/v1/ingest-lead` |
| **Auth** | `verify_jwt = false`, optional `x-api-key` header |
| **Inputs** | `{ lead_type: 'exit_intent' \| 'waitlist', email, name?, source_url?, num_children?, children_ages?, preferred_days?, service_interest?, notes? }` |
| **Outputs** | `{ success, action: 'created' \| 'exists' \| 'converted', familyId }` |
| **Talks to** | `families`, `lead_activities`, `family_merge_log` |
| **External deps** | N8N (receives data from intake form workflows) |

### 14. Send SMS

| Field | Value |
|-------|-------|
| **What** | Send SMS/MMS via Twilio and log to database |
| **File** | `supabase/functions/send-sms/index.ts` |
| **Endpoint** | `POST /functions/v1/send-sms` |
| **Auth** | Requires JWT |
| **Inputs** | `{ familyId?, familyIds?, toPhone?, messageBody, messageType: 'invoice_reminder' \| 'event_reminder' \| 'announcement' \| 'custom' \| 'bulk', invoiceId?, templateKey?, mergeData?, campaignName?, mediaUrls?, sentBy? }` |
| **Outputs** | `{ success, sent, failed, skipped, results: SendResult[] }` |
| **Talks to** | `families` (read phone, check opt-out), `sms_messages` (write), `sms_media` (write) |
| **External deps** | **Twilio API** — `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` |

**Status mapping:** Twilio `queued`/`sending`/`sent` → DB `sent`; `delivered`/`failed`/`undelivered` mapped directly.

### 15. Twilio Status Webhook

| Field | Value |
|-------|-------|
| **What** | Receives SMS delivery status updates from Twilio callbacks |
| **File** | `supabase/functions/twilio-status-webhook/index.ts` |
| **Endpoint** | `POST /functions/v1/twilio-status-webhook` |
| **Auth** | `verify_jwt = false` |
| **Inputs** | Form-encoded: `MessageSid, MessageStatus, ErrorCode, ErrorMessage` |
| **Outputs** | `{ success: true }` |
| **Talks to** | `sms_messages` (atomic status update) |
| **External deps** | Twilio (receives callbacks from) |

**Key behavior:** Atomic WHERE `.in('status', ['pending', 'sent'])` prevents late callbacks from downgrading terminal statuses (`delivered`, `failed`).

### 16. Twilio Opt-Out Webhook

| Field | Value |
|-------|-------|
| **What** | Handles STOP/START keywords in inbound SMS |
| **File** | `supabase/functions/twilio-opt-out-webhook/index.ts` |
| **Endpoint** | `POST /functions/v1/twilio-opt-out-webhook` |
| **Auth** | `verify_jwt = false` |
| **Inputs** | Form-encoded: `From, Body, MessageSid` |
| **Outputs** | `{ success, action: 'opted_out' \| 'opted_in' \| 'no_match' \| 'ignored', familiesUpdated? }` |
| **Talks to** | `families` (read by phone, write `sms_opt_out`), `sms_messages` (system log entry) |
| **External deps** | Twilio (receives inbound SMS from) |

**Keywords:** Opt-out: STOP/STOPALL/UNSUBSCRIBE/CANCEL/END/QUIT. Opt-in: START/UNSTOP/SUBSCRIBE.

### 17. Stripe Webhook

| Field | Value |
|-------|-------|
| **What** | Processes Stripe `checkout.session.completed` events |
| **File** | `supabase/functions/stripe-webhook/index.ts` |
| **Endpoint** | `POST /functions/v1/stripe-webhook` |
| **Auth** | `verify_jwt = false` + Stripe signature verification |
| **Inputs** | Stripe Event JSON with `Stripe-Signature` header |
| **Outputs** | `{ received: true, status: 'already_processed' \| 'processing' }` |
| **Talks to** | `invoices`, `payments`, `event_orders`, `stripe_invoice_webhooks` |
| **External deps** | **Stripe** — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |

**Key behavior:** Idempotent via `stripe_invoice_webhooks` table. Creates payment record, updates invoice status to `paid`, updates linked `event_orders.payment_status`.

### 18. Create Checkout Session

| Field | Value |
|-------|-------|
| **What** | Creates Stripe Checkout Session for invoice payment |
| **File** | `supabase/functions/create-checkout-session/index.ts` |
| **Endpoint** | `POST /functions/v1/create-checkout-session` |
| **Auth** | `verify_jwt = false` (public invoice page) |
| **Inputs** | `{ invoice_public_id }` |
| **Outputs** | `{ checkout_url, session_id }` |
| **Talks to** | `invoices` (read), `families` (read) |
| **External deps** | **Stripe Checkout API** — `STRIPE_SECRET_KEY` |

### 19. Mailchimp Edge Function

| Field | Value |
|-------|-------|
| **What** | Mailchimp API wrapper — subscriber management, campaigns, engagement |
| **File** | `supabase/functions/mailchimp/index.ts` |
| **Endpoint** | `POST /functions/v1/mailchimp` |
| **Auth** | Requires JWT (except when called by DB trigger via `pg_net`) |
| **Inputs** | `{ action: string, payload: { familyId?, email?, tags?, campaignId?, count? } }` |
| **Outputs** | Varies by action |
| **Talks to** | `families` (read), `lead_metadata` (read) |
| **External deps** | **Mailchimp API v3** — `MAILCHIMP_API_KEY`, `MAILCHIMP_SERVER_PREFIX` (us13), `MAILCHIMP_LIST_ID` (693d484108) |

**Actions:** `sync_lead`, `sync_family`, `bulk_sync`, `add_tags`, `remove_tags`, `get_subscriber`, `get_activity`, `get_campaigns`, `get_campaign_report`, `sync_campaigns`, `sync_campaign_activity`, `get_audience_stats`, `sync_engagement`, `bulk_sync_engagement`, `sync_family_status`

### 20. Form Submitted

| Field | Value |
|-------|-------|
| **What** | Google Forms submission webhook (via Apps Script) |
| **File** | `supabase/functions/form-submitted/index.ts` |
| **Endpoint** | `POST /functions/v1/form-submitted` |
| **Auth** | `verify_jwt = false` |
| **Inputs** | `{ form_id, respondent_email?, response_id, submitted_at, answers? }` |
| **Outputs** | `{ success, matched, updated?, items? }` |
| **Talks to** | `enrollment_onboarding` (match by form_id + email, update status to `completed`) |
| **External deps** | Google Forms (receives webhooks from Apps Script) |

### 21. Send Onboarding

| Field | Value |
|-------|-------|
| **What** | Create onboarding records and send forms/documents |
| **File** | `supabase/functions/send-onboarding/index.ts` |
| **Endpoint** | `POST /functions/v1/send-onboarding` |
| **Auth** | Requires JWT |
| **Inputs** | `{ enrollment_id, item_keys: string[], merge_data? }` |
| **Outputs** | `{ success, created, sent, failed }` |
| **Talks to** | `enrollments`, `services`, `students`, `families`, `enrollment_onboarding`, `sms_messages` |
| **External deps** | **N8N** — `N8N_SEND_EMAIL_WEBHOOK_URL`, `N8N_CREATE_DOCUMENT_WEBHOOK_URL`, `N8N_NUDGE_WEBHOOK_URL` |

### 22. Check Onboarding Status

| Field | Value |
|-------|-------|
| **What** | Polls Google Forms for completions and updates database |
| **File** | `supabase/functions/check-onboarding-status/index.ts` |
| **Endpoint** | `POST /functions/v1/check-onboarding-status` |
| **Auth** | Requires JWT |
| **Inputs** | `{ enrollment_id }` |
| **Outputs** | `{ success, updated, checked }` |
| **Talks to** | `enrollment_onboarding`, `enrollments` |
| **External deps** | **N8N** — `N8N_CHECK_STATUS_WEBHOOK_URL` |

### 23. Get Pending Onboarding

| Field | Value |
|-------|-------|
| **What** | Returns pending onboarding items for N8N nudge workflows |
| **File** | `supabase/functions/get-pending-onboarding/index.ts` |
| **Endpoint** | `POST /functions/v1/get-pending-onboarding` |
| **Auth** | `verify_jwt = false` (called by N8N) |
| **Inputs** | `{ enrollment_id }` |
| **Outputs** | `{ success, hasPending, pendingCount, items: [{ name, url, type }], customer_email, customer_name, student_name }` |
| **Talks to** | `enrollment_onboarding`, `enrollments`, `families`, `students` |
| **External deps** | N8N (called by nudge workflow) |

### 24. Mark Invoice Viewed

| Field | Value |
|-------|-------|
| **What** | Tracks first invoice view on public invoice page |
| **File** | `supabase/functions/mark-invoice-viewed/index.ts` |
| **Endpoint** | `POST /functions/v1/mark-invoice-viewed` |
| **Auth** | `verify_jwt = false` |
| **Inputs** | `{ public_id }` |
| **Outputs** | `{ success, updated, message }` |
| **Talks to** | `invoices` (write `viewed_at`, only on first view) |
| **External deps** | None |

---

## Database Triggers

Triggers are invisible side effects — they fire automatically when upstream data changes and can create, modify, or sync data across tables and external services. Every trigger in the system is documented below so future sessions know what chain reactions to expect.

### Trigger Execution Order

When multiple triggers exist on the same table/event, PostgreSQL fires BEFORE triggers (alphabetically) first, then the row operation, then AFTER triggers (alphabetically). This matters for tables like `enrollments` and `event_orders` that have multiple triggers.

---

### T1. Invoice Number Generation

| Field | Value |
|-------|-------|
| **Trigger** | `invoice_number_trigger` |
| **Table** | `invoices` |
| **Event** | BEFORE INSERT (every row) |
| **Function** | `set_invoice_number()` → `generate_invoice_number()` |

**What it does:** If `invoice_number` is NULL on the new row, auto-generates a sequential number in `INV-YYYY-NNNN` format (e.g., `INV-2026-0042`).

**Reads:** `invoice_number_counter` table (upserts current year's counter)
**Writes:** `invoice_number_counter.last_number` (incremented), `NEW.invoice_number` (set on the row)

**Downstream effects:** None — purely data enrichment on the new row.

**Gotchas:**
- Counter is per-year. A new year resets numbering to `0001`.
- If `invoice_number` is provided on INSERT, the trigger is a no-op.
- The counter increment is atomic (`ON CONFLICT DO UPDATE`), safe for concurrent inserts.

---

### T2. Revenue Records on Payment

| Field | Value |
|-------|-------|
| **Trigger** | `trigger_create_revenue_on_payment` |
| **Table** | `invoices` |
| **Event** | AFTER UPDATE (every row) |
| **Function** | `create_revenue_records_on_payment()` |

**What it does:** When an invoice's status changes TO `paid` (and was not already `paid`), creates one `revenue_records` row per line item. Only processes invoices dated `>= 2026-01-01`.

**Reads:** `invoice_line_items` (amounts), `enrollments` (student, service, class_title), `services` (code for location mapping), `locations` (id lookup by code)
**Writes:** `revenue_records` (INSERT with `ON CONFLICT DO NOTHING` on `source_line_item_id`)

**Location mapping (hardcoded in function):**

| Service Code | Location |
|-------------|----------|
| `learning_pod`, `eaton_hub` | `kendall` |
| `elective_classes` (Spanish 101) | `remote` |
| `elective_classes` (other) | `kendall` |
| `eaton_online`, `consulting`, `consulting_with_teacher`, `consulting_only`, `academic_coaching` | `remote` |

**Downstream effects:**
- `get_revenue_by_month` and `get_revenue_by_location` RPCs read from `revenue_records`
- Reports page charts and Command Center MRR metric depend on this data

**Gotchas:**
- Fires on UPDATE only, not INSERT. An invoice inserted directly as `paid` will NOT generate revenue records.
- Idempotent: re-paying an invoice (void → re-pay cycle) won't duplicate records thanks to `ON CONFLICT`.
- New service codes must be added to the CASE mapping manually — unmapped services get `location_id = NULL`.
- Pre-2026 invoices are excluded (`invoice_date < '2026-01-01'`).

---

### T3. Payment Updates Invoice

| Field | Value |
|-------|-------|
| **Trigger** | `payment_updates_invoice` |
| **Table** | `payments` |
| **Event** | AFTER INSERT OR UPDATE (every row) |
| **Function** | `update_invoice_on_payment()` |

**What it does:** Recalculates `amount_paid` on the linked invoice by summing all payments, then updates the invoice status: `paid` if fully covered, `partial` if partially covered, unchanged otherwise.

**Reads:** `invoices.total_amount`, `payments` (SUM of all payments for that invoice)
**Writes:** `invoices.amount_paid`, `invoices.status` (may change to `paid` or `partial`)

**Downstream effects:**
- Changing invoice status to `paid` fires **T2** (`trigger_create_revenue_on_payment`), which creates revenue records.
- Changing invoice status may also affect Command Center dashboard stats (outstanding balance, overdue count).

**Chain reaction:** `payments INSERT` → T3 sets `invoices.status = 'paid'` → T2 creates `revenue_records`

**Gotchas:**
- Fires on both INSERT and UPDATE. Transferring a payment (updating `invoice_id`) recalculates for the NEW invoice but does NOT recalculate the OLD invoice. You must manually reset `amount_paid` on the source invoice.
- The `balance_due` column on `invoices` is a generated column (`total_amount - amount_paid`) — don't UPDATE it directly.

---

### T4. Auto-Convert Leads on Enrollment (INSERT)

| Field | Value |
|-------|-------|
| **Trigger** | `enrollment_auto_convert_lead` |
| **Table** | `enrollments` |
| **Event** | AFTER INSERT |
| **Condition** | `WHEN (NEW.status IN ('active', 'trial'))` |
| **Function** | `auto_convert_leads_on_enrollment()` |

**What it does:** When an active or trial enrollment is created, finds OTHER families with `status='lead'` that share the same email (primary or secondary, cross-matched) and auto-converts them.

**Reads:** `families` (the enrolled family's emails), `families` (scan for matching leads)
**Writes:** `families` (matching leads: `status='active'`, `lead_status='converted'`, `converted_at=NOW()`, appends note)

**Downstream effects:**
- Converting a lead's status fires **T6** (`trigger_sync_family_status_to_mailchimp`), which syncs the new status to Mailchimp.
- Marketing page "Converted" metric depends on `lead_status='converted'`.
- Command Center lead counts update.

**Chain reaction:** `enrollments INSERT` → T4 sets `families.status = 'active'` → T6 syncs to Mailchimp

**Gotchas:**
- Only converts leads with `lead_status IN ('new', 'contacted')` — already converted or closed leads are skipped.
- Matches on both `primary_email` and `secondary_email` in both directions (4-way cross-match).
- Does NOT convert the family that owns the enrollment — only OTHER families with matching emails.

---

### T5. Auto-Convert Leads on Enrollment (UPDATE)

| Field | Value |
|-------|-------|
| **Trigger** | `enrollment_status_change_auto_convert_lead` |
| **Table** | `enrollments` |
| **Event** | AFTER UPDATE OF `status` |
| **Condition** | `WHEN (OLD.status NOT IN ('active', 'trial') AND NEW.status IN ('active', 'trial'))` |
| **Function** | `auto_convert_leads_on_enrollment()` |

Same function as T4. Fires when an enrollment transitions INTO active/trial from another status (e.g., `pending` → `active`).

---

### T6. Mailchimp Sync on Family Status Change

| Field | Value |
|-------|-------|
| **Trigger** | `trigger_sync_family_status_to_mailchimp` |
| **Table** | `families` |
| **Event** | AFTER UPDATE OF `status` |
| **Function** | `sync_family_status_to_mailchimp()` (SECURITY DEFINER) |

**What it does:** When a family's `status` column changes AND the new status is `active`, `trial`, `churned`, or `paused`, fires an async HTTP POST via `pg_net` to the `mailchimp` edge function with action `sync_family_status`.

**Reads:** `NEW.id`, `NEW.primary_email`, `NEW.primary_contact_name`, `NEW.display_name`, `NEW.primary_phone`, `NEW.status`, `OLD.status`
**Writes:** Nothing directly — the edge function handles Mailchimp API calls and may write back `mailchimp_id`, `mailchimp_status`, `mailchimp_last_synced_at` to `families`

**Downstream effects:**
- Mailchimp subscriber tags are swapped (old status tag removed, new status tag added)
- Tag mapping: `active`/`trial` → `active-family`, `lead` → `lead`, `churned`/`paused` → `churned`

**Gotchas:**
- Uses `pg_net` (async HTTP) — failures are completely silent. No retry, no error logging in the DB.
- Only fires when `primary_email IS NOT NULL` (checked in function body, not WHEN clause).
- Does NOT fire for `lead` status — only `active`, `trial`, `churned`, `paused`. Lead → active conversion triggers it because the new status is `active`.
- Uses `SECURITY DEFINER` with a hardcoded service role key for the edge function call.

---

### T7. Event Order → Lead/Family Creation (INSERT)

| Field | Value |
|-------|-------|
| **Trigger** | `trg_event_order_lead_insert` |
| **Table** | `event_orders` |
| **Event** | BEFORE INSERT |
| **Condition** | `WHEN (NEW.payment_status IN ('paid', 'stepup_pending'))` |
| **Function** | `process_event_registration()` |

**What it does:** For event-type orders (not classes) with paid/stepup_pending status, auto-links or creates a family. If no `family_id` is set, looks up by `purchaser_email`. If no match, creates a new lead family from the purchaser info.

**Reads:** `event_events` (event_type), `families` (email lookup)
**Writes:** `families` (may INSERT new lead), `NEW.family_id` (set on the order row)

**Downstream effects:**
- New lead family creation means it appears in Marketing pipeline.
- Does NOT fire T6 (Mailchimp sync) because new families are created as `lead` status, which T6 skips.

**Gotchas:**
- BEFORE trigger — modifies `NEW.family_id` before the row is inserted.
- Only fires for `event_type = 'event'` (not `'class'`). Class registrations are handled by T9/T10.
- New families are created with `status = 'lead'` — they're event leads, not active customers.

---

### T8. Event Order → Lead/Family Creation (UPDATE)

| Field | Value |
|-------|-------|
| **Trigger** | `trg_event_order_lead` |
| **Table** | `event_orders` |
| **Event** | BEFORE UPDATE |
| **Condition** | `WHEN (NEW.payment_status IN ('paid', 'stepup_pending') AND OLD.payment_status IS DISTINCT FROM NEW.payment_status)` |
| **Function** | `process_event_registration()` |

Same function as T7. Fires when `payment_status` transitions TO `paid`/`stepup_pending`.

---

### T9. Class Registration → Students & Enrollments (Attendee Insert)

| Field | Value |
|-------|-------|
| **Trigger** | `trg_attendee_insert` |
| **Table** | `event_attendees` |
| **Event** | AFTER INSERT (every row) |
| **Function** | `process_class_registration()` |

**What it does:** When an attendee row is inserted, processes class registration: finds or creates a student (using exact name match then fuzzy match at threshold 0.55), then creates an enrollment for the class if one doesn't already exist. Finally, auto-converts the family from lead to active if applicable.

**Reads:** `event_orders` (family_id, payment_status), `event_events` (event_type, title, schedule, tuition), `students` (name matching within family), `enrollments` (dedup check), `services` (elective_classes lookup)
**Writes:** `students` (may INSERT), `enrollments` (may INSERT), `families` (may UPDATE status from lead → active)

**Downstream effects:**
- New enrollment INSERT may fire **T4** (auto-convert leads) if the enrollment is active/trial.
- Family status change to active fires **T6** (Mailchimp sync).
- New enrollment may fire **T11** (`update_enrollments_updated_at`).

**Chain reaction:** `event_attendees INSERT` → T9 creates `students` + `enrollments` + updates `families.status` → T4 converts matching leads → T6 syncs Mailchimp

**Gotchas:**
- Only processes `event_type = 'class'` with `payment_status IN ('paid', 'stepup_pending')`.
- Fuzzy matching uses `pg_trgm` `similarity()` at threshold 0.55. Catches typos (score ~0.62) but stays above sibling-to-sibling scores (0.3-0.4). Do NOT change without testing.
- Student names are normalized to "Last, First" format via `normalize_name_to_last_first()`.
- Age groups are derived via `derive_age_group()` function.
- Monthly tuition is stored in cents in `event_events` and converted to dollars for `enrollments.monthly_rate`.

---

### T10. Class Registration → Students & Enrollments (Order Paid)

| Field | Value |
|-------|-------|
| **Trigger** | `trg_order_paid` |
| **Table** | `event_orders` |
| **Event** | AFTER UPDATE |
| **Condition** | `WHEN (NEW.payment_status IN ('paid', 'stepup_pending') AND OLD.payment_status <> NEW.payment_status)` |
| **Function** | `process_class_registration()` |

Same function as T9. Fires when an order's `payment_status` transitions TO paid/stepup_pending, processing all attendees on that order.

---

### T11. Desk Token Generation

| Field | Value |
|-------|-------|
| **Trigger** | `teacher_desk_token_trigger` |
| **Table** | `teachers` |
| **Event** | BEFORE INSERT (every row) |
| **Function** | `generate_desk_token()` |

**What it does:** If `desk_token` is NULL, generates a URL-safe random 16-character token from 12 random bytes (base64-encoded with `+`/`/`/`=` replaced).

**Reads:** Nothing
**Writes:** `NEW.desk_token` (set on the row)

**Downstream effects:** The token is used for the public `/desk/:token` route (teacher check-in portal).

**Gotchas:**
- Only generates if `desk_token IS NULL` — providing a token on INSERT skips generation.
- Tokens are not checked for uniqueness (collision probability is negligible with 12 random bytes).

---

### T12. `updated_at` Timestamp Triggers

The following triggers all do the same thing: set `NEW.updated_at = NOW()` before any UPDATE. They exist to keep `updated_at` columns accurate without requiring application code to set them.

| Trigger | Table | Function |
|---------|-------|----------|
| `update_families_updated_at` | `families` | `update_updated_at_column()` |
| `update_enrollments_updated_at` | `enrollments` | `update_updated_at_column()` |
| `update_invoices_updated_at` | `invoices` | `update_updated_at_column()` |
| `update_students_updated_at` | `students` | `update_updated_at_column()` |
| `update_teachers_updated_at` | `teachers` | `update_updated_at_column()` |
| `update_email_templates_updated_at` | `email_templates` | `update_updated_at_column()` |
| `calendly_bookings_updated_at` | `calendly_bookings` | `update_updated_at()` |
| `checkin_periods_updated_at` | `checkin_periods` | `update_checkin_periods_updated_at()` |
| `email_campaigns_updated_at` | `email_campaigns` | `update_email_campaigns_updated_at()` |
| `enrollment_onboarding_updated_at` | `enrollment_onboarding` | `update_enrollment_onboarding_updated_at()` |
| `lead_campaign_engagement_updated_at` | `lead_campaign_engagement` | `update_lead_campaign_engagement_updated_at()` |
| `trigger_update_lead_follow_ups_updated_at` | `lead_follow_ups` | `update_lead_follow_ups_updated_at()` |
| `sms_messages_updated_at` | `sms_messages` | `update_sms_messages_updated_at()` |

**Note:** Three different function names (`update_updated_at_column`, `update_updated_at`, `update_<table>_updated_at`) all have identical bodies. This is historical — new tables should use `update_updated_at_column()`.

---

### Chain Reaction Summary

These are the most important multi-step trigger chains. When you touch upstream data, these downstream effects happen invisibly:

```
payments INSERT/UPDATE
  └─→ T3: invoices.amount_paid recalculated, status → paid/partial
       └─→ T2: revenue_records created (if status became 'paid', invoice >= 2026-01-01)

event_orders.payment_status → 'paid'
  ├─→ T7/T8: families created/linked (event type only)
  └─→ T10: process_class_registration (class type only)
       ├─→ students created (fuzzy matched or new)
       ├─→ enrollments created
       │    └─→ T4: matching leads auto-converted
       │         └─→ T6: Mailchimp tags synced
       └─→ families.status → 'active' (if was lead)
            └─→ T6: Mailchimp tags synced

enrollments INSERT (active/trial)
  └─→ T4: matching lead families auto-converted
       └─→ T6: Mailchimp tags synced

families.status changed
  └─→ T6: Mailchimp tags synced (async, silent failures)
```

### Important Gotchas (Consolidated)

1. **T2 fires on UPDATE only** — inserting an invoice directly as `paid` skips revenue record creation.
2. **T3 does not recalculate the OLD invoice** when transferring payments — manually reset `amount_paid`.
3. **T6 uses `pg_net` (async HTTP)** — Mailchimp sync failures are completely silent. Check Mailchimp directly if tags seem wrong.
4. **T6 does not fire for `lead` status** — only `active`, `trial`, `churned`, `paused`.
5. **T9 fuzzy match threshold is 0.55** — do NOT change without testing against real sibling name pairs.
6. **T2 location mapping is hardcoded** — new service codes need manual addition to the CASE statement.
7. **T3 + T2 chain** — a payment INSERT can cascade through two triggers to create revenue records. Both are idempotent.
8. **T7/T8 create leads, not active families** — event registrations create `status='lead'` families. Only class registrations (T9/T10) auto-convert to active.
9. **`updated_at` triggers fire on EVERY update** — even no-op updates where no columns actually changed. This is by design (PostgreSQL fires row-level triggers regardless of whether values changed).

---

## Database RPC Functions

| Function | Parameters | Returns | Purpose |
|----------|-----------|---------|---------|
| `get_revenue_by_month` | `p_start_date: DATE` | `[{ month: DATE, total_revenue: NUMERIC }]` | Aggregates `revenue_records` by month (avoids 1000 row limit) |
| `get_revenue_by_location` | `p_start_date: DATE` | `[{ location_id: UUID, location_name: TEXT, total_revenue: NUMERIC }]` | Groups `revenue_records` by location |

---

## N8N Webhook Endpoints

Base URL: `https://eatonacademic.app.n8n.cloud/webhook/`
Env var: `VITE_N8N_BASE_URL`

### Frontend → N8N (outbound)

| Path | Method | Called From | Payload | Purpose |
|------|--------|-------------|---------|---------|
| `/gmail-search` | POST | `gmail.ts` | `{ email, query, maxResults, pageToken }` | Search Gmail messages |
| `/gmail-thread` | POST | `gmail.ts` | `{ threadId }` | Fetch full Gmail thread |
| `/gmail-send` | POST | `gmail.ts` | `{ threadId?, to, subject, body, htmlBody? }` | Send email via Gmail |
| `/invoice-send` | POST | `hooks.ts` | `{ type: 'send'\|'early_reminder'\|'overdue_reminder', invoice_id, family_id, family_name, email, invoice_number, amount_due, due_date, invoice_url }` | Send invoice emails/reminders |
| `/payroll-notification` | POST | `PayrollRunDetail.tsx` | `{ action: 'created'\|'published', payroll_run_id, period, total_amount, teacher_count }` | Notify about payroll runs |
| `/checkin-notify` | POST | `hooks.ts` | `{ type: 'initial'\|'reminder', teacher_email, teacher_name, desk_token, desk_url, event_date, event_name }` | Send teacher check-in invites |
| `/checkin-training` | POST | `hooks.ts` | `{ teacher_email, teacher_name, assessment_results, training_requested }` | Training request notifications |

### Edge Function → N8N (outbound)

| Env Var | Called From | Purpose |
|---------|-------------|---------|
| `N8N_SEND_EMAIL_WEBHOOK_URL` | `send-onboarding` | Send onboarding form emails |
| `N8N_CREATE_DOCUMENT_WEBHOOK_URL` | `send-onboarding` | Create Google Docs from templates |
| `N8N_NUDGE_WEBHOOK_URL` | `send-onboarding` | Queue SMS nudge reminders |
| `N8N_CHECK_STATUS_WEBHOOK_URL` | `check-onboarding-status` | Poll Google Forms for completions |

### N8N → Edge Functions (inbound)

| Edge Function | N8N Workflow | Purpose |
|---------------|-------------|---------|
| `ingest-lead` | Exit intent / waitlist form workflows | Creates leads from form submissions |
| `get-pending-onboarding` | Nudge reminder workflow | Returns pending items for follow-up emails |

### Standalone N8N Workflows

| Workflow ID | Schedule | Purpose |
|-------------|----------|---------|
| `zueutqemoLNaAPk7` | Mondays 10:00 AM EST | Weekly Blog Newsletter via Mailchimp (full audience) |

---

## External Service Dependencies

### Supabase

| Property | Value |
|----------|-------|
| **Service** | PostgreSQL database + Edge Functions + Realtime |
| **Project ref** | `lxebvngzgabuqfugyqfj` |
| **Client env vars** | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| **Contract** | Typed via auto-generated `src/types/supabase.ts` (`npm run db:types`). No RLS. 1000 row default limit — use RPCs for aggregation. |

### Stripe

| Property | Value |
|----------|-------|
| **Service** | Payment processing (Checkout Sessions) |
| **Used by** | `create-checkout-session`, `stripe-webhook` edge functions |
| **Secrets** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| **Contract** | Creates Checkout Session with metadata `{ invoice_id, invoice_public_id, family_id }`. Webhook fires `checkout.session.completed`. Amounts in cents. |

### Twilio

| Property | Value |
|----------|-------|
| **Service** | SMS/MMS sending and delivery tracking |
| **Used by** | `send-sms`, `twilio-status-webhook`, `twilio-opt-out-webhook` edge functions |
| **Secrets** | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` |
| **Contract** | REST API for message creation. Status callbacks POST form-encoded `{ MessageSid, MessageStatus, ErrorCode, ErrorMessage }`. Inbound SMS POST `{ From, Body, MessageSid }`. Pricing: $0.0079/SMS segment, $0.02/MMS. |

### Mailchimp

| Property | Value |
|----------|-------|
| **Service** | Email marketing — subscriber management, campaigns, engagement |
| **Used by** | `mailchimp` edge function, DB trigger |
| **Secrets** | `MAILCHIMP_API_KEY`, `MAILCHIMP_SERVER_PREFIX` (us13), `MAILCHIMP_LIST_ID` (693d484108) |
| **Contract** | API v3 at `https://us13.api.mailchimp.com/3.0`. Subscriber ID = MD5(lowercase email). PUT for upsert. Tags are additive; status tags swapped explicitly. |

### Calendly

| Property | Value |
|----------|-------|
| **Service** | Scheduling — booking notifications |
| **Used by** | `calendly-webhook` edge function |
| **Contract** | Webhook events: `invitee.created`, `invitee.canceled`. Phone in `scheduled_event.location.location` for outbound calls. |

### Google Forms

| Property | Value |
|----------|-------|
| **Service** | Enrollment onboarding forms |
| **Used by** | `form-submitted` edge function, `send-onboarding`, `check-onboarding-status` |
| **Contract** | Apps Script triggers POST to `form-submitted` on submission. Form ID format: edit ID `/forms/d/{id}/viewform` (NOT published ID). |

### Gmail (via N8N)

| Property | Value |
|----------|-------|
| **Service** | Email send/receive/search |
| **Used by** | `gmail.ts` → N8N webhooks (gmail-search, gmail-thread, gmail-send) |
| **Contract** | N8N proxies Gmail API. 30-second timeout. Returns `{ success, error?, data }`. |

### N8N Cloud

| Property | Value |
|----------|-------|
| **Service** | Workflow automation — email sending, document creation, form checking, newsletters |
| **Base URL** | `https://eatonacademic.app.n8n.cloud/webhook/` |
| **Client env var** | `VITE_N8N_BASE_URL` |
| **Contract** | POST JSON to webhook paths. N8N cannot query Supabase directly (filterString breaks on emails with dots). Use helper edge functions instead. |

---

## Environment Variables Summary

### Client-Side (Vite)

| Variable | Used By | Purpose |
|----------|---------|---------|
| `VITE_SUPABASE_URL` | `supabase.ts` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `supabase.ts` | Supabase public anon key |
| `VITE_ADMIN_PASSWORD` | `AdminGate.tsx` | Client-side admin password |
| `VITE_N8N_BASE_URL` | `gmail.ts`, `hooks.ts` | N8N webhook base URL |
| `VITE_APP_URL` | Email templates | Public app URL for links in emails |

### Edge Function Secrets (Supabase Dashboard)

| Variable | Used By | Purpose |
|----------|---------|---------|
| `TWILIO_ACCOUNT_SID` | `send-sms` | Twilio account |
| `TWILIO_AUTH_TOKEN` | `send-sms` | Twilio auth |
| `TWILIO_PHONE_NUMBER` | `send-sms` | Sender phone number |
| `STRIPE_SECRET_KEY` | `create-checkout-session`, `stripe-webhook` | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook` | Stripe webhook signature verification |
| `MAILCHIMP_API_KEY` | `mailchimp` | Mailchimp API auth |
| `MAILCHIMP_SERVER_PREFIX` | `mailchimp` | Mailchimp datacenter (us13) |
| `MAILCHIMP_LIST_ID` | `mailchimp` | Mailchimp audience ID (693d484108) |
| `LEAD_INGEST_API_KEY` | `ingest-lead` | Optional API key for lead ingestion |
| `N8N_SEND_EMAIL_WEBHOOK_URL` | `send-onboarding` | N8N email webhook |
| `N8N_CREATE_DOCUMENT_WEBHOOK_URL` | `send-onboarding` | N8N document creation webhook |
| `N8N_NUDGE_WEBHOOK_URL` | `send-onboarding` | N8N nudge reminder webhook |
| `N8N_CHECK_STATUS_WEBHOOK_URL` | `check-onboarding-status` | N8N form status check webhook |

---

## Change Impact Matrix

> **Purpose:** For any schema or behavior change to a major entity, this section answers "what breaks?" by listing every hook, edge function, N8N workflow, database trigger, and UI component that depends on it. This is the blast-radius reference — check it before modifying any table.
>
> **How to read:** Each entity lists its dependents across all system layers. A component marked with `(direct)` queries Supabase directly (bypassing hooks), meaning it's also sensitive to column renames and type changes. Components without `(direct)` consume data through hooks, so hook-level changes cascade to them automatically.

---

### `families`

| Layer | Affected |
|-------|----------|
| **Hooks** | `useFamilies`, `useFamiliesWithStudents`, `useFamily`, `useFamilyMutations`, `usePaginatedFamilies`, `useLeads`, `useLead`, `useLeadMutations`, `useConvertedLeadsCount`, `useCheckDuplicateEmails`, `useCheckMatchingLeads`, `useSmsMutations.updateOptOut`, `useTags`, `calculateFamilyBalances`, `useConversionAnalytics` |
| **Edge Functions** | `calendly-webhook` (R/W — lookup by email, create leads), `ingest-lead` (R/W — lookup by email, create leads), `send-sms` (R — phone, opt-out check), `twilio-opt-out-webhook` (R/W — phone lookup, set `sms_opt_out`), `mailchimp` (R/W — subscriber sync, write `mailchimp_*` fields), `create-checkout-session` (R — family name for Stripe) |
| **N8N Workflows** | Exit intent / waitlist form → `ingest-lead` (creates lead families) |
| **Triggers** | T4/T5 `auto_convert_leads` (writes `status`, `lead_status`, `converted_at`), T6 `mailchimp_sync` (fires on `status` change), T7/T8 `event_order_lead` (may INSERT new lead families), T9/T10 `process_class_registration` (calls `find_or_create_family_for_purchase`) |
| **UI Components** | `Directory`, `AddFamilyModal`, `EditFamilyModal`, `LinkEventOrdersModal`, `LinkHubBookingsModal`, `AddEnrollmentModal`, `ImportHistoricalInvoiceModal`, `QuickSend`, `FamilyDetailPanel`, `Marketing`, `LeadDetailPanel`, `EditLeadModal`, `ImportLeadsModal`, `AddFamilyModal` (lead matching), `ConversionAnalytics`, `CampaignAnalytics`, `CommandCenter` (direct), `PublicInvoicePage` (direct), `EventDetailPanel` (direct) |

**High-risk columns:** `status` (triggers T6 Mailchimp sync; drives lead vs. customer distinction everywhere), `primary_email` (used for dedup in 4 edge functions + T4/T5 cross-match), `primary_phone` (SMS sending + Twilio opt-out matching), `sms_opt_out` (gates all SMS sends), `display_name` (used in name-based matching, formatted by `formatNameLastFirst`).

---

### `students`

| Layer | Affected |
|-------|----------|
| **Hooks** | `useStudentsByFamily`, `useStudentMutations`, and joined by: `useEnrollments`, `useEnrollmentsByFamily`, `useBillableEnrollments`, `useTeachersWithLoad`, `useTeacherStudents`, `usePaginatedFamilies` (student name search) |
| **Edge Functions** | `send-onboarding` (R — student name for form merge), `get-pending-onboarding` (R — student name) |
| **N8N Workflows** | Onboarding email/document workflows (receive student name from edge functions) |
| **Triggers** | T9/T10 `process_class_registration` (INSERT students from event attendee names, fuzzy-matched at 0.55 threshold) |
| **UI Components** | `AddStudentModal`, `EditStudentModal`, `FamilyDetailPanel` (student list via props), `Directory` (student count column), `ActiveRoster` (via enrollment joins), `EnrollmentDetailPanel` (student info), `CheckinForm` (student resources), `TeacherDesk` (student list) |

**High-risk columns:** `full_name` (used in T9/T10 fuzzy matching — threshold 0.55), `family_id` (FK joins everywhere), `grade_level` (check-in forms, roster filtering).

---

### `enrollments`

| Layer | Affected |
|-------|----------|
| **Hooks** | `useEnrollments`, `useEnrollmentsByFamily`, `useEnrollment`, `useEnrollmentMutations`, `useBillableEnrollments`, `useExistingInvoicesForPeriod`, `useEnrollmentOnboarding`, `useOnboardingMutations`, `useTeachersWithLoad` (joins), `usePayrollMutations.createPayrollRun` (reads for line item generation) |
| **Edge Functions** | `send-onboarding` (R — enrollment + service for config), `check-onboarding-status` (R/W — enrollment status), `get-pending-onboarding` (R), `ingest-lead` (R — checks for existing enrollments), `calendly-webhook` (R — checks for existing enrollments) |
| **N8N Workflows** | Onboarding email, document creation, nudge, and status-check workflows |
| **Triggers** | T2 `revenue_records` (reads enrollments for student/service/class info on paid invoices), T4 `auto_convert_leads` (fires on INSERT when status=active/trial), T5 `auto_convert_leads` (fires on UPDATE to active/trial), T9/T10 `process_class_registration` (INSERT enrollments from class registrations) |
| **UI Components** | `ActiveRoster`, `AddEnrollmentModal`, `EditEnrollmentModal`, `EndEnrollmentModal`, `FamilyDetailPanel`, `GenerateDraftsModal`, `EnrollmentDetailPanel`, `SendFormsModal`, `CommandCenter` (direct — active count, trial count, new enrollments) |

**High-risk columns:** `status` (drives T4/T5 lead conversion, roster visibility, billability, dashboard metrics), `hours_per_week` (synced with `teacher_assignments.hours_per_week` — must update both), `service_id` / `student_id` / `family_id` (FK joins across invoicing, payroll, revenue).

**Chain reaction:** `enrollments INSERT (status=active)` → T4 converts matching leads → T6 syncs to Mailchimp.

---

### `invoices`

| Layer | Affected |
|-------|----------|
| **Hooks** | `useInvoices`, `useInvoicesByFamily`, `useInvoicesWithDetails`, `useInvoiceMutations` (18 functions), `useExistingInvoicesForPeriod`, `useInvoiceEmails`, `useInvoicePayments`, `useInvoiceEmailsByFamily`, `calculateFamilyBalances` (reads `balance_due`), `usePaginatedFamilies` (via `calculateFamilyBalances`) |
| **Edge Functions** | `stripe-webhook` (R/W — reads by `public_id`, writes `status`/`amount_paid`, creates payments), `create-checkout-session` (R — reads for Stripe session), `mark-invoice-viewed` (W — sets `viewed_at`) |
| **N8N Workflows** | `invoice-send` webhook (send/reminder emails with invoice data) |
| **Triggers** | T1 `invoice_number_trigger` (BEFORE INSERT — auto-generates `invoice_number`), T2 `revenue_records` (AFTER UPDATE — creates revenue when status→paid), T3 `payment_updates_invoice` (writes `amount_paid`, `status` from payment totals) |
| **UI Components** | `Invoicing`, `EditInvoiceModal`, `ImportHistoricalInvoiceModal`, `GenerateDraftsModal`, `InvoiceDetailPanel`, `FamilyDetailPanel`, `PayrollRunDetail`, `EmailHistory`, `CommandCenter` (direct — outstanding balance, overdue count, revenue), `Reports` (direct — cash received, balances), `PublicInvoicePage` (direct — full invoice render) |

**High-risk columns:** `status` (drives T2 revenue generation, dashboard metrics, public invoice display), `amount_paid` (generated by T3 from payment sums — don't write directly), `balance_due` (GENERATED column = `total_amount - amount_paid` — don't UPDATE), `public_id` (used by Stripe webhook + public invoice page), `invoice_number` (auto-generated by T1).

**Chain reaction:** `payments INSERT` → T3 sets `invoices.status=paid` → T2 creates `revenue_records` → Reports/Dashboard update.

---

### `payments`

| Layer | Affected |
|-------|----------|
| **Hooks** | `useInvoicePayments`, `useInvoiceMutations.recordPayment`, `useInvoiceMutations.recalculateInvoiceBalance`, `useInvoiceMutations.voidInvoice` (deletes payments) |
| **Edge Functions** | `stripe-webhook` (W — INSERT payment on checkout completion) |
| **N8N Workflows** | — |
| **Triggers** | T3 `payment_updates_invoice` (fires on INSERT/UPDATE — recalculates invoice `amount_paid` and `status`, cascades to T2 revenue) |
| **UI Components** | `InvoiceDetailPanel` (payment list + record payment form) |

**High-risk columns:** `invoice_id` (FK — changing it recalculates NEW invoice but NOT old invoice's `amount_paid`), `amount` (summed by T3 into `invoices.amount_paid`).

**Critical gotcha:** T3 fires on INSERT only for new payments but also on UPDATE. Transferring a payment by changing `invoice_id` recalculates the NEW invoice but leaves the OLD invoice's `amount_paid` stale — must be manually reset.

---

### `teachers`

| Layer | Affected |
|-------|----------|
| **Hooks** | `useTeachers`, `useActiveTeachers`, `useTeacher`, `useTeacherMutations`, `useTeachersWithLoad`, `useTeacherWithLoad`, `useTeacherByToken`, `useTeacherStudents`, `useTeacherInvites`, `useCheckinInvites` (joins teacher), `usePayrollMutations.createPayrollRun` (reads default rate) |
| **Edge Functions** | — |
| **N8N Workflows** | `checkin-notify` (receives teacher name/email for invite/reminder emails), `checkin-training` (receives teacher name/email for training requests) |
| **Triggers** | T11 `desk_token_trigger` (BEFORE INSERT — auto-generates `desk_token` via `generate_desk_token()`) |
| **UI Components** | `Teachers`, `TeacherDetailPanel`, `AddTeacherModal`, `EditTeacherModal`, `AddEnrollmentModal`, `EditEnrollmentModal`, `AddAssignmentModal`, `EditAssignmentModal`, `EndEnrollmentModal`, `TransferTeacherModal`, `RecordTeacherPaymentModal`, `CheckinsTab`, `TeacherDesk` (public), `CheckinForm` (public), `AddManualLineItemModal`, `PayrollAdjustmentModal`, `CommandCenter` (direct — teacher count) |

**High-risk columns:** `desk_token` (T11 auto-generates; used in public Teacher Desk URLs — `/desk/:token`), `status` (filters active teachers for assignments, payroll, check-ins), `hourly_rate` (default fallback in payroll rate resolution hierarchy: assignment → service → teacher), `email` (used in check-in invite/reminder emails).

---

### `teacher_assignments`

| Layer | Affected |
|-------|----------|
| **Hooks** | `useTeacherAssignmentsByEnrollment`, `useTeacherAssignmentsByTeacher`, `useTeacherAssignmentMutations`, `useTeachersWithLoad`, `useTeacherWithLoad`, `useTeacherStudents`, `usePayrollMutations.createPayrollRun` (reads assignments for hours/rate) |
| **Edge Functions** | — |
| **N8N Workflows** | — |
| **Triggers** | — |
| **UI Components** | `EnrollmentDetailPanel`, `TeacherDetailPanel`, `AddAssignmentModal`, `EditAssignmentModal`, `TransferTeacherModal`, `RecordTeacherPaymentModal`, `AddEnrollmentModal`, `EditEnrollmentModal`, `EndEnrollmentModal`, `CheckinForm` (via `useTeacherStudents`) |

**High-risk columns:** `hours_per_week` (must stay synced with `enrollments.hours_per_week` — update both), `hourly_rate` (first in payroll rate resolution; overrides service/teacher defaults), `is_active` (filters for current load calculations, check-in student lists), `enrollment_id` (nullable — service-level assignments have NULL).

---

### `services`

| Layer | Affected |
|-------|----------|
| **Hooks** | `useServices`, `useActiveServices`, joined by: `useEnrollments`, `useEnrollmentsByFamily`, `useBillableEnrollments`, `useTeachersWithLoad`, `useTeacherStudents` |
| **Edge Functions** | `send-onboarding` (R — reads service onboarding config from `SERVICE_ONBOARDING_CONFIG`) |
| **N8N Workflows** | — |
| **Triggers** | T2 `revenue_records` (reads `services.code` for hardcoded location mapping — new codes must be added to CASE statement) |
| **UI Components** | `ActiveRoster`, `AddAssignmentModal`, `AddEnrollmentModal`, `Teachers`, `Reports` (direct — revenue by service) |

**High-risk columns:** `code` (hardcoded in T2's location CASE mapping — adding a new service code without updating T2 causes `location_id = NULL` in revenue records), `status` (filters active services for enrollment/assignment creation), `hourly_rate` (second in payroll rate resolution hierarchy).

---

### `payroll_run` / `payroll_line_item` / `payroll_adjustment` / `teacher_payments`

| Layer | Affected |
|-------|----------|
| **Hooks** | `usePayrollRuns`, `usePayrollRunWithItems`, `usePayrollLineItemsByTeacher`, `usePendingPayrollAdjustments`, `usePayrollMutations` (8 functions), `useTeacherPaymentsByTeacher`, `useTeacherPaymentMutations` (legacy) |
| **Edge Functions** | — |
| **N8N Workflows** | `payroll-notification` webhook (receives run summary from `PayrollRunDetail.tsx` — direct call, not via hook) |
| **Triggers** | — |
| **UI Components** | `Payroll`, `PayrollRunDetail`, `CreatePayrollRunModal`, `PayrollAdjustmentModal`, `AddManualLineItemModal`, `BulkAdjustHoursModal`, `TeacherDetailPanel` (payment history), `EditTeacherModal` (legacy payments), `RecordTeacherPaymentModal` (legacy), `Reports` (direct — queries BOTH `teacher_payments` and `payroll_run`/`payroll_line_item`) |

**High-risk note:** Two separate payroll systems — `teacher_payments` (legacy Sep–Dec 2025) and `payroll_run`/`payroll_line_item` (Jan 2026+). Reports queries both with no unified interface. Schema changes to either must account for the other. `PayrollRunDetail.tsx` directly calls an N8N webhook (`payroll-notification`) outside the hook layer.

---

### `checkin_periods` / `checkin_invites` / `checkin_responses` / `checkin_student_resources`

| Layer | Affected |
|-------|----------|
| **Hooks** | `useCheckinPeriods`, `useCheckinPeriod`, `useCheckinInvites`, `useCheckinResponse`, `useCheckinMutations` (7 functions), `useCheckinFormSubmit`, `useTeacherStudents`, `useTeacherByToken`, `useTeacherInvites` |
| **Edge Functions** | — |
| **N8N Workflows** | `checkin-notify` webhook (invite and reminder emails — receives teacher info + desk URLs), `checkin-training` webhook (training request notifications from form submission) |
| **Triggers** | — |
| **UI Components** | `CheckinsTab` (admin), `CreatePeriodModal`, `CheckinResponsePanel` (admin), `CheckinForm` (public — teacher portal), `TeacherDesk` (public — teacher portal) |

**High-risk columns:** `checkin_periods.status` (gates which periods teachers can submit for), `checkin_invites.status` (`pending`→`submitted` on form submit — drives progress counts), `checkin_periods.period_key` (display format `YYYY-MM`, used for sorting/filtering).

**Public surface:** `CheckinForm` and `TeacherDesk` are public pages (no auth) — schema changes affect the teacher-facing portal at `/desk/:token/checkin/:periodId`.

---

### `sms_messages` / `sms_media`

| Layer | Affected |
|-------|----------|
| **Hooks** | `useSmsMessages`, `useSmsByFamily`, `useSmsByInvoice`, `useSmsMutations`, `useSmsMedia` |
| **Edge Functions** | `send-sms` (W — creates message + media records), `twilio-status-webhook` (W — updates `status` with atomic WHERE clause), `twilio-opt-out-webhook` (W — inserts system log messages) |
| **N8N Workflows** | — |
| **Triggers** | — |
| **UI Components** | `SmsLog` (page), `QuickSend` (page), `InvoiceDetailPanel` (SMS tab), `SmsHistory` (component), `SmsComposeModal` |

**High-risk columns:** `status` (updated atomically by `twilio-status-webhook` with `.in('status', ['pending', 'sent'])` WHERE clause — prevents late callbacks from downgrading terminal statuses), `twilio_sid` (FK for status webhook matching), `family_id` / `invoice_id` (used for filtered views).

**Critical gotcha:** The `twilio-status-webhook` uses an atomic WHERE clause to prevent status regression. Renaming or retyping the `status` column breaks delivery tracking.

---

### `event_events` / `event_orders` / `event_attendees`

| Layer | Affected |
|-------|----------|
| **Hooks** | `useEvents`, `useAllAttendees`, `useEventOrderMutations`, `useHubBookingMutations`, `usePendingEventOrders`, `usePendingClassRegistrationFees`, `useEventLeads` |
| **Edge Functions** | `stripe-webhook` (W — updates `event_orders.payment_status` on checkout completion) |
| **N8N Workflows** | — |
| **Triggers** | T7/T8 `event_order_lead` (BEFORE INSERT/UPDATE on `event_orders` — creates lead families for event purchases), T9 `process_class_registration` (AFTER INSERT on `event_attendees` — creates students + enrollments for class registrations), T10 `process_class_registration` (AFTER UPDATE on `event_orders` when payment_status→paid — triggers T9 logic) |
| **UI Components** | `Events`, `EventDetailPanel` (direct — queries `event_attendees`, `event_orders`, `families`), `LinkEventOrdersModal`, `LinkHubBookingsModal`, `GenerateDraftsModal` (pending orders), `CommandCenter` (direct — `event_stepup_pending` view, event lead counts) |

**High-risk columns:** `event_orders.payment_status` (drives T7/T8 lead creation and T10 class registration — changing valid values breaks triggers), `event_events.event_type` (`'event'` vs `'class'` — triggers T7/T8 vs T9/T10 use this to decide which path to execute), `event_attendees.attendee_name` (fuzzy-matched by T9 at threshold 0.55 — spelling affects student dedup).

**Chain reaction:** `event_orders INSERT (paid, class)` → T9 creates students + enrollments → T4 converts matching leads → T6 syncs to Mailchimp.

---

### Cross-Entity Dependencies (tables that appear in multiple entity impacts)

| Table | Referenced By (as FK/join) |
|-------|--------------------------|
| `invoice_line_items` | `useInvoicesWithDetails`, `useInvoiceMutations`, T2 `revenue_records` (reads amounts + enrollment refs), `PublicInvoicePage` (direct), `Reports` (direct) |
| `revenue_records` | T2 creates records; `get_revenue_by_month` / `get_revenue_by_location` RPCs aggregate them; `Reports` displays charts |
| `enrollment_onboarding` | `useEnrollmentOnboarding`, `useOnboardingMutations`, `send-onboarding`, `check-onboarding-status`, `get-pending-onboarding`, `form-submitted` edge functions |
| `lead_activities` | `useLeadActivities`, `useLeadActivityMutations`, `useConversionAnalytics`, `ingest-lead` (W), `calendly-webhook` (W) |
| `lead_follow_ups` | `useLeadFollowUps`, `useUpcomingFollowUps`, `useFollowUpMutations` |
| `email_campaigns` / `lead_campaign_engagement` | `useEmailCampaigns`, `useCampaignEngagement`, `useLeadCampaignEngagement`, `mailchimp` edge function (R/W) |
| `calendly_bookings` | `calendly-webhook` (R/W), `CommandCenter` (direct — recent bookings) |
| `family_merge_log` | `useFamilyMergeLog`, `ingest-lead` (W), `calendly-webhook` (W) |
| `app_settings` / `locations` | `useSettings`, `useSettingMutations`, `useActiveLocations`, `Settings` (direct) |
| `invoice_number_counter` | T1 `invoice_number_trigger` (R/W — atomic counter increment) |
| `stripe_invoice_webhooks` | `stripe-webhook` (R/W — idempotency tracking) |
| `hub_sessions` | `usePendingHubSessions`, `useHubBookingMutations`, `CommandCenter` (direct) |

---

### Quick-Reference: "Which components bypass the hook layer?"

These components query Supabase directly. They are sensitive to column renames, type changes, and table restructuring even if you don't touch hooks:

| Component | Tables Queried Directly |
|-----------|------------------------|
| `CommandCenter.tsx` | `enrollments`, `families`, `teachers`, `invoices`, `hub_sessions`, `invoice_line_items`, `event_stepup_pending` (view), `calendly_bookings`, `event_leads` (view) |
| `Reports.tsx` | `services`, `invoices`, `enrollments`, `teacher_payments`, `payroll_run` + RPCs `get_revenue_by_month`, `get_revenue_by_location` |
| `PublicInvoicePage.tsx` | `invoices`, `families`, `invoice_line_items` |
| `EventDetailPanel.tsx` | `event_attendees`, `event_orders`, `families` |
| `Settings.tsx` | `app_settings`, `locations` |

---

## Needs Refactoring — Interface Unclear

| Module | Issue |
|--------|-------|
| `CommandCenter.tsx` | Dashboard stats hook (`useDashboardStats`) inlines 30+ metric calculations with direct Supabase queries rather than composing existing hooks. Interface boundary between "what metrics exist" and "how they're calculated" is not cleanly separated. |
| `Reports.tsx` | Similar to CommandCenter — builds custom queries inline rather than through the hook layer. Some overlap with `useDashboardStats`. |
| `PayrollRunDetail.tsx` | Directly calls N8N webhook (`payroll-notification`) instead of going through a hook or service module. Mixes UI rendering with external service calls. |
| `statusColors.ts` vs `StatusBadge.tsx` | Status color definitions split between a constants file and a component. Some components import colors directly, others use StatusBadge. No single canonical source. |
| Dual payroll systems | `teacher_payments` (legacy Sep-Dec 2025) and `payroll_run`/`payroll_line_item` (Jan 2026+). Reports must query both with no unified interface. See **Unified Payroll Interface Spec** below. |

---

### Unified Payroll Interface Spec (Blueprint)

> **Status:** Design only — not yet implemented. This spec defines what a single payroll interface should look like so the rest of the system can stop branching on "which payroll system?" The legacy data (Sep–Dec 2025) is frozen and will never grow, but it must remain queryable for historical reports.

#### Problem Statement

Two payroll systems exist in parallel:

| System | Tables | Period | Status | Created By |
|--------|--------|--------|--------|------------|
| **Legacy** | `teacher_payments` + `teacher_payment_line_items` + `teacher_hours` | Sep–Dec 2025 | Frozen (no new records) | `RecordTeacherPaymentModal` (manual per-teacher) |
| **Batch** | `payroll_run` + `payroll_line_item` + `payroll_adjustment` | Jan 2026+ | Active | `usePayrollMutations.createPayrollRun` (batch generation from assignments) |

Every consumer that needs "teacher payment history" must query both systems and merge the results. Today, that merge logic is duplicated in three places with three different implementations:

| Consumer | What It Does | How It Merges |
|----------|-------------|---------------|
| `Reports.tsx` (payroll chart) | Queries `teacher_payments.pay_date + total_amount` and `payroll_run.paid_at + total_adjusted`, groups by month, sums amounts | Two separate queries → merge into `monthlyData` map by month key |
| `TeacherDetailPanel.tsx` (`PayrollTab`) | Shows per-teacher payment history from both systems as a unified sorted list | Queries `useTeacherPaymentsByTeacher` + `usePayrollLineItemsByTeacher` → maps to `UnifiedPayment[]` (manual vs. bulk), groups batch items by `payroll_run_id` |
| `EditTeacherModal.tsx` | Checks if teacher has any legacy payments (blocks delete if so) | Queries `useTeacherPaymentsByTeacher` only |

#### Schema Comparison

**Legacy `teacher_payments`:**
```
teacher_payments
├── id, teacher_id, pay_period_start, pay_period_end, pay_date
├── total_amount, payment_method, reference, notes, created_at
└── teacher_payment_line_items[]
    ├── id, teacher_payment_id, description
    ├── hours, hourly_rate, amount
    └── service_id?, enrollment_id?
```

**Batch `payroll_run` + `payroll_line_item`:**
```
payroll_run
├── id, period_start, period_end, status (draft→review→approved→paid)
├── total_calculated, total_adjusted, total_hours, teacher_count
├── approved_by, approved_at, paid_at, notes, created_at, updated_at
└── payroll_line_item[]
    ├── id, payroll_run_id, teacher_id, teacher_assignment_id?
    ├── enrollment_id?, service_id?, description
    ├── calculated_hours, actual_hours, hourly_rate, rate_source
    ├── calculated_amount, adjustment_amount, final_amount
    └── adjustment_note?

payroll_adjustment
├── id, teacher_id, amount, reason
├── source_payroll_run_id?, target_payroll_run_id?
└── created_by, created_at
```

**Key differences:**
- Legacy has no approval workflow (manual entry = immediately final)
- Legacy has no `rate_source` tracking or calculated vs. actual hours distinction
- Legacy `total_amount` is on the parent; batch sums `final_amount` across line items
- Legacy `pay_date` ≈ batch `paid_at` (but legacy is DATE, batch is TIMESTAMPTZ)
- Legacy has no adjustments system

#### Target: Unified Payroll Interface

**1. Unified Query Hook — `useTeacherPayrollHistory(teacherId, options?)`**

```typescript
// Replaces: useTeacherPaymentsByTeacher + usePayrollLineItemsByTeacher + PayrollTab merge logic
interface UnifiedPayrollRecord {
  id: string                          // original record ID (prefixed: 'legacy-{id}' or 'batch-{runId}')
  source: 'legacy' | 'batch'         // which system it came from
  teacher_id: string
  period_start: string                // YYYY-MM-DD
  period_end: string                  // YYYY-MM-DD
  paid_date: string                   // YYYY-MM-DD (normalized from pay_date or paid_at)
  total_amount: number                // legacy: total_amount, batch: sum of final_amount for this teacher
  total_hours: number | null          // legacy: sum of line_items.hours, batch: sum of actual_hours
  payment_method: string              // legacy: payment_method, batch: 'Bulk Payroll'
  status: 'paid'                      // legacy is always paid; batch filtered to status='paid'
  line_items: UnifiedPayrollLineItem[]
}

interface UnifiedPayrollLineItem {
  description: string
  hours: number | null
  hourly_rate: number | null
  amount: number                      // legacy: amount, batch: final_amount
  service_name: string | null
  student_name: string | null
}

// Input
interface TeacherPayrollHistoryOptions {
  enabled?: boolean
  dateFrom?: string                   // filter by paid_date >= dateFrom
  dateTo?: string                     // filter by paid_date <= dateTo
}

// Output
useTeacherPayrollHistory(teacherId: string, options?: TeacherPayrollHistoryOptions)
  → UseQueryResult<UnifiedPayrollRecord[]>

// Query key: queryKeys.payroll.teacherHistory(teacherId)
// Invalidated by: usePayrollMutations.* AND useTeacherPaymentMutations.*
```

**2. Unified Aggregate Hook — `usePayrollByMonth(startDate)`**

```typescript
// Replaces: Reports.tsx inline dual-query + month grouping logic
interface PayrollMonthSummary {
  month: string                       // 'YYYY-MM'
  total_amount: number                // sum from both systems
  payment_count: number               // count of runs/payments
  sources: {
    legacy: number                    // amount from teacher_payments
    batch: number                     // amount from payroll_run
  }
}

usePayrollByMonth(startDate: string)
  → UseQueryResult<PayrollMonthSummary[]>

// Query key: queryKeys.reports.payroll(startDate)
// Stale time: 5 minutes (report data, not frequently changing)
```

**3. Teacher Earnings Check — `useTeacherHasPayments(teacherId)`**

```typescript
// Replaces: EditTeacherModal.tsx check against legacy payments only
// Should check BOTH systems before allowing teacher deletion
useTeacherHasPayments(teacherId: string)
  → UseQueryResult<boolean>

// Query key: queryKeys.payroll.teacherHasPayments(teacherId)
```

**4. Unified Payroll Total for Dashboard**

```typescript
// For CommandCenter or any dashboard metric that needs "total payroll this month"
// Currently not implemented — would replace ad-hoc calculations
usePayrollTotal(periodStart: string, periodEnd: string)
  → UseQueryResult<{ total: number; teacherCount: number }>
```

#### Contracts

| Contract | Rule |
|----------|------|
| **No new writes to legacy tables** | `teacher_payments` and `teacher_payment_line_items` are frozen. `useTeacherPaymentMutations` should eventually be removed or gated to prevent accidental use. `RecordTeacherPaymentModal` should be retired. |
| **All reads go through unified hooks** | No component should import `useTeacherPaymentsByTeacher` or `usePayrollLineItemsByTeacher` directly. They should use `useTeacherPayrollHistory` instead. |
| **Date normalization** | Legacy `pay_date` (DATE) and batch `paid_at` (TIMESTAMPTZ) must be normalized to `YYYY-MM-DD` using `formatDateLocal()` (never `toISOString()`). |
| **Amount normalization** | Legacy `total_amount` is stored directly. Batch amounts must be summed from `payroll_line_item.final_amount` per teacher per run. Use `addMoney()` from `moneyUtils.ts`. |
| **Source tagging** | Every unified record carries a `source` field so consumers can distinguish provenance if needed (e.g., showing a "Legacy" badge). |
| **Query key unification** | Both systems invalidate the same query keys. `usePayrollMutations.*` and `useTeacherPaymentMutations.*` must both invalidate `queryKeys.payroll.teacherHistory(teacherId)` and `queryKeys.reports.payroll(startDate)`. |

#### Affected Code (What Changes During Migration)

| File | Current State | Target State |
|------|--------------|--------------|
| `hooks.ts` — `useTeacherPaymentsByTeacher` | Queries `teacher_payments` + `teacher_payment_line_items` | **Keep** as internal helper, unexport. Called only by unified hook. |
| `hooks.ts` — `usePayrollLineItemsByTeacher` | Queries `payroll_line_item` joined with `payroll_run` | **Keep** as internal helper, unexport. Called only by unified hook. |
| `hooks.ts` — `useTeacherPaymentMutations` | Creates records in `teacher_payments` | **Remove** or gate with deprecation warning. No new legacy records. |
| `hooks.ts` — NEW `useTeacherPayrollHistory` | Does not exist | **Create.** Calls both internal helpers, normalizes to `UnifiedPayrollRecord[]`. |
| `hooks.ts` — NEW `usePayrollByMonth` | Does not exist | **Create.** Replaces Reports.tsx inline query. |
| `TeacherDetailPanel.tsx` — `PayrollTab` | Imports both hooks, defines local `UnifiedPayment` type, merge logic in `useMemo` | **Simplify.** Import `useTeacherPayrollHistory`, remove merge logic. |
| `Reports.tsx` — payroll chart query | Inline dual-query to `teacher_payments` + `payroll_run`, manual month grouping | **Replace** with `usePayrollByMonth(startDate)`. |
| `EditTeacherModal.tsx` | Imports `useTeacherPaymentsByTeacher` to check for legacy payments | **Replace** with `useTeacherHasPayments(teacherId)` (checks both systems). |
| `RecordTeacherPaymentModal.tsx` | Creates legacy `teacher_payments` records | **Remove** component. Manual recording is replaced by batch payroll. If one-off payments are needed, use `usePayrollMutations.createLineItem` with an ad-hoc run. |
| `Payroll.tsx` | Only uses batch system hooks | **No change** needed — already clean. |

#### Migration Steps (Recommended Order)

1. **Create unified hooks** (`useTeacherPayrollHistory`, `usePayrollByMonth`, `useTeacherHasPayments`) in `hooks.ts`. These are additive — nothing breaks.

2. **Update `TeacherDetailPanel.tsx`** to use `useTeacherPayrollHistory`. Delete the local `UnifiedPayment` type and the `PayrollTab` merge logic.

3. **Update `Reports.tsx`** to use `usePayrollByMonth`. Delete the inline dual-query and month-grouping logic.

4. **Update `EditTeacherModal.tsx`** to use `useTeacherHasPayments`. This now correctly blocks deletion if a teacher has records in EITHER system.

5. **Deprecate `RecordTeacherPaymentModal`** — remove from `TeacherDetailPanel.tsx` (which is the only place it's rendered). The "Record Manual Payment" button disappears.

6. **Unexport legacy hooks** — make `useTeacherPaymentsByTeacher` and `useTeacherPaymentMutations` internal to `hooks.ts` (or remove exports). If any consumer still references them, update to use unified hooks.

7. **Update query key invalidation** — ensure `usePayrollMutations.*` invalidates `queryKeys.payroll.teacherHistory(*)` and `queryKeys.reports.payroll(*)`.

8. **Run `npm run build` + `npm run lint`** — verify no remaining references to removed exports.

#### DB-Level Option (Future, Optional)

Instead of merging at the hook level, a Postgres VIEW could unify both systems:

```sql
CREATE VIEW teacher_payroll_unified AS
  -- Legacy records
  SELECT
    'legacy-' || tp.id AS id,
    'legacy' AS source,
    tp.teacher_id,
    tp.pay_period_start AS period_start,
    tp.pay_period_end AS period_end,
    tp.pay_date AS paid_date,
    tp.total_amount,
    tp.payment_method,
    'paid' AS status
  FROM teacher_payments tp
  UNION ALL
  -- Batch records (one row per teacher per run)
  SELECT
    'batch-' || pr.id || '-' || pli.teacher_id AS id,
    'batch' AS source,
    pli.teacher_id,
    pr.period_start,
    pr.period_end,
    pr.paid_at::date AS paid_date,
    SUM(pli.final_amount) AS total_amount,
    'Bulk Payroll' AS payment_method,
    pr.status
  FROM payroll_run pr
  JOIN payroll_line_item pli ON pli.payroll_run_id = pr.id
  WHERE pr.status = 'paid'
  GROUP BY pr.id, pli.teacher_id, pr.period_start, pr.period_end, pr.paid_at, pr.status;
```

This moves the merge to the database, but adds a dependency on a VIEW that must be maintained. The hook-level approach (step 1) is safer and more reversible — start there.
