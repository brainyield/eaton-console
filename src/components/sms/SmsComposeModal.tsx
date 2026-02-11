import { useState, useEffect } from 'react'
import { Send, AlertCircle, User, Hash, Loader2, Image, X, ChevronDown, ChevronUp } from 'lucide-react'
import { AccessibleModal } from '../ui/AccessibleModal'
import { useSmsMutations } from '../../lib/hooks'
import { normalizePhone, formatPhoneDisplay, isValidPhone } from '../../lib/phoneUtils'
import {
  SMS_TEMPLATES,
  type TemplateKey,
  type TemplateData,
  generateMessage,
  calculateSegments,
  estimateCost,
} from '../../lib/smsTemplates'
import { useToast } from '../../lib/toast'

interface SmsComposeModalProps {
  isOpen: boolean
  onClose: () => void

  // Pre-filled data (single recipient)
  toPhone?: string
  toName?: string
  familyId?: string
  invoiceId?: string

  // Bulk recipients (overrides single recipient fields)
  familyIds?: string[]

  // Template suggestion
  suggestedTemplate?: TemplateKey
  templateData?: TemplateData[TemplateKey]

  // Callbacks
  onSuccess?: () => void
}

export function SmsComposeModal({
  isOpen,
  onClose,
  toPhone = '',
  toName = '',
  familyId,
  invoiceId,
  familyIds,
  suggestedTemplate,
  templateData,
  onSuccess,
}: SmsComposeModalProps) {
  const isBulkSend = familyIds && familyIds.length > 0
  const [phone, setPhone] = useState(toPhone)
  const [message, setMessage] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [mediaUrl, setMediaUrl] = useState('')
  const [mediaPreviewLoaded, setMediaPreviewLoaded] = useState(false)
  const [mediaError, setMediaError] = useState('')
  const [showMediaInput, setShowMediaInput] = useState(false)

  const { showSuccess, showError } = useToast()
  const { sendSms } = useSmsMutations()

  // Character count and segments
  const charCount = message.length
  const segmentCount = calculateSegments(message)
  const recipientCount = isBulkSend ? familyIds.length : 1
  const hasMedia = !!mediaUrl && mediaPreviewLoaded && !mediaError
  const cost = estimateCost(recipientCount, segmentCount, hasMedia)

  // Reset form when modal opens with new data
  useEffect(() => {
    if (isOpen) {
      setPhone(toPhone)
      setError(null)
      setMediaUrl('')
      setMediaPreviewLoaded(false)
      setMediaError('')
      setShowMediaInput(false)

      // Auto-fill from template if provided
      if (suggestedTemplate && templateData) {
        setSelectedTemplate(suggestedTemplate)
        try {
          const generated = generateMessage(suggestedTemplate, templateData as never)
          setMessage(generated)
        } catch {
          setMessage('')
        }
      } else {
        setSelectedTemplate('')
        setMessage('')
      }
    }
  }, [isOpen, toPhone, suggestedTemplate, templateData])

  const handleTemplateChange = (templateKey: string) => {
    setSelectedTemplate(templateKey as TemplateKey | '')

    if (templateKey && templateData) {
      try {
        const generated = generateMessage(templateKey as TemplateKey, templateData as never)
        setMessage(generated)
      } catch {
        // Template data doesn't match, leave message empty
      }
    } else if (!templateKey) {
      setMessage('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!message.trim()) {
      setError('Please enter a message')
      return
    }

    if (charCount > 1600) {
      setError('Message is too long (max 1600 characters)')
      return
    }

    // Bulk send to multiple families
    if (isBulkSend) {
      sendSms.mutate(
        {
          familyIds,
          messageBody: message.trim(),
          messageType: selectedTemplate || 'custom',
          templateKey: selectedTemplate || undefined,
          mergeData: templateData as Record<string, unknown> | undefined,
          mediaUrls: hasMedia ? [mediaUrl] : undefined,
          sentBy: 'admin',
        },
        {
          onSuccess: (result) => {
            if (result.sent > 0) {
              const msg = result.failed > 0
                ? `Sent ${result.sent}, failed ${result.failed}`
                : `SMS sent to ${result.sent} recipient${result.sent !== 1 ? 's' : ''}`
              showSuccess(msg)
              onSuccess?.()
              onClose()
            } else {
              setError(
                result.skipped > 0
                  ? 'All recipients have opted out of SMS'
                  : 'Failed to send SMS'
              )
            }
          },
          onError: (err: Error) => {
            const errorMessage = err.message || 'Failed to send SMS'
            setError(errorMessage)
            showError(errorMessage)
          },
        }
      )
      return
    }

    // Single recipient send
    const normalizedPhone = normalizePhone(phone)
    if (!normalizedPhone) {
      setError('Please enter a valid US phone number')
      return
    }

    sendSms.mutate(
      {
        familyId: familyId || undefined,
        toPhone: normalizedPhone,
        messageBody: message.trim(),
        messageType: selectedTemplate || 'custom',
        invoiceId: invoiceId || undefined,
        templateKey: selectedTemplate || undefined,
        mergeData: templateData as Record<string, unknown> | undefined,
        mediaUrls: hasMedia ? [mediaUrl] : undefined,
        sentBy: 'admin',
      },
      {
        onSuccess: (result) => {
          if (result.sent > 0) {
            showSuccess('SMS sent successfully')
            onSuccess?.()
            onClose()
          } else {
            setError(result.skipped > 0 ? 'Recipient has opted out of SMS' : 'Failed to send SMS')
          }
        },
        onError: (err: Error) => {
          const errorMessage = err.message || 'Failed to send SMS'
          setError(errorMessage)
          showError(errorMessage)
        },
      }
    )
  }

  return (
    <AccessibleModal isOpen={isOpen} onClose={onClose} title="Send SMS" size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="p-4 space-y-4">
          {/* Error */}
          {error && (
            <div
              className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" aria-hidden="true" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Recipient */}
          {isBulkSend ? (
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">To</label>
              <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-100">
                <User className="h-4 w-4 text-zinc-500" aria-hidden="true" />
                <span>{familyIds.length} {familyIds.length === 1 ? 'family' : 'families'}</span>
              </div>
            </div>
          ) : (
            <div>
              <label htmlFor="sms-to" className="block text-sm font-medium text-zinc-400 mb-1">
                To
              </label>
              <div className="relative">
                <User
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500"
                  aria-hidden="true"
                />
                <input
                  id="sms-to"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="w-full pl-10 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              {toName && <p className="mt-1 text-xs text-zinc-500">{toName}</p>}
              {phone && isValidPhone(phone) && (
                <p className="mt-1 text-xs text-green-400">Valid: {formatPhoneDisplay(phone)}</p>
              )}
              {phone && !isValidPhone(phone) && phone.length > 5 && (
                <p className="mt-1 text-xs text-red-400">Invalid phone number format</p>
              )}
            </div>
          )}

          {/* Template selector */}
          <div>
            <label htmlFor="sms-template" className="block text-sm font-medium text-zinc-400 mb-1">
              Template (optional)
            </label>
            <select
              id="sms-template"
              value={selectedTemplate}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Custom message</option>
              {Object.values(SMS_TEMPLATES).map((template) => (
                <option key={template.key} value={template.key}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          {/* Message body */}
          <div>
            <label htmlFor="sms-message" className="block text-sm font-medium text-zinc-400 mb-1">
              Message
            </label>
            <textarea
              id="sms-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              maxLength={1600}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none font-mono text-sm"
              placeholder="Type your message..."
            />
            <div className="mt-1 flex items-center justify-between text-xs">
              <span
                className={`flex items-center gap-1 ${charCount > 1600 ? 'text-red-400' : 'text-zinc-500'}`}
              >
                <Hash className="h-3 w-3" aria-hidden="true" />
                {charCount} / 1600 characters
              </span>
              <span className="text-zinc-500">
                {segmentCount} segment{segmentCount !== 1 ? 's' : ''}{hasMedia ? ' + image' : ''} (~${cost.toFixed(3)})
              </span>
            </div>
          </div>

          {/* Attach Image */}
          <div>
            <button
              type="button"
              onClick={() => setShowMediaInput(!showMediaInput)}
              className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <Image className="h-4 w-4" aria-hidden="true" />
              Attach Image
              {showMediaInput ? (
                <ChevronUp className="h-3 w-3" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3 w-3" aria-hidden="true" />
              )}
              {hasMedia && <span className="text-xs px-1.5 py-0.5 bg-blue-600/20 text-blue-400 rounded">1</span>}
            </button>

            {showMediaInput && (
              <div className="mt-2 space-y-2">
                <div className="relative">
                  <input
                    type="url"
                    value={mediaUrl}
                    onChange={(e) => {
                      setMediaUrl(e.target.value)
                      setMediaPreviewLoaded(false)
                      setMediaError('')
                    }}
                    placeholder="Paste image URL (JPEG, PNG, GIF)"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 pr-8"
                  />
                  {mediaUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setMediaUrl('')
                        setMediaPreviewLoaded(false)
                        setMediaError('')
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>

                <p className="text-xs text-zinc-500">
                  URL must be publicly accessible. Max 5MB. Supported: JPEG, PNG, GIF.
                </p>

                {mediaUrl && (
                  <div className="relative">
                    {!mediaPreviewLoaded && !mediaError && (
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                        Loading preview...
                      </div>
                    )}
                    <img
                      src={mediaUrl}
                      alt="MMS attachment preview"
                      className={`max-h-32 rounded border border-zinc-700 ${!mediaPreviewLoaded ? 'hidden' : ''}`}
                      onLoad={() => {
                        setMediaPreviewLoaded(true)
                        setMediaError('')
                      }}
                      onError={() => {
                        setMediaPreviewLoaded(false)
                        setMediaError('Image URL could not be loaded')
                      }}
                    />
                    {mediaError && (
                      <p className="text-xs text-red-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" aria-hidden="true" />
                        {mediaError}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-zinc-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={sendSms.isPending || !message.trim() || (!isBulkSend && !isValidPhone(phone))}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendSms.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Sending...
              </>
            ) : (
              <>
                {hasMedia ? <Image className="h-4 w-4" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                {hasMedia ? 'Send MMS' : 'Send SMS'}
              </>
            )}
          </button>
        </div>
      </form>
    </AccessibleModal>
  )
}
