-- ============================================================================
-- MIGRATION: Event Order Invoice Linking
-- Purpose: Enable billing Step Up event registrations through invoices
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- STEP 1: Add invoice_id to event_orders
-- Links event registration to the invoice that bills the registration fee
-- Only used for Step Up orders (Stripe orders are pre-paid)
-- ============================================================================

ALTER TABLE event_orders
ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id);

CREATE INDEX IF NOT EXISTS idx_event_orders_invoice_id
ON event_orders(invoice_id) WHERE invoice_id IS NOT NULL;

COMMENT ON COLUMN event_orders.invoice_id IS
  'Invoice that bills this registration fee (Step Up orders only)';

-- ============================================================================
-- STEP 2: Add event_order_id to enrollments
-- Links elective class enrollment to the original event registration
-- Used to determine if registration fee has been billed
-- ============================================================================

ALTER TABLE enrollments
ADD COLUMN IF NOT EXISTS event_order_id UUID REFERENCES event_orders(id);

CREATE INDEX IF NOT EXISTS idx_enrollments_event_order_id
ON enrollments(event_order_id) WHERE event_order_id IS NOT NULL;

COMMENT ON COLUMN enrollments.event_order_id IS
  'Original event registration for elective class enrollments';

-- ============================================================================
-- STEP 3: Migration - Link existing elective enrollments to event_orders
-- Matches on: family_id + class_title = event title + stepup payment
-- ============================================================================

-- First, let's see what needs to be linked (preview query):
-- SELECT
--   e.id AS enrollment_id,
--   e.family_id,
--   e.class_title,
--   e.created_at AS enrollment_created,
--   o.id AS order_id,
--   ev.title AS event_title,
--   o.payment_method,
--   o.payment_status,
--   o.created_at AS order_created
-- FROM enrollments e
-- JOIN services s ON e.service_id = s.id
-- LEFT JOIN event_orders o ON e.family_id = o.family_id
-- LEFT JOIN event_events ev ON o.event_id = ev.id
--   AND ev.event_type = 'class'
--   AND (ev.title ILIKE '%' || e.class_title || '%' OR e.class_title ILIKE '%' || ev.title || '%')
-- WHERE s.code = 'elective_classes'
--   AND e.event_order_id IS NULL
--   AND o.payment_method = 'stepup'
-- ORDER BY e.family_id, e.created_at;

-- Perform the actual update:
UPDATE enrollments e
SET event_order_id = matched.order_id
FROM (
  SELECT DISTINCT ON (e.id)
    e.id AS enrollment_id,
    o.id AS order_id
  FROM enrollments e
  JOIN services s ON e.service_id = s.id
  JOIN event_orders o ON e.family_id = o.family_id
  JOIN event_events ev ON o.event_id = ev.id
  WHERE s.code = 'elective_classes'
    AND e.event_order_id IS NULL
    AND o.payment_method = 'stepup'
    AND ev.event_type = 'class'
    AND (
      -- Match class title to event title (case-insensitive, partial match)
      ev.title ILIKE '%' || e.class_title || '%'
      OR e.class_title ILIKE '%' || ev.title || '%'
    )
  ORDER BY e.id, o.created_at DESC
) matched
WHERE e.id = matched.enrollment_id;

-- ============================================================================
-- VERIFICATION: Check what got linked
-- ============================================================================

-- Count linked enrollments:
-- SELECT
--   COUNT(*) FILTER (WHERE event_order_id IS NOT NULL) AS linked,
--   COUNT(*) FILTER (WHERE event_order_id IS NULL) AS unlinked,
--   COUNT(*) AS total
-- FROM enrollments e
-- JOIN services s ON e.service_id = s.id
-- WHERE s.code = 'elective_classes';

-- ============================================================================
-- STEP 4: Create view for pending Step Up event registrations
-- Used by GenerateDraftsModal to find unbilled events
-- ============================================================================

CREATE OR REPLACE VIEW event_orders_pending_billing AS
SELECT
  o.id,
  o.event_id,
  o.family_id,
  o.purchaser_email,
  o.purchaser_name,
  o.quantity,
  o.total_cents,
  o.payment_status,
  o.payment_method,
  o.created_at,
  e.title AS event_title,
  e.event_type,
  e.start_at AS event_date,
  f.display_name AS family_name
FROM event_orders o
JOIN event_events e ON o.event_id = e.id
LEFT JOIN families f ON o.family_id = f.id
WHERE o.payment_method = 'stepup'
  AND o.payment_status = 'stepup_pending'
  AND o.invoice_id IS NULL
ORDER BY e.event_type, o.created_at DESC;

COMMENT ON VIEW event_orders_pending_billing IS
  'Step Up event/class orders that have not been invoiced yet';
