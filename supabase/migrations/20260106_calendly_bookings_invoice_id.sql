-- Migration: Add invoice_id to calendly_bookings
-- This allows linking Hub drop-off bookings to their generated invoices
-- similar to how event_orders links to invoices

-- Add invoice_id column with foreign key to invoices
ALTER TABLE calendly_bookings
ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;

-- Create index for efficient lookup of bookings by invoice
CREATE INDEX IF NOT EXISTS calendly_bookings_invoice_id_idx ON calendly_bookings(invoice_id);

-- Add comment explaining the relationship
COMMENT ON COLUMN calendly_bookings.invoice_id IS
'Links hub_dropoff bookings to their generated invoice for payment tracking';
