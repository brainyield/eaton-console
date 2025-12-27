import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryClient'
import { useTeacher } from '../lib/hooks'
import type { Teacher } from '../lib/hooks'
import TeacherDetailPanel from './TeacherDetailPanel'
import { AddTeacherModal } from './AddTeacherModal'
import { RecordTeacherPaymentModal } from './RecordTeacherPaymentModal'
import { 
  Search, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  DollarSign, 
  Check, 
  Download, 
  ChevronDown, 
  Loader2 
} from 'lucide-react'

interface TeacherWithLoad extends Teacher {
  active_assignments?: number
  assigned_hours?: number
  // NEW: Rate info from assignments
  avgHourlyRate?: number | null
  rateRange?: { min: number; max: number } | null
  hasVariableAssignments?: boolean
}

interface PayrollLineItem {
  enrollment_id: string
  student_name: string
  service_name: string
  service_id: string
  hours: number
  rate: number
  amount: number
}

interface PayrollTeacher {
  id: string
  display_name: string
  email: string | null
  default_hourly_rate: number | null
  studentCount: number
  totalHours: number
  totalAmount: number
  isPaid: boolean
  paymentId?: string
  lineItems: PayrollLineItem[]
}

interface TeachersProps {
  selectedTeacherId?: string | null
  onSelectTeacher?: (id: string | null) => void
}

type TabFilter = 'all' | 'active' | 'reserve' | 'payroll'

// Hook for teachers with their assignment load AND rate info
function useTeachersWithLoad() {
  return useQuery({
    queryKey: [...queryKeys.teachers.all, 'withLoad'],
    queryFn: async () => {
      // Fetch teachers
      const { data: teacherData, error: teacherError } = await supabase
        .from('teachers')
        .select('*')
        .order('display_name')

      if (teacherError) throw teacherError

      // Fetch active assignments WITH rates
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('teacher_assignments')
        .select('teacher_id, hours_per_week, hourly_rate_teacher, is_active')
        .eq('is_active', true)

      if (assignmentError) throw assignmentError

      const teachers = (teacherData || []) as Teacher[]
      const assignments = (assignmentData || []) as { 
        teacher_id: string
        hours_per_week: number | null
        hourly_rate_teacher: number | null
        is_active: boolean 
      }[]

      // Merge assignment data into teachers with rate calculations
      const teachersWithLoad: TeacherWithLoad[] = teachers.map((teacher) => {
        const teacherAssignments = assignments.filter((a) => a.teacher_id === teacher.id)
        
        // Calculate assigned hours
        const assignedHours = teacherAssignments.reduce((sum, a) => sum + (a.hours_per_week || 0), 0)
        
        // Calculate rate info from assignments
        // Split into assignments WITH hours (for weighted avg) and WITHOUT (rate-only, like Electives)
        const assignmentsWithHours = teacherAssignments
          .filter(a => a.hourly_rate_teacher != null && a.hours_per_week != null && a.hours_per_week > 0)
        const assignmentsRateOnly = teacherAssignments
          .filter(a => a.hourly_rate_teacher != null && a.hours_per_week == null)
        
        let avgHourlyRate: number | null = null
        let rateRange: { min: number; max: number } | null = null
        
        // Get all unique rates for range calculation
        const allRates = teacherAssignments
          .filter(a => a.hourly_rate_teacher != null)
          .map(a => a.hourly_rate_teacher!)
        
        if (allRates.length > 0) {
          const minRate = Math.min(...allRates)
          const maxRate = Math.max(...allRates)
          
          if (minRate !== maxRate) {
            rateRange = { min: minRate, max: maxRate }
          }
          
          // Calculate weighted average ONLY from assignments with hours
          if (assignmentsWithHours.length > 0) {
            const totalWeightedRate = assignmentsWithHours.reduce(
              (sum, a) => sum + (a.hourly_rate_teacher! * a.hours_per_week!), 0
            )
            const totalHours = assignmentsWithHours.reduce(
              (sum, a) => sum + a.hours_per_week!, 0
            )
            avgHourlyRate = totalWeightedRate / totalHours
          } else if (assignmentsRateOnly.length > 0) {
            // Only rate-only assignments (e.g., teacher only does Electives)
            // Show single rate or range
            avgHourlyRate = allRates[0]
          }
        } else {
          // Fall back to default_hourly_rate
          avgHourlyRate = teacher.default_hourly_rate
        }
        
        // Check if there are variable-hours assignments (like Electives)
        const hasVariableAssignments = assignmentsRateOnly.length > 0
        
        return {
          ...teacher,
          active_assignments: teacherAssignments.length,
          assigned_hours: assignedHours,
          avgHourlyRate,
          rateRange,
          hasVariableAssignments,
        }
      })

      return teachersWithLoad
    },
  })
}

// Hook for payroll data
function usePayrollData(payPeriodStart: string, payPeriodEnd: string, enabled: boolean) {
  return useQuery({
    queryKey: ['payroll', payPeriodStart, payPeriodEnd],
    queryFn: async () => {
      // Fetch all active teachers
      const { data: teacherData } = await supabase
        .from('teachers')
        .select('id, display_name, email, default_hourly_rate')
        .in('status', ['active', 'reserve'])
        .order('display_name')

      if (!teacherData) return []

      // Fetch all active assignments with rates AND student/service info
      const { data: assignmentData } = await supabase
        .from('teacher_assignments')
        .select(`
          teacher_id, 
          hours_per_week, 
          hourly_rate_teacher, 
          is_active,
          enrollment_id,
          enrollment:enrollments (
            student:students (full_name),
            service:services (id, name)
          )
        `)
        .eq('is_active', true)

      // Fetch payments for this period
      const { data: paymentData } = await supabase
        .from('teacher_payments')
        .select('id, teacher_id')
        .gte('pay_period_start', payPeriodStart)
        .lte('pay_period_end', payPeriodEnd)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const typedAssignments = ((assignmentData || []) as any[]).map(a => ({
        teacher_id: a.teacher_id,
        hours_per_week: a.hours_per_week,
        hourly_rate_teacher: a.hourly_rate_teacher,
        is_active: a.is_active,
        enrollment_id: a.enrollment_id,
        student_name: a.enrollment?.student?.full_name || 'Unknown',
        service_name: a.enrollment?.service?.name || 'Unknown',
        service_id: a.enrollment?.service?.id || '',
      }))
      
      const payments = (paymentData || []) as { id: string; teacher_id: string }[]

      // Build payroll data with line items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payroll: PayrollTeacher[] = (teacherData as any[]).map((teacher) => {
        const assignments = typedAssignments.filter((a) => a.teacher_id === teacher.id)
        const payment = payments.find((p) => p.teacher_id === teacher.id)
        
        const lineItems: PayrollLineItem[] = assignments.map((a) => {
          const hours = a.hours_per_week || 0
          const rate = a.hourly_rate_teacher || teacher.default_hourly_rate || 0
          return {
            enrollment_id: a.enrollment_id,
            student_name: a.student_name,
            service_name: a.service_name,
            service_id: a.service_id,
            hours,
            rate,
            amount: hours * rate,
          }
        })

        const totalHours = lineItems.reduce((sum, li) => sum + li.hours, 0)
        const totalAmount = lineItems.reduce((sum, li) => sum + li.amount, 0)

        return {
          id: teacher.id,
          display_name: teacher.display_name,
          email: teacher.email,
          default_hourly_rate: teacher.default_hourly_rate,
          studentCount: assignments.length,
          totalHours,
          totalAmount,
          isPaid: !!payment,
          paymentId: payment?.id,
          lineItems,
        }
      }).filter((t) => t.studentCount > 0)

      return payroll
    },
    enabled,
  })
}

export default function Teachers({ selectedTeacherId, onSelectTeacher }: TeachersProps) {
  const queryClient = useQueryClient()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<TabFilter>('all')
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherWithLoad | null>(null)

  // Modal state
  const [showAddTeacher, setShowAddTeacher] = useState(false)
  const [showRecordPayment, setShowRecordPayment] = useState(false)
  const [payrollTeacher, setPayrollTeacher] = useState<Teacher | null>(null)

  // Payroll state
  const [payPeriodStart, setPayPeriodStart] = useState(() => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const monday = new Date(today)
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
    return monday.toISOString().split('T')[0]
  })
  const [payPeriodEnd, setPayPeriodEnd] = useState(() => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const monday = new Date(today)
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
    const friday = new Date(monday)
    friday.setDate(monday.getDate() + 4)
    return friday.toISOString().split('T')[0]
  })
  const [selectedPayrollIds, setSelectedPayrollIds] = useState<Set<string>>(new Set())
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [bulkPayingIds, setBulkPayingIds] = useState<Set<string>>(new Set())
  const [bulkPaymentMethod, setBulkPaymentMethod] = useState('Zelle')
  const [showBulkPayModal, setShowBulkPayModal] = useState(false)
  const [bulkPayProcessing, setBulkPayProcessing] = useState(false)

  // Fetch teachers with load data
  const { data: teachers = [], isLoading } = useTeachersWithLoad()

  // Fetch payroll data when on payroll tab
  const { data: payrollData = [], isLoading: payrollLoading } = usePayrollData(
    payPeriodStart, 
    payPeriodEnd, 
    activeTab === 'payroll'
  )

  // Fetch single teacher for external selection
  const { data: externalTeacher } = useTeacher(
    selectedTeacherId && !teachers.find(t => t.id === selectedTeacherId) 
      ? selectedTeacherId 
      : ''
  )

  // Handle external selection (from CommandPalette)
  useEffect(() => {
    if (selectedTeacherId && teachers.length > 0) {
      const teacher = teachers.find(t => t.id === selectedTeacherId)
      if (teacher) {
        setSelectedTeacher(teacher)
      } else if (externalTeacher) {
        setSelectedTeacher(externalTeacher as TeacherWithLoad)
      }
    }
  }, [selectedTeacherId, teachers, externalTeacher])

  function shiftPayPeriod(direction: 'prev' | 'next') {
    const start = new Date(payPeriodStart)
    const end = new Date(payPeriodEnd)
    const days = direction === 'prev' ? -7 : 7
    
    start.setDate(start.getDate() + days)
    end.setDate(end.getDate() + days)
    
    setPayPeriodStart(start.toISOString().split('T')[0])
    setPayPeriodEnd(end.toISOString().split('T')[0])
    setExpandedRows(new Set())
  }

  const handleSelectTeacher = (teacher: TeacherWithLoad | null) => {
    setSelectedTeacher(teacher)
    onSelectTeacher?.(teacher?.id || null)
  }

  const handleClosePanel = () => {
    setSelectedTeacher(null)
    onSelectTeacher?.(null)
  }

  const handleTeacherUpdated = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.teachers.all })
    if (activeTab === 'payroll') {
      queryClient.invalidateQueries({ queryKey: ['payroll'] })
    }
  }

  const handleRecordPaymentFromPayroll = (teacherId: string) => {
    const teacher = teachers.find(t => t.id === teacherId)
    if (teacher) {
      setPayrollTeacher(teacher)
      setShowRecordPayment(true)
    }
  }

  const handlePaymentSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['payroll'] })
    setPayrollTeacher(null)
  }

  const togglePayrollSelection = (id: string) => {
    setSelectedPayrollIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleAllPayroll = () => {
    const unpaid = payrollData.filter(t => !t.isPaid)
    if (selectedPayrollIds.size === unpaid.length) {
      setSelectedPayrollIds(new Set())
    } else {
      setSelectedPayrollIds(new Set(unpaid.map(t => t.id)))
    }
  }

  const toggleRowExpanded = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Bulk pay selected teachers
  async function handleBulkPay() {
    if (selectedPayrollIds.size === 0) return
    
    setBulkPayProcessing(true)
    const today = new Date().toISOString().split('T')[0]
    const teachersToPay = payrollData.filter(t => selectedPayrollIds.has(t.id) && !t.isPaid)
    
    try {
      for (const teacher of teachersToPay) {
        setBulkPayingIds(prev => new Set(prev).add(teacher.id))
        
        // Create payment record
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: paymentResult, error: paymentError } = await (supabase
          .from('teacher_payments') as any)
          .insert({
            teacher_id: teacher.id,
            pay_period_start: payPeriodStart,
            pay_period_end: payPeriodEnd,
            pay_date: today,
            total_amount: teacher.totalAmount,
            payment_method: bulkPaymentMethod,
            notes: `Bulk payment - ${teachersToPay.length} teachers`,
          })
          .select('id')
          .single()

        if (paymentError) throw paymentError

        // Create line items
        const lineItemsToInsert = teacher.lineItems
          .filter(li => li.amount > 0)
          .map(li => ({
            teacher_payment_id: paymentResult.id,
            service_id: li.service_id || null,
            enrollment_id: li.enrollment_id || null,
            description: `${li.student_name} - ${li.service_name}: ${li.hours} hrs × $${li.rate.toFixed(2)}`,
            hours: li.hours,
            hourly_rate: li.rate,
            amount: li.amount,
          }))

        if (lineItemsToInsert.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('teacher_payment_line_items') as any).insert(lineItemsToInsert)
        }

        // Trigger n8n notification
        await triggerPayrollNotification(teacher, paymentResult.id)
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['payroll'] })
      setSelectedPayrollIds(new Set())
      setShowBulkPayModal(false)
    } catch (error) {
      console.error('Error processing bulk payment:', error)
      alert('Error processing some payments. Please check and try again.')
    } finally {
      setBulkPayProcessing(false)
      setBulkPayingIds(new Set())
    }
  }

  // Trigger n8n payroll notification
  async function triggerPayrollNotification(teacher: PayrollTeacher, paymentId: string) {
    try {
      const payload = {
        payment_id: paymentId,
        teacher: {
          id: teacher.id,
          name: teacher.display_name,
          email: teacher.email,
        },
        amounts: {
          total: teacher.totalAmount,
          hours: teacher.totalHours,
        },
        period: {
          start: payPeriodStart,
          end: payPeriodEnd,
        },
        line_items: teacher.lineItems.map(li => ({
          student: li.student_name,
          service: li.service_name,
          hours: li.hours,
          rate: li.rate,
          amount: li.amount,
        })),
        payment_method: bulkPaymentMethod,
        timestamp: new Date().toISOString(),
      }

      await fetch('https://eatonacademic.app.n8n.cloud/webhook/payroll-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch (error) {
      console.error('Failed to trigger payroll notification:', error)
      // Don't throw - notification failure shouldn't block payment
    }
  }

  // Export to CSV
  function exportPayrollToCSV() {
    const headers = ['Teacher', 'Email', 'Students', 'Hours', 'Amount', 'Status']
    const rows = payrollData.map(t => [
      t.display_name,
      t.email || '',
      t.studentCount.toString(),
      t.totalHours.toString(),
      t.totalAmount.toFixed(2),
      t.isPaid ? 'Paid' : 'Pending',
    ])

    // Add summary row
    rows.push([])
    rows.push(['SUMMARY'])
    rows.push(['Period', `${payPeriodStart} to ${payPeriodEnd}`])
    rows.push(['Total Amount', '', '', '', payrollSummary.total.toFixed(2)])
    rows.push(['Pending', '', '', '', payrollSummary.pending.toFixed(2)])
    rows.push(['Paid', '', '', '', payrollSummary.paid.toFixed(2)])

    // Add detailed breakdown
    rows.push([])
    rows.push(['DETAILED BREAKDOWN'])
    rows.push(['Teacher', 'Student', 'Service', 'Hours', 'Rate', 'Amount'])
    
    payrollData.forEach(teacher => {
      teacher.lineItems.forEach(li => {
        rows.push([
          teacher.display_name,
          li.student_name,
          li.service_name,
          li.hours.toString(),
          li.rate.toFixed(2),
          li.amount.toFixed(2),
        ])
      })
    })

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `payroll_${payPeriodStart}_to_${payPeriodEnd}.csv`
    link.click()
  }

  // Filter teachers based on search and tab
  const filteredTeachers = useMemo(() => {
    return teachers.filter(teacher => {
      if (activeTab === 'active' && teacher.status !== 'active') return false
      if (activeTab === 'reserve' && teacher.status !== 'reserve') return false

      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return (
          teacher.display_name.toLowerCase().includes(query) ||
          teacher.email?.toLowerCase().includes(query) ||
          teacher.role?.toLowerCase().includes(query) ||
          teacher.skillset?.toLowerCase().includes(query)
        )
      }

      return true
    })
  }, [teachers, activeTab, searchQuery])

  const tabs: { key: TabFilter; label: string; count?: number }[] = [
    { key: 'all', label: 'All Teachers', count: teachers.length },
    { key: 'active', label: 'Active', count: teachers.filter(t => t.status === 'active').length },
    { key: 'reserve', label: 'Reserve', count: teachers.filter(t => t.status === 'reserve').length },
    { key: 'payroll', label: 'Payroll' },
  ]

  // Payroll summary
  const payrollSummary = useMemo(() => ({
    total: payrollData.reduce((sum, t) => sum + t.totalAmount, 0),
    pending: payrollData.filter(t => !t.isPaid).reduce((sum, t) => sum + t.totalAmount, 0),
    paid: payrollData.filter(t => t.isPaid).reduce((sum, t) => sum + t.totalAmount, 0),
  }), [payrollData])

  const selectedTotal = useMemo(() => 
    payrollData
      .filter(t => selectedPayrollIds.has(t.id) && !t.isPaid)
      .reduce((sum, t) => sum + t.totalAmount, 0),
    [payrollData, selectedPayrollIds]
  )

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold">Teachers</h1>
          {activeTab !== 'payroll' && (
            <button 
              onClick={() => setShowAddTeacher(true)}
              className="flex items-center gap-2 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-md text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Teacher
            </button>
          )}
          {activeTab === 'payroll' && (
            <button
              onClick={exportPayrollToCSV}
              className="flex items-center gap-2 px-3 py-2 border border-border rounded-md text-sm hover:bg-accent transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          )}
        </div>

        {/* Search - only show on non-payroll tabs */}
        {activeTab !== 'payroll' && (
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search teachers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                activeTab === tab.key
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-1.5 text-xs text-muted-foreground">({tab.count})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'payroll' ? (
          // Payroll View
          <div className="space-y-4">
            {/* Period Selector & Bulk Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => shiftPayPeriod('prev')}
                  className="p-1.5 border border-border rounded hover:bg-accent"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={payPeriodStart}
                    onChange={(e) => setPayPeriodStart(e.target.value)}
                    className="px-2 py-1 bg-background border border-border rounded text-sm"
                  />
                  <span className="text-muted-foreground">to</span>
                  <input
                    type="date"
                    value={payPeriodEnd}
                    onChange={(e) => setPayPeriodEnd(e.target.value)}
                    className="px-2 py-1 bg-background border border-border rounded text-sm"
                  />
                </div>
                <button
                  onClick={() => shiftPayPeriod('next')}
                  className="p-1.5 border border-border rounded hover:bg-accent"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                {selectedPayrollIds.size > 0 && (
                  <button
                    onClick={() => setShowBulkPayModal(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-sm"
                  >
                    <DollarSign className="w-4 h-4" />
                    Pay Selected ({selectedPayrollIds.size}) - ${selectedTotal.toFixed(2)}
                  </button>
                )}
              </div>
            </div>

            {/* Payroll Table */}
            {payrollLoading ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                Loading payroll data...
              </div>
            ) : payrollData.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                No payroll data for this period
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 w-8">
                        <input
                          type="checkbox"
                          checked={selectedPayrollIds.size === payrollData.filter(t => !t.isPaid).length && payrollData.filter(t => !t.isPaid).length > 0}
                          onChange={toggleAllPayroll}
                          className="rounded bg-background border-border"
                        />
                      </th>
                      <th className="px-3 py-2 text-left text-sm font-medium">Teacher</th>
                      <th className="px-3 py-2 text-left text-sm font-medium">Students</th>
                      <th className="px-3 py-2 text-right text-sm font-medium">Hours</th>
                      <th className="px-3 py-2 text-right text-sm font-medium">Amount</th>
                      <th className="px-3 py-2 text-center text-sm font-medium">Status</th>
                      <th className="px-3 py-2 text-right text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrollData.map((teacher) => (
                      <PayrollRow
                        key={teacher.id}
                        teacher={teacher}
                        isSelected={selectedPayrollIds.has(teacher.id)}
                        isExpanded={expandedRows.has(teacher.id)}
                        isPaying={bulkPayingIds.has(teacher.id)}
                        onToggleSelect={() => togglePayrollSelection(teacher.id)}
                        onToggleExpand={() => toggleRowExpanded(teacher.id)}
                        onRecordPayment={() => handleRecordPaymentFromPayroll(teacher.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Summary Footer */}
            {payrollData.length > 0 && (
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <span>Total: <strong>${payrollSummary.total.toFixed(2)}</strong></span>
                  <span className="text-amber-400">Pending: <strong>${payrollSummary.pending.toFixed(2)}</strong></span>
                  <span className="text-green-400">Paid: <strong>${payrollSummary.paid.toFixed(2)}</strong></span>
                </div>
                <span className="text-muted-foreground">{payrollData.length} teachers with assignments</span>
              </div>
            )}
          </div>
        ) : (
          // Teacher Cards View
          <>
            {isLoading ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                Loading teachers...
              </div>
            ) : filteredTeachers.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                {searchQuery ? 'No teachers match your search' : 'No teachers found'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredTeachers.map(teacher => (
                  <TeacherCard
                    key={teacher.id}
                    teacher={teacher}
                    isSelected={selectedTeacher?.id === teacher.id}
                    onClick={() => handleSelectTeacher(teacher)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Panel */}
      {selectedTeacher && (
        <TeacherDetailPanel
          teacher={selectedTeacher}
          onClose={handleClosePanel}
          onTeacherUpdated={handleTeacherUpdated}
        />
      )}

      {/* Add Teacher Modal */}
      <AddTeacherModal
        isOpen={showAddTeacher}
        onClose={() => setShowAddTeacher(false)}
        onSuccess={handleTeacherUpdated}
      />

      {/* Record Payment Modal (from Payroll tab) */}
      {payrollTeacher && (
        <RecordTeacherPaymentModal
          isOpen={showRecordPayment}
          teacher={payrollTeacher}
          onClose={() => {
            setShowRecordPayment(false)
            setPayrollTeacher(null)
          }}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* Bulk Payment Modal */}
      {showBulkPayModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Confirm Bulk Payment</h3>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Teachers:</span>
                <span>{selectedPayrollIds.size}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Amount:</span>
                <span className="font-bold text-lg">${selectedTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Period:</span>
                <span>{payPeriodStart} to {payPeriodEnd}</span>
              </div>
              
              <div className="pt-3 border-t border-border">
                <label className="block text-sm font-medium mb-1">Payment Method</label>
                <select
                  value={bulkPaymentMethod}
                  onChange={(e) => setBulkPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm"
                >
                  <option value="Zelle">Zelle</option>
                  <option value="Check">Check</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>

              <p className="text-sm text-muted-foreground">
                This will record payments for all selected teachers and send them email notifications.
              </p>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowBulkPayModal(false)}
                disabled={bulkPayProcessing}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkPay}
                disabled={bulkPayProcessing}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-sm disabled:opacity-50"
              >
                {bulkPayProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Confirm Payment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Payroll Row Component (extracted to avoid React Fragment issues)
function PayrollRow({
  teacher,
  isSelected,
  isExpanded,
  isPaying,
  onToggleSelect,
  onToggleExpand,
  onRecordPayment,
}: {
  teacher: PayrollTeacher
  isSelected: boolean
  isExpanded: boolean
  isPaying: boolean
  onToggleSelect: () => void
  onToggleExpand: () => void
  onRecordPayment: () => void
}) {
  return (
    <>
      <tr className={`hover:bg-muted/30 ${isPaying ? 'opacity-50' : ''}`}>
        <td className="px-3 py-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            disabled={teacher.isPaid || isPaying}
            className="rounded bg-background border-border disabled:opacity-50"
          />
        </td>
        <td className="px-3 py-2">
          <button
            onClick={onToggleExpand}
            className="flex items-center gap-2 text-left hover:text-foreground"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="font-medium">{teacher.display_name}</span>
          </button>
        </td>
        <td className="px-3 py-2 text-muted-foreground">{teacher.studentCount}</td>
        <td className="px-3 py-2 text-right">{teacher.totalHours}</td>
        <td className="px-3 py-2 text-right font-medium">${teacher.totalAmount.toFixed(2)}</td>
        <td className="px-3 py-2 text-center">
          {isPaying ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              Processing
            </span>
          ) : teacher.isPaid ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400">
              <Check className="w-3 h-3" />
              Paid
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-400">
              Pending
            </span>
          )}
        </td>
        <td className="px-3 py-2 text-right">
          {!teacher.isPaid && !isPaying && (
            <button
              onClick={onRecordPayment}
              className="text-xs text-primary hover:underline"
            >
              Record Payment
            </button>
          )}
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={7} className="px-3 py-2 bg-muted/20">
            <div className="ml-8 space-y-1">
              {teacher.lineItems.map((li, idx) => (
                <div key={idx} className="flex justify-between text-sm text-muted-foreground">
                  <span>{li.student_name} - {li.service_name}</span>
                  <span>{li.hours} hrs × ${li.rate.toFixed(2)} = ${li.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// Teacher Card Component - UPDATED with average rate display
function TeacherCard({ 
  teacher, 
  isSelected,
  onClick 
}: { 
  teacher: TeacherWithLoad
  isSelected?: boolean
  onClick: () => void 
}) {
  const loadPercent = teacher.max_hours_per_week 
    ? Math.min(100, ((teacher.assigned_hours || 0) / teacher.max_hours_per_week) * 100)
    : 0

  // Format rate display
  const formatRate = () => {
    if (teacher.rateRange) {
      // Show range if rates vary
      return `$${teacher.rateRange.min}-${teacher.rateRange.max}/hr`
    } else if (teacher.avgHourlyRate) {
      return `$${teacher.avgHourlyRate.toFixed(0)}/hr`
    } else if (teacher.default_hourly_rate) {
      return `$${teacher.default_hourly_rate}/hr`
    }
    return 'Rate TBD'
  }

  return (
    <div
      onClick={onClick}
      className={`p-4 bg-card border rounded-lg hover:border-accent cursor-pointer transition-colors ${
        isSelected ? 'border-accent bg-accent/10' : 'border-border'
      }`}
    >
      {/* Name & Status */}
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-medium">{teacher.display_name}</h3>
        <StatusBadge status={teacher.status} />
      </div>

      {/* Role */}
      <p className="text-sm text-muted-foreground mb-3">
        {teacher.role || 'No role assigned'}
      </p>

      {/* Stats */}
      <div className="space-y-2 mb-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Students</span>
          <span>{teacher.active_assignments || 0}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Hours/week</span>
          <span>
            {teacher.assigned_hours || 0}/{teacher.max_hours_per_week || '—'}
            {teacher.hasVariableAssignments && (
              <span className="text-amber-400/80 ml-0.5" title="Has variable-hour assignments (e.g., Electives)">+</span>
            )}
          </span>
        </div>
      </div>

      {/* Load Bar */}
      {teacher.max_hours_per_week && (
        <div className="mb-3">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                loadPercent >= 90 ? 'bg-red-500' :
                loadPercent >= 70 ? 'bg-amber-500' :
                'bg-green-500'
              }`}
              style={{ width: `${loadPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Rate & Payment Info - UPDATED */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {formatRate()}
        </span>
        {teacher.payment_info_on_file ? (
          <span className="text-green-400 text-xs">✓ Payment info</span>
        ) : (
          <span className="text-amber-400 text-xs">⚠ Need docs</span>
        )}
      </div>
    </div>
  )
}

// Status Badge Component
function StatusBadge({ status }: { status: Teacher['status'] }) {
  const styles = {
    active: 'bg-green-500/20 text-green-400',
    reserve: 'bg-blue-500/20 text-blue-400',
    inactive: 'bg-muted text-muted-foreground',
  }

  return (
    <span className={`px-2 py-0.5 text-xs rounded-full ${styles[status]}`}>
      {status}
    </span>
  )
}