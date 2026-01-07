-- Migration: Auto-convert leads when enrollment is created
-- When an enrollment with status 'active' or 'trial' is created,
-- automatically convert any matching leads (by email) to 'converted' status.

-- Create the trigger function
CREATE OR REPLACE FUNCTION auto_convert_leads_on_enrollment()
RETURNS TRIGGER AS $$
DECLARE
  family_email TEXT;
BEGIN
  -- Get the family's primary email
  SELECT primary_email INTO family_email
  FROM families
  WHERE id = NEW.family_id;

  IF family_email IS NOT NULL THEN
    -- Convert any active leads with matching email (case-insensitive)
    UPDATE leads
    SET
      status = 'converted',
      converted_at = NOW(),
      family_id = NEW.family_id,
      updated_at = NOW()
    WHERE
      LOWER(email) = LOWER(family_email)
      AND status IN ('new', 'contacted');

    -- Log if any leads were converted
    IF FOUND THEN
      RAISE NOTICE 'Auto-converted lead(s) for email % to family %', family_email, NEW.family_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger on enrollments table
-- Only fires for active or trial enrollments (not pending, ended, etc.)
DROP TRIGGER IF EXISTS enrollment_auto_convert_lead ON enrollments;
CREATE TRIGGER enrollment_auto_convert_lead
AFTER INSERT ON enrollments
FOR EACH ROW
WHEN (NEW.status IN ('active', 'trial'))
EXECUTE FUNCTION auto_convert_leads_on_enrollment();

-- Also handle enrollment status updates (e.g., pending -> active)
DROP TRIGGER IF EXISTS enrollment_status_change_auto_convert_lead ON enrollments;
CREATE TRIGGER enrollment_status_change_auto_convert_lead
AFTER UPDATE OF status ON enrollments
FOR EACH ROW
WHEN (OLD.status NOT IN ('active', 'trial') AND NEW.status IN ('active', 'trial'))
EXECUTE FUNCTION auto_convert_leads_on_enrollment();

COMMENT ON FUNCTION auto_convert_leads_on_enrollment IS 'Automatically converts leads to "converted" status when a matching enrollment is created or activated';
