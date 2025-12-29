-- Migration: Format names to "Last, First" format
-- Run this in your Supabase SQL Editor
--
-- This script converts names from "First Last" to "Last, First" format.
-- It will skip:
--   - Names that already contain a comma (already formatted)
--   - Names with no spaces (single names/nicknames like "Noah" or "Brussel Sprouts")
--
-- IMPORTANT: Review the preview queries first before running the updates!

-- ============================================
-- PREVIEW: See what will be changed
-- ============================================

-- Preview families.display_name changes
SELECT
  id,
  display_name as current_name,
  CASE
    WHEN display_name LIKE '%,%' THEN display_name  -- Already has comma
    WHEN display_name NOT LIKE '% %' THEN display_name  -- No space (single name)
    ELSE
      -- Extract last word as last name, everything before as first names
      SPLIT_PART(display_name, ' ', -1) || ', ' ||
      TRIM(SUBSTRING(display_name FROM 1 FOR LENGTH(display_name) - LENGTH(SPLIT_PART(display_name, ' ', -1))))
  END as new_name
FROM families
WHERE display_name IS NOT NULL
  AND display_name NOT LIKE '%,%'  -- Not already formatted
  AND display_name LIKE '% %';     -- Has at least one space

-- Preview families.primary_contact_name changes
SELECT
  id,
  primary_contact_name as current_name,
  CASE
    WHEN primary_contact_name LIKE '%,%' THEN primary_contact_name
    WHEN primary_contact_name NOT LIKE '% %' THEN primary_contact_name
    ELSE
      SPLIT_PART(primary_contact_name, ' ', -1) || ', ' ||
      TRIM(SUBSTRING(primary_contact_name FROM 1 FOR LENGTH(primary_contact_name) - LENGTH(SPLIT_PART(primary_contact_name, ' ', -1))))
  END as new_name
FROM families
WHERE primary_contact_name IS NOT NULL
  AND primary_contact_name NOT LIKE '%,%'
  AND primary_contact_name LIKE '% %';

-- Preview students.full_name changes
SELECT
  id,
  full_name as current_name,
  CASE
    WHEN full_name LIKE '%,%' THEN full_name
    WHEN full_name NOT LIKE '% %' THEN full_name
    ELSE
      SPLIT_PART(full_name, ' ', -1) || ', ' ||
      TRIM(SUBSTRING(full_name FROM 1 FOR LENGTH(full_name) - LENGTH(SPLIT_PART(full_name, ' ', -1))))
  END as new_name
FROM students
WHERE full_name IS NOT NULL
  AND full_name NOT LIKE '%,%'
  AND full_name LIKE '% %';

-- Preview teachers.display_name changes
SELECT
  id,
  display_name as current_name,
  CASE
    WHEN display_name LIKE '%,%' THEN display_name
    WHEN display_name NOT LIKE '% %' THEN display_name
    ELSE
      SPLIT_PART(display_name, ' ', -1) || ', ' ||
      TRIM(SUBSTRING(display_name FROM 1 FOR LENGTH(display_name) - LENGTH(SPLIT_PART(display_name, ' ', -1))))
  END as new_name
FROM teachers
WHERE display_name IS NOT NULL
  AND display_name NOT LIKE '%,%'
  AND display_name LIKE '% %';

-- ============================================
-- UPDATE: Run these after reviewing previews
-- ============================================

-- Update families.display_name
UPDATE families
SET display_name = SPLIT_PART(display_name, ' ', -1) || ', ' ||
    TRIM(SUBSTRING(display_name FROM 1 FOR LENGTH(display_name) - LENGTH(SPLIT_PART(display_name, ' ', -1))))
WHERE display_name IS NOT NULL
  AND display_name NOT LIKE '%,%'
  AND display_name LIKE '% %';

-- Update families.primary_contact_name
UPDATE families
SET primary_contact_name = SPLIT_PART(primary_contact_name, ' ', -1) || ', ' ||
    TRIM(SUBSTRING(primary_contact_name FROM 1 FOR LENGTH(primary_contact_name) - LENGTH(SPLIT_PART(primary_contact_name, ' ', -1))))
WHERE primary_contact_name IS NOT NULL
  AND primary_contact_name NOT LIKE '%,%'
  AND primary_contact_name LIKE '% %';

-- Update students.full_name
UPDATE students
SET full_name = SPLIT_PART(full_name, ' ', -1) || ', ' ||
    TRIM(SUBSTRING(full_name FROM 1 FOR LENGTH(full_name) - LENGTH(SPLIT_PART(full_name, ' ', -1))))
WHERE full_name IS NOT NULL
  AND full_name NOT LIKE '%,%'
  AND full_name LIKE '% %';

-- Update teachers.display_name
UPDATE teachers
SET display_name = SPLIT_PART(display_name, ' ', -1) || ', ' ||
    TRIM(SUBSTRING(display_name FROM 1 FOR LENGTH(display_name) - LENGTH(SPLIT_PART(display_name, ' ', -1))))
WHERE display_name IS NOT NULL
  AND display_name NOT LIKE '%,%'
  AND display_name LIKE '% %';
