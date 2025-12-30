import { useState, useMemo } from 'react'
import { Mail, RefreshCw, AlertCircle, PenSquare } from 'lucide-react'
import { useGmailSearch, useInvoiceEmailsByFamily } from '../../lib/hooks'
import { EmailItem } from './EmailItem'
import { EmailThreadModal } from './EmailThreadModal'
import { EmailComposeModal } from './EmailComposeModal'
import type { GmailMessage } from '../../types/gmail'

interface EmailHistoryProps {
  email: string | null | undefined
  familyId?: string
  // familyName reserved for future use (e.g., compose modal greeting)
}

export function EmailHistory({ email, familyId }: EmailHistoryProps) {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [showComposeModal, setShowComposeModal] = useState(false)
  const [replyTo, setReplyTo] = useState<{
    to: string
    subject: string
    threadId: string
    inReplyTo: string
  } | null>(null)

  // Fetch Gmail emails
  const {
    data: gmailData,
    isLoading: loadingGmail,
    error: gmailError,
    refetch: refetchGmail,
  } = useGmailSearch(email || undefined)

  // Fetch console-sent invoice emails
  const {
    data: consoleEmails = [],
    isLoading: loadingConsole,
  } = useInvoiceEmailsByFamily(familyId || '')

  const isLoading = loadingGmail || loadingConsole
  const hasError = !!gmailError

  // Merge Gmail and console emails into unified timeline
  const unifiedEmails = useMemo(() => {
    const gmailMessages = gmailData?.messages || []

    // Create a set of console email subjects+timestamps for deduplication
    const consoleSentKeys = new Set(
      consoleEmails.map((ce: any) => {
        const timestamp = new Date(ce.sent_at).getTime()
        // Round to nearest minute for fuzzy matching
        const roundedTime = Math.floor(timestamp / 60000) * 60000
        return `${ce.subject?.toLowerCase() || ''}:${roundedTime}`
      })
    )

    // Filter Gmail messages to mark which are console-sent
    const enrichedGmail = gmailMessages.map((msg) => {
      const timestamp = new Date(msg.date).getTime()
      const roundedTime = Math.floor(timestamp / 60000) * 60000
      const key = `${msg.subject?.toLowerCase() || ''}:${roundedTime}`
      const isConsoleSent = consoleSentKeys.has(key)
      return { ...msg, isConsoleSent }
    })

    // Sort by date descending (newest first)
    return enrichedGmail.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }, [gmailData, consoleEmails])

  const handleView = (message: GmailMessage) => {
    setSelectedThreadId(message.threadId)
  }

  const handleReply = (message: GmailMessage) => {
    // Will be populated with actual messageId when we fetch the thread
    setReplyTo({
      to: message.isOutbound ? message.to : message.from,
      subject: message.subject.startsWith('Re:') ? message.subject : `Re: ${message.subject}`,
      threadId: message.threadId,
      inReplyTo: '', // Will be set when thread loads
    })
    setShowComposeModal(true)
  }

  const handleCompose = () => {
    setReplyTo(null)
    setShowComposeModal(true)
  }

  const handleCloseThread = () => {
    setSelectedThreadId(null)
  }

  const handleReplyFromThread = (to: string, subject: string, threadId: string, inReplyTo: string) => {
    setReplyTo({
      to,
      subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
      threadId,
      inReplyTo,
    })
    setShowComposeModal(true)
    handleCloseThread()
  }

  if (!email) {
    return (
      <div className="text-center py-8">
        <Mail className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
        <p className="text-zinc-400">No email address available</p>
        <p className="text-zinc-500 text-sm mt-1">Add an email to view communication history</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with Compose button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetchGmail()}
            disabled={isLoading}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <span className="text-xs text-zinc-500">
            {unifiedEmails.length} email{unifiedEmails.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={handleCompose}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          <PenSquare className="h-4 w-4" />
          Compose
        </button>
      </div>

      {/* Loading state */}
      {isLoading && unifiedEmails.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-400">Failed to load emails</p>
            <p className="text-xs text-red-400/70 mt-1">
              {gmailError instanceof Error ? gmailError.message : 'Unknown error'}
            </p>
          </div>
          <button
            onClick={() => refetchGmail()}
            className="px-3 py-1 text-sm text-red-400 hover:text-red-300 border border-red-400/50 rounded transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !hasError && unifiedEmails.length === 0 && (
        <div className="text-center py-8">
          <Mail className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">No emails found</p>
          <p className="text-zinc-500 text-sm mt-1">
            Start a conversation by clicking Compose
          </p>
        </div>
      )}

      {/* Email list */}
      {!hasError && unifiedEmails.length > 0 && (
        <div className="space-y-2">
          {unifiedEmails.map((message) => (
            <EmailItem
              key={message.id}
              email={message}
              onView={() => handleView(message)}
              onReply={() => handleReply(message)}
              isConsoleSent={(message as any).isConsoleSent}
            />
          ))}
        </div>
      )}

      {/* Thread Modal */}
      {selectedThreadId && (
        <EmailThreadModal
          threadId={selectedThreadId}
          onClose={handleCloseThread}
          onReply={handleReplyFromThread}
        />
      )}

      {/* Compose Modal */}
      {showComposeModal && (
        <EmailComposeModal
          isOpen={showComposeModal}
          onClose={() => {
            setShowComposeModal(false)
            setReplyTo(null)
          }}
          defaultTo={replyTo?.to || email}
          defaultSubject={replyTo?.subject}
          threadId={replyTo?.threadId}
          inReplyTo={replyTo?.inReplyTo}
          onSuccess={() => {
            refetchGmail()
          }}
        />
      )}
    </div>
  )
}
