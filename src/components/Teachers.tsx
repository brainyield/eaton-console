import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import TeacherDetailPanel from './TeacherDetailPanel'
import { AddTeacherModal } from './AddTeacherModal'
import { RecordTeacherPaymentModal } from './RecordTeacherPaymentModal'
import { Search, Plus, Filter, ChevronLeft, ChevronRight, DollarSign, Check, Download, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'

interface Teacher {
  id: string
  display_name: string
  email: string | null
  phone: string | null
  role: string | null
  skillset: string | null
  preferred_comm_method: string | null
  status: 'active' | 'reserve' | 'inactive'
  default_hourly_rate: number | null
  max_hours_per_week: number | null
  payment_info_on_file: boolean
  hire_date: string | null
  notes: string | null
  created_at: string
  // Computed from assignments
  active_assignments?: number
  assigned_hours?: number
}

interface AssignmentData {
  teacher_id: string
  hours_per_week: number | null
  is_active: boolean
  hourly_rate_teacher: number | null
  enrollment_id: string
  student_name?: string
  service_name?: string
  service_id?: string
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

export default function Teachers({ selectedTeacherId, onSelectTeacher }: TeachersProps) {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<TabFilter>('all')
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null)

  // Modal state
  const [showAddTeacher, setShowAddTeacher] = useState(false)
  const [showRecordPayment, setShowRecordPayment] = useState(false)
  const [payrollTeacher, setPayrollTeacher] = useState<Teacher | null>(null)

  // Payroll state
  const [payrollData, setPayrollData] = useState<PayrollTeacher[]>([])
  const [payrollLoading, setPayrollLoading] = useState(false)
  const [payPeriodStart, setPayPeriodStart] = useState('')
  const [payPeriodEnd, setPayPeriodEnd] = useState('')
  const [selectedPayrollIds, setSelectedPayrollIds] = useState<Set<string>>(new Set())
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [bulkPayingIds, setBulkPayingIds] = useState<Set<string>>(new Set())
  const [bulkPaymentMethod, setBulkPaymentMethod] = useState('Zelle')
  const [showBulkPayModal, setShowBulkPayModal] = useState(false)
  const [bulkPayProcessing, setBulkPayProcessing] = useState(false)

  useEffect(() => {
    fetchTeachers()
    initializePayPeriod()
  }, [])

  useEffect(() => {
    if (activeTab === 'payroll' && payPeriodStart && payPeriodEnd) {
      fetchPayrollData()
    }
  }, [activeTab, payPeriodStart, payPeriodEnd])

  function initializePayPeriod() {
    const today = new Date()
    const dayOfWeek = today.getDay()
    
    // Get Monday of current week
    const monday = new Date(today)
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
    
    // Get Friday of current week
    const friday = new Date(monday)
    friday.setDate(monday.getDate() + 4)
    
    setPayPeriodStart(monday.toISOString().split('T')[0])
    setPayPeriodEnd(friday.toISOString().split('T')[0])
  }

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

  // Handle external selection (from CommandPalette)
  useEffect(() => {
    if (selectedTeacherId && teachers.length > 0) {
      const teacher = teachers.find(t => t.id === selectedTeacherId)
      if (teacher) {
        setSelectedTeacher(teacher)
      } else {
        fetchTeacherById(selectedTeacherId)
      }
    }
  }, [selectedTeacherId, teachers])

  async function fetchTeacherById(id: string) {
    const { data, error } = await supabase
      .from('teachers')
      .select('*')
      .eq('id', id)
      .single()

    if (!error && data) {
      const teacherData = data as Teacher
      
      const { data: assignmentData } = await supabase
        .from('teacher_assignments')
        .select('teacher_id, hours_per_week, is_active')
        .eq('teacher_id', id)
        .eq('is_active', true)

      const assignments = (assignmentData || []) as AssignmentData[]
      const teacherWithLoad: Teacher = {
        ...teacherData,
        active_assignments: assignments.length,
        assigned_hours: assignments.reduce((sum, a) => sum + (a.hours_per_week || 0), 0)
      }
      setSelectedTeacher(teacherWithLoad)
    }
  }

  async function fetchTeachers() {
    setLoading(true)
    
    const { data: teacherData, error: teacherError } = await supabase
      .from('teachers')
      .select('*')
      .order('display_name')

    if (teacherError) {
      console.error('Error fetching teachers:', teacherError)
      setLoading(false)
      return
    }

    const { data: assignmentData, error: assignmentError } = await supabase
      .from('teacher_assignments')
      .select('teacher_id, hours_per_week, is_active')
      .eq('is_active', true)

    if (assignmentError) {
      console.error('Error fetching assignments:', assignmentError)
    }

    const typedTeachers = (teacherData || []) as Teacher[]
    const typedAssignments = (assignmentData || []) as AssignmentData[]

    const teachersWithLoad: Teacher[] = typedTeachers.map((teacher) => {
      const assignments = typedAssignments.filter((a) => a.teacher_id === teacher.id)
      return {
        ...teacher,
        active_assignments: assignments.length,
        assigned_hours: assignments.reduce((sum, a) => sum + (a.hours_per_week || 0), 0)
      }
    })

    setTeachers(teachersWithLoad)
    setLoading(false)
  }

  async function fetchPayrollData() {
    setPayrollLoading(true)
    
    // Fetch all active teachers
    const { data: teacherData } = await supabase
      .from('teachers')
      .select('id, display_name, email, default_hourly_rate')
      .in('status', ['active', 'reserve'])
      .order('display_name')

    if (!teacherData) {
      setPayrollLoading(false)
      return
    }

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

    setPayrollData(payroll)
    setPayrollLoading(false)
  }

  const handleSelectTeacher = (teacher: Teacher | null) => {
    setSelectedTeacher(teacher)
    onSelectTeacher?.(teacher?.id || null)
  }

  const handleClosePanel = () => {
    setSelectedTeacher(null)
    onSelectTeacher?.(null)
  }

  const handleTeacherUpdated = () => {
    fetchTeachers()
    if (selectedTeacher) {
      fetchTeacherById(selectedTeacher.id)
    }
    if (activeTab === 'payroll') {
      fetchPayrollData()
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
    fetchPayrollData()
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
        const { data: paymentData, error: paymentError } = await (supabase
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
            teacher_payment_id: paymentData.id,
            service_id: li.service_id || null,
            enrollment_id: li.enrollment_id || null,
            description: `${li.student_name} - ${li.service_name}: ${li.hours} hrs × $${li.rate.toFixed(2)}`,
            hours: li.hours,
            hourly_rate: li.rate,
            amount: li.amount,
          }))

        if (lineItemsToInsert.length > 0) {
          await (supabase.from('teacher_payment_line_items') as any).insert(lineItemsToInsert)
        }

        // Trigger n8n notification
        await triggerPayrollNotification(teacher, paymentData.id)
      }

      // Refresh data
      await fetchPayrollData()
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
  const filteredTeachers = teachers.filter(teacher => {
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

  const tabs: { key: TabFilter; label: string; count?: number }[] = [
    { key: 'all', label: 'All Teachers', count: teachers.length },
    { key: 'active', label: 'Active', count: teachers.filter(t => t.status === 'active').length },
    { key: 'reserve', label: 'Reserve', count: teachers.filter(t => t.status === 'reserve').length },
    { key: 'payroll', label: 'Payroll' },
  ]

  // Payroll summary
  const payrollSummary = {
    total: payrollData.reduce((sum, t) => sum + t.totalAmount, 0),
    pending: payrollData.filter(t => !t.isPaid).reduce((sum, t) => sum + t.totalAmount, 0),
    paid: payrollData.filter(t => t.isPaid).reduce((sum, t) => sum + t.totalAmount, 0),
  }

  const selectedTotal = payrollData
    .filter(t => selectedPayrollIds.has(t.id) && !t.isPaid)
    .reduce((sum, t) => sum + t.totalAmount, 0)

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
            <button className="flex items-center gap-2 px-3 py-2 border border-border rounded-md text-sm hover:bg-accent">
              <Filter className="w-4 h-4" />
              Filters
            </button>
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

              {selectedPayrollIds.size > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {selectedPayrollIds.size} selected (${selectedTotal.toFixed(2)})
                  </span>
                  <button
                    onClick={() => setShowBulkPayModal(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-sm transition-colors"
                  >
                    <DollarSign className="w-4 h-4" />
                    Pay Selected
                  </button>
                </div>
              )}
            </div>

            {/* Payroll Table */}
            {payrollLoading ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                Loading payroll data...
              </div>
            ) : payrollData.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                No teachers with active assignments
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="w-10 p-3">
                        <input
                          type="checkbox"
                          checked={selectedPayrollIds.size === payrollData.filter(t => !t.isPaid).length && payrollData.filter(t => !t.isPaid).length > 0}
                          onChange={toggleAllPayroll}
                          className="rounded border-border"
                        />
                      </th>
                      <th className="w-8 p-3"></th>
                      <th className="text-left p-3 font-medium">Teacher</th>
                      <th className="text-center p-3 font-medium">Students</th>
                      <th className="text-right p-3 font-medium">Hours</th>
                      <th className="text-right p-3 font-medium">Amount</th>
                      <th className="text-center p-3 font-medium">Status</th>
                      <th className="w-24 p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrollData.map((teacher) => (
                      <>
                        <tr 
                          key={teacher.id} 
                          className={`border-t border-border hover:bg-accent/50 ${
                            teacher.isPaid ? 'opacity-60' : ''
                          } ${bulkPayingIds.has(teacher.id) ? 'bg-emerald-500/10' : ''}`}
                        >
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={selectedPayrollIds.has(teacher.id)}
                              onChange={() => togglePayrollSelection(teacher.id)}
                              disabled={teacher.isPaid || bulkPayingIds.has(teacher.id)}
                              className="rounded border-border disabled:opacity-50"
                            />
                          </td>
                          <td className="p-3">
                            <button
                              onClick={() => toggleRowExpanded(teacher.id)}
                              className="p-0.5 hover:bg-accent rounded"
                            >
                              {expandedRows.has(teacher.id) ? (
                                <ChevronUp className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              )}
                            </button>
                          </td>
                          <td className="p-3 font-medium">{teacher.display_name}</td>
                          <td className="p-3 text-center text-muted-foreground">{teacher.studentCount}</td>
                          <td className="p-3 text-right">{teacher.totalHours} hrs</td>
                          <td className="p-3 text-right font-medium">${teacher.totalAmount.toFixed(2)}</td>
                          <td className="p-3 text-center">
                            {bulkPayingIds.has(teacher.id) ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Processing
                              </span>
                            ) : teacher.isPaid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-status-active/20 text-status-active text-xs rounded-full">
                                <Check className="w-3 h-3" />
                                Paid
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-status-paused/20 text-status-paused text-xs rounded-full">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            {!teacher.isPaid && !bulkPayingIds.has(teacher.id) && (
                              <button
                                onClick={() => handleRecordPaymentFromPayroll(teacher.id)}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-primary hover:bg-accent rounded transition-colors"
                              >
                                <DollarSign className="w-3 h-3" />
                                Pay
                              </button>
                            )}
                          </td>
                        </tr>
                        {/* Expanded Row - Line Items */}
                        {expandedRows.has(teacher.id) && (
                          <tr key={`${teacher.id}-details`} className="bg-muted/30">
                            <td colSpan={8} className="p-0">
                              <div className="px-12 py-3">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-muted-foreground">
                                      <th className="text-left py-1 font-medium">Student</th>
                                      <th className="text-left py-1 font-medium">Service</th>
                                      <th className="text-right py-1 font-medium">Hours</th>
                                      <th className="text-right py-1 font-medium">Rate</th>
                                      <th className="text-right py-1 font-medium">Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {teacher.lineItems.map((li, idx) => (
                                      <tr key={idx} className="border-t border-border/50">
                                        <td className="py-1.5">{li.student_name}</td>
                                        <td className="py-1.5 text-muted-foreground">{li.service_name}</td>
                                        <td className="py-1.5 text-right">{li.hours}</td>
                                        <td className="py-1.5 text-right">${li.rate.toFixed(2)}</td>
                                        <td className="py-1.5 text-right font-medium">${li.amount.toFixed(2)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Summary */}
            {payrollData.length > 0 && (
              <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
                <div className="flex items-center gap-6">
                  <span>
                    Period Total: <span className="font-medium">${payrollSummary.total.toFixed(2)}</span>
                  </span>
                  <span className="text-status-paused">
                    Pending: <span className="font-medium">${payrollSummary.pending.toFixed(2)}</span>
                  </span>
                  <span className="text-status-active">
                    Paid: <span className="font-medium">${payrollSummary.paid.toFixed(2)}</span>
                  </span>
                </div>
                <div className="text-muted-foreground">
                  {payrollData.length} teachers with assignments
                </div>
              </div>
            )}
          </div>
        ) : (
          // Teacher Cards Grid
          <>
            {loading ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                Loading teachers...
              </div>
            ) : filteredTeachers.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                No teachers found
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

      {/* Detail Panel - only show on non-payroll tabs */}
      {selectedTeacher && activeTab !== 'payroll' && (
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
        onSuccess={() => {
          fetchTeachers()
        }}
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

      {/* Bulk Pay Confirmation Modal */}
      {showBulkPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => !bulkPayProcessing && setShowBulkPayModal(false)} />
          <div className="relative w-full max-w-md bg-background border border-border rounded-lg shadow-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Confirm Bulk Payment</h3>
            
            <div className="space-y-4">
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">Teachers:</span>
                  <span className="font-medium">{selectedPayrollIds.size}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">Period:</span>
                  <span className="font-medium">{payPeriodStart} to {payPeriodEnd}</span>
                </div>
                <div className="flex justify-between text-lg">
                  <span className="text-muted-foreground">Total Amount:</span>
                  <span className="font-bold">${selectedTotal.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Payment Method</label>
                <select
                  value={bulkPaymentMethod}
                  onChange={(e) => setBulkPaymentMethod(e.target.value)}
                  disabled={bulkPayProcessing}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md"
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

// Teacher Card Component
function TeacherCard({ 
  teacher, 
  isSelected,
  onClick 
}: { 
  teacher: Teacher
  isSelected?: boolean
  onClick: () => void 
}) {
  const loadPercent = teacher.max_hours_per_week 
    ? Math.min(100, ((teacher.assigned_hours || 0) / teacher.max_hours_per_week) * 100)
    : 0

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
          </span>
        </div>
      </div>

      {/* Load Bar */}
      {teacher.max_hours_per_week && (
        <div className="mb-3">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                loadPercent >= 90 ? 'bg-status-churned' :
                loadPercent >= 70 ? 'bg-status-paused' :
                'bg-status-active'
              }`}
              style={{ width: `${loadPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Rate & Payment Info */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {teacher.default_hourly_rate 
            ? `$${teacher.default_hourly_rate}/hr` 
            : 'Rate TBD'}
        </span>
        {teacher.payment_info_on_file ? (
          <span className="text-status-active text-xs">✓ Payment info</span>
        ) : (
          <span className="text-status-paused text-xs">⚠ Need docs</span>
        )}
      </div>
    </div>
  )
}

// Status Badge Component
function StatusBadge({ status }: { status: Teacher['status'] }) {
  const styles = {
    active: 'bg-status-active/20 text-status-active',
    reserve: 'bg-status-trial/20 text-status-trial',
    inactive: 'bg-muted text-muted-foreground',
  }

  return (
    <span className={`px-2 py-0.5 text-xs rounded-full ${styles[status]}`}>
      {status}
    </span>
  )
}