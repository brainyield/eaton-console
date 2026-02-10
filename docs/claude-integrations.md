# Integration-Specific Notes

## Calendly

- Phone numbers for outbound call events are in `scheduled_event.location.location` (not on the invitee object)
- Phone extraction priority: location > text_reminder_number > form answers
- The `calendly-webhook` edge function handles this extraction
- Payload structures may vary from docs — always use optional chaining and log raw payloads

## Twilio / SMS

- Twilio returns statuses like `'queued'` and `'sending'` that violate the `sms_messages` CHECK constraint
- Allowed DB values: `pending`, `sent`, `delivered`, `failed`, `undelivered`
- Always map via `mapTwilioStatus()` in `send-sms/index.ts` before inserting
- GSM 03.38 character set is NOT ASCII — use explicit character sets in `smsTemplates.ts`
- Extended characters (€, [, ], etc.) count as 2 characters each

## N8N

- Free/starter plans don't support environment variables for credentials
- Cannot query Supabase directly from N8N workflows
- Pattern: create helper edge functions (like `get-pending-onboarding`) that N8N calls via HTTP
- Edge functions have automatic access to Supabase credentials

## Google Forms

- Use the edit ID format: `/forms/d/{id}/viewform`
- Do NOT use the published ID format: `/forms/d/e/{id}/viewform`
- Form IDs in our config are from the form's edit URL, not the "Send" dialog

## Mailchimp

- Integration goes through a Supabase Edge Function (`src/lib/mailchimp.ts` calls it)
- Not a direct API call from the frontend

## General Webhook Patterns

- Always set `verify_jwt = false` in `supabase/config.toml` for external webhook endpoints
- External services (Stripe, Calendly, etc.) don't send Authorization headers
- Use `[functions.function-name]` section in config.toml (more reliable than per-function config)
- Always use defensive null checks and log raw payloads for debugging
