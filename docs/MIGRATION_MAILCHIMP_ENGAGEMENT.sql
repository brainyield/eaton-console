-- Migration: Mailchimp Engagement Tracking
-- Run this in your Supabase SQL Editor

-- Add engagement tracking columns to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS mailchimp_opens integer DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS mailchimp_clicks integer DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS mailchimp_engagement_score integer DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS mailchimp_engagement_updated_at timestamptz;

-- Engagement score calculation:
-- - Each open = 1 point
-- - Each click = 3 points
-- - Score is stored and updated when synced

-- Create index for filtering by engagement
CREATE INDEX IF NOT EXISTS leads_engagement_score_idx ON leads(mailchimp_engagement_score DESC);

-- Add a computed engagement level for easy filtering
-- cold = score 0, warm = score 1-5, hot = score 6+
COMMENT ON COLUMN leads.mailchimp_engagement_score IS 'Engagement score: cold (0), warm (1-5), hot (6+)';
