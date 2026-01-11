-- Migration: Add location_id to revenue_records
-- Enables Revenue by Location reporting

-- ============================================================================
-- PART 1: Add location_id column
-- ============================================================================

ALTER TABLE revenue_records
ADD COLUMN location_id UUID REFERENCES locations(id) ON DELETE SET NULL;

CREATE INDEX idx_revenue_records_location_id ON revenue_records(location_id);

COMMENT ON COLUMN revenue_records.location_id IS
  'Physical location where service was delivered. Enables revenue by location reporting.';

-- ============================================================================
-- PART 2: Backfill existing revenue records
-- ============================================================================

-- Learning Pod → Kendall
UPDATE revenue_records rr
SET location_id = (SELECT id FROM locations WHERE code = 'kendall')
FROM services s
WHERE rr.service_id = s.id
  AND s.code = 'learning_pod';

-- Eaton Hub → Kendall
UPDATE revenue_records rr
SET location_id = (SELECT id FROM locations WHERE code = 'kendall')
FROM services s
WHERE rr.service_id = s.id
  AND s.code = 'eaton_hub';

-- Non-Spanish elective classes → Kendall
UPDATE revenue_records rr
SET location_id = (SELECT id FROM locations WHERE code = 'kendall')
FROM services s
WHERE rr.service_id = s.id
  AND s.code = 'elective_classes'
  AND (rr.class_title IS NULL OR rr.class_title NOT ILIKE '%spanish 101%');

-- Spanish 101 elective classes → Remote
UPDATE revenue_records rr
SET location_id = (SELECT id FROM locations WHERE code = 'remote')
FROM services s
WHERE rr.service_id = s.id
  AND s.code = 'elective_classes'
  AND rr.class_title ILIKE '%spanish 101%';

-- Eaton Online → Remote
UPDATE revenue_records rr
SET location_id = (SELECT id FROM locations WHERE code = 'remote')
FROM services s
WHERE rr.service_id = s.id
  AND s.code = 'eaton_online';

-- Consulting → Remote
UPDATE revenue_records rr
SET location_id = (SELECT id FROM locations WHERE code = 'remote')
FROM services s
WHERE rr.service_id = s.id
  AND s.code = 'consulting';

-- Academic Coaching stays NULL (truly remote, no location tracking needed)
