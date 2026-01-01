// Mailchimp client wrapper
// Calls the Mailchimp Edge Function for secure API access

import { supabase } from './supabase'

interface SyncLeadResult {
  success: boolean
  mailchimpId: string
  action: string
}

interface BulkSyncResult {
  total: number
  success: number
  failed: number
  details: Array<{
    email: string
    status: 'fulfilled' | 'rejected'
    result: string | SyncLeadResult
  }>
}

interface SubscriberInfo {
  id: string
  email_address: string
  status: string
  merge_fields: {
    FNAME?: string
    LNAME?: string
    PHONE?: string
  }
  tags: Array<{ id: number; name: string }>
  stats: {
    avg_open_rate: number
    avg_click_rate: number
  }
  last_changed: string
}

interface SubscriberActivity {
  activity: Array<{
    action: string
    timestamp: string
    title?: string
    campaign_id?: string
  }>
}

interface Campaign {
  id: string
  type: string
  status: string
  send_time: string
  settings: {
    subject_line: string
    title: string
  }
  report_summary?: {
    opens: number
    unique_opens: number
    open_rate: number
    clicks: number
    subscriber_clicks: number
    click_rate: number
  }
}

interface CampaignsResponse {
  campaigns: Campaign[]
  total_items: number
}

interface AudienceStats {
  name: string
  memberCount: number
  unsubscribeCount: number
  openRate: number
  clickRate: number
  lastSent: string | null
}

async function callMailchimpFunction<T>(action: string, payload?: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke('mailchimp', {
    body: { action, payload },
  })

  if (error) {
    console.error('Mailchimp function error:', error)
    throw new Error(error.message || 'Failed to call Mailchimp function')
  }

  if (!data?.success) {
    console.error('Mailchimp operation failed:', data)
    throw new Error(data?.error || 'Mailchimp operation failed')
  }

  return data.data as T
}

/**
 * Sync a single lead to Mailchimp
 */
export async function syncLeadToMailchimp(lead: {
  leadId?: string
  email: string
  name?: string | null
  lead_type: string
  status?: string
  phone?: string | null
}): Promise<SyncLeadResult> {
  return callMailchimpFunction<SyncLeadResult>('sync_lead', lead)
}

/**
 * Sync multiple leads to Mailchimp
 */
export async function bulkSyncLeadsToMailchimp(leads: Array<{
  id?: string
  email: string
  name?: string | null
  lead_type: string
}>): Promise<BulkSyncResult> {
  return callMailchimpFunction<BulkSyncResult>('bulk_sync', { leads })
}

/**
 * Add tags to a subscriber
 */
export async function addTagsToSubscriber(email: string, tags: string[]): Promise<{ success: boolean }> {
  return callMailchimpFunction<{ success: boolean }>('add_tags', { email, tags })
}

/**
 * Get subscriber information
 */
export async function getSubscriber(email: string): Promise<SubscriberInfo | null> {
  return callMailchimpFunction<SubscriberInfo | null>('get_subscriber', { email })
}

/**
 * Get subscriber activity (opens, clicks, etc.)
 */
export async function getSubscriberActivity(email: string): Promise<SubscriberActivity> {
  return callMailchimpFunction<SubscriberActivity>('get_activity', { email })
}

/**
 * Get recent campaigns
 */
export async function getCampaigns(count: number = 10): Promise<CampaignsResponse> {
  return callMailchimpFunction<CampaignsResponse>('get_campaigns', { count })
}

/**
 * Get audience statistics
 */
export async function getAudienceStats(): Promise<AudienceStats> {
  return callMailchimpFunction<AudienceStats>('get_audience_stats', {})
}

interface EngagementResult {
  opens: number
  clicks: number
  score: number
  updated: boolean
}

interface BulkEngagementResult {
  total: number
  success: number
  failed: number
  results: Array<{
    leadId: string
    email: string
    opens: number
    clicks: number
    score: number
    error?: string
  }>
}

/**
 * Sync engagement data for a single lead
 */
export async function syncLeadEngagement(leadId: string, email: string): Promise<EngagementResult> {
  return callMailchimpFunction<EngagementResult>('sync_engagement', { leadId, email })
}

/**
 * Sync engagement data for multiple leads
 */
export async function bulkSyncEngagement(leads: Array<{ id: string; email: string }>): Promise<BulkEngagementResult> {
  return callMailchimpFunction<BulkEngagementResult>('bulk_sync_engagement', { leads })
}

/**
 * Get engagement level label based on score
 * cold = 0, warm = 1-5, hot = 6+
 */
export function getEngagementLevel(score: number | null | undefined): 'cold' | 'warm' | 'hot' {
  if (!score || score === 0) return 'cold'
  if (score <= 5) return 'warm'
  return 'hot'
}
