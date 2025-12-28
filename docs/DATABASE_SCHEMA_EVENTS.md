# Eaton Events - Database Schema

> **Version:** 1.0 | **Last Updated:** 2024-12-28

> **Note:** These `event_` tables live alongside CRM tables (`families`, `students`, `enrollments`, `invoices`, etc.) in the same Supabase project. The `families` table is shared — event purchases are automatically linked to family records by email.
>
> Full CRM schema is documented in the eaton-console repo.

---

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
└─────────────────┘       │ payment_status  │       │ ...             │  │ │
                          │ family_id (FK)──┼──┐    └─────────────────┘  │ │
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

---

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
| `created_at` | TIMESTAMPTZ | Record created |
| `updated_at` | TIMESTAMPTZ | Record updated |
| `synced_at` | TIMESTAMPTZ | Last sync from WordPress |

### event_orders
One record per Stripe Checkout session.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `event_id` | UUID | FK to event_events |
| `stripe_checkout_session_id` | TEXT | Stripe session ID (unique) |
| `stripe_payment_intent_id` | TEXT | Stripe payment intent |
| `stripe_customer_id` | TEXT | Stripe customer ID |
| `purchaser_email` | TEXT | Parent's email |
| `purchaser_name` | TEXT | Parent's name |
| `quantity` | INTEGER | Number of tickets |
| `unit_price_cents` | INTEGER | Price per ticket |
| `total_cents` | INTEGER | Total charged |
| `payment_status` | TEXT | pending, paid, refunded, expired, failed |
| `family_id` | UUID | FK to families (auto-linked by webhook) |
| `metadata` | JSONB | Raw data (attendee details, etc.) |
| `created_at` | TIMESTAMPTZ | Order created |
| `updated_at` | TIMESTAMPTZ | Order updated |
| `paid_at` | TIMESTAMPTZ | When payment completed |

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

---

## Views

### event_summary
Aggregated event data for reporting.

| Column | Description |
|--------|-------------|
| `id` | Event ID |
| `title` | Event name |
| `start_at` | Event date |
| `ticket_price_cents` | Ticket price |
| `capacity` | Max capacity |
| `orders_count` | Number of paid orders |
| `tickets_sold` | Total tickets sold |
| `revenue_cents` | Total revenue |
| `tickets_remaining` | Capacity - tickets sold |

### event_attendee_list
Flat list of attendees for export/display.

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
| `paid_at` | Payment timestamp |
| `payment_status` | Order status |

> **Note:** This view filters by `payment_status = 'paid'`. Refunded orders are automatically excluded, so attendees from refunded orders won't appear in reports.

---

## Indexes

| Index | Table | Columns | Purpose |
|-------|-------|---------|---------|
| `idx_event_orders_event_id` | event_orders | event_id | Filter orders by event |
| `idx_event_orders_payment_status` | event_orders | payment_status | Filter by status |
| `idx_event_orders_purchaser_email` | event_orders | purchaser_email | Lookup by email |
| `idx_event_orders_family_id` | event_orders | family_id | Join with families |
| `idx_event_attendees_event_id` | event_attendees | event_id | Filter attendees by event |
| `idx_event_attendees_order_id` | event_attendees | order_id | Join with orders |
| `idx_event_events_wp_post_id` | event_events | wp_post_id | Lookup by WP ID |
| `idx_event_events_status` | event_events | status | Filter by status |

---

## Family Linking

The webhook automatically links orders to families:

1. When `checkout.session.completed` fires, webhook looks up `purchaser_email` (lowercase)
2. If a matching family exists in `families` table → use that `family_id`
3. If no match → create new family with `display_name` = "[LastName] Family"
4. Link `family_id` to the `event_orders` record

This enables:
- Unified family view across enrollments and events
- Future: "All events this family has attended" reports
- Future: Auto-fill registration for returning families

---

## Refund Handling

When a refund occurs (`charge.refunded` webhook):

1. Order `payment_status` updated to `'refunded'`
2. Attendee records are **preserved** (not deleted)
3. `event_attendee_list` view automatically excludes them (filters `payment_status = 'paid'`)
4. Revenue calculations in `event_summary` exclude refunded orders

This approach maintains audit trail while keeping reports accurate.
