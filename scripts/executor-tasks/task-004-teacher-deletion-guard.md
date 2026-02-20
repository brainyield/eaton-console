You are an executor agent. Follow these instructions EXACTLY. Do not improvise or add features beyond what is specified. After making changes, run `npm run build` and `npm run lint` to verify.

# Task: Add batch payroll check to teacher deletion guard

## Problem

`EditTeacherModal.tsx` checks `useTeacherPaymentsByTeacher` (legacy Sep-Dec 2025 payroll) before allowing teacher deletion, but does NOT check `payroll_line_item` (batch payroll system, Jan 2026+). A teacher with batch payroll records could be deleted, orphaning their payroll line items.

## Current code (EditTeacherModal.tsx)

The modal currently:
- Line 43: Calls `useTeacherPaymentsByTeacher(teacher?.id || '', { enabled: !!teacher })` to get legacy payments
- Lines 46-59: Computes `validationCounts` with `payments: payments?.length || 0`
- Line 175: Sets `canDelete = validationCounts.total === 0` (only checks active assignments, not payments)
- Lines 164-172: The delete handler catches PostgreSQL FK error (23503) as a fallback

The delete confirmation message (lines 177-185):
- Shows payment count warning if `validationCounts.payments > 0`
- But does NOT block deletion based on payments — only warns

## Existing hook (already in hooks.ts)

`usePayrollLineItemsByTeacher(teacherId, options?)` at line ~4250 already exists and fetches batch payroll line items. It returns `TeacherPayrollLineItem[]`.

## Exact changes required

### 1. Edit `src/components/EditTeacherModal.tsx`

Add the import and hook call. Find where `useTeacherPaymentsByTeacher` is called (around line 43) and add right after it:

```typescript
const { data: batchPayrollItems } = usePayrollLineItemsByTeacher(teacher?.id || '', { enabled: !!teacher })
```

Make sure `usePayrollLineItemsByTeacher` is imported from `@/lib/hooks` (it should already be exported — verify this).

### 2. Update validationCounts

Find the `validationCounts` useMemo (around lines 46-59). It currently has a `payments` field. Change it to include batch payroll:

Replace the `payments` line:
```typescript
payments: payments?.length || 0,
```

With:
```typescript
legacyPayments: payments?.length || 0,
batchPayrollItems: batchPayrollItems?.length || 0,
payments: (payments?.length || 0) + (batchPayrollItems?.length || 0),
```

Add `batchPayrollItems` to the useMemo dependency array.

### 3. Update the delete confirmation message

Find the section that displays the payment warning (around lines 177-185). It currently says something like "This will permanently delete [Name] and X payment record(s)."

Update the message to distinguish between legacy and batch payroll:
- If both legacy and batch exist: "This will permanently delete [Name] and their payment history (X legacy payment(s) and Y batch payroll record(s))."
- If only legacy: "This will permanently delete [Name] and X legacy payment record(s)."
- If only batch: "This will permanently delete [Name] and Y batch payroll record(s)."

### 4. Block deletion if payroll records exist

Currently `canDelete` only checks active assignments. Change the deletion logic so that if `validationCounts.payments > 0`, the delete button is disabled with a message explaining that teachers with payroll history cannot be deleted — they should be deactivated instead.

Update `canDelete`:
```typescript
const canDelete = validationCounts.total === 0 && validationCounts.payments === 0
```

Update the cannot-delete message to cover both cases:
- Active assignments: "Cannot delete — has X active assignment(s). End or transfer all active assignments first."
- Payroll records: "Cannot delete — has payroll history. Deactivate this teacher instead."
- Both: Show both messages.

### 5. Update INTERFACES.md

Search for "EditTeacherModal" in INTERFACES.md. Add a note that deletion is now blocked when the teacher has records in EITHER `teacher_payments` (legacy) OR `payroll_line_item` (batch). This guards against orphaned payroll records.

### 6. Update optimization-roadmap.md

Find item #4 in the tracking table and change its status from "Not started" to "Complete" and add today's date (2026-02-20).

### 7. Verify

Run `npm run build` and `npm run lint`. Report results.
