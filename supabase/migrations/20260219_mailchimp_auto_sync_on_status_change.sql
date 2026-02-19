-- Auto-sync families to Mailchimp when status changes to active or churned.
-- Uses pg_net to call the mailchimp edge function asynchronously.
-- This ensures new enrollments and churned families are reflected in Mailchimp
-- without manual intervention.

-- Enable pg_net if not already enabled
create extension if not exists pg_net with schema extensions;

-- Create the trigger function
create or replace function public.sync_family_status_to_mailchimp()
returns trigger
language plpgsql
security definer
as $$
declare
  _supabase_url text := 'https://lxebvngzgabuqfugyqfj.supabase.co';
  _service_role_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZWJ2bmd6Z2FidXFmdWd5cWZqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjQyOTY5MiwiZXhwIjoyMDgyMDA1NjkyfQ.UXscTsO1yCAEGNtkbKdwLiNBiT3us0J0jtSGR7GXn7M';
  _payload jsonb;
begin
  -- Only fire if status actually changed and the family has an email
  if NEW.status is distinct from OLD.status
     and NEW.primary_email is not null
     and NEW.status in ('active', 'trial', 'churned', 'paused')
  then
    _payload := jsonb_build_object(
      'action', 'sync_family_status',
      'payload', jsonb_build_object(
        'familyId', NEW.id,
        'email', NEW.primary_email,
        'name', coalesce(NEW.primary_contact_name, NEW.display_name),
        'phone', NEW.primary_phone,
        'status', NEW.status,
        'old_status', OLD.status
      )
    );

    -- Fire-and-forget HTTP POST to the mailchimp edge function
    perform net.http_post(
      url := _supabase_url || '/functions/v1/mailchimp',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _service_role_key
      )::jsonb,
      body := _payload
    );
  end if;

  return NEW;
end;
$$;

-- Create the trigger (AFTER UPDATE so the row is committed)
drop trigger if exists trigger_sync_family_status_to_mailchimp on public.families;
create trigger trigger_sync_family_status_to_mailchimp
  after update of status on public.families
  for each row
  execute function public.sync_family_status_to_mailchimp();

-- Add a comment for documentation
comment on function public.sync_family_status_to_mailchimp() is
  'Auto-syncs family to Mailchimp when status changes (active/churned). '
  'Updates subscriber tags: active-family, lead, churned. '
  'Called via pg_net (async HTTP) to the mailchimp edge function.';
