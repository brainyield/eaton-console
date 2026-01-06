-- Migration: Lead Score History Tracking
-- Run this in your Supabase SQL Editor
-- This adds a table to track lead score changes over time

-- ============================================
-- 1. Lead Score History Table
-- ============================================

CREATE TABLE IF NOT EXISTS lead_score_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

    -- Score at this point in time
    score integer NOT NULL,

    -- What changed to cause this score
    change_reason text, -- 'engagement_sync', 'activity_logged', 'status_change', 'recalculation'

    -- Score components at the time (for debugging/analysis)
    source_score integer, -- Points from lead source type
    recency_score integer, -- Points from how recent the lead is
    engagement_score integer, -- Points from Mailchimp engagement
    activity_score integer, -- Points from contact activity count

    -- Previous score for delta calculation
    previous_score integer,

    created_at timestamptz DEFAULT now()
);

-- Index for efficient queries by lead
CREATE INDEX IF NOT EXISTS lead_score_history_lead_idx ON lead_score_history(lead_id, created_at DESC);

-- ============================================
-- 2. Function to Record Score Change
-- ============================================

CREATE OR REPLACE FUNCTION record_lead_score_change()
RETURNS TRIGGER AS $$
DECLARE
    new_score integer;
    source_pts integer;
    recency_pts integer;
    engagement_pts integer;
    activity_pts integer;
    days_old integer;
    change_reason text;
BEGIN
    -- Calculate score components
    -- Source quality (0-30)
    source_pts := CASE NEW.lead_type
        WHEN 'event' THEN 30
        WHEN 'calendly_call' THEN 25
        WHEN 'waitlist' THEN 15
        WHEN 'exit_intent' THEN 10
        ELSE 5
    END;

    -- Recency (0-25)
    days_old := EXTRACT(DAY FROM (now() - NEW.created_at));
    recency_pts := CASE
        WHEN days_old <= 7 THEN 25
        WHEN days_old <= 14 THEN 20
        WHEN days_old <= 30 THEN 15
        WHEN days_old <= 60 THEN 10
        WHEN days_old <= 90 THEN 5
        ELSE 0
    END;

    -- Engagement (0-30, capped)
    engagement_pts := LEAST(COALESCE(NEW.mailchimp_engagement_score, 0), 30);

    -- Activity - we can't easily get contact count in trigger, use 0 as placeholder
    -- The application can update this when logging activities
    activity_pts := 0;

    -- Calculate total score
    new_score := source_pts + recency_pts + engagement_pts + activity_pts;

    -- Determine change reason
    IF TG_OP = 'INSERT' THEN
        change_reason := 'lead_created';
    ELSIF OLD.mailchimp_engagement_score IS DISTINCT FROM NEW.mailchimp_engagement_score THEN
        change_reason := 'engagement_sync';
    ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
        change_reason := 'status_change';
    ELSE
        change_reason := 'recalculation';
    END IF;

    -- Only record if score actually changed or it's a new lead
    IF TG_OP = 'INSERT' OR OLD.lead_score IS DISTINCT FROM new_score THEN
        INSERT INTO lead_score_history (
            lead_id,
            score,
            change_reason,
            source_score,
            recency_score,
            engagement_score,
            activity_score,
            previous_score
        ) VALUES (
            NEW.id,
            new_score,
            change_reason,
            source_pts,
            recency_pts,
            engagement_pts,
            activity_pts,
            CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.lead_score END
        );

        -- Update the lead's stored score
        NEW.lead_score := new_score;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. Trigger to Auto-Record Score Changes
-- ============================================

DROP TRIGGER IF EXISTS lead_score_change_trigger ON leads;
CREATE TRIGGER lead_score_change_trigger
    BEFORE INSERT OR UPDATE OF mailchimp_engagement_score, status, lead_type
    ON leads
    FOR EACH ROW
    EXECUTE FUNCTION record_lead_score_change();

-- ============================================
-- 4. Helpful View for Score Trends
-- ============================================

CREATE OR REPLACE VIEW lead_score_trends AS
SELECT
    l.id as lead_id,
    l.email,
    l.name,
    l.lead_type,
    l.status,
    l.lead_score as current_score,
    (
        SELECT score
        FROM lead_score_history h
        WHERE h.lead_id = l.id
        ORDER BY h.created_at DESC
        OFFSET 1
        LIMIT 1
    ) as previous_score,
    l.lead_score - COALESCE((
        SELECT score
        FROM lead_score_history h
        WHERE h.lead_id = l.id
        ORDER BY h.created_at DESC
        OFFSET 1
        LIMIT 1
    ), l.lead_score) as score_change,
    (
        SELECT COUNT(*)
        FROM lead_score_history h
        WHERE h.lead_id = l.id
    ) as history_count,
    (
        SELECT MAX(created_at)
        FROM lead_score_history h
        WHERE h.lead_id = l.id
    ) as last_score_change
FROM leads l
ORDER BY l.lead_score DESC NULLS LAST;

-- ============================================
-- 5. Comments
-- ============================================

COMMENT ON TABLE lead_score_history IS 'Tracks lead score changes over time for trend analysis';
COMMENT ON VIEW lead_score_trends IS 'Shows current score, previous score, and change for each lead';
