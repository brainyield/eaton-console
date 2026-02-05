# Eaton Console - Project Instructions

## Build Commands

```bash
npm run dev        # Start Vite dev server
npm run build      # TypeScript check + Vite build
npm run lint       # ESLint check
npm run db:types   # Regenerate Supabase types from database
```

## Verification Requirements

After making ANY code changes, ALWAYS run:

1. `npm run build` - Must pass with no TypeScript errors
2. `npm run lint` - Must pass with no ESLint errors
3. **Check if CLAUDE.md needs updating** - If you discovered a non-obvious gotcha, bug pattern, or lesson learned during this task, add it to "Common Mistakes to Avoid"

If build/lint fails, fix the issues before considering the task complete.

---

## Project Structure

```
src/
├── App.tsx              # Main router (React Router)
├── main.tsx             # Entry point with providers
├── index.css            # Tailwind + dark theme CSS
├── types/
│   ├── supabase.ts      # Auto-generated (npm run db:types) - DO NOT EDIT
│   ├── database.ts      # Custom TypeScript interfaces
│   └── gmail.ts         # Gmail API types
├── lib/                 # Shared utilities & hooks
│   ├── supabase.ts      # Supabase client
│   ├── hooks.ts         # All React Query hooks + type definitions
│   ├── queryClient.ts   # React Query config + query key factory
│   ├── dateUtils.ts     # Timezone-safe date utilities
│   ├── enrollmentPeriod.ts # Semester/school year period logic
│   ├── gmail.ts         # Gmail API integration (via n8n webhooks)
│   ├── invoicePdf.ts    # Invoice PDF generation (jsPDF)
│   ├── mailchimp.ts     # Mailchimp integration (via Edge Function)
│   ├── moneyUtils.ts    # Floating-point safe money operations
│   ├── phoneUtils.ts    # Phone normalization, validation, formatting
│   ├── smsTemplates.ts  # SMS templates with merge fields, segment calculation
│   ├── toast.tsx        # Toast context provider
│   ├── utils.ts         # Name formatting, age calculation
│   └── validation.ts    # Input validation
├── pages/               # Standalone pages (SmsLog, QuickSend)
├── components/
│   ├── Layout.tsx       # Main layout wrapper
│   ├── Sidebar.tsx      # Navigation
│   ├── CommandPalette.tsx
│   ├── *DetailPanel.tsx # Right-side read-only panels (6 total)
│   ├── *Modal.tsx       # CRUD modal dialogs (26 total)
│   ├── *.tsx            # Page-like components (Directory, Events, etc.)
│   ├── email/           # Email compose & history components
│   ├── sms/             # SMS compose & history components
│   └── ui/              # Reusable UI components
│       ├── AccessibleModal.tsx
│       ├── AccessibleSlidePanel.tsx
│       ├── FamilyItemGroup.tsx
│       ├── SmsStatusBadge.tsx
│       └── SortableTableHeader.tsx
```

> **Note:** Most route components (Directory, Events, Invoicing, etc.) live in `components/`, not `pages/`. The `pages/` directory is reserved for components that don't fit the standard layout pattern.

---

## Admin Access Control

Admin routes are protected by a client-side password gate (`AdminGate.tsx`). This prevents accidental access but is not cryptographically secure.

**Protected routes:** `/`, `/directory`, `/roster`, `/events`, `/marketing`, `/sms-log`, `/quick-send`, `/invoicing`, `/payroll`, `/teachers`, `/reports`, `/settings`

**Public routes (no password):** `/desk/:token`, `/desk/:token/checkin/:periodId`, `/invoice/:publicId`

**Configuration:**
- Set `VITE_ADMIN_PASSWORD` in `.env.local` (local) and Vercel env vars (production)
- Auth persists in localStorage for 30 days
- To logout: `localStorage.removeItem('eaton_admin_auth')`

---

## Critical Patterns

### Dates - ALWAYS Use Timezone-Safe Utilities

```typescript
// WRONG - causes timezone bugs
const dateStr = date.toISOString().split('T')[0]

// CORRECT - use dateUtils.ts
import { formatDateLocal, parseLocalDate, getTodayString } from '@/lib/dateUtils'
const dateStr = formatDateLocal(date)
const today = getTodayString()
```

### Money - ALWAYS Use Safe Math Operations

```typescript
// WRONG - floating point errors
const total = rate * hours

// CORRECT - use moneyUtils.ts
import { multiplyMoney, addMoney, formatCurrency } from '@/lib/moneyUtils'
const total = multiplyMoney(rate, hours)
```

### React Query Hooks

All data fetching hooks are in `src/lib/hooks.ts`. Use the existing patterns:

```typescript
// Fetching
const { data: families } = useFamilies({ status: 'active' })

// Mutations
const { createFamily, updateFamily } = useFamilyMutations()
```

Query keys use the factory pattern in `queryClient.ts`:
```typescript
queryKeys.families.list(filters)
queryKeys.families.detail(id)
```

### Supabase Types

- `src/types/supabase.ts` is auto-generated - never edit manually
- Regenerate with: `npm run db:types`
- Custom types go in `src/types/database.ts` or `src/lib/hooks.ts`

### Leads - Stored as Families

Leads are stored in the `families` table with `status='lead'`, NOT in a separate `leads` table (which is deprecated). Key patterns:

```typescript
// Querying leads
const { data: leads } = useLeads() // Returns families with status='lead'

// Creating a new lead (in hooks or edge functions)
await supabase.from('families').insert({
  status: 'lead',
  lead_status: 'new',           // Pipeline stage: new, contacted, converted, closed
  lead_type: 'exit_intent',     // Source: exit_intent, waitlist, calendly_call, event
  primary_email: email,
  display_name: formatFamilyName(name, email),
  // ... other lead fields
})

// Converting a lead to customer - just update status
await supabase.from('families')
  .update({ status: 'active', lead_status: 'converted', converted_at: new Date().toISOString() })
  .eq('id', familyId)
```

Lead-related tables (`lead_activities`, `lead_follow_ups`, `lead_campaign_engagement`) use `family_id` as the primary reference.

---

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Components | PascalCase | `FamilyDetailPanel.tsx` |
| Hooks | use* prefix | `useFamilies()` |
| Utilities | camelCase | `formatDateLocal()` |
| Types/Interfaces | PascalCase | `Family`, `Invoice` |
| Modal files | *Modal.tsx | `AddEnrollmentModal.tsx` |
| Detail panels | *DetailPanel.tsx | `InvoiceDetailPanel.tsx` |

---

## Common Mistakes to Avoid

- **DON'T** use `toISOString().split('T')[0]` for dates - causes timezone bugs. Use `formatDateLocal()`.
- **DON'T** do direct multiplication/division with money - floating point errors. Use `multiplyMoney()`, `addMoney()`, etc.
- **DON'T** edit `src/types/supabase.ts` - it's auto-generated. Run `npm run db:types` to update.
- **DON'T** create new hook files - add hooks to `src/lib/hooks.ts` following existing patterns.
- **DON'T** use `console.log` in committed code - remove before committing.
- **DON'T** forget `verify_jwt = false` for external webhooks - Supabase Edge Functions require JWT auth by default. External services (Stripe, Calendly, etc.) don't send Authorization headers. Add the config to `supabase/config.toml` with `[functions.function-name]` section (more reliable than per-function config.toml).
- **DON'T** trust external webhook payload structures - APIs like Calendly may have payload variations not matching docs. Always use defensive null checks (optional chaining, fallback values) and log raw payloads for debugging.
- **DON'T** look for Calendly phone numbers on the invitee object - for outbound call events, the phone is in `scheduled_event.location.location` when `location.type === 'outbound_call'`. The `calendly-webhook` extracts phone with priority: location > text_reminder_number > form answers.
- **DON'T** compare names with simple string equality - "Celine Orellana" and "Orellana, Celine" are the same person. Use `formatNameLastFirst()` from `utils.ts` to normalize names before comparison.
- **DON'T** store family/student names in "First Last" or "XYZ Family" format - always use `formatNameLastFirst()` which handles: "John Smith" → "Smith, John", "Smith Family" → "Smith", "John Smith Jr." → "Smith, John Jr.". The function also handles already-formatted names (with comma) by returning them unchanged.
- **DON'T** hardcode age group values - use `AGE_GROUP_OPTIONS` from `utils.ts` for dropdowns, `getAgeGroup(dob)` to calculate from DOB, and `getAgeGroupSortValue()` for sorting. Age groups must match the format expected by ActiveRoster sorting ('3-5', '6-8', '9-11', '12-14', '15-17').
- **DON'T** create custom modal wrappers with plain divs - use `AccessibleModal` from `components/ui/AccessibleModal.tsx` for proper focus trap, keyboard handling (Escape to close), and aria attributes.
- **DON'T** use `Partial<T>` for mutation inputs - use the insert types (`FamilyInsert`, `StudentInsert`, `EnrollmentInsert`, `TeacherInsert`) which specify required fields and make optional fields partial. This avoids `as any` casts and provides proper type checking.
- **DON'T** create families with `status: 'lead'` for paying customers - families with 'lead' status are excluded from Directory search and cannot be invoiced. Event purchases (Step Up, Stripe) should always create families with `status: 'active'`.
- **DON'T** use `.eq()` for email lookups - emails may have case variations. Use `.ilike()` for case-insensitive matching: `.ilike('primary_email', email.toLowerCase())`.
- **DON'T** create leads without checking for duplicates - always check for existing families with the same email before creating. If a family exists with `status='lead'` and `lead_status` in ('new', 'contacted'), log as activity instead of creating. If family has active enrollments, skip lead creation. See `ingest-lead` and `calendly-webhook` edge functions for the pattern.
- **DON'T** rely on email-only matching for family lookups - people use different emails (typos like `gmial` vs `gmail`, work vs personal). Edge functions now check both `primary_email` and `secondary_email`, and fall back to name-based matching if email fails. For new integrations, use `find_or_create_family_for_purchase()` stored procedure which handles email+name matching and logs matches to `family_merge_log`. Use `usePotentialDuplicates()` hook to review edge cases.
- **DON'T** assume all data creation happens in application code - Supabase database triggers (like `process_class_registration`) can create students and enrollments automatically when event_attendees or event_orders are inserted/updated. Check Supabase Dashboard → Database → Triggers when debugging unexpected data creation. Trigger functions are in `supabase/migrations/` but may have been created directly in Dashboard.
- **DON'T** use BEFORE INSERT triggers that reference the new row via foreign key - the row doesn't exist yet, causing FK violations. Use AFTER INSERT triggers when you need to insert related records that have a foreign key back to the triggering table.
- **DON'T** forget that `enrollments` and `teacher_assignments` have separate `hours_per_week` fields - when editing enrollment hours in a modal, you must update BOTH records. The `EditEnrollmentModal` handles this, but any new edit flows must sync both tables. Active Roster and Teachers views display `teacher_assignments.hours_per_week`, while invoicing uses `enrollments.hours_per_week`.
- **DON'T** assume `revenue_records` links to enrollments - the table tracks revenue by `family_id`, `student_id`, `service_id` separately with no `enrollment_id` FK. For location-based revenue reporting, `location_id` was added directly to `revenue_records`.
- **DON'T** use only `contentStyle` for Recharts tooltips in dark mode - the inner text will be invisible. Must also add `itemStyle={{ color: '#e5e7eb' }}` and `labelStyle={{ color: '#9ca3af' }}` for visible text.
- **DON'T** use non-null assertions (`!`) for env vars in Edge Functions - if the env var is missing, the function will crash with an unclear error. Always validate and return early with a clear error: `if (!supabaseUrl) { return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500 }) }`.
- **DON'T** use `.single()` when a query might return 0 or multiple rows - it throws on both cases. Use `.maybeSingle()` for queries that may or may not find a match (returns `null` if not found, first result if multiple). Only use `.single()` when you're certain exactly one row exists.
- **DON'T** silently swallow errors in secondary operations - mutations with secondary steps (e.g., syncing event_orders after invoice payment, sending webhook emails) should return `{ data, warnings: string[] }`. Callers can then show warnings to users about partial failures. See `updateInvoice`, `recordPayment`, `createPayrollRun`, and check-in mutations for examples of this pattern.
- **DON'T** forget to invalidate `stats.dashboard()` in mutations that affect Command Center metrics - the dashboard has a 60-second `staleTime`, so without explicit invalidation, metrics won't update immediately. Any mutation affecting invoices (outstanding balance), enrollments (student counts), or families should include `queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() })` in its `onSuccess` handler.
- **DON'T** pass empty strings to Supabase for nullable fields - PostgreSQL cannot convert `''` to date/timestamp types. Always use `value || null` pattern when saving form data: `due_date: dueDate || null`. This applies to all nullable date, timestamp, and optional string fields.
- **DON'T** enable RLS on new tables - this internal admin app doesn't use Row Level Security. Other tables like `families`, `enrollments` have RLS disabled. If you create a new table, leave RLS disabled to match the existing pattern.
- **DON'T** use Google Forms published ID format (`/forms/d/e/{id}/viewform`) - use the edit ID format (`/forms/d/{id}/viewform`). The form IDs in our config are edit IDs from the form's edit URL, not the longer published IDs from the "Send" dialog.
- **DON'T** try to query Supabase directly from N8N workflows - N8N's free/starter plans don't support environment variables for credentials. Instead, create a helper edge function (like `get-pending-onboarding`) that N8N can call via HTTP. The edge function has automatic access to Supabase credentials and returns the data N8N needs.
- **DON'T** leave database triggers that reference deprecated tables/columns - triggers can silently fail while the main operation succeeds. After schema changes that remove tables/columns, audit triggers in Supabase Dashboard → Database → Triggers and drop any that reference removed objects. Example: `trigger_update_lead_score_on_activity` referenced the deprecated `leads` table, causing webhooks to partially succeed (family created, but lead_activities insert failed silently).
- **DON'T** use `window.location.origin` for URLs sent in emails - when sending from localhost, emails will contain localhost URLs that recipients can't access. Use `import.meta.env.VITE_APP_URL || window.location.origin` and set `VITE_APP_URL` in production (Vercel env vars). The fallback allows local testing while ensuring production emails have correct URLs.
- **DON'T** fetch large datasets directly from Supabase without considering the 1000 row default limit - Supabase REST API returns max 1000 rows by default, and `.limit(N)` won't help if N > server max. For tables that may exceed 1000 rows (like `revenue_records`), use database functions with `.rpc()` to aggregate data server-side. See `get_revenue_by_month` and `get_revenue_by_location` functions used in Reports.tsx.
- **DON'T** query new tables before applying migrations - if you create new tables like `sms_messages`, the Supabase types won't include them until you apply the migration and run `npm run db:types`. Use `(supabase.from as any)('table_name')` with explicit type casts as a workaround, with a comment noting types need regeneration.
- **DON'T** use ASCII ranges for GSM character detection in SMS - the GSM 03.38 character set is NOT the same as ASCII. Use the explicit character sets in `smsTemplates.ts` which include Greek letters (Δ, Φ, Γ, etc.) and handle extended characters (€, [, ], etc.) that count as 2 characters each.
- **DON'T** store phone numbers in inconsistent formats - use `normalizePhone()` from `phoneUtils.ts` to convert to E.164 format (+1XXXXXXXXXX) for storage, and `formatPhoneDisplay()` for user-facing display as (XXX) XXX-XXXX.
- **DON'T** use `new Date(dateStr)` for YYYY-MM-DD date strings - this parses as UTC midnight, causing timezone bugs. Use `parseLocalDate(dateStr)` from `dateUtils.ts` which correctly parses as local midnight. This applies to validation functions too - `isValidDateString()` and `isValidDateRange()` in `validation.ts` should use `parseLocalDate()`.
- **DON'T** make fetch calls to external APIs without try-catch and timeout - network errors, service outages, and hung connections will crash the app or leave users waiting forever. Always wrap in try-catch, use AbortController for timeout, validate response JSON, and check for error fields in the response body.
- **DON'T** let PDF generation or file downloads fail silently - `generateInvoicePdf()` and similar functions should be wrapped in try-catch and return `{ success: boolean, error?: string }` so the UI can show appropriate feedback. Users clicking download buttons need to know if it worked.
- **DON'T** create local Toast components when `useToast()` hook is available - the app has a global `ToastProvider` in `src/lib/toast.tsx`. Use `const { showSuccess, showError } = useToast()` instead of defining local toast state. See Settings.tsx which needs this fix.
- **DON'T** duplicate STATUS_COLORS or status badge styling across files - these identical color mappings exist in 8+ files. Use shared constants from a central location or create a `<StatusBadge variant="enrollment|lead|invoice" />` component.
- **DON'T** duplicate utility functions that already exist - don't define local `formatDate()` or `formatCurrency()` functions when `formatDateLocal()` and `formatCurrency()` already exist in `dateUtils.ts` and `moneyUtils.ts`. Import and use the canonical versions to ensure consistent behavior.
- **DON'T** hardcode external service URLs - use environment variables like `import.meta.env.VITE_N8N_BASE_URL` with a fallback for development. This allows different environments (staging, production) without code changes.
- **DON'T** assume column names in Edge Functions match your mental model - the `families` table has `scheduled_at` (not `calendly_scheduled_at`). Edge Functions don't get TypeScript compile errors for wrong column names; Supabase inserts silently fail. Always verify column names against the schema before writing insert/update queries, and check `family_id` is not null after booking creation to catch silent failures.
- **DON'T** forget there are TWO payroll systems - `teacher_payments` (legacy manual payments, Sep-Dec 2025) and `payroll_run`/`payroll_line_item` (batch payroll, Jan 2026+). Reports and metrics showing total teacher compensation must query BOTH tables. The systems are independent with no FK relationship, so ensure mutations that affect either system invalidate `queryKeys.reports.all`.
- **DON'T** create a new family when a lead with the same person exists - this creates duplicates. The `AddFamilyModal` now checks for matching leads (by email or name) and offers to convert them instead. The proper workflow for leads is: Marketing view → find lead → "Convert to Customer" button → add students/enrollments to the converted family. Creating families directly in Directory bypasses this flow.
- **DON'T** set `status = 'active'` on a lead without also setting `lead_status = 'converted'` and `converted_at = NOW()` — the Marketing "Converted" metric counts families by `lead_status = 'converted'`. If you only change `status`, the lead disappears from the pipeline without being counted as a conversion. This applies to both application code and database triggers (e.g., `process_class_registration`).
- **DON'T** reference the deprecated `leads` table in new code - leads are stored as families with `status='lead'`. The database trigger `auto_convert_leads_on_enrollment` auto-converts matching leads when enrollments are created, checking both `primary_email` and `secondary_email` for matches.

---

## Tech Stack Reference

- **React 19** + TypeScript 5.9
- **Vite** for dev server and building
- **TailwindCSS** for styling (dark theme)
- **Supabase** for database and auth
- **TanStack React Query v5** for server state
- **React Router v7** for routing
- **Lucide React** for icons
