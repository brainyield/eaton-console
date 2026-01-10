import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryClient'
import { formatDateLocal } from '../lib/dateUtils'
import {
  Users,
  GraduationCap,
  DollarSign,
  AlertCircle,
  UserCheck,
  Calendar,
  TrendingUp,
  FileText,
  Target,
  UserPlus,
  Mail,
  MailOpen,
  Phone,
  CalendarCheck,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface DashboardStats {
  activeStudents: number
  activeFamilies: number
  activeTeachers: number
  outstandingBalance: number
  overdueInvoices: number
  overdueInvoices30Plus: number
  unbilledHubSessions: number
  totalMRR: number
  // New metrics
  grossProfitMargin: number
  avgRevenuePerStudent: number
  newEnrollmentsThisMonth: number
  unopenedInvoices: number
  familiesNeedingReengagement: number
  // Leads by type
  leadsExitIntent: number
  leadsWaitlist: number
  leadsCalendlyCall: number
  leadsEvent: number
  totalLeads: number
  // Upcoming Calendly
  upcomingCalls: number
  upcomingHubDropoffs: number
  // Comparative
  mrrThisMonth: number
  mrrLastMonth: number
  mrrChange: number
  enrollmentsLastMonth: number
  enrollmentsChange: number
}

interface Alert {
  type: 'error' | 'warning' | 'info'
  message: string
  count: number
  action?: string
  link?: string
}

interface UpcomingBooking {
  id: string
  event_type: string
  invitee_name: string
  invitee_phone: string | null
  scheduled_at: string
  student_name?: string
}

// Custom hook for dashboard stats
function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.stats.dashboard(),
    queryFn: async (): Promise<DashboardStats> => {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString()

      // For 90-day profit margin
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()

      // For 30+ day overdue calculation
      const thirtyDaysAgo = formatDateLocal(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000))

      // For unbilled hub sessions (only count past sessions)
      const today = formatDateLocal(now)

      // Fetch all stats in parallel
      const [
        studentsWithActiveEnrollmentsResult,
        familiesResult,
        teachersResult,
        invoicesResult,
        hubSessionsResult,
        enrollmentsResult,
        stepUpPendingResult,
        // New queries
        profitMarginResult,
        newEnrollmentsResult,
        lastMonthEnrollmentsResult,
        unopenedInvoicesResult,
        reengagementResult,
        leadsResult,
        upcomingCalendlyResult,
        lastMonthInvoicesResult,
        thisMonthInvoicesResult,
        overdue30PlusResult,
        eventLeadsViewResult,
      ] = await Promise.all([
        // Students with active/trial enrollments
        supabase
          .from('enrollments')
          .select('student_id')
          .in('status', ['active', 'trial']),

        // Active families
        supabase
          .from('families')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active'),

        // Active teachers
        supabase
          .from('teachers')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active'),

        // Outstanding invoices (sent, partial, overdue)
        supabase
          .from('invoices')
          .select('balance_due, status, total_amount')
          .in('status', ['sent', 'partial', 'overdue']),

        // Unbilled hub sessions (only past sessions that need billing)
        supabase
          .from('hub_sessions')
          .select('id', { count: 'exact', head: true })
          .is('invoice_line_item_id', null)
          .lte('session_date', today),

        // Active enrollments for MRR calculation
        supabase
          .from('enrollments')
          .select('monthly_rate, weekly_tuition, hourly_rate_customer, hours_per_week, daily_rate, service:services(code)')
          .eq('status', 'active'),

        // Pending Step Up event orders
        supabase
          .from('event_stepup_pending')
          .select('total_cents'),

        // Profit margin from invoice line items (paid invoices in last 90 days)
        supabase
          .from('invoice_line_items')
          .select('amount, profit, invoice:invoices!inner(status, paid_at)')
          .eq('invoice.status', 'paid')
          .gte('invoice.paid_at', ninetyDaysAgo),

        // New enrollments this month (based on when enrollment was created, not start_date)
        supabase
          .from('enrollments')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', monthStart),

        // Total enrollments created last month (full month)
        supabase
          .from('enrollments')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', lastMonthStart)
          .lte('created_at', lastMonthEnd),

        // Unopened invoices (sent but never viewed)
        supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .not('sent_at', 'is', null)
          .is('viewed_at', null)
          .in('status', ['sent', 'overdue']),

        // Families needing reengagement
        supabase
          .from('families')
          .select('id', { count: 'exact', head: true })
          .eq('reengagement_flag', true),

        // Leads by type (new/contacted only)
        supabase
          .from('leads')
          .select('lead_type')
          .in('status', ['new', 'contacted']),

        // Upcoming Calendly bookings
        supabase
          .from('calendly_bookings')
          .select('event_type')
          .eq('status', 'scheduled')
          .gte('scheduled_at', now.toISOString()),

        // Last month invoices for MRR comparison
        supabase
          .from('invoices')
          .select('total_amount')
          .eq('status', 'paid')
          .gte('invoice_date', lastMonthStart)
          .lte('invoice_date', lastMonthEnd),

        // This month paid invoices for proper MRR comparison (actual vs actual)
        supabase
          .from('invoices')
          .select('total_amount')
          .eq('status', 'paid')
          .gte('invoice_date', monthStart),

        // Overdue invoices 30+ days (due_date before 30 days ago)
        supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'overdue')
          .lte('due_date', thirtyDaysAgo),

        // Event purchasers without enrollments (from event_leads view)
        supabase
          .from('event_leads')
          .select('family_id', { count: 'exact', head: true }),
      ])

      // Type definitions
      interface InvoiceData {
        balance_due: number | null
        status: string | null
        total_amount: number | null
      }
      interface EnrollmentData {
        monthly_rate: number | null
        weekly_tuition: number | null
        hourly_rate_customer: number | null
        hours_per_week: number | null
        daily_rate: number | null
        service: { code: string } | null
      }
      interface StepUpPendingData {
        total_cents: number | null
      }
      interface LineItemData {
        amount: number | null
        profit: number | null
      }
      interface LeadData {
        lead_type: string
      }
      interface CalendlyData {
        event_type: string
      }
      interface LastMonthInvoiceData {
        total_amount: number | null
      }
      interface ThisMonthInvoiceData {
        total_amount: number | null
      }

      const invoices = (invoicesResult.data || []) as InvoiceData[]
      const enrollments = (enrollmentsResult.data || []) as EnrollmentData[]
      const stepUpPending = (stepUpPendingResult.data || []) as StepUpPendingData[]
      const lineItems = (profitMarginResult.data || []) as LineItemData[]
      const leads = (leadsResult.data || []) as LeadData[]
      const calendlyBookings = (upcomingCalendlyResult.data || []) as CalendlyData[]
      const lastMonthInvoices = (lastMonthInvoicesResult.data || []) as LastMonthInvoiceData[]
      const thisMonthInvoices = (thisMonthInvoicesResult.data || []) as ThisMonthInvoiceData[]

      // Count unique students with active/trial enrollments
      interface StudentEnrollmentData {
        student_id: string | null
      }
      const studentsWithEnrollments = (studentsWithActiveEnrollmentsResult.data || []) as StudentEnrollmentData[]
      const uniqueActiveStudents = new Set(
        studentsWithEnrollments
          .map(e => e.student_id)
          .filter((id): id is string => id !== null)
      ).size

      // Calculate outstanding balance
      const outstandingBalance = invoices.reduce(
        (sum, inv) => sum + (inv.balance_due || 0),
        0
      )

      // Count overdue invoices
      const overdueInvoices = invoices.filter(inv => inv.status === 'overdue').length

      // Calculate MRR from active enrollments
      const enrollmentMRR = enrollments.reduce((sum, e) => {
        const serviceCode = e.service?.code
        if (serviceCode === 'learning_pod') {
          return sum + (e.daily_rate || 0) * 4
        }
        if (serviceCode === 'academic_coaching') {
          return sum + (e.hourly_rate_customer || 0) * (e.hours_per_week || 0) * 4
        }
        if (serviceCode === 'eaton_online') {
          return sum + (e.weekly_tuition || 0) * 4
        }
        if (e.monthly_rate) {
          return sum + e.monthly_rate
        }
        return sum
      }, 0)

      const stepUpMRR = stepUpPending.reduce((sum, order) => {
        return sum + (order.total_cents || 0) / 100
      }, 0)

      const totalMRR = enrollmentMRR + stepUpMRR

      // Calculate gross profit margin
      const totalRevenue = lineItems.reduce((sum, li) => sum + (li.amount || 0), 0)
      const totalProfit = lineItems.reduce((sum, li) => sum + (li.profit || 0), 0)
      const grossProfitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

      // Average revenue per student
      const avgRevenuePerStudent = uniqueActiveStudents > 0 ? totalMRR / uniqueActiveStudents : 0

      // Count leads by type (from leads table)
      const leadsExitIntent = leads.filter(l => l.lead_type === 'exit_intent').length
      const leadsWaitlist = leads.filter(l => l.lead_type === 'waitlist').length
      const leadsCalendlyCall = leads.filter(l => l.lead_type === 'calendly_call').length
      // Event leads = leads table + event_leads view (families with event orders but no enrollments)
      const eventTypeLeadsCount = leads.filter(l => l.lead_type === 'event').length
      const eventPurchasersCount = eventLeadsViewResult.count || 0
      const leadsEvent = eventTypeLeadsCount + eventPurchasersCount
      const totalLeads = leads.length + eventPurchasersCount

      // Count upcoming Calendly bookings by type
      const upcomingCalls = calendlyBookings.filter(b => b.event_type === '15min_call').length
      const upcomingHubDropoffs = calendlyBookings.filter(b => b.event_type === 'hub_dropoff').length

      // Calculate actual revenue comparison (paid invoices this month vs last month)
      const mrrThisMonth = thisMonthInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0)
      const mrrLastMonth = lastMonthInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0)
      const mrrChange = mrrLastMonth > 0 ? ((mrrThisMonth - mrrLastMonth) / mrrLastMonth) * 100 : 0

      // Enrollments change
      const enrollmentsLastMonth = lastMonthEnrollmentsResult.count || 0
      const newEnrollmentsThisMonth = newEnrollmentsResult.count || 0
      let enrollmentsChange = 0
      if (enrollmentsLastMonth > 0) {
        enrollmentsChange = ((newEnrollmentsThisMonth - enrollmentsLastMonth) / enrollmentsLastMonth) * 100
      } else if (newEnrollmentsThisMonth > 0) {
        // If last month was 0 and this month has enrollments, show 100% growth
        enrollmentsChange = 100
      }

      return {
        activeStudents: uniqueActiveStudents,
        activeFamilies: familiesResult.count || 0,
        activeTeachers: teachersResult.count || 0,
        outstandingBalance,
        overdueInvoices,
        overdueInvoices30Plus: overdue30PlusResult.count || 0,
        unbilledHubSessions: hubSessionsResult.count || 0,
        totalMRR,
        grossProfitMargin,
        avgRevenuePerStudent,
        newEnrollmentsThisMonth,
        unopenedInvoices: unopenedInvoicesResult.count || 0,
        familiesNeedingReengagement: reengagementResult.count || 0,
        leadsExitIntent,
        leadsWaitlist,
        leadsCalendlyCall,
        leadsEvent,
        totalLeads,
        upcomingCalls,
        upcomingHubDropoffs,
        mrrThisMonth,
        mrrLastMonth,
        mrrChange,
        enrollmentsLastMonth,
        enrollmentsChange,
      }
    },
    staleTime: 60 * 1000,
  })
}

// Hook for upcoming Calendly bookings details
function useUpcomingBookings() {
  return useQuery({
    queryKey: ['calendly', 'upcoming'],
    queryFn: async (): Promise<UpcomingBooking[]> => {
      const { data, error } = await supabase
        .from('calendly_bookings')
        .select('id, event_type, invitee_name, invitee_phone, scheduled_at, student_name')
        .eq('status', 'scheduled')
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })

      if (error) throw error
      return (data || []) as UpcomingBooking[]
    },
    staleTime: 60 * 1000,
  })
}

// Change indicator component
function ChangeIndicator({ value, suffix = '%' }: { value: number; suffix?: string }) {
  if (Math.abs(value) < 0.1) {
    return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus className="w-3 h-3" /> No change</span>
  }

  const isPositive = value > 0
  return (
    <span className={`text-xs flex items-center gap-0.5 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
      {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {isPositive ? '+' : ''}{value.toFixed(1)}{suffix}
    </span>
  )
}

export default function CommandCenter() {
  const navigate = useNavigate()
  const { data: stats, isLoading, error } = useDashboardStats()
  const { data: upcomingBookings = [] } = useUpcomingBookings()
  const [showAllBookings, setShowAllBookings] = useState(false)

  // Pagination for bookings - show 5 by default, all when expanded
  const displayedBookings = showAllBookings ? upcomingBookings : upcomingBookings.slice(0, 5)
  const hasMoreBookings = upcomingBookings.length > 5

  // Derive alerts from stats
  const alerts: Alert[] = []
  if (stats) {
    if (stats.overdueInvoices30Plus > 0) {
      alerts.push({
        type: 'error',
        message: 'invoices overdue 30+ days',
        count: stats.overdueInvoices30Plus,
        action: 'View overdue',
        link: '/invoicing?status=overdue'
      })
    }

    if (stats.unbilledHubSessions > 0) {
      alerts.push({
        type: 'warning',
        message: 'Hub sessions unbilled',
        count: stats.unbilledHubSessions,
        action: 'Generate invoices',
        link: '/invoicing'
      })
    }

    if (stats.unopenedInvoices > 0) {
      alerts.push({
        type: 'warning',
        message: 'invoices sent but unopened',
        count: stats.unopenedInvoices,
        action: 'View',
        link: '/invoicing?filter=unopened'
      })
    }

    if (stats.familiesNeedingReengagement > 0) {
      alerts.push({
        type: 'info',
        message: 'families flagged for reengagement',
        count: stats.familiesNeedingReengagement,
        action: 'View',
        link: '/directory?reengagement=true'
      })
    }
  }

  const formatCurrency = (amount: number) => {
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`
    }
    return `$${amount.toFixed(0)}`
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const statCards = [
    {
      label: 'Students',
      value: stats?.activeStudents ?? 0,
      sub: 'Active',
      icon: GraduationCap,
      color: 'text-status-active',
    },
    {
      label: 'Families',
      value: stats?.activeFamilies ?? 0,
      sub: 'Active',
      icon: Users,
      color: 'text-status-active',
    },
    {
      label: 'MRR',
      value: formatCurrency(stats?.totalMRR ?? 0),
      sub: 'Monthly Revenue',
      icon: TrendingUp,
      color: 'text-status-trial',
      isFormatted: true,
      change: stats?.mrrChange,
    },
    {
      label: 'Outstanding',
      value: formatCurrency(stats?.outstandingBalance ?? 0),
      sub: 'Balance',
      icon: DollarSign,
      color: (stats?.outstandingBalance ?? 0) > 5000 ? 'text-status-churned' : 'text-status-paused',
      isFormatted: true,
    },
    {
      label: 'Teachers',
      value: stats?.activeTeachers ?? 0,
      sub: 'Active',
      icon: UserCheck,
      color: 'text-status-active',
    },
  ]

  const secondaryStats = [
    {
      label: 'Profit Margin',
      value: `${(stats?.grossProfitMargin ?? 0).toFixed(1)}%`,
      icon: Percent,
      color: (stats?.grossProfitMargin ?? 0) >= 30 ? 'text-green-400' : 'text-yellow-400',
    },
    {
      label: 'Avg/Student',
      value: formatCurrency(stats?.avgRevenuePerStudent ?? 0),
      icon: Target,
      color: 'text-blue-400',
    },
    {
      label: 'New Enrollments',
      value: stats?.newEnrollmentsThisMonth ?? 0,
      sub: `This month (${stats?.enrollmentsLastMonth ?? 0} last month)`,
      icon: UserPlus,
      color: 'text-green-400',
      change: stats?.enrollmentsChange,
      link: '/roster?newThisMonth=true',
    },
  ]

  const quickActions = [
    { label: '+ Add Family', action: () => {} },
    { label: 'Generate Weekly Invoices', action: () => {} },
    { label: 'Send Balance Reminders', action: () => {} },
    { label: 'Process Teacher Payroll', action: () => {} },
  ]

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-6">Command Center</h1>
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-6">Command Center</h1>
        <div className="text-red-400">Failed to load dashboard data</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Command Center</h1>
        <span className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          })}
        </span>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
              {stat.change !== undefined && <ChangeIndicator value={stat.change} />}
            </div>
            <div className={`text-2xl font-bold ${stat.color}`}>
              {stat.value}
            </div>
            <div className="text-sm text-muted-foreground">{stat.label}</div>
            {stat.sub && <div className="text-xs text-muted-foreground/70">{stat.sub}</div>}
          </div>
        ))}
      </div>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        {secondaryStats.map((stat) => {
          const content = (
            <>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
              <div className="flex-1">
                <div className={`text-lg font-semibold ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
                {stat.sub && <div className="text-xs text-muted-foreground/70">{stat.sub}</div>}
              </div>
              {stat.change !== undefined && <ChangeIndicator value={stat.change} />}
            </>
          )

          if (stat.link) {
            return (
              <button
                key={stat.label}
                onClick={() => navigate(stat.link!)}
                className="bg-card border border-border rounded-lg p-3 flex items-center gap-3 hover:bg-accent hover:border-accent transition-colors text-left"
              >
                {content}
              </button>
            )
          }

          return (
            <div key={stat.label} className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
              {content}
            </div>
          )
        })}
      </div>

      {/* Three Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leads Pipeline */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-blue-400" />
            <h2 className="font-semibold">Leads Pipeline</h2>
            <span className="ml-auto text-lg font-bold text-blue-400">{stats?.totalLeads ?? 0}</span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 rounded bg-background">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-purple-400" />
                <span className="text-sm">Exit Intent</span>
              </div>
              <span className="font-medium">{stats?.leadsExitIntent ?? 0}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-background">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-green-400" />
                <span className="text-sm">Waitlist</span>
              </div>
              <span className="font-medium">{stats?.leadsWaitlist ?? 0}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-background">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-400" />
                <span className="text-sm">Calendly</span>
              </div>
              <span className="font-medium">{stats?.leadsCalendlyCall ?? 0}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-background">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-orange-400" />
                <span className="text-sm">Event</span>
              </div>
              <span className="font-medium">{stats?.leadsEvent ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Needs Attention */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-status-paused" />
            <h2 className="font-semibold">Needs Attention</h2>
          </div>

          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">All caught up!</p>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 rounded-md bg-background"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      alert.type === 'error' ? 'bg-status-churned' :
                      alert.type === 'warning' ? 'bg-status-paused' :
                      'bg-blue-400'
                    }`} />
                    <span className="text-sm">
                      <span className="font-medium">{alert.count}</span> {alert.message}
                    </span>
                  </div>
                  {alert.action && alert.link && (
                    <button
                      onClick={() => navigate(alert.link!)}
                      className="text-xs text-primary hover:underline"
                    >
                      {alert.action}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-status-trial" />
            <h2 className="font-semibold">Quick Actions</h2>
          </div>

          <div className="space-y-2">
            {quickActions.map((action, i) => (
              <button
                key={i}
                onClick={action.action}
                className="w-full text-left px-3 py-2 text-sm rounded-md border border-border hover:bg-accent hover:border-accent transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Upcoming Calendly Bookings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <CalendarCheck className="w-5 h-5 text-green-400" />
            <h2 className="font-semibold">Upcoming Calendly</h2>
            <div className="ml-auto flex gap-2">
              <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
                {stats?.upcomingCalls ?? 0} calls
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400">
                {stats?.upcomingHubDropoffs ?? 0} hub
              </span>
            </div>
          </div>

          {upcomingBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming bookings</p>
          ) : (
            <div className="space-y-2">
              {displayedBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between p-2 rounded-md bg-background"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      booking.event_type === 'hub_dropoff' ? 'bg-green-400' : 'bg-blue-400'
                    }`} />
                    <div>
                      <div className="text-sm font-medium">{booking.invitee_name}</div>
                      {booking.invitee_phone && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {booking.invitee_phone}
                        </div>
                      )}
                      {booking.student_name && (
                        <div className="text-xs text-muted-foreground">Student: {booking.student_name}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatTime(booking.scheduled_at)}
                  </div>
                </div>
              ))}
              {hasMoreBookings && (
                <button
                  onClick={() => setShowAllBookings(!showAllBookings)}
                  className="w-full flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showAllBookings ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      Show {upcomingBookings.length - 5} more
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Invoice Health */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <MailOpen className="w-5 h-5 text-yellow-400" />
            <h2 className="font-semibold">Invoice Health</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded bg-background">
              <div className="text-2xl font-bold text-status-churned">{stats?.overdueInvoices30Plus ?? 0}</div>
              <div className="text-xs text-muted-foreground">Overdue 30+ days</div>
            </div>
            <div className="p-3 rounded bg-background">
              <div className="text-2xl font-bold text-yellow-400">{stats?.unopenedInvoices ?? 0}</div>
              <div className="text-xs text-muted-foreground">Sent but unopened</div>
            </div>
            <div className="p-3 rounded bg-background">
              <div className="text-2xl font-bold text-status-paused">{stats?.unbilledHubSessions ?? 0}</div>
              <div className="text-xs text-muted-foreground">Unbilled Hub sessions</div>
            </div>
            <div className="p-3 rounded bg-background">
              <div className="text-2xl font-bold text-blue-400">{formatCurrency(stats?.outstandingBalance ?? 0)}</div>
              <div className="text-xs text-muted-foreground">Total outstanding</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
