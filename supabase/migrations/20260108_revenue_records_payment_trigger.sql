-- Migration: Create revenue_records entries when invoices are paid
--
-- SAFETY: This trigger only processes invoices dated 2026-01-01 or later.
-- Historical data (Aug-Dec 2025) is preserved and will not be modified.

-- Add source_line_item_id column for tracking which line item created each revenue record
ALTER TABLE revenue_records
ADD COLUMN IF NOT EXISTS source_line_item_id uuid;

-- Create unique index on source_line_item_id (only for non-null values)
-- This prevents duplicate revenue records from the same line item
CREATE UNIQUE INDEX IF NOT EXISTS revenue_records_source_line_item_unique
ON revenue_records (source_line_item_id)
WHERE source_line_item_id IS NOT NULL;

-- Add index on source_invoice_id for query performance
CREATE INDEX IF NOT EXISTS revenue_records_source_invoice_idx
ON revenue_records (source_invoice_id)
WHERE source_invoice_id IS NOT NULL;

-- Create trigger function to create revenue records when invoice is paid
CREATE OR REPLACE FUNCTION create_revenue_records_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if status changed TO 'paid' (not already paid)
  IF OLD.status = 'paid' OR NEW.status != 'paid' THEN
    RETURN NEW;
  END IF;

  -- Skip invoices dated before 2026-01-01 (historical data protection)
  IF NEW.invoice_date < '2026-01-01'::date THEN
    RETURN NEW;
  END IF;

  -- Insert revenue records for each line item
  -- Uses ON CONFLICT DO NOTHING to safely handle re-runs
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
    NEW.family_id,
    e.student_id,
    e.service_id,
    COALESCE(NEW.period_start, NEW.invoice_date),
    COALESCE(NEW.period_end, NEW.due_date, NEW.invoice_date),
    li.amount,
    'invoice',
    NEW.id,
    li.id,
    e.class_title
  FROM invoice_line_items li
  LEFT JOIN enrollments e ON e.id = li.enrollment_id
  WHERE li.invoice_id = NEW.id
    AND li.amount IS NOT NULL
    AND li.amount > 0
  ON CONFLICT (source_line_item_id) WHERE source_line_item_id IS NOT NULL
  DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on invoices table for UPDATE only
DROP TRIGGER IF EXISTS trigger_create_revenue_on_payment ON invoices;

CREATE TRIGGER trigger_create_revenue_on_payment
AFTER UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION create_revenue_records_on_payment();
