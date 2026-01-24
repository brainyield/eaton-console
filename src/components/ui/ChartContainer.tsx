import { RefreshCw, AlertCircle } from 'lucide-react'
import { ResponsiveContainer } from 'recharts'
import type { ReactNode } from 'react'

interface ChartContainerProps {
  isLoading: boolean
  isError: boolean
  error?: Error | null
  isEmpty: boolean
  emptyMessage?: string
  height?: number
  width?: number | `${number}%`
  children: ReactNode
}

/**
 * ChartContainer - Wrapper component for Recharts charts
 * Handles loading, error, and empty states consistently across all charts
 */
export function ChartContainer({
  isLoading,
  isError,
  error,
  isEmpty,
  emptyMessage = 'No data available',
  height = 280,
  width = '100%',
  children,
}: ChartContainerProps) {
  const containerHeight = `h-${height === 280 ? '64' : `[${height}px]`}`
  const heightStyle = height === 280 ? undefined : { height: `${height}px` }

  if (isLoading) {
    return (
      <div className={`${containerHeight} flex items-center justify-center`} style={heightStyle}>
        <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className={`${containerHeight} flex items-center justify-center text-red-400`} style={heightStyle}>
        <AlertCircle className="w-5 h-5 mr-2" />
        {error instanceof Error ? error.message : 'Failed to load data'}
      </div>
    )
  }

  if (isEmpty) {
    return (
      <div className={`${containerHeight} flex items-center justify-center text-gray-500`} style={heightStyle}>
        {emptyMessage}
      </div>
    )
  }

  return (
    <ResponsiveContainer width={width} height={height}>
      {children}
    </ResponsiveContainer>
  )
}
