# Eaton Console — Optimization Roadmap

> Comprehensive prioritized to-do list based on architectural analysis of INTERFACES.md.
> Each item includes the problem, risk level, affected components, and a Claude Code prompt to execute the fix.
> Generated: 2026-02-19

---

## Priority System

| Priority | Meaning |
|----------|---------|
| 🔴 **P0 — Critical** | Active data integrity or financial risk. Fix immediately. |
| 🟠 **P1 — High** | Architectural debt that increases bug risk with every new feature. Fix within 2 weeks. |
| 🟡 **P2 — Medium** | Code quality and maintainability issues. Fix within 1–2 months. |
| 🟢 **P3 — Low** | Cleanup and consistency. Batch into a refactoring sprint. |

---

## 🔴 P0 — Critical (Active Risk)

### 1. Mailchimp Sync Silent Failures

**Problem:** T6 (`trigger_sync_family_status_to_mailchimp`) uses `pg_net` for async HTTP calls to the Mailchimp edge function. There is zero error handling — no retry logic, no error logging, no failure alerting. If the edge function is down, rate-limited, or returns an error, the family's Mailchimp tags silently drift out of sync with their actual status.

**Risk:** Active customers could be tagged as leads in Mailchimp, receiving wrong email campaigns. Churned families could keep getting active-family marketing. You'd never know unless you manually audited.

**Affected:** T6 trigger → `mailchimp` edge function → Mailchimp API, all families with status changes

**Fix approach:** Create a `mailchimp_sync_log` table that records every sync attempt. Modify the edge function to log success/failure. Create a daily reconciliation check that compares family statuses against Mailchimp tags and flags drift.

**Claude Code prompt:**
> Read INTERFACES.md sections on T6 (Mailchimp Sync) and the mailchimp edge function. Create a `mailchimp_sync_log` table in Supabase with columns: id, family_id, old_status, new_status, sync_status ('pending'|'success'|'failed'), error_message, created_at. Modify the `mailchimp` edge function to INSERT a log record on every call — success or failure. Then create a new edge function `mailchimp-reconcile` that queries all families with status in ('active','trial','churned','paused'), compares against Mailchimp subscriber tags via the API, and logs any mismatches. Add a hook `useMailchimpSyncLog()` so we can view sync history in the console. Update INTERFACES.md with the new table, edge function, and hook.

---

### 2. Payment Transfer Breaks Invoice Balances

**Problem:** T3 (`payment_updates_invoice`) fires on INSERT and UPDATE of `payments`. When a payment's `invoice_id` is changed (transferring a payment), T3 recalculates `amount_paid` on the NEW invoice but does NOT recalculate the OLD invoice. The old invoice retains a stale `amount_paid` that includes money that's no longer there.

**Risk:** Invoices showing as paid when the payment was moved elsewhere. Direct accounting/financial integrity issue.

**Affected:** T3 trigger, `payments` table, `invoices.amount_paid`, `invoices.status`, all downstream (T2 revenue records, Reports, CommandCenter)

**Fix approach:** Modify the T3 trigger function to also recalculate the old invoice when `invoice_id` changes on UPDATE.

**Claude Code prompt:**
> Read INTERFACES.md section on T3 (Payment Updates Invoice). The current trigger only recalculates amount_paid on NEW.invoice_id. Modify the `update_invoice_on_payment()` function so that on UPDATE, if OLD.invoice_id != NEW.invoice_id (payment transfer), it ALSO recalculates amount_paid and status on OLD.invoice_id by summing remaining payments. Test edge cases: transferring a payment that was the only payment on the old invoice (should reset to 0), transferring when old invoice has other payments, and transferring to an invoice that becomes fully paid. Update INTERFACES.md T3 section and remove the gotcha about stale balances.

---

### 3. Historical Invoices Skip Revenue Records

**Problem:** T2 (`trigger_create_revenue_on_payment`) only fires on UPDATE to `invoices`, not INSERT. The `createHistoricalInvoice` mutation (line 334) inserts invoices directly with `status='paid'`, bypassing T2 entirely. These paid invoices never generate revenue records.

**Risk:** Revenue reports undercount actual revenue. Any historical invoices imported for data cleanup are invisible to the reporting system.

**Affected:** T2 trigger, `useInvoiceMutations.createHistoricalInvoice`, `revenue_records`, Reports page, `get_revenue_by_month` RPC, `get_revenue_by_location` RPC

**Fix approach:** Either modify T2 to also fire on INSERT when status='paid', or have the `createHistoricalInvoice` mutation explicitly create revenue records after insertion.

**Claude Code prompt:**
> Read INTERFACES.md sections on T2 (Revenue Records) and the createHistoricalInvoice mutation. T2 only fires on UPDATE, so historical invoices inserted as status='paid' never generate revenue records. Fix this by adding a AFTER INSERT trigger on invoices that calls the same revenue record creation function when NEW.status = 'paid' AND NEW.invoice_date >= '2026-01-01'. Make sure the ON CONFLICT clause in the revenue function handles this gracefully. Test by inserting a historical invoice and verifying a revenue record is created. Update INTERFACES.md T2 section — document both the INSERT and UPDATE triggers.

---

### 4. Teacher Deletion Bypasses Batch Payroll Check

**Problem:** `EditTeacherModal.tsx` only checks `useTeacherPaymentsByTeacher` (legacy system) before allowing teacher deletion. It does not check `payroll_line_item` (batch system). A teacher with batch payroll records from Jan 2026+ could be deleted, orphaning their payroll line items.

**Risk:** Data loss — payroll records referencing a deleted teacher. Reports break on null teacher joins.

**Affected:** `EditTeacherModal`, `useTeacherPaymentsByTeacher`, `payroll_line_item`, `TeacherDetailPanel`

**Fix approach:** This is part of the larger payroll unification (see P1 #8), but needs an immediate guard.

**Claude Code prompt:**
> Read INTERFACES.md section on the Unified Payroll Interface Spec, specifically `useTeacherHasPayments`. As an immediate fix before the full payroll unification, update `EditTeacherModal.tsx` to also check for payroll_line_item records for this teacher. Query `payroll_line_item` where teacher_id matches — if any records exist, block deletion with the same warning used for legacy payments. This is a temporary fix until `useTeacherHasPayments` is implemented as part of the payroll unification. Update INTERFACES.md to note this guard in the EditTeacherModal entry.

---

## 🟠 P1 — High (Architectural Debt)

### 5. CommandCenter Direct Supabase Queries

**Problem:** `CommandCenter.tsx` bypasses the hook layer entirely, running 30+ inline metric calculations with direct Supabase queries against 10+ tables (enrollments, families, teachers, invoices, hub_sessions, invoice_line_items, event_stepup_pending, calendly_bookings, event_leads). Any column rename, type change, or table restructuring breaks the dashboard silently — hooks won't catch it, and since the queries are inline, there's no single place to update.

**Risk:** The dashboard is the first thing you see. If it breaks, you lose trust in all your numbers. Every schema change is a landmine.

**Affected:** `CommandCenter.tsx`, `useDashboardStats` hook, 10+ tables

**Fix approach:** Extract all CommandCenter queries into dedicated hooks or extend `useDashboardStats` to cover everything. The dashboard should consume hooks, never raw Supabase.

**Claude Code prompt:**
> Read INTERFACES.md sections on CommandCenter (6a) and the "Which components bypass the hook layer?" table. Audit CommandCenter.tsx and identify every direct Supabase query. For each one, either find an existing hook that provides the same data, or create a new hook in hooks.ts. Group new hooks under a `useDashboardMetrics()` composite hook that returns all dashboard data. Refactor CommandCenter to consume only hooks — zero direct Supabase imports. Update INTERFACES.md: remove CommandCenter from the "bypass" table, add new hooks to the catalog, and update the CommandCenter module entry.

---

### 6. Reports Page Direct Supabase Queries

**Problem:** Same issue as CommandCenter. `Reports.tsx` builds custom queries inline against `services`, `invoices`, `enrollments`, `teacher_payments`, and `payroll_run`, plus calls RPCs directly. Overlaps with some `useDashboardStats` calculations.

**Affected:** `Reports.tsx`, `services`, `invoices`, `enrollments`, `teacher_payments`, `payroll_run`, `get_revenue_by_month`, `get_revenue_by_location` RPCs

**Claude Code prompt:**
> Read INTERFACES.md sections on Reports (6h) and the "Which components bypass the hook layer?" table. Audit Reports.tsx and extract every direct Supabase query into hooks. Create `useRevenueByMonth(startDate)`, `useRevenueByLocation(startDate)`, `useEnrollmentStats()`, `useCashReceivedReport(startDate, endDate)`, and `useBalancesReport()` hooks as needed. For the payroll chart query, use the upcoming `usePayrollByMonth` from the unified payroll spec. Reports.tsx should import only hooks. Update INTERFACES.md accordingly.

---

### 7. Hardcoded Service-Location Mapping in T2

**Problem:** T2's revenue record creation uses a hardcoded CASE statement to map `services.code` to `location_id`. When a new service is added, if the CASE statement isn't updated, revenue records get `location_id = NULL` and revenue-by-location reports silently drop that revenue.

**Risk:** Adding a new service (which you'll definitely do as Eaton grows) breaks location-based revenue reporting with no error or warning.

**Affected:** T2 trigger function, `services.code`, `revenue_records.location_id`, `get_revenue_by_location` RPC, Reports page location chart

**Fix approach:** Replace the CASE statement with a lookup column on the `services` table (e.g., `default_location_id`), or create a `service_location_mapping` table. The trigger reads the mapping dynamically.

**Claude Code prompt:**
> Read INTERFACES.md section on T2 (Revenue Records), specifically the gotcha about hardcoded service code mapping. Add a `default_location_id` column (nullable UUID FK to locations) to the `services` table. Populate it based on the current CASE statement mapping. Modify the T2 trigger function to read `services.default_location_id` instead of using the CASE statement. If the column is NULL, fall back to NULL (same behavior as unmapped codes today, but now it's explicit). Add a UI field in Settings or the service management area to set this mapping. Update INTERFACES.md: the T2 section, the services entry in the Change Impact Matrix, and remove the CASE gotcha.

---

### 8. Unified Payroll Implementation

**Problem:** Three components implement three different merge strategies for the dual payroll system. The blueprint in INTERFACES.md is complete — this needs execution.

**Risk:** Grows with every new feature that touches payroll. The EditTeacherModal bug (P0 #4) is a direct symptom.

**Affected:** See INTERFACES.md "Unified Payroll Interface Spec" — 8 migration steps, 7 files

**Claude Code prompt:**
> Read the complete "Unified Payroll Interface Spec" section in INTERFACES.md. Execute migration steps 1 through 8 in order. After each step, run `npm run build` and `npm run lint` to verify nothing breaks. Key deliverables: create `useTeacherPayrollHistory`, `usePayrollByMonth`, `useTeacherHasPayments` hooks; refactor `TeacherDetailPanel`, `Reports.tsx`, `EditTeacherModal`; deprecate `RecordTeacherPaymentModal`; unexport legacy hooks; update query key invalidation. Follow every contract and rule defined in the spec. After completion, update INTERFACES.md to reflect the new state — mark the unified payroll spec as "Implemented" with the date.

---

### 9. PublicInvoicePage Direct Queries

**Problem:** `PublicInvoicePage.tsx` queries `invoices`, `families`, and `invoice_line_items` directly. This is a public-facing page handling real money through Stripe. Schema changes could break the customer payment experience.

**Risk:** A column rename could silently break the public invoice page, preventing customers from viewing or paying invoices.

**Affected:** `PublicInvoicePage.tsx`, `invoices`, `families`, `invoice_line_items`

**Claude Code prompt:**
> Read INTERFACES.md section on PublicInvoicePage (9c) and the "bypass hook layer" table. Audit PublicInvoicePage.tsx for all direct Supabase queries. Create a `usePublicInvoice(publicId)` hook that fetches the invoice with its family and line items — this hook should NOT require auth (it uses the public anon key like the current queries do). Refactor PublicInvoicePage to use only this hook. Update INTERFACES.md accordingly.

---

### 10. PayrollRunDetail Direct N8N Call

**Problem:** `PayrollRunDetail.tsx` calls the `payroll-notification` n8n webhook directly from the component instead of going through the hook layer. This mixes UI rendering with external service calls.

**Risk:** If the webhook URL changes, error handling needs updating, or you want to add notification tracking, you have to find it buried in a component file.

**Affected:** `PayrollRunDetail.tsx`, n8n `payroll-notification` webhook

**Claude Code prompt:**
> Read INTERFACES.md sections on PayrollRunDetail and the N8N webhook endpoints. Move the payroll-notification webhook call into `usePayrollMutations()` as a `sendNotification` function in hooks.ts. It should accept `{ action, payroll_run_id, period, total_amount, teacher_count }` and handle the N8N call with proper error handling and toast feedback. Refactor PayrollRunDetail.tsx to call `payrollMutations.sendNotification()` instead of the inline fetch. Update INTERFACES.md: remove PayrollRunDetail from the "Needs Refactoring" section and update the n8n webhook table to show the correct "Called From."

---

## 🟡 P2 — Medium (Code Quality)

### 11. EventDetailPanel Direct Queries

**Problem:** `EventDetailPanel.tsx` queries `event_attendees`, `event_orders`, and `families` directly instead of through hooks.

**Claude Code prompt:**
> Read INTERFACES.md section on EventDetailPanel (7f). Audit for direct Supabase queries and extract them into hooks — either create `useEventDetail(eventId)` or extend existing event hooks to cover attendee and order data with family joins. Refactor EventDetailPanel to consume only hooks. Update INTERFACES.md.

---

### 12. Settings Page Direct Queries

**Problem:** `Settings.tsx` queries `app_settings` and `locations` directly. Lower risk since it's admin-only, but still inconsistent with the hook-first pattern.

**Claude Code prompt:**
> Read INTERFACES.md section on Settings (6j). The existing `useSettings` and `useSettingMutations` hooks exist but Settings.tsx may not use them consistently. Audit and refactor Settings.tsx to use only `useSettings()`, `useSettingMutations()`, and `useActiveLocations()`. If any queries aren't covered by existing hooks, extend them. Update INTERFACES.md.

---

### 13. StatusBadge / statusColors.ts Split

**Problem:** Status color definitions are split between `statusColors.ts` (constants file) and `StatusBadge.tsx` (component). Some components import colors directly, others use StatusBadge. Adding a new status requires updating both places.

**Affected:** `StatusBadge.tsx`, `statusColors.ts`, any component that renders status indicators

**Claude Code prompt:**
> Read INTERFACES.md "Needs Refactoring" section about statusColors.ts vs StatusBadge.tsx. Consolidate all status color definitions into a single canonical source. Move all color/label mappings into StatusBadge.tsx (or a shared constants file that StatusBadge imports). Find every import of statusColors.ts across the codebase and replace with StatusBadge or the new canonical source. Delete statusColors.ts if fully migrated. Update INTERFACES.md to remove this from the "Needs Refactoring" section.

---

### 14. `hours_per_week` Sync Enforcement

**Problem:** `hours_per_week` must be manually kept in sync between `enrollments` and `teacher_assignments`. The hook handles it on update, but there's no database constraint enforcing it. Direct writes to either table (from triggers, edge functions, or future features) can cause drift.

**Affected:** `enrollments.hours_per_week`, `teacher_assignments.hours_per_week`, `useTeacherAssignmentMutations.updateAssignment`, payroll calculations

**Claude Code prompt:**
> Read INTERFACES.md sections on enrollments and teacher_assignments in the Change Impact Matrix. Currently hours_per_week sync only happens in the updateAssignment hook. Create a database trigger on teacher_assignments that, AFTER UPDATE of hours_per_week, updates the corresponding enrollment's hours_per_week (and vice versa — a trigger on enrollments that updates assignments). Handle the circular trigger case by checking if the values already match before updating. This ensures sync regardless of whether the change comes from a hook, trigger, or direct query. Update INTERFACES.md with the new triggers.

---

### 15. T6 Mailchimp Trigger Scope Gap

**Problem:** T6 only fires for status changes to `active`, `trial`, `churned`, or `paused`. It does NOT fire when a family's status changes TO `lead`. This means if you manually set an active family back to lead status (data cleanup), Mailchimp keeps the `active-family` tag.

**Affected:** T6 trigger, Mailchimp subscriber tags, email campaign targeting

**Claude Code prompt:**
> Read INTERFACES.md section on T6 (Mailchimp Sync). The trigger currently skips `lead` status. Evaluate whether T6 should also fire when status changes TO 'lead' — this would handle edge cases like manual status resets during data cleanup. If adding 'lead' to the trigger condition, ensure the edge function handles the `lead` → `lead` Mailchimp tag mapping correctly. Update the trigger, test, and update INTERFACES.md.

---

### 16. pg_net Failure Visibility (Broader than Mailchimp)

**Problem:** T6 uses `pg_net` for async HTTP, which provides zero visibility into failures. This isn't just a Mailchimp problem — it's a pattern risk. Any future trigger that uses `pg_net` will have the same blind spot.

**Claude Code prompt:**
> Read INTERFACES.md section on T6. Research pg_net's `net._http_response` table — this stores responses from async requests including status codes and error messages. Create a monitoring hook `usePgNetFailures()` that queries this table for recent failed requests (status >= 400 or timed out). Add a small alert indicator to CommandCenter that shows if there are recent pg_net failures. This gives you visibility into ALL async trigger failures, not just Mailchimp. Update INTERFACES.md.

---

## 🟢 P3 — Low (Cleanup)

### 17. Consolidate `updated_at` Trigger Functions

**Problem:** Three different function names (`update_updated_at_column`, `update_updated_at`, `update_<table>_updated_at`) all have identical bodies. Confusing for maintenance.

**Claude Code prompt:**
> Read INTERFACES.md section on T12 (updated_at triggers). Migrate all triggers to use a single shared function `update_updated_at_column()`. For each table-specific function, create the trigger using the shared function, verify it works, then drop the old function. Run through all 13 triggers listed. Update INTERFACES.md to show a single function name.

---

### 18. Invoice Number Counter Contention (Future Scale)

**Problem:** T1 uses an `invoice_number_counter` table with atomic increment for sequential invoice numbers. This works fine at current scale but becomes a bottleneck under concurrent invoice generation (e.g., bulk draft generation for many families simultaneously).

**Fix:** Low priority — only relevant if you're generating hundreds of invoices concurrently. Monitor for now, consider a sequence-based approach if `generateDrafts` starts timing out.

---

### 19. Add Error Boundaries to Public Pages

**Problem:** Public pages (`/desk/:token`, `/invoice/:publicId`) are customer/teacher-facing. If they crash due to a data issue, users see a blank React error screen instead of a helpful message.

**Claude Code prompt:**
> Review the public pages in INTERFACES.md (sections 9a, 9b, 9c). Add React error boundary components around TeacherDesk, CheckinForm, and PublicInvoicePage that catch rendering errors and display a friendly fallback message with contact information. The error boundary should also log the error to a Supabase `error_log` table for debugging.

---

### 20. Document Remaining N8N Workflow Internals

**Problem:** INTERFACES.md documents the webhook contracts between eaton-console and n8n, but doesn't describe what happens INSIDE the n8n workflows. If a workflow breaks, you have to open n8n and trace through it manually.

**Claude Code prompt:**
> This is a manual task. Open each n8n workflow listed in INTERFACES.md (gmail-search, gmail-thread, gmail-send, invoice-send, payroll-notification, checkin-notify, checkin-training, newsletter, onboarding workflows). For each one, document in INTERFACES.md under a new "N8N Workflow Internals" section: the trigger node, each processing step, any external API calls, error handling nodes (if any), and the response format. This makes n8n workflows visible to future Claude sessions without needing MCP access.

---

## Execution Order (Recommended)

**Week 1 — Stop the bleeding:**
- P0 #2: Payment transfer fix (30 min, pure SQL trigger change)
- P0 #4: Teacher deletion guard (30 min, one component change)
- P0 #3: Historical invoice revenue fix (1 hr, trigger + test)
- P0 #1: Mailchimp sync logging (2–3 hrs, new table + edge function changes)

**Week 2 — Payroll unification:**
- P1 #8: Execute the full unified payroll spec (4–6 hrs, 8 migration steps)

**Week 3 — Hook layer enforcement:**
- P1 #5: CommandCenter refactor (3–4 hrs)
- P1 #6: Reports refactor (2–3 hrs)
- P1 #9: PublicInvoicePage refactor (1 hr)
- P1 #10: PayrollRunDetail N8N fix (30 min)

**Week 4 — Architecture hardening:**
- P1 #7: Service-location mapping (1–2 hrs)
- P2 #14: hours_per_week sync triggers (1 hr)
- P2 #13: StatusBadge consolidation (1 hr)
- P2 #15: T6 scope fix (30 min)
- P2 #16: pg_net monitoring (1–2 hrs)

**Ongoing / as time allows:**
- P2 #11, #12: EventDetailPanel, Settings refactor
- P3 #17–20: Cleanup tasks

---

## Tracking

| # | Item | Priority | Status | Date Completed |
|---|------|----------|--------|----------------|
| 1 | Mailchimp sync logging | 🔴 P0 | ⬜ Not started | |
| 2 | Payment transfer fix | 🔴 P0 | ✅ Complete | 2026-02-20 |
| 3 | Historical invoice revenue | 🔴 P0 | ✅ Complete | 2026-02-20 |
| 4 | Teacher deletion guard | 🔴 P0 | ✅ Complete | 2026-02-20 |
| 5 | CommandCenter hooks | 🟠 P1 | ⬜ Not started | |
| 6 | Reports hooks | 🟠 P1 | ⬜ Not started | |
| 7 | Service-location mapping | 🟠 P1 | ⬜ Not started | |
| 8 | Unified payroll | 🟠 P1 | ⬜ Not started | |
| 9 | PublicInvoicePage hooks | 🟠 P1 | ⬜ Not started | |
| 10 | PayrollRunDetail N8N | 🟠 P1 | ⬜ Not started | |
| 11 | EventDetailPanel hooks | 🟡 P2 | ⬜ Not started | |
| 12 | Settings hooks | 🟡 P2 | ⬜ Not started | |
| 13 | StatusBadge consolidation | 🟡 P2 | ⬜ Not started | |
| 14 | hours_per_week sync | 🟡 P2 | ⬜ Not started | |
| 15 | T6 Mailchimp scope | 🟡 P2 | ⬜ Not started | |
| 16 | pg_net monitoring | 🟡 P2 | ⬜ Not started | |
| 17 | updated_at consolidation | 🟢 P3 | ⬜ Not started | |
| 18 | Invoice counter monitoring | 🟢 P3 | ⬜ Not started | |
| 19 | Public page error boundaries | 🟢 P3 | ⬜ Not started | |
| 20 | N8N workflow documentation | 🟢 P3 | ⬜ Not started | |

---

> **After completing each item:** Update INTERFACES.md to reflect the changes, mark the item complete in this tracking table, and verify with `npm run build && npm run lint`.
