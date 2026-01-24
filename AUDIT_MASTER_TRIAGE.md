# Master Triage List - Codebase Audit

**Audit Completed:** All 7 phases
**Total Files Analyzed:** 88 files (~49K LOC)
**Total Issues Found:** 65+

---

## Executive Summary

| Severity | Count | Primary Patterns |
|----------|-------|------------------|
| **Critical** | 18 | Money arithmetic, timezone bugs, silent failures |
| **Important** | 22 | Missing error handling, accessibility, console statements |
| **Suggestions** | 25+ | Code simplification, DRY opportunities |

**Estimated LOC Reduction from Simplifications:** ~2,500+ lines

---

## CRITICAL ISSUES (Must Fix Immediately)

### Financial Calculation Bugs (3 issues)
| File | Line | Issue | Impact |
|------|------|-------|--------|
| hooks.ts | 4326, 4439 | Direct `+` for money | Payroll calculation errors |
| AddManualLineItemModal.tsx | 88 | Direct `h * r` multiplication | Invoice line item errors |
| EnrollmentDetailPanel.tsx | 556-573 | Direct money arithmetic | Display margin errors |

### Timezone Bugs (4 issues)
| File | Line | Issue | Impact |
|------|------|-------|--------|
| validation.ts | 81-83 | `new Date()` in isValidDateString | Validation inconsistency |
| validation.ts | 88-94 | `new Date()` in isValidDateRange | Range validation bugs |
| ActiveRoster.tsx | 127-129 | `toISOString()` usage | Filter date shift |
| TeacherDetailPanel.tsx | 805-823 | `new Date()` in formatDate | Display date shift |

### Silent Failures - External APIs (4 issues)
| File | Line | Issue | Impact |
|------|------|-------|--------|
| gmail.ts | 17-77 | No try-catch, no timeout | Users see cryptic errors |
| invoicePdf.ts | 50-328 | Zero error handling | Download fails silently |
| Marketing.tsx | 576-577 | Silent catch on Mailchimp | Stale data, no feedback |
| PayrollRunDetail.tsx | 504-506 | Silent notification failure | Teachers don't get emails |

### Missing Query Error Handling (3 issues)
| File | Line | Issue | Impact |
|------|------|-------|--------|
| CommandCenter.tsx | 80-393 | 18 queries, no error checks | Incorrect dashboard metrics |
| hooks.ts | 2447-2449 | Unchecked event_orders update | Duplicate invoicing risk |
| hooks.ts | 2637-2639 | Unchecked calendly_bookings | Data inconsistency |

### Missing Dashboard Invalidation (4 issues)
| File | Line | Mutation |
|------|------|----------|
| hooks.ts | 2477-2481 | generateDrafts |
| hooks.ts | 2563-2568 | generateEventInvoice |
| hooks.ts | 2643-2648 | generateHubInvoice |
| hooks.ts | 603-606 | updateFamily (status change) |

---

## IMPORTANT ISSUES (Should Fix Soon)

### CLAUDE.md Violations (8 issues)
| File | Line | Issue |
|------|------|-------|
| gmail.ts | 11 | Hardcoded N8N URL |
| mailchimp.ts | 88, 93 | console.error in production |
| CheckinForm.tsx | 87, 96, 104, 775 | console.error (4 locations) |
| Settings.tsx | 205, 237 | console.error (2 locations) |
| GenerateDraftsModal.tsx | 911+ | Not using AccessibleModal |
| RecordTeacherPaymentModal.tsx | 186+ | Not using AccessibleModal |
| ImportHistoricalInvoiceModal.tsx | 202+ | Not using AccessibleModal |
| RecordTeacherPaymentModal.tsx | 69-74 | Duplicate formatDateLocal |

### Missing Error States (5 issues)
| File | Issue |
|------|-------|
| GenerateDraftsModal.tsx | Query errors not displayed |
| CommandCenter.tsx | Generic error, no retry button |
| SmsComposeModal.tsx | Silent template generation failure |
| gmail.ts | Response `error` field never checked |
| smsTemplates.ts | No input validation on generateMessage |

### Type Safety Issues (6 issues)
| File | Issue |
|------|-------|
| hooks.ts | Missing TeacherAssignmentInsert type |
| hooks.ts | Missing InvoiceLineItemInsert type |
| hooks.ts | Missing PayrollLineItemInsert type |
| hooks.ts | Family type missing fields from Supabase |
| mailchimp.ts | Unsafe type assertion on response |
| smsTemplates.ts | Unsafe template registry assertion |

### Duplicate Functions (3 issues)
| File | Duplicates |
|------|------------|
| GenerateDraftsModal.tsx:124-130 | formatDate (dateUtils exists) |
| invoicePdf.ts:25-28 | formatCurrency (moneyUtils exists) |
| validation.ts:99 vs phoneUtils.ts:59 | isValidPhone (different behavior) |

---

## SIMPLIFICATION OPPORTUNITIES

### High-Impact Extractions (Est. 1,500+ LOC reduction)

| New Component/Hook | Files Affected | Est. Reduction |
|-------------------|----------------|----------------|
| `useSelectionState` hook | 3 files | 100+ |
| `useBulkMutation` hook | 2 files | 80 |
| `<StatusBadge>` component | 8+ files | 180 |
| `<ChartContainer>` wrapper | Reports.tsx | 120-150 |
| `<FormErrorAlert>` | 26 modals | 40 |
| `<ModalFooter>` | 26 modals | 180 |
| `<InfoRow>` | 5 detail panels | 60-80 |
| `<ContactLink>` | 5 detail panels | 50-70 |
| `<SectionHeader>` | 4 detail panels | 40-50 |
| `formOptions.ts` constants | 6+ files | 100 |
| `chartTheme.ts` constants | Reports.tsx | 15-20 |
| `styles.ts` input classes | 26 modals | 50 |

### Medium-Impact Extractions (Est. 700+ LOC reduction)

| Pattern | Files | Reduction |
|---------|-------|-----------|
| SERVICE_COLORS constant | 2 files | 15 |
| LoadingView/ErrorView | 2+ files | 40 |
| Modal shared behavior hook | 2 files | 30-40 |
| StatCard extraction | 3 files | 40-50 |
| Chart loading/error states | Reports.tsx | 120-150 |

### Structural Improvements

| Component | Recommendation |
|-----------|----------------|
| hooks.ts (7,445 LOC) | Split by domain (families, invoices, payroll, etc.) |
| CommandCenter.tsx | Split 310-line query into focused hooks |
| ActiveRoster.tsx | Extract filter bar, table header, row components |

---

## FIX ORDER BY PRIORITY

### Batch 1: Financial & Data Integrity (Critical)
1. Money arithmetic in hooks.ts (4326, 4439)
2. Money arithmetic in AddManualLineItemModal.tsx
3. Money arithmetic in EnrollmentDetailPanel.tsx
4. Dashboard invalidation (4 mutations)
5. Unchecked event_orders/calendly_bookings updates

### Batch 2: Timezone Bugs (Critical)
6. validation.ts isValidDateString/isValidDateRange
7. ActiveRoster.tsx toISOString
8. TeacherDetailPanel.tsx formatDate

### Batch 3: Error Handling (Critical/Important)
9. gmail.ts error handling
10. invoicePdf.ts try-catch
11. CommandCenter.tsx query error checking
12. Remove console.error statements (6 files)

### Batch 4: Accessibility (Important)
13. GenerateDraftsModal - AccessibleModal
14. RecordTeacherPaymentModal - AccessibleModal
15. ImportHistoricalInvoiceModal - AccessibleModal

### Batch 5: Type Safety (Important)
16. Create missing insert types
17. Fix Family type to include all fields
18. Fix unsafe type assertions

### Batch 6: Code Simplification (Suggestion)
19. Extract StatusBadge
20. Extract formOptions.ts
21. Extract useSelectionState hook
22. Extract ChartContainer
23. Extract ModalFooter
24. Extract InfoRow, ContactLink, SectionHeader

---

## VERIFICATION CHECKLIST

After each batch of fixes:
- [ ] `npm run build` - Must pass with no TypeScript errors
- [ ] `npm run lint` - Must pass with no ESLint errors
- [ ] Manual spot-check of critical fixes
- [ ] Update CLAUDE.md if new patterns discovered

---

## CLAUDE.md UPDATES NEEDED

Based on audit findings, add these to "Common Mistakes to Avoid":

1. **DON'T** forget to add timeout and try-catch to fetch calls for external APIs
2. **DON'T** use `new Date(dateStr)` for YYYY-MM-DD strings - use `parseLocalDate()`
3. **DON'T** let PDF generation fail silently - wrap in try-catch and return result
4. **DON'T** use local Toast components when `useToast()` hook is available
5. **DON'T** duplicate STATUS_COLORS - use shared constants or StatusBadge component

---

## METRICS

| Phase | Files | Critical | Important | Suggestions |
|-------|-------|----------|-----------|-------------|
| 1. Infrastructure | 3 | 9 | 7 | 4 |
| 2. Business Logic | 4 | 3 | 6 | 20+ |
| 3. Utilities | 4 | 2 | 4 | 4 |
| 4. Modals | 26 | 1 | 3 | 10+ |
| 5. UI/Pages | 9 | 3 | 1 | 10+ |
| 6. Detail Panels | 6 | 3 | 2 | 10 |
| 7. Integrations | 4 | 4 | 6 | 3 |
| **Total** | **56** | **25** | **29** | **61+** |

**Individual Reports:**
- `AUDIT_PHASE1_REPORT.md` - Infrastructure
- `AUDIT_PHASE2_REPORT.md` - Business Logic
- `AUDIT_PHASE3_REPORT.md` - Utilities
- `AUDIT_PHASE4_REPORT.md` - Modals
- `AUDIT_PHASE5_REPORT.md` - UI/Pages
- `AUDIT_PHASE6_REPORT.md` - Detail Panels
- `AUDIT_PHASE7_REPORT.md` - Integrations
