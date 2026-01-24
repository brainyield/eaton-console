# Phase 6: Detail Panels Audit Report

**Files Analyzed:**
- `src/components/TeacherDetailPanel.tsx`
- `src/components/InvoiceDetailPanel.tsx`
- `src/components/EnrollmentDetailPanel.tsx`
- `src/components/LeadDetailPanel.tsx`
- `src/components/FamilyDetailPanel.tsx`
- `src/components/EventDetailPanel.tsx`

**Agents Used:** code-reviewer, code-simplifier

---

## Critical Issues (Must Fix)

### 1. Timezone Bug in Date Formatting
**File:** `src/components/TeacherDetailPanel.tsx:805-823`
**Agent:** code-reviewer

```typescript
function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)  // BUG: timezone issue for YYYY-MM-DD
  return date.toLocaleDateString(...)
}
```

**CLAUDE.md Violation:** Same principle as "DON'T use toISOString().split('T')" - using `new Date()` on date strings causes timezone bugs.
**Fix:** Use `parseLocalDate()` from dateUtils.

---

### 2. Money Calculation Without Safe Math
**File:** `src/components/EnrollmentDetailPanel.tsx:556-558`
**Agent:** code-reviewer

```typescript
${(activeAssignment.hourly_rate_teacher || 0) * (activeAssignment.hours_per_week || 0)}
```

**CLAUDE.md Violation:** "DON'T do direct multiplication/division with money"
**Fix:** Use `multiplyMoney(hourly_rate, hours)`.

---

### 3. Money Margin Calculation Without Safe Math
**File:** `src/components/EnrollmentDetailPanel.tsx:571-573`
**Agent:** code-reviewer

```typescript
${((enrollment.hourly_rate_customer - activeAssignment.hourly_rate_teacher) * enrollment.hours_per_week).toFixed(2)}
```

**Fix:** Use `multiplyMoney(subtractMoney(rate1, rate2), hours)`.

---

## Important Issues (Should Fix)

### 4. Money Display Without formatCurrency
**File:** `src/components/FamilyDetailPanel.tsx:388-395, 443-444, 460-464`
**Agent:** code-reviewer

Using template literals `${value}` instead of `formatCurrency()` for consistency.

---

### 5. No AccessibleSlidePanel Usage
**Files:** All 6 detail panels
**Agent:** code-reviewer

Panels implement their own backdrop/close logic without:
- Focus trap
- ARIA attributes
- Return focus on close

**Note:** CLAUDE.md doesn't explicitly require this for panels (only modals), but it's an accessibility improvement opportunity.

---

## Simplification Opportunities

### Total Potential LOC Reduction: 470-625 lines

| Pattern | Files | LOC Reduction | Complexity |
|---------|-------|---------------|------------|
| **Panel Container** | 6 | 60-80 | Low |
| **Panel Header** | 6 | 40-60 | Medium |
| **Contact Info Links** | 5 | 50-70 | Low |
| **Tab Navigation** | 3 | 30-45 | Low |
| **Status Badges** | 5 | 80-100 | Medium |
| **Loading/Empty States** | 6 | 40-50 | Low |
| **Section Headers** | 4 | 40-50 | Low |
| **Info Row Display** | 5 | 60-80 | Low |
| **Action Buttons** | 5 | 30-40 | Low |
| **Stats Cards** | 3 | 40-50 | Low |

---

## Detailed Patterns Found

### 1. Contact Info Links (50-70 LOC)
```tsx
<a href={`mailto:${email}`} className="flex items-center gap-2 text-zinc-400 hover:text-white">
  <Mail className="h-4 w-4" />
  {email}
</a>
```
**Recommendation:** Create `<ContactLink type="email|phone" value={v} />`

### 2. Info Row Display (60-80 LOC)
```tsx
<div className="flex items-center justify-between text-sm">
  <span className="text-zinc-400">Label</span>
  <span className="text-white">{value}</span>
</div>
```
**Recommendation:** Create `<InfoRow label="x" value={v} />`

### 3. Section Headers (40-50 LOC)
```tsx
<div className="flex items-center justify-between mb-3">
  <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Title</h3>
  <button className="text-blue-400 hover:text-blue-300">
    <Plus /> Add
  </button>
</div>
```
**Recommendation:** Create `<SectionHeader title="x" action={<button>} />`

### 4. Status Badges (80-100 LOC)
```tsx
const STATUS_COLORS: Record<Status, string> = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  // ... duplicated in 5 files
}
```
**Recommendation:** Unify into `<StatusBadge variant="enrollment|lead|invoice" status={s} />`

### 5. Loading/Empty States (40-50 LOC)
```tsx
// Loading
<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />

// Empty
<p className="text-sm text-zinc-400 text-center py-8">No data found</p>
```
**Recommendation:** Create `<LoadingSpinner />` and `<EmptyState message="x" />`

---

## Recommended New Components

### 1. `src/components/ui/ContactLink.tsx`
```tsx
interface ContactLinkProps {
  type: 'email' | 'phone'
  value: string
  label?: string
}
```

### 2. `src/components/ui/InfoRow.tsx`
```tsx
interface InfoRowProps {
  label: string
  value: React.ReactNode
  valueClassName?: string
}
```

### 3. `src/components/ui/SectionHeader.tsx`
```tsx
interface SectionHeaderProps {
  title: string
  count?: number
  action?: React.ReactNode
}
```

### 4. `src/components/ui/StatusBadge.tsx`
Already have `SmsStatusBadge` - extend pattern to cover all entity statuses.

### 5. `src/components/ui/StatCard.tsx`
```tsx
// Already exists in TeacherDetailPanel - extract to ui/
interface StatCardProps {
  label: string
  value: string | number
  sublabel?: string
  icon?: LucideIcon
}
```

---

## Code Quality Summary

**Well-implemented:**
- Proper loading states with skeletons
- Null checks with optional chaining
- Correct React Query hook usage
- InvoiceDetailPanel uses `parseLocalDate()` correctly
- EnrollmentDetailPanel imports `parseLocalDate()` correctly

**Issues:**
- TeacherDetailPanel: Own date formatting with timezone bug
- EnrollmentDetailPanel: Direct money arithmetic

---

## Priority Fix Order

1. **TeacherDetailPanel formatDate bug** - Critical timezone issue
2. **EnrollmentDetailPanel money calculations** - Financial correctness
3. **Extract StatusBadge** - Highest duplication (5 files)
4. **Extract InfoRow** - High duplication (5 files)
5. **Extract ContactLink** - High duplication (5 files)
6. **Extract SectionHeader** - Medium duplication (4 files)

---

## Next Steps

- [ ] Fix TeacherDetailPanel date formatting
- [ ] Fix EnrollmentDetailPanel money calculations
- [ ] Extract shared components
- [ ] Proceed to Phase 7: Integration Utilities audit
