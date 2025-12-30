import { X, Reply, Mail, Send } from 'lucide-react'
import { useGmailThread } from '../../lib/hooks'
import type { GmailThreadMessage } from '../../types/gmail'

interface EmailThreadModalProps {
  threadId: string
  onClose: () => void
  onReply: (to: string, subject: string, threadId: string, inReplyTo: string) => void
}

export function EmailThreadModal({ threadId, onClose, onReply }: EmailThreadModalProps) {
  const { data, isLoading, error } = useGmailThread(threadId)

  const thread = data?.thread
  const messages = thread?.messages || []

  // Get the last message for reply context
  const lastMessage = messages[messages.length - 1]

  const handleReply = () => {
    if (!lastMessage) return

    // Determine who to reply to
    const isOutbound = lastMessage.from.includes('ivan@eatonacademic.com') ||
                       lastMessage.from.includes('eaton')
    const to = isOutbound ? lastMessage.to : lastMessage.from

    onReply(to, lastMessage.subject, threadId, lastMessage.messageId)
  }

  // Safely render email body
  const renderBody = (message: GmailThreadMessage) => {
    if (message.bodyHtml) {
      // Basic sanitization - in production you'd want a proper sanitizer like DOMPurify
      // For now, we'll use bodyText as a safer alternative
      return (
        <div
          className="text-sm text-zinc-300 whitespace-pre-wrap"
        >
          {message.bodyText || 'No content'}
        </div>
      )
    }
    return (
      <div className="text-sm text-zinc-300 whitespace-pre-wrap">
        {message.bodyText || 'No content'}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-100 truncate pr-4">
            {lastMessage?.subject || 'Email Thread'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-800 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <Mail className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-red-400">Failed to load thread</p>
              <p className="text-zinc-500 text-sm mt-1">
                {error instanceof Error ? error.message : 'Unknown error'}
              </p>
            </div>
          )}

          {!isLoading && !error && messages.length === 0 && (
            <div className="text-center py-12">
              <Mail className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400">No messages in thread</p>
            </div>
          )}

          {!isLoading && !error && messages.length > 0 && (
            <div className="space-y-4">
              {messages.map((message) => {
                const isOutbound = message.from.includes('ivan@eatonacademic.com') ||
                                   message.from.includes('eaton')
                const date = new Date(message.date)

                return (
                  <div
                    key={message.id}
                    className={`p-4 rounded-lg ${
                      isOutbound ? 'bg-blue-900/20 border border-blue-800/30' : 'bg-zinc-800'
                    }`}
                  >
                    {/* Message header */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`p-2 rounded-lg flex-shrink-0 ${
                        isOutbound ? 'bg-blue-900/50 text-blue-400' : 'bg-zinc-700 text-zinc-400'
                      }`}>
                        {isOutbound ? <Send className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-white">
                            {isOutbound ? 'You' : message.from.split('<')[0].trim() || message.from}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {date.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
                            })}
                            {' '}
                            {date.toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          To: {message.to}
                        </div>
                      </div>
                    </div>

                    {/* Message body */}
                    {renderBody(message)}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer with Reply button */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-zinc-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleReply}
            disabled={!lastMessage}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Reply className="h-4 w-4" />
            Reply
          </button>
        </div>
      </div>
    </div>
  )
}
