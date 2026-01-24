# Phase 3: Money & Date Utilities Audit Report

**Files Analyzed:**
- `src/lib/moneyUtils.ts` (172 LOC) - Money calculations
- `src/lib/dateUtils.ts` (152 LOC) - Date handling
- `src/lib/validation.ts` (149 LOC) - Input validation
- `src/lib/phoneUtils.ts` (74 LOC) - Phone formatting

**Agents Used:** code-reviewer, type-design-analyzer

---

## Critical Issues (Must Fix)

### 1. validation.ts - Timezone Bug in isValidDateString()
**File:** `src/lib/validation.ts:81-83`
**Agent:** code-reviewer

```typescript
export function isValidDateString(dateStr: string): boolean {
  if (!dateStr) return false
  const date = new Date(dateStr)  // WRONG: parses YYYY-MM-DD as UTC
  return !Number.isNaN(date.getTime())
}
```

**CLAUDE.md Violation:** Same principle as "DON'T use toISOString().split('T')[0]" - using `new Date()` on date strings causes timezone bugs.
**Impact:** Date validation may produce inconsistent results across timezones.
**Fix:** Use regex validation or `parseLocalDate()`:
```typescript
export function isValidDateString(dateStr: string): boolean {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}
```

---

### 2. validation.ts - Timezone Bug in isValidDateRange()
**File:** `src/lib/validation.ts:88-94`
**Agent:** code-reviewer

```typescript
export function isValidDateRange(startDate: string, endDate: string): boolean {
  const start = new Date(startDate)  // WRONG: parses as UTC
  const end = new Date(endDate)      // WRONG: parses as UTC
```

**Fix:** Import and use `parseLocalDate()` from dateUtils.ts.

---

## Important Issues (Should Fix)

### 3. Duplicate isValidPhone with Different Semantics
**Files:** `validation.ts:99` vs `phoneUtils.ts:59`
**Agent:** type-design-analyzer

| File | Empty Input | Implementation |
|------|-------------|----------------|
| validation.ts | Returns `true` (optional field) | Digit count check |
| phoneUtils.ts | Returns `false` | Full normalization check |

**Impact:** Inconsistent validation behavior depending on which function is used.
**Fix:** Consolidate to single source of truth; re-export if needed.

---

### 4. "Positive" Functions Allow Zero
**File:** `src/lib/validation.ts:28-33, 39-44`
**Agent:** type-design-analyzer

```typescript
export function parsePositiveFloat(value: string): number | null {
  if (Number.isNaN(num) || num < 0) return null  // < 0, not <= 0
```

**Issue:** Function named "positive" but allows zero (which is not positive).
**Fix:** Either rename to `parseNonNegativeFloat` or change to `num <= 0`.

---

### 5. Missing Type Guards for Validation Functions
**Files:** All validation files
**Agent:** type-design-analyzer

```typescript
// Current - returns boolean, no type narrowing
export function isValidEmail(email: string): boolean

// Better - type guard enables narrowing
export function isValidEmail(email: string): email is ValidEmail
```

**Impact:** Callers can't benefit from TypeScript's type narrowing after validation.

---

### 6. parseLocalDate Doesn't Validate Input
**File:** `src/lib/dateUtils.ts:39-42`
**Agent:** type-design-analyzer

```typescript
export function parseLocalDate(dateStr: string): Date
```

**Issue:** If input is malformed (e.g., "not-a-date"), returns invalid Date silently.
**Fix:** Return `Date | null` with validation, or throw on invalid input.

---

## Suggestions (Nice to Have)

### 7. No Branded Types for Money
**File:** `src/lib/moneyUtils.ts`
**Agent:** type-design-analyzer

```typescript
// Current - both are just number
function dollarsToCents(dollars: number): number

// Better - compile-time unit safety
type Dollars = number & { __brand: 'dollars' }
type Cents = number & { __brand: 'cents' }
function dollarsToCents(dollars: Dollars): Cents
```

**Impact:** No compile-time protection against mixing dollars and cents.

---

### 8. No Branded Type for E.164 Phone
**File:** `src/lib/phoneUtils.ts:18`
**Agent:** type-design-analyzer

```typescript
// Current - returns generic string
export function normalizePhone(phone: string): string | null

// Better - distinguish normalized from raw
type E164Phone = string & { __brand: 'E164Phone' }
export function normalizePhone(phone: string): E164Phone | null
```

---

### 9. formatMoneyValue Missing Thousands Separator
**File:** `src/lib/moneyUtils.ts:96`
**Agent:** code-reviewer

```typescript
return amount.toFixed(2)  // Returns "1234.56" not "1,234.56"
```

**Note:** May be intentional for input fields. Consider adding parameter or documenting.

---

### 10. Email Regex Allows Invalid Characters
**File:** `src/lib/validation.ts:7`
**Agent:** code-reviewer

```typescript
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
```

**Issue:** Allows `<script>@example.com`, quotes, consecutive dots.
**Impact:** Low - email servers reject truly invalid addresses.

---

## Files Passing Review

| File | Status | Notes |
|------|--------|-------|
| moneyUtils.ts | ✅ PASS | Floating-point handling correct, rounding accurate |
| dateUtils.ts | ✅ PASS | Timezone handling correct, DST handled properly |
| phoneUtils.ts | ✅ PASS | E.164 normalization correct, validation proper |

---

## Type Safety Summary

| File | Encapsulation | Invariant Expression | Usefulness | Enforcement |
|------|--------------|---------------------|------------|-------------|
| moneyUtils.ts | 3/10 | 4/10 | 8/10 | 5/10 |
| dateUtils.ts | 4/10 | 5/10 | 9/10 | 4/10 |
| validation.ts | 5/10 | 6/10 | 7/10 | 6/10 |
| phoneUtils.ts | 5/10 | 6/10 | 9/10 | 7/10 |

**Primary Issue:** Lack of branded/nominal types means compile-time can't distinguish:
- Dollars from cents
- Normalized phone from raw input
- Valid email from unvalidated string
- Date string from arbitrary string

---

## Priority Fix Order

1. **Timezone bugs in validation.ts** (Critical - CLAUDE.md violation)
2. **Consolidate duplicate isValidPhone** (Important - behavior inconsistency)
3. **Rename "positive" functions** (Important - semantic correctness)
4. **Add validation to parseLocalDate** (Important - error handling)
5. **Convert validators to type guards** (Suggestion - type safety)
6. **Add branded types** (Suggestion - compile-time safety)

---

## Next Steps

- [ ] Fix timezone bugs in validation.ts
- [ ] Consolidate isValidPhone implementations
- [ ] Proceed to Phase 4: Modal Components audit
