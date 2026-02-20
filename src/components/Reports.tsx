import { useState, useMemo } from 'react'
import { formatDateLocal } from '../lib/dateUtils'
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
  Info,
} from 'lucide-react'
import { usePayrollByMonth, useRevenueByMonth, useEnrollmentsByService, useBalanceAging, useRevenueByLocation } from '../lib/hooks'
import { ChartContainer } from './ui/ChartContainer'
import {
  CHART_COLORS,
  PIE_COLORS,
  SERVICE_COLORS,
  LOCATION_COLORS,
  TOOLTIP_STYLE,
  TOOLTIP_ITEM_STYLE,
  TOOLTIP_LABEL_STYLE,
  BAR_RADIUS_TOP,
  BAR_RADIUS_RIGHT,
} from '../lib/chartTheme'

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
  return formatDateLocal(startDate)
}

export default function Reports() {
  const [dateRange, setDateRange] = useState('6m')

  const startDate = useMemo(() => getStartDate(dateRange), [dateRange])

  // Revenue by month query
  const {
    data: revenueResult,
    isLoading: loadingRevenue,
    isError: revenueError,
    error: revenueErrorMsg,
    refetch: refetchRevenue
  } = useRevenueByMonth(startDate)

  // Enrollments by service query
  const {
    data: enrollmentResult,
    isLoading: loadingEnrollments,
    isError: enrollmentError,
    error: enrollmentErrorMsg,
    refetch: refetchEnrollments
  } = useEnrollmentsByService()

  // Balance aging query
  const {
    data: balanceResult,
    isLoading: loadingBalances,
    isError: balanceError,
    error: balanceErrorMsg,
    refetch: refetchBalances
  } = useBalanceAging()

  // Payroll by month query - combines legacy teacher_payments and batch payroll_run
  const {
    data: payrollResult,
    isLoading: loadingPayroll,
    isError: payrollError,
    error: payrollErrorMsg,
    refetch: refetchPayroll
  } = usePayrollByMonth(startDate)

  // Revenue by location query
  const {
    data: locationResult,
    isLoading: loadingLocation,
    isError: locationError,
    error: locationErrorMsg,
    refetch: refetchLocation
  } = useRevenueByLocation(startDate)

  // Combined loading state
  const loading = loadingRevenue || loadingEnrollments || loadingBalances || loadingPayroll || loadingLocation

  // Refresh all data
  const handleRefresh = () => {
    refetchRevenue()
    refetchEnrollments()
    refetchBalances()
    refetchPayroll()
    refetchLocation()
  }

  // Extract data from query results with defaults
  const revenueData = revenueResult?.revenueData ?? []
  const revenueByServiceData = revenueResult?.revenueByServiceData ?? []
  const serviceKeys = revenueResult?.serviceKeys ?? []
  const serviceNameMap = revenueResult?.serviceNameMap ?? {}
  const totalRevenue = revenueResult?.totalRevenue ?? 0
  const cashCollected = revenueResult?.cashCollected ?? 0

  const enrollmentData = enrollmentResult?.enrollmentData ?? []
  const activeEnrollments = enrollmentResult?.activeEnrollments ?? 0

  const balanceData = balanceResult?.balanceData ?? []
  const totalOutstanding = balanceResult?.totalOutstanding ?? 0

  const payrollData = (payrollResult?.payrollData ?? []).map(d => ({
    month: d.monthLabel,
    amount: d.total_amount,
    payments: d.payment_count,
  }))
  const totalPayroll = payrollResult?.totalPayroll ?? 0

  const locationData = locationResult?.locationData ?? []

  // Pie chart data (memoized for performance)
  const pieData = useMemo(
    () => (enrollmentResult?.enrollmentData ?? []).map(({ name, value }) => ({ name, value })),
    [enrollmentResult?.enrollmentData]
  )

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
          <ChartContainer
            isLoading={loadingRevenue}
            isError={revenueError}
            error={revenueErrorMsg}
            isEmpty={revenueData.length === 0}
            emptyMessage="No revenue data for this period"
          >
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} tickFormatter={(v) => `$${v/1000}k`} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                  formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Revenue']}
                />
                <Bar dataKey="revenue" name="Revenue" fill={CHART_COLORS.primary} radius={BAR_RADIUS_TOP} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>

        {/* Revenue by Service (Stacked) */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            Revenue by Service
          </h3>
          <ChartContainer
            isLoading={loadingRevenue}
            isError={revenueError}
            error={revenueErrorMsg}
            isEmpty={revenueByServiceData.length === 0}
            emptyMessage="No revenue data for this period"
          >
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueByServiceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} tickFormatter={(v) => `$${v/1000}k`} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
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
                    fill={SERVICE_COLORS[key] || CHART_COLORS.primary}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>

        {/* Enrollments by Service */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <PieChartIcon className="w-5 h-5 text-green-500" />
            Enrollments by Service
          </h3>
          <ChartContainer
            isLoading={loadingEnrollments}
            isError={enrollmentError}
            error={enrollmentErrorMsg}
            isEmpty={enrollmentData.length === 0}
            emptyMessage="No active enrollments"
          >
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
                  <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
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
          </ChartContainer>
        </div>

        {/* Outstanding Balance Aging */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            Outstanding Balance Aging
          </h3>
          <ChartContainer
            isLoading={loadingBalances}
            isError={balanceError}
            error={balanceErrorMsg}
            isEmpty={balanceData.every((d) => d.amount === 0)}
            emptyMessage="No outstanding balances!"
          >
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={balanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="bucket" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} tickFormatter={(v) => `$${v/1000}k`} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                  formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Amount']}
                />
                <Bar dataKey="amount" name="Amount" radius={BAR_RADIUS_TOP}>
                  {balanceData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.bucket === 'Current'
                          ? CHART_COLORS.secondary
                          : entry.bucket === '1-30 Days'
                          ? CHART_COLORS.accent
                          : entry.bucket === '31-60 Days'
                          ? '#f97316'
                          : CHART_COLORS.danger
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>

        {/* Revenue by Location */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 lg:col-span-2">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-500" />
            Revenue by Location
          </h3>
          <ChartContainer
            isLoading={loadingLocation}
            isError={locationError}
            error={locationErrorMsg}
            isEmpty={locationData.length === 0}
            emptyMessage="No revenue data for this period"
          >
            <div className="flex items-center gap-8">
              <ResponsiveContainer width="60%" height={280}>
                <BarChart data={locationData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} tickFormatter={(v) => `$${v/1000}k`} />
                  <YAxis dataKey="name" type="category" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} width={100} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    itemStyle={TOOLTIP_ITEM_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                    formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Revenue']}
                  />
                  <Bar dataKey="revenue" radius={BAR_RADIUS_RIGHT}>
                    {locationData.map((entry) => (
                      <Cell
                        key={`cell-${entry.code}`}
                        fill={LOCATION_COLORS[entry.code] || CHART_COLORS.primary}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="w-48 space-y-3">
                {locationData.map((entry) => (
                  <div key={entry.code} className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: LOCATION_COLORS[entry.code] || CHART_COLORS.primary }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-300 truncate">{entry.name}</p>
                      <p className="text-xs text-gray-500">{entry.enrollments} records</p>
                    </div>
                    <span className="text-sm font-medium text-white">${entry.revenue.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </ChartContainer>
        </div>

        {/* Teacher Payroll by Month */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 lg:col-span-2">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-500" />
            Teacher Payroll by Month
          </h3>
          <ChartContainer
            isLoading={loadingPayroll}
            isError={payrollError}
            error={payrollErrorMsg}
            isEmpty={payrollData.length === 0}
            emptyMessage="No payroll data for this period"
          >
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={payrollData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} tickFormatter={(v) => `$${v/1000}k`} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                  formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Payroll']}
                />
                <Legend wrapperStyle={{ color: '#9ca3af' }} />
                <Line
                  type="monotone"
                  dataKey="amount"
                  name="Payroll"
                  stroke={CHART_COLORS.purple}
                  strokeWidth={2}
                  dot={{ fill: CHART_COLORS.purple, strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
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
              {revenueData.length > 0 ? `${revenueData.length} month${revenueData.length !== 1 ? 's' : ''}` : '—'}
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
            <p className="text-gray-400 flex items-center gap-1">
              Net Cash Margin
              <span className="relative group">
                <Info className="w-3.5 h-3.5 text-gray-500 cursor-help" />
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs text-gray-200 bg-gray-800 border border-gray-600 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                  Invoice payments minus teacher payroll,<br />as % of collections. Both based on<br />invoice/payment dates.
                </span>
              </span>
            </p>
            <p className="text-xl font-bold text-green-500">
              {cashCollected > 0 && totalPayroll > 0
                ? `${Math.round(((cashCollected - totalPayroll) / cashCollected) * 100)}%`
                : '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}