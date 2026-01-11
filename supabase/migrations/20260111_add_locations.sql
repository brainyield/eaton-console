-- Migration: Add multi-location support
-- Enables tracking enrollments by physical location for profitability metrics
-- Initial locations: Kendall (current), Homestead (upcoming), Remote (online services)

-- ============================================================================
-- PART 1: Create locations reference table
-- ============================================================================

CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  address_line1 TEXT,
  city TEXT,
  state TEXT DEFAULT 'FL',
  zip TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE locations IS 'Physical business locations for in-person services';

-- ============================================================================
-- PART 2: Seed initial locations
-- ============================================================================

INSERT INTO locations (code, name, city) VALUES
  ('kendall', 'Kendall Campus', 'Kendall'),
  ('homestead', 'Homestead Campus', 'Homestead'),
  ('remote', 'Remote', NULL);

-- ============================================================================
-- PART 3: Add location_id to enrollments
-- ============================================================================

ALTER TABLE enrollments
ADD COLUMN location_id UUID REFERENCES locations(id) ON DELETE SET NULL;

CREATE INDEX idx_enrollments_location_id ON enrollments(location_id);

COMMENT ON COLUMN enrollments.location_id IS
  'Physical location where service is delivered. NULL for purely remote services like Academic Coaching.';

-- ============================================================================
-- PART 4: Backfill existing enrollments
-- ============================================================================

-- Learning Pod → Kendall
UPDATE enrollments e
SET location_id = (SELECT id FROM locations WHERE code = 'kendall')
FROM services s
WHERE e.service_id = s.id
  AND s.code = 'learning_pod';

-- Eaton Hub → Kendall
UPDATE enrollments e
SET location_id = (SELECT id FROM locations WHERE code = 'kendall')
FROM services s
WHERE e.service_id = s.id
  AND s.code = 'eaton_hub';

-- Non-Spanish elective classes → Kendall
UPDATE enrollments e
SET location_id = (SELECT id FROM locations WHERE code = 'kendall')
FROM services s
WHERE e.service_id = s.id
  AND s.code = 'elective_classes'
  AND (e.class_title IS NULL OR e.class_title NOT ILIKE '%spanish 101%');

-- Spanish 101 elective classes → Remote (online classes)
UPDATE enrollments e
SET location_id = (SELECT id FROM locations WHERE code = 'remote')
FROM services s
WHERE e.service_id = s.id
  AND s.code = 'elective_classes'
  AND e.class_title ILIKE '%spanish 101%';

-- Eaton Online → Remote
UPDATE enrollments e
SET location_id = (SELECT id FROM locations WHERE code = 'remote')
FROM services s
WHERE e.service_id = s.id
  AND s.code = 'eaton_online';

-- Consulting → Remote
UPDATE enrollments e
SET location_id = (SELECT id FROM locations WHERE code = 'remote')
FROM services s
WHERE e.service_id = s.id
  AND s.code = 'consulting';

-- Academic Coaching stays NULL (truly remote, no location tracking needed)
