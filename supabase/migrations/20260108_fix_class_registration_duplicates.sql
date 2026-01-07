-- Migration: Fix duplicate student creation in class registration trigger
--
-- Problem: The process_class_registration trigger compares names with LOWER()
-- but doesn't account for format differences ("First Last" vs "Last, First")
--
-- Solution: Create a helper function to normalize names to "Last, First" format
-- before comparison and insertion

-- Step 1: Create the helper function
CREATE OR REPLACE FUNCTION normalize_name_to_last_first(name text)
RETURNS text AS $$
DECLARE
  parts text[];
  last_name text;
  first_names text;
BEGIN
  -- Trim whitespace
  name := trim(name);

  -- If empty or null, return as-is
  IF name IS NULL OR name = '' THEN
    RETURN name;
  END IF;

  -- If already has comma, assume "Last, First" format - return as-is
  IF position(',' in name) > 0 THEN
    RETURN name;
  END IF;

  -- Split by spaces
  parts := string_to_array(name, ' ');

  -- Single name (no spaces), return as-is
  IF array_length(parts, 1) = 1 THEN
    RETURN name;
  END IF;

  -- Last element is last name, rest are first names
  -- e.g., "Drexx Gonzalez" -> "Gonzalez, Drexx"
  -- e.g., "Mary Jane Watson" -> "Watson, Mary Jane"
  last_name := parts[array_length(parts, 1)];
  first_names := array_to_string(parts[1:array_length(parts, 1)-1], ' ');

  RETURN last_name || ', ' || first_names;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add comment for documentation
COMMENT ON FUNCTION normalize_name_to_last_first(text) IS
'Converts names from "First Last" format to "Last, First" format.
If name already contains a comma, returns unchanged.
Used for consistent name comparison and storage.';

-- Step 2: Update the unique constraint on students table to use normalized names
-- First drop the old constraint if it exists
DROP INDEX IF EXISTS students_family_name_unique;
DROP INDEX IF EXISTS students_family_name_normalized_unique;

-- Create new constraint using normalized comparison
-- This prevents duplicates regardless of input format
CREATE UNIQUE INDEX students_family_name_normalized_unique
ON students (family_id, LOWER(normalize_name_to_last_first(full_name)));

COMMENT ON INDEX students_family_name_normalized_unique IS
'Prevents duplicate students within a family by comparing normalized names.
"John Smith" and "Smith, John" are treated as the same name.';

-- Step 3: Update process_class_registration function
-- This is the main fix - normalize names before comparison and insertion
CREATE OR REPLACE FUNCTION process_class_registration()
RETURNS TRIGGER AS $$
DECLARE
  v_event_title TEXT;
  v_event_type TEXT;
  v_schedule_day TEXT;
  v_schedule_time TEXT;
  v_instructor TEXT;
  v_monthly_tuition NUMERIC;
  v_attendee RECORD;
  v_student_id UUID;
  v_service_id UUID;
  v_order_id UUID;
  v_family_id UUID;
  v_schedule_notes TEXT;
  v_payment_status TEXT;
  v_normalized_name TEXT;
BEGIN
  -- Get the order ID based on which table triggered this
  IF TG_TABLE_NAME = 'event_orders' THEN
    v_order_id := NEW.id;
  ELSE
    v_order_id := NEW.order_id;
  END IF;

  -- Get order and event details
  SELECT
    o.family_id,
    o.payment_status,
    e.event_type,
    e.title,
    e.schedule_day,
    e.schedule_time,
    e.instructor_name,
    e.monthly_tuition_cents
  INTO
    v_family_id,
    v_payment_status,
    v_event_type,
    v_event_title,
    v_schedule_day,
    v_schedule_time,
    v_instructor,
    v_monthly_tuition
  FROM event_orders o
  JOIN event_events e ON o.event_id = e.id
  WHERE o.id = v_order_id;

  -- Only process class registrations with valid payment status
  IF v_family_id IS NULL OR v_event_type IS DISTINCT FROM 'class' OR v_payment_status NOT IN ('paid', 'stepup_pending') THEN
    RETURN NEW;
  END IF;

  -- Get the elective_classes service ID
  SELECT id INTO v_service_id FROM services WHERE code = 'elective_classes';
  IF v_service_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Build schedule notes
  v_schedule_notes := CONCAT_WS(' ', v_schedule_day, v_schedule_time, '- ' || v_instructor);

  -- Convert monthly tuition from cents to dollars
  v_monthly_tuition := COALESCE(v_monthly_tuition, 0) / 100.0;

  -- Process each attendee
  FOR v_attendee IN SELECT * FROM event_attendees WHERE order_id = v_order_id LOOP
    -- Normalize the attendee name to "Last, First" format for comparison
    v_normalized_name := normalize_name_to_last_first(v_attendee.attendee_name);

    -- Search for existing student using NORMALIZED name comparison
    -- This ensures "Drexx Gonzalez" matches "Gonzalez, Drexx"
    SELECT id INTO v_student_id
    FROM students
    WHERE family_id = v_family_id
    AND LOWER(normalize_name_to_last_first(full_name)) = LOWER(v_normalized_name);

    -- If student not found, create with NORMALIZED name
    IF v_student_id IS NULL THEN
      INSERT INTO students (family_id, full_name, age_group, active)
      VALUES (v_family_id, v_normalized_name, derive_age_group(v_attendee.attendee_age), true)
      RETURNING id INTO v_student_id;
    END IF;

    -- Create enrollment if one doesn't exist for this class
    IF NOT EXISTS (
      SELECT 1 FROM enrollments
      WHERE family_id = v_family_id
      AND student_id = v_student_id
      AND service_id = v_service_id
      AND class_title = v_event_title
    ) THEN
      INSERT INTO enrollments (
        family_id,
        student_id,
        service_id,
        status,
        class_title,
        schedule_notes,
        billing_frequency,
        monthly_rate
      ) VALUES (
        v_family_id,
        v_student_id,
        v_service_id,
        'active',
        v_event_title,
        v_schedule_notes,
        'monthly',
        v_monthly_tuition
      );
    END IF;
  END LOOP;

  -- Auto-convert lead to active if they paid
  UPDATE families SET status = 'active' WHERE id = v_family_id AND status = 'lead';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION process_class_registration() IS
'Trigger function that creates students and enrollments when class registrations are paid.
Uses normalize_name_to_last_first() to prevent duplicate students with different name formats.';
