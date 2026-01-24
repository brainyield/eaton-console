# Phase 4: Modal Components Audit Report

**Files Analyzed:** 26 modal components
**Agents Used:** code-reviewer, code-simplifier

---

## Critical Issues (Must Fix)

### 1. Money Calculation Bug - Direct Multiplication
**File:** `src/components/AddManualLineItemModal.tsx:88`
**Agent:** code-reviewer

```typescript
// Current code - BUG
return h * r  // Floating point errors possible

// Should be:
return multiplyMoney(h, r)
```

**CLAUDE.md Violation:** "DON'T do direct multiplication/division with money"
**Impact:** Floating-point precision errors in invoice line item amounts.

---

## Important Issues (Should Fix)

### 2. Missing AccessibleModal - RecordTeacherPaymentModal
**File:** `src/components/RecordTeacherPaymentModal.tsx:186-391`
**Agent:** code-reviewer

Uses custom `<div>` modal structure without:
- Focus trap
- Escape key handling
- ARIA attributes

**Fix:** Refactor to use `AccessibleModal` wrapper.

---

### 3. Missing AccessibleModal - ImportHistoricalInvoiceModal
**File:** `src/components/ImportHistoricalInvoiceModal.tsx:202-641`
**Agent:** code-reviewer

Same accessibility issues as above.

---

### 4. Duplicate formatDateLocal Function
**File:** `src/components/RecordTeacherPaymentModal.tsx:69-74`
**Agent:** code-reviewer

```typescript
const formatDateLocal = (date: Date): string => {
  // Duplicates dateUtils.ts
}
```

**Fix:** Import from `@/lib/dateUtils` instead of duplicating.

---

## Modal Quality Summary

| Aspect | Status | Details |
|--------|--------|---------|
| AccessibleModal usage | 23/26 ✅ | 3 modals need migration |
| Double-submit prevention | 26/26 ✅ | All use `isPending`/`isSubmitting` |
| Error states displayed | 26/26 ✅ | All show errors to users |
| Query invalidation | 26/26 ✅ | All invalidate on success |
| Nullable field handling | 26/26 ✅ | All use `\|\| null` pattern |

---

## Simplification Opportunities

### High Priority Extractions

| Pattern | Files | LOC Reduction | Complexity |
|---------|-------|---------------|------------|
| **FormErrorAlert** | 26 | ~40 | Low |
| **ModalFooter** | 26 | ~180 | Medium |
| **Form options constants** | 6+ | ~100 | Low |

### Medium Priority Extractions

| Pattern | Files | LOC Reduction | Complexity |
|---------|-------|---------------|------------|
| **FormField wrapper** | 22+ | ~300 | Medium |
| **CurrencyInput** | 10+ | ~40 | Medium |
| **Input styling constants** | 26 | ~50 | Low |

### Total Estimated LOC Reduction: ~725 lines

---

## Repeated Patterns Identified

### 1. Error Alert Display (~40 LOC to save)
```tsx
{error && (
  <div role="alert" className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-2 rounded">
    {error}
  </div>
)}
```
**Recommendation:** Create `<FormErrorAlert message={error} />`

### 2. Modal Footer (~180 LOC to save)
```tsx
<div className="flex justify-end gap-2 pt-4 border-t border-zinc-700">
  <button type="button" onClick={onClose}>Cancel</button>
  <button type="submit" disabled={isPending}>
    {isPending ? 'Saving...' : 'Save'}
  </button>
</div>
```
**Recommendation:** Create `<ModalFooter>` with variant props.

### 3. Duplicated Option Arrays (~100 LOC to save)
**Found in multiple files:**
- `CUSTOMER_STATUS_OPTIONS` - 3 files
- `EMPLOYEE_STATUS_OPTIONS` - 2 files
- `gradeOptions` - 2 files
- `TEACHER_ROLE_OPTIONS` - 2 files
- `PAYMENT_METHOD_OPTIONS` - 2 files
- `CONTACT_METHOD_OPTIONS` - 2 files

**Recommendation:** Create `src/lib/formOptions.ts` with shared constants.

### 4. Input Styling Classes (~80 occurrences)
```tsx
className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
```
**Inconsistencies:**
- `rounded` vs `rounded-lg`
- `text-white` vs `text-zinc-100`
- `focus:ring-1` present in some, missing in others

**Recommendation:** Create `src/lib/styles.ts` with input class constants.

### 5. Form Field Pattern (~300 LOC to save)
```tsx
<div>
  <label htmlFor="x" className="block text-sm font-medium text-zinc-400 mb-1">
    Label *
  </label>
  <input id="x" ... />
</div>
```
**Recommendation:** Create `<FormField>` wrapper component.

---

## Recommended New Files

### 1. `src/components/ui/FormErrorAlert.tsx` (~20 lines)
```tsx
interface FormErrorAlertProps {
  message: string | null | undefined
}
export function FormErrorAlert({ message }: FormErrorAlertProps)
```

### 2. `src/components/ui/ModalFooter.tsx` (~50 lines)
```tsx
interface ModalFooterProps {
  onCancel: () => void
  submitLabel?: string
  pendingLabel?: string
  isPending?: boolean
  submitVariant?: 'primary' | 'success' | 'danger'
  leftContent?: ReactNode
}
```

### 3. `src/lib/formOptions.ts` (~80 lines)
```tsx
export const CUSTOMER_STATUS_OPTIONS = [...]
export const EMPLOYEE_STATUS_OPTIONS = [...]
export const GRADE_LEVEL_OPTIONS = [...]
export const TEACHER_ROLE_OPTIONS = [...]
export const PAYMENT_METHOD_OPTIONS = [...]
```

### 4. `src/lib/styles.ts` (~20 lines)
```tsx
export const inputClasses = "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white..."
export const selectClasses = inputClasses
```

---

## Priority Fix Order

1. **AddManualLineItemModal money bug** - Critical financial calculation
2. **RecordTeacherPaymentModal AccessibleModal** - Accessibility
3. **ImportHistoricalInvoiceModal AccessibleModal** - Accessibility
4. **Remove duplicate formatDateLocal** - Code cleanliness
5. **Create formOptions.ts** - Quick DRY win
6. **Create FormErrorAlert** - Simple extraction
7. **Create ModalFooter** - High-impact extraction

---

## Patterns NOT Recommended for Extraction

| Pattern | Reason |
|---------|--------|
| Form submission handlers | Too much variation in business logic |
| Form state management | Each form has unique shape |
| Validation logic | Already in `validation.ts` |

---

## Next Steps

- [ ] Fix AddManualLineItemModal money calculation
- [ ] Migrate 3 modals to AccessibleModal
- [ ] Create formOptions.ts constants
- [ ] Proceed to Phase 5: UI Components & Pages audit
