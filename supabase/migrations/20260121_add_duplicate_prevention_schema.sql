-- Migration: Add schema for duplicate family prevention
--
-- Adds secondary_email column and family_merge_log table for tracking
-- name-based family matches when email lookup fails.
--
-- Note: normalize_name_to_last_first() function already exists from
-- 20260108_fix_class_registration_duplicates.sql and will be reused.

-- 1. Add secondary_email to families for storing alternate emails
ALTER TABLE families ADD COLUMN IF NOT EXISTS secondary_email TEXT;

COMMENT ON COLUMN families.secondary_email IS
'Alternate email discovered during name-based matching or manual merge. Stored for reference and future lookups.';

-- 2. Create audit log for name-based merges
CREATE TABLE IF NOT EXISTS family_merge_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE SET NULL,
  matched_by TEXT NOT NULL,  -- 'email', 'name', or 'manual'
  original_email TEXT,       -- Email on the existing family
  new_email TEXT,            -- Email from the incoming record
  purchaser_name TEXT,       -- Name used for matching
  source TEXT NOT NULL,      -- 'event_order', 'ingest_lead', 'calendly_webhook', 'manual'
  source_id TEXT,            -- Reference ID from source (order_id, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_family_merge_log_family_id ON family_merge_log(family_id);
CREATE INDEX idx_family_merge_log_created_at ON family_merge_log(created_at DESC);

COMMENT ON TABLE family_merge_log IS
'Audit trail for family matching and merging. Logs when an incoming record matches an existing family by name (not email), enabling review of potential false positives.';

-- 3. Add index for name-based lookups on families
-- Uses normalized name comparison for matching "First Last" to "Last, First"
CREATE INDEX IF NOT EXISTS idx_families_display_name_lower
  ON families (LOWER(display_name))
  WHERE display_name LIKE '%,%';

COMMENT ON INDEX idx_families_display_name_lower IS
'Optimizes name-based family lookups for "Last, First" formatted names.';

-- 4. Add index for secondary_email lookups
CREATE INDEX IF NOT EXISTS idx_families_secondary_email_lower
  ON families (LOWER(secondary_email))
  WHERE secondary_email IS NOT NULL;

COMMENT ON INDEX idx_families_secondary_email_lower IS
'Enables fast lookup by secondary email address.';

-- 5. Create function to find or create family for a purchase
-- Used by external integrations (n8n, webhooks) to match purchasers to families
-- Returns existing family_id or creates new family if no match found
CREATE OR REPLACE FUNCTION find_or_create_family_for_purchase(
  p_email TEXT,
  p_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'event_order',
  p_source_id TEXT DEFAULT NULL,
  p_create_as_active BOOLEAN DEFAULT TRUE  -- TRUE for paying customers, FALSE for leads
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_email TEXT;
  v_normalized_name TEXT;
  v_family_id UUID;
  v_family_email TEXT;
  v_matched_by TEXT;
BEGIN
  -- Normalize email
  v_email := LOWER(TRIM(COALESCE(p_email, '')));

  IF v_email = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  -- Step 1: Try email match (primary or secondary)
  SELECT id, primary_email INTO v_family_id, v_family_email
  FROM families
  WHERE LOWER(primary_email) = v_email
     OR LOWER(secondary_email) = v_email
  ORDER BY
    CASE status WHEN 'active' THEN 1 WHEN 'lead' THEN 2 ELSE 3 END,
    created_at
  LIMIT 1;

  IF v_family_id IS NOT NULL THEN
    -- Found by email - no logging needed for email matches
    RETURN v_family_id;
  END IF;

  -- Step 2: Try name match if name has a space (first AND last name)
  IF p_name IS NOT NULL AND TRIM(p_name) LIKE '% %' THEN
    v_normalized_name := normalize_name_to_last_first(TRIM(p_name));

    SELECT id, primary_email INTO v_family_id, v_family_email
    FROM families
    WHERE LOWER(normalize_name_to_last_first(display_name)) = LOWER(v_normalized_name)
      AND status IN ('active', 'lead')
    ORDER BY
      CASE status WHEN 'active' THEN 1 WHEN 'lead' THEN 2 END,
      created_at
    LIMIT 1;

    IF v_family_id IS NOT NULL THEN
      -- Found by name! Log it and store secondary email
      v_matched_by := 'name';

      INSERT INTO family_merge_log (
        family_id, matched_by, original_email, new_email,
        purchaser_name, source, source_id
      ) VALUES (
        v_family_id, v_matched_by, v_family_email, v_email,
        p_name, p_source, p_source_id
      );

      -- Store new email as secondary if not already stored
      UPDATE families
      SET secondary_email = v_email
      WHERE id = v_family_id
        AND secondary_email IS NULL
        AND LOWER(primary_email) != v_email;

      -- If creating as active and family is still a lead, upgrade
      IF p_create_as_active THEN
        UPDATE families
        SET status = 'active',
            lead_status = 'converted',
            converted_at = NOW()
        WHERE id = v_family_id
          AND status = 'lead';
      END IF;

      RETURN v_family_id;
    END IF;
  END IF;

  -- Step 3: No match found - create new family
  v_normalized_name := normalize_name_to_last_first(COALESCE(TRIM(p_name), SPLIT_PART(v_email, '@', 1)));

  INSERT INTO families (
    display_name,
    primary_email,
    primary_phone,
    primary_contact_name,
    status,
    lead_status,
    lead_type
  ) VALUES (
    v_normalized_name,
    v_email,
    NULLIF(TRIM(COALESCE(p_phone, '')), ''),
    NULLIF(TRIM(COALESCE(p_name, '')), ''),
    CASE WHEN p_create_as_active THEN 'active' ELSE 'lead' END,
    CASE WHEN p_create_as_active THEN NULL ELSE 'new' END,
    CASE WHEN p_create_as_active THEN NULL ELSE p_source END
  )
  RETURNING id INTO v_family_id;

  RETURN v_family_id;
END;
$$;

COMMENT ON FUNCTION find_or_create_family_for_purchase IS
'Finds existing family by email or name, or creates a new one.
Used during event purchases to prevent duplicates when purchasers use different emails.
- First tries email match (primary + secondary)
- Then tries normalized name match if name has both first and last
- Logs name-based matches to family_merge_log for audit
- Creates new family if no match found';
