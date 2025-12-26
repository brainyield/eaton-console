import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryClient'
import { 
  Users, 
  GraduationCap, 
  DollarSign, 
  AlertCircle, 
  UserCheck,
  Calendar,
  TrendingUp,
  FileText
} from 'lucide-react'

interface DashboardStats {
  activeStudents: number
  activeFamilies: number
  activeTeachers: number
  outstandingBalance: number
  overdueInvoices: number
  unbilledHubSessions: number
  totalMRR: number
}

interface Alert {
  type: 'error' | 'warning'
  message: string
  count: number
  action?: string
}

// Custom hook for dashboard stats
function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.stats.dashboard(),
    queryFn: async (): Promise<DashboardStats> => {
      // Fetch all stats in parallel
      const [
        studentsResult,
        familiesResult,
        teachersResult,
        invoicesResult,
        hubSessionsResult,
        enrollmentsResult,
      ] = await Promise.all([
        // Active students
        supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('active', true),
        
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
          .select('balance_due, status')
          .in('status', ['sent', 'partial', 'overdue']),
        
        // Unbilled hub sessions
        supabase
          .from('hub_sessions')
          .select('id', { count: 'exact', head: true })
          .is('invoice_line_item_id', null),
        
        // Active enrollments for MRR calculation
        supabase
          .from('enrollments')
          .select('monthly_rate, weekly_tuition, hourly_rate_customer, hours_per_week')
          .eq('status', 'active'),
      ])

      // Type the invoice data
      interface InvoiceData {
        balance_due: number | null
        status: string | null
      }
      const invoices = (invoicesResult.data || []) as InvoiceData[]

      // Type the enrollment data
      interface EnrollmentData {
        monthly_rate: number | null
        weekly_tuition: number | null
        hourly_rate_customer: number | null
        hours_per_week: number | null
      }
      const enrollments = (enrollmentsResult.data || []) as EnrollmentData[]

      // Calculate outstanding balance
      const outstandingBalance = invoices.reduce(
        (sum, inv) => sum + (inv.balance_due || 0), 
        0
      )

      // Count overdue invoices
      const overdueInvoices = invoices.filter(inv => inv.status === 'overdue').length

      // Calculate rough MRR from active enrollments
      const totalMRR = enrollments.reduce((sum, e) => {
        if (e.monthly_rate) return sum + e.monthly_rate
        if (e.weekly_tuition) return sum + (e.weekly_tuition * 4)
        if (e.hourly_rate_customer && e.hours_per_week) {
          return sum + (e.hourly_rate_customer * e.hours_per_week * 4)
        }
        return sum
      }, 0)

      return {
        activeStudents: studentsResult.count || 0,
        activeFamilies: familiesResult.count || 0,
        activeTeachers: teachersResult.count || 0,
        outstandingBalance,
        overdueInvoices,
        unbilledHubSessions: hubSessionsResult.count || 0,
        totalMRR,
      }
    },
    staleTime: 60 * 1000, // Consider data fresh for 1 minute
  })
}

export default function CommandCenter() {
  const { data: stats, isLoading, error } = useDashboardStats()

  // Derive alerts from stats
  const alerts: Alert[] = []
  if (stats) {
    if (stats.overdueInvoices > 0) {
      alerts.push({
        type: 'error',
        message: 'invoices overdue 30+ days',
        count: stats.overdueInvoices,
        action: 'View overdue'
      })
    }
    
    if (stats.unbilledHubSessions > 0) {
      alerts.push({
        type: 'warning',
        message: 'Hub sessions unbilled',
        count: stats.unbilledHubSessions,
        action: 'Generate invoices'
      })
    }
  }

  const formatCurrency = (amount: number) => {
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`
    }
    return `$${amount.toFixed(0)}`
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
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Command Center</h1>
        <span className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString('en-US', { 
            weekday: 'long',
            month: 'long', 
            year: 'numeric' 
          })}
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
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

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Needs Attention */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-status-paused" />
            <h2 className="font-semibold">Needs Attention</h2>
          </div>
          
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">All caught up! 🎉</p>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert, i) => (
                <div 
                  key={i}
                  className="flex items-center justify-between p-2 rounded-md bg-background"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      alert.type === 'error' ? 'bg-status-churned' : 'bg-status-paused'
                    }`} />
                    <span className="text-sm">
                      <span className="font-medium">{alert.count}</span> {alert.message}
                    </span>
                  </div>
                  {alert.action && (
                    <button className="text-xs text-primary hover:underline">
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
          
          <div className="grid grid-cols-1 gap-2">
            {quickActions.map((action, i) => (
              <button
                key={i}
                onClick={action.action}
                className="text-left px-3 py-2 text-sm rounded-md border border-border hover:bg-accent hover:border-accent transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity - Placeholder for now */}
      <div className="mt-6 bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-semibold">Recent Activity</h2>
        </div>
        <p className="text-sm text-muted-foreground">Activity feed coming soon...</p>
      </div>
    </div>
  )
}