-- Migration: Lead Scoring
-- Run this in your Supabase SQL Editor

-- Add lead score column
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_score integer DEFAULT 0;

-- Create index for sorting by lead score
CREATE INDEX IF NOT EXISTS leads_lead_score_idx ON leads(lead_score DESC);

-- Lead Score Calculation:
-- Base scoring factors:
--   1. Source Quality (0-30 points):
--      - event: 30 points (highest intent - attended an event)
--      - calendly_call: 25 points (booked a call)
--      - exit_intent: 10 points (showed interest but passive)
--      - waitlist: 15 points (signed up for waitlist)
--
--   2. Recency (0-25 points):
--      - 0-7 days: 25 points
--      - 8-14 days: 20 points
--      - 15-30 days: 15 points
--      - 31-60 days: 10 points
--      - 61-90 days: 5 points
--      - 90+ days: 0 points
--
--   3. Engagement (0-30 points):
--      - Uses mailchimp_engagement_score directly (capped at 30)
--
--   4. Contact Activity (0-15 points):
--      - Each contact attempt: 3 points (max 15)
--
-- Total possible score: 100 points

-- Function to calculate lead score
CREATE OR REPLACE FUNCTION calculate_lead_score(
  p_lead_type text,
  p_created_at timestamptz,
  p_engagement_score integer,
  p_contact_count integer
) RETURNS integer AS $$
DECLARE
  v_score integer := 0;
  v_days_old integer;
BEGIN
  -- Source quality score (0-30)
  CASE p_lead_type
    WHEN 'event' THEN v_score := v_score + 30;
    WHEN 'calendly_call' THEN v_score := v_score + 25;
    WHEN 'waitlist' THEN v_score := v_score + 15;
    WHEN 'exit_intent' THEN v_score := v_score + 10;
    ELSE v_score := v_score + 5;
  END CASE;

  -- Recency score (0-25)
  v_days_old := EXTRACT(DAY FROM (now() - p_created_at))::integer;
  CASE
    WHEN v_days_old <= 7 THEN v_score := v_score + 25;
    WHEN v_days_old <= 14 THEN v_score := v_score + 20;
    WHEN v_days_old <= 30 THEN v_score := v_score + 15;
    WHEN v_days_old <= 60 THEN v_score := v_score + 10;
    WHEN v_days_old <= 90 THEN v_score := v_score + 5;
    ELSE v_score := v_score + 0;
  END CASE;

  -- Engagement score (0-30, capped)
  v_score := v_score + LEAST(COALESCE(p_engagement_score, 0), 30);

  -- Contact activity score (0-15, 3 points per contact, max 5 contacts)
  v_score := v_score + LEAST(COALESCE(p_contact_count, 0) * 3, 15);

  RETURN v_score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create a view that includes calculated lead score
CREATE OR REPLACE VIEW leads_with_scores AS
SELECT
  l.*,
  COALESCE(a.contact_count, 0) as contact_count,
  a.last_contacted_at,
  calculate_lead_score(
    l.lead_type::text,
    l.created_at,
    l.mailchimp_engagement_score,
    COALESCE(a.contact_count, 0)::integer
  ) as calculated_score
FROM leads l
LEFT JOIN (
  SELECT
    lead_id,
    COUNT(*) as contact_count,
    MAX(contacted_at) as last_contacted_at
  FROM lead_activities
  GROUP BY lead_id
) a ON l.id = a.lead_id;

-- Grant access to the view
GRANT SELECT ON leads_with_scores TO anon;
GRANT SELECT ON leads_with_scores TO authenticated;
GRANT SELECT ON leads_with_scores TO service_role;

-- Optional: Trigger to update lead_score when relevant fields change
-- This keeps the stored score in sync for efficient querying
CREATE OR REPLACE FUNCTION update_lead_score() RETURNS TRIGGER AS $$
DECLARE
  v_contact_count integer;
BEGIN
  -- Get contact count for this lead
  SELECT COUNT(*) INTO v_contact_count
  FROM lead_activities
  WHERE lead_id = NEW.id;

  -- Calculate and update the score
  NEW.lead_score := calculate_lead_score(
    NEW.lead_type::text,
    NEW.created_at,
    NEW.mailchimp_engagement_score,
    v_contact_count
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on leads table
DROP TRIGGER IF EXISTS trigger_update_lead_score ON leads;
CREATE TRIGGER trigger_update_lead_score
  BEFORE INSERT OR UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_score();

-- Trigger to update lead score when activities change
CREATE OR REPLACE FUNCTION update_lead_score_on_activity() RETURNS TRIGGER AS $$
DECLARE
  v_lead_id uuid;
  v_contact_count integer;
  v_lead_type text;
  v_created_at timestamptz;
  v_engagement_score integer;
BEGIN
  -- Determine which lead to update
  IF TG_OP = 'DELETE' THEN
    v_lead_id := OLD.lead_id;
  ELSE
    v_lead_id := NEW.lead_id;
  END IF;

  -- Get lead details and contact count
  SELECT lead_type, created_at, mailchimp_engagement_score
  INTO v_lead_type, v_created_at, v_engagement_score
  FROM leads WHERE id = v_lead_id;

  SELECT COUNT(*) INTO v_contact_count
  FROM lead_activities WHERE lead_id = v_lead_id;

  -- Update the lead score
  UPDATE leads
  SET lead_score = calculate_lead_score(
    v_lead_type,
    v_created_at,
    v_engagement_score,
    v_contact_count
  )
  WHERE id = v_lead_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_lead_score_on_activity ON lead_activities;
CREATE TRIGGER trigger_update_lead_score_on_activity
  AFTER INSERT OR DELETE ON lead_activities
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_score_on_activity();

-- Update existing leads with calculated scores
UPDATE leads l
SET lead_score = calculate_lead_score(
  l.lead_type::text,
  l.created_at,
  l.mailchimp_engagement_score,
  COALESCE((SELECT COUNT(*) FROM lead_activities WHERE lead_id = l.id), 0)::integer
);
