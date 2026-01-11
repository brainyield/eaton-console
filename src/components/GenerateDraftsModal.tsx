import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  X,
  AlertTriangle,
  Check,
  Loader2,
  ChevronUp,
  ChevronDown,
  Edit2,
  Link2,
} from 'lucide-react'
import {
  useBillableEnrollments,
  useExistingInvoicesForPeriod,
  useInvoiceMutations,
  usePendingEventOrders,
  usePendingClassRegistrationFees,
  usePendingHubSessions,
  getWeekBounds,
  getNextMonday,
} from '../lib/hooks'
import type { BillableEnrollment, PendingEventOrder, PendingClassRegistrationFee, PendingHubSession } from '../lib/hooks'
import { multiplyMoney, sumMoney, centsToDollars } from '../lib/moneyUtils'
import { useToast } from '../lib/toast'
import { LinkEventOrdersModal } from './LinkEventOrdersModal'
import { LinkHubBookingsModal } from './LinkHubBookingsModal'

// ============================================================================
// Types
// ============================================================================

type InvoiceType = 'weekly' | 'monthly' | 'events' | 'hub'
type SortField = 'family' | 'amount'
type SortDirection = 'asc' | 'desc'

interface DraftPreviewItem {
  enrollment: BillableEnrollment
  selected: boolean
  hasExisting: boolean
  baseAmount: number      // Original calculated amount
  quantity: number        // Multiplier (weeks, sessions, etc.)
  unitPrice: number       // Per-unit price
  finalAmount: number     // quantity × unitPrice
  description: string
  isEdited: boolean       // Has custom override
}

interface LineItemOverride {
  quantity?: number
  unit_price?: number
  description_override?: string
}

// ============================================================================
// Service Badge (inline for this modal)
// ============================================================================

const SERVICE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  academic_coaching: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'AC' },
  learning_pod: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Pod' },
  consulting: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Consult' },
  eaton_hub: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Hub' },
  eaton_online: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', label: 'Online' },
  elective_classes: { bg: 'bg-pink-500/20', text: 'text-pink-400', label: 'Elective' },
}

function ServiceBadge({ code }: { code: string }) {
  const config = SERVICE_COLORS[code] || { bg: 'bg-zinc-500/20', text: 'text-zinc-400', label: code }
  return (
    <span className={`inline-flex px-1.5 py-0.5 text-xs font-medium rounded ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  )
}

// ============================================================================
// Helper Functions
// ============================================================================

function getBaseValues(enrollment: BillableEnrollment): { quantity: number; unitPrice: number } {
  const service = enrollment.service
  const serviceCode = service?.code
  const billingFreq = service?.billing_frequency

  // Academic Coaching: hours × rate
  if (serviceCode === 'academic_coaching') {
    return {
      quantity: enrollment.hours_per_week || 0,
      unitPrice: enrollment.hourly_rate_customer || 0,
    }
  }

  // Eaton Online: weekly tuition
  if (serviceCode === 'eaton_online' || billingFreq === 'weekly') {
    return {
      quantity: 1,
      unitPrice: enrollment.weekly_tuition || 0,
    }
  }

  // Hub: daily rate (per session)
  if (serviceCode === 'eaton_hub' || billingFreq === 'per_session') {
    return {
      quantity: 1,
      unitPrice: enrollment.daily_rate || 100,
    }
  }

  // Learning Pod: use daily_rate (per session)
  if (serviceCode === 'learning_pod') {
    return {
      quantity: 1,
      unitPrice: enrollment.daily_rate || 0,
    }
  }

  // Everything else: monthly rate
  return {
    quantity: 1,
    unitPrice: enrollment.monthly_rate || 0,
  }
}

function formatDate(date: Date): string {
  // Use local date components to avoid timezone shift when converting to YYYY-MM-DD
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getMonthBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return { start, end }
}

// ============================================================================
// Component
// ============================================================================

interface Props {
  onClose: () => void
  onSuccess: () => void
}

export default function GenerateDraftsModal({ onClose, onSuccess }: Props) {
  const { showError, showSuccess, showWarning } = useToast()

  // State
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('weekly')
  const [periodStart, setPeriodStart] = useState<string>('')
  const [periodEnd, setPeriodEnd] = useState<string>('')
  const [dueDate, setDueDate] = useState<string>('')
  const [periodNote, setPeriodNote] = useState<string>('')
  const [selectedEnrollments, setSelectedEnrollments] = useState<Set<string>>(new Set())
  const [serviceFilter, setServiceFilter] = useState<string>('')
  
  // NEW: Sorting state
  const [sortField, setSortField] = useState<SortField>('family')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  
  // NEW: Global multipliers for bulk edit
  const [globalWeeks, setGlobalWeeks] = useState<number>(1)
  const [globalSessions, setGlobalSessions] = useState<number>(4)
  
  // NEW: Per-enrollment overrides { enrollmentId: { quantity, unit_price } }
  const [overrides, setOverrides] = useState<Record<string, LineItemOverride>>({})
  
  // NEW: Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')

  // Events mode state
  const [selectedEventOrders, setSelectedEventOrders] = useState<Set<string>>(new Set())
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false)

  // Hub mode state
  const [selectedHubSessions, setSelectedHubSessions] = useState<Set<string>>(new Set())
  const [isHubLinkModalOpen, setIsHubLinkModalOpen] = useState(false)

  // Initialize dates based on invoice type
  useEffect(() => {
    const today = new Date()

    if (invoiceType === 'weekly') {
      // Get this week's bounds (Mon-Fri)
      const { start, end } = getWeekBounds(today)
      setPeriodStart(formatDate(start))
      setPeriodEnd(formatDate(end))

      // Due date is next Monday
      const nextMon = getNextMonday(end)
      setDueDate(formatDate(nextMon))

      // Note format
      const startStr = start.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
      const endStr = end.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
      setPeriodNote(`For the week of ${startStr} - ${endStr}`)

      // Reset global weeks
      setGlobalWeeks(1)

    } else if (invoiceType === 'monthly') {
      // Monthly: current month bounds
      const { start, end } = getMonthBounds(today)
      setPeriodStart(formatDate(start))
      setPeriodEnd(formatDate(end))

      // Due date is Monday after month ends
      const nextMon = getNextMonday(end)
      setDueDate(formatDate(nextMon))

      // Note format
      const monthYear = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      setPeriodNote(`For ${monthYear}`)

      // Reset global sessions
      setGlobalSessions(4)
    } else if (invoiceType === 'events') {
      // Events: no period, just due date
      setPeriodStart('')
      setPeriodEnd('')
      const nextMon = getNextMonday(today)
      setDueDate(formatDate(nextMon))
      setPeriodNote('Step Up Event Registrations')
    } else if (invoiceType === 'hub') {
      // Hub: no period, just due date
      setPeriodStart('')
      setPeriodEnd('')
      const nextMon = getNextMonday(today)
      setDueDate(formatDate(nextMon))
      setPeriodNote('Eaton Hub Sessions')
    }

    // Clear overrides and selections when switching type
    setOverrides({})
    setSelectedEventOrders(new Set())
    setSelectedHubSessions(new Set())
  }, [invoiceType])

  // Data fetching - fetch all active enrollments, filter by billing frequency below
  const { data: enrollments = [], isLoading: enrollmentsLoading } = useBillableEnrollments()

  const { data: existingInvoices = [] } = useExistingInvoicesForPeriod(periodStart, periodEnd)

  // Fetch pending event orders for events mode
  const { data: pendingEventOrders = [], isLoading: eventsLoading } = usePendingEventOrders()

  // Fetch pending class registration fees for monthly mode (Step Up elective class fees)
  const { data: pendingClassFees = [] } = usePendingClassRegistrationFees()

  // Fetch pending hub sessions for hub mode (from Calendly bookings)
  const { data: pendingHubSessions = [], isLoading: hubSessionsLoading } = usePendingHubSessions()

  const { generateDrafts, generateEventInvoice, generateHubInvoice } = useInvoiceMutations()

  // Build preview items with overrides applied
  const previewItems = useMemo(() => {
    const existingFamilyIds = new Set(existingInvoices.map(i => i.family_id))

    return enrollments
      .filter(e => {
        // Filter by invoice type (billing frequency)
        const billingFreq = e.service?.billing_frequency
        if (invoiceType === 'weekly' && billingFreq !== 'weekly') return false
        if (invoiceType === 'monthly' && billingFreq !== 'monthly') return false
        
        // Filter by specific service if selected
        if (serviceFilter && e.service?.code !== serviceFilter) return false
        // Only active families
        if (e.family?.status !== 'active') return false
        return true
      })
      .map(enrollment => {
        const { quantity: baseQuantity, unitPrice: baseUnitPrice } = getBaseValues(enrollment)
        const override = overrides[enrollment.id]
        
        // Apply global multipliers based on service type
        let quantity = baseQuantity
        let unitPrice = baseUnitPrice
        
        const serviceCode = enrollment.service?.code
        
        // For Eaton Online, apply global weeks multiplier
        if (serviceCode === 'eaton_online') {
          quantity = globalWeeks
        }
        
        // For Learning Pod, apply global sessions multiplier
        if (serviceCode === 'learning_pod') {
          quantity = globalSessions
        }
        
        // Apply individual override if exists (overrides global)
        if (override?.quantity !== undefined) {
          quantity = override.quantity
        }
        if (override?.unit_price !== undefined) {
          unitPrice = override.unit_price
        }
        
        const finalAmount = multiplyMoney(quantity, unitPrice)
        const baseAmount = multiplyMoney(baseQuantity, baseUnitPrice)
        const isEdited = override?.quantity !== undefined || override?.unit_price !== undefined
        
        return {
          enrollment,
          selected: selectedEnrollments.has(enrollment.id),
          hasExisting: existingFamilyIds.has(enrollment.family?.id || ''),
          baseAmount,
          quantity,
          unitPrice,
          finalAmount,
          description: buildDescription(enrollment, quantity, unitPrice),
          isEdited,
        }
      })
  }, [enrollments, existingInvoices, serviceFilter, selectedEnrollments, overrides, globalWeeks, globalSessions, invoiceType])

  // Sort preview items
  const sortedPreviewItems = useMemo(() => {
    const sorted = [...previewItems]
    sorted.sort((a, b) => {
      // Always put existing invoices last
      if (a.hasExisting !== b.hasExisting) return a.hasExisting ? 1 : -1
      
      let comparison = 0
      switch (sortField) {
        case 'family':
          comparison = (a.enrollment.family?.display_name || '').localeCompare(
            b.enrollment.family?.display_name || ''
          )
          break
        case 'amount':
          comparison = a.finalAmount - b.finalAmount
          break
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })
    return sorted
  }, [previewItems, sortField, sortDirection])

  // Auto-select non-existing enrollments when preview changes
  useEffect(() => {
    const autoSelect = new Set<string>()
    previewItems.forEach(item => {
      if (!item.hasExisting) {
        autoSelect.add(item.enrollment.id)
      }
    })
    setSelectedEnrollments(autoSelect)
  }, [previewItems.length]) // Only on count change to avoid infinite loop

  // Compute pending registration fees per family (only for monthly mode with elective classes)
  const pendingFeesByFamily = useMemo(() => {
    if (invoiceType !== 'monthly') return new Map<string, PendingClassRegistrationFee[]>()

    // Find families that have elective_classes enrollments
    const familiesWithElectives = new Set<string>()
    sortedPreviewItems.forEach(item => {
      if (item.enrollment.service?.code === 'elective_classes' && item.enrollment.family?.id) {
        familiesWithElectives.add(item.enrollment.family.id)
      }
    })

    // Group pending class fees by family (only for families with elective enrollments)
    const feesByFamily = new Map<string, PendingClassRegistrationFee[]>()
    pendingClassFees.forEach(fee => {
      if (familiesWithElectives.has(fee.family_id)) {
        if (!feesByFamily.has(fee.family_id)) {
          feesByFamily.set(fee.family_id, [])
        }
        feesByFamily.get(fee.family_id)!.push(fee)
      }
    })

    return feesByFamily
  }, [invoiceType, sortedPreviewItems, pendingClassFees])

  // Group by family for display
  const groupedByFamily = useMemo(() => {
    const grouped = new Map<string, DraftPreviewItem[]>()

    sortedPreviewItems.forEach(item => {
      const familyId = item.enrollment.family?.id || 'unknown'
      if (!grouped.has(familyId)) {
        grouped.set(familyId, [])
      }
      grouped.get(familyId)!.push(item)
    })

    return Array.from(grouped.entries()).map(([familyId, items]) => {
      // Get pending registration fees for this family
      const registrationFees = pendingFeesByFamily.get(familyId) || []
      const registrationFeesTotal = centsToDollars(registrationFees.reduce((sum, fee) => sum + fee.total_cents, 0))

      return {
        familyId,
        familyName: items[0].enrollment.family?.display_name || 'Unknown',
        items,
        registrationFees,
        totalAmount: sumMoney(items.filter(i => selectedEnrollments.has(i.enrollment.id)).map(i => i.finalAmount)) + registrationFeesTotal,
        hasExisting: items.some(i => i.hasExisting),
        allSelected: items.every(i => selectedEnrollments.has(i.enrollment.id)),
        someSelected: items.some(i => selectedEnrollments.has(i.enrollment.id)),
      }
    })
  }, [sortedPreviewItems, selectedEnrollments, pendingFeesByFamily])

  // Counts
  const selectedCount = selectedEnrollments.size

  // Calculate total registration fees for families with selected elective enrollments
  const totalRegistrationFees = useMemo(() => {
    if (invoiceType !== 'monthly') return 0

    // Get families that have selected elective_classes enrollments
    const selectedElectiveFamilies = new Set<string>()
    sortedPreviewItems.forEach(item => {
      if (
        item.enrollment.service?.code === 'elective_classes' &&
        selectedEnrollments.has(item.enrollment.id) &&
        item.enrollment.family?.id
      ) {
        selectedElectiveFamilies.add(item.enrollment.family.id)
      }
    })

    // Sum up registration fees for those families
    let total = 0
    pendingFeesByFamily.forEach((fees, familyId) => {
      if (selectedElectiveFamilies.has(familyId)) {
        total += centsToDollars(fees.reduce((sum, fee) => sum + fee.total_cents, 0))
      }
    })
    return total
  }, [invoiceType, sortedPreviewItems, selectedEnrollments, pendingFeesByFamily])

  const totalAmount = sumMoney(
    sortedPreviewItems.filter(i => selectedEnrollments.has(i.enrollment.id)).map(i => i.finalAmount)
  ) + totalRegistrationFees
  const familyCount = new Set(
    sortedPreviewItems
      .filter(i => selectedEnrollments.has(i.enrollment.id))
      .map(i => i.enrollment.family?.id)
  ).size

  // Handlers
  const handleToggleEnrollment = useCallback((id: string) => {
    setSelectedEnrollments(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleToggleFamily = useCallback((familyId: string) => {
    const familyEnrollments = sortedPreviewItems
      .filter(i => i.enrollment.family?.id === familyId)
      .map(i => i.enrollment.id)
    
    const allSelected = familyEnrollments.every(id => selectedEnrollments.has(id))
    
    setSelectedEnrollments(prev => {
      const next = new Set(prev)
      familyEnrollments.forEach(id => {
        if (allSelected) {
          next.delete(id)
        } else {
          next.add(id)
        }
      })
      return next
    })
  }, [sortedPreviewItems, selectedEnrollments])

  const handleSelectAll = useCallback(() => {
    if (selectedCount === sortedPreviewItems.filter(i => !i.hasExisting).length) {
      setSelectedEnrollments(new Set())
    } else {
      setSelectedEnrollments(new Set(
        sortedPreviewItems.filter(i => !i.hasExisting).map(i => i.enrollment.id)
      ))
    }
  }, [sortedPreviewItems, selectedCount])

  // ===========================================================================
  // Events Mode - Group pending event orders by family
  // ===========================================================================
  const eventOrdersByFamily = useMemo(() => {
    const grouped = new Map<string, PendingEventOrder[]>()

    pendingEventOrders.forEach(order => {
      const familyId = order.family_id || 'unlinked'
      if (!grouped.has(familyId)) {
        grouped.set(familyId, [])
      }
      grouped.get(familyId)!.push(order)
    })

    return Array.from(grouped.entries()).map(([familyId, orders]) => ({
      familyId,
      familyName: orders[0].family_name || orders[0].purchaser_name || 'Unknown',
      orders,
      totalAmount: centsToDollars(orders
        .filter(o => selectedEventOrders.has(o.id))
        .reduce((sum, o) => sum + o.total_cents, 0)),
      allSelected: orders.every(o => selectedEventOrders.has(o.id)),
      someSelected: orders.some(o => selectedEventOrders.has(o.id)),
    }))
  }, [pendingEventOrders, selectedEventOrders])

  // Unlinked orders (no family_id)
  const unlinkedOrders = useMemo(() => {
    return pendingEventOrders.filter(o => !o.family_id)
  }, [pendingEventOrders])

  // Event order counts
  const selectedEventCount = selectedEventOrders.size
  const eventTotalAmount = centsToDollars(pendingEventOrders
    .filter(o => selectedEventOrders.has(o.id))
    .reduce((sum, o) => sum + o.total_cents, 0))
  const eventFamilyCount = new Set(
    pendingEventOrders
      .filter(o => selectedEventOrders.has(o.id))
      .map(o => o.family_id)
  ).size

  // Event handlers
  const handleToggleEventOrder = useCallback((id: string) => {
    setSelectedEventOrders(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleToggleEventFamily = useCallback((familyId: string) => {
    const familyOrders = pendingEventOrders
      .filter(o => (o.family_id || 'unlinked') === familyId)
      .map(o => o.id)

    const allSelected = familyOrders.every(id => selectedEventOrders.has(id))

    setSelectedEventOrders(prev => {
      const next = new Set(prev)
      familyOrders.forEach(id => {
        if (allSelected) {
          next.delete(id)
        } else {
          next.add(id)
        }
      })
      return next
    })
  }, [pendingEventOrders, selectedEventOrders])

  const handleSelectAllEvents = useCallback(() => {
    if (selectedEventCount === pendingEventOrders.length) {
      setSelectedEventOrders(new Set())
    } else {
      setSelectedEventOrders(new Set(pendingEventOrders.map(o => o.id)))
    }
  }, [pendingEventOrders, selectedEventCount])

  // ===========================================================================
  // Hub Mode - Group pending hub sessions by family
  // ===========================================================================
  const hubSessionsByFamily = useMemo(() => {
    const grouped = new Map<string, PendingHubSession[]>()

    pendingHubSessions.forEach(session => {
      const familyId = session.family_id || 'unlinked'
      if (!grouped.has(familyId)) {
        grouped.set(familyId, [])
      }
      grouped.get(familyId)!.push(session)
    })

    return Array.from(grouped.entries()).map(([familyId, sessions]) => ({
      familyId,
      familyName: sessions[0].family_name,
      sessions,
      totalAmount: sessions
        .filter(s => selectedHubSessions.has(s.id))
        .reduce((sum, s) => sum + s.daily_rate, 0),
      allSelected: sessions.every(s => selectedHubSessions.has(s.id)),
      someSelected: sessions.some(s => selectedHubSessions.has(s.id)),
    }))
  }, [pendingHubSessions, selectedHubSessions])

  // Unlinked hub bookings (no family_id)
  const unlinkedHubBookings = useMemo(() => {
    return pendingHubSessions.filter(s => !s.family_id)
  }, [pendingHubSessions])

  // Hub session counts
  const selectedHubCount = selectedHubSessions.size
  const hubTotalAmount = pendingHubSessions
    .filter(s => selectedHubSessions.has(s.id))
    .reduce((sum, s) => sum + s.daily_rate, 0)
  const hubFamilyCount = new Set(
    pendingHubSessions
      .filter(s => selectedHubSessions.has(s.id))
      .map(s => s.family_id)
  ).size

  // Hub handlers
  const handleToggleHubSession = useCallback((id: string) => {
    setSelectedHubSessions(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleToggleHubFamily = useCallback((familyId: string) => {
    const familySessions = pendingHubSessions
      .filter(s => s.family_id === familyId)
      .map(s => s.id)

    const allSelected = familySessions.every(id => selectedHubSessions.has(id))

    setSelectedHubSessions(prev => {
      const next = new Set(prev)
      familySessions.forEach(id => {
        if (allSelected) {
          next.delete(id)
        } else {
          next.add(id)
        }
      })
      return next
    })
  }, [pendingHubSessions, selectedHubSessions])

  const handleSelectAllHub = useCallback(() => {
    if (selectedHubCount === pendingHubSessions.length) {
      setSelectedHubSessions(new Set())
    } else {
      setSelectedHubSessions(new Set(pendingHubSessions.map(s => s.id)))
    }
  }, [pendingHubSessions, selectedHubCount])

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }, [sortField])

  // Inline amount editing
  const startEdit = useCallback((item: DraftPreviewItem) => {
    setEditingId(item.enrollment.id)
    setEditValue(item.finalAmount.toFixed(2))
  }, [])

  const saveEdit = useCallback(() => {
    if (!editingId) return
    
    const newAmount = parseFloat(editValue)
    if (Number.isNaN(newAmount) || newAmount < 0) {
      setEditingId(null)
      return
    }
    
    // Find the item to get current quantity
    const item = sortedPreviewItems.find(i => i.enrollment.id === editingId)
    if (!item) {
      setEditingId(null)
      return
    }
    
    // Calculate what unit_price would give this amount
    const newUnitPrice = item.quantity > 0 ? Math.round((newAmount / item.quantity) * 100) / 100 : newAmount
    
    setOverrides(prev => ({
      ...prev,
      [editingId]: {
        ...prev[editingId],
        unit_price: newUnitPrice,
      },
    }))
    
    setEditingId(null)
  }, [editingId, editValue, sortedPreviewItems])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditValue('')
  }, [])

  // Clear override for an item
  const clearOverride = useCallback((enrollmentId: string) => {
    setOverrides(prev => {
      const next = { ...prev }
      delete next[enrollmentId]
      return next
    })
  }, [])

  // FIX: Updated handleGenerate to use correct mutation parameter format
  const handleGenerate = useCallback(async () => {
    if (selectedCount === 0) return

    try {
      // Get selected enrollments as full BillableEnrollment objects
      const selectedEnrollmentsList = sortedPreviewItems
        .filter(item => selectedEnrollments.has(item.enrollment.id))
        .map(item => item.enrollment)
      
      // Build customAmounts for the mutation (correct format)
      const customAmounts: Record<string, { quantity: number; unitPrice: number; amount: number }> = {}
      
      sortedPreviewItems
        .filter(item => selectedEnrollments.has(item.enrollment.id))
        .forEach(item => {
          const { quantity: baseQuantity, unitPrice: baseUnitPrice } = getBaseValues(item.enrollment)
          
          // Only include override if values differ from base
          if (item.quantity !== baseQuantity || item.unitPrice !== baseUnitPrice) {
            customAmounts[item.enrollment.id] = {
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              amount: item.finalAmount,
            }
          }
        })

      // FIX: Use correct camelCase property names and pass enrollments array
      await generateDrafts.mutateAsync({
        enrollments: selectedEnrollmentsList,
        periodStart,
        periodEnd,
        dueDate,
        invoiceType: invoiceType as 'weekly' | 'monthly' | 'events',
        customAmounts: Object.keys(customAmounts).length > 0 ? customAmounts : undefined,
      })
      onSuccess()
    } catch (error) {
      console.error('Failed to generate drafts:', error)
      showError(error instanceof Error ? error.message : 'Failed to generate drafts')
    }
  }, [selectedCount, generateDrafts, periodStart, periodEnd, dueDate, selectedEnrollments, invoiceType, sortedPreviewItems, onSuccess, showError])

  // Generate event invoices - one invoice per family
  const handleGenerateEvents = useCallback(async () => {
    if (selectedEventCount === 0) return

    // Track successes and failures
    const succeeded: string[] = []
    const failed: string[] = []

    // Group selected orders by family
    const ordersByFamily = new Map<string, PendingEventOrder[]>()
    pendingEventOrders
      .filter(o => selectedEventOrders.has(o.id))
      .forEach(order => {
        const familyId = order.family_id || 'unlinked'
        if (!ordersByFamily.has(familyId)) {
          ordersByFamily.set(familyId, [])
        }
        ordersByFamily.get(familyId)!.push(order)
      })

    // Create one invoice per family
    for (const [familyId, orders] of ordersByFamily) {
      const familyName = orders[0].family_name || orders[0].purchaser_name || 'Unknown'

      if (familyId === 'unlinked') {
        failed.push(`Unlinked: ${orders.map(o => o.event_title).join(', ')}`)
        continue
      }

      try {
        await generateEventInvoice.mutateAsync({
          familyId,
          familyName,
          orderIds: orders.map(o => o.id),
          orders: orders.map(o => ({
            id: o.id,
            event_title: o.event_title,
            event_date: o.event_date,
            total_cents: o.total_cents,
          })),
          dueDate,
        })
        succeeded.push(familyName)
      } catch (error) {
        console.error(`Failed to generate invoice for ${familyName}:`, error)
        failed.push(familyName)
      }
    }

    // Report results
    if (failed.length > 0) {
      if (succeeded.length > 0) {
        showWarning(`Generated ${succeeded.length} invoice(s). ${failed.length} failed.`)
      } else {
        showError(`Failed to generate ${failed.length} invoice(s)`)
      }
    } else if (succeeded.length > 0) {
      showSuccess(`Generated ${succeeded.length} invoice(s)`)
    }

    // Only call onSuccess if at least one succeeded
    if (succeeded.length > 0) {
      onSuccess()
    }
  }, [selectedEventCount, pendingEventOrders, selectedEventOrders, generateEventInvoice, dueDate, onSuccess, showError, showSuccess, showWarning])

  // Generate hub invoices - one invoice per family
  const handleGenerateHub = useCallback(async () => {
    if (selectedHubCount === 0) return

    // Track successes and failures
    const succeeded: string[] = []
    const failed: string[] = []

    // Group selected bookings by family (skip those without family_id)
    const bookingsByFamily = new Map<string, PendingHubSession[]>()
    pendingHubSessions
      .filter(s => selectedHubSessions.has(s.id))
      .forEach(booking => {
        if (!booking.family_id) {
          failed.push(`Unlinked: ${booking.student_name}`)
          return
        }
        if (!bookingsByFamily.has(booking.family_id)) {
          bookingsByFamily.set(booking.family_id, [])
        }
        bookingsByFamily.get(booking.family_id)!.push(booking)
      })

    // Create one invoice per family
    for (const [familyId, bookings] of bookingsByFamily) {
      const familyName = bookings[0].family_name

      try {
        await generateHubInvoice.mutateAsync({
          familyId,
          bookings: bookings.map(b => ({
            id: b.id,
            student_name: b.student_name,
            session_date: b.session_date,
            daily_rate: b.daily_rate,
          })),
          dueDate,
        })
        succeeded.push(familyName)
      } catch (error) {
        console.error(`Failed to generate invoice for ${familyName}:`, error)
        failed.push(familyName)
      }
    }

    // Report results
    if (failed.length > 0) {
      if (succeeded.length > 0) {
        showWarning(`Generated ${succeeded.length} invoice(s). ${failed.length} failed.`)
      } else {
        showError(`Failed to generate ${failed.length} invoice(s)`)
      }
    } else if (succeeded.length > 0) {
      showSuccess(`Generated ${succeeded.length} invoice(s)`)
    }

    // Only call onSuccess if at least one succeeded
    if (succeeded.length > 0) {
      onSuccess()
    }
  }, [selectedHubCount, pendingHubSessions, selectedHubSessions, generateHubInvoice, dueDate, onSuccess, showError, showSuccess, showWarning])

  // Service filter options based on invoice type
  const serviceOptions = invoiceType === 'weekly'
    ? [
        { value: '', label: 'All Weekly Services' },
        { value: 'academic_coaching', label: 'Academic Coaching' },
        { value: 'eaton_online', label: 'Eaton Online' },
      ]
    : [
        { value: '', label: 'All Monthly Services' },
        { value: 'learning_pod', label: 'Learning Pod' },
        { value: 'consulting', label: 'Consulting' },
        { value: 'elective_classes', label: 'Elective Classes' },
      ]

  const existingCount = sortedPreviewItems.filter(i => i.hasExisting).length
  
  // Show multiplier controls based on service filter or if those services exist in list
  const hasEatonOnline = sortedPreviewItems.some(i => i.enrollment.service?.code === 'eaton_online')
  const hasLearningPod = sortedPreviewItems.some(i => i.enrollment.service?.code === 'learning_pod')
  const showWeeksControl = invoiceType === 'weekly' && (serviceFilter === 'eaton_online' || (!serviceFilter && hasEatonOnline))
  const showSessionsControl = invoiceType === 'monthly' && (serviceFilter === 'learning_pod' || (!serviceFilter && hasLearningPod))

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/60" onClick={onClose} />

        {/* Modal */}
        <div className="relative bg-zinc-900 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700">
            <h2 className="text-xl font-semibold text-white">Generate Invoice Drafts</h2>
            <button
              onClick={onClose}
              className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Configuration */}
          <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-800/30">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Invoice Type */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Invoice Type
                </label>
                <select
                  value={invoiceType}
                  onChange={e => {
                    setInvoiceType(e.target.value as InvoiceType)
                    setServiceFilter('')
                  }}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-zinc-500"
                >
                  <option value="weekly">Weekly (AC, Online)</option>
                  <option value="monthly">Monthly (Pod, Consult, etc.)</option>
                  <option value="hub">Hub Sessions (Calendly)</option>
                  <option value="events">Events (Step Up)</option>
                </select>
              </div>

              {/* Period Start - only for weekly/monthly */}
              {invoiceType !== 'events' && invoiceType !== 'hub' && (
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Period Start
                  </label>
                  <input
                    type="date"
                    value={periodStart}
                    onChange={e => setPeriodStart(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-zinc-500"
                  />
                </div>
              )}

              {/* Period End - only for weekly/monthly */}
              {invoiceType !== 'events' && invoiceType !== 'hub' && (
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Period End
                  </label>
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={e => setPeriodEnd(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-zinc-500"
                  />
                </div>
              )}

              {/* Due Date */}
              <div className={invoiceType === 'events' || invoiceType === 'hub' ? 'col-span-2' : ''}>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-zinc-500"
                />
              </div>
            </div>

            {/* Note and Service Filter */}
            <div className={`grid gap-4 mt-4 ${invoiceType === 'events' || invoiceType === 'hub' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Invoice Note
                </label>
                <input
                  type="text"
                  value={periodNote}
                  onChange={e => setPeriodNote(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-zinc-500"
                  placeholder={invoiceType === 'events' ? 'Step Up Event Registrations' : invoiceType === 'hub' ? 'Eaton Hub Sessions' : 'e.g., For the week of 12/23/2025 - 12/27/2025'}
                />
              </div>

              {invoiceType !== 'events' && invoiceType !== 'hub' && (
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Filter by Service
                  </label>
                  <select
                    value={serviceFilter}
                    onChange={e => setServiceFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-zinc-500"
                  >
                    {serviceOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Bulk Multiplier Controls - only for weekly/monthly */}
            {invoiceType !== 'events' && invoiceType !== 'hub' && (showWeeksControl || showSessionsControl) && (
              <div className="mt-4 p-3 bg-zinc-900/50 rounded-lg border border-zinc-700">
                <div className="flex items-center gap-4">
                  {showWeeksControl && (
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-zinc-400">
                        Weeks to bill (Eaton Online):
                      </label>
                      <select
                        value={globalWeeks}
                        onChange={e => setGlobalWeeks(parseInt(e.target.value, 10) || 1)}
                        className="px-2 py-1 bg-zinc-800 border border-zinc-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                      >
                        {[1, 2, 3, 4, 5].map(n => (
                          <option key={n} value={n}>{n} week{n > 1 ? 's' : ''}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  {showSessionsControl && (
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-zinc-400">
                        Sessions this month (Learning Pod):
                      </label>
                      <select
                        value={globalSessions}
                        onChange={e => setGlobalSessions(parseInt(e.target.value, 10) || 4)}
                        className="px-2 py-1 bg-zinc-800 border border-zinc-600 rounded text-white text-sm focus:outline-none focus:border-green-500"
                      >
                        {[2, 3, 4, 5].map(n => (
                          <option key={n} value={n}>{n} sessions</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Preview Header with Sort Controls */}
          <div className="px-6 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-800/20">
            <div className="flex items-center gap-4">
              <span className="text-sm text-zinc-400">
                {invoiceType === 'hub' ? (
                  hubSessionsLoading ? 'Loading...' : (
                    <>
                      <span className="text-white font-medium">{hubFamilyCount}</span> families,{' '}
                      <span className="text-white font-medium">{selectedHubCount}</span> hub sessions selected
                    </>
                  )
                ) : invoiceType === 'events' ? (
                  eventsLoading ? 'Loading...' : (
                    <>
                      <span className="text-white font-medium">{eventFamilyCount}</span> families,{' '}
                      <span className="text-white font-medium">{selectedEventCount}</span> event orders selected
                    </>
                  )
                ) : (
                  enrollmentsLoading ? 'Loading...' : (
                    <>
                      <span className="text-white font-medium">{familyCount}</span> families,{' '}
                      <span className="text-white font-medium">{selectedCount}</span> enrollments selected
                    </>
                  )
                )}
              </span>
              {invoiceType !== 'events' && invoiceType !== 'hub' && existingCount > 0 && (
                <span className="flex items-center gap-1 text-xs text-amber-400">
                  <AlertTriangle className="w-3 h-3" />
                  {existingCount} already have invoices for this period
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              {/* Sort Controls - only for enrollments */}
              {invoiceType !== 'events' && invoiceType !== 'hub' && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-500">Sort:</span>
                  <button
                    onClick={() => handleSort('family')}
                    className={`flex items-center gap-1 px-2 py-1 rounded ${sortField === 'family' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
                  >
                    Name
                    {sortField === 'family' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </button>
                  <button
                    onClick={() => handleSort('amount')}
                    className={`flex items-center gap-1 px-2 py-1 rounded ${sortField === 'amount' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
                  >
                    Amount
                    {sortField === 'amount' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </button>
                </div>
              )}

              <button
                onClick={invoiceType === 'hub' ? handleSelectAllHub : invoiceType === 'events' ? handleSelectAllEvents : handleSelectAll}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                {invoiceType === 'hub'
                  ? (selectedHubCount === pendingHubSessions.length ? 'Deselect All' : 'Select All')
                  : invoiceType === 'events'
                  ? (selectedEventCount === pendingEventOrders.length ? 'Deselect All' : 'Select All')
                  : (selectedCount === sortedPreviewItems.filter(i => !i.hasExisting).length ? 'Deselect All' : 'Select All')
                }
              </button>
            </div>
          </div>

          {/* Preview List */}
          <div className="flex-1 overflow-y-auto px-6 py-4 min-h-[300px] max-h-[400px]">
            {/* ============================================================ */}
            {/* Events Mode Content */}
            {/* ============================================================ */}
            {invoiceType === 'events' ? (
              eventsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
                </div>
              ) : pendingEventOrders.length === 0 ? (
                <div className="flex items-center justify-center h-full text-zinc-500">
                  No pending Step Up event registrations found
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Unlinked orders banner */}
                  {unlinkedOrders.length > 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          <span className="text-amber-200 text-sm">
                            {unlinkedOrders.length} order{unlinkedOrders.length !== 1 ? 's' : ''} not linked to a family
                          </span>
                        </div>
                        <button
                          onClick={() => setIsLinkModalOpen(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
                        >
                          <Link2 className="w-4 h-4" />
                          Link to Family
                        </button>
                      </div>
                    </div>
                  )}

                  {eventOrdersByFamily.map(group => (
                    <div
                      key={group.familyId}
                      className={`border rounded-lg overflow-hidden ${
                        group.familyId === 'unlinked'
                          ? 'border-red-500/30 bg-red-500/5'
                          : 'border-zinc-700 bg-zinc-800/30'
                      }`}
                    >
                      {/* Family Header */}
                      <div
                        className="flex items-center justify-between px-4 py-2 bg-zinc-800/50 cursor-pointer"
                        onClick={() => handleToggleEventFamily(group.familyId)}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={group.allSelected}
                            onChange={() => handleToggleEventFamily(group.familyId)}
                            onClick={e => e.stopPropagation()}
                            disabled={group.familyId === 'unlinked'}
                            className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-zinc-900 disabled:opacity-50"
                          />
                          <span className="font-medium text-white">{group.familyName}</span>
                          {group.familyId === 'unlinked' && (
                            <span className="flex items-center gap-1 text-xs text-red-400">
                              <AlertTriangle className="w-3 h-3" />
                              Not linked to family
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-zinc-400">
                          ${group.totalAmount.toFixed(2)}
                        </span>
                      </div>

                      {/* Event Orders */}
                      <div className="divide-y divide-zinc-800">
                        {group.orders.map(order => (
                          <div
                            key={order.id}
                            className={`flex items-center justify-between px-4 py-2 ${
                              group.familyId === 'unlinked' ? 'opacity-50' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={selectedEventOrders.has(order.id)}
                                onChange={() => handleToggleEventOrder(order.id)}
                                disabled={group.familyId === 'unlinked'}
                                className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-zinc-900 disabled:opacity-50"
                              />
                              <span className={`inline-flex px-1.5 py-0.5 text-xs font-medium rounded ${
                                order.event_type === 'class'
                                  ? 'bg-pink-500/20 text-pink-400'
                                  : 'bg-purple-500/20 text-purple-400'
                              }`}>
                                {order.event_type === 'class' ? 'Class' : 'Event'}
                              </span>
                              <div className="flex flex-col">
                                <span className="text-sm text-zinc-300">
                                  {order.event_title}
                                </span>
                                <span className="text-xs text-zinc-500">
                                  {order.event_date ? new Date(order.event_date).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  }) : 'No date'}
                                  {order.quantity > 1 && ` • ${order.quantity} tickets`}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-white">
                                ${(order.total_cents / 100).toFixed(2)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : invoiceType === 'hub' ? (
              /* ============================================================ */
              /* Hub Mode Content */
              /* ============================================================ */
              hubSessionsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
                </div>
              ) : pendingHubSessions.length === 0 ? (
                <div className="flex items-center justify-center h-full text-zinc-500">
                  No pending Hub sessions found
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Unlinked bookings banner */}
                  {unlinkedHubBookings.length > 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          <span className="text-amber-200 text-sm">
                            {unlinkedHubBookings.length} booking{unlinkedHubBookings.length !== 1 ? 's' : ''} not linked to a family
                          </span>
                        </div>
                        <button
                          onClick={() => setIsHubLinkModalOpen(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
                        >
                          <Link2 className="w-4 h-4" />
                          Link to Family
                        </button>
                      </div>
                    </div>
                  )}

                  {hubSessionsByFamily.map(group => (
                    <div
                      key={group.familyId}
                      className={`border rounded-lg overflow-hidden ${
                        group.familyId === 'unlinked'
                          ? 'border-red-500/30 bg-red-500/5'
                          : 'border-zinc-700 bg-zinc-800/30'
                      }`}
                    >
                      {/* Family Header */}
                      <div
                        className="flex items-center justify-between px-4 py-2 bg-zinc-800/50 cursor-pointer"
                        onClick={() => handleToggleHubFamily(group.familyId)}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={group.allSelected}
                            onChange={() => handleToggleHubFamily(group.familyId)}
                            onClick={e => e.stopPropagation()}
                            disabled={group.familyId === 'unlinked'}
                            className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-zinc-900 disabled:opacity-50"
                          />
                          <span className="font-medium text-white">
                            {group.familyId === 'unlinked' ? 'Unlinked Bookings' : group.familyName}
                          </span>
                        </div>
                        <span className="text-sm text-zinc-400">
                          ${group.totalAmount.toFixed(2)}
                        </span>
                      </div>

                      {/* Hub Sessions */}
                      <div className="divide-y divide-zinc-800">
                        {group.sessions.map(session => (
                          <div
                            key={session.id}
                            className="flex items-center justify-between px-4 py-2"
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={selectedHubSessions.has(session.id)}
                                onChange={() => handleToggleHubSession(session.id)}
                                disabled={group.familyId === 'unlinked'}
                                className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-zinc-900 disabled:opacity-50"
                              />
                              <span className="inline-flex px-1.5 py-0.5 text-xs font-medium rounded bg-amber-500/20 text-amber-400">
                                Hub
                              </span>
                              <div className="flex flex-col">
                                <span className="text-sm text-zinc-300">
                                  {session.student_name}
                                </span>
                                <span className="text-xs text-zinc-500">
                                  {new Date(session.session_date).toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-white">
                                ${session.daily_rate.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              /* ============================================================ */
              /* Enrollments Mode Content (Weekly/Monthly) */
              /* ============================================================ */
              enrollmentsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
                </div>
              ) : sortedPreviewItems.length === 0 ? (
                <div className="flex items-center justify-center h-full text-zinc-500">
                  No active enrollments found for {invoiceType} billing
                </div>
              ) : (
                <div className="space-y-3">
                  {groupedByFamily.map(group => (
                    <div
                      key={group.familyId}
                      className={`border rounded-lg overflow-hidden ${
                        group.hasExisting
                          ? 'border-amber-500/30 bg-amber-500/5'
                          : 'border-zinc-700 bg-zinc-800/30'
                      }`}
                    >
                      {/* Family Header */}
                      <div
                        className="flex items-center justify-between px-4 py-2 bg-zinc-800/50 cursor-pointer"
                        onClick={() => handleToggleFamily(group.familyId)}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={group.allSelected}
                            onChange={() => handleToggleFamily(group.familyId)}
                            onClick={e => e.stopPropagation()}
                            className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-zinc-900"
                          />
                          <span className="font-medium text-white">{group.familyName}</span>
                          {group.hasExisting && (
                            <span className="flex items-center gap-1 text-xs text-amber-400">
                              <AlertTriangle className="w-3 h-3" />
                              Invoice exists
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-zinc-400">
                          ${group.totalAmount.toFixed(2)}
                        </span>
                      </div>

                      {/* Enrollments */}
                      <div className="divide-y divide-zinc-800">
                        {group.items.map(item => (
                          <div
                            key={item.enrollment.id}
                            className={`flex items-center justify-between px-4 py-2 ${
                              item.hasExisting ? 'opacity-50' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={selectedEnrollments.has(item.enrollment.id)}
                                onChange={() => handleToggleEnrollment(item.enrollment.id)}
                                disabled={item.hasExisting}
                                className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-zinc-900 disabled:opacity-50"
                              />
                              <ServiceBadge code={item.enrollment.service?.code || ''} />
                              <span className="text-sm text-zinc-300">
                                {item.enrollment.student?.full_name}
                              </span>
                              {item.isEdited && (
                                <button
                                  onClick={() => clearOverride(item.enrollment.id)}
                                  className="text-xs text-amber-400 hover:text-amber-300"
                                  title="Clear custom amount"
                                >
                                  (edited - click to reset)
                                </button>
                              )}
                          </div>
                          <div className="text-right flex items-center gap-2">
                            {editingId === item.enrollment.id ? (
                              <div className="flex items-center gap-1">
                                <span className="text-sm text-zinc-500">$</span>
                                <input
                                  type="number"
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') saveEdit()
                                    if (e.key === 'Escape') cancelEdit()
                                  }}
                                  autoFocus
                                  className="w-20 px-2 py-1 bg-zinc-700 border border-zinc-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                                />
                                <button
                                  onClick={saveEdit}
                                  className="p-1 text-green-400 hover:text-green-300"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="p-1 text-zinc-400 hover:text-white"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <div>
                                  <div className={`text-sm ${item.isEdited ? 'text-amber-400' : 'text-white'}`}>
                                    ${item.finalAmount.toFixed(2)}
                                  </div>
                                  <div className="text-xs text-zinc-500">
                                    {item.quantity} × ${item.unitPrice.toFixed(2)}
                                  </div>
                                </div>
                                {!item.hasExisting && (
                                  <button
                                    onClick={() => startEdit(item)}
                                    className="p-1 text-zinc-500 hover:text-white"
                                    title="Edit amount"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      ))}

                        {/* Pending Registration Fees */}
                        {group.registrationFees.length > 0 && (
                          <>
                            {group.registrationFees.map(fee => (
                              <div
                                key={fee.id}
                                className="flex items-center justify-between px-4 py-2 bg-pink-500/5"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-4" /> {/* Spacer to align with checkboxes */}
                                  <span className="inline-flex px-1.5 py-0.5 text-xs font-medium rounded bg-pink-500/20 text-pink-400">
                                    Reg Fee
                                  </span>
                                  <span className="text-sm text-zinc-300">
                                    {fee.event_title}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm text-pink-400">
                                    ${(fee.total_cents / 100).toFixed(2)}
                                  </div>
                                  <div className="text-xs text-zinc-500">
                                    Step Up
                                  </div>
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                    </div>
                  </div>
                ))}
              </div>
              )
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-zinc-700 bg-zinc-800/30 flex items-center justify-between">
            <div className="text-sm text-zinc-400">
              {invoiceType === 'hub' ? (
                selectedHubCount > 0 && (
                  <>
                    Will create <span className="text-white font-medium">{hubFamilyCount}</span> invoice{hubFamilyCount !== 1 ? 's' : ''} totaling{' '}
                    <span className="text-green-400 font-medium">${hubTotalAmount.toFixed(2)}</span>
                  </>
                )
              ) : invoiceType === 'events' ? (
                selectedEventCount > 0 && (
                  <>
                    Will create <span className="text-white font-medium">{eventFamilyCount}</span> invoice{eventFamilyCount !== 1 ? 's' : ''} totaling{' '}
                    <span className="text-green-400 font-medium">${eventTotalAmount.toFixed(2)}</span>
                  </>
                )
              ) : (
                selectedCount > 0 && (
                  <>
                    Will create <span className="text-white font-medium">{familyCount}</span> invoice{familyCount !== 1 ? 's' : ''} totaling{' '}
                    <span className="text-green-400 font-medium">${totalAmount.toFixed(2)}</span>
                  </>
                )
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={invoiceType === 'hub' ? handleGenerateHub : invoiceType === 'events' ? handleGenerateEvents : handleGenerate}
                disabled={
                  invoiceType === 'hub'
                    ? selectedHubCount === 0 || generateHubInvoice.isPending
                    : invoiceType === 'events'
                    ? selectedEventCount === 0 || generateEventInvoice.isPending
                    : selectedCount === 0 || generateDrafts.isPending
                }
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {(invoiceType === 'hub' ? generateHubInvoice.isPending : invoiceType === 'events' ? generateEventInvoice.isPending : generateDrafts.isPending) ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Generate {invoiceType === 'hub' ? hubFamilyCount : invoiceType === 'events' ? eventFamilyCount : familyCount} Draft{(invoiceType === 'hub' ? hubFamilyCount : invoiceType === 'events' ? eventFamilyCount : familyCount) !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Link Event Orders Modal */}
      <LinkEventOrdersModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        onSuccess={() => setIsLinkModalOpen(false)}
        unlinkedOrders={unlinkedOrders}
      />

      {/* Link Hub Bookings Modal */}
      <LinkHubBookingsModal
        isOpen={isHubLinkModalOpen}
        onClose={() => setIsHubLinkModalOpen(false)}
        onSuccess={() => setIsHubLinkModalOpen(false)}
        unlinkedBookings={unlinkedHubBookings}
      />
    </div>
  )
}

// Build description with quantity info
function buildDescription(enrollment: BillableEnrollment, quantity: number, unitPrice: number): string {
  const studentName = enrollment.student?.full_name || 'Unknown'
  const serviceName = enrollment.service?.name || 'Service'
  const serviceCode = enrollment.service?.code

  switch (serviceCode) {
    case 'academic_coaching':
      return `${studentName} - ${serviceName}: ${quantity} hrs × $${unitPrice.toFixed(2)}`
    case 'eaton_online':
      if (quantity === 1) {
        return `${studentName} - ${serviceName}: $${unitPrice.toFixed(2)}/week`
      }
      return `${studentName} - ${serviceName}: ${quantity} weeks × $${unitPrice.toFixed(2)}`
    case 'learning_pod':
      if (quantity === 1) {
        return `${studentName} - ${serviceName}`
      }
      return `${studentName} - ${serviceName}: ${quantity} sessions × $${unitPrice.toFixed(2)}`
    default:
      if (quantity !== 1) {
        return `${studentName} - ${serviceName}: ${quantity} × $${unitPrice.toFixed(2)}`
      }
      return `${studentName} - ${serviceName}`
  }
}