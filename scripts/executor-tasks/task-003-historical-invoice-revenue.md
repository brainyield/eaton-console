You are an executor agent. Follow these instructions EXACTLY. Do not improvise or add features beyond what is specified. After making changes, run `npm run build` and `npm run lint` to verify.

# Task: Fix T2 trigger to create revenue records on historical invoice INSERT

## Problem

The `create_revenue_records_on_payment()` trigger only fires on `AFTER UPDATE ON invoices`. The `createHistoricalInvoice` mutation inserts invoices directly with `status='paid'`, bypassing T2 entirely. These paid invoices never generate revenue records.

## Current trigger function

The existing function has this guard at the top:
```sql
IF OLD.status = 'paid' OR NEW.status != 'paid' THEN
  RETURN NEW;
END IF;
```

This uses `OLD` which doesn't exist during INSERT, so we can't just add INSERT to the existing trigger. We need a separate function for the INSERT case.

## Exact fix required

### Step 1: Apply Supabase migration

Use the `mcp__supabase__apply_migration` tool with name `add_revenue_records_on_invoice_insert`. Apply this SQL:

```sql
-- Separate function for INSERT case (no OLD row available)
CREATE OR REPLACE FUNCTION create_revenue_records_on_invoice_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if inserted as 'paid'
  IF NEW.status != 'paid' THEN
    RETURN NEW;
  END IF;

  -- Skip invoices dated before 2026-01-01 (historical data protection)
  IF NEW.invoice_date < '2026-01-01'::date THEN
    RETURN NEW;
  END IF;

  -- Insert revenue records for each line item (same logic as UPDATE trigger)
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
    class_title,
    location_id
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
    e.class_title,
    CASE s.code
      WHEN 'ea-academic-homeschool' THEN (SELECT id FROM locations WHERE name = 'Eaton Academic')
      WHEN 'ea-academic-afterschool' THEN (SELECT id FROM locations WHERE name = 'Eaton Academic')
      WHEN 'ea-tutoring' THEN (SELECT id FROM locations WHERE name = 'Eaton Academic')
      WHEN 'cl-academic-homeschool' THEN (SELECT id FROM locations WHERE name = 'City Life')
      WHEN 'cl-academic-afterschool' THEN (SELECT id FROM locations WHERE name = 'City Life')
      WHEN 'cl-tutoring' THEN (SELECT id FROM locations WHERE name = 'City Life')
      ELSE NULL
    END
  FROM invoice_line_items li
  LEFT JOIN enrollments e ON e.id = li.enrollment_id
  LEFT JOIN services s ON s.id = e.service_id
  WHERE li.invoice_id = NEW.id
    AND li.amount IS NOT NULL
    AND li.amount > 0
  ON CONFLICT (source_line_item_id) WHERE source_line_item_id IS NOT NULL
  DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the INSERT trigger (separate from the existing UPDATE trigger)
CREATE TRIGGER trigger_create_revenue_on_invoice_insert
AFTER INSERT ON invoices
FOR EACH ROW
EXECUTE FUNCTION create_revenue_records_on_invoice_insert();
```

IMPORTANT: Check the existing `create_revenue_records_on_payment()` function first to see if it has a location_id CASE mapping. If the existing function does NOT have the CASE mapping for location_id (check the live DB function), then REMOVE the location_id column and CASE block from the INSERT function above. The INSERT function should match the columns used by the UPDATE function.

To check, run this SQL query first:
```sql
SELECT prosrc FROM pg_proc WHERE proname = 'create_revenue_records_on_payment';
```

If the existing function doesn't include `location_id`, remove it from the new function too.

### Step 2: Update docs/DATABASE_SCHEMA.sql

Add the new function and trigger definition after the existing `create_revenue_records_on_payment` function section.

### Step 3: Update INTERFACES.md

Find the T2 section (search for "T2" or "trigger_create_revenue_on_payment"). Add documentation for the new INSERT trigger:
- New trigger name: `trigger_create_revenue_on_invoice_insert`
- Event: AFTER INSERT ON invoices
- Function: `create_revenue_records_on_invoice_insert()`
- Purpose: Creates revenue records when invoices are inserted directly as 'paid' (e.g., historical imports)
- Same date guard (>= 2026-01-01) and ON CONFLICT behavior
- Note that this complements the existing UPDATE trigger — UPDATE handles status changes to 'paid', INSERT handles direct inserts as 'paid'

### Step 4: Update optimization-roadmap.md

Find item #3 in the tracking table and change its status from "Not started" to "Complete" and add today's date (2026-02-20).

### Step 5: Verify

Run `npm run build` and `npm run lint`. Report results.
