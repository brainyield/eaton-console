-- Migration: Add view and functions for detecting potential duplicate families
--
-- Identifies families with matching names but different emails.
-- Used for periodic admin review to catch edge cases.

CREATE OR REPLACE VIEW potential_duplicate_families AS
SELECT
  f1.id as family_1_id,
  f1.display_name,
  f1.primary_email as email_1,
  f1.secondary_email as secondary_email_1,
  f2.id as family_2_id,
  f2.primary_email as email_2,
  f2.secondary_email as secondary_email_2,
  f1.status as status_1,
  f2.status as status_2,
  f1.created_at as created_at_1,
  f2.created_at as created_at_2
FROM families f1
JOIN families f2 ON
  -- Match on normalized name (case-insensitive)
  LOWER(normalize_name_to_last_first(f1.display_name)) = LOWER(normalize_name_to_last_first(f2.display_name))
  -- Avoid self-joins and duplicates (only show each pair once)
  AND f1.id < f2.id
  -- Only full names with comma (first AND last)
  AND f1.display_name LIKE '%,%'
WHERE
  -- Only active or lead families
  f1.status IN ('active', 'lead')
  AND f2.status IN ('active', 'lead')
ORDER BY
  -- Prioritize active families first
  CASE WHEN f1.status = 'active' OR f2.status = 'active' THEN 0 ELSE 1 END,
  f1.display_name,
  f1.created_at;

COMMENT ON VIEW potential_duplicate_families IS
'Lists families with matching names but different emails. Used for admin review to identify potential duplicates that slipped through email/name matching.';

-- RPC function to fetch potential duplicates (for type safety before db:types regeneration)
CREATE OR REPLACE FUNCTION get_potential_duplicate_families()
RETURNS TABLE (
  family_1_id UUID,
  display_name TEXT,
  email_1 TEXT,
  secondary_email_1 TEXT,
  family_2_id UUID,
  email_2 TEXT,
  secondary_email_2 TEXT,
  status_1 TEXT,
  status_2 TEXT,
  created_at_1 TIMESTAMPTZ,
  created_at_2 TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
AS $$
  SELECT * FROM potential_duplicate_families;
$$;

-- RPC function to fetch family merge log (for type safety before db:types regeneration)
CREATE OR REPLACE FUNCTION get_family_merge_log(limit_count INT DEFAULT 100)
RETURNS TABLE (
  id UUID,
  family_id UUID,
  matched_by TEXT,
  original_email TEXT,
  new_email TEXT,
  purchaser_name TEXT,
  source TEXT,
  source_id TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    id, family_id, matched_by, original_email, new_email,
    purchaser_name, source, source_id, created_at
  FROM family_merge_log
  ORDER BY created_at DESC
  LIMIT limit_count;
$$;
