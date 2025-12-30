// Gmail API types for n8n webhook integration

export interface GmailMessage {
  id: string
  threadId: string
  snippet: string
  subject: string
  from: string
  to: string
  cc?: string
  bcc?: string
  date: string // ISO format - from Gmail internalDate
  internalDate: number // Unix timestamp in milliseconds
  isOutbound: boolean
  labelIds: string[]
  recipientCount: number // Total recipients (to + cc + bcc)
}

export interface GmailThread {
  id: string
  messages: GmailThreadMessage[]
}

export interface GmailThreadMessage {
  id: string
  from: string
  to: string
  subject: string
  date: string
  bodyHtml?: string
  bodyText: string
  messageId: string // Message-ID header, needed for replies
}

export interface SendEmailPayload {
  to: string
  subject: string
  body: string
  threadId?: string // For replies - enables Gmail threading
  inReplyTo?: string // Message-ID header for proper threading
}

export interface GmailSearchParams {
  email: string
  query?: string // Additional Gmail search query (e.g., "subject:invoice")
  maxResults?: number
  pageToken?: string // For pagination
}

export interface GmailSearchResponse {
  success: boolean
  messages: GmailMessage[]
  nextPageToken?: string // For loading more results
  resultSizeEstimate?: number // Approximate total results
  error?: string
}

export interface GmailThreadResponse {
  success: boolean
  thread: GmailThread
  error?: string
}

export interface GmailSendResponse {
  success: boolean
  messageId: string
  error?: string
}

// Combined email item for unified timeline (Gmail + Console-sent)
export interface UnifiedEmailItem {
  id: string
  threadId?: string
  subject: string
  snippet: string
  from: string
  to: string
  date: string // ISO format
  isOutbound: boolean
  source: 'gmail' | 'console'
  recipientCount?: number
  // For console-sent emails
  invoiceNumber?: string
  emailType?: string
}
