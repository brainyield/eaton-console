import { useConversionAnalytics, type LeadType } from '../lib/hooks'
import { RefreshCw, TrendingUp, Users, Clock, Target } from 'lucide-react'

const leadTypeLabels: Record<LeadType, string> = {
  exit_intent: 'Exit Intent',
  waitlist: 'Waitlist',
  calendly_call: 'Calendly',
  event: 'Event',
}

const leadTypeColors: Record<LeadType, string> = {
  exit_intent: 'bg-purple-500',
  waitlist: 'bg-green-500',
  calendly_call: 'bg-blue-500',
  event: 'bg-orange-500',
}

export function ConversionAnalytics() {
  const { data: stats, isLoading, error } = useConversionAnalytics()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-400">Failed to load analytics data</p>
      </div>
    )
  }

  const maxBarValue = Math.max(...stats.monthlyTrend.map(m => m.leads), 1)

  return (
    <div className="p-6 space-y-6 overflow-auto">
      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-zinc-800/50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{stats.totalLeads}</p>
              <p className="text-sm text-zinc-400">Total Leads</p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-800/50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Target className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{stats.convertedLeads}</p>
              <p className="text-sm text-zinc-400">Converted</p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-800/50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{stats.conversionRate}%</p>
              <p className="text-sm text-zinc-400">Conversion Rate</p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-800/50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Clock className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{stats.avgDaysToConvert}</p>
              <p className="text-sm text-zinc-400">Avg Days to Convert</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Conversion Funnel */}
        <div className="bg-zinc-800/50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-zinc-400 mb-4">Lead Funnel</h3>
          <div className="space-y-3">
            {[
              { label: 'New', value: stats.funnel.new, color: 'bg-yellow-500' },
              { label: 'Contacted', value: stats.funnel.contacted, color: 'bg-blue-500' },
              { label: 'Converted', value: stats.funnel.converted, color: 'bg-green-500' },
              { label: 'Closed', value: stats.funnel.closed, color: 'bg-zinc-500' },
            ].map((stage) => {
              const percentage = stats.totalLeads > 0 ? (stage.value / stats.totalLeads) * 100 : 0
              return (
                <div key={stage.label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-300">{stage.label}</span>
                    <span className="text-zinc-400">{stage.value} ({percentage.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${stage.color} rounded-full transition-all`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Conversion by Lead Type */}
        <div className="bg-zinc-800/50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-zinc-400 mb-4">Conversion by Source</h3>
          {stats.byLeadType.length === 0 ? (
            <p className="text-zinc-500 text-sm">No data available</p>
          ) : (
            <div className="space-y-3">
              {stats.byLeadType.map((item) => (
                <div key={item.type} className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${leadTypeColors[item.type]}`} />
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-zinc-300">{leadTypeLabels[item.type]}</span>
                      <span className="text-zinc-400">
                        {item.converted}/{item.total} ({item.rate}%)
                      </span>
                    </div>
                    <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${leadTypeColors[item.type]} rounded-full`}
                        style={{ width: `${item.rate}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <div className="bg-zinc-800/50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-zinc-400 mb-4">Monthly Trend (Last 6 Months)</h3>
          <div className="flex items-end gap-2 h-32">
            {stats.monthlyTrend.map((month) => (
              <div key={month.month} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col items-center gap-0.5" style={{ height: '100px' }}>
                  {/* Conversions bar */}
                  <div
                    className="w-full bg-green-500/80 rounded-t"
                    style={{
                      height: `${maxBarValue > 0 ? (month.conversions / maxBarValue) * 100 : 0}%`,
                      minHeight: month.conversions > 0 ? '4px' : '0',
                    }}
                    title={`${month.conversions} conversions`}
                  />
                  {/* Leads bar (remaining) */}
                  <div
                    className="w-full bg-blue-500/50 rounded-b"
                    style={{
                      height: `${maxBarValue > 0 ? ((month.leads - month.conversions) / maxBarValue) * 100 : 0}%`,
                      minHeight: (month.leads - month.conversions) > 0 ? '4px' : '0',
                    }}
                    title={`${month.leads} total leads`}
                  />
                </div>
                <span className="text-[10px] text-zinc-500">{month.month}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-4 mt-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500/80 rounded" /> Conversions
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-blue-500/50 rounded" /> New Leads
            </span>
          </div>
        </div>

        {/* Top Sources */}
        <div className="bg-zinc-800/50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-zinc-400 mb-4">Top Converting Sources</h3>
          {stats.topSources.length === 0 ? (
            <p className="text-zinc-500 text-sm">No conversions yet</p>
          ) : (
            <div className="space-y-2">
              {stats.topSources.map((source, idx) => (
                <div key={source.source} className="flex items-center gap-3">
                  <span className="text-zinc-500 text-sm w-4">{idx + 1}.</span>
                  <span className="flex-1 text-sm text-zinc-300 truncate">{source.source}</span>
                  <span className="text-sm font-medium text-white">{source.conversions}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
