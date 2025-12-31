# Leads & Calendly Integration Setup

This document describes how to set up the leads tracking system and Calendly integration.

## Overview

The system tracks leads from multiple sources:
- **Exit Intent** - Email signups from exit intent popups
- **Waitlist** - Form submissions from the waitlist page
- **Calendly Calls** - People who book 15-minute discovery calls
- **Event Leads** - Families who purchased event tickets but have no active enrollments

Hub Drop-off bookings are NOT leads - they automatically create:
- Family (if not exists)
- Student (if not exists)
- Hub session for the scheduled date

## Step 1: Run Database Migration

Run the SQL migration in Supabase:

```bash
# In Supabase SQL Editor, run:
# docs/MIGRATION_LEADS_AND_CALENDLY.sql
```

This creates:
- `leads` table with lead types and statuses
- `calendly_bookings` table for tracking all Calendly events
- Views: `leads_pipeline`, `upcoming_calendly_bookings`, `event_leads`

## Step 2: Deploy Edge Functions

### Prerequisites

1. Install Supabase CLI: `npm install -g supabase`
2. Login: `supabase login`
3. Link project: `supabase link --project-ref YOUR_PROJECT_REF`

### Deploy Functions

```bash
# Deploy Calendly webhook handler
supabase functions deploy calendly-webhook

# Deploy lead ingest API
supabase functions deploy ingest-lead
```

### Set Environment Variables

In Supabase Dashboard → Edge Functions → Secrets:

```
CALENDLY_WEBHOOK_SIGNING_KEY=3g6qYyn3nCButR2V9d4pkVoJYfIirTxHKxPy5mediEk
LEAD_INGEST_API_KEY=<generate-a-secure-key>
```

## Step 3: Configure Calendly Webhooks

1. Go to Calendly → Integrations → Webhooks
2. Create a new webhook:
   - **URL**: `https://<your-project>.supabase.co/functions/v1/calendly-webhook`
   - **Events**:
     - `invitee.created`
     - `invitee.canceled`
3. Copy the signing key and add to Supabase secrets

### Calendly Event Types

The webhook automatically handles:

| Calendly Event | System Action |
|----------------|---------------|
| 15min call booking | Creates a `calendly_call` lead |
| Hub Drop-off booking | Creates family → student → hub_session |
| Cancellation | Updates booking status to `canceled` |

## Step 4: Configure n8n Workflows

### Exit Intent Leads

Configure your exit intent form to trigger an n8n workflow that POSTs to:

```
POST https://<your-project>.supabase.co/functions/v1/ingest-lead
Headers:
  Content-Type: application/json
  x-api-key: <your-lead-ingest-api-key>

Body:
{
  "lead_type": "exit_intent",
  "email": "{{email}}",
  "name": "{{name}}",
  "source_url": "{{page_url}}"
}
```

### Waitlist Leads

Configure your waitlist form to trigger an n8n workflow that POSTs to:

```
POST https://<your-project>.supabase.co/functions/v1/ingest-lead
Headers:
  Content-Type: application/json
  x-api-key: <your-lead-ingest-api-key>

Body:
{
  "lead_type": "waitlist",
  "email": "{{email}}",
  "name": "{{name}}",
  "source_url": "{{page_url}}",
  "num_children": {{num_children}},
  "children_ages": "{{children_ages}}",
  "preferred_days": "{{preferred_days}}",
  "preferred_time": "{{preferred_time}}",
  "service_interest": "{{service_interest}}",
  "notes": "{{notes}}"
}
```

## Step 5: Regenerate Supabase Types

After running the migration:

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/supabase.ts
```

## Command Center Metrics

The Command Center now displays:

### Primary KPIs
- Active Students
- Active Families
- MRR (with month-over-month change)
- Outstanding Balance
- Active Teachers

### Secondary Metrics
- Gross Profit Margin (%)
- Average Revenue per Student
- New Enrollments This Month (with month-over-month change)

### Leads Pipeline
- Exit Intent leads
- Waitlist leads
- Calendly Call leads
- Event leads (families from events without enrollments)

### Upcoming Calendly
- Next 5 scheduled bookings
- Count of upcoming calls vs hub drop-offs

### Invoice Health
- Overdue 30+ days
- Sent but unopened
- Unbilled Hub sessions
- Total outstanding

### Alerts
- Overdue invoices
- Unbilled Hub sessions
- Unopened invoices
- Families flagged for reengagement

## Hub Drop-off Flow

When someone books a Hub Drop-off via Calendly:

```
Calendly Webhook Received
    ↓
Extract: email, name, phone, student_name, student_age_group, payment_method
    ↓
Find family by email
    ├── Found → Use existing family_id
    └── Not found → Create family (status='active')
    ↓
Find student by name in family
    ├── Found → Use existing student_id
    └── Not found → Create student
    ↓
Create hub_session (session_date, daily_rate=$100)
    ↓
Create calendly_booking record (for tracking)
```

## Event Leads

Event leads are derived dynamically from:
- Families who have paid event orders
- BUT have no active/trial enrollments

Query via the `event_leads` view:

```sql
SELECT * FROM event_leads;
```

This returns families with:
- `family_id`, `family_name`, `primary_email`
- `event_order_count`, `total_event_spend`
- `last_event_order_at`

## Lead Statuses

| Status | Description |
|--------|-------------|
| `new` | Just captured, not yet contacted |
| `contacted` | Reached out, awaiting response |
| `converted` | Became an active family/enrollment |
| `closed` | Not interested, duplicate, or invalid |

## Troubleshooting

### Calendly webhook not working
1. Check Edge Function logs: Supabase Dashboard → Edge Functions → calendly-webhook → Logs
2. Verify webhook URL is correct in Calendly
3. Verify signing key matches

### Leads not appearing
1. Check n8n workflow executed successfully
2. Verify API key is correct
3. Check Edge Function logs for errors

### Hub sessions not created
1. Check calendly_bookings table for the booking record
2. Verify the Calendly form collects student_name
3. Check Edge Function logs for errors
