/**
 * Chart theme constants for Recharts
 * Provides consistent dark-mode styling across all charts
 */

// Color palette for dark mode charts
export const CHART_COLORS = {
  primary: '#3b82f6',    // Blue
  secondary: '#10b981',  // Green
  accent: '#f59e0b',     // Amber
  danger: '#ef4444',     // Red
  purple: '#8b5cf6',
  pink: '#ec4899',
  cyan: '#06b6d4',
  orange: '#f97316',
}

// Color array for pie charts and multi-series data
export const PIE_COLORS = [
  CHART_COLORS.primary,
  CHART_COLORS.secondary,
  CHART_COLORS.accent,
  CHART_COLORS.purple,
  CHART_COLORS.pink,
  CHART_COLORS.cyan,
  CHART_COLORS.danger,
]

// Service-specific colors for revenue charts
export const SERVICE_COLORS: Record<string, string> = {
  academic_coaching: CHART_COLORS.primary,
  learning_pod: CHART_COLORS.secondary,
  consulting: CHART_COLORS.accent,
  eaton_online: CHART_COLORS.pink,
  eaton_hub: CHART_COLORS.cyan,
  elective_classes: CHART_COLORS.orange,
}

// Location-specific colors
export const LOCATION_COLORS: Record<string, string> = {
  kendall: CHART_COLORS.secondary,
  homestead: CHART_COLORS.primary,
  remote: CHART_COLORS.purple,
}

// Tooltip styling for dark mode (compatible with Recharts)
export const TOOLTIP_STYLE = {
  backgroundColor: '#1f2937',  // gray-800
  border: '1px solid #374151', // gray-700
  borderRadius: '8px',
  color: '#e5e7eb',            // gray-200
}

export const TOOLTIP_ITEM_STYLE = {
  color: '#e5e7eb',  // gray-200
}

export const TOOLTIP_LABEL_STYLE = {
  color: '#9ca3af',  // gray-400
}

// Axis styling
export const AXIS_STYLE = {
  stroke: '#9ca3af',  // gray-400
  tick: { fill: '#9ca3af' },
}

// Grid styling
export const GRID_STYLE = {
  strokeDasharray: '3 3',
  stroke: '#374151',  // gray-700
}

// Legend styling
export const LEGEND_STYLE = {
  wrapperStyle: { color: '#9ca3af' },  // gray-400
}

// Common bar chart radius for rounded corners
export const BAR_RADIUS_TOP: [number, number, number, number] = [4, 4, 0, 0]
export const BAR_RADIUS_RIGHT: [number, number, number, number] = [0, 4, 4, 0]

// Currency formatter for Y-axis
export const formatCurrencyAxis = (value: number): string => {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}k`
  }
  return `$${value}`
}

// Currency formatter for tooltips
export const formatCurrencyTooltip = (value: number): string => {
  return `$${Number(value).toLocaleString()}`
}
