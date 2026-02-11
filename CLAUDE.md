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

### Database & Supabase

- **DON'T** use `.single()` when a query might return 0 or multiple rows — use `.maybeSingle()`. Only use `.single()` when exactly one row is guaranteed.
- **DON'T** use `.eq()` for email lookups — use `.ilike('primary_email', email.toLowerCase())` for case-insensitive matching.
- **DON'T** pass empty strings to Supabase for nullable fields — use `value || null`. PostgreSQL cannot convert `''` to date/timestamp types.
- **DON'T** enable RLS on new tables — this internal admin app doesn't use Row Level Security.
- **DON'T** fetch large datasets without considering the 1000 row default limit — use `.rpc()` with database functions for aggregation (see `get_revenue_by_month`, `get_revenue_by_location`).
- **DON'T** query new tables before applying migrations and running `npm run db:types` — use `(supabase.from as any)('table_name')` as a workaround with a comment.
- **DON'T** assume column names in Edge Functions match your mental model — Supabase inserts silently fail on wrong column names. Always verify against the schema.

### Database Triggers

- **DON'T** assume all data creation happens in application code — triggers like `process_class_registration` auto-create students and enrollments. Check Dashboard → Triggers when debugging.
- **DON'T** use BEFORE INSERT triggers that reference the new row via FK — the row doesn't exist yet. Use AFTER INSERT.
- **DON'T** leave triggers referencing deprecated tables/columns — they silently fail. Audit triggers in Dashboard after schema changes.
- **DON'T** assume `payment_updates_invoice` fires on UPDATE — it only fires on INSERT. When transferring payments, manually reset the source invoice's `amount_paid`.
- **DON'T** change the fuzzy match threshold (0.55) in `process_class_registration` without testing — catches typos (score ~0.62) while staying above sibling-to-sibling scores (0.3-0.4).
- **DON'T** modify `create_revenue_records_on_payment()` without including the `location_id` CASE mapping (service code → location). New service codes must be added to both the trigger and the backfill.

### Database Schema Relationships

- **DON'T** forget `enrollments` and `teacher_assignments` have separate `hours_per_week` — editing hours must update BOTH. Roster/Teachers use `teacher_assignments`, invoicing uses `enrollments`.
- **DON'T** assume `revenue_records` links to enrollments — it tracks by `family_id`, `student_id`, `service_id` with no `enrollment_id` FK. Uses `location_id` for location reporting.
- **DON'T** forget there are TWO payroll systems — `teacher_payments` (legacy, Sep-Dec 2025) and `payroll_run`/`payroll_line_item` (batch, Jan 2026+). Reports must query both; invalidate `queryKeys.reports.all`.

### Business Logic & Lead Management

- **DON'T** create families with `status: 'lead'` for paying customers — leads are excluded from Directory and can't be invoiced. Event purchases should use `status: 'active'`.
- **DON'T** create leads without checking for duplicates — check for existing families with the same email first. See `ingest-lead` and `calendly-webhook` for the pattern.
- **DON'T** rely on email-only matching for family lookups — check both `primary_email` and `secondary_email`, fall back to name matching. Use `find_or_create_family_for_purchase()` for new integrations.
- **DON'T** create a new family when a matching lead exists — `AddFamilyModal` checks for leads by email/name and offers conversion. Use Marketing → "Convert to Customer" flow.
- **DON'T** set `status = 'active'` on a lead without also setting `lead_status = 'converted'` and `converted_at = NOW()` — the Marketing "Converted" metric depends on `lead_status`.
- **DON'T** reference the deprecated `leads` table — leads are families with `status='lead'`. The `auto_convert_leads_on_enrollment` trigger handles auto-conversion.

### Edge Functions & Webhooks

- **DON'T** forget `verify_jwt = false` for external webhooks — add to `supabase/config.toml` with `[functions.function-name]` section.
- **DON'T** trust external webhook payload structures — use defensive null checks and log raw payloads for debugging.
- **DON'T** use non-null assertions (`!`) for env vars — validate and return early with a clear 500 error.
- **DON'T** query Supabase directly from N8N — create helper edge functions that N8N calls via HTTP instead. Specifically, n8n Supabase node `filterString` (e.g., `=primary_email.ilike.{{ email }}`) breaks PostgREST parsing when values contain dots (like email addresses), causing silent wrong matches. Route all lead ingestion through the `ingest-lead` edge function.

### Integration-Specific

- **DON'T** look for Calendly phone numbers on the invitee — they're in `scheduled_event.location.location` for outbound calls. Priority: location > text_reminder_number > form answers.
- **DON'T** use Google Forms published ID format (`/forms/d/e/{id}/`) — use the edit ID format (`/forms/d/{id}/`).
- **DON'T** pass raw Twilio statuses to `sms_messages` — map via `mapTwilioStatus()` in `send-sms/index.ts` (`queued`/`sending` → `sent`).
- **DON'T** allow Twilio status callbacks to downgrade status — callbacks arrive out of order (e.g. `sent` after `delivered`). The `twilio-status-webhook` uses a priority guard; maintain this pattern if modifying status update logic.
- **DON'T** use ASCII ranges for GSM character detection — use the explicit character sets in `smsTemplates.ts`.

### Data Handling & Formatting

- **DON'T** compare names with string equality — use `formatNameLastFirst()` from `utils.ts` to normalize before comparison.
- **DON'T** store names in "First Last" or "XYZ Family" format — use `formatNameLastFirst()` which handles all variants and is idempotent.
- **DON'T** hardcode age group values — use `AGE_GROUP_OPTIONS`, `getAgeGroup(dob)`, and `getAgeGroupSortValue()` from `utils.ts`.
- **DON'T** store phone numbers inconsistently — use `normalizePhone()` for E.164 storage (+1XXXXXXXXXX), `formatPhoneDisplay()` for display.
- **DON'T** use `new Date()` on Supabase `timestamptz` columns for month/date grouping — extract the date part first with `.split('T')[0]` or `.split(' ')[0]`, then use `parseLocalDate()`. `new Date()` + `.getMonth()` returns the local timezone month, which can differ from the UTC date.

### UI & Frontend

- **DON'T** create custom modal wrappers with plain divs — use `AccessibleModal` for focus trap, keyboard handling, and aria attributes.
- **DON'T** use only `contentStyle` for Recharts tooltips in dark mode — also add `itemStyle={{ color: '#e5e7eb' }}` and `labelStyle={{ color: '#9ca3af' }}`.
- **DON'T** use `window.location.origin` for URLs in emails — use `import.meta.env.VITE_APP_URL || window.location.origin`.
- **DON'T** create local Toast components — use `const { showSuccess, showError } = useToast()` from `src/lib/toast.tsx`.
- **DON'T** duplicate STATUS_COLORS across files — use shared constants or a `<StatusBadge>` component.

### Error Handling

- **DON'T** silently swallow errors in secondary operations — return `{ data, warnings: string[] }` so callers can show partial failure messages. See `updateInvoice`, `recordPayment`, `createPayrollRun`.
- **DON'T** make fetch calls to external APIs without try-catch and timeout — use AbortController and validate response JSON.
- **DON'T** let PDF generation fail silently — wrap in try-catch and return `{ success, error? }`.

### Conventions & Code Quality

- **DON'T** create new hook files — add hooks to `src/lib/hooks.ts`.
- **DON'T** use `console.log` in committed code.
- **DON'T** use `Partial<T>` for mutation inputs — use insert types (`FamilyInsert`, `StudentInsert`, etc.).
- **DON'T** duplicate utility functions — import `formatDateLocal()`, `formatCurrency()`, etc. from their canonical locations.
- **DON'T** hardcode external service URLs — use env vars like `import.meta.env.VITE_N8N_BASE_URL` with a fallback.

### React Query & Caching

- **DON'T** forget to invalidate `stats.dashboard()` in mutations affecting Command Center metrics — the dashboard has 60-second `staleTime`.

---

## Tech Stack Reference

- **React 19** + TypeScript 5.9
- **Vite** for dev server and building
- **TailwindCSS** for styling (dark theme)
- **Supabase** for database and auth
- **TanStack React Query v5** for server state
- **React Router v7** for routing
- **Lucide React** for icons
