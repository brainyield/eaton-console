# Phase 2: Core Business Logic Audit Report

**Files Analyzed:**
- `src/components/GenerateDraftsModal.tsx` (1,654 LOC) - Invoice generation wizard
- `src/components/Marketing.tsx` (1,456 LOC) - Campaign management
- `src/components/Invoicing.tsx` (815 LOC) - Invoice management
- `src/components/CommandCenter.tsx` (858 LOC) - Dashboard metrics

**Agents Used:** code-reviewer, silent-failure-hunter, code-simplifier

---

## Critical Issues (Must Fix)

### 1. CommandCenter - No Error Checking on 18 Parallel Queries
**File:** `src/components/CommandCenter.tsx:80-393`
**Agent:** silent-failure-hunter

```typescript
const [
  studentsWithActiveEnrollmentsResult,
  familiesResult,
  // ... 16 more queries
] = await Promise.all([
  supabase.from('enrollments').select(...),
  // ... NO ERROR CHECKING ON ANY RESULT
])
```

**Impact:** Dashboard shows zeros or stale data. Users make business decisions on incorrect metrics (e.g., outstanding balance shows $0 when invoices query fails).
**Fix:** Check `error` property on each critical result and either throw or aggregate warnings.

---

### 2. Marketing - Silent Catch on Mailchimp Sync
**File:** `src/components/Marketing.tsx:576-577`
**Agent:** silent-failure-hunter

```typescript
} catch {
  // Silent fail for auto-refresh
}
```

**Impact:** Users see stale engagement data with no indication of why. Hides network errors, auth failures, rate limiting.
**Fix:** Add `console.error` logging; after N consecutive failures, show subtle warning.

---

### 3. PayrollRunDetail - Silent Notification Failure
**File:** `src/components/PayrollRunDetail.tsx:504-506`
**Agent:** silent-failure-hunter

```typescript
triggerBulkPayrollNotifications(run, teacherGroups).catch(() => {
  // Silently handle notification errors
})
```

**Impact:** Teachers don't receive payment confirmation emails. Admins have no visibility into failures.
**Fix:** Surface notification status to admin as warnings.

---

## Important Issues (Should Fix)

### 4. GenerateDraftsModal - Not Using AccessibleModal
**File:** `src/components/GenerateDraftsModal.tsx:911-1627`
**Agent:** code-reviewer

**Issue:** Uses custom div-based modal without:
- Focus trap (users can tab outside)
- Escape key handling
- Proper ARIA attributes

**CLAUDE.md Violation:** "DON'T create custom modal wrappers with plain divs - use AccessibleModal"
**Fix:** Refactor to use `AccessibleModal` wrapper.

---

### 5. GenerateDraftsModal - Missing Query Error States
**File:** `src/components/GenerateDraftsModal.tsx:243-256`
**Agent:** silent-failure-hunter

```typescript
const { data: existingInvoices = [] } = useExistingInvoicesForPeriod(...)
const { data: pendingClassFees = [] } = usePendingClassRegistrationFees()
// NO error states destructured
```

**Impact:** Modal shows empty data if queries fail. Users may generate incomplete invoices.
**Fix:** Extract and display error states.

---

### 6. SmsComposeModal - Silent Template Generation Failure
**File:** `src/components/sms/SmsComposeModal.tsx:70-72, 87-89`
**Agent:** silent-failure-hunter

```typescript
try {
  const generated = generateMessage(...)
} catch {
  setMessage('')  // Silent clear
}
```

**Impact:** Users click template, see nothing happen, don't know why.
**Fix:** Show error message when template generation fails.

---

### 7. CommandCenter - Generic Error Display
**File:** `src/components/CommandCenter.tsx:581-588`
**Agent:** silent-failure-hunter

```typescript
{error && <div className="text-red-400">Failed to load dashboard data</div>}
```

**Impact:** No specific error message, no retry button, users can't diagnose.
**Fix:** Add error details and retry button.

---

### 8. GenerateDraftsModal - Inline centsToDollars Calculations
**File:** `src/components/GenerateDraftsModal.tsx:1259, 1532`
**Agent:** code-reviewer

```typescript
${(order.total_cents / 100).toFixed(2)}  // Should use centsToDollars()
```

**Impact:** Minor inconsistency - works correctly but doesn't use imported utility.
**Fix:** Use `centsToDollars()` for consistency.

---

### 9. GenerateDraftsModal - Duplicate formatDate Function
**File:** `src/components/GenerateDraftsModal.tsx:124-130`
**Agent:** code-reviewer

```typescript
function formatDate(date: Date): string {
  // Duplicates formatDateLocal() from dateUtils.ts
}
```

**Fix:** Import from dateUtils instead of duplicating.

---

## Simplification Opportunities

### Cross-File Patterns (High Impact)

| Pattern | Files | Est. LOC Reduction | Risk |
|---------|-------|-------------------|------|
| `useSelectionState` hook | GenerateDrafts, Marketing, Invoicing | 100+ | Low |
| `useBulkMutation` hook | Marketing, Invoicing | 80 | Medium |
| ServiceBadge component | GenerateDrafts, Invoicing | 30 | Low |
| SERVICE_COLORS constant | GenerateDrafts, Invoicing | 15 | Low |

### GenerateDraftsModal.tsx (230 LOC reduction possible)

| Finding | Lines | Reduction | Risk |
|---------|-------|-----------|------|
| Duplicate toggle handlers | 450-565, 618-656 | 80 | Low |
| Group-by-family logic | 382-409, 495-516, 578-599 | 40 | Low |
| Unlinked banners | 1163-1181, 1283-1302 | 25 | Low |
| Invoice type ternaries | 1073-1143, 1550-1605 | 20 | Low |
| Generate event/hub functions | 762-887 | 50 | Medium |

### Marketing.tsx (205 LOC reduction possible)

| Finding | Lines | Reduction | Risk |
|---------|-------|-----------|------|
| Triplicate sorting logic | 140-285 | 60 | Low |
| Bulk operation patterns | 329-443 | 60 | Medium |
| Table header patterns | 1005-1373 | 40 | Medium |
| Auto-refresh effect | 546-587 | 35 | Low |
| Label/color mappings | 51-83 | 10 | Low |

### Invoicing.tsx (90 LOC reduction possible)

| Finding | Lines | Reduction | Risk |
|---------|-------|-----------|------|
| Custom SortableHeader | 91-118 | 25 | Low |
| Handler factory pattern | 303-372 | 40 | Medium |
| Shared constants | 45-74 | 15 | Low |
| Inline format helpers | 418-441 | 10 | Low |

### CommandCenter.tsx (130 LOC reduction possible)

| Finding | Lines | Reduction | Risk |
|---------|-------|-----------|------|
| **Split 310-line queryFn** | 83-392 | 100+ | **High** |
| Move inline types | 239-270 | 10 | Low |
| StatCard component | 606-656 | 20 | Low |

---

## Patterns Observed

| Pattern | Occurrences | Impact |
|---------|-------------|--------|
| Silent catch blocks | 3 locations | Users unaware of failures |
| Missing query error states | 5+ queries | Silent data failures |
| Duplicate selection logic | 3 files | Maintenance burden |
| Duplicate SERVICE_COLORS | 2 files | DRY violation |
| No Supabase error checking | 18 queries | Incorrect dashboard metrics |
| Custom modal without accessibility | 1 modal | A11y issues |

---

## Total Simplification Potential

| Category | LOC Reduction | Files Affected |
|----------|---------------|----------------|
| Cross-file hooks/components | 225+ | 3 |
| GenerateDraftsModal | 230 | 1 |
| Marketing | 205 | 1 |
| Invoicing | 90 | 1 |
| CommandCenter | 130 | 1 |
| **Total** | **~850-900** | **4** |

This represents approximately **18-20% reduction** across Phase 2 files.

---

## Priority Fix Order

1. **CommandCenter error checking** - Business-critical metrics
2. **Marketing silent catch** - User data freshness
3. **PayrollRunDetail notifications** - Teacher communication
4. **GenerateDraftsModal AccessibleModal** - Accessibility compliance
5. **GenerateDraftsModal error states** - Invoice data integrity
6. **Extract useSelectionState hook** - Biggest code reuse opportunity
7. **Extract SERVICE_COLORS constant** - Quick DRY win

---

## Next Steps

- [ ] Fix CommandCenter error checking (Critical)
- [ ] Fix silent catch blocks (Critical)
- [ ] Refactor GenerateDraftsModal to use AccessibleModal (Important)
- [ ] Extract shared hooks and constants (Simplification)
- [ ] Proceed to Phase 3: Money & Date Utilities audit
