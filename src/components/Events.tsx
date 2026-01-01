import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatNameLastFirst } from '../lib/utils'
import { getTodayString } from '../lib/dateUtils'
import {
  Search,
  ChevronUp,
  ChevronDown,
  Calendar,
  MapPin,
  Users,
  DollarSign,
  Download,
  LayoutList,
  CalendarDays,
  ExternalLink
} from 'lucide-react'
import { EventDetailPanel } from './EventDetailPanel'

type ViewMode = 'events' | 'attendees'
type EventSortField = 'title' | 'start_at' | 'location' | 'attendee_count' | 'revenue'
type AttendeeSortField = 'attendee_name' | 'event_title' | 'event_date' | 'purchaser_name' | 'payment_status' | 'family_name'
type SortDirection = 'asc' | 'desc'

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

interface AttendeeWithDetails {
  id: string
  attendee_name: string
  attendee_age: number | null
  event_id: string
  event_title: string
  event_date: string | null
  event_location: string | null
  purchaser_name: string | null
  purchaser_email: string | null
  payment_status: string
  family_id: string | null
  family_name: string | null
}

// Database row types for Supabase queries
interface EventRow {
  id: string
  title: string
  description: string | null
  venue_name: string | null
  start_at: string | null
  end_at: string | null
  ticket_price_cents: number | null
  event_type: string
}

interface AttendeeRow {
  event_id: string
}

interface OrderRow {
  event_id: string
  total_cents: number | null
  payment_status: string
}

interface AttendeeListRow {
  attendee_id: string
  attendee_name: string
  attendee_age: number | null
  event_id: string
  event_title: string | null
  event_date: string | null
  venue_name: string | null
  purchaser_name: string | null
  purchaser_email: string | null
  payment_status: string | null
  family_id: string | null
  event_type: string
}

interface FamilyRow {
  id: string
  display_name: string | null
}

function useEvents() {
  return useQuery({
    queryKey: ['events', 'list'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: events, error } = await supabase
        .from('event_events')
        .select('*')
        .eq('event_type', 'event')
        .order('start_at', { ascending: false })
        .returns<EventRow[]>()

      if (error) throw error

      const eventIds = (events || []).map(e => e.id)

      if (eventIds.length === 0) {
        return []
      }

      const { data: attendees } = await supabase
        .from('event_attendees')
        .select('event_id')
        .in('event_id', eventIds)
        .returns<AttendeeRow[]>()

      const { data: orders } = await supabase
        .from('event_orders')
        .select('event_id, total_cents, payment_status')
        .in('event_id', eventIds)
        .eq('payment_status', 'paid')
        .returns<OrderRow[]>()

      const attendeeCountMap = new Map<string, number>()
      const revenueMap = new Map<string, number>()

      ;(attendees || []).forEach(a => {
        const current = attendeeCountMap.get(a.event_id) || 0
        attendeeCountMap.set(a.event_id, current + 1)
      })

      ;(orders || []).forEach(o => {
        const current = revenueMap.get(o.event_id) || 0
        revenueMap.set(o.event_id, current + (o.total_cents || 0))
      })

      return (events || []).map(e => ({
        ...e,
        location: e.venue_name,
        attendee_count: attendeeCountMap.get(e.id) || 0,
        revenue: (revenueMap.get(e.id) || 0) / 100
      })) as EventWithStats[]
    }
  })
}

function useAllAttendees() {
  return useQuery({
    queryKey: ['events', 'all-attendees'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Use the event_attendee_list view which already joins events, orders, and attendees
      // and filters by payment_status IN ('paid', 'stepup_pending')
      const { data: attendeeList, error } = await supabase
        .from('event_attendee_list')
        .select('*')
        .eq('event_type', 'event')
        .order('event_date', { ascending: false })
        .returns<AttendeeListRow[]>()

      if (error) throw error
      if (!attendeeList || attendeeList.length === 0) return []

      // Get family names for attendees that have family_id
      const familyIds = [...new Set(attendeeList.map(a => a.family_id).filter(Boolean))] as string[]
      const { data: families } = familyIds.length > 0
        ? await supabase.from('families').select('id, display_name').in('id', familyIds).returns<FamilyRow[]>()
        : { data: [] as FamilyRow[] }

      const familyMap = new Map((families || []).map(f => [f.id, f]))

      return attendeeList.map(a => ({
        id: a.attendee_id,
        attendee_name: a.attendee_name,
        attendee_age: a.attendee_age,
        event_id: a.event_id,
        event_title: a.event_title || 'Unknown',
        event_date: a.event_date,
        event_location: a.venue_name,
        purchaser_name: a.purchaser_name,
        purchaser_email: a.purchaser_email,
        payment_status: a.payment_status || 'unknown',
        family_id: a.family_id,
        family_name: a.family_id ? familyMap.get(a.family_id)?.display_name : null
      })) as AttendeeWithDetails[]
    }
  })
}

interface EventsProps {
  onSelectFamily?: (familyId: string) => void
}

export default function Events({ onSelectFamily }: EventsProps) {
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<ViewMode>('events')
  const [searchQuery, setSearchQuery] = useState('')
  const [eventFilter, setEventFilter] = useState<string | null>(null)
  const [eventSortConfig, setEventSortConfig] = useState<{ field: EventSortField; direction: SortDirection }>({ field: 'start_at', direction: 'desc' })
  const [attendeeSortConfig, setAttendeeSortConfig] = useState<{ field: AttendeeSortField; direction: SortDirection }>({ field: 'attendee_name', direction: 'asc' })
  const [selectedEvent, setSelectedEvent] = useState<EventWithStats | null>(null)

  const { data: events = [], isLoading: loadingEvents } = useEvents()
  const { data: allAttendees = [], isLoading: loadingAttendees } = useAllAttendees()

  const handleFamilyClick = (familyId: string) => {
    if (onSelectFamily) {
      onSelectFamily(familyId)
    }
    sessionStorage.setItem('selectedFamilyId', familyId)
    navigate('/directory')
  }

  const filteredEvents = useMemo(() => {
    let result = [...events]
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(e =>
        e.title.toLowerCase().includes(query) ||
        e.location?.toLowerCase().includes(query)
      )
    }

    result.sort((a, b) => {
      let aVal: any, bVal: any
      switch (eventSortConfig.field) {
        case 'title':
          aVal = a.title.toLowerCase()
          bVal = b.title.toLowerCase()
          break
        case 'start_at':
          aVal = a.start_at || ''
          bVal = b.start_at || ''
          break
        case 'location':
          aVal = a.location?.toLowerCase() || ''
          bVal = b.location?.toLowerCase() || ''
          break
        case 'attendee_count':
          aVal = a.attendee_count
          bVal = b.attendee_count
          break
        case 'revenue':
          aVal = a.revenue
          bVal = b.revenue
          break
        default:
          return 0
      }
      if (aVal < bVal) return eventSortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return eventSortConfig.direction === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [events, searchQuery, eventSortConfig])

  const filteredAttendees = useMemo(() => {
    let result = [...allAttendees]

    // Apply event filter first if a specific event is selected
    if (eventFilter) {
      result = result.filter(a => a.event_id === eventFilter)
    }

    // Then apply search within the (possibly filtered) results
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(a =>
        a.attendee_name.toLowerCase().includes(query) ||
        a.event_title.toLowerCase().includes(query) ||
        a.purchaser_name?.toLowerCase().includes(query) ||
        a.purchaser_email?.toLowerCase().includes(query) ||
        a.family_name?.toLowerCase().includes(query)
      )
    }

    // Sort
    result.sort((a, b) => {
      let aVal: any, bVal: any
      switch (attendeeSortConfig.field) {
        case 'attendee_name':
          aVal = formatNameLastFirst(a.attendee_name).toLowerCase()
          bVal = formatNameLastFirst(b.attendee_name).toLowerCase()
          break
        case 'event_title':
          aVal = a.event_title.toLowerCase()
          bVal = b.event_title.toLowerCase()
          break
        case 'event_date':
          aVal = a.event_date || ''
          bVal = b.event_date || ''
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
      if (aVal < bVal) return attendeeSortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return attendeeSortConfig.direction === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [allAttendees, eventFilter, searchQuery, attendeeSortConfig])

  const handleEventSort = (field: EventSortField) => {
    setEventSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const handleAttendeeSort = (field: AttendeeSortField) => {
    setAttendeeSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const EventSortIcon = ({ field }: { field: EventSortField }) => {
    if (eventSortConfig.field !== field) {
      return <ChevronUp className="h-3 w-3 text-zinc-600" />
    }
    return eventSortConfig.direction === 'asc'
      ? <ChevronUp className="h-3 w-3 text-blue-400" />
      : <ChevronDown className="h-3 w-3 text-blue-400" />
  }

  const AttendeeSortIcon = ({ field }: { field: AttendeeSortField }) => {
    if (attendeeSortConfig.field !== field) {
      return <ChevronUp className="h-3 w-3 text-zinc-600" />
    }
    return attendeeSortConfig.direction === 'asc'
      ? <ChevronUp className="h-3 w-3 text-blue-400" />
      : <ChevronDown className="h-3 w-3 text-blue-400" />
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getEventStatus = (event: EventWithStats) => {
    if (!event.start_at) return { label: 'No Date', color: 'bg-zinc-500/20 text-zinc-400' }
    const now = new Date()
    const start = new Date(event.start_at)
    const end = event.end_at ? new Date(event.end_at) : start
    if (now < start) return { label: 'Upcoming', color: 'bg-blue-500/20 text-blue-400' }
    if (now > end) return { label: 'Past', color: 'bg-zinc-500/20 text-zinc-400' }
    return { label: 'In Progress', color: 'bg-green-500/20 text-green-400' }
  }

  const handleExportAttendees = () => {
    const data = viewMode === 'events' && selectedEvent
      ? allAttendees.filter(a => a.event_id === selectedEvent.id)
      : filteredAttendees

    const headers = ['Attendee Name', 'Age', 'Event', 'Date', 'Purchaser', 'Email', 'Payment Status', 'Family']
    const rows = data.map(a => [
      a.attendee_name,
      a.attendee_age?.toString() || '',
      a.event_title,
      formatDate(a.event_date),
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
    a.download = `event-attendees-${getTodayString()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const stats = useMemo(() => ({
    totalEvents: events.length,
    totalAttendees: events.reduce((sum, e) => sum + e.attendee_count, 0),
    totalRevenue: events.reduce((sum, e) => sum + e.revenue, 0)
  }), [events])

  return (
    <div className="h-full flex">
      <div className={`flex-1 flex flex-col transition-all duration-200 ${selectedEvent ? 'mr-[480px]' : ''}`}>
        <div className="px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-semibold text-white">Events</h1>
              <p className="text-sm text-zinc-400 mt-1">
                {stats.totalEvents} events • {stats.totalAttendees} attendees • ${stats.totalRevenue.toFixed(2)} revenue
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportAttendees}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-zinc-700 hover:bg-zinc-600 rounded-md text-white transition-colors"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                placeholder={viewMode === 'events' ? 'Search events...' : 'Search attendees by name, event, purchaser...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md pl-10 pr-4 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {viewMode === 'attendees' && (
              <select
                value={eventFilter || 'all'}
                onChange={(e) => setEventFilter(e.target.value === 'all' ? null : e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Events</option>
                {events.map(e => (
                  <option key={e.id} value={e.id}>{e.title}</option>
                ))}
              </select>
            )}

            <div className="flex items-center bg-zinc-800 rounded-md p-1">
              <button
                onClick={() => setViewMode('events')}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded transition-colors ${
                  viewMode === 'events' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <CalendarDays className="h-4 w-4" />
                Events
              </button>
              <button
                onClick={() => setViewMode('attendees')}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded transition-colors ${
                  viewMode === 'attendees' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <LayoutList className="h-4 w-4" />
                Attendees
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {viewMode === 'events' ? (
            loadingEvents ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-zinc-400">
                No events found
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-zinc-900 sticky top-0">
                  <tr className="border-b border-zinc-800">
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-white"
                      onClick={() => handleEventSort('title')}
                    >
                      <div className="flex items-center gap-1">
                        Event <EventSortIcon field="title" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-white"
                      onClick={() => handleEventSort('start_at')}
                    >
                      <div className="flex items-center gap-1">
                        Date <EventSortIcon field="start_at" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-white"
                      onClick={() => handleEventSort('location')}
                    >
                      <div className="flex items-center gap-1">
                        Location <EventSortIcon field="location" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-white"
                      onClick={() => handleEventSort('attendee_count')}
                    >
                      <div className="flex items-center gap-1">
                        Attendees <EventSortIcon field="attendee_count" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-white"
                      onClick={() => handleEventSort('revenue')}
                    >
                      <div className="flex items-center gap-1">
                        Revenue <EventSortIcon field="revenue" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {filteredEvents.map((event) => {
                    const status = getEventStatus(event)
                    return (
                      <tr
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className={`hover:bg-zinc-800/50 cursor-pointer ${
                          selectedEvent?.id === event.id ? 'bg-zinc-800' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-white">{event.title}</div>
                          {event.description && (
                            <div className="text-xs text-zinc-500 truncate max-w-xs">{event.description}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-sm text-zinc-300">
                            <Calendar className="h-4 w-4 text-zinc-500" />
                            {formatDate(event.start_at)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-sm text-zinc-300">
                            <MapPin className="h-4 w-4 text-zinc-500" />
                            {event.location || '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-sm text-zinc-300">
                            <Users className="h-4 w-4 text-zinc-500" />
                            {event.attendee_count}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-sm text-zinc-300">
                            <DollarSign className="h-4 w-4 text-zinc-500" />
                            ${event.revenue.toFixed(2)}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
          ) : (
            loadingAttendees ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              </div>
            ) : filteredAttendees.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-zinc-400">
                {searchQuery ? 'No attendees match your search' : 'No attendees found'}
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-zinc-900 sticky top-0">
                  <tr className="border-b border-zinc-800">
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-white"
                      onClick={() => handleAttendeeSort('attendee_name')}
                    >
                      <div className="flex items-center gap-1">
                        Attendee <AttendeeSortIcon field="attendee_name" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-white"
                      onClick={() => handleAttendeeSort('event_title')}
                    >
                      <div className="flex items-center gap-1">
                        Event <AttendeeSortIcon field="event_title" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-white"
                      onClick={() => handleAttendeeSort('event_date')}
                    >
                      <div className="flex items-center gap-1">
                        Date <AttendeeSortIcon field="event_date" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-white"
                      onClick={() => handleAttendeeSort('purchaser_name')}
                    >
                      <div className="flex items-center gap-1">
                        Purchaser <AttendeeSortIcon field="purchaser_name" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-white"
                      onClick={() => handleAttendeeSort('payment_status')}
                    >
                      <div className="flex items-center gap-1">
                        Status <AttendeeSortIcon field="payment_status" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-white"
                      onClick={() => handleAttendeeSort('family_name')}
                    >
                      <div className="flex items-center gap-1">
                        Family <AttendeeSortIcon field="family_name" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {filteredAttendees.map((attendee) => (
                    <tr key={attendee.id} className="hover:bg-zinc-800/50">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-white">{formatNameLastFirst(attendee.attendee_name)}</div>
                        {attendee.attendee_age && (
                          <div className="text-xs text-zinc-500">Age {attendee.attendee_age}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-zinc-300">{attendee.event_title}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-zinc-300">{formatDate(attendee.event_date)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-zinc-300">{attendee.purchaser_name ? formatNameLastFirst(attendee.purchaser_name) : '—'}</div>
                        <div className="text-xs text-zinc-500">{attendee.purchaser_email || ''}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          attendee.payment_status === 'paid' ? 'bg-green-500/20 text-green-400' :
                          attendee.payment_status === 'stepup_pending' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-zinc-500/20 text-zinc-400'
                        }`}>
                          {attendee.payment_status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {attendee.family_id && attendee.family_name ? (
                          <button
                            onClick={() => handleFamilyClick(attendee.family_id!)}
                            className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {attendee.family_name}
                          </button>
                        ) : (
                          <div className="text-sm text-zinc-500">—</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>

        <div className="px-6 py-3 border-t border-zinc-800 text-sm text-zinc-400">
          {viewMode === 'events'
            ? `Showing ${filteredEvents.length} event${filteredEvents.length !== 1 ? 's' : ''}`
            : `Showing ${filteredAttendees.length} attendee${filteredAttendees.length !== 1 ? 's' : ''}`
          }
        </div>
      </div>

      {selectedEvent && (
        <EventDetailPanel
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  )
}
