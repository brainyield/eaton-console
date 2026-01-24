import { useState, useEffect } from 'react'
import { Send, AlertCircle, User, Hash, Loader2 } from 'lucide-react'
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

  // Pre-filled data
  toPhone?: string
  toName?: string
  familyId?: string
  invoiceId?: string

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
  suggestedTemplate,
  templateData,
  onSuccess,
}: SmsComposeModalProps) {
  const [phone, setPhone] = useState(toPhone)
  const [message, setMessage] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey | ''>('')
  const [error, setError] = useState<string | null>(null)

  const { showSuccess, showError } = useToast()
  const { sendSms } = useSmsMutations()

  // Character count and segments
  const charCount = message.length
  const segmentCount = calculateSegments(message)
  const cost = estimateCost(1, segmentCount)

  // Reset form when modal opens with new data
  useEffect(() => {
    if (isOpen) {
      setPhone(toPhone)
      setError(null)

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

    // Validation
    const normalizedPhone = normalizePhone(phone)
    if (!normalizedPhone) {
      setError('Please enter a valid US phone number')
      return
    }

    if (!message.trim()) {
      setError('Please enter a message')
      return
    }

    if (charCount > 1600) {
      setError('Message is too long (max 1600 characters)')
      return
    }

    sendSms.mutate(
      {
        familyId: familyId || undefined,
        toPhone: normalizedPhone,
        messageBody: message.trim(),
        messageType: selectedTemplate ? (selectedTemplate as never) : 'custom',
        invoiceId: invoiceId || undefined,
        templateKey: selectedTemplate || undefined,
        mergeData: templateData as Record<string, unknown> | undefined,
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
                {segmentCount} segment{segmentCount !== 1 ? 's' : ''} (~${cost.toFixed(3)})
              </span>
            </div>
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
            disabled={sendSms.isPending || !message.trim() || !isValidPhone(phone)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendSms.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" aria-hidden="true" />
                Send SMS
              </>
            )}
          </button>
        </div>
      </form>
    </AccessibleModal>
  )
}
