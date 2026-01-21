-- Lead Consolidation Phase 2: Data Migration
-- Migrates data from leads table to families and updates related tables

-- ============================================================================
-- STEP 1: Link leads to existing families by email (where not already linked)
-- ============================================================================

UPDATE leads l
SET family_id = f.id
FROM families f
WHERE l.family_id IS NULL
  AND LOWER(f.primary_email) = LOWER(l.email);

-- ============================================================================
-- STEP 2: Create families for leads that don't have one
-- ============================================================================

-- Insert new families for leads without family_id
INSERT INTO families (
  id,
  display_name,
  primary_email,
  primary_phone,
  primary_contact_name,
  status,
  notes,
  created_at,
  updated_at,
  -- Lead-specific columns (will be populated in step 3)
  lead_type,
  lead_status,
  source_url,
  num_children,
  children_ages,
  preferred_days,
  preferred_time,
  service_interest,
  calendly_event_uri,
  calendly_invitee_uri,
  scheduled_at,
  mailchimp_id,
  mailchimp_status,
  mailchimp_last_synced_at,
  mailchimp_tags,
  mailchimp_opens,
  mailchimp_clicks,
  mailchimp_engagement_score,
  mailchimp_engagement_updated_at,
  lead_score,
  pdf_email_sent_at
)
SELECT
  gen_random_uuid(),
  COALESCE(l.name, SPLIT_PART(l.email, '@', 1) || ' (Lead)'),
  l.email,
  l.phone,
  l.name,
  'lead'::customer_status,
  l.notes,
  l.created_at,
  l.updated_at,
  l.lead_type,
  l.status,
  l.source_url,
  l.num_children,
  l.children_ages,
  l.preferred_days,
  l.preferred_time,
  l.service_interest,
  l.calendly_event_uri,
  l.calendly_invitee_uri,
  l.scheduled_at,
  l.mailchimp_id,
  l.mailchimp_status,
  l.mailchimp_last_synced_at,
  l.mailchimp_tags,
  l.mailchimp_opens,
  l.mailchimp_clicks,
  l.mailchimp_engagement_score,
  l.mailchimp_engagement_updated_at,
  l.lead_score,
  l.pdf_email_sent_at
FROM leads l
WHERE l.family_id IS NULL;

-- Link leads to newly created families
UPDATE leads l
SET family_id = f.id
FROM families f
WHERE l.family_id IS NULL
  AND LOWER(f.primary_email) = LOWER(l.email);

-- ============================================================================
-- STEP 3: Copy lead data to existing families (that were already linked)
-- ============================================================================

UPDATE families f
SET
  lead_type = COALESCE(f.lead_type, l.lead_type),
  lead_status = COALESCE(f.lead_status, l.status),
  source_url = COALESCE(f.source_url, l.source_url),
  converted_at = COALESCE(f.converted_at, l.converted_at),
  num_children = COALESCE(f.num_children, l.num_children),
  children_ages = COALESCE(f.children_ages, l.children_ages),
  preferred_days = COALESCE(f.preferred_days, l.preferred_days),
  preferred_time = COALESCE(f.preferred_time, l.preferred_time),
  service_interest = COALESCE(f.service_interest, l.service_interest),
  calendly_event_uri = COALESCE(f.calendly_event_uri, l.calendly_event_uri),
  calendly_invitee_uri = COALESCE(f.calendly_invitee_uri, l.calendly_invitee_uri),
  scheduled_at = COALESCE(f.scheduled_at, l.scheduled_at),
  mailchimp_id = COALESCE(f.mailchimp_id, l.mailchimp_id),
  mailchimp_status = COALESCE(f.mailchimp_status, l.mailchimp_status),
  mailchimp_last_synced_at = COALESCE(f.mailchimp_last_synced_at, l.mailchimp_last_synced_at),
  mailchimp_tags = COALESCE(f.mailchimp_tags, l.mailchimp_tags),
  mailchimp_opens = COALESCE(f.mailchimp_opens, l.mailchimp_opens),
  mailchimp_clicks = COALESCE(f.mailchimp_clicks, l.mailchimp_clicks),
  mailchimp_engagement_score = COALESCE(f.mailchimp_engagement_score, l.mailchimp_engagement_score),
  mailchimp_engagement_updated_at = COALESCE(f.mailchimp_engagement_updated_at, l.mailchimp_engagement_updated_at),
  lead_score = COALESCE(f.lead_score, l.lead_score),
  pdf_email_sent_at = COALESCE(f.pdf_email_sent_at, l.pdf_email_sent_at),
  -- Merge notes if both have them
  notes = CASE
    WHEN f.notes IS NOT NULL AND l.notes IS NOT NULL AND f.notes != l.notes
    THEN f.notes || E'\n---\nFrom lead record:\n' || l.notes
    ELSE COALESCE(f.notes, l.notes)
  END
FROM leads l
WHERE l.family_id = f.id
  -- Only update families that don't already have lead data populated
  AND f.lead_type IS NULL;

-- ============================================================================
-- STEP 4: Set defaults for orphaned families (status='lead' but no leads record)
-- ============================================================================

UPDATE families
SET
  lead_type = 'exit_intent',
  lead_status = 'new'
WHERE status = 'lead'
  AND lead_type IS NULL;

-- ============================================================================
-- STEP 5: Populate family_id in related tables from lead_id
-- ============================================================================

-- lead_activities
UPDATE lead_activities la
SET family_id = l.family_id
FROM leads l
WHERE la.lead_id = l.id
  AND la.family_id IS NULL;

-- lead_follow_ups
UPDATE lead_follow_ups lf
SET family_id = l.family_id
FROM leads l
WHERE lf.lead_id = l.id
  AND lf.family_id IS NULL;

-- lead_campaign_engagement
UPDATE lead_campaign_engagement lce
SET family_id = l.family_id
FROM leads l
WHERE lce.lead_id = l.id
  AND lce.family_id IS NULL;

-- lead_score_history
UPDATE lead_score_history lsh
SET family_id = l.family_id
FROM leads l
WHERE lsh.lead_id = l.id
  AND lsh.family_id IS NULL;

-- ============================================================================
-- STEP 6: Verify migration completeness
-- ============================================================================

-- This should return 0 for all counts if migration was successful
DO $$
DECLARE
  orphan_leads integer;
  orphan_activities integer;
  orphan_followups integer;
  families_missing_lead_type integer;
BEGIN
  SELECT COUNT(*) INTO orphan_leads FROM leads WHERE family_id IS NULL;
  SELECT COUNT(*) INTO orphan_activities FROM lead_activities WHERE family_id IS NULL;
  SELECT COUNT(*) INTO orphan_followups FROM lead_follow_ups WHERE family_id IS NULL;
  SELECT COUNT(*) INTO families_missing_lead_type FROM families WHERE status = 'lead' AND lead_type IS NULL;

  IF orphan_leads > 0 THEN
    RAISE WARNING 'Migration incomplete: % leads still have no family_id', orphan_leads;
  END IF;

  IF orphan_activities > 0 THEN
    RAISE WARNING 'Migration incomplete: % lead_activities still have no family_id', orphan_activities;
  END IF;

  IF orphan_followups > 0 THEN
    RAISE WARNING 'Migration incomplete: % lead_follow_ups still have no family_id', orphan_followups;
  END IF;

  IF families_missing_lead_type > 0 THEN
    RAISE WARNING 'Migration incomplete: % families with status=lead have no lead_type', families_missing_lead_type;
  END IF;

  IF orphan_leads = 0 AND orphan_activities = 0 AND orphan_followups = 0 AND families_missing_lead_type = 0 THEN
    RAISE NOTICE 'Migration completed successfully!';
  END IF;
END $$;
