You are an executor agent. Follow these instructions EXACTLY. Do not improvise or add features beyond what is specified. After making changes, run `npm run build` and `npm run lint` to verify.

# Task: Add Mailchimp sync logging infrastructure

## Problem

T6 (`trigger_sync_family_status_to_mailchimp`) uses `pg_net` for async HTTP calls to the Mailchimp edge function. There is zero error handling — no retry, no error logging, no failure alerting. If the edge function fails, Mailchimp tags silently drift.

## Overview of changes

1. Create `mailchimp_sync_log` table
2. Modify the `mailchimp` edge function to log every sync_family_status call
3. Add `useMailchimpSyncLog()` hook
4. Update docs

## Step 1: Create the mailchimp_sync_log table

Use `mcp__supabase__apply_migration` with name `create_mailchimp_sync_log`. Apply this SQL:

```sql
CREATE TABLE IF NOT EXISTS mailchimp_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid REFERENCES families(id) ON DELETE SET NULL,
  old_status text,
  new_status text,
  sync_status text NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'success', 'failed')),
  error_message text,
  mailchimp_id text,
  tag_applied text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for querying by family
CREATE INDEX idx_mailchimp_sync_log_family_id ON mailchimp_sync_log(family_id);

-- Index for querying failures
CREATE INDEX idx_mailchimp_sync_log_status ON mailchimp_sync_log(sync_status) WHERE sync_status = 'failed';

-- Index for recent logs
CREATE INDEX idx_mailchimp_sync_log_created_at ON mailchimp_sync_log(created_at DESC);

-- No RLS (internal admin app)
```

## Step 2: Modify the mailchimp edge function

Read the file `supabase/functions/mailchimp/index.ts`. Find the `case 'sync_family_status'` block (around line 817).

At the very beginning of this case block (after the email/status validation), add a log record insert:

```typescript
// Create sync log record (pending)
const logClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)
const { data: logRecord } = await logClient
  .from('mailchimp_sync_log')
  .insert({
    family_id: payload.familyId || null,
    old_status: payload.old_status || null,
    new_status: payload.status,
    sync_status: 'pending',
  })
  .select('id')
  .single()
const logId = logRecord?.id
```

Then, after the successful tag update and family record update (near the end of the case block, right before `result = { success: true, ... }`), update the log to success:

```typescript
// Update sync log to success
if (logId) {
  await logClient
    .from('mailchimp_sync_log')
    .update({
      sync_status: 'success',
      mailchimp_id: upsertData.id,
      tag_applied: newTag,
    })
    .eq('id', logId)
}
```

Also, wrap the main sync logic in a try-catch within this case block. In the catch, update the log to failed:

```typescript
// In the catch block for sync_family_status errors:
if (logId) {
  await logClient
    .from('mailchimp_sync_log')
    .update({
      sync_status: 'failed',
      error_message: (error as Error).message || 'Unknown error',
    })
    .eq('id', logId)
}
```

IMPORTANT: The existing code in this case block already works. Do NOT restructure the entire case block. Only ADD the logging code at the appropriate insertion points. Keep the existing logic intact.

ALSO IMPORTANT: There is likely already a `supabaseStatus` or `supabase` client created partway through the block for updating the family record. Reuse that client for the log updates rather than creating a second one if possible. But if the client is created after the point where you need to insert the log, use the `logClient` pattern above.

## Step 3: Add useMailchimpSyncLog hook

Add this hook to `src/lib/hooks.ts`. Find a logical place near other Mailchimp-related code or at the end of the hooks file.

```typescript
export function useMailchimpSyncLog(options?: { familyId?: string; status?: string; limit?: number }) {
  return useQuery({
    queryKey: ['mailchimp-sync-log', options?.familyId, options?.status, options?.limit],
    queryFn: async () => {
      let query = supabase
        .from('mailchimp_sync_log')
        .select('*, family:families(display_name, primary_email)')
        .order('created_at', { ascending: false })
        .limit(options?.limit || 50)

      if (options?.familyId) {
        query = query.eq('family_id', options.familyId)
      }
      if (options?.status) {
        query = query.eq('sync_status', options.status)
      }

      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}
```

NOTE: Since the `mailchimp_sync_log` table is new and types haven't been regenerated, use the `(supabase.from as any)('mailchimp_sync_log')` pattern with a comment explaining why. This avoids TypeScript errors until `npm run db:types` is run.

Actually — check if the project uses a pattern like this elsewhere. Search hooks.ts for `as any` to see if there's a precedent. If the project always uses typed queries, you may need to add a temporary type assertion.

## Step 4: Update docs/DATABASE_SCHEMA.sql

Add the `mailchimp_sync_log` table definition and indexes.

## Step 5: Update INTERFACES.md

1. Add the new `mailchimp_sync_log` table to the database tables section
2. Update the T6 trigger section to note that sync results are now logged
3. Add the `useMailchimpSyncLog` hook to the hooks catalog
4. Note that the edge function now logs every sync_family_status call

## Step 6: Update optimization-roadmap.md

Find item #1 in the tracking table and change its status from "Not started" to "Complete" and add today's date (2026-02-20).

NOTE: The roadmap also mentions a `mailchimp-reconcile` edge function. Skip that for now — it's a separate task. Only implement the sync logging described above.

## Step 7: Verify

Run `npm run build` and `npm run lint`. Report results. Fix any errors before finishing.
