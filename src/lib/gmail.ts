// Gmail API functions for n8n webhook integration

import type {
  GmailSearchParams,
  GmailSearchResponse,
  GmailThreadResponse,
  GmailSendResponse,
  SendEmailPayload,
} from '../types/gmail'

const N8N_BASE_URL = import.meta.env.VITE_N8N_BASE_URL || 'https://eatonacademic.app.n8n.cloud/webhook'

// Default timeout for external API calls (30 seconds)
const DEFAULT_TIMEOUT_MS = 30000

/**
 * Search Gmail for emails to/from a specific email address
 * Supports pagination and custom search queries
 */
export async function searchGmail(
  params: GmailSearchParams
): Promise<GmailSearchResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetch(`${N8N_BASE_URL}/gmail-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: params.email,
        query: params.query || '',
        maxResults: params.maxResults || 20,
        pageToken: params.pageToken || undefined,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Gmail search failed: ${response.statusText}`)
    }

    const data = await response.json() as GmailSearchResponse

    // Check for error in response body
    if (data.error) {
      throw new Error(data.error)
    }

    if (!data.success) {
      throw new Error('Gmail search returned unsuccessful response')
    }

    return data
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Gmail search timed out. Please try again.')
    }
    throw error
  }
}

/**
 * Fetch full email thread with message bodies
 */
export async function getGmailThread(
  threadId: string
): Promise<GmailThreadResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetch(`${N8N_BASE_URL}/gmail-thread`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Gmail thread fetch failed: ${response.statusText}`)
    }

    const data = await response.json() as GmailThreadResponse

    // Check for error in response body
    if (data.error) {
      throw new Error(data.error)
    }

    if (!data.success) {
      throw new Error('Gmail thread fetch returned unsuccessful response')
    }

    return data
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Gmail thread fetch timed out. Please try again.')
    }
    throw error
  }
}

/**
 * Send a new email or reply to an existing thread
 */
export async function sendGmail(
  payload: SendEmailPayload
): Promise<GmailSendResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetch(`${N8N_BASE_URL}/gmail-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Gmail send failed: ${response.statusText}`)
    }

    const data = await response.json() as GmailSendResponse

    // Check for error in response body
    if (data.error) {
      throw new Error(data.error)
    }

    if (!data.success) {
      throw new Error('Gmail send returned unsuccessful response')
    }

    return data
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Gmail send timed out. Please try again.')
    }
    throw error
  }
}
