-- ============================================================================
-- MIGRATION: Leads and Calendly Bookings Tables
--
-- Purpose: Track leads from multiple sources (exit intent, waitlist, calendly, events)
--          and manage Calendly bookings for Hub drop-offs
-- ============================================================================

-- ============================================================================
-- STEP 0: Create update_updated_at function (if not exists)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 1: Create lead_type enum
-- ============================================================================

CREATE TYPE lead_type AS ENUM ('exit_intent', 'waitlist', 'calendly_call', 'event');

CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'converted', 'closed');

-- ============================================================================
-- STEP 2: Create leads table
-- ============================================================================

CREATE TABLE leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Contact info
  email text NOT NULL,
  name text,
  phone text,

  -- Lead classification
  lead_type lead_type NOT NULL,
  status lead_status NOT NULL DEFAULT 'new',
  source_url text,

  -- Conversion tracking
  family_id uuid REFERENCES families(id) ON DELETE SET NULL,
  converted_at timestamptz,

  -- Calendly-specific fields (for calendly_call leads)
  calendly_event_uri text,
  calendly_invitee_uri text,
  scheduled_at timestamptz,

  -- Waitlist form fields
  num_children integer,
  children_ages text,
  preferred_days text,
  preferred_time text,
  service_interest text,

  -- General
  notes text
);

-- Indexes for common queries
CREATE INDEX leads_email_idx ON leads(LOWER(email));
CREATE INDEX leads_type_idx ON leads(lead_type);
CREATE INDEX leads_status_idx ON leads(status);
CREATE INDEX leads_created_idx ON leads(created_at);
CREATE INDEX leads_family_idx ON leads(family_id);
CREATE INDEX leads_scheduled_idx ON leads(scheduled_at) WHERE scheduled_at IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- STEP 3: Create calendly_booking_type and status enums
-- ============================================================================

CREATE TYPE calendly_booking_type AS ENUM ('15min_call', 'hub_dropoff');

CREATE TYPE calendly_booking_status AS ENUM ('scheduled', 'completed', 'canceled', 'no_show');

-- ============================================================================
-- STEP 4: Create calendly_bookings table
-- ============================================================================

CREATE TABLE calendly_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Calendly identifiers
  calendly_event_uri text NOT NULL,
  calendly_invitee_uri text UNIQUE NOT NULL,

  -- Booking details
  event_type calendly_booking_type NOT NULL,
  invitee_email text NOT NULL,
  invitee_name text,
  invitee_phone text,
  scheduled_at timestamptz NOT NULL,

  -- Status tracking
  status calendly_booking_status NOT NULL DEFAULT 'scheduled',
  canceled_at timestamptz,
  cancel_reason text,

  -- Linked records (auto-created for hub_dropoff)
  family_id uuid REFERENCES families(id) ON DELETE SET NULL,
  student_id uuid REFERENCES students(id) ON DELETE SET NULL,
  hub_session_id uuid REFERENCES hub_sessions(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,

  -- Hub-specific fields from Calendly form
  student_name text,
  student_age_group text,
  payment_method text,

  -- Raw webhook data for debugging
  raw_payload jsonb,

  notes text
);

-- Indexes
CREATE INDEX calendly_bookings_email_idx ON calendly_bookings(LOWER(invitee_email));
CREATE INDEX calendly_bookings_type_idx ON calendly_bookings(event_type);
CREATE INDEX calendly_bookings_status_idx ON calendly_bookings(status);
CREATE INDEX calendly_bookings_scheduled_idx ON calendly_bookings(scheduled_at);
CREATE INDEX calendly_bookings_family_idx ON calendly_bookings(family_id);
CREATE INDEX calendly_bookings_hub_session_idx ON calendly_bookings(hub_session_id);

-- Trigger for updated_at
CREATE TRIGGER calendly_bookings_updated_at
  BEFORE UPDATE ON calendly_bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- STEP 5: Create view for upcoming Calendly bookings
-- ============================================================================

CREATE OR REPLACE VIEW upcoming_calendly_bookings AS
SELECT
  cb.id,
  cb.event_type,
  cb.invitee_name,
  cb.invitee_email,
  cb.invitee_phone,
  cb.scheduled_at,
  cb.status,
  cb.student_name,
  cb.student_age_group,
  cb.payment_method,
  cb.family_id,
  f.display_name as family_name,
  cb.hub_session_id,
  cb.lead_id
FROM calendly_bookings cb
LEFT JOIN families f ON f.id = cb.family_id
WHERE cb.scheduled_at >= CURRENT_DATE
  AND cb.status = 'scheduled'
ORDER BY cb.scheduled_at ASC;

-- ============================================================================
-- STEP 6: Create view for leads pipeline
-- ============================================================================

CREATE OR REPLACE VIEW leads_pipeline AS
SELECT
  l.id,
  l.lead_type,
  l.status,
  l.email,
  l.name,
  l.phone,
  l.created_at,
  l.scheduled_at,
  l.family_id,
  f.display_name as family_name,
  l.num_children,
  l.service_interest,
  l.notes,
  -- Days since created
  EXTRACT(DAY FROM (now() - l.created_at)) as days_in_pipeline
FROM leads l
LEFT JOIN families f ON f.id = l.family_id
WHERE l.status IN ('new', 'contacted')
ORDER BY l.created_at DESC;

-- ============================================================================
-- STEP 7: Create view for event leads (families from events with no enrollments)
-- ============================================================================

CREATE OR REPLACE VIEW event_leads AS
SELECT
  f.id as family_id,
  f.display_name as family_name,
  f.primary_email,
  f.primary_phone,
  f.created_at,
  COUNT(DISTINCT eo.id) as event_order_count,
  SUM(eo.total_cents) / 100.0 as total_event_spend,
  MAX(eo.created_at) as last_event_order_at
FROM families f
INNER JOIN event_orders eo ON eo.family_id = f.id AND eo.payment_status IN ('paid', 'stepup_pending')
LEFT JOIN enrollments e ON e.family_id = f.id AND e.status IN ('active', 'trial')
WHERE e.id IS NULL
  AND f.status NOT IN ('churned')
GROUP BY f.id, f.display_name, f.primary_email, f.primary_phone, f.created_at
ORDER BY last_event_order_at DESC;

-- ============================================================================
-- STEP 8: Enable RLS (Row Level Security)
-- ============================================================================

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendly_bookings ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (internal admin app)
CREATE POLICY "Allow all for authenticated users" ON leads
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON calendly_bookings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow anon users to read (for local development with anon key)
CREATE POLICY "Allow anon read" ON leads
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon read" ON calendly_bookings
  FOR SELECT TO anon USING (true);

-- Allow service role full access (for Edge Functions)
CREATE POLICY "Allow service role full access" ON leads
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role full access" ON calendly_bookings
  FOR ALL TO service_role USING (true) WITH CHECK (true);
