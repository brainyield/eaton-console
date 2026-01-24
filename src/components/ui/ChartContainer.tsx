import { RefreshCw, AlertCircle } from 'lucide-react'
import type { ReactNode } from 'react'

interface ChartContainerProps {
  isLoading: boolean
  isError: boolean
  error?: Error | null
  isEmpty: boolean
  emptyMessage?: string
  height?: number
  children: ReactNode
}

/**
 * ChartContainer - Wrapper component for Recharts charts
 * Handles loading, error, and empty states consistently across all charts.
 * Children are rendered as-is when data is available - caller controls layout.
 */
export function ChartContainer({
  isLoading,
  isError,
  error,
  isEmpty,
  emptyMessage = 'No data available',
  height = 64,
  children,
}: ChartContainerProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ height: `${height * 4}px` }}>
        <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center text-red-400" style={{ height: `${height * 4}px` }}>
        <AlertCircle className="w-5 h-5 mr-2" />
        {error instanceof Error ? error.message : 'Failed to load data'}
      </div>
    )
  }

  if (isEmpty) {
    return (
      <div className="flex items-center justify-center text-gray-500" style={{ height: `${height * 4}px` }}>
        {emptyMessage}
      </div>
    )
  }

  return <>{children}</>
}
