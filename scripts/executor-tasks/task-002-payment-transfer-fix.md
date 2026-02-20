You are an executor agent. Follow these instructions EXACTLY. Do not improvise or add features beyond what is specified. After making changes, run `npm run build` and `npm run lint` to verify.

# Task: Fix T3 trigger to handle payment transfers (recalculate OLD invoice)

## Problem

The `update_invoice_on_payment()` trigger function only recalculates `amount_paid` on `NEW.invoice_id`. When a payment is transferred (UPDATE that changes `invoice_id`), the OLD invoice keeps stale `amount_paid`.

## Current trigger function (in DATABASE_SCHEMA.sql and live in Supabase)

```sql
CREATE OR REPLACE FUNCTION update_invoice_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  invoice_total numeric;
  total_paid numeric;
BEGIN
  SELECT total_amount INTO invoice_total FROM invoices WHERE id = NEW.invoice_id;
  SELECT COALESCE(SUM(amount), 0) INTO total_paid FROM payments WHERE invoice_id = NEW.invoice_id;

  UPDATE invoices
  SET
    amount_paid = total_paid,
    status = CASE
      WHEN total_paid >= invoice_total THEN 'paid'::invoice_status
      WHEN total_paid > 0 THEN 'partial'::invoice_status
      ELSE status
    END
  WHERE id = NEW.invoice_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## Exact fix required

Replace the trigger function with a new version that:
1. Always recalculates the NEW invoice (existing behavior, unchanged)
2. On UPDATE where `OLD.invoice_id IS DISTINCT FROM NEW.invoice_id` (payment transfer), ALSO recalculate the OLD invoice
3. When recalculating the OLD invoice: if total_paid = 0, set status back to 'draft' (not 'partial' or 'paid'). If total_paid > 0 but < total_amount, set 'partial'. If total_paid >= total_amount, set 'paid'.
4. On DELETE, recalculate the invoice that lost the payment (use OLD.invoice_id)

Here is the exact SQL to apply via Supabase migration:

```sql
CREATE OR REPLACE FUNCTION update_invoice_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_total numeric;
  v_total_paid numeric;
  v_target_id uuid;
BEGIN
  -- For DELETE, recalculate the invoice that lost the payment
  IF TG_OP = 'DELETE' THEN
    v_target_id := OLD.invoice_id;
  ELSE
    v_target_id := NEW.invoice_id;
  END IF;

  -- Recalculate the target (NEW) invoice
  IF v_target_id IS NOT NULL THEN
    SELECT total_amount INTO v_invoice_total FROM invoices WHERE id = v_target_id;
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid FROM payments WHERE invoice_id = v_target_id;

    UPDATE invoices
    SET
      amount_paid = v_total_paid,
      status = CASE
        WHEN v_total_paid >= v_invoice_total THEN 'paid'::invoice_status
        WHEN v_total_paid > 0 THEN 'partial'::invoice_status
        WHEN v_total_paid = 0 THEN 'draft'::invoice_status
        ELSE status
      END
    WHERE id = v_target_id;
  END IF;

  -- On UPDATE: if invoice_id changed (payment transfer), also recalculate the OLD invoice
  IF TG_OP = 'UPDATE' AND OLD.invoice_id IS DISTINCT FROM NEW.invoice_id AND OLD.invoice_id IS NOT NULL THEN
    SELECT total_amount INTO v_invoice_total FROM invoices WHERE id = OLD.invoice_id;
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid FROM payments WHERE invoice_id = OLD.invoice_id;

    UPDATE invoices
    SET
      amount_paid = v_total_paid,
      status = CASE
        WHEN v_total_paid >= v_invoice_total THEN 'paid'::invoice_status
        WHEN v_total_paid > 0 THEN 'partial'::invoice_status
        WHEN v_total_paid = 0 THEN 'draft'::invoice_status
        ELSE status
      END
    WHERE id = OLD.invoice_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;
```

Also recreate the trigger to include DELETE:

```sql
DROP TRIGGER IF EXISTS payment_updates_invoice ON payments;
CREATE TRIGGER payment_updates_invoice
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_invoice_on_payment();
```

## Steps

1. Apply the SQL above as a Supabase migration using the `mcp__supabase__apply_migration` tool with name `fix_payment_transfer_recalculates_old_invoice`. Combine both SQL blocks (CREATE OR REPLACE FUNCTION + DROP/CREATE TRIGGER) into a single migration.

2. Update `docs/DATABASE_SCHEMA.sql` — find the existing `update_invoice_on_payment` function and replace it with the new version. Also update the trigger definition to include DELETE.

3. Update `INTERFACES.md` — find the T3 section (search for "T3. Payment Updates Invoice" or "payment_updates_invoice"). Make these changes:
   - Change the Event from "AFTER INSERT OR UPDATE" to "AFTER INSERT OR UPDATE OR DELETE"
   - Update the description to mention it handles payment transfers by recalculating both old and new invoices
   - Remove or update the gotcha about stale balances — the trigger now handles this automatically
   - Note that when total_paid drops to 0, status resets to 'draft'

4. Update `CLAUDE.md` — find the line that says "DON'T assume payment_updates_invoice fires on UPDATE" (in the Common Mistakes section). Replace it with: "DON'T worry about stale invoice balances on payment transfer — T3 now recalculates both old and new invoices automatically. However, voiding/deleting invoices with payments should still be done carefully."

5. Update `optimization-roadmap.md` — find item #2 in the tracking table and change its status from "Not started" to "Complete" and add today's date (2026-02-20).

6. Run `npm run build` and report the result.
7. Run `npm run lint` and report the result.
