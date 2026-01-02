import { useState, useMemo, useEffect } from 'react'
import { Mail, RefreshCw, AlertCircle, PenSquare, Search, X, ChevronDown } from 'lucide-react'
import { useGmailSearch, useInvoiceEmailsByFamily } from '../../lib/hooks'
import { EmailItem } from './EmailItem'
import { EmailThreadModal } from './EmailThreadModal'
import { EmailComposeModal } from './EmailComposeModal'
import type { GmailMessage } from '../../types/gmail'

interface EmailHistoryProps {
  email: string | null | undefined
  familyId?: string
}

const MASS_EMAIL_THRESHOLD = 5 // Emails with more recipients are considered "mass"
const MAX_EMAIL_PAGES = 50 // Maximum pages to load (50 pages × 20 = 1000 emails max)

export function EmailHistory({ email, familyId }: EmailHistoryProps) {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [showComposeModal, setShowComposeModal] = useState(false)
  const [replyTo, setReplyTo] = useState<{
    to: string
    subject: string
    threadId: string
    inReplyTo: string
  } | null>(null)

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [showMassEmails, setShowMassEmails] = useState(false)

  // Debounce search query with proper cleanup
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  // Fetch Gmail emails with infinite query (limited to MAX_EMAIL_PAGES to prevent memory issues)
  const {
    data: gmailData,
    isLoading: loadingGmail,
    isFetchingNextPage,
    error: gmailError,
    refetch: refetchGmail,
    fetchNextPage,
    hasNextPage,
  } = useGmailSearch(email || undefined, {
    query: debouncedQuery || undefined,
    maxPages: MAX_EMAIL_PAGES,
  })

  // Check if we've hit the max pages limit
  const pagesLoaded = gmailData?.pages?.length || 0
  const hasReachedMaxPages = pagesLoaded >= MAX_EMAIL_PAGES

  // Fetch console-sent invoice emails
  const {
    data: consoleEmails = [],
    isLoading: loadingConsole,
  } = useInvoiceEmailsByFamily(familyId || '')

  const isLoading = loadingGmail || loadingConsole
  const hasError = !!gmailError

  // Flatten pages and merge with console emails
  const unifiedEmails = useMemo(() => {
    // Flatten all pages of Gmail messages
    const allGmailMessages: GmailMessage[] = gmailData?.pages?.flatMap(
      (page) => page.messages || []
    ) || []

    // Create a set of console email subjects+timestamps for deduplication
    const consoleSentKeys = new Set(
      consoleEmails.map((ce: any) => {
        const timestamp = new Date(ce.sent_at).getTime()
        // Round to nearest minute for fuzzy matching
        const roundedTime = Math.floor(timestamp / 60000) * 60000
        return `${ce.subject?.toLowerCase() || ''}:${roundedTime}`
      })
    )

    // Filter and enrich Gmail messages
    const enrichedGmail = allGmailMessages
      .map((msg) => {
        // Use internalDate if available, fallback to date string
        const timestamp = msg.internalDate || new Date(msg.date).getTime()
        const roundedTime = Math.floor(timestamp / 60000) * 60000
        const key = `${msg.subject?.toLowerCase() || ''}:${roundedTime}`
        const isConsoleSent = consoleSentKeys.has(key)
        return { ...msg, isConsoleSent, sortTimestamp: timestamp }
      })
      // Filter out mass emails unless toggle is on
      .filter((msg) => {
        if (showMassEmails) return true
        return (msg.recipientCount || 1) < MASS_EMAIL_THRESHOLD
      })

    // Sort by timestamp descending (newest first)
    return enrichedGmail.sort((a, b) => b.sortTimestamp - a.sortTimestamp)
  }, [gmailData, consoleEmails, showMassEmails])

  // Count filtered out emails
  const filteredOutCount = useMemo(() => {
    if (showMassEmails) return 0
    const allGmailMessages: GmailMessage[] = gmailData?.pages?.flatMap(
      (page) => page.messages || []
    ) || []
    return allGmailMessages.filter(
      (msg) => (msg.recipientCount || 1) >= MASS_EMAIL_THRESHOLD
    ).length
  }, [gmailData, showMassEmails])

  const handleView = (message: GmailMessage) => {
    setSelectedThreadId(message.threadId)
  }

  const handleReply = (message: GmailMessage) => {
    setReplyTo({
      to: message.isOutbound ? message.to : message.from,
      subject: message.subject.startsWith('Re:') ? message.subject : `Re: ${message.subject}`,
      threadId: message.threadId,
      inReplyTo: '',
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

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
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
    <div className="space-y-3">
      {/* Search and Compose row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search emails..."
            className="w-full pl-9 pr-8 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('')
                setDebouncedQuery('')
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          onClick={handleCompose}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          <PenSquare className="h-4 w-4" />
          Compose
        </button>
      </div>

      {/* Filter row */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetchGmail()}
            disabled={isLoading}
            className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <span className="text-zinc-500">
            {unifiedEmails.length} email{unifiedEmails.length !== 1 ? 's' : ''}
            {filteredOutCount > 0 && !showMassEmails && (
              <span className="text-zinc-600"> ({filteredOutCount} mass hidden)</span>
            )}
          </span>
        </div>
        <label className="flex items-center gap-2 text-zinc-400 cursor-pointer hover:text-zinc-300">
          <input
            type="checkbox"
            checked={showMassEmails}
            onChange={(e) => setShowMassEmails(e.target.checked)}
            className="rounded bg-zinc-700 border-zinc-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
          />
          Show mass emails ({MASS_EMAIL_THRESHOLD}+ recipients)
        </label>
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
          <p className="text-zinc-400">
            {debouncedQuery ? 'No emails match your search' : 'No emails found'}
          </p>
          <p className="text-zinc-500 text-sm mt-1">
            {debouncedQuery
              ? 'Try a different search term'
              : 'Start a conversation by clicking Compose'}
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

      {/* Load More button */}
      {hasNextPage && !hasReachedMaxPages && (
        <div className="flex justify-center pt-2">
          <button
            onClick={handleLoadMore}
            disabled={isFetchingNextPage}
            className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-600 rounded transition-colors disabled:opacity-50"
          >
            {isFetchingNextPage ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Load More
              </>
            )}
          </button>
        </div>
      )}

      {/* Max pages reached notice */}
      {hasReachedMaxPages && (
        <div className="text-center py-2 text-xs text-zinc-500">
          Showing maximum of {pagesLoaded * 20} emails. Use search to find older messages.
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
