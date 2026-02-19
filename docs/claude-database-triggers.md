# Database Triggers Reference

## Key Triggers

### `process_class_registration`
- Fires on event_attendees/event_orders insert/update
- Auto-creates students and enrollments
- Uses `pg_trgm` `similarity()` at threshold **0.55** for fuzzy name matching
- Catches typos ("Pmapin" vs "Pampin" = 0.62) and spelling variations ("Anabella" vs "Annabelle" = 0.65)
- Stays above sibling-to-sibling scores (0.3-0.4)
- Do NOT change threshold without testing against real sibling names

### `auto_convert_leads_on_enrollment`
- Auto-converts matching leads when enrollments are created
- Checks both `primary_email` and `secondary_email` for matches
- Leads are families with `status='lead'`

### `payment_updates_invoice`
- Only fires on **INSERT** to the `payments` table, NOT on UPDATE
- If transferring payments by updating `invoice_id`, the source invoice's `amount_paid` becomes stale
- Must manually reset source invoice's `amount_paid` (e.g., set to 0 when voiding)

### `trigger_sync_family_status_to_mailchimp`
- Fires AFTER UPDATE OF `status` on `families`
- Conditions: status actually changed, `primary_email` is not null, new status in (`active`, `trial`, `churned`, `paused`)
- Uses `pg_net` (async HTTP) to POST to the `mailchimp` edge function with action `sync_family_status`
- Swaps Mailchimp tags: removes old status tag, adds new one (`active/trial` → `active-family`, `lead` → `lead`, `churned/paused` → `churned`)
- Writes back `mailchimp_id`, `mailchimp_status`, `mailchimp_last_synced_at` to the family record
- Also covers lead → active conversions (lead conversion sets `status = 'active'`, which fires this trigger)
- Migration: `20260219_mailchimp_auto_sync_on_status_change.sql`

## Common Gotchas

- **BEFORE INSERT triggers can't use FK to the new row** — the row doesn't exist yet. Use AFTER INSERT.
- **Triggers referencing deprecated tables silently fail** — the main operation succeeds but related inserts don't. Audit Dashboard → Triggers after schema changes.
- **Example:** `trigger_update_lead_score_on_activity` referenced the deprecated `leads` table, causing webhooks to partially succeed.
- **Trigger functions may live in `supabase/migrations/` or may have been created directly in Dashboard** — check both when debugging.
