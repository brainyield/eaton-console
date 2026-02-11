/**
 * SMS Message Templates
 * Type-safe templates with merge field validation
 */

import { formatCurrency } from './moneyUtils'
import { parseLocalDate } from './dateUtils'

// Template merge data types
export interface InvoiceReminderData {
  familyName: string
  invoiceNumber: string
  amount: number
  dueDate: string
  invoiceUrl: string
}

export interface EventReminderData {
  familyName: string
  eventName: string
  eventDate: string
  eventTime: string
  location?: string
}

export interface AnnouncementData {
  customMessage: string
}

// Template type mapping
export type TemplateData = {
  invoice_reminder: InvoiceReminderData
  event_reminder: EventReminderData
  announcement: AnnouncementData
}

// Template keys
export type TemplateKey = keyof TemplateData

// Template configuration
interface TemplateConfig<K extends TemplateKey> {
  key: K
  name: string
  description: string
  generate: (data: TemplateData[K]) => string
  requiredFields: Array<keyof TemplateData[K]>
}

// Opt-out footer (required for compliance)
const OPT_OUT_FOOTER = '\n\nReply STOP to opt out of texts.'

/**
 * Invoice reminder template
 */
export const invoiceReminderTemplate: TemplateConfig<'invoice_reminder'> = {
  key: 'invoice_reminder',
  name: 'Invoice Reminder',
  description: 'Reminds family about outstanding invoice',
  requiredFields: ['familyName', 'invoiceNumber', 'amount', 'dueDate', 'invoiceUrl'],
  generate: (data) => {
    const formattedAmount = formatCurrency(data.amount)

    // Handle missing or invalid due date, with overdue detection
    let duePart = 'due soon'
    if (data.dueDate) {
      try {
        const parsed = parseLocalDate(data.dueDate)
        const formatted = parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const diffDays = Math.floor((today.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24))
        if (diffDays > 0) {
          duePart = `that was due on ${formatted} and is overdue by ${diffDays} day${diffDays === 1 ? '' : 's'}`
        } else {
          duePart = `that is due ${formatted}`
        }
      } catch {
        // Keep default 'due soon' if date parsing fails
      }
    }

    return `Hi ${data.familyName}, this is Eaton Academic. You have an outstanding invoice #${data.invoiceNumber} for ${formattedAmount} ${duePart}. View and pay online: ${data.invoiceUrl}${OPT_OUT_FOOTER}`
  },
}

/**
 * Event reminder template
 */
export const eventReminderTemplate: TemplateConfig<'event_reminder'> = {
  key: 'event_reminder',
  name: 'Event Reminder',
  description: 'Reminds family about upcoming event',
  requiredFields: ['familyName', 'eventName', 'eventDate', 'eventTime'],
  generate: (data) => {
    const locationPart = data.location ? ` at ${data.location}` : ''
    return `Hi ${data.familyName}, reminder: ${data.eventName} is ${data.eventDate} at ${data.eventTime}${locationPart}. We look forward to seeing you!\n\n- Eaton Academic${OPT_OUT_FOOTER}`
  },
}

/**
 * Announcement template (custom message with wrapper)
 */
export const announcementTemplate: TemplateConfig<'announcement'> = {
  key: 'announcement',
  name: 'Announcement',
  description: 'Custom announcement with standard footer',
  requiredFields: ['customMessage'],
  generate: (data) => {
    return `${data.customMessage}\n\n- Eaton Academic${OPT_OUT_FOOTER}`
  },
}

/**
 * Template registry
 */
export const SMS_TEMPLATES: Record<TemplateKey, TemplateConfig<TemplateKey>> = {
  invoice_reminder: invoiceReminderTemplate as TemplateConfig<TemplateKey>,
  event_reminder: eventReminderTemplate as TemplateConfig<TemplateKey>,
  announcement: announcementTemplate as TemplateConfig<TemplateKey>,
}

/**
 * Get template by key
 */
export function getTemplate<K extends TemplateKey>(key: K): TemplateConfig<K> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return SMS_TEMPLATES[key] as any as TemplateConfig<K>
}

/**
 * Generate message from template
 */
export function generateMessage<K extends TemplateKey>(
  templateKey: K,
  data: TemplateData[K]
): string {
  const template = getTemplate(templateKey)
  return template.generate(data)
}

/**
 * Calculate SMS segment count
 * Standard SMS is 160 characters (or 70 for unicode)
 * GSM 03.38 defines a specific character set - anything outside requires unicode
 */

// GSM 03.38 basic character set
const GSM_BASIC_CHARS = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'
// GSM extended chars (count as 2 characters each)
const GSM_EXTENDED_CHARS = '|^€{}[]~\\'

function isGsmCharacter(char: string): boolean {
  return GSM_BASIC_CHARS.includes(char) || GSM_EXTENDED_CHARS.includes(char)
}

export function calculateSegments(message: string): number {
  if (!message) return 0

  // Check if all characters are in GSM character set
  const chars = [...message]
  const isUnicode = chars.some(char => !isGsmCharacter(char))

  if (isUnicode) {
    // Unicode: 70 chars per segment, 67 for multipart
    const segmentSize = 70
    const multipartSegmentSize = 67
    if (message.length <= segmentSize) return 1
    return Math.ceil(message.length / multipartSegmentSize)
  } else {
    // GSM: 160 chars per segment, but extended chars count as 2
    const extendedCount = chars.filter(char => GSM_EXTENDED_CHARS.includes(char)).length
    const effectiveLength = message.length + extendedCount

    const segmentSize = 160
    const multipartSegmentSize = 153
    if (effectiveLength <= segmentSize) return 1
    return Math.ceil(effectiveLength / multipartSegmentSize)
  }
}

/**
 * Estimate SMS cost
 * Twilio US rates: ~$0.0079/SMS, ~$0.02/MMS
 */
export function estimateCost(
  messageCount: number,
  segmentsPerMessage: number = 1,
  hasMms: boolean = false
): number {
  const smsRate = 0.0079
  const mmsRate = 0.02

  if (hasMms) {
    return messageCount * mmsRate
  }

  return messageCount * segmentsPerMessage * smsRate
}
