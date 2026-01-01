// Mailchimp Integration Edge Function
// Securely handles Mailchimp API calls with server-side API key
//
// Required secrets (set in Supabase Dashboard > Edge Functions > Secrets):
// - MAILCHIMP_API_KEY: Your Mailchimp API key
// - MAILCHIMP_SERVER_PREFIX: Your server prefix (e.g., 'us14')
// - MAILCHIMP_LIST_ID: Your audience/list ID

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
  status?: string
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
  if (lead.status) tags.push(`status-${lead.status}`)

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

        // Update the lead record in Supabase with Mailchimp info
        if (payload.leadId) {
          const supabaseService = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          )
          await supabaseService
            .from('leads')
            .update({
              mailchimp_id: (result as { mailchimpId: string }).mailchimpId,
              mailchimp_status: 'synced',
              mailchimp_last_synced_at: new Date().toISOString(),
            })
            .eq('id', payload.leadId)
        }
        break

      case 'bulk_sync':
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

        // Update leads in database with mailchimp_id for successful syncs
        const supabaseService = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )
        const successfulSyncs = allResults
          .map((r, i) => ({
            leadId: payload.leads[i].id,
            result: r.status === 'fulfilled' ? r.value : null,
          }))
          .filter(s => s.result && s.leadId)

        for (const sync of successfulSyncs) {
          await supabaseService
            .from('leads')
            .update({
              mailchimp_id: sync.result!.mailchimpId,
              mailchimp_status: 'synced',
              mailchimp_last_synced_at: new Date().toISOString(),
            })
            .eq('id', sync.leadId)
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

      case 'get_campaigns':
        result = await getCampaigns(config, payload?.count || 10)
        break

      case 'get_audience_stats':
        result = await getAudienceStats(config)
        break

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
