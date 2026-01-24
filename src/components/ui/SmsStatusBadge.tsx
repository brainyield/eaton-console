import { Check, Clock, Send, AlertCircle, XCircle } from 'lucide-react'
import type { SmsStatus } from '../../lib/hooks'

interface SmsStatusBadgeProps {
  status: SmsStatus
  size?: 'sm' | 'md'
  showIcon?: boolean
}

const STATUS_CONFIG: Record<
  SmsStatus,
  {
    bg: string
    text: string
    label: string
    Icon: typeof Clock
  }
> = {
  pending: {
    bg: 'bg-zinc-600/20',
    text: 'text-zinc-400',
    label: 'Pending',
    Icon: Clock,
  },
  sent: {
    bg: 'bg-blue-600/20',
    text: 'text-blue-400',
    label: 'Sent',
    Icon: Send,
  },
  delivered: {
    bg: 'bg-green-600/20',
    text: 'text-green-400',
    label: 'Delivered',
    Icon: Check,
  },
  failed: {
    bg: 'bg-red-600/20',
    text: 'text-red-400',
    label: 'Failed',
    Icon: XCircle,
  },
  undelivered: {
    bg: 'bg-amber-600/20',
    text: 'text-amber-400',
    label: 'Undelivered',
    Icon: AlertCircle,
  },
}

export function SmsStatusBadge({ status, size = 'sm', showIcon = true }: SmsStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  const Icon = config.Icon

  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${config.bg} ${config.text} ${sizeClasses}`}
    >
      {showIcon && <Icon className={iconSize} aria-hidden="true" />}
      {config.label}
    </span>
  )
}
