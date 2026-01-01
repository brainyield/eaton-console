-- Migration: Follow-up Tasks for Leads
-- Run this in your Supabase SQL Editor

-- Create task priority enum
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high');

-- Create follow-up tasks table
CREATE TABLE IF NOT EXISTS lead_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  due_date date NOT NULL,
  due_time time,
  priority task_priority DEFAULT 'medium',
  completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX lead_follow_ups_lead_id_idx ON lead_follow_ups(lead_id);
CREATE INDEX lead_follow_ups_due_date_idx ON lead_follow_ups(due_date) WHERE NOT completed;
CREATE INDEX lead_follow_ups_completed_idx ON lead_follow_ups(completed);

-- Enable RLS
ALTER TABLE lead_follow_ups ENABLE ROW LEVEL SECURITY;

-- RLS policies (allow all for authenticated users)
CREATE POLICY "Allow all for anon" ON lead_follow_ups FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON lead_follow_ups FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_role" ON lead_follow_ups FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_lead_follow_ups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_lead_follow_ups_updated_at
  BEFORE UPDATE ON lead_follow_ups
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_follow_ups_updated_at();

-- View for upcoming follow-ups with lead info
CREATE OR REPLACE VIEW upcoming_follow_ups AS
SELECT
  f.*,
  l.name as lead_name,
  l.email as lead_email,
  l.phone as lead_phone,
  l.lead_type,
  l.status as lead_status,
  CASE
    WHEN f.due_date < CURRENT_DATE THEN 'overdue'
    WHEN f.due_date = CURRENT_DATE THEN 'today'
    WHEN f.due_date = CURRENT_DATE + 1 THEN 'tomorrow'
    WHEN f.due_date <= CURRENT_DATE + 7 THEN 'this_week'
    ELSE 'later'
  END as urgency
FROM lead_follow_ups f
JOIN leads l ON f.lead_id = l.id
WHERE NOT f.completed
ORDER BY f.due_date ASC, f.due_time ASC NULLS LAST;

-- Grant access to the view
GRANT SELECT ON upcoming_follow_ups TO anon;
GRANT SELECT ON upcoming_follow_ups TO authenticated;
GRANT SELECT ON upcoming_follow_ups TO service_role;
