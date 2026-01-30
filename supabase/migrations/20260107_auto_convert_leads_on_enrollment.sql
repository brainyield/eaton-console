-- Migration: Auto-convert leads when enrollment is created
-- When an enrollment with status 'active' or 'trial' is created,
-- automatically convert any matching lead families to 'converted' status.
--
-- IMPORTANT: Leads are stored as families with status='lead', NOT in a separate leads table.

-- Drop the old triggers first (in case they exist)
DROP TRIGGER IF EXISTS enrollment_auto_convert_lead ON enrollments;
DROP TRIGGER IF EXISTS enrollment_status_change_auto_convert_lead ON enrollments;

-- Create the trigger function
CREATE OR REPLACE FUNCTION auto_convert_leads_on_enrollment()
RETURNS TRIGGER AS $$
DECLARE
  family_email TEXT;
  family_secondary_email TEXT;
  converted_count INT;
BEGIN
  -- Get the family's emails
  SELECT primary_email, secondary_email INTO family_email, family_secondary_email
  FROM families
  WHERE id = NEW.family_id;

  -- Convert any lead families with matching email (case-insensitive)
  -- Check both primary and secondary emails
  IF family_email IS NOT NULL OR family_secondary_email IS NOT NULL THEN
    UPDATE families
    SET
      status = 'active',
      lead_status = 'converted',
      converted_at = NOW(),
      notes = COALESCE(notes || E'\n', '') || 'Auto-converted: enrollment created for matching family'
    WHERE
      status = 'lead'
      AND lead_status IN ('new', 'contacted')
      AND id != NEW.family_id  -- Don't update the same family
      AND (
        (family_email IS NOT NULL AND LOWER(primary_email) = LOWER(family_email))
        OR (family_email IS NOT NULL AND LOWER(secondary_email) = LOWER(family_email))
        OR (family_secondary_email IS NOT NULL AND LOWER(primary_email) = LOWER(family_secondary_email))
        OR (family_secondary_email IS NOT NULL AND LOWER(secondary_email) = LOWER(family_secondary_email))
      );

    GET DIAGNOSTICS converted_count = ROW_COUNT;

    IF converted_count > 0 THEN
      RAISE NOTICE 'Auto-converted % lead(s) for family %', converted_count, NEW.family_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger on enrollments table
-- Only fires for active or trial enrollments (not pending, ended, etc.)
CREATE TRIGGER enrollment_auto_convert_lead
AFTER INSERT ON enrollments
FOR EACH ROW
WHEN (NEW.status IN ('active', 'trial'))
EXECUTE FUNCTION auto_convert_leads_on_enrollment();

-- Also handle enrollment status updates (e.g., pending -> active)
CREATE TRIGGER enrollment_status_change_auto_convert_lead
AFTER UPDATE OF status ON enrollments
FOR EACH ROW
WHEN (OLD.status NOT IN ('active', 'trial') AND NEW.status IN ('active', 'trial'))
EXECUTE FUNCTION auto_convert_leads_on_enrollment();

COMMENT ON FUNCTION auto_convert_leads_on_enrollment IS
'Automatically converts lead families (status=lead) to active when an enrollment is created for a family with matching email.';
