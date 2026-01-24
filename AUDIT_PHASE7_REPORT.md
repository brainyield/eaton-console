# Phase 7: Integration Utilities Audit Report

**Files Analyzed:**
- `src/lib/mailchimp.ts` (275 LOC) - Mailchimp integration
- `src/lib/gmail.ts` (77 LOC) - Gmail via n8n webhooks
- `src/lib/invoicePdf.ts` (328 LOC) - PDF generation
- `src/lib/smsTemplates.ts` (192 LOC) - SMS template handling

**Agents Used:** silent-failure-hunter, code-reviewer

---

## Critical Issues (Must Fix)

### 1. Gmail API - Zero Error Handling
**File:** `src/lib/gmail.ts:17-77` (all 3 functions)
**Agent:** silent-failure-hunter

```typescript
// NO TRY-CATCH
const response = await fetch(`${N8N_BASE_URL}/gmail-search`, {...})
// NO TIMEOUT - could hang indefinitely
// NO RESPONSE VALIDATION
const data = await response.json()
return data as GmailSearchResponse  // Blind type assertion
```

**Hidden errors:**
- `TypeError: Failed to fetch` (network offline)
- `SyntaxError` (n8n returns HTML error page)
- Timeout never fires - user waits forever
- `error` field in response never checked

**Fix:** Add try-catch, timeout, response validation.

---

### 2. Invoice PDF - Zero Error Handling
**File:** `src/lib/invoicePdf.ts:50-328`
**Agent:** silent-failure-hunter

```typescript
// Called directly from click handler with no error handling
export function generateInvoicePdf(invoice: InvoiceWithDetails): void {
  const doc = new jsPDF({...})  // Could throw
  // ... 270+ lines ...
  doc.save(filename)  // Could fail: popup blocked, disk full
}
```

**Impact:** User clicks "Download PDF", nothing happens, no error message.
**Fix:** Wrap in try-catch, return result object `{ success, error }`.

---

### 3. Hardcoded External URL
**File:** `src/lib/gmail.ts:11`
**Agent:** code-reviewer

```typescript
const N8N_BASE_URL = 'https://eatonacademic.app.n8n.cloud/webhook'
```

**CLAUDE.md:** Should use environment variables.
**Fix:** `const N8N_BASE_URL = import.meta.env.VITE_N8N_BASE_URL || 'https://...'`

---

### 4. console.error in Production Code
**File:** `src/lib/mailchimp.ts:88, 93`
**Agent:** code-reviewer

```typescript
console.error('Mailchimp function error:', error)
console.error('Mailchimp operation failed:', data)
```

**CLAUDE.md Violation:** "DON'T use console.log in committed code"
**Fix:** Remove or replace with proper error logging.

---

## Important Issues (Should Fix)

### 5. SMS Template - Silent Date Parsing Failure
**File:** `src/lib/smsTemplates.ts:66-74`
**Agent:** silent-failure-hunter

```typescript
try {
  dueDate = parseLocalDate(data.dueDate).toLocaleDateString(...)
} catch {
  // Silent fallback - keeps default 'soon'
}
```

**Impact:** Invoice reminder says "due soon" instead of actual date.
**Fix:** Throw error on invalid date instead of silent fallback.

---

### 6. Gmail - Response Error Field Never Checked
**File:** `src/lib/gmail.ts:35-36`
**Agent:** silent-failure-hunter

```typescript
// GmailSearchResponse has error?: string field
const data = await response.json()
return data as GmailSearchResponse  // Never checks data.error or data.success!
```

**Fix:** Check `if (!data.success || data.error) throw new Error(data.error)`.

---

### 7. Mailchimp - Unsafe Type Assertion
**File:** `src/lib/mailchimp.ts:97`
**Agent:** silent-failure-hunter

```typescript
return data.data as T  // No validation that data.data matches type T
```

**Fix:** Add validation that `data.data` exists and has expected shape.

---

### 8. Duplicate formatCurrency Implementation
**File:** `src/lib/invoicePdf.ts:25-28`
**Agent:** code-reviewer

```typescript
function formatCurrency(amount: number | null): string {
  // Different behavior from moneyUtils.formatCurrency
}
```

**Issue:** Returns `'-'` for null vs `'$0.00'` from moneyUtils.
**Fix:** Import from moneyUtils, create wrapper if PDF-specific behavior needed.

---

### 9. SMS Templates - No Input Validation
**File:** `src/lib/smsTemplates.ts:127-133`
**Agent:** silent-failure-hunter

```typescript
export function generateMessage<K extends TemplateKey>(key: K, data: TemplateData[K]): string {
  return template.generate(data)  // Never validates requiredFields!
}
```

**Impact:** Message could contain "Hi undefined, this is Eaton Education..."
**Fix:** Validate required fields before generating.

---

### 10. SMS Cost Calculation - Potential NaN
**File:** `src/lib/smsTemplates.ts:179-192`
**Agent:** code-reviewer

```typescript
return messageCount * segmentsPerMessage * smsRate
// No validation that inputs are valid numbers
```

**Fix:** Add `Number.isFinite()` checks.

---

## Medium Priority Issues

### 11. Gmail - Empty Error Messages
**File:** `src/lib/gmail.ts:31-33`
**Agent:** silent-failure-hunter

```typescript
throw new Error(`Gmail search failed: ${response.statusText}`)
// statusText is often empty in modern browsers
```

**Fix:** `throw new Error(\`Gmail search failed (HTTP ${response.status}): ${response.statusText || 'Server error'}\`)`

---

### 12. Unsafe Type Assertion in Template Registry
**File:** `src/lib/smsTemplates.ts:120-121`
**Agent:** code-reviewer

```typescript
return SMS_TEMPLATES[key] as any as TemplateConfig<K>
// No check if key exists
```

**Fix:** Add runtime validation before type assertion.

---

### 13. Invoice PDF - Missing Input Validation
**File:** `src/lib/invoicePdf.ts:130+`
**Agent:** silent-failure-hunter

Code accesses nested properties without null checks that could crash on malformed data.
**Fix:** Add defensive validation at function start.

---

## Error Handling Summary by File

| File | Critical | High | Medium |
|------|----------|------|--------|
| `gmail.ts` | 2 | 2 | 1 |
| `invoicePdf.ts` | 1 | 1 | 1 |
| `mailchimp.ts` | 1 | 1 | 0 |
| `smsTemplates.ts` | 0 | 2 | 1 |
| **Total** | **4** | **6** | **3** |

---

## Verified Correct Patterns

- mailchimp.ts: Uses Supabase Edge Function for API keys (good security)
- smsTemplates.ts: Correct GSM character set detection
- smsTemplates.ts: Correct segment calculation for SMS
- No credentials exposed client-side
- No injection vulnerabilities found

---

## Priority Fix Order

1. **Gmail error handling** - Users see cryptic errors or infinite hangs
2. **Invoice PDF try-catch** - Silent failures for user action
3. **Remove console.error** - CLAUDE.md violation
4. **Environment variable for N8N URL** - CLAUDE.md violation
5. **SMS template date validation** - Prevents degraded messages
6. **Gmail response validation** - Check error/success fields
7. **SMS input validation** - Prevent "Hi undefined" messages

---

## Next Steps

- [ ] Add error handling to gmail.ts
- [ ] Wrap invoicePdf in try-catch
- [ ] Remove console.error statements
- [ ] Add environment variable for N8N URL
- [ ] Compile Master Triage List from all phases
