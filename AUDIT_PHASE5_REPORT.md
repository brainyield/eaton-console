# Phase 5: UI Components & Pages Audit Report

**Files Analyzed:**
- `src/components/ActiveRoster.tsx` (969 LOC)
- `src/components/Reports.tsx` (976 LOC)
- `src/components/CheckinForm.tsx` (914 LOC)
- `src/components/Settings.tsx` (718 LOC)
- `src/components/ui/*.tsx` (5 files, 733 LOC)

**Agents Used:** code-reviewer, code-simplifier

---

## Critical Issues (Must Fix)

### 1. Date Timezone Bug - toISOString() Usage
**File:** `src/components/ActiveRoster.tsx:127-129`
**Agent:** code-reviewer

```typescript
const monthStart = useMemo(() => {
  if (!newThisMonth) return undefined
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()  // BUG
}, [newThisMonth])
```

**CLAUDE.md Violation:** Should use `formatDateLocal()` instead of `toISOString()`.
**Fix:**
```typescript
import { formatDateLocal } from '@/lib/dateUtils'
return formatDateLocal(new Date(now.getFullYear(), now.getMonth(), 1))
```

---

### 2. console.error Statements in CheckinForm
**File:** `src/components/CheckinForm.tsx:87, 96, 104, 775`
**Agent:** code-reviewer

Four `console.error` statements in committed code.
**CLAUDE.md Violation:** "DON'T use console.log in committed code"
**Fix:** Remove or replace with proper error handling.

---

### 3. console.error Statements in Settings
**File:** `src/components/Settings.tsx:205, 237`
**Agent:** code-reviewer

Two `console.error` statements.
**Fix:** Remove console statements.

---

## Important Issues (Should Fix)

### 4. Settings Uses Local Toast Instead of useToast
**File:** `src/components/Settings.tsx:66-83`
**Agent:** code-simplifier

Defines its own `Toast` component despite `useToast()` hook available globally.
**Fix:** Remove local Toast, use `useToast()` hook.
**LOC Reduction:** ~25-30 lines

---

## Simplification Opportunities

### High Priority

| Pattern | Files | LOC Reduction | Risk |
|---------|-------|---------------|------|
| **Duplicate STATUS_COLORS** | 8+ files | 80-100 | Low |
| **Chart loading/error states** | Reports.tsx (6x) | 120-150 | Low |
| **Tooltip styling constants** | Reports.tsx | 15-20 | Low |
| **Local Toast component** | Settings.tsx | 25-30 | Low |

### Medium Priority

| Pattern | Files | LOC Reduction | Risk |
|---------|-------|---------------|------|
| ActiveRoster sorting vs useSortState | ActiveRoster.tsx | 30-40 | Medium |
| LoadingView/ErrorView duplication | CheckinForm, TeacherDesk | 40 | Low |
| Modal shared behavior hook | ui/*.tsx | 30-40 | Low |
| Summary cards extraction | Reports.tsx | 20-25 | Low |

### Total Potential LOC Reduction: ~360-445 lines

---

## Detailed Findings

### Duplicate STATUS_COLORS Pattern (80-100 LOC)

**Found in:**
- ActiveRoster.tsx (lines 100-105)
- Directory.tsx (lines 28-33)
- FamilyDetailPanel.tsx (lines 24-46)
- EnrollmentDetailPanel.tsx (lines 123-128)
- Events.tsx, EventDetailPanel.tsx
- LinkHubBookingsModal.tsx, LinkEventOrdersModal.tsx

**Recommendation:** Create `<StatusBadge variant="enrollment|family|invoice" />` in `src/components/ui/`.

---

### Chart Loading/Error States (120-150 LOC)

**Location:** Reports.tsx - 6 identical patterns

```tsx
{loading ? (
  <div className="h-64 flex items-center justify-center">
    <RefreshCw className="animate-spin" />
  </div>
) : error ? (
  <div className="h-64 flex items-center justify-center text-red-400">...</div>
) : data.length === 0 ? (
  <div>No data</div>
) : (
  <Chart ... />
)}
```

**Recommendation:** Create `<ChartContainer loading error isEmpty>` wrapper.

---

### Tooltip Styling (15-20 LOC)

**Location:** Reports.tsx - repeated 7 times

```tsx
const tooltipStyle = { backgroundColor: '#1f2937', border: '...' }
const tooltipItemStyle = { color: '#e5e7eb' }
const tooltipLabelStyle = { color: '#9ca3af' }
```

**Recommendation:** Export from `src/lib/chartTheme.ts`.

---

### Modal Shared Behavior (30-40 LOC)

**Files:** AccessibleModal.tsx, AccessibleSlidePanel.tsx

Both have identical:
- Escape key handling
- Trigger ref tracking
- Focus return on close

**Recommendation:** Extract `useDialogBehavior()` hook.

---

## Verified Correct Patterns

| Check | Status | Notes |
|-------|--------|-------|
| Recharts tooltip dark mode styling | ✅ | Reports.tsx includes all three style props |
| dateUtils usage | ✅ | formatDateLocal, parseLocalDate used correctly |
| Age group sorting | ✅ | Uses getAgeGroupSortValue() |
| ARIA attributes | ✅ | All UI components have proper ARIA |
| Keyboard navigation | ✅ | Present in modals and tables |
| useEffect cleanup | ✅ | Event listeners properly cleaned up |
| Hook dependencies | ✅ | useEffect/useMemo correct |

---

## Recommended New Files

### 1. `src/components/ui/StatusBadge.tsx`
Consolidates all status color mappings.

### 2. `src/components/ui/ChartContainer.tsx`
Handles loading/error/empty states for Recharts.

### 3. `src/lib/chartTheme.ts`
```tsx
export const DARK_TOOLTIP = {
  contentStyle: { backgroundColor: '#1f2937', ... },
  itemStyle: { color: '#e5e7eb' },
  labelStyle: { color: '#9ca3af' }
}
```

### 4. `src/components/ui/index.ts`
Barrel export for cleaner imports.

---

## Priority Fix Order

1. **ActiveRoster toISOString bug** - Critical CLAUDE.md violation
2. **Remove console.error statements** - 6 locations
3. **Settings Toast cleanup** - Quick win
4. **Chart tooltip theme extraction** - Quick win
5. **StatusBadge consolidation** - High impact
6. **ChartContainer wrapper** - High impact

---

## Next Steps

- [ ] Fix ActiveRoster date timezone bug
- [ ] Remove console.error statements
- [ ] Extract chart theme constants
- [ ] Proceed to Phase 6: Detail Panels audit
