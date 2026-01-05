-- ============================================================================
-- CLEANUP: Remove stale hub_sessions records
-- ============================================================================
-- These are orphaned records that were never billed and should not exist.
-- The hub_sessions table should only contain actual drop-in sessions that
-- either have been billed (invoice_line_item_id IS NOT NULL) or are pending
-- billing for recent sessions.
-- ============================================================================

-- Delete all unbilled hub_sessions records (stale data)
DELETE FROM hub_sessions WHERE invoice_line_item_id IS NULL;
