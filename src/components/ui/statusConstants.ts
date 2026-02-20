import type { CustomerStatus, EnrollmentStatus, InvoiceStatus, LeadStatus } from '../../lib/hooks'

// =============================================================================
// STATUS COLOR CONSTANTS
// =============================================================================

export const CUSTOMER_STATUS_COLORS: Record<CustomerStatus, string> = {
  lead: 'bg-violet-500/20 text-violet-400',
  active: 'bg-green-500/20 text-green-400',
  trial: 'bg-blue-500/20 text-blue-400',
  paused: 'bg-amber-500/20 text-amber-400',
  churned: 'bg-red-500/20 text-red-400',
}

export const CUSTOMER_STATUS_COLORS_WITH_BORDER: Record<CustomerStatus, string> = {
  lead: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  trial: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  paused: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  churned: 'bg-red-500/20 text-red-400 border-red-500/30',
}

export const ENROLLMENT_STATUS_COLORS: Record<EnrollmentStatus, string> = {
  active: 'bg-green-500/20 text-green-400',
  trial: 'bg-blue-500/20 text-blue-400',
  paused: 'bg-amber-500/20 text-amber-400',
  ended: 'bg-zinc-500/20 text-zinc-400',
}

export const ENROLLMENT_STATUS_COLORS_WITH_BORDER: Record<EnrollmentStatus, string> = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  trial: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  paused: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  ended: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
}

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-zinc-500/20 text-zinc-400',
  sent: 'bg-blue-500/20 text-blue-400',
  paid: 'bg-green-500/20 text-green-400',
  partial: 'bg-amber-500/20 text-amber-400',
  overdue: 'bg-red-500/20 text-red-400',
  void: 'bg-zinc-500/20 text-zinc-500 line-through',
}

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-yellow-500/20 text-yellow-400',
  contacted: 'bg-blue-500/20 text-blue-400',
  converted: 'bg-green-500/20 text-green-400',
  closed: 'bg-zinc-500/20 text-zinc-400',
}

export const LEAD_STATUS_COLORS_WITH_BORDER: Record<LeadStatus, string> = {
  new: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  contacted: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  converted: 'bg-green-500/20 text-green-400 border-green-500/30',
  closed: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
}

export const LEAD_ENGAGEMENT_COLORS: Record<'cold' | 'warm' | 'hot', string> = {
  cold: 'bg-zinc-500/20 text-zinc-400',
  warm: 'bg-orange-500/20 text-orange-400',
  hot: 'bg-red-500/20 text-red-400',
}

export const LEAD_ENGAGEMENT_COLORS_WITH_BORDER: Record<'cold' | 'warm' | 'hot', string> = {
  cold: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  warm: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  hot: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
}

export const LEAD_TYPE_COLORS: Record<string, string> = {
  exit_intent: 'bg-purple-500/20 text-purple-400',
  waitlist: 'bg-green-500/20 text-green-400',
  calendly_call: 'bg-blue-500/20 text-blue-400',
  event: 'bg-orange-500/20 text-orange-400',
}

// Status label mappings
export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  lead: 'Lead',
  active: 'Active',
  trial: 'Trial',
  paused: 'Paused',
  churned: 'Churned',
}

export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  active: 'Active',
  trial: 'Trial',
  paused: 'Paused',
  ended: 'Ended',
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  partial: 'Partial',
  overdue: 'Overdue',
  void: 'Void',
}

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  converted: 'Converted',
  closed: 'Closed',
}
