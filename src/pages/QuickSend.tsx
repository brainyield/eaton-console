import { useState, useMemo } from 'react'
import {
  Send,
  Users,
  Search,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import {
  useFamilies,
  useSmsMutations,
  type CustomerStatus,
  type SmsMessageType,
} from '../lib/hooks'
import { formatPhoneDisplay, isValidPhone } from '../lib/phoneUtils'
import { calculateSegments, estimateCost, generateMessage } from '../lib/smsTemplates'
import { useToast } from '../lib/toast'
import { ConfirmationModal } from '../components/ui/AccessibleModal'

export default function QuickSend() {
  const { showSuccess, showError, showWarning } = useToast()
  const { sendSms } = useSmsMutations()

  // Form state
  const [message, setMessage] = useState('')
  const [campaignName, setCampaignName] = useState('')
  const [messageType, setMessageType] = useState<'bulk' | 'announcement'>('bulk')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Filters
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | 'all'>('active')
  const [excludeOptOut, setExcludeOptOut] = useState(true)
  const [requirePhone, setRequirePhone] = useState(true)

  // Confirmation modal
  const [showConfirm, setShowConfirm] = useState(false)
  const [sendingProgress, setSendingProgress] = useState<{
    total: number
    sent: number
    failed: number
  } | null>(null)

  // Data
  const { data: allFamilies = [], isLoading: loadingFamilies } = useFamilies({
    status: statusFilter === 'all' ? undefined : statusFilter,
  })

  // Filter families
  const filteredFamilies = useMemo(() => {
    let families = allFamilies

    // Require phone
    if (requirePhone) {
      families = families.filter((f) => f.primary_phone && isValidPhone(f.primary_phone))
    }

    // Exclude opted out
    if (excludeOptOut) {
      families = families.filter((f) => !f.sms_opt_out)
    }

    // Search
    if (search) {
      const searchLower = search.toLowerCase()
      families = families.filter(
        (f) =>
          f.display_name.toLowerCase().includes(searchLower) ||
          f.primary_phone?.includes(search) ||
          f.primary_email?.toLowerCase().includes(searchLower)
      )
    }

    return families
  }, [allFamilies, requirePhone, excludeOptOut, search])

  // Selected families with valid phones
  const selectedFamilies = filteredFamilies.filter((f) => selectedIds.has(f.id))
  const eligibleForSend = selectedFamilies.filter(
    (f) => f.primary_phone && isValidPhone(f.primary_phone) && !f.sms_opt_out
  )

  // Final message (wrapped with announcement template when applicable)
  const finalMessage = messageType === 'announcement' && message.trim()
    ? generateMessage('announcement', { customMessage: message.trim() })
    : message

  // Message stats (based on final message that will be sent)
  const charCount = finalMessage.length
  const segmentCount = calculateSegments(finalMessage)
  const totalCost = estimateCost(eligibleForSend.length, segmentCount)

  // Selection handlers
  const handleSelectAll = () => {
    if (selectedIds.size === filteredFamilies.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredFamilies.map((f) => f.id)))
    }
  }

  const handleToggle = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  // Send handler
  const handleSend = async () => {
    if (eligibleForSend.length === 0) {
      showError('No eligible recipients selected')
      return
    }

    if (!message.trim()) {
      showError('Please enter a message')
      return
    }

    // Require confirmation for bulk sends
    if (eligibleForSend.length > 10) {
      setShowConfirm(true)
      return
    }

    await doSend()
  }

  const doSend = async () => {
    setShowConfirm(false)

    const familyIds = eligibleForSend.map((f) => f.id)

    setSendingProgress({ total: familyIds.length, sent: 0, failed: 0 })

    try {
      const result = await sendSms.mutateAsync({
        familyIds,
        messageBody: finalMessage.trim(),
        messageType: messageType as SmsMessageType,
        campaignName: campaignName.trim() || undefined,
        templateKey: messageType === 'announcement' ? 'announcement' : undefined,
        sentBy: 'admin',
      })

      setSendingProgress(null)

      if (result.failed > 0) {
        showWarning(`Sent ${result.sent}, failed ${result.failed}`)
      } else {
        showSuccess(`Successfully sent ${result.sent} messages`)
      }

      // Reset form
      setMessage('')
      setCampaignName('')
      setMessageType('bulk')
      setSelectedIds(new Set())
    } catch (error) {
      setSendingProgress(null)
      showError(error instanceof Error ? error.message : 'Failed to send messages')
    }
  }

  const isSending = sendSms.isPending || sendingProgress !== null

  return (
    <div className="flex h-full">
      {/* Left: Compose */}
      <div className="w-1/2 border-r border-zinc-700 flex flex-col">
        <div className="px-6 py-4 border-b border-zinc-800">
          <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
            <Send className="w-7 h-7" />
            Quick Send
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Send bulk SMS to multiple families</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Campaign Name */}
          <div>
            <label htmlFor="campaign-name" className="block text-sm font-medium text-zinc-400 mb-1">
              Campaign Name (optional)
            </label>
            <input
              id="campaign-name"
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g., January Update"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Message Type */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">
              Message Type
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMessageType('bulk')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  messageType === 'bulk'
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700'
                }`}
              >
                Bulk
              </button>
              <button
                type="button"
                onClick={() => setMessageType('announcement')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  messageType === 'announcement'
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700'
                }`}
              >
                Announcement
              </button>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              {messageType === 'bulk'
                ? 'Send your message as-is to selected recipients.'
                : 'Wraps your message with Eaton branding and opt-out footer.'}
            </p>
          </div>

          {/* Message */}
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-zinc-400 mb-1">
              Message
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={10}
              maxLength={1600}
              placeholder="Type your message..."
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-none font-mono text-sm"
            />
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className={charCount > 1600 ? 'text-red-400' : 'text-zinc-500'}>
                {charCount} / 1600 characters
                {messageType === 'announcement' && message.trim() && charCount !== message.length && (
                  <span className="text-zinc-600"> ({message.length} + footer)</span>
                )}
              </span>
              <span className="text-zinc-500">
                {segmentCount} segment{segmentCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Announcement preview */}
          {messageType === 'announcement' && message.trim() && (
            <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
              <div className="text-xs text-zinc-500 mb-1">Final message preview</div>
              <p className="text-sm text-zinc-300 whitespace-pre-wrap font-mono">{finalMessage}</p>
            </div>
          )}

          {/* Preview */}
          {eligibleForSend.length > 0 && (
            <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-zinc-300">Send Preview</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-zinc-500">Recipients</div>
                  <div className="text-white font-semibold">{eligibleForSend.length}</div>
                </div>
                <div>
                  <div className="text-zinc-500">Estimated Cost</div>
                  <div className="text-white font-semibold">${totalCost.toFixed(2)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Warning for large sends */}
          {eligibleForSend.length > 50 && (
            <div className="p-4 bg-amber-900/20 border border-amber-700 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-300 font-medium">Large Batch Send</p>
                <p className="text-xs text-amber-400 mt-1">
                  You are about to send to {eligibleForSend.length} recipients. This may take a few
                  minutes and cost approximately ${totalCost.toFixed(2)}.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Send Button */}
        <div className="px-6 py-4 border-t border-zinc-800">
          <button
            onClick={handleSend}
            disabled={isSending || eligibleForSend.length === 0 || !message.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {sendingProgress
                  ? `Sending (${sendingProgress.sent}/${sendingProgress.total})...`
                  : 'Sending...'}
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Send to {eligibleForSend.length} Familie{eligibleForSend.length !== 1 ? 's' : 'y'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right: Recipients */}
      <div className="w-1/2 flex flex-col">
        <div className="px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Users className="w-5 h-5" />
                Recipients
              </h2>
              <p className="text-sm text-zinc-400 mt-1">
                {selectedIds.size} of {filteredFamilies.length} selected
              </p>
            </div>
            <button
              onClick={handleSelectAll}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              {selectedIds.size === filteredFamilies.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search families..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as CustomerStatus | 'all')}
              className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="lead">Lead</option>
              <option value="paused">Paused</option>
              <option value="churned">Churned</option>
            </select>
          </div>

          {/* Toggle filters */}
          <div className="flex items-center gap-4 mt-3">
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={excludeOptOut}
                onChange={(e) => setExcludeOptOut(e.target.checked)}
                className="rounded bg-zinc-800 border-zinc-600 text-blue-600 focus:ring-blue-500"
              />
              Exclude opt-outs
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={requirePhone}
                onChange={(e) => setRequirePhone(e.target.checked)}
                className="rounded bg-zinc-800 border-zinc-600 text-blue-600 focus:ring-blue-500"
              />
              Require valid phone
            </label>
          </div>
        </div>

        {/* Family List */}
        <div className="flex-1 overflow-y-auto">
          {loadingFamilies ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
            </div>
          ) : filteredFamilies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="w-12 h-12 text-zinc-600 mb-3" />
              <p className="text-zinc-400">No families match your filters</p>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {filteredFamilies.map((family) => {
                const isSelected = selectedIds.has(family.id)
                const hasValidPhone = family.primary_phone && isValidPhone(family.primary_phone)
                const isOptedOut = family.sms_opt_out

                return (
                  <label
                    key={family.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-600/10 border-blue-600/50'
                        : 'bg-zinc-800/50 border-zinc-700 hover:bg-zinc-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggle(family.id)}
                      className="rounded bg-zinc-800 border-zinc-600 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate">{family.display_name}</div>
                      <div className="text-sm text-zinc-400 flex items-center gap-2">
                        {hasValidPhone ? (
                          <span>{formatPhoneDisplay(family.primary_phone)}</span>
                        ) : (
                          <span className="text-zinc-500">No valid phone</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isOptedOut && (
                        <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded">
                          Opted Out
                        </span>
                      )}
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          family.status === 'active'
                            ? 'bg-green-500/20 text-green-400'
                            : family.status === 'lead'
                              ? 'bg-violet-500/20 text-violet-400'
                              : family.status === 'trial'
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-zinc-500/20 text-zinc-400'
                        }`}
                      >
                        {family.status}
                      </span>
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={doSend}
        title="Confirm Bulk Send"
        description={`You are about to send SMS to ${eligibleForSend.length} recipients. This will cost approximately $${totalCost.toFixed(2)}. Are you sure you want to continue?`}
        confirmLabel="Send Messages"
        variant="info"
      />
    </div>
  )
}
