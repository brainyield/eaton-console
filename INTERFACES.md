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
                    │  Triggers: invoice_number, revenue_on_pay,  │
                    │  auto_convert_lead, mailchimp_sync,          │
                    │  desk_token, onboarding_updated_at           │
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

**Hook Domains:**

| Domain | Query Hooks | Mutation Hooks | Tables |
|--------|------------|----------------|--------|
| Families | `useFamilies`, `useFamily`, `usePaginatedFamilies`, `useFamiliesWithStudents` | `useFamilyMutations` (create, update, bulk update) | `families` |
| Students | `useStudentsByFamily` | `useStudentMutations` (create, update, delete) | `students` |
| Teachers | `useTeachers`, `useActiveTeachers`, `useTeacher`, `useTeachersWithLoad`, `useTeacherByToken` | `useTeacherMutations` (create, update, delete) | `teachers`, `teacher_assignments` |
| Enrollments | `useEnrollments`, `useEnrollmentsByFamily`, `useEnrollment`, `useBillableEnrollments` | `useEnrollmentMutations` (create, update, delete, end) | `enrollments` |
| Teacher Assignments | `useTeacherAssignments`, `useTeacherAssignmentsByEnrollment`, `useTeacherAssignmentsByTeacher` | `useTeacherAssignmentMutations` (create, update, delete) | `teacher_assignments` |
| Invoices | `useInvoices`, `useInvoicesByFamily`, `useInvoicesWithDetails`, `useExistingInvoicesForPeriod` | `useInvoiceMutations` (create, update, void, send, remind, record payment) | `invoices`, `invoice_line_items`, `payments` |
| Invoice Emails | `useInvoiceEmails`, `useInvoiceEmailsByFamily` | — | `invoice_emails` |
| Invoice Payments | `useInvoicePayments` | — | `payments` |
| Payroll | `usePayrollRuns`, `usePayrollRunWithItems`, `usePayrollLineItemsByTeacher`, `usePendingPayrollAdjustments` | `usePayrollMutations` (create run, add/remove items, finalize, process) | `payroll_runs`, `payroll_line_items`, `payroll_adjustments` |
| Legacy Payments | `useTeacherPaymentsByTeacher` | `useTeacherPaymentMutations` | `teacher_payments` |
| Leads | `useLeads`, `useLead`, `useEventLeads`, `useConvertedLeadsCount`, `useCheckMatchingLeads` | `useLeadMutations` (create, update, convert, delete) | `families` (status='lead') |
| Lead Activities | `useLeadActivities` | `useLeadActivityMutations` (log call/email/text) | `lead_activities` |
| Lead Follow-ups | `useLeadFollowUps`, `useUpcomingFollowUps` | `useFollowUpMutations` (create, complete, reschedule) | `lead_follow_ups` |
| Events | `useEvents`, `useAllAttendees`, `usePendingHubSessions` | `useEventOrderMutations`, `useHubBookingMutations` | `events`, `event_attendees`, `event_orders`, `hub_sessions` |
| Check-ins | `useCheckinPeriods`, `useCheckinPeriod`, `useCheckinInvites`, `useCheckinResponse`, `useTeacherStudents` | `useCheckinMutations` (create invites, submit responses) | `checkin_periods`, `checkin_invites`, `checkin_responses` |
| SMS | `useSmsMessages`, `useSmsByFamily`, `useSmsByInvoice` | `useSmsMutations` (send, update status, mark opt-out) | `sms_messages`, `sms_media` |
| Gmail | `useGmailSearch`, `useGmailThread` | `useGmailSend` | — (N8N webhooks) |
| Email Campaigns | `useEmailCampaigns`, `useCampaignEngagement`, `useLeadCampaignEngagement`, `useConversionAnalytics` | — | `email_campaigns`, `lead_campaign_engagement` |
| Onboarding | `useEnrollmentOnboarding` | `useOnboardingMutations` | `enrollment_onboarding` |
| Settings | `useSettings` | `useSettingMutations` | `app_settings` |
| Admin | `usePotentialDuplicates`, `useFamilyMergeLog`, `useRecentlyViewed` | — | `families`, `family_merge_log` |

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
| `CreatePayrollRunModal` | Payroll | Create | `payroll_runs`, `payroll_line_items` | Pulls hours from assignments |
| `PayrollAdjustmentModal` | Payroll | Create | `payroll_adjustments` | Pending → approved/rejected |
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

| Trigger | Table | Event | Function | Effect |
|---------|-------|-------|----------|--------|
| `invoice_number_trigger` | `invoices` | BEFORE INSERT | `set_invoice_number()` | Auto-generates `INV-YYYY-NNNN` format if `invoice_number` is NULL. Uses `invoice_number_counter` sequence table. |
| `trigger_create_revenue_on_payment` | `invoices` | AFTER UPDATE | `create_revenue_records_on_payment()` | When status changes to `paid` (invoices dated >= 2026-01-01): creates `revenue_records` for each line item with `location_id` derived from service code CASE mapping. Idempotent via `ON CONFLICT DO NOTHING` on `source_line_item_id`. |
| `enrollment_auto_convert_lead` | `enrollments` | AFTER INSERT | `auto_convert_leads_on_enrollment()` | When active/trial enrollment created: finds matching lead families by email (both primary + secondary), updates `status='active'`, `lead_status='converted'`, `converted_at=NOW()`. |
| `enrollment_status_change_auto_convert_lead` | `enrollments` | AFTER UPDATE (status) | `auto_convert_leads_on_enrollment()` | Same as above, fires when enrollment status changes TO active/trial. |
| `trigger_sync_family_status_to_mailchimp` | `families` | AFTER UPDATE (status) | `sync_family_status_to_mailchimp()` | Async fire-and-forget HTTP POST via `pg_net` to `/functions/v1/mailchimp`. Swaps status tags. Only fires when `primary_email IS NOT NULL` and status IN (active, trial, churned, paused). |
| `teacher_desk_token_trigger` | `teachers` | BEFORE INSERT | `generate_desk_token()` | Auto-generates URL-safe random 16-char token for `/desk/:token` route. |
| `enrollment_onboarding_updated_at` | `enrollment_onboarding` | BEFORE UPDATE | `update_enrollment_onboarding_updated_at()` | Updates `updated_at` timestamp on every change. |

**Important trigger gotchas:**
- `trigger_create_revenue_on_payment` fires on UPDATE only, not INSERT. Transferring payments requires manual invoice reset.
- `trigger_sync_family_status_to_mailchimp` uses `pg_net` (async HTTP), so failures are silent.
- Location mapping in revenue trigger requires manual update when adding new service codes.

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

## Needs Refactoring — Interface Unclear

| Module | Issue |
|--------|-------|
| `CommandCenter.tsx` | Dashboard stats hook (`useDashboardStats`) inlines 30+ metric calculations with direct Supabase queries rather than composing existing hooks. Interface boundary between "what metrics exist" and "how they're calculated" is not cleanly separated. |
| `Reports.tsx` | Similar to CommandCenter — builds custom queries inline rather than through the hook layer. Some overlap with `useDashboardStats`. |
| `PayrollRunDetail.tsx` | Directly calls N8N webhook (`payroll-notification`) instead of going through a hook or service module. Mixes UI rendering with external service calls. |
| `statusColors.ts` vs `StatusBadge.tsx` | Status color definitions split between a constants file and a component. Some components import colors directly, others use StatusBadge. No single canonical source. |
| Dual payroll systems | `teacher_payments` (legacy Sep-Dec 2025) and `payroll_runs`/`payroll_line_items` (Jan 2026+). Reports must query both with no unified interface. |
