-- Migration: Add unique constraint on students (family_id, normalized name)
-- This prevents duplicate student names within the same family

-- First, check for any remaining duplicates and log them
-- (The merge script should have cleaned these up, but just in case)
DO $$
DECLARE
  dup_record RECORD;
  has_duplicates BOOLEAN := FALSE;
BEGIN
  FOR dup_record IN
    SELECT family_id, lower(trim(full_name)) as normalized_name, count(*) as cnt
    FROM students
    GROUP BY family_id, lower(trim(full_name))
    HAVING count(*) > 1
  LOOP
    has_duplicates := TRUE;
    RAISE WARNING 'Duplicate found: family_id=%, name=%, count=%',
      dup_record.family_id, dup_record.normalized_name, dup_record.cnt;
  END LOOP;

  IF has_duplicates THEN
    RAISE EXCEPTION 'Cannot create unique constraint: duplicates exist. Run the merge script first.';
  END IF;
END $$;

-- Create the unique index (case-insensitive, trimmed)
CREATE UNIQUE INDEX IF NOT EXISTS students_family_name_unique
ON students (family_id, lower(trim(full_name)));

-- Add a comment explaining the constraint
COMMENT ON INDEX students_family_name_unique IS
'Prevents duplicate student names within the same family. Names are compared case-insensitively with whitespace trimmed.';
