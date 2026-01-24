import { MessageSquare, AlertCircle } from 'lucide-react'
import { useSmsByFamily, useSmsByInvoice } from '../../lib/hooks'
import { SmsStatusBadge } from '../ui/SmsStatusBadge'
import { formatPhoneDisplay } from '../../lib/phoneUtils'

interface SmsHistoryProps {
  familyId?: string
  invoiceId?: string
  limit?: number
  showEmpty?: boolean
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()

  // Compare dates at local midnight to get accurate day difference
  const dateAtMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const nowAtMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffDays = Math.round((nowAtMidnight.getTime() - dateAtMidnight.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return `Today at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
  } else if (diffDays === 1) {
    return `Yesterday at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
}

export function SmsHistory({ familyId, invoiceId, limit = 50, showEmpty = true }: SmsHistoryProps) {
  // Use the appropriate hook based on what ID we have
  const familyQuery = useSmsByFamily(familyId || '')
  const invoiceQuery = useSmsByInvoice(invoiceId || '')

  const { data: messages = [], isLoading } = familyId ? familyQuery : invoiceQuery

  // Apply limit client-side if needed
  const displayMessages = limit ? messages.slice(0, limit) : messages

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-zinc-600 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (displayMessages.length === 0) {
    if (!showEmpty) return null

    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <MessageSquare className="h-8 w-8 text-zinc-600 mb-2" aria-hidden="true" />
        <p className="text-sm text-zinc-500">No SMS messages yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {displayMessages.map((msg) => (
        <div key={msg.id} className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-zinc-400" aria-hidden="true" />
              <span className="text-sm text-zinc-400">To: {formatPhoneDisplay(msg.to_phone)}</span>
            </div>
            <SmsStatusBadge status={msg.status} />
          </div>

          {/* Message body */}
          <p className="text-sm text-zinc-300 whitespace-pre-wrap mb-2">{msg.message_body}</p>

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>{formatDate(msg.created_at)}</span>

            {msg.message_type && msg.message_type !== 'custom' && (
              <span className="px-2 py-0.5 bg-zinc-700 rounded">{msg.message_type.replace(/_/g, ' ')}</span>
            )}
          </div>

          {/* Error message if failed */}
          {msg.error_message && (
            <div className="mt-2 p-2 bg-red-900/20 border border-red-800 rounded text-xs text-red-400 flex items-start gap-2">
              <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>{msg.error_message}</span>
            </div>
          )}
        </div>
      ))}

      {messages.length > limit && (
        <p className="text-center text-xs text-zinc-500">
          Showing {limit} of {messages.length} messages
        </p>
      )}
    </div>
  )
}
