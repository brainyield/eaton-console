-- Migration: Add enrollment_onboarding table for tracking forms and documents
-- This table tracks onboarding items (Google Forms, Google Doc agreements) per enrollment

CREATE TABLE enrollment_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,

  -- Item identification
  item_type TEXT NOT NULL CHECK (item_type IN ('form', 'document')),
  item_key TEXT NOT NULL,           -- e.g., 'lp_tos', 'ac_agreement', 'hc_questionnaire'
  item_name TEXT NOT NULL,          -- Human-readable display name

  -- Google Form fields (for type='form')
  form_url TEXT,                    -- Full Google Form URL
  form_id TEXT,                     -- Extracted form ID for API calls

  -- Google Doc fields (for type='document')
  document_url TEXT,                -- Created Google Doc URL
  document_id TEXT,                 -- Google Doc ID

  -- Merge data used when creating documents
  merge_data JSONB,                 -- { hourly_rate: 45, hours_per_week: 3, annual_fee: 250, ... }

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'completed')),
  sent_at TIMESTAMPTZ,
  sent_to TEXT,                     -- Email address forms were sent to
  reminder_count INT NOT NULL DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- N8N workflow tracking
  workflow_execution_id TEXT,       -- Track which N8N execution is handling reminders

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Each enrollment can only have one record per item_key
  UNIQUE(enrollment_id, item_key)
);

-- Indexes for common queries
CREATE INDEX idx_enrollment_onboarding_enrollment_id
  ON enrollment_onboarding(enrollment_id);

CREATE INDEX idx_enrollment_onboarding_pending
  ON enrollment_onboarding(status, sent_at)
  WHERE status = 'sent';

-- Trigger to update updated_at on changes
CREATE OR REPLACE FUNCTION update_enrollment_onboarding_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enrollment_onboarding_updated_at
  BEFORE UPDATE ON enrollment_onboarding
  FOR EACH ROW
  EXECUTE FUNCTION update_enrollment_onboarding_updated_at();

-- Add comment for documentation
COMMENT ON TABLE enrollment_onboarding IS
  'Tracks onboarding forms and documents per enrollment. Forms are Google Forms that customers fill out. Documents are Google Docs (agreements) created from templates with merge data.';
