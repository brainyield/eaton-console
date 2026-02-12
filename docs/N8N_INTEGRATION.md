# n8n Workflow Integration
## Invoice Send & Reminders

---

## Workflow: Invoice Send & Reminders v3

**Endpoint**: `POST https://eatonacademic.app.n8n.cloud/webhook/invoice-send`

**Single webhook handles 4 email types based on `type` parameter:**

| Type | Template | Subject | Use Case |
|------|----------|---------|----------|
| `send` | Invoice (Blue) | "Invoice INV-0001 from Eaton Academic" | Initial invoice send |
| `reminder_7` | Friendly (Blue) | "Friendly Reminder: Invoice INV-0001 is Past Due" | 1-13 days overdue |
| `reminder_14` | Past Due (Amber) | "Payment Reminder: Invoice INV-0001 is Past Due" | 14-29 days overdue |
| `reminder_30` | Urgent (Red) | "Urgent: Invoice INV-0001 is X Days Overdue" | 30+ days overdue |

---

## Payload Structure

```json
{
  "type": "send | reminder_7 | reminder_14 | reminder_30",
  "invoice_id": "uuid",
  "invoice_number": "INV-0001",
  "public_id": "AHLWJ8R5",
  "invoice_url": "https://eaton-console.vercel.app/invoice/AHLWJ8R5",
  "family": {
    "id": "uuid",
    "name": "Barzola, Adriana",
    "email": "adrianabarzola@ymail.com",
    "contact_name": "Adriana"
  },
  "amounts": {
    "subtotal": 270,
    "total": 270,
    "amount_paid": 0,
    "balance_due": 270
  },
  "dates": {
    "invoice_date": "2025-12-23",
    "due_date": "2026-01-07",
    "period_start": "2025-12-22",
    "period_end": "2025-12-27"
  },
  "days_overdue": 15,
  "line_items": [
    { "description": "Student - Service: details", "amount": 270 }
  ]
}
```

**Note**: `days_overdue` is only included for reminder types.

---

## Workflow Structure

The workflow uses a **Switch node** to route to exactly one email template based on the `type` parameter. This ensures only one email is sent per webhook call.

```
Webhook --> Switch (type)
               |
    +----------+----------+----------+
    |          |          |          |
  "send"  "reminder_7" "reminder_14" "reminder_30"
    |          |          |          |
    v          v          v          v
  Invoice    7-Day      14-Day     30-Day
  (Blue)    (Blue)     (Amber)     (Red)
    |          |          |          |
    +----------+----------+----------+
               |
               v
        Success Response
     { success: true, type, sent_to }
```

**Key Design Points:**
- Switch node ensures **mutual exclusivity** - only one branch executes
- Unknown types are silently dropped (no matching route)
- All successful sends return consistent JSON response

---

## Email Templates Visual Reference

### Invoice (type: send)
- Header: Blue gradient (#1e3a5f to #2d5a87)
- Button: Blue (#1e3a5f)
- Tone: Professional, informative

### 7-Day Reminder (type: reminder_7)
- Header: Blue gradient (#3b82f6 to #1d4ed8)
- Button: Blue (#3b82f6)
- Tone: Friendly but accurate — says invoice "was due on [date] and is now X days past due"
- Shows due date and days overdue in body

### 14-Day Reminder (type: reminder_14)
- Header: Amber gradient (#f59e0b to #d97706)
- Button: Amber (#f59e0b)
- Tone: Firmer, "please address this"
- Shows days overdue in body

### 30-Day Urgent (type: reminder_30)
- Header: Red gradient (#dc2626 to #b91c1c)
- Button: Red (#dc2626)
- Tone: Urgent, mentions potential service interruption
- Shows days overdue in subject AND body

---

## Frontend Integration

### React Query Hooks

The Console uses the following hooks for invoice email operations (defined in `src/lib/hooks.ts`):

**Query:**
```typescript
// Fetch email history for an invoice
const { data: emails } = useInvoiceEmails(invoiceId)
```

**Mutations (from useInvoiceMutations):**
```typescript
const { sendInvoice, sendReminder, bulkSendReminders } = useInvoiceMutations()

// Send initial invoice
sendInvoice.mutate(invoiceId)

// Send individual reminder
sendReminder.mutate({ 
  invoice: invoiceWithFamily, 
  reminderType: 'reminder_7' | 'reminder_14' | 'reminder_30' 
})

// Send bulk reminders (auto-selects type per invoice)
bulkSendReminders.mutate({ invoices: selectedInvoices })
```

### Automatic Type Selection

The `getReminderType` helper function automatically determines the appropriate reminder type:

```typescript
import { getReminderType } from '../lib/hooks'

// Returns { type, label, daysOverdue }
const { type, label, daysOverdue } = getReminderType(invoice.due_date)

// Examples:
// due_date was 5 days ago  -> { type: 'reminder_7', label: 'Friendly Reminder', daysOverdue: 5 }
// due_date was 20 days ago -> { type: 'reminder_14', label: 'Past Due Reminder', daysOverdue: 20 }
// due_date was 45 days ago -> { type: 'reminder_30', label: 'Urgent Reminder', daysOverdue: 45 }
```

### Email Tracking

All emails are logged in `invoice_emails` table with type mapping:

| Webhook Type | DB email_type | Description |
|--------------|---------------|-------------|
| `send` | `invoice` | Initial invoice send |
| `reminder_7` | `reminder_7_day` | Friendly reminder (1-13 days) |
| `reminder_14` | `reminder_14_day` | Past due reminder (14-29 days) |
| `reminder_30` | `reminder_overdue` | Urgent reminder (30+ days) |

### Query Invalidation

Mutations automatically invalidate relevant queries:
- `sendInvoice` -> invalidates `invoices.all`, `invoiceEmails.all`
- `sendReminder` -> invalidates `invoiceEmails.byInvoice(id)`
- `bulkSendReminders` -> invalidates `invoices.all`, `invoiceEmails.all`

---

## UI Components

### Invoicing.tsx - Outstanding Tab

**Bulk Reminder Button:**
```tsx
// Shown when invoices are selected in Outstanding tab
<button 
  onClick={handleBulkSendReminders}
  className="bg-amber-600 hover:bg-amber-700 ..."
>
  <Bell className="h-4 w-4" />
  Send Reminder ({selectedCount})
</button>
```

**Behavior:**
1. Filters selected invoices to only include outstanding (sent/partial/overdue)
2. Shows confirmation dialog with count
3. Calls `bulkSendReminders.mutate()`
4. Shows success/failure alert with counts

### InvoiceDetailPanel.tsx

**Individual Reminder Button:**
```tsx
// Shown for outstanding invoices (sent/partial/overdue status)
<button
  onClick={handleSendReminder}
  className="bg-amber-600 hover:bg-amber-700 ..."
>
  <Bell className="h-4 w-4" />
  {sendingReminder ? 'Sending...' : 'Send Reminder'}
</button>
```

**Email History Section:**
- Located below notes in the detail panel
- Shows all emails sent for the invoice
- Each email displays:
  - Type badge (color-coded: blue/sky/amber/red/green)
  - Subject line
  - Recipient email
  - Relative timestamp (Today, Yesterday, X days ago, or date)

**Email Type Styling:**

| email_type | Badge Color | Icon |
|------------|-------------|------|
| invoice | Blue (bg-blue-900) | Mail |
| reminder_7_day | Sky (bg-sky-900) | Clock |
| reminder_14_day | Amber (bg-amber-900) | Bell |
| reminder_overdue | Red (bg-red-900) | Bell |
| payment_received | Green (bg-green-900) | CheckCircle |

---

## Testing

### Test with PowerShell

```powershell
# Test invoice send (should send ONLY invoice email)
$body = @{
    type = "send"
    invoice_number = "TEST-001"
    public_id = "TESTID01"
    invoice_url = "https://eaton-console.vercel.app/invoice/TESTID01"
    family = @{
        name = "Test Family"
        email = "test@example.com"
        contact_name = "Test"
    }
    amounts = @{ balance_due = 100 }
    dates = @{
        invoice_date = "2025-01-01"
        due_date = "2025-01-15"
        period_start = "2025-01-01"
        period_end = "2025-01-15"
    }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri "https://eatonacademic.app.n8n.cloud/webhook/invoice-send" -Method Post -Body $body -ContentType "application/json"
```

```powershell
# Test 30-day urgent reminder (should show "45 Days Overdue" in subject)
$body = @{
    type = "reminder_30"
    invoice_number = "TEST-001"
    public_id = "TESTID01"
    invoice_url = "https://eaton-console.vercel.app/invoice/TESTID01"
    family = @{
        name = "Test Family"
        email = "test@example.com"
        contact_name = "Test"
    }
    amounts = @{ balance_due = 100 }
    dates = @{ due_date = "2024-11-01" }
    days_overdue = 45
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri "https://eatonacademic.app.n8n.cloud/webhook/invoice-send" -Method Post -Body $body -ContentType "application/json"
```

### Test with curl

```bash
# Test invoice send
curl -X POST https://eatonacademic.app.n8n.cloud/webhook/invoice-send \
  -H "Content-Type: application/json" \
  -d '{"type":"send","invoice_number":"TEST-001","family":{"email":"test@example.com","name":"Test Family"},"amounts":{"balance_due":100},"dates":{"invoice_date":"2025-01-01","due_date":"2025-01-15","period_start":"2025-01-01","period_end":"2025-01-15"},"invoice_url":"https://example.com"}'

# Test 7-day friendly reminder
curl -X POST https://eatonacademic.app.n8n.cloud/webhook/invoice-send \
  -H "Content-Type: application/json" \
  -d '{"type":"reminder_7","invoice_number":"TEST-001","family":{"email":"test@example.com","name":"Test Family"},"amounts":{"balance_due":100},"dates":{"due_date":"2025-01-10"},"days_overdue":5,"invoice_url":"https://example.com"}'

# Test 14-day past due reminder
curl -X POST https://eatonacademic.app.n8n.cloud/webhook/invoice-send \
  -H "Content-Type: application/json" \
  -d '{"type":"reminder_14","invoice_number":"TEST-001","family":{"email":"test@example.com","name":"Test Family"},"amounts":{"balance_due":100},"dates":{"due_date":"2024-12-10"},"days_overdue":16,"invoice_url":"https://example.com"}'

# Test 30-day urgent reminder
curl -X POST https://eatonacademic.app.n8n.cloud/webhook/invoice-send \
  -H "Content-Type: application/json" \
  -d '{"type":"reminder_30","invoice_number":"TEST-001","family":{"email":"test@example.com","name":"Test Family"},"amounts":{"balance_due":100},"dates":{"due_date":"2024-11-01"},"days_overdue":45,"invoice_url":"https://example.com"}'
```

### Frontend Testing Checklist

- [ ] Outstanding tab shows "Send Reminder" button when invoices selected
- [ ] Bulk reminder sends to all selected, shows success/failure counts
- [ ] Individual "Send Reminder" button appears in detail panel for outstanding invoices
- [ ] Confirmation dialog shows reminder type and days overdue
- [ ] Email history section appears after sending
- [ ] Email history shows correct type badges and colors
- [ ] Timestamps display correctly (Today, Yesterday, X days ago)
- [ ] Loading states work during send operations
- [ ] **Only ONE email sent per action** (no duplicate emails)

---

## Troubleshooting

### Email Not Sending
1. Check n8n workflow is active
2. Verify Gmail credentials are valid
3. Check webhook response in browser network tab
4. Review n8n execution logs for errors

### Email History Not Showing
1. Verify `invoice_emails` table has RLS disabled or proper policies
2. Check `useInvoiceEmails` hook is receiving data
3. Ensure `invoiceId` is being passed correctly

### Wrong Reminder Type
The `getReminderType` function calculates days overdue from `due_date`. If reminders seem wrong:
1. Check invoice `due_date` is set correctly
2. Verify timezone handling (uses local time)
3. Console log the `daysOverdue` value to debug

### Duplicate Emails (Fixed in v3)
If you're receiving duplicate emails (e.g., invoice + reminder at the same time), you're using an old workflow version with parallel IF nodes. Import `Invoice_Send_Reminders_v3_FIXED.json` which uses a Switch node for mutual exclusivity.

---

## Changelog

### v3.1 (Feb 12, 2026)
- **Fixed**: 7-day reminder subject changed from "Due Soon" to "is Past Due" (was misleading for overdue invoices)
- **Fixed**: 7-day reminder body now says "was due on [date] and is now X days past due" instead of "is due on [date]"
- **Removed**: Disconnected "Error - Unknown Type" fallback node (was not wired to Switch output)

### v3 (Dec 26, 2024)
- **Fixed**: Replaced parallel IF nodes with Switch node to prevent duplicate emails
- **Fixed**: 30-day urgent emails now correctly show days overdue in subject
- **Added**: Error response (HTTP 400) for unknown email types
- **Added**: 14-day reminder now shows days overdue in email body

### v2 (Dec 2024)
- Added reminder types (7-day, 14-day, 30-day)
- Added email history tracking

### v1 (Initial)
- Basic invoice send functionality

---

## Workflow: Payroll Notification

**Endpoint**: `POST https://eatonacademic.app.n8n.cloud/webhook/payroll-notification`

**Purpose**: Sends email notifications to teachers when their payroll is processed.

### Trigger Points

This webhook is triggered in two scenarios:

1. **Bulk Payroll** (Primary): When a payroll run is marked as "Paid" in `PayrollRunDetail.tsx`, notifications are automatically sent to all teachers included in that payroll run.

2. **Manual Payments** (Disabled): The manual "Add Payment" button in `RecordTeacherPaymentModal.tsx` no longer triggers notifications. This is intentional - manual payments are ad-hoc adjustments that don't require automated notifications.

### Payload Structure

```json
{
  "payment_id": "bulk-run-id-teacher-id",
  "teacher": {
    "id": "uuid",
    "name": "Teacher Name",
    "email": "teacher@example.com"
  },
  "amounts": {
    "total": 1250.00,
    "hours": 25.0
  },
  "period": {
    "start": "2025-12-16",
    "end": "2025-12-20"
  },
  "line_items": [
    {
      "student": "Student Name",
      "service": "Tutoring",
      "hours": 5.0,
      "rate": 50.00,
      "amount": 250.00
    }
  ],
  "payment_method": "Bulk Payroll",
  "timestamp": "2025-12-27T10:30:00.000Z"
}
```

### Workflow Structure

```
Webhook --> Format Email --> Send Email (Gmail) --> Set Response
```

**Email Template:**
- Header: Green gradient (#10b981 to #059669)
- Shows payment summary with hours and amount
- Detailed breakdown table of all line items
- Payment method and period dates

### Frontend Integration

**PayrollRunDetail.tsx - Mark as Paid:**
```typescript
// When status changes to 'paid', notifications are sent automatically
const handleStatusChange = async (newStatus: PayrollRunStatus) => {
  await updateRunStatus.mutateAsync({ id, status: newStatus })

  if (newStatus === 'paid') {
    // Fire and forget - doesn't block UI
    triggerBulkPayrollNotifications(run, teacherGroups)
  }
}
```

**TeacherDetailPanel - Payroll Tab:**

The payroll tab now shows combined payment history from two sources:
- **Manual payments** (`teacher_payments` table)
- **Bulk payroll** (`payroll_line_item` table, from paid runs)

Bulk payroll entries are marked with a "Bulk Payroll" badge in the Source column.

### Query Invalidation

When a payroll run is marked as paid:
- `queryKeys.payroll.all` - Refreshes payroll run list
- `queryKeys.payroll.runWithItems(runId)` - Refreshes the specific run
- `['payroll', 'teacher']` - Refreshes all teacher payroll queries (for TeacherDetailPanel updates)

---

## Changelog (Payroll Notification)

### v2 (Jan 2026)
- **Changed**: Notifications now triggered by bulk payroll completion instead of manual payments
- **Added**: TeacherDetailPanel payroll tab shows combined manual + bulk payroll history
- **Added**: "Bulk Payroll" badge to distinguish payment sources
- **Fixed**: Query invalidation ensures real-time updates in TeacherDetailPanel

### v1 (Dec 2025)
- Basic payroll notification on manual payment recording
