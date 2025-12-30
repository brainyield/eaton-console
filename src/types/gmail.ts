// Gmail API types for n8n webhook integration

export interface GmailMessage {
  id: string
  threadId: string
  snippet: string
  subject: string
  from: string
  to: string
  date: string // ISO format
  isOutbound: boolean
  labelIds: string[]
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

export interface GmailSearchResponse {
  success: boolean
  messages: GmailMessage[]
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
  // For console-sent emails
  invoiceNumber?: string
  emailType?: string
}
