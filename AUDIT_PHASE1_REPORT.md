# Phase 1: Critical Infrastructure Audit Report

**Files Analyzed:**
- `src/lib/hooks.ts` (7,445 LOC) - All React Query hooks & mutations
- `src/lib/queryClient.ts` (308 LOC) - Query key factory
- `src/types/database.ts` (3,160 LOC) - TypeScript interfaces

**Agents Used:** code-reviewer, silent-failure-hunter, type-design-analyzer

---

## Critical Issues (Must Fix)

### 1. Money Arithmetic Violations - Direct Addition
**File:** `src/lib/hooks.ts:4326, 4439`
**Agent:** code-reviewer

```typescript
// Line 4326 - updateLineItem mutation
const finalAmount = calculatedAmount + adjustment

// Line 4439 - updateAllTeacherHours mutation
const finalAmount = calculatedAmount + (item.adjustment_amount || 0)
```

**CLAUDE.md Violation:** "DON'T do direct multiplication/division with money"
**Impact:** Floating-point errors in payroll calculations - teachers could be paid incorrect amounts.
**Fix:** Replace with `addMoney(calculatedAmount, adjustment)`

---

### 2. Silent Failure - Unchecked calendly_bookings Update
**File:** `src/lib/hooks.ts:2637-2639`
**Agent:** silent-failure-hunter

```typescript
await supabase.from('calendly_bookings')
  .update({ status: 'completed', invoice_id: invoice.id })
  .in('id', bookingIds)
// NO ERROR CHECK
```

**Impact:** Hub sessions appear unbilled but invoice exists. Data inconsistency.
**Fix:** Check error and add to warnings array.

---

### 3. Silent Failure - Unchecked event_orders Update
**File:** `src/lib/hooks.ts:2447-2449`
**Agent:** silent-failure-hunter

```typescript
await supabase.from('event_orders')
  .update({ invoice_id: invoice.id })
  .in('id', orderIds)
// NO ERROR CHECK
```

**Impact:** Duplicate invoicing risk - families could be charged twice for registration fees.
**Fix:** Check error and track in failedFamilies array.

---

### 4. Silent Failure - Unchecked invoice_emails Insert
**File:** `src/lib/hooks.ts:3105-3111, 3200-3206, 3358-3364`
**Agent:** silent-failure-hunter

```typescript
await supabase.from('invoice_emails').insert({
  invoice_id: invoiceId,
  email_type: 'invoice',
  // ...
})
// NO ERROR CHECK
```

**Impact:** Email audit trail silently lost. Users may resend invoices thinking they weren't sent.
**Fix:** Check error and add to warnings.

---

### 5. Silent Failure - Unchecked Teacher Assignment End
**File:** `src/lib/hooks.ts:1579-1585`
**Agent:** silent-failure-hunter

```typescript
if (oldTeacherId && endPrevious) {
  await supabase.from('teacher_assignments')
    .update({ is_active: false, end_date: today })
    .eq('enrollment_id', enrollmentId)
    // NO ERROR CHECK
}
```

**Impact:** Both old and new assignments could remain active. Payroll doubled.
**Fix:** Check error and throw.

---

### 6. Type Safety - Missing Insert Types
**File:** `src/lib/hooks.ts:1524, 2400, 4124`
**Agent:** type-design-analyzer

Missing proper insert types leads to `as any` casts:
- `TeacherAssignmentInsert` - line 1527
- `InvoiceLineItemInsert` - line 2413
- `PayrollLineItemInsert` - line 4179

**CLAUDE.md Violation:** "DON'T use `Partial<T>` for mutation inputs"
**Fix:** Create insert types following existing `FamilyInsert`, `StudentInsert` pattern.

---

### 7. Type Safety - Family Type Missing Fields
**File:** `src/lib/hooks.ts:27-44`
**Agent:** type-design-analyzer

Manual `Family` interface is missing fields from auto-generated Supabase types:
- `legacy_lookup_key`
- `reengagement_flag`
- `secondary_email`
- Lead-related fields

**Fix:** Derive types from `Database['public']['Tables']['families']['Row']`

---

### 8. Missing Dashboard Stats Invalidation
**File:** `src/lib/hooks.ts:2477-2481, 2563-2568, 2643-2648`
**Agent:** code-reviewer

Invoice-creating mutations don't invalidate dashboard stats:
- `generateDrafts` - creates draft invoices
- `generateEventInvoice` - creates event invoices
- `generateHubInvoice` - creates Hub invoices

**CLAUDE.md Violation:** "DON'T forget to invalidate `stats.dashboard()` in mutations that affect Command Center metrics"
**Impact:** Dashboard shows stale outstanding balance until manual refresh.
**Fix:** Add `queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() })` to `onSuccess`

---

### 9. Missing Dashboard Stats Invalidation on Family Status Change
**File:** `src/lib/hooks.ts:603-606`
**Agent:** code-reviewer

`updateFamily` mutation doesn't invalidate dashboard when status changes (e.g., lead to active).
**Impact:** Student count metrics become stale.

---

## Important Issues (Should Fix)

### 10. Missing `.maybeSingle()` Usage
**File:** `src/lib/hooks.ts:5956-5959`
**Agent:** silent-failure-hunter

```typescript
.eq('invite_id', inviteId)
.single()

if (respError.code === 'PGRST116') return null
```

**Issue:** Works but fragile. Per CLAUDE.md, use `.maybeSingle()` instead.

---

### 11. Missing Rollback in generateEventInvoice
**File:** `src/lib/hooks.ts:2539-2542`
**Agent:** silent-failure-hunter

```typescript
const { error: itemsError } = await supabase.from('invoice_line_items').insert(lineItems)
if (itemsError) throw itemsError
// Invoice created on line 2500-2509 is now orphaned
```

**Fix:** Delete orphaned invoice before throwing:
```typescript
if (itemsError) {
  await supabase.from('invoices').delete().eq('id', invoice.id)
  throw itemsError
}
```

---

### 12. Lost Error Details in Bulk Operations
**File:** `src/lib/hooks.ts:3121-3136`
**Agent:** silent-failure-hunter

```typescript
const failed = results.filter((r) => r.status === 'rejected').length
return { succeeded, failed, total: invoiceIds.length }
// WHICH invoices failed? WHY?
```

**Fix:** Track individual failures with invoice IDs and error messages.

---

### 13. Missing Warnings Return from generateHubInvoice
**File:** `src/lib/hooks.ts:2572-2648`
**Agent:** silent-failure-hunter

Unlike `updateInvoice` and `recordPayment`, this function doesn't return `{ data, warnings }` even though it has secondary operations that can fail.

---

### 14. Non-null Assertion Without Guard
**File:** `src/lib/hooks.ts:821`
**Agent:** type-design-analyzer

```typescript
.eq('id', id!)
```

While `enabled: !!id` prevents execution, the `!` assertion is a code smell.

---

### 15. `as unknown as` Double Casts
**File:** `src/lib/hooks.ts:1218, 1514, 2452, 7410`
**Agent:** type-design-analyzer

These indicate type mismatches between custom interfaces and Supabase return types.

---

### 16. RPC Function Type Casts
**File:** `src/lib/hooks.ts:7183, 7222`
**Agent:** type-design-analyzer

```typescript
(supabase.rpc as any)('get_potential_duplicate_families', ...)
```

Missing RPC function type declarations force unsafe casts.

---

## Suggestions (Nice to Have)

### 17. Empty Catch Blocks in localStorage
**File:** `src/lib/hooks.ts:6527-6543`
**Agent:** silent-failure-hunter

```typescript
catch {
  // localStorage might be full or unavailable - fail silently
}
```

Should at least log warning for debugging.

---

### 18. console.warn for Missing Functions
**File:** `src/lib/hooks.ts:7186-7189, 7225-7228, 7286-7289`
**Agent:** silent-failure-hunter

Features silently degrade when migrations not applied. Consider UI indicator.

---

### 19. Inconsistent Null Guards on Return
**File:** Various locations
**Agent:** type-design-analyzer

Some hooks return `data as Type[]` (no null guard), others return `(data || []) as Type[]`.

---

### 20. Documentation Mismatch
**File:** `src/types/database.ts`
**Agent:** code-reviewer

CLAUDE.md says this file contains "Custom TypeScript interfaces" but it's actually auto-generated Supabase types (duplicate of supabase.ts).

---

## Patterns Observed

| Pattern | Occurrences | Impact |
|---------|-------------|--------|
| Unchecked secondary Supabase operations | 6+ locations | Silent data inconsistency |
| Missing dashboard stats invalidation | 4 mutations | Stale UI metrics |
| `as any` casts | 10+ locations | Type safety bypassed |
| Missing insert types | 4 types needed | Forces unsafe casts |
| Direct money arithmetic | 2 locations | Financial calculation errors |
| Missing `{ data, warnings }` return | 3+ mutations | Users not notified of partial failures |

---

## Priority Fix Order

1. **Money arithmetic** (lines 4326, 4439) - Financial impact
2. **Silent failures in invoice generation** (lines 2447, 2637) - Data integrity
3. **Dashboard stats invalidation** (4 mutations) - UX consistency
4. **Missing rollback** (line 2539) - Orphaned data
5. **Create insert types** - Systematic type safety improvement
6. **Unchecked invoice_emails** - Audit trail integrity
7. **Teacher assignment error handling** - Payroll accuracy

---

## Next Steps

- [ ] Fix critical money arithmetic issues
- [ ] Add error handling to unchecked Supabase operations
- [ ] Create missing insert types
- [ ] Proceed to Phase 2: Core Business Logic audit
