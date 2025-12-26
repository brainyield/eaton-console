import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  Clock,
  DollarSign,
  Users,
  Calendar,
  RefreshCw,
} from 'lucide-react'

// Supabase response types
interface EnrollmentRow {
  id: string
  status: string
  service_id: string
  services: {
    id: string
    name: string
    code: string
  } | null
}

interface BalanceRow {
  due_date: string
  balance_due: number | null
  status: string
}

interface PayrollRow {
  pay_date: string
  total_amount: number | null
}

// Chart data types
interface RevenueByMonth {
  month: string
  revenue: number
}

interface RevenueByService {
  month: string
  [key: string]: string | number // dynamic service keys
}

interface EnrollmentByService {
  name: string
  value: number
  code: string
}

interface BalanceAging {
  bucket: string
  amount: number
  count: number
}

interface PayrollByMonth {
  month: string
  amount: number
  payments: number
}

// Color palette for dark mode
const COLORS = {
  primary: '#3b82f6',
  secondary: '#10b981',
  accent: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  pink: '#ec4899',
  cyan: '#06b6d4',
}

const PIE_COLORS = [
  COLORS.primary,
  COLORS.secondary,
  COLORS.accent,
  COLORS.purple,
  COLORS.pink,
  COLORS.cyan,
  COLORS.danger,
]

const SERVICE_COLORS: Record<string, string> = {
  academic_coaching: COLORS.primary,
  learning_pod: COLORS.secondary,
  consulting_with_teacher: COLORS.accent,
  consulting_only: COLORS.purple,
  eaton_online: COLORS.pink,
  eaton_hub: COLORS.cyan,
  elective_classes: '#f97316',
}

// Date range options
const DATE_RANGES = [
  { label: 'Last 3 Months', value: '3m' },
  { label: 'Last 6 Months', value: '6m' },
  { label: 'Year to Date', value: 'ytd' },
  { label: 'All Time', value: 'all' },
]

// Helper function to calculate start date
function getStartDate(dateRange: string): string {
  const now = new Date()
  let startDate: Date
  switch (dateRange) {
    case '3m':
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1)
      break
    case '6m':
      startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1)
      break
    case 'ytd':
      startDate = new Date(now.getFullYear(), 0, 1)
      break
    case 'all':
      startDate = new Date(2020, 0, 1)
      break
    default:
      startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1)
  }
  return startDate.toISOString().split('T')[0]
}

// Service name mapping for legend
const serviceNameMap: Record<string, string> = {
  academic_coaching: 'Academic Coaching',
  learning_pod: 'Learning Pod',
  consulting_with_teacher: 'Consulting w/ Teacher',
  consulting_only: 'Consulting Only',
  eaton_online: 'Eaton Online',
  eaton_hub: 'Eaton Hub',
  elective_classes: 'Electives',
}

export default function Reports() {
  const [dateRange, setDateRange] = useState('6m')

  const startDate = useMemo(() => getStartDate(dateRange), [dateRange])

  // Revenue by month query
  const { 
    data: revenueResult, 
    isLoading: loadingRevenue,
    refetch: refetchRevenue
  } = useQuery({
    queryKey: ['reports', 'revenue', startDate],
    queryFn: async () => {
      // Fetch revenue records
      const { data: revenueData, error: revenueError } = await supabase
        .from('revenue_records')
        .select('period_start, revenue, service_id')
        .gte('period_start', startDate)
        .order('period_start', { ascending: true })

      if (revenueError) throw revenueError

      // Fetch services for lookup
      const { data: servicesData } = await supabase
        .from('services')
        .select('id, name, code')

      const serviceMap: Record<string, { name: string; code: string }> = {}
      ;(servicesData || []).forEach((s: { id: string; name: string; code: string }) => {
        serviceMap[s.id] = { name: s.name, code: s.code }
      })

      const records = revenueData || []

      // Group by month (total)
      const monthlyData: Record<string, number> = {}
      // Group by month and service
      const monthlyByService: Record<string, Record<string, number>> = {}
      const allServices = new Set<string>()

      records.forEach((rec: { period_start: string; revenue: number | null; service_id: string }) => {
        const [year, month] = rec.period_start.split('-')
        const monthKey = `${year}-${month}`
        const revenue = Number(rec.revenue) || 0
        const serviceCode = serviceMap[rec.service_id]?.code || 'unknown'
        
        // Total by month
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = 0
        }
        monthlyData[monthKey] += revenue

        // By service
        if (!monthlyByService[monthKey]) {
          monthlyByService[monthKey] = {}
        }
        if (!monthlyByService[monthKey][serviceCode]) {
          monthlyByService[monthKey][serviceCode] = 0
        }
        monthlyByService[monthKey][serviceCode] += revenue
        allServices.add(serviceCode)
      })

      // Convert to array and format month names
      const chartData: RevenueByMonth[] = Object.entries(monthlyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month]) => {
          const [year, m] = month.split('-')
          const date = new Date(Number(year), Number(m) - 1)
          return {
            month: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
            revenue: Math.round(monthlyData[month]),
          }
        })

      // Revenue by service chart data
      const serviceChartData: RevenueByService[] = Object.entries(monthlyByService)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, services]) => {
          const [year, m] = month.split('-')
          const date = new Date(Number(year), Number(m) - 1)
          const entry: RevenueByService = {
            month: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          }
          allServices.forEach((code) => {
            entry[code] = Math.round(services[code] || 0)
          })
          return entry
        })

      const serviceKeys = Array.from(allServices).sort()
      const totalRevenue = chartData.reduce((sum, d) => sum + d.revenue, 0)

      return {
        revenueData: chartData,
        revenueByServiceData: serviceChartData,
        serviceKeys,
        totalRevenue,
      }
    },
  })

  // Enrollments by service query
  const { 
    data: enrollmentResult, 
    isLoading: loadingEnrollments,
    refetch: refetchEnrollments
  } = useQuery({
    queryKey: ['reports', 'enrollments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          id,
          status,
          service_id,
          services (
            id,
            name,
            code
          )
        `)
        .eq('status', 'active')

      if (error) throw error

      const enrollments = (data || []) as EnrollmentRow[]

      // Group by service
      const serviceData: Record<string, { name: string; count: number; code: string }> = {}

      enrollments.forEach((e) => {
        const service = e.services
        if (service) {
          const key = service.id
          if (!serviceData[key]) {
            serviceData[key] = { name: service.name, count: 0, code: service.code }
          }
          serviceData[key].count++
        }
      })

      const chartData: EnrollmentByService[] = Object.values(serviceData)
        .map((s) => ({
          name: s.name,
          value: s.count,
          code: s.code,
        }))
        .sort((a, b) => b.value - a.value)

      const activeEnrollments = chartData.reduce((sum, d) => sum + d.value, 0)

      return {
        enrollmentData: chartData,
        activeEnrollments,
      }
    },
  })

  // Balance aging query
  const { 
    data: balanceResult, 
    isLoading: loadingBalances,
    refetch: refetchBalances
  } = useQuery({
    queryKey: ['reports', 'balances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('due_date, balance_due, status')
        .gt('balance_due', 0)
        .in('status', ['sent', 'partial', 'overdue'])

      if (error) throw error

      const invoices = (data || []) as BalanceRow[]

      const today = new Date()
      const buckets: Record<string, { amount: number; count: number }> = {
        'Current': { amount: 0, count: 0 },
        '1-30 Days': { amount: 0, count: 0 },
        '31-60 Days': { amount: 0, count: 0 },
        '61-90 Days': { amount: 0, count: 0 },
        '90+ Days': { amount: 0, count: 0 },
      }

      invoices.forEach((inv) => {
        const dueDate = new Date(inv.due_date)
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        const amount = Number(inv.balance_due) || 0

        if (daysOverdue <= 0) {
          buckets['Current'].amount += amount
          buckets['Current'].count++
        } else if (daysOverdue <= 30) {
          buckets['1-30 Days'].amount += amount
          buckets['1-30 Days'].count++
        } else if (daysOverdue <= 60) {
          buckets['31-60 Days'].amount += amount
          buckets['31-60 Days'].count++
        } else if (daysOverdue <= 90) {
          buckets['61-90 Days'].amount += amount
          buckets['61-90 Days'].count++
        } else {
          buckets['90+ Days'].amount += amount
          buckets['90+ Days'].count++
        }
      })

      const chartData: BalanceAging[] = Object.entries(buckets).map(([bucket, data]) => ({
        bucket,
        amount: Math.round(data.amount),
        count: data.count,
      }))

      const totalOutstanding = chartData.reduce((sum, d) => sum + d.amount, 0)

      return {
        balanceData: chartData,
        totalOutstanding,
      }
    },
  })

  // Payroll by month query
  const { 
    data: payrollResult, 
    isLoading: loadingPayroll,
    refetch: refetchPayroll
  } = useQuery({
    queryKey: ['reports', 'payroll', startDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teacher_payments')
        .select('pay_date, total_amount')
        .gte('pay_date', startDate)
        .order('pay_date', { ascending: true })

      if (error) throw error

      const payments = (data || []) as PayrollRow[]

      // Group by month
      const monthlyData: Record<string, { amount: number; count: number }> = {}

      payments.forEach((p) => {
        const date = new Date(p.pay_date)
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { amount: 0, count: 0 }
        }
        
        monthlyData[monthKey].amount += Number(p.total_amount) || 0
        monthlyData[monthKey].count++
      })

      // Convert to array
      const chartData: PayrollByMonth[] = Object.entries(monthlyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => {
          const [year, m] = month.split('-')
          const date = new Date(Number(year), Number(m) - 1)
          return {
            month: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
            amount: Math.round(data.amount),
            payments: data.count,
          }
        })

      const totalPayroll = chartData.reduce((sum, d) => sum + d.amount, 0)

      return {
        payrollData: chartData,
        totalPayroll,
      }
    },
  })

  // Combined loading state
  const loading = loadingRevenue || loadingEnrollments || loadingBalances || loadingPayroll

  // Refresh all data
  const handleRefresh = () => {
    refetchRevenue()
    refetchEnrollments()
    refetchBalances()
    refetchPayroll()
  }

  // Extract data from query results with defaults
  const revenueData = revenueResult?.revenueData ?? []
  const revenueByServiceData = revenueResult?.revenueByServiceData ?? []
  const serviceKeys = revenueResult?.serviceKeys ?? []
  const totalRevenue = revenueResult?.totalRevenue ?? 0

  const enrollmentData = enrollmentResult?.enrollmentData ?? []
  const activeEnrollments = enrollmentResult?.activeEnrollments ?? 0

  const balanceData = balanceResult?.balanceData ?? []
  const totalOutstanding = balanceResult?.totalOutstanding ?? 0

  const payrollData = payrollResult?.payrollData ?? []
  const totalPayroll = payrollResult?.totalPayroll ?? 0

  // Custom tooltip styles for dark mode
  const tooltipStyle = {
    backgroundColor: '#1f2937',
    border: '1px solid #374151',
    borderRadius: '8px',
    color: '#e5e7eb',
  }

  // Pie chart data (simplified for Recharts compatibility)
  const pieData = enrollmentData.map(({ name, value }) => ({ name, value }))

  return (
    <div className="p-6 bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-blue-500" />
            Reports
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Financial and operational insights
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Date Range Selector */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {DATE_RANGES.map((range) => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Revenue</p>
              <p className="text-2xl font-bold text-white">
                ${totalRevenue.toLocaleString()}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-blue-500 opacity-50" />
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Outstanding Balance</p>
              <p className="text-2xl font-bold text-amber-500">
                ${totalOutstanding.toLocaleString()}
              </p>
            </div>
            <Clock className="w-8 h-8 text-amber-500 opacity-50" />
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Active Enrollments</p>
              <p className="text-2xl font-bold text-white">{activeEnrollments}</p>
            </div>
            <Users className="w-8 h-8 text-green-500 opacity-50" />
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Teacher Payroll</p>
              <p className="text-2xl font-bold text-white">
                ${totalPayroll.toLocaleString()}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-500 opacity-50" />
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Month */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-500" />
            Revenue by Month
          </h3>
          {loadingRevenue ? (
            <div className="h-64 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
            </div>
          ) : revenueData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No revenue data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} tickFormatter={(v) => `$${v/1000}k`} />
                <Tooltip 
                  contentStyle={tooltipStyle} 
                  formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Revenue']}
                />
                <Bar dataKey="revenue" name="Revenue" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Revenue by Service (Stacked) */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            Revenue by Service
          </h3>
          {loadingRevenue ? (
            <div className="h-64 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
            </div>
          ) : revenueByServiceData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No revenue data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueByServiceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} tickFormatter={(v) => `$${v/1000}k`} />
                <Tooltip 
                  contentStyle={tooltipStyle}
                  formatter={(value, name) => [`$${Number(value).toLocaleString()}`, serviceNameMap[name as string] || name]}
                />
                <Legend 
                  wrapperStyle={{ color: '#9ca3af' }} 
                  formatter={(value) => serviceNameMap[value] || value}
                />
                {serviceKeys.map((key) => (
                  <Bar 
                    key={key} 
                    dataKey={key} 
                    stackId="a" 
                    fill={SERVICE_COLORS[key] || COLORS.primary} 
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Enrollments by Service */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <PieChartIcon className="w-5 h-5 text-green-500" />
            Enrollments by Service
          </h3>
          {loadingEnrollments ? (
            <div className="h-64 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
            </div>
          ) : enrollmentData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No active enrollments
            </div>
          ) : (
            <div className="flex items-center">
              <ResponsiveContainer width="60%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    label={({ percent = 0 }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                    labelLine={false}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="w-40 space-y-2">
                {enrollmentData.map((entry, index) => (
                  <div key={entry.code} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                    />
                    <span className="text-sm text-gray-300 truncate">{entry.name}</span>
                    <span className="text-sm text-gray-500 ml-auto">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Outstanding Balance Aging */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            Outstanding Balance Aging
          </h3>
          {loadingBalances ? (
            <div className="h-64 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
            </div>
          ) : balanceData.every((d) => d.amount === 0) ? (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No outstanding balances! 🎉
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={balanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="bucket" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} tickFormatter={(v) => `$${v/1000}k`} />
                <Tooltip 
                  contentStyle={tooltipStyle}
                  formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Amount']}
                />
                <Bar dataKey="amount" name="Amount" radius={[4, 4, 0, 0]}>
                  {balanceData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.bucket === 'Current'
                          ? COLORS.secondary
                          : entry.bucket === '1-30 Days'
                          ? COLORS.accent
                          : entry.bucket === '31-60 Days'
                          ? '#f97316'
                          : COLORS.danger
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Teacher Payroll by Month */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 lg:col-span-2">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-500" />
            Teacher Payroll by Month
          </h3>
          {loadingPayroll ? (
            <div className="h-64 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
            </div>
          ) : payrollData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No payroll data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={payrollData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} tickFormatter={(v) => `$${v/1000}k`} />
                <Tooltip 
                  contentStyle={tooltipStyle}
                  formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Payroll']}
                />
                <Legend wrapperStyle={{ color: '#9ca3af' }} />
                <Line
                  type="monotone"
                  dataKey="amount"
                  name="Payroll"
                  stroke={COLORS.purple}
                  strokeWidth={2}
                  dot={{ fill: COLORS.purple, strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Quick Stats Table */}
      <div className="mt-6 bg-gray-800 border border-gray-700 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-4">Quick Stats</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-400">Avg Monthly Revenue</p>
            <p className="text-xl font-bold text-white">
              {revenueData.length > 0
                ? `$${Math.round(totalRevenue / revenueData.length).toLocaleString()}`
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-gray-400">Revenue Records</p>
            <p className="text-xl font-bold text-white">
              {revenueData.length > 0 ? `${revenueData.length} months` : '—'}
            </p>
          </div>
          <div>
            <p className="text-gray-400">Overdue Amount</p>
            <p className="text-xl font-bold text-red-500">
              ${balanceData
                .filter((d) => d.bucket !== 'Current')
                .reduce((sum, d) => sum + d.amount, 0)
                .toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-gray-400">Profit Margin</p>
            <p className="text-xl font-bold text-green-500">
              {totalRevenue > 0 && totalPayroll > 0
                ? `${Math.round(((totalRevenue - totalPayroll) / totalRevenue) * 100)}%`
                : '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}