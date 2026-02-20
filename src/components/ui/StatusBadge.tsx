import type { CustomerStatus, EnrollmentStatus, InvoiceStatus, LeadStatus } from '../../lib/hooks'
import {
  CUSTOMER_STATUS_COLORS,
  CUSTOMER_STATUS_COLORS_WITH_BORDER,
  CUSTOMER_STATUS_LABELS,
  ENROLLMENT_STATUS_COLORS,
  ENROLLMENT_STATUS_COLORS_WITH_BORDER,
  ENROLLMENT_STATUS_LABELS,
  INVOICE_STATUS_COLORS,
  INVOICE_STATUS_LABELS,
  LEAD_STATUS_COLORS,
  LEAD_STATUS_COLORS_WITH_BORDER,
  LEAD_STATUS_LABELS,
} from './statusConstants'

// Re-export all constants for consumers that import from StatusBadge
export {
  CUSTOMER_STATUS_COLORS,
  CUSTOMER_STATUS_COLORS_WITH_BORDER,
  CUSTOMER_STATUS_LABELS,
  ENROLLMENT_STATUS_COLORS,
  ENROLLMENT_STATUS_COLORS_WITH_BORDER,
  ENROLLMENT_STATUS_LABELS,
  INVOICE_STATUS_COLORS,
  INVOICE_STATUS_LABELS,
  LEAD_STATUS_COLORS,
  LEAD_STATUS_COLORS_WITH_BORDER,
  LEAD_STATUS_LABELS,
} from './statusConstants'

export {
  LEAD_ENGAGEMENT_COLORS,
  LEAD_ENGAGEMENT_COLORS_WITH_BORDER,
  LEAD_TYPE_COLORS,
} from './statusConstants'

// =============================================================================
// STATUS BADGE COMPONENT
// =============================================================================

type StatusVariant = 'customer' | 'enrollment' | 'invoice' | 'lead'

interface StatusBadgeProps<T extends string> {
  status: T
  variant: StatusVariant
  size?: 'sm' | 'md'
  showBorder?: boolean
  className?: string
}

function getColorClass(variant: StatusVariant, status: string, showBorder: boolean): string {
  switch (variant) {
    case 'customer':
      return showBorder
        ? CUSTOMER_STATUS_COLORS_WITH_BORDER[status as CustomerStatus] || ''
        : CUSTOMER_STATUS_COLORS[status as CustomerStatus] || ''
    case 'enrollment':
      return showBorder
        ? ENROLLMENT_STATUS_COLORS_WITH_BORDER[status as EnrollmentStatus] || ''
        : ENROLLMENT_STATUS_COLORS[status as EnrollmentStatus] || ''
    case 'invoice':
      return INVOICE_STATUS_COLORS[status as InvoiceStatus] || ''
    case 'lead':
      return showBorder
        ? LEAD_STATUS_COLORS_WITH_BORDER[status as LeadStatus] || ''
        : LEAD_STATUS_COLORS[status as LeadStatus] || ''
    default:
      return 'bg-zinc-500/20 text-zinc-400'
  }
}

function getLabel(variant: StatusVariant, status: string): string {
  switch (variant) {
    case 'customer':
      return CUSTOMER_STATUS_LABELS[status as CustomerStatus] || status
    case 'enrollment':
      return ENROLLMENT_STATUS_LABELS[status as EnrollmentStatus] || status
    case 'invoice':
      return INVOICE_STATUS_LABELS[status as InvoiceStatus] || status
    case 'lead':
      return LEAD_STATUS_LABELS[status as LeadStatus] || status
    default:
      return status
  }
}

export function StatusBadge<T extends string>({
  status,
  variant,
  size = 'sm',
  showBorder = false,
  className = '',
}: StatusBadgeProps<T>) {
  const colorClass = getColorClass(variant, status, showBorder)
  const label = getLabel(variant, status)

  const sizeClasses = size === 'sm'
    ? 'text-xs px-2 py-0.5'
    : 'text-sm px-3 py-1'

  const borderClass = showBorder ? 'border' : ''

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${colorClass} ${sizeClasses} ${borderClass} ${className}`}
    >
      {label}
    </span>
  )
}
