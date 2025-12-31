-- ============================================================================
-- MIGRATION: Invoice Number Generation & Stripe Payment Integration
-- Date: 2024-12-31
-- Description:
--   1. Add auto-generated invoice numbers (INV-YYYY-NNNN format)
--   2. Add Stripe webhook tracking table for payment processing
-- ============================================================================

-- ============================================================================
-- PART 1: INVOICE NUMBER GENERATION
-- ============================================================================

-- Counter table for year-based invoice numbering
CREATE TABLE invoice_number_counter (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Initialize with current year
INSERT INTO invoice_number_counter (year, last_number)
VALUES (EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER, 0);

-- Function to generate next invoice number (INV-YYYY-NNNN)
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  current_year INTEGER;
  next_number INTEGER;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;

  -- Upsert: increment existing year or create new year entry
  INSERT INTO invoice_number_counter (year, last_number, updated_at)
  VALUES (current_year, 1, now())
  ON CONFLICT (year) DO UPDATE
  SET last_number = invoice_number_counter.last_number + 1,
      updated_at = now()
  RETURNING last_number INTO next_number;

  -- Return formatted: INV-2025-0001
  RETURN 'INV-' || current_year || '-' || LPAD(next_number::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Trigger function to auto-assign invoice number on insert
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := generate_invoice_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on invoices table
CREATE TRIGGER invoice_number_trigger
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION set_invoice_number();

-- ============================================================================
-- PART 2: STRIPE WEBHOOK TRACKING
-- ============================================================================

-- Table to track processed Stripe webhook events (for idempotency)
CREATE TABLE stripe_invoice_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  amount_paid NUMERIC(10,2),
  processed_at TIMESTAMPTZ,
  processing_status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast event lookup
CREATE INDEX idx_stripe_invoice_webhooks_event_id ON stripe_invoice_webhooks(stripe_event_id);
CREATE INDEX idx_stripe_invoice_webhooks_invoice_id ON stripe_invoice_webhooks(invoice_id);
CREATE INDEX idx_stripe_invoice_webhooks_status ON stripe_invoice_webhooks(processing_status);

-- ============================================================================
-- OPTIONAL: Backfill existing invoices with invoice numbers
-- Uncomment and run if you want to assign numbers to existing invoices
-- ============================================================================

-- WITH numbered AS (
--   SELECT
--     id,
--     EXTRACT(YEAR FROM invoice_date)::INTEGER as inv_year,
--     ROW_NUMBER() OVER (
--       PARTITION BY EXTRACT(YEAR FROM invoice_date)
--       ORDER BY created_at
--     ) as row_num
--   FROM invoices
--   WHERE invoice_number IS NULL
-- )
-- UPDATE invoices
-- SET invoice_number = 'INV-' || numbered.inv_year || '-' || LPAD(numbered.row_num::TEXT, 4, '0')
-- FROM numbered
-- WHERE invoices.id = numbered.id;

-- Update counter to reflect backfilled numbers
-- UPDATE invoice_number_counter
-- SET last_number = (
--   SELECT COALESCE(MAX(
--     CAST(SPLIT_PART(invoice_number, '-', 3) AS INTEGER)
--   ), 0)
--   FROM invoices
--   WHERE EXTRACT(YEAR FROM invoice_date) = invoice_number_counter.year
-- );
