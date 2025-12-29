# Eaton Events - Database Schema

## Overview

New tables are prefixed with `event_` to distinguish from existing eaton-console tables (families, students, payments, etc.).

## Entity Relationship

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  event_events   │       │  event_orders   │       │event_attendees  │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │◀──┐   │ id (PK)         │◀──┐   │ id (PK)         │
│ wp_post_id      │   │   │ event_id (FK)───┼──┘│   │ order_id (FK)───┼──┐
│ title           │   │   │ stripe_*        │   │   │ event_id (FK)───┼──┼─┐
│ start_at        │   │   │ purchaser_*     │   │   │ attendee_name   │  │ │
│ ticket_price_*  │   └───┼─────────────────┤   │   │ attendee_age    │  │ │
│ capacity        │       │ quantity        │   └───┼─────────────────┤  │ │
│ ...             │       │ total_cents     │       │ is_adult (GEN)  │  │ │
└─────────────────┘       │ payment_method  │       │ ...             │  │ │
                          │ payment_status  │       └─────────────────┘  │ │
                          │ family_id (FK)──┼──┐                         │ │
                          └─────────────────┘  │                         │ │
                                               │                         │ │
                          ┌────────────────────┼─────────────────────────┘ │
                          │                    │                           │
                          ▼                    ▼                           │
                   ┌─────────────────┐  ┌─────────────────┐               │
                   │    families     │  │    students     │◀──────────────┘
                   │   (existing)    │  │   (existing)    │
                   └─────────────────┘  └─────────────────┘
```

## Tables

### event_events
Events mirrored from WordPress via n8n.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `wp_post_id` | INTEGER | WordPress event ID (unique) |
| `wp_slug` | TEXT | URL slug for matching |
| `title` | TEXT | Event name |
| `description` | TEXT | Event description |
| `event_type` | TEXT | 'event' or 'class' |
| `start_at` | TIMESTAMPTZ | Event start date/time |
| `end_at` | TIMESTAMPTZ | Event end date/time |
| `venue_name` | TEXT | Venue name |
| `venue_address` | TEXT | Street address |
| `venue_city` | TEXT | City |
| `venue_state` | TEXT | State |
| `ticket_price_cents` | INTEGER | Price in cents (e.g., 7500 = $75.00) |
| `ticket_price_label` | TEXT | Display text (default: "per person") |
| `capacity` | INTEGER | Max attendees (NULL = unlimited) |
| `status` | TEXT | published, draft, cancelled |
| `registration_open` | BOOLEAN | Can toggle registration |
| `featured_image_url` | TEXT | Image URL |
| `semester` | TEXT | Semester name (classes only) |
| `schedule_day` | TEXT | Day of week (classes only) |
| `schedule_time` | TEXT | Time of day (classes only) |
| `instructor_name` | TEXT | Instructor (classes only) |
| `created_at` | TIMESTAMPTZ | Record created |
| `updated_at` | TIMESTAMPTZ | Record updated |
| `synced_at` | TIMESTAMPTZ | Last sync from WordPress |

### event_orders
One record per checkout session (Stripe or Step Up).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `event_id` | UUID | FK to event_events |
| `stripe_checkout_session_id` | TEXT | Stripe session ID (NULL for Step Up) |
| `stripe_payment_intent_id` | TEXT | Stripe payment intent (NULL for Step Up) |
| `stripe_customer_id` | TEXT | Stripe customer ID (NULL for Step Up) |
| `purchaser_email` | TEXT | Parent's email |
| `purchaser_name` | TEXT | Parent's name |
| `quantity` | INTEGER | Number of tickets |
| `unit_price_cents` | INTEGER | Price per ticket |
| `total_cents` | INTEGER | Total amount |
| `payment_method` | TEXT | **'stripe' or 'stepup'** (default: 'stripe') |
| `payment_status` | TEXT | pending, paid, stepup_pending, refunded, expired, failed |
| `family_id` | UUID | FK to families (auto-linked) |
| `metadata` | JSONB | Raw data (attendee details, etc.) |
| `created_at` | TIMESTAMPTZ | Order created |
| `updated_at` | TIMESTAMPTZ | Order updated |
| `paid_at` | TIMESTAMPTZ | When payment completed |

#### Payment Status Values

| Status | Meaning |
|--------|---------|
| `pending` | Stripe checkout started, not completed |
| `paid` | Payment received (Stripe webhook or manual) |
| `stepup_pending` | Step Up registration, awaiting invoice/payment |
| `expired` | Stripe checkout abandoned (30 min timeout) |
| `refunded` | Payment refunded via Stripe |
| `failed` | Stripe checkout failed |

### event_attendees
One record per person attending (matches quantity).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `order_id` | UUID | FK to event_orders |
| `event_id` | UUID | FK to event_events |
| `attendee_name` | TEXT | Person's name |
| `attendee_age` | INTEGER | Person's age |
| `is_adult` | BOOLEAN | **GENERATED**: age >= 18 (see warning below) |
| `student_id` | UUID | FK to students (optional, for manual linking) |
| `created_at` | TIMESTAMPTZ | Record created |

> ⚠️ **IMPORTANT: `is_adult` is a GENERATED column**
> 
> This column is automatically calculated by Supabase using: `GENERATED ALWAYS AS (attendee_age >= 18) STORED`
> 
> **Do NOT include `is_adult` in INSERT statements.** Doing so will cause Supabase error `428C9: cannot insert a non-DEFAULT value into column "is_adult"`.
> 
> ```typescript
> // CORRECT - let Supabase calculate is_adult:
> await supabase.from('event_attendees').insert({
>   order_id: order.id,
>   event_id: order.event_id,
>   attendee_name: 'John Doe',
>   attendee_age: 25,
>   // is_adult will auto-calculate to true
> });
> 
> // WRONG - will cause error:
> await supabase.from('event_attendees').insert({
>   ...
>   is_adult: true,  // ❌ Never include this
> });
> ```

### event_stripe_webhooks
Idempotency tracking for webhook processing.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `stripe_event_id` | TEXT | Stripe event ID (unique) |
| `event_type` | TEXT | e.g., checkout.session.completed |
| `processed_at` | TIMESTAMPTZ | When processed |
| `processing_status` | TEXT | processed, failed, skipped |
| `error_message` | TEXT | Error details if failed |
| `raw_payload` | JSONB | Full webhook payload |

## Views

### event_attendee_list
Flat list of attendees for export/display. **Includes both paid and Step Up pending orders.**

| Column | Description |
|--------|-------------|
| `attendee_id` | Attendee record ID |
| `attendee_name` | Person's name |
| `attendee_age` | Person's age |
| `is_adult` | Adult indicator |
| `event_id` | Event ID |
| `event_title` | Event name |
| `event_date` | Event date |
| `purchaser_email` | Parent's email |
| `purchaser_name` | Parent's name |
| `payment_method` | 'stripe' or 'stepup' |
| `paid_at` | Payment timestamp |
| `payment_status` | Order status |

> **Note:** This view filters by `payment_status IN ('paid', 'stepup_pending')`. Refunded and expired orders are automatically excluded.

### event_stepup_pending
Step Up orders awaiting invoice/payment. **Use this in console for billing tracking.**

| Column | Description |
|--------|-------------|
| `id` | Order ID |
| `created_at` | Registration date |
| `purchaser_email` | Parent's email |
| `purchaser_name` | Parent's name |
| `quantity` | Number of tickets |
| `total_cents` | Amount owed |
| `payment_status` | Always 'stepup_pending' |
| `family_id` | Linked family ID |
| `event_id` | Event ID |
| `event_title` | Event name |
| `event_type` | 'event' or 'class' |
| `event_date` | Event date |
| `family_name` | Family display name |

## Indexes

| Index | Table | Columns | Purpose |
|-------|-------|---------|---------|
| `idx_event_orders_event_id` | event_orders | event_id | Filter orders by event |
| `idx_event_orders_payment_status` | event_orders | payment_status | Filter by status |
| `idx_event_orders_payment_method` | event_orders | payment_method | Filter by payment method |
| `idx_event_orders_purchaser_email` | event_orders | purchaser_email | Lookup by email |
| `idx_event_orders_family_id` | event_orders | family_id | Join with families |
| `idx_event_attendees_event_id` | event_attendees | event_id | Filter attendees by event |
| `idx_event_attendees_order_id` | event_attendees | order_id | Join with orders |
| `idx_event_events_wp_post_id` | event_events | wp_post_id | Lookup by WP ID |
| `idx_event_events_status` | event_events | status | Filter by status |

## Family Linking

Both Stripe and Step Up flows automatically link orders to families:

1. Extract `purchaser_email` (lowercase)
2. If a matching family exists in `families` table → use that `family_id`
3. If no match → create new family with `display_name` = "[LastName] Family"
4. Link `family_id` to the `event_orders` record

**Stripe flow**: Family linking happens in the webhook handler  
**Step Up flow**: Family linking happens in the `/api/checkout/stepup` route

This enables:
- Unified family view across enrollments and events
- Future: "All events this family has attended" reports
- Future: Auto-fill registration for returning families

## Refund Handling

When a refund occurs (`charge.refunded` webhook):

1. Order `payment_status` updated to `'refunded'`
2. Attendee records are **preserved** (not deleted)
3. `event_attendee_list` view automatically excludes them
4. Revenue calculations exclude refunded orders

This approach maintains audit trail while keeping reports accurate.

## Step Up Billing Flow

1. Customer registers with Step Up → order created as `stepup_pending`
2. Admin queries `event_stepup_pending` view in console
3. Admin creates invoice (manually or via console)
4. When payment received, update order:

```sql
UPDATE event_orders 
SET payment_status = 'paid', paid_at = NOW() 
WHERE id = 'order-uuid-here';
```

## SQL Migration Reference

### Add payment_method column (v31)
```sql
ALTER TABLE event_orders 
ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'stripe';

CREATE INDEX IF NOT EXISTS idx_event_orders_payment_method 
ON event_orders(payment_method);
```

### Update event_attendee_list view (v31)
```sql
DROP VIEW IF EXISTS event_attendee_list;

CREATE VIEW event_attendee_list AS
SELECT 
  a.id AS attendee_id,
  a.attendee_name,
  a.attendee_age,
  a.is_adult,
  a.student_id,
  e.id AS event_id,
  e.wp_post_id,
  e.wp_slug,
  e.event_type,
  e.title AS event_title,
  e.start_at AS event_date,
  e.venue_name,
  e.semester,
  e.schedule_day,
  e.schedule_time,
  e.instructor_name,
  o.id AS order_id,
  o.purchaser_email,
  o.purchaser_name,
  o.quantity AS tickets_in_order,
  o.total_cents AS order_total_cents,
  o.payment_method,
  o.paid_at,
  o.payment_status,
  o.family_id
FROM event_attendees a
JOIN event_orders o ON a.order_id = o.id
JOIN event_events e ON a.event_id = e.id
WHERE o.payment_status IN ('paid', 'stepup_pending')
ORDER BY e.start_at, a.attendee_name;
```

### Create event_stepup_pending view (v31)
```sql
CREATE OR REPLACE VIEW event_stepup_pending AS
SELECT 
  o.id,
  o.created_at,
  o.purchaser_email,
  o.purchaser_name,
  o.quantity,
  o.total_cents,
  o.payment_status,
  o.family_id,
  e.id AS event_id,
  e.title AS event_title,
  e.event_type,
  e.start_at AS event_date,
  f.display_name AS family_name
FROM event_orders o
JOIN event_events e ON o.event_id = e.id
LEFT JOIN families f ON o.family_id = f.id
WHERE o.payment_method = 'stepup' 
  AND o.payment_status = 'stepup_pending'
ORDER BY o.created_at DESC;
```
