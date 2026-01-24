-- SMS Notifications Feature
-- Adds tables for SMS message history, media attachments, and opt-out tracking

-- SMS Messages Table
CREATE TABLE sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  family_id UUID REFERENCES families(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  sent_by TEXT,  -- Admin user identifier or 'system'

  -- Message content
  to_phone TEXT NOT NULL,
  from_phone TEXT NOT NULL,  -- Twilio number used
  message_body TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN (
    'invoice_reminder',
    'event_reminder',
    'announcement',
    'custom',
    'bulk'
  )),

  -- Delivery tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',     -- Queued for sending
    'sent',        -- Accepted by Twilio
    'delivered',   -- Confirmed delivery
    'failed',      -- Permanent failure
    'undelivered'  -- Temporary failure
  )),
  twilio_sid TEXT UNIQUE,
  error_code TEXT,
  error_message TEXT,

  -- Metadata
  template_key TEXT,  -- Which template was used (if any)
  merge_data JSONB,   -- Data used for template merge
  campaign_name TEXT, -- For bulk sends

  -- Timestamps
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX idx_sms_messages_family_id ON sms_messages(family_id);
CREATE INDEX idx_sms_messages_invoice_id ON sms_messages(invoice_id);
CREATE INDEX idx_sms_messages_status ON sms_messages(status);
CREATE INDEX idx_sms_messages_type ON sms_messages(message_type);
CREATE INDEX idx_sms_messages_created_at ON sms_messages(created_at DESC);
CREATE INDEX idx_sms_messages_twilio_sid ON sms_messages(twilio_sid);

-- SMS Media Attachments (for MMS support)
CREATE TABLE sms_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sms_message_id UUID NOT NULL REFERENCES sms_messages(id) ON DELETE CASCADE,

  storage_path TEXT NOT NULL,   -- Path in Supabase Storage bucket
  public_url TEXT NOT NULL,     -- Public URL for Twilio to fetch
  content_type TEXT,
  file_size INT,
  name TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sms_media_message_id ON sms_media(sms_message_id);

-- Add opt-out tracking to families table
ALTER TABLE families
  ADD COLUMN IF NOT EXISTS sms_opt_out BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_opt_out_at TIMESTAMPTZ;

-- Updated_at trigger for sms_messages
CREATE OR REPLACE FUNCTION update_sms_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sms_messages_updated_at
  BEFORE UPDATE ON sms_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_sms_messages_updated_at();

-- Comments for documentation
COMMENT ON TABLE sms_messages IS 'SMS/MMS message history. Status updates via Twilio webhooks.';
COMMENT ON TABLE sms_media IS 'MMS media attachments linked to SMS messages.';
COMMENT ON COLUMN families.sms_opt_out IS 'Whether family has opted out of SMS notifications (replied STOP).';
