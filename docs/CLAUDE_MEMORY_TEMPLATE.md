# Eaton Console - Working Memory

## Quick-Reference Patterns

- **Dates:** `formatDateLocal()`, `parseLocalDate()`, `getTodayString()` from `dateUtils.ts` — never `toISOString()` or `new Date(dateStr)`
- **Money:** `multiplyMoney()`, `addMoney()`, `formatCurrency()` from `moneyUtils.ts` — never raw arithmetic
- **Supabase queries:** `.maybeSingle()` not `.single()`, `.ilike()` not `.eq()` for emails, `value || null` for nullable fields
- **Names:** `formatNameLastFirst()` from `utils.ts` for storage and comparison
- **Phones:** `normalizePhone()` for E.164 storage, `formatPhoneDisplay()` for UI
- **Hooks:** all in `src/lib/hooks.ts`, mutations return `{ data, warnings: string[] }`
- **Modals:** use `AccessibleModal` from `components/ui/`, never plain div wrappers
- **Leads:** families with `status='lead'` — convert with `lead_status='converted'` + `converted_at`
- **Cache:** invalidate `queryKeys.stats.dashboard()` after mutations affecting invoices/enrollments/families
- **Types:** use insert types (`FamilyInsert`, etc.) not `Partial<T>` for mutations
- **Edge Functions:** validate env vars early, `verify_jwt = false` in config.toml for external webhooks

## Key Files

| Purpose | Location |
|---------|----------|
| All hooks + types | `src/lib/hooks.ts` |
| Query key factory | `src/lib/queryClient.ts` |
| Date utilities | `src/lib/dateUtils.ts` |
| Money utilities | `src/lib/moneyUtils.ts` |
| Name/age utilities | `src/lib/utils.ts` |
| Phone utilities | `src/lib/phoneUtils.ts` |
| SMS templates | `src/lib/smsTemplates.ts` |
| Auto-generated types | `src/types/supabase.ts` (DO NOT EDIT) |
| Custom DB types | `src/types/database.ts` |

## Topic Files (in repo: docs/)

- `docs/claude-integrations.md` — Calendly, Twilio, N8N, Google Forms, Mailchimp specifics
- `docs/claude-database-triggers.md` — trigger behaviors, gotchas, thresholds
- `docs/claude-architecture-notes.md` — payroll systems, revenue_records, lead conversion flow
