import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatCurrency as formatCurrencyExact } from '../lib/moneyUtils'
import {
  useDashboardStats,
  useUpcomingBookings,
  useAcademicCoachingDeadbeats,
  usePgNetFailures,
} from '../lib/hooks'
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
  Phone,
  AlertTriangle,
  CheckCircle2,
  CalendarCheck,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface Alert {
  type: 'error' | 'warning' | 'info'
  message: string
  count: number
  action?: string
  link?: string
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
  const { data: acDeadbeats = [] } = useAcademicCoachingDeadbeats()
  const { data: pgnetFailures = [] } = usePgNetFailures(24)
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

  if (pgnetFailures.length > 0) {
    alerts.push({
      type: 'error',
      message: 'async trigger failures (pg_net) in last 24h',
      count: pgnetFailures.length,
      action: 'Check Settings',
      link: '/settings'
    })
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
      sub: 'From Active Enrollments',
      icon: TrendingUp,
      color: 'text-status-trial',
      isFormatted: true,
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

        {/* AC Deadbeats */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h2 className="font-semibold">AC Deadbeats</h2>
            {acDeadbeats.length > 0 && (
              <span className="ml-auto text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                {acDeadbeats.length}
              </span>
            )}
          </div>

          {acDeadbeats.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-green-400">
              <CheckCircle2 className="w-4 h-4" />
              No overdue academic coaching invoices
            </div>
          ) : (
            <>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {acDeadbeats.map((d) => (
                  <div
                    key={d.familyId}
                    className={`flex items-center justify-between p-2 rounded-md bg-background border-l-2 ${
                      d.maxOverdueDays >= 30
                        ? 'border-l-red-500'
                        : d.maxOverdueDays >= 14
                          ? 'border-l-amber-400'
                          : 'border-l-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        onClick={() => navigate('/directory')}
                        className="text-sm font-medium text-primary hover:underline truncate"
                      >
                        {d.familyName}
                      </button>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                        {d.invoiceCount}
                      </span>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ml-2 ${
                      d.maxOverdueDays >= 30 ? 'text-red-400' : 'text-red-400/80'
                    }`}>
                      {formatCurrencyExact(d.totalAcAmount)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                {acDeadbeats.length} {acDeadbeats.length === 1 ? 'family' : 'families'} | {formatCurrencyExact(acDeadbeats.reduce((sum, d) => sum + d.totalAcAmount, 0))} total overdue
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
