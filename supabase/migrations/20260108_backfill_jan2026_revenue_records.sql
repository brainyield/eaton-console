-- Migration: Backfill revenue_records for paid invoices before trigger deployment
--
-- Context: The revenue_records trigger was deployed on Jan 8, 2026 at 14:12 UTC.
-- Any invoices marked as paid before that time did not get revenue_records created.
-- This migration backfills those records using the same logic as the trigger.

-- Insert revenue records for paid 2026 invoices that don't have them yet
INSERT INTO revenue_records (
  family_id,
  student_id,
  service_id,
  period_start,
  period_end,
  revenue,
  source,
  source_invoice_id,
  source_line_item_id,
  class_title
)
SELECT
  i.family_id,
  e.student_id,
  e.service_id,
  COALESCE(i.period_start, i.invoice_date),
  COALESCE(i.period_end, i.due_date, i.invoice_date),
  li.amount,
  'invoice',
  i.id,
  li.id,
  e.class_title
FROM invoices i
JOIN invoice_line_items li ON li.invoice_id = i.id
LEFT JOIN enrollments e ON e.id = li.enrollment_id
WHERE i.status = 'paid'
  AND i.invoice_date >= '2026-01-01'
  AND li.amount IS NOT NULL
  AND li.amount > 0
  -- Only insert if not already exists (uses unique index on source_line_item_id)
ON CONFLICT (source_line_item_id) WHERE source_line_item_id IS NOT NULL
DO NOTHING;
