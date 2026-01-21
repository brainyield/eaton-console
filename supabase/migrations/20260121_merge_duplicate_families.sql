-- Migration: Merge existing duplicate families
--
-- These are families with the same name but different emails (typos, alternate emails).
-- This migration reassigns all related records to the older family and deletes duplicates.
--
-- True Duplicates to Merge (4 active family pairs):
-- 1. Interian, Diana - email typo
-- 2. Quintero, Cristal - different email
-- 3. Diaz, Erika - email typo (active + lead)
-- 4. Martinez, Disneydi - different email

-- Helper function to merge two families
-- Reassigns all FK relationships from source to target, stores secondary email, then deletes source
CREATE OR REPLACE FUNCTION merge_family(
  p_keep_id UUID,     -- The family to keep (older/primary)
  p_delete_id UUID,   -- The family to delete (duplicate)
  p_reason TEXT DEFAULT 'duplicate'
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_delete_email TEXT;
  v_keep_email TEXT;
BEGIN
  -- Get emails for logging
  SELECT primary_email INTO v_delete_email FROM families WHERE id = p_delete_id;
  SELECT primary_email INTO v_keep_email FROM families WHERE id = p_keep_id;

  IF v_delete_email IS NULL THEN
    RAISE NOTICE 'Source family % not found, skipping', p_delete_id;
    RETURN;
  END IF;

  IF v_keep_email IS NULL THEN
    RAISE EXCEPTION 'Target family % not found', p_keep_id;
  END IF;

  RAISE NOTICE 'Merging family % (%) into % (%)', p_delete_id, v_delete_email, p_keep_id, v_keep_email;

  -- Reassign ALL related records (13 tables with family_id FK)
  UPDATE calendly_bookings SET family_id = p_keep_id WHERE family_id = p_delete_id;
  UPDATE communications SET family_id = p_keep_id WHERE family_id = p_delete_id;
  UPDATE enrollments SET family_id = p_keep_id WHERE family_id = p_delete_id;
  UPDATE event_orders SET family_id = p_keep_id WHERE family_id = p_delete_id;
  UPDATE family_contacts SET family_id = p_keep_id WHERE family_id = p_delete_id;
  UPDATE family_tags SET family_id = p_keep_id WHERE family_id = p_delete_id;
  UPDATE invoices SET family_id = p_keep_id WHERE family_id = p_delete_id;
  UPDATE lead_activities SET family_id = p_keep_id WHERE family_id = p_delete_id;
  UPDATE lead_campaign_engagement SET family_id = p_keep_id WHERE family_id = p_delete_id;
  UPDATE lead_follow_ups SET family_id = p_keep_id WHERE family_id = p_delete_id;
  UPDATE lead_score_history SET family_id = p_keep_id WHERE family_id = p_delete_id;
  UPDATE revenue_records SET family_id = p_keep_id WHERE family_id = p_delete_id;
  UPDATE students SET family_id = p_keep_id WHERE family_id = p_delete_id;

  -- Store secondary email on kept family (if not already set)
  UPDATE families
  SET secondary_email = v_delete_email
  WHERE id = p_keep_id
    AND secondary_email IS NULL
    AND LOWER(primary_email) != LOWER(v_delete_email);

  -- Log the merge
  INSERT INTO family_merge_log (
    family_id, matched_by, original_email, new_email,
    purchaser_name, source, source_id
  )
  SELECT
    p_keep_id,
    'manual',
    v_keep_email,
    v_delete_email,
    display_name,
    'manual_merge',
    p_delete_id::TEXT
  FROM families WHERE id = p_delete_id;

  -- Delete the duplicate family
  DELETE FROM families WHERE id = p_delete_id;

  RAISE NOTICE 'Successfully merged and deleted family %', p_delete_id;
END;
$$;

COMMENT ON FUNCTION merge_family IS
'Merges two family records by reassigning all FK relationships from source to target, storing secondary email, and deleting the source family.';

-- Execute merges for identified duplicates
-- Using DO block to allow conditional execution

DO $$
BEGIN
  -- Merge 1: Interian, Diana - email typo
  -- Keep: f27fa78e-ba40-4114-a656-b28b9f44e71a (older)
  -- Delete: a62ea77b-ecde-4c03-941f-e9f1fa8c3274 (newer, typo email)
  IF EXISTS (SELECT 1 FROM families WHERE id = 'a62ea77b-ecde-4c03-941f-e9f1fa8c3274') THEN
    PERFORM merge_family(
      'f27fa78e-ba40-4114-a656-b28b9f44e71a'::UUID,
      'a62ea77b-ecde-4c03-941f-e9f1fa8c3274'::UUID,
      'email_typo'
    );
  END IF;

  -- Merge 2: Quintero, Cristal - different email
  -- Keep: af301ec6-a9fb-444a-b066-bc82772439db (older)
  -- Delete: 2d42a605-08df-4275-9a6f-096aa90fd8e1 (newer, different email)
  IF EXISTS (SELECT 1 FROM families WHERE id = '2d42a605-08df-4275-9a6f-096aa90fd8e1') THEN
    PERFORM merge_family(
      'af301ec6-a9fb-444a-b066-bc82772439db'::UUID,
      '2d42a605-08df-4275-9a6f-096aa90fd8e1'::UUID,
      'different_email'
    );
  END IF;

  -- Merge 3: Diaz, Erika - email typo (active + lead)
  -- Keep: 5caa922b-3ab3-4ba8-b843-ed04ad0688d0 (older, active)
  -- Delete: a5cb0101-ac27-4ce3-ba18-760a7fe97261 (newer, lead with typo)
  IF EXISTS (SELECT 1 FROM families WHERE id = 'a5cb0101-ac27-4ce3-ba18-760a7fe97261') THEN
    PERFORM merge_family(
      '5caa922b-3ab3-4ba8-b843-ed04ad0688d0'::UUID,
      'a5cb0101-ac27-4ce3-ba18-760a7fe97261'::UUID,
      'email_typo'
    );
  END IF;

  -- Merge 4: Martinez, Disneydi - different email
  -- Keep: 022ca257-f409-4cc1-b958-b4f8515feb0e (older)
  -- Delete: d1bf170a-f958-485c-83e3-eaad59091172 (newer, different email)
  IF EXISTS (SELECT 1 FROM families WHERE id = 'd1bf170a-f958-485c-83e3-eaad59091172') THEN
    PERFORM merge_family(
      '022ca257-f409-4cc1-b958-b4f8515feb0e'::UUID,
      'd1bf170a-f958-485c-83e3-eaad59091172'::UUID,
      'different_email'
    );
  END IF;

  -- Lead duplicates (lower priority but included for completeness)

  -- Merge 5: matos, Rachel - race condition (30s apart)
  -- Keep: 9bbf8d6f-fdda-4bff-8da7-1102350e884d (older)
  -- Delete: 3f56c9a3-d872-4c83-aa7f-3ef6ac1ef1e9 (newer)
  IF EXISTS (SELECT 1 FROM families WHERE id = '3f56c9a3-d872-4c83-aa7f-3ef6ac1ef1e9') THEN
    PERFORM merge_family(
      '9bbf8d6f-fdda-4bff-8da7-1102350e884d'::UUID,
      '3f56c9a3-d872-4c83-aa7f-3ef6ac1ef1e9'::UUID,
      'race_condition'
    );
  END IF;

  -- Merge 6: Emma Booher - different emails
  -- Keep: 5d1ac549-b2c7-4313-943e-7bcf5c998e13 (older)
  -- Delete: 9650bd98-0202-4336-8f27-ef2407548c46 (newer)
  IF EXISTS (SELECT 1 FROM families WHERE id = '9650bd98-0202-4336-8f27-ef2407548c46') THEN
    PERFORM merge_family(
      '5d1ac549-b2c7-4313-943e-7bcf5c998e13'::UUID,
      '9650bd98-0202-4336-8f27-ef2407548c46'::UUID,
      'different_email'
    );
  END IF;

END $$;
