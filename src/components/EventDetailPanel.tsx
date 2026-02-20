import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatNameLastFirst } from '../lib/utils'
import { formatCurrency } from '../lib/moneyUtils'
import { useEventAttendees } from '../lib/hooks'
import { type EventReminderData } from '../lib/smsTemplates'
import { SmsComposeModal } from './sms/SmsComposeModal'
import {
  X,
  Calendar,
  MapPin,
  Clock,
  DollarSign,
  Users,
  Download,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  MessageSquare
} from 'lucide-react'

interface EventWithStats {
  id: string
  title: string
  description: string | null
  location: string | null
  start_at: string | null
  end_at: string | null
  ticket_price_cents: number | null
  event_type: string
  attendee_count: number
  revenue: number
}

interface EventDetailPanelProps {
  event: EventWithStats
  onClose: () => void
}

type SortField = 'attendee_name' | 'purchaser_name' | 'payment_status' | 'family_name'
type SortDirection = 'asc' | 'desc'

export function EventDetailPanel({ event, onClose }: EventDetailPanelProps) {
  const navigate = useNavigate()
  const { data: attendees = [], isLoading } = useEventAttendees(event.id)
  const [sortConfig, setSortConfig] = useState<{ field: SortField; direction: SortDirection }>({ field: 'attendee_name', direction: 'asc' })
  const [showSmsModal, setShowSmsModal] = useState(false)

  const handleFamilyClick = (familyId: string) => {
    sessionStorage.setItem('selectedFamilyId', familyId)
    navigate('/directory')
  }

  const handleSort = (field: SortField) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const sortedAttendees = useMemo(() => {
    const result = [...attendees]
    result.sort((a, b) => {
      let aVal: string, bVal: string
      switch (sortConfig.field) {
        case 'attendee_name':
          aVal = formatNameLastFirst(a.attendee_name).toLowerCase()
          bVal = formatNameLastFirst(b.attendee_name).toLowerCase()
          break
        case 'purchaser_name':
          aVal = formatNameLastFirst(a.purchaser_name).toLowerCase()
          bVal = formatNameLastFirst(b.purchaser_name).toLowerCase()
          break
        case 'payment_status':
          aVal = a.payment_status
          bVal = b.payment_status
          break
        case 'family_name':
          aVal = a.family_name?.toLowerCase() || 'zzz'
          bVal = b.family_name?.toLowerCase() || 'zzz'
          break
        default:
          return 0
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
    return result
  }, [attendees, sortConfig])

  // Unique family IDs from attendees (for SMS reminders)
  const attendeeFamilyIds = useMemo(() => {
    const ids = new Set<string>()
    for (const a of attendees) {
      if (a.family_id) ids.add(a.family_id)
    }
    return [...ids]
  }, [attendees])

  // Event reminder template data
  const eventReminderData = useMemo((): EventReminderData => {
    const eventDate = event.start_at
      ? new Date(event.start_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      : ''
    const eventTime = event.start_at
      ? new Date(event.start_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : ''
    return {
      familyName: 'there',
      eventName: event.title,
      eventDate,
      eventTime,
      location: event.location || undefined,
    }
  }, [event])

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortConfig.field !== field) {
      return <ChevronUp className="h-3 w-3 text-zinc-600" />
    }
    return sortConfig.direction === 'asc'
      ? <ChevronUp className="h-3 w-3 text-blue-400" />
      : <ChevronDown className="h-3 w-3 text-blue-400" />
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const getEventStatus = () => {
    if (!event.start_at) return { label: 'No Date', color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' }
    const now = new Date()
    const start = new Date(event.start_at)
    const end = event.end_at ? new Date(event.end_at) : start
    if (now < start) return { label: 'Upcoming', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' }
    if (now > end) return { label: 'Past', color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' }
    return { label: 'In Progress', color: 'bg-green-500/20 text-green-400 border-green-500/30' }
  }

  const handleExport = () => {
    const headers = ['Attendee Name', 'Age', 'Purchaser', 'Email', 'Payment Status', 'Family']
    const rows = sortedAttendees.map(a => [
      a.attendee_name,
      a.attendee_age?.toString() || '',
      a.purchaser_name || '',
      a.purchaser_email || '',
      a.payment_status,
      a.family_name || ''
    ])

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${event.title.replace(/[^a-z0-9]/gi, '-')}-attendees.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const status = getEventStatus()

  return (
    <div className="fixed right-0 top-0 h-full w-[480px] bg-zinc-900 border-l border-zinc-800 shadow-2xl flex flex-col z-40">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <button
          onClick={onClose}
          className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          {status.label === 'Upcoming' && attendeeFamilyIds.length > 0 && (
            <button
              onClick={() => setShowSmsModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 hover:bg-zinc-800 rounded-md transition-colors"
            >
              <MessageSquare className="h-4 w-4" />
              Send Reminder
            </button>
          )}
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Event Info */}
      <div className="px-6 py-4 border-b border-zinc-800">
        <div className="flex items-start justify-between mb-3">
          <h2 className="text-xl font-semibold text-white">{event.title}</h2>
          <span className={`text-sm font-medium rounded-full px-3 py-1 border ${status.color}`}>
            {status.label}
          </span>
        </div>

        {event.description && (
          <p className="text-sm text-zinc-400 mb-4">{event.description}</p>
        )}

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-zinc-400">
            <Calendar className="h-4 w-4" />
            <span>{formatDate(event.start_at)}</span>
          </div>
          {event.start_at && (
            <div className="flex items-center gap-2 text-zinc-400">
              <Clock className="h-4 w-4" />
              <span>
                {formatTime(event.start_at)}
                {event.end_at && ` - ${formatTime(event.end_at)}`}
              </span>
            </div>
          )}
          {event.location && (
            <div className="flex items-center gap-2 text-zinc-400">
              <MapPin className="h-4 w-4" />
              <span>{event.location}</span>
            </div>
          )}
          {event.ticket_price_cents && (
            <div className="flex items-center gap-2 text-zinc-400">
              <DollarSign className="h-4 w-4" />
              <span>{formatCurrency(event.ticket_price_cents / 100)} per ticket</span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="p-3 bg-zinc-800 rounded-lg">
            <div className="flex items-center gap-2 text-zinc-400 mb-1">
              <Users className="h-4 w-4" />
              <span className="text-xs uppercase">Attendees</span>
            </div>
            <div className="text-2xl font-semibold text-white">{event.attendee_count}</div>
          </div>
          <div className="p-3 bg-zinc-800 rounded-lg">
            <div className="flex items-center gap-2 text-zinc-400 mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs uppercase">Revenue</span>
            </div>
            <div className="text-2xl font-semibold text-white">{formatCurrency(event.revenue)}</div>
          </div>
        </div>
      </div>

      {/* Attendees List */}
      <div className="flex-1 overflow-auto flex flex-col">
        <div className="px-6 py-3 border-b border-zinc-800 sticky top-0 bg-zinc-900">
          <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
            Attendees ({attendees.length})
          </h3>
        </div>

        {/* Sort Headers */}
        <div className="px-6 py-2 border-b border-zinc-800 bg-zinc-900/50 grid grid-cols-3 gap-2 text-xs font-medium text-zinc-500 uppercase">
          <button
            onClick={() => handleSort('attendee_name')}
            className="flex items-center gap-1 hover:text-white text-left"
          >
            Name <SortIcon field="attendee_name" />
          </button>
          <button
            onClick={() => handleSort('payment_status')}
            className="flex items-center gap-1 hover:text-white text-left"
          >
            Status <SortIcon field="payment_status" />
          </button>
          <button
            onClick={() => handleSort('family_name')}
            className="flex items-center gap-1 hover:text-white text-left"
          >
            Family <SortIcon field="family_name" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
          </div>
        ) : sortedAttendees.length === 0 ? (
          <div className="px-6 py-8 text-center text-zinc-400">
            No attendees registered
          </div>
        ) : (
          <div className="divide-y divide-zinc-800 flex-1 overflow-auto">
            {sortedAttendees.map((attendee) => (
              <div key={attendee.id} className="px-6 py-3 hover:bg-zinc-800/50 grid grid-cols-3 gap-2 items-start">
                <div>
                  <div className="text-sm font-medium text-white">
                    {formatNameLastFirst(attendee.attendee_name)}
                  </div>
                  {attendee.attendee_age && (
                    <span className="text-xs text-zinc-500">Age {attendee.attendee_age}</span>
                  )}
                  {attendee.purchaser_name && attendee.purchaser_name !== attendee.attendee_name && (
                    <div className="text-xs text-zinc-500 mt-0.5">
                      by {formatNameLastFirst(attendee.purchaser_name)}
                    </div>
                  )}
                </div>
                <div>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    attendee.payment_status === 'paid' ? 'bg-green-500/20 text-green-400' :
                    attendee.payment_status === 'stepup_pending' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-zinc-500/20 text-zinc-400'
                  }`}>
                    {attendee.payment_status}
                  </span>
                </div>
                <div>
                  {attendee.family_id && attendee.family_name ? (
                    <button
                      onClick={() => handleFamilyClick(attendee.family_id!)}
                      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {attendee.family_name}
                    </button>
                  ) : (
                    <span className="text-xs text-zinc-500">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SMS Reminder Modal */}
      <SmsComposeModal
        isOpen={showSmsModal}
        onClose={() => setShowSmsModal(false)}
        familyIds={attendeeFamilyIds}
        suggestedTemplate="event_reminder"
        templateData={eventReminderData}
      />
    </div>
  )
}
