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
    throw new Error(error.message || 'Failed to call Mailchimp function')
  }

  if (!data?.success) {
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
  // Edge function expects 'familyId' for DB writeback
  const { leadId, ...rest } = lead
  return callMailchimpFunction<SyncLeadResult>('sync_lead', { ...rest, familyId: leadId })
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
  // Edge function expects 'familyId' not 'leadId'
  return callMailchimpFunction<EngagementResult>('sync_engagement', { familyId: leadId, email })
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

// ============================================
// Campaign Analytics Functions
// ============================================

interface SyncCampaignsResult {
  total: number
  synced: number
  failed: number
  campaigns: Array<{ id: string; campaign_name: string; status: string }>
  errors: Array<{ campaign_id: string; error: string }>
}

interface SyncCampaignActivityResult {
  mailchimp_campaign_id: string
  db_campaign_id: string
  total_subscribers_processed: number
  leads_matched: number
  records_upserted: number
  errors: number
}

interface CampaignReport {
  id: string
  emails_sent: number
  opens: {
    opens_total: number
    unique_opens: number
    open_rate: number
  }
  clicks: {
    clicks_total: number
    unique_clicks: number
    click_rate: number
  }
  unsubscribed: number
  bounces: {
    hard_bounces: number
    soft_bounces: number
  }
}

/**
 * Sync campaigns from Mailchimp to database
 * Fetches recent campaigns and stores them with their stats
 */
export async function syncCampaigns(count: number = 20): Promise<SyncCampaignsResult> {
  return callMailchimpFunction<SyncCampaignsResult>('sync_campaigns', { count })
}

/**
 * Get detailed report for a specific campaign
 */
export async function getCampaignReport(campaignId: string): Promise<CampaignReport> {
  return callMailchimpFunction<CampaignReport>('get_campaign_report', { campaignId })
}

/**
 * Sync per-lead campaign activity from Mailchimp
 * @param campaignId - Mailchimp campaign ID
 * @param dbCampaignId - Database UUID for the campaign
 */
export async function syncCampaignActivity(
  campaignId: string,
  dbCampaignId: string
): Promise<SyncCampaignActivityResult> {
  return callMailchimpFunction<SyncCampaignActivityResult>('sync_campaign_activity', {
    campaignId,
    dbCampaignId,
  })
}
