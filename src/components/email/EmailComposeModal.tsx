import { useState } from 'react'
import { X, Send, AlertCircle } from 'lucide-react'
import { useGmailSend } from '../../lib/hooks'

interface EmailComposeModalProps {
  isOpen: boolean
  onClose: () => void
  defaultTo?: string
  defaultSubject?: string
  threadId?: string
  inReplyTo?: string
  onSuccess?: () => void
}

export function EmailComposeModal({
  isOpen,
  onClose,
  defaultTo = '',
  defaultSubject = '',
  threadId,
  inReplyTo,
  onSuccess,
}: EmailComposeModalProps) {
  const [to, setTo] = useState(defaultTo)
  const [subject, setSubject] = useState(defaultSubject)
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)

  const sendEmail = useGmailSend()

  const isReply = !!threadId

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!to.trim()) {
      setError('Recipient email is required')
      return
    }

    if (!subject.trim()) {
      setError('Subject is required')
      return
    }

    if (!body.trim()) {
      setError('Message body is required')
      return
    }

    sendEmail.mutate(
      {
        to: to.trim(),
        subject: subject.trim(),
        body: body.trim(),
        threadId: threadId || undefined,
        inReplyTo: inReplyTo || undefined,
      },
      {
        onSuccess: () => {
          onSuccess?.()
          onClose()
        },
        onError: (err: Error) => {
          setError(err.message || 'Failed to send email')
        },
      }
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-100">
            {isReply ? 'Reply' : 'New Email'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-800 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 space-y-4 flex-1 overflow-y-auto">
            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* To field */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                To
              </label>
              <input
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                disabled={isReply}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="recipient@email.com"
              />
            </div>

            {/* Subject field */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
                placeholder="Email subject"
              />
            </div>

            {/* Body field */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Message
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500 resize-none"
                placeholder="Write your message..."
              />
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
              disabled={sendEmail.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {sendEmail.isPending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
