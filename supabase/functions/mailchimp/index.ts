// Mailchimp Integration Edge Function
// Securely handles Mailchimp API calls with server-side API key
//
// Required secrets (set in Supabase Dashboard > Edge Functions > Secrets):
// - MAILCHIMP_API_KEY: Your Mailchimp API key
// - MAILCHIMP_SERVER_PREFIX: Your server prefix (e.g., 'us14')
// - MAILCHIMP_LIST_ID: Your audience/list ID
//
// Note: Leads are stored in the families table with status='lead'

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from 'https://deno.land/std@0.224.0/crypto/mod.ts'
import { encodeHex } from 'https://deno.land/std@0.224.0/encoding/hex.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// MD5 hash for Mailchimp subscriber ID
async function md5(str: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(str.toLowerCase())
  const hash = await crypto.subtle.digest('MD5', data)
  return encodeHex(new Uint8Array(hash))
}

interface MailchimpConfig {
  apiKey: string
  serverPrefix: string
  listId: string
}

function getConfig(): MailchimpConfig {
  const apiKey = Deno.env.get('MAILCHIMP_API_KEY')
  const serverPrefix = Deno.env.get('MAILCHIMP_SERVER_PREFIX')
  const listId = Deno.env.get('MAILCHIMP_LIST_ID')

  if (!apiKey || !serverPrefix || !listId) {
    throw new Error('Missing Mailchimp configuration. Set MAILCHIMP_API_KEY, MAILCHIMP_SERVER_PREFIX, and MAILCHIMP_LIST_ID secrets.')
  }

  return { apiKey, serverPrefix, listId }
}

async function mailchimpRequest(
  config: MailchimpConfig,
  endpoint: string,
  method: string = 'GET',
  body?: unknown
): Promise<Response> {
  const url = `https://${config.serverPrefix}.api.mailchimp.com/3.0${endpoint}`
  const auth = btoa(`anystring:${config.apiKey}`)

  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  return response
}

// Sync a lead to Mailchimp (add or update subscriber)
async function syncLead(config: MailchimpConfig, lead: {
  email: string
  name?: string | null
  lead_type: string
  lead_status?: string
  phone?: string | null
}): Promise<{ success: boolean; mailchimpId: string; action: string }> {
  const subscriberHash = await md5(lead.email)
  const endpoint = `/lists/${config.listId}/members/${subscriberHash}`

  // Parse name into first/last
  let firstName = ''
  let lastName = ''
  if (lead.name) {
    const parts = lead.name.trim().split(/\s+/)
    firstName = parts[0] || ''
    lastName = parts.slice(1).join(' ') || ''
  }

  // Build merge fields
  const mergeFields: Record<string, string> = {}
  if (firstName) mergeFields.FNAME = firstName
  if (lastName) mergeFields.LNAME = lastName
  if (lead.phone) mergeFields.PHONE = lead.phone

  // Build tags based on lead type
  const tags = [lead.lead_type.replace('_', '-')] // e.g., 'exit-intent', 'calendly-call'
  if (lead.lead_status) tags.push(`status-${lead.lead_status}`)

  // Use PUT for upsert behavior
  const response = await mailchimpRequest(config, endpoint, 'PUT', {
    email_address: lead.email,
    status_if_new: 'subscribed',
    merge_fields: mergeFields,
    tags,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || error.title || 'Failed to sync to Mailchimp')
  }

  const data = await response.json()
  return {
    success: true,
    mailchimpId: data.id,
    action: data.status === 'subscribed' ? 'synced' : data.status,
  }
}

// Add tags to a subscriber
async function addTags(config: MailchimpConfig, email: string, tags: string[]): Promise<{ success: boolean }> {
  const subscriberHash = await md5(email)
  const endpoint = `/lists/${config.listId}/members/${subscriberHash}/tags`

  const response = await mailchimpRequest(config, endpoint, 'POST', {
    tags: tags.map(tag => ({ name: tag, status: 'active' })),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || error.title || 'Failed to add tags')
  }

  return { success: true }
}

// Get subscriber info
async function getSubscriber(config: MailchimpConfig, email: string): Promise<unknown> {
  const subscriberHash = await md5(email)
  const endpoint = `/lists/${config.listId}/members/${subscriberHash}`

  const response = await mailchimpRequest(config, endpoint, 'GET')

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || error.title || 'Failed to get subscriber')
  }

  return response.json()
}

// Get subscriber activity
async function getSubscriberActivity(config: MailchimpConfig, email: string): Promise<unknown> {
  const subscriberHash = await md5(email)
  const endpoint = `/lists/${config.listId}/members/${subscriberHash}/activity`

  const response = await mailchimpRequest(config, endpoint, 'GET')

  if (response.status === 404) {
    return { activity: [] }
  }

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || error.title || 'Failed to get activity')
  }

  return response.json()
}

// Calculate engagement score from activity
// Opens = 1 point, Clicks = 3 points
interface ActivityItem {
  action: string
  timestamp: string
  campaign_id?: string
}

function calculateEngagement(activity: ActivityItem[]): { opens: number; clicks: number; score: number } {
  let opens = 0
  let clicks = 0

  for (const item of activity) {
    if (item.action === 'open') {
      opens++
    } else if (item.action === 'click') {
      clicks++
    }
  }

  const score = opens * 1 + clicks * 3
  return { opens, clicks, score }
}

// Get recent campaigns
async function getCampaigns(config: MailchimpConfig, count: number = 10): Promise<unknown> {
  const endpoint = `/campaigns?count=${count}&sort_field=send_time&sort_dir=DESC`

  const response = await mailchimpRequest(config, endpoint, 'GET')

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || error.title || 'Failed to get campaigns')
  }

  return response.json()
}

// Get campaign report (detailed stats)
async function getCampaignReport(config: MailchimpConfig, campaignId: string): Promise<unknown> {
  const endpoint = `/reports/${campaignId}`

  const response = await mailchimpRequest(config, endpoint, 'GET')

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || error.title || 'Failed to get campaign report')
  }

  return response.json()
}

// Get campaign email activity (who opened/clicked)
async function getCampaignEmailActivity(
  config: MailchimpConfig,
  campaignId: string,
  count: number = 100,
  offset: number = 0
): Promise<{ emails: unknown[]; total_items: number }> {
  const endpoint = `/reports/${campaignId}/email-activity?count=${count}&offset=${offset}`

  const response = await mailchimpRequest(config, endpoint, 'GET')

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || error.title || 'Failed to get email activity')
  }

  return response.json()
}

// Get audience stats
async function getAudienceStats(config: MailchimpConfig): Promise<unknown> {
  const endpoint = `/lists/${config.listId}`

  const response = await mailchimpRequest(config, endpoint, 'GET')

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || error.title || 'Failed to get audience stats')
  }

  const data = await response.json()
  return {
    name: data.name,
    memberCount: data.stats.member_count,
    unsubscribeCount: data.stats.unsubscribe_count,
    openRate: data.stats.open_rate,
    clickRate: data.stats.click_rate,
    lastSent: data.stats.campaign_last_sent,
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Note: Auth check removed - this is an internal admin tool
    // The endpoint is protected by requiring the Supabase project URL/anon key

    let config: MailchimpConfig
    try {
      config = getConfig()
    } catch (configError) {
      console.error('Config error:', configError)
      return new Response(
        JSON.stringify({ error: configError instanceof Error ? configError.message : 'Missing Mailchimp config' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const { action, payload } = await req.json()

    let result: unknown

    switch (action) {
      case 'sync_lead':
        // Sync a single lead to Mailchimp
        if (!payload?.email) {
          throw new Error('Email is required')
        }
        result = await syncLead(config, payload)

        // Update the family record in Supabase with Mailchimp info
        if (payload.familyId) {
          const supabaseService = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          )
          await supabaseService
            .from('families')
            .update({
              mailchimp_id: (result as { mailchimpId: string }).mailchimpId,
              mailchimp_status: 'synced',
              mailchimp_last_synced_at: new Date().toISOString(),
            })
            .eq('id', payload.familyId)
        }
        break

      case 'bulk_sync': {
        // Sync multiple leads with rate limiting to avoid Mailchimp API limits
        if (!Array.isArray(payload?.leads)) {
          throw new Error('leads array is required')
        }

        const BATCH_SIZE = 5 // Process 5 at a time
        const DELAY_MS = 500 // Wait 500ms between batches
        const allResults: PromiseSettledResult<{ success: boolean; mailchimpId: string; action: string }>[] = []

        for (let i = 0; i < payload.leads.length; i += BATCH_SIZE) {
          const batch = payload.leads.slice(i, i + BATCH_SIZE)
          const batchResults = await Promise.allSettled(
            batch.map((lead: { id?: string; email: string; name?: string; lead_type: string }) =>
              syncLead(config, lead)
            )
          )
          allResults.push(...batchResults)

          // Add delay between batches (except for last batch)
          if (i + BATCH_SIZE < payload.leads.length) {
            await new Promise(resolve => setTimeout(resolve, DELAY_MS))
          }
        }

        // Update families in database with mailchimp_id for successful syncs
        const supabaseService = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )
        const successfulSyncs = allResults
          .map((r, i) => ({
            familyId: payload.leads[i].id,
            result: r.status === 'fulfilled' ? r.value : null,
          }))
          .filter(s => s.result && s.familyId)

        for (const sync of successfulSyncs) {
          await supabaseService
            .from('families')
            .update({
              mailchimp_id: sync.result!.mailchimpId,
              mailchimp_status: 'synced',
              mailchimp_last_synced_at: new Date().toISOString(),
            })
            .eq('id', sync.familyId)
        }

        result = {
          total: payload.leads.length,
          success: allResults.filter(r => r.status === 'fulfilled').length,
          failed: allResults.filter(r => r.status === 'rejected').length,
          details: allResults.map((r, i) => ({
            email: payload.leads[i].email,
            status: r.status,
            result: r.status === 'fulfilled' ? r.value : (r as PromiseRejectedResult).reason?.message,
          })),
        }
        break
      }

      case 'add_tags':
        if (!payload?.email || !Array.isArray(payload?.tags)) {
          throw new Error('email and tags array are required')
        }
        result = await addTags(config, payload.email, payload.tags)
        break

      case 'get_subscriber':
        if (!payload?.email) {
          throw new Error('Email is required')
        }
        result = await getSubscriber(config, payload.email)
        break

      case 'get_activity':
        if (!payload?.email) {
          throw new Error('Email is required')
        }
        result = await getSubscriberActivity(config, payload.email)
        break

      case 'sync_engagement':
        // Sync engagement data for a single lead (family with status='lead')
        if (!payload?.email || !payload?.familyId) {
          throw new Error('email and familyId are required')
        }
        {
          const activityResult = await getSubscriberActivity(config, payload.email) as { activity: ActivityItem[] }
          const engagement = calculateEngagement(activityResult.activity || [])

          // Update family with engagement data
          const supabaseEngagement = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          )

          // Build update payload
          const updatePayload: Record<string, unknown> = {
            mailchimp_opens: engagement.opens,
            mailchimp_clicks: engagement.clicks,
            mailchimp_engagement_score: engagement.score,
            mailchimp_engagement_updated_at: new Date().toISOString(),
          }

          // Auto-advance lead_status from 'new' to 'contacted' if they engaged with emails
          let statusAdvanced = false
          if (engagement.opens > 0) {
            // Check current lead_status
            const { data: currentFamily } = await supabaseEngagement
              .from('families')
              .select('lead_status')
              .eq('id', payload.familyId)
              .single()

            if (currentFamily?.lead_status === 'new') {
              updatePayload.lead_status = 'contacted'
              statusAdvanced = true
            }
          }

          await supabaseEngagement
            .from('families')
            .update(updatePayload)
            .eq('id', payload.familyId)

          result = {
            ...engagement,
            updated: true,
            statusAdvanced,
          }
        }
        break

      case 'bulk_sync_engagement':
        // Sync engagement for multiple leads (families with status='lead')
        if (!Array.isArray(payload?.leads)) {
          throw new Error('leads array is required (each with email and id)')
        }
        {
          const engagementResults: { familyId: string; email: string; opens: number; clicks: number; score: number; statusAdvanced?: boolean; error?: string }[] = []
          const supabaseBulk = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          )

          // Fetch current lead_status for all families to check for auto-advance
          const familyIds = payload.leads.filter((l: { id?: string }) => l.id).map((l: { id: string }) => l.id)
          const { data: currentFamilies } = await supabaseBulk
            .from('families')
            .select('id, lead_status')
            .in('id', familyIds)

          const familyStatusMap = new Map<string, string>()
          for (const family of currentFamilies || []) {
            if (family.lead_status) {
              familyStatusMap.set(family.id, family.lead_status)
            }
          }

          // Process in batches to avoid rate limits
          const ENG_BATCH_SIZE = 5
          const ENG_DELAY_MS = 500

          for (let i = 0; i < payload.leads.length; i += ENG_BATCH_SIZE) {
            const batch = payload.leads.slice(i, i + ENG_BATCH_SIZE)

            for (const lead of batch) {
              try {
                if (!lead.email || !lead.id) {
                  engagementResults.push({
                    familyId: lead.id || 'unknown',
                    email: lead.email || 'unknown',
                    opens: 0,
                    clicks: 0,
                    score: 0,
                    error: 'Missing email or id',
                  })
                  continue
                }

                const actResult = await getSubscriberActivity(config, lead.email) as { activity: ActivityItem[] }
                const eng = calculateEngagement(actResult.activity || [])

                // Build update payload
                const updatePayload: Record<string, unknown> = {
                  mailchimp_opens: eng.opens,
                  mailchimp_clicks: eng.clicks,
                  mailchimp_engagement_score: eng.score,
                  mailchimp_engagement_updated_at: new Date().toISOString(),
                }

                // Auto-advance lead_status from 'new' to 'contacted' if they engaged
                let statusAdvanced = false
                if (eng.opens > 0 && familyStatusMap.get(lead.id) === 'new') {
                  updatePayload.lead_status = 'contacted'
                  statusAdvanced = true
                }

                await supabaseBulk
                  .from('families')
                  .update(updatePayload)
                  .eq('id', lead.id)

                engagementResults.push({
                  familyId: lead.id,
                  email: lead.email,
                  ...eng,
                  statusAdvanced,
                })
              } catch (err) {
                engagementResults.push({
                  familyId: lead.id,
                  email: lead.email,
                  opens: 0,
                  clicks: 0,
                  score: 0,
                  error: err instanceof Error ? err.message : String(err),
                })
              }
            }

            // Delay between batches
            if (i + ENG_BATCH_SIZE < payload.leads.length) {
              await new Promise(resolve => setTimeout(resolve, ENG_DELAY_MS))
            }
          }

          result = {
            total: payload.leads.length,
            success: engagementResults.filter(r => !r.error).length,
            failed: engagementResults.filter(r => r.error).length,
            statusAdvanced: engagementResults.filter(r => r.statusAdvanced).length,
            results: engagementResults,
          }
        }
        break

      case 'get_campaigns':
        result = await getCampaigns(config, payload?.count || 10)
        break

      case 'sync_campaigns':
        // Fetch campaigns from Mailchimp and store in database
        {
          const count = payload?.count || 20
          const campaignsData = await getCampaigns(config, count) as {
            campaigns: Array<{
              id: string
              settings: { subject_line: string; title: string; preview_text?: string }
              type: string
              send_time: string
              status: string
            }>
          }

          const supabaseCampaigns = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          )

          const syncedCampaigns: Array<{ id: string; campaign_name: string; status: string }> = []
          const errors: Array<{ campaign_id: string; error: string }> = []

          for (const campaign of campaignsData.campaigns) {
            // Only sync sent campaigns
            if (campaign.status !== 'sent') continue

            try {
              // Get detailed report for the campaign
              const report = await getCampaignReport(config, campaign.id) as {
                emails_sent: number
                opens: { opens_total: number; unique_opens: number; open_rate: number }
                clicks: { clicks_total: number; unique_clicks: number; click_rate: number }
                unsubscribed: number
                bounces: { hard_bounces: number; soft_bounces: number }
              }

              // Upsert campaign into database
              const { data: upsertedCampaign, error: upsertError } = await supabaseCampaigns
                .from('email_campaigns')
                .upsert({
                  mailchimp_campaign_id: campaign.id,
                  campaign_name: campaign.settings.title,
                  subject_line: campaign.settings.subject_line,
                  preview_text: campaign.settings.preview_text || null,
                  campaign_type: campaign.type,
                  send_time: campaign.send_time,
                  emails_sent: report.emails_sent,
                  unique_opens: report.opens.unique_opens,
                  total_opens: report.opens.opens_total,
                  open_rate: report.opens.open_rate,
                  unique_clicks: report.clicks.unique_clicks,
                  total_clicks: report.clicks.clicks_total,
                  click_rate: report.clicks.click_rate,
                  unsubscribes: report.unsubscribed,
                  bounces: report.bounces.hard_bounces + report.bounces.soft_bounces,
                  is_ab_test: campaign.type === 'variate',
                  status: 'sent',
                  last_synced_at: new Date().toISOString(),
                }, {
                  onConflict: 'mailchimp_campaign_id',
                })
                .select('id, campaign_name')
                .single()

              if (upsertError) {
                errors.push({ campaign_id: campaign.id, error: upsertError.message })
              } else if (upsertedCampaign) {
                syncedCampaigns.push({
                  id: upsertedCampaign.id,
                  campaign_name: upsertedCampaign.campaign_name,
                  status: 'synced',
                })
              }

              // Small delay to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 200))
            } catch (err) {
              errors.push({
                campaign_id: campaign.id,
                error: err instanceof Error ? err.message : String(err),
              })
            }
          }

          result = {
            total: campaignsData.campaigns.filter(c => c.status === 'sent').length,
            synced: syncedCampaigns.length,
            failed: errors.length,
            campaigns: syncedCampaigns,
            errors,
          }
        }
        break

      case 'get_campaign_report':
        // Get detailed report for a specific campaign
        if (!payload?.campaignId) {
          throw new Error('campaignId is required')
        }
        result = await getCampaignReport(config, payload.campaignId)
        break

      case 'sync_campaign_activity':
        // Sync per-subscriber activity for a campaign to lead_campaign_engagement
        if (!payload?.campaignId || !payload?.dbCampaignId) {
          throw new Error('campaignId (Mailchimp) and dbCampaignId (database UUID) are required')
        }
        {
          const supabaseActivity = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          )

          // Get all lead families with their emails for matching
          // Leads are families with status='lead' OR have a lead_type set
          const { data: leadFamilies, error: familiesError } = await supabaseActivity
            .from('families')
            .select('id, primary_email')
            .or('status.eq.lead,lead_type.not.is.null')

          if (familiesError) {
            throw new Error(`Failed to fetch lead families: ${familiesError.message}`)
          }

          // Create email -> family_id map (lowercase for matching)
          const emailToFamilyId = new Map<string, string>()
          for (const family of leadFamilies || []) {
            if (family.primary_email) {
              emailToFamilyId.set(family.primary_email.toLowerCase(), family.id)
            }
          }

          // Fetch email activity from Mailchimp (paginated)
          let offset = 0
          const pageSize = 100
          let totalProcessed = 0
          let totalMatched = 0
          const engagementRecords: Array<{
            family_id: string
            campaign_id: string
            was_sent: boolean
            opened: boolean
            first_opened_at: string | null
            open_count: number
            clicked: boolean
            first_clicked_at: string | null
            click_count: number
          }> = []

          while (true) {
            const activityPage = await getCampaignEmailActivity(
              config,
              payload.campaignId,
              pageSize,
              offset
            ) as {
              emails: Array<{
                email_address: string
                activity: Array<{ action: string; timestamp: string; url?: string }>
              }>
              total_items: number
            }

            if (!activityPage.emails || activityPage.emails.length === 0) break

            for (const subscriber of activityPage.emails) {
              totalProcessed++
              const familyId = emailToFamilyId.get(subscriber.email_address.toLowerCase())

              if (!familyId) continue // Not a lead in our system
              totalMatched++

              // Process activity
              let opened = false
              let firstOpenedAt: string | null = null
              let openCount = 0
              let clicked = false
              let firstClickedAt: string | null = null
              let clickCount = 0

              for (const act of subscriber.activity || []) {
                if (act.action === 'open') {
                  openCount++
                  opened = true
                  if (!firstOpenedAt || act.timestamp < firstOpenedAt) {
                    firstOpenedAt = act.timestamp
                  }
                } else if (act.action === 'click') {
                  clickCount++
                  clicked = true
                  if (!firstClickedAt || act.timestamp < firstClickedAt) {
                    firstClickedAt = act.timestamp
                  }
                }
              }

              engagementRecords.push({
                family_id: familyId,
                campaign_id: payload.dbCampaignId,
                was_sent: true,
                opened,
                first_opened_at: firstOpenedAt,
                open_count: openCount,
                clicked,
                first_clicked_at: firstClickedAt,
                click_count: clickCount,
              })
            }

            offset += pageSize
            if (offset >= activityPage.total_items) break

            // Small delay between pages
            await new Promise(resolve => setTimeout(resolve, 200))
          }

          // Upsert engagement records in batches
          const batchSize = 50
          let upsertedCount = 0
          let upsertErrors = 0

          for (let i = 0; i < engagementRecords.length; i += batchSize) {
            const batch = engagementRecords.slice(i, i + batchSize)
            const { error: upsertError } = await supabaseActivity
              .from('lead_campaign_engagement')
              .upsert(batch, {
                onConflict: 'family_id,campaign_id',
              })

            if (upsertError) {
              console.error('Upsert error:', upsertError)
              upsertErrors += batch.length
            } else {
              upsertedCount += batch.length
            }
          }

          result = {
            mailchimp_campaign_id: payload.campaignId,
            db_campaign_id: payload.dbCampaignId,
            total_subscribers_processed: totalProcessed,
            leads_matched: totalMatched,
            records_upserted: upsertedCount,
            errors: upsertErrors,
          }
        }
        break

      case 'get_audience_stats':
        result = await getAudienceStats(config)
        break

      case 'sync_family_status': {
        // Called by database trigger when family status changes (active, churned, etc.)
        // Upserts member to Mailchimp and updates status tags
        if (!payload?.email || !payload?.status) {
          throw new Error('email and status are required')
        }

        const statusEmail = payload.email.toLowerCase()
        const statusHash = await md5(statusEmail)
        const memberEndpoint = `/lists/${config.listId}/members/${statusHash}`

        // Parse name into first/last (name stored as "Last, First" or "First Last")
        let statusFirstName = ''
        let statusLastName = ''
        if (payload.name) {
          const nameParts = payload.name.trim()
          if (nameParts.includes(',')) {
            const [last, ...firstParts] = nameParts.split(',')
            statusFirstName = firstParts.join(',').trim()
            statusLastName = last.trim()
          } else {
            const parts = nameParts.split(/\s+/)
            statusFirstName = parts[0] || ''
            statusLastName = parts.slice(1).join(' ') || ''
          }
        }

        const statusMergeFields: Record<string, string> = {}
        if (statusFirstName) statusMergeFields.FNAME = statusFirstName
        if (statusLastName) statusMergeFields.LNAME = statusLastName
        if (payload.phone) statusMergeFields.PHONE = payload.phone

        // Upsert member (won't re-subscribe unsubscribed contacts)
        const upsertResponse = await mailchimpRequest(config, memberEndpoint, 'PUT', {
          email_address: statusEmail,
          status_if_new: 'subscribed',
          merge_fields: statusMergeFields,
        })

        if (!upsertResponse.ok) {
          const upsertError = await upsertResponse.json()
          throw new Error(upsertError.detail || upsertError.title || 'Failed to upsert member')
        }

        const upsertData = await upsertResponse.json()

        // Map family status to Mailchimp tag
        const statusTagMap: Record<string, string> = {
          active: 'active-family',
          trial: 'active-family',
          lead: 'lead',
          churned: 'churned',
          paused: 'churned',
        }
        const newTag = statusTagMap[payload.status] || payload.status

        // Remove old status tags, add new one
        const allStatusTags = ['active-family', 'lead', 'churned']
        const tagUpdates = allStatusTags.map(tag => ({
          name: tag,
          status: tag === newTag ? 'active' : 'inactive',
        }))

        const tagEndpoint = `/lists/${config.listId}/members/${statusHash}/tags`
        const tagResponse = await mailchimpRequest(config, tagEndpoint, 'POST', {
          tags: tagUpdates,
        })

        // Tag endpoint returns 204 on success (no body)
        if (!tagResponse.ok && tagResponse.status !== 204) {
          const tagError = await tagResponse.json()
          console.error('Tag update failed:', tagError)
          // Don't throw — member was upserted successfully
        }

        // Update family record with mailchimp sync info
        if (payload.familyId) {
          const supabaseStatus = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          )
          await supabaseStatus
            .from('families')
            .update({
              mailchimp_id: upsertData.id,
              mailchimp_status: 'synced',
              mailchimp_last_synced_at: new Date().toISOString(),
            })
            .eq('id', payload.familyId)
        }

        result = {
          success: true,
          mailchimpId: upsertData.id,
          action: 'status_synced',
          tag: newTag,
          previousStatus: payload.old_status || null,
        }
        break
      }

      default:
        throw new Error(`Unknown action: ${action}`)
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Mailchimp error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
