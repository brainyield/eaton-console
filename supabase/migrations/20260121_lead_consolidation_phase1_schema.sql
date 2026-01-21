-- Lead Consolidation Phase 1: Schema Changes
-- Adds lead-specific columns to families table and family_id to related tables
-- This prepares for migrating away from the separate leads table

-- ============================================================================
-- STEP 1: Add lead columns to families table
-- ============================================================================

-- Lead tracking columns
ALTER TABLE families ADD COLUMN IF NOT EXISTS lead_type lead_type;
ALTER TABLE families ADD COLUMN IF NOT EXISTS lead_status lead_status;
ALTER TABLE families ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE families ADD COLUMN IF NOT EXISTS converted_at timestamptz;

-- Lead intake form data
ALTER TABLE families ADD COLUMN IF NOT EXISTS num_children integer;
ALTER TABLE families ADD COLUMN IF NOT EXISTS children_ages text;
ALTER TABLE families ADD COLUMN IF NOT EXISTS preferred_days text;
ALTER TABLE families ADD COLUMN IF NOT EXISTS preferred_time text;
ALTER TABLE families ADD COLUMN IF NOT EXISTS service_interest text;

-- Calendly integration
ALTER TABLE families ADD COLUMN IF NOT EXISTS calendly_event_uri text;
ALTER TABLE families ADD COLUMN IF NOT EXISTS calendly_invitee_uri text;
ALTER TABLE families ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

-- Mailchimp integration
ALTER TABLE families ADD COLUMN IF NOT EXISTS mailchimp_id text;
ALTER TABLE families ADD COLUMN IF NOT EXISTS mailchimp_status text;
ALTER TABLE families ADD COLUMN IF NOT EXISTS mailchimp_last_synced_at timestamptz;
ALTER TABLE families ADD COLUMN IF NOT EXISTS mailchimp_tags text[];
ALTER TABLE families ADD COLUMN IF NOT EXISTS mailchimp_opens integer;
ALTER TABLE families ADD COLUMN IF NOT EXISTS mailchimp_clicks integer;
ALTER TABLE families ADD COLUMN IF NOT EXISTS mailchimp_engagement_score integer;
ALTER TABLE families ADD COLUMN IF NOT EXISTS mailchimp_engagement_updated_at timestamptz;

-- Lead scoring
ALTER TABLE families ADD COLUMN IF NOT EXISTS lead_score integer;

-- PDF email tracking
ALTER TABLE families ADD COLUMN IF NOT EXISTS pdf_email_sent_at timestamptz;

-- ============================================================================
-- STEP 2: Add family_id to related tables (for migration)
-- ============================================================================

-- lead_activities: add family_id
ALTER TABLE lead_activities ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES families(id) ON DELETE CASCADE;

-- lead_follow_ups: add family_id
ALTER TABLE lead_follow_ups ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES families(id) ON DELETE CASCADE;

-- lead_campaign_engagement: add family_id
ALTER TABLE lead_campaign_engagement ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES families(id) ON DELETE CASCADE;

-- lead_score_history: add family_id
ALTER TABLE lead_score_history ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES families(id) ON DELETE CASCADE;

-- ============================================================================
-- STEP 3: Create indexes for efficient querying
-- ============================================================================

-- Index for querying lead-status families
CREATE INDEX IF NOT EXISTS idx_families_lead_status ON families(status) WHERE status = 'lead';

-- Index for lead_type filtering
CREATE INDEX IF NOT EXISTS idx_families_lead_type ON families(lead_type) WHERE lead_type IS NOT NULL;

-- Index for lead pipeline status
CREATE INDEX IF NOT EXISTS idx_families_lead_pipeline ON families(lead_status) WHERE status = 'lead';

-- Indexes on family_id in related tables (for after migration)
CREATE INDEX IF NOT EXISTS idx_lead_activities_family_id ON lead_activities(family_id) WHERE family_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_family_id ON lead_follow_ups(family_id) WHERE family_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_campaign_engagement_family_id ON lead_campaign_engagement(family_id) WHERE family_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_score_history_family_id ON lead_score_history(family_id) WHERE family_id IS NOT NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN families.lead_type IS 'Source of the lead: exit_intent, waitlist, calendly_call, event';
COMMENT ON COLUMN families.lead_status IS 'Pipeline status for leads: new, contacted, converted, closed';
COMMENT ON COLUMN families.source_url IS 'URL where the lead was captured';
COMMENT ON COLUMN families.converted_at IS 'When the lead was converted to a customer';
COMMENT ON COLUMN families.num_children IS 'Number of children (from lead intake form)';
COMMENT ON COLUMN families.children_ages IS 'Ages of children (from lead intake form)';
COMMENT ON COLUMN families.preferred_days IS 'Preferred days for lessons (from lead intake form)';
COMMENT ON COLUMN families.preferred_time IS 'Preferred time for lessons (from lead intake form)';
COMMENT ON COLUMN families.service_interest IS 'Service interest (from lead intake form)';
COMMENT ON COLUMN families.calendly_event_uri IS 'Calendly event URI for scheduled calls';
COMMENT ON COLUMN families.calendly_invitee_uri IS 'Calendly invitee URI';
COMMENT ON COLUMN families.scheduled_at IS 'Scheduled call/meeting time from Calendly';
COMMENT ON COLUMN families.mailchimp_id IS 'Mailchimp subscriber ID';
COMMENT ON COLUMN families.mailchimp_status IS 'Mailchimp subscription status';
COMMENT ON COLUMN families.mailchimp_last_synced_at IS 'Last sync time with Mailchimp';
COMMENT ON COLUMN families.mailchimp_tags IS 'Mailchimp tags array';
COMMENT ON COLUMN families.mailchimp_opens IS 'Email open count from Mailchimp';
COMMENT ON COLUMN families.mailchimp_clicks IS 'Email click count from Mailchimp';
COMMENT ON COLUMN families.mailchimp_engagement_score IS 'Calculated engagement score from Mailchimp activity';
COMMENT ON COLUMN families.mailchimp_engagement_updated_at IS 'Last engagement score update time';
COMMENT ON COLUMN families.lead_score IS 'Calculated lead score for prioritization';
COMMENT ON COLUMN families.pdf_email_sent_at IS 'When the PDF info email was sent to this lead';
