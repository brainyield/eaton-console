-- Migration: Lead Contact Activity Log
-- Run this in your Supabase SQL Editor

-- Create contact type enum
CREATE TYPE contact_type AS ENUM ('call', 'email', 'text', 'other');

-- Create lead_activities table
CREATE TABLE lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  contact_type contact_type NOT NULL,
  notes text,
  contacted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient lead activity lookups
CREATE INDEX lead_activities_lead_id_idx ON lead_activities(lead_id);
CREATE INDEX lead_activities_contacted_at_idx ON lead_activities(contacted_at DESC);

-- Add computed columns to leads for quick access
-- These will be updated via trigger or computed in queries

-- Create a view for leads with activity stats
CREATE OR REPLACE VIEW leads_with_activity AS
SELECT
  l.*,
  COALESCE(a.contact_count, 0) as contact_count,
  a.last_contacted_at
FROM leads l
LEFT JOIN (
  SELECT
    lead_id,
    COUNT(*) as contact_count,
    MAX(contacted_at) as last_contacted_at
  FROM lead_activities
  GROUP BY lead_id
) a ON l.id = a.lead_id;

-- RLS Policies for lead_activities
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;

-- Allow anon full access (matching leads table policy)
CREATE POLICY "Allow anon full access" ON lead_activities
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON lead_activities TO anon;
GRANT ALL ON lead_activities TO authenticated;
GRANT ALL ON lead_activities TO service_role;

-- Grant access to the view
GRANT SELECT ON leads_with_activity TO anon;
GRANT SELECT ON leads_with_activity TO authenticated;
GRANT SELECT ON leads_with_activity TO service_role;
