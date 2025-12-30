// Gmail API functions for n8n webhook integration

import type {
  GmailSearchParams,
  GmailSearchResponse,
  GmailThreadResponse,
  GmailSendResponse,
  SendEmailPayload,
} from '../types/gmail'

const N8N_BASE_URL = 'https://eatonacademic.app.n8n.cloud/webhook'

/**
 * Search Gmail for emails to/from a specific email address
 * Supports pagination and custom search queries
 */
export async function searchGmail(
  params: GmailSearchParams
): Promise<GmailSearchResponse> {
  const response = await fetch(`${N8N_BASE_URL}/gmail-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: params.email,
      query: params.query || '',
      maxResults: params.maxResults || 20,
      pageToken: params.pageToken || undefined,
    }),
  })

  if (!response.ok) {
    throw new Error(`Gmail search failed: ${response.statusText}`)
  }

  const data = await response.json()
  return data as GmailSearchResponse
}

/**
 * Fetch full email thread with message bodies
 */
export async function getGmailThread(
  threadId: string
): Promise<GmailThreadResponse> {
  const response = await fetch(`${N8N_BASE_URL}/gmail-thread`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId }),
  })

  if (!response.ok) {
    throw new Error(`Gmail thread fetch failed: ${response.statusText}`)
  }

  const data = await response.json()
  return data as GmailThreadResponse
}

/**
 * Send a new email or reply to an existing thread
 */
export async function sendGmail(
  payload: SendEmailPayload
): Promise<GmailSendResponse> {
  const response = await fetch(`${N8N_BASE_URL}/gmail-send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Gmail send failed: ${response.statusText}`)
  }

  const data = await response.json()
  return data as GmailSendResponse
}
