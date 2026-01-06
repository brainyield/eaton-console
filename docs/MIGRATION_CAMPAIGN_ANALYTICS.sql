-- Migration: Email Campaign Analytics
-- Run this in your Supabase SQL Editor
-- This adds tables for tracking Mailchimp campaign performance and per-lead engagement

-- ============================================
-- 1. Email Campaigns Table
-- ============================================
-- Stores campaign metadata and aggregate stats from Mailchimp

CREATE TABLE IF NOT EXISTS email_campaigns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    mailchimp_campaign_id text UNIQUE NOT NULL,

    -- Campaign info
    campaign_name text NOT NULL,
    subject_line text,
    preview_text text,
    campaign_type text, -- 'regular', 'plaintext', 'absplit', 'rss', 'variate'

    -- Timing
    send_time timestamptz,

    -- Aggregate stats (updated on sync)
    emails_sent integer DEFAULT 0,
    unique_opens integer DEFAULT 0,
    total_opens integer DEFAULT 0,
    open_rate numeric(5,4) DEFAULT 0, -- e.g., 0.2345 = 23.45%
    unique_clicks integer DEFAULT 0,
    total_clicks integer DEFAULT 0,
    click_rate numeric(5,4) DEFAULT 0,
    unsubscribes integer DEFAULT 0,
    bounces integer DEFAULT 0,

    -- A/B Test info (if applicable)
    is_ab_test boolean DEFAULT false,
    winning_variant text,
    ab_test_results jsonb,

    -- Status
    status text DEFAULT 'sent', -- 'sent', 'archived'

    -- Sync tracking
    last_synced_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS email_campaigns_send_time_idx ON email_campaigns(send_time DESC);
CREATE INDEX IF NOT EXISTS email_campaigns_status_idx ON email_campaigns(status);

-- ============================================
-- 2. Lead Campaign Engagement Table
-- ============================================
-- Tracks per-lead engagement with specific campaigns

CREATE TABLE IF NOT EXISTS lead_campaign_engagement (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    campaign_id uuid NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,

    -- Engagement data
    was_sent boolean DEFAULT true,
    opened boolean DEFAULT false,
    first_opened_at timestamptz,
    open_count integer DEFAULT 0,
    clicked boolean DEFAULT false,
    first_clicked_at timestamptz,
    click_count integer DEFAULT 0,

    -- Link tracking (which links were clicked)
    clicked_links jsonb DEFAULT '[]'::jsonb,

    -- Status
    bounced boolean DEFAULT false,
    unsubscribed boolean DEFAULT false,

    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),

    -- Unique constraint: one record per lead per campaign
    UNIQUE(lead_id, campaign_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS lead_campaign_engagement_lead_idx ON lead_campaign_engagement(lead_id);
CREATE INDEX IF NOT EXISTS lead_campaign_engagement_campaign_idx ON lead_campaign_engagement(campaign_id);
CREATE INDEX IF NOT EXISTS lead_campaign_engagement_opened_idx ON lead_campaign_engagement(opened) WHERE opened = true;
CREATE INDEX IF NOT EXISTS lead_campaign_engagement_clicked_idx ON lead_campaign_engagement(clicked) WHERE clicked = true;

-- ============================================
-- 3. Triggers for updated_at
-- ============================================

-- email_campaigns updated_at trigger
CREATE OR REPLACE FUNCTION update_email_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS email_campaigns_updated_at ON email_campaigns;
CREATE TRIGGER email_campaigns_updated_at
    BEFORE UPDATE ON email_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_email_campaigns_updated_at();

-- lead_campaign_engagement updated_at trigger
CREATE OR REPLACE FUNCTION update_lead_campaign_engagement_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lead_campaign_engagement_updated_at ON lead_campaign_engagement;
CREATE TRIGGER lead_campaign_engagement_updated_at
    BEFORE UPDATE ON lead_campaign_engagement
    FOR EACH ROW
    EXECUTE FUNCTION update_lead_campaign_engagement_updated_at();

-- ============================================
-- 4. Helpful Views
-- ============================================

-- Campaign performance summary view
CREATE OR REPLACE VIEW campaign_performance_summary AS
SELECT
    ec.id,
    ec.mailchimp_campaign_id,
    ec.campaign_name,
    ec.subject_line,
    ec.send_time,
    ec.emails_sent,
    ec.unique_opens,
    ec.open_rate,
    ec.unique_clicks,
    ec.click_rate,
    ec.is_ab_test,
    ec.winning_variant,
    -- Lead-level stats from our tracking
    COUNT(DISTINCT lce.lead_id) FILTER (WHERE lce.was_sent) as leads_sent,
    COUNT(DISTINCT lce.lead_id) FILTER (WHERE lce.opened) as leads_opened,
    COUNT(DISTINCT lce.lead_id) FILTER (WHERE lce.clicked) as leads_clicked,
    ec.last_synced_at
FROM email_campaigns ec
LEFT JOIN lead_campaign_engagement lce ON ec.id = lce.campaign_id
GROUP BY ec.id
ORDER BY ec.send_time DESC;

-- Lead engagement across campaigns view
CREATE OR REPLACE VIEW lead_campaign_summary AS
SELECT
    l.id as lead_id,
    l.email,
    l.name,
    l.lead_type,
    l.status,
    COUNT(DISTINCT lce.campaign_id) as campaigns_received,
    COUNT(DISTINCT lce.campaign_id) FILTER (WHERE lce.opened) as campaigns_opened,
    COUNT(DISTINCT lce.campaign_id) FILTER (WHERE lce.clicked) as campaigns_clicked,
    SUM(lce.open_count) as total_opens,
    SUM(lce.click_count) as total_clicks,
    MAX(lce.first_opened_at) as last_opened_at,
    MAX(lce.first_clicked_at) as last_clicked_at
FROM leads l
LEFT JOIN lead_campaign_engagement lce ON l.id = lce.lead_id
GROUP BY l.id
ORDER BY total_clicks DESC NULLS LAST, total_opens DESC NULLS LAST;

-- ============================================
-- 5. Comments for documentation
-- ============================================

COMMENT ON TABLE email_campaigns IS 'Stores Mailchimp campaign metadata and aggregate performance stats';
COMMENT ON TABLE lead_campaign_engagement IS 'Tracks individual lead engagement with specific email campaigns';
COMMENT ON VIEW campaign_performance_summary IS 'Summarizes campaign performance with lead-level engagement counts';
COMMENT ON VIEW lead_campaign_summary IS 'Summarizes each lead''s engagement across all campaigns';
