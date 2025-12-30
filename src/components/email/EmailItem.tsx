import { Mail, Send, Users } from 'lucide-react'
import type { GmailMessage } from '../../types/gmail'

interface EmailItemProps {
  email: GmailMessage
  onView: () => void
  onReply?: () => void
  isConsoleSent?: boolean
}

export function EmailItem({ email, onView, onReply, isConsoleSent }: EmailItemProps) {
  // Use internalDate (milliseconds) if available, otherwise parse date string
  const timestamp = email.internalDate || new Date(email.date).getTime()
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  let timeDisplay = ''
  if (diffHours < 1) {
    timeDisplay = 'Just now'
  } else if (diffDays === 0) {
    timeDisplay = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  } else if (diffDays === 1) {
    timeDisplay = 'Yesterday'
  } else if (diffDays < 7) {
    timeDisplay = `${diffDays} days ago`
  } else if (date.getFullYear() === now.getFullYear()) {
    timeDisplay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } else {
    timeDisplay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const isMassEmail = (email.recipientCount || 1) >= 5

  return (
    <div className="p-4 bg-zinc-800 rounded-lg hover:bg-zinc-750 transition-colors">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`p-2 rounded-lg flex-shrink-0 ${
          email.isOutbound
            ? 'bg-blue-900/50 text-blue-400'
            : 'bg-zinc-700 text-zinc-400'
        }`}>
          {email.isOutbound ? <Send className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-white truncate pr-2">
              {email.subject || '(no subject)'}
            </span>
            <span className="text-xs text-zinc-500 flex-shrink-0">{timeDisplay}</span>
          </div>

          {/* From/To row */}
          <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1 flex-wrap">
            <span>{email.isOutbound ? 'To:' : 'From:'}</span>
            <span className="truncate max-w-[200px]">{email.isOutbound ? email.to : email.from}</span>
            {isConsoleSent && (
              <span className="px-1.5 py-0.5 bg-blue-900/50 text-blue-400 rounded text-[10px]">
                via Console
              </span>
            )}
            {isMassEmail && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-900/50 text-amber-400 rounded text-[10px]">
                <Users className="h-3 w-3" />
                {email.recipientCount}
              </span>
            )}
          </div>

          {/* Snippet */}
          <p className="text-xs text-zinc-500 line-clamp-2">
            {email.snippet}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={onView}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              View
            </button>
            {onReply && (
              <button
                onClick={onReply}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                {email.isOutbound ? 'Follow up' : 'Reply'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
