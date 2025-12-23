import { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  FileText,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Plus,
  Download,
  MoreHorizontal,
  DollarSign,
  User,
  Mail,
  Check,
  Loader2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// Types based on database schema
interface Family {
  id: string;
  display_name: string;
  primary_email: string | null;
  primary_phone: string | null;
  primary_contact_name?: string | null;
}

interface Invoice {
  id: string;
  family_id: string;
  invoice_number: string | null;
  public_id: string;
  invoice_date: string;
  due_date: string | null;
  period_start: string | null;
  period_end: string | null;
  subtotal: number | null;
  total_amount: number | null;
  amount_paid: number;
  balance_due: number;
  status: 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'void';
  sent_at: string | null;
  sent_to: string | null;
  notes: string | null;
  created_at: string;
  family?: Family;
}

interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  enrollment_id: string | null;
  description: string;
  quantity: number;
  unit_price: number | null;
  amount: number | null;
  teacher_cost: number | null;
  profit: number | null;
}

interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  payment_method: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

interface WeeklyInvoiceRow {
  enrollment_id: string;
  family_id: string;
  student_name: string;
  teacher_name: string;
  agreed_hours: number;
  worked_hours: number;
  adjustments: number;
  hourly_rate: number;
  amount: number;
  selected: boolean;
}

type TabType = 'this-week' | 'this-month' | 'hub-sessions' | 'electives' | 'all' | 'overdue';

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: 'Draft', color: 'bg-zinc-600 text-zinc-200', icon: <FileText className="w-3 h-3" /> },
  sent: { label: 'Sent', color: 'bg-blue-600 text-blue-100', icon: <Send className="w-3 h-3" /> },
  paid: { label: 'Paid', color: 'bg-green-600 text-green-100', icon: <CheckCircle2 className="w-3 h-3" /> },
  partial: { label: 'Partial', color: 'bg-amber-600 text-amber-100', icon: <Clock className="w-3 h-3" /> },
  overdue: { label: 'Overdue', color: 'bg-red-600 text-red-100', icon: <AlertCircle className="w-3 h-3" /> },
  void: { label: 'Void', color: 'bg-zinc-700 text-zinc-400', icon: <X className="w-3 h-3" /> },
};

const PAYMENT_METHODS = ['Zelle', 'StepUp', 'Cash', 'Check', 'Bank Transfer', 'Stripe', 'PEP'];

// Helper to get week boundaries
function getWeekBoundaries(date: Date = new Date()): { start: Date; end: Date } {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  const start = new Date(date);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 4); // Mon-Fri
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatWeekRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} - ${end.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
}

function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];
}

// ============================================================================
// RECORD PAYMENT MODAL
// ============================================================================
interface RecordPaymentModalProps {
  invoice: Invoice;
  onClose: () => void;
  onSuccess: () => void;
}

function RecordPaymentModal({ invoice, onClose, onSuccess }: RecordPaymentModalProps) {
  const [amount, setAmount] = useState(invoice.balance_due.toString());
  const [paymentDate, setPaymentDate] = useState(formatDateForInput(new Date()));
  const [paymentMethod, setPaymentMethod] = useState('Zelle');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      setError('Please enter a valid payment amount');
      setSaving(false);
      return;
    }

    if (paymentAmount > invoice.balance_due) {
      setError(`Payment amount ($${paymentAmount.toFixed(2)}) exceeds balance due ($${invoice.balance_due.toFixed(2)})`);
      setSaving(false);
      return;
    }

    try {
      // Insert payment record - the trigger will auto-update invoice status
      const { error: insertError } = await (supabase.from('payments') as any).insert({
        invoice_id: invoice.id,
        amount: paymentAmount,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        reference: reference || null,
        notes: notes || null,
      });

      if (insertError) {
        throw new Error(insertError.message);
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error recording payment:', err);
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Record Payment</h2>
            <p className="text-sm text-zinc-400">
              {invoice.invoice_number || `#${invoice.public_id}`} • {invoice.family?.display_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Balance info */}
          <div className="bg-zinc-800/50 rounded-lg p-3 flex justify-between items-center">
            <span className="text-sm text-zinc-400">Balance Due</span>
            <span className="text-lg font-bold text-amber-400">
              {formatCurrency(invoice.balance_due)}
            </span>
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg p-3 text-sm">
              {error}
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Payment Amount
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={invoice.balance_due}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.00"
                required
              />
            </div>
            <button
              type="button"
              onClick={() => setAmount(invoice.balance_due.toString())}
              className="mt-1.5 text-xs text-blue-400 hover:text-blue-300"
            >
              Pay full balance ({formatCurrency(invoice.balance_due)})
            </button>
          </div>

          {/* Payment Date */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Payment Date
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={e => setPaymentDate(e.target.value)}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {PAYMENT_METHODS.map(method => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
          </div>

          {/* Reference */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Reference / Confirmation # <span className="text-zinc-500">(optional)</span>
            </label>
            <input
              type="text"
              value={reference}
              onChange={e => setReference(e.target.value)}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Zelle confirmation number"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Notes <span className="text-zinc-500">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Any additional notes..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Record Payment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Invoicing() {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedLineItems, setSelectedLineItems] = useState<InvoiceLineItem[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
  
  // Weekly invoice state
  const [currentWeek, setCurrentWeek] = useState<{ start: Date; end: Date }>(getWeekBoundaries());
  const [weeklyRows, setWeeklyRows] = useState<WeeklyInvoiceRow[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);

  // Send invoice state
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);

  // Record payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    sent: 0,
    overdue: 0,
    totalOutstanding: 0,
  });

  useEffect(() => {
    fetchInvoices();
  }, [activeTab]);

  async function fetchInvoices() {
    setLoading(true);
    try {
      let query = supabase
        .from('invoices')
        .select(`
          *,
          family:families(id, display_name, primary_email, primary_phone, primary_contact_name)
        `)
        .order('invoice_date', { ascending: false });

      // Apply filters based on tab
      if (activeTab === 'overdue') {
        query = query.eq('status', 'overdue');
      } else if (activeTab === 'this-month') {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        query = query
          .gte('invoice_date', firstDay.toISOString().split('T')[0])
          .lte('invoice_date', lastDay.toISOString().split('T')[0]);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Type assertion for the joined data
      const typedData = (data || []) as Invoice[];
      setInvoices(typedData);

      // Calculate stats from all invoices (not filtered)
      const { data: allData } = await supabase
        .from('invoices')
        .select('status, balance_due');
      
      const allInvoices = allData || [];
      setStats({
        total: allInvoices.length,
        draft: allInvoices.filter((i: { status: string }) => i.status === 'draft').length,
        sent: allInvoices.filter((i: { status: string }) => i.status === 'sent').length,
        overdue: allInvoices.filter((i: { status: string }) => i.status === 'overdue').length,
        totalOutstanding: allInvoices
          .filter((i: { status: string }) => ['sent', 'partial', 'overdue'].includes(i.status))
          .reduce((sum: number, i: { balance_due: number }) => sum + (i.balance_due || 0), 0),
      });
    } catch (err) {
      console.error('Error fetching invoices:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchInvoiceDetails(invoice: Invoice) {
    try {
      // Fetch line items
      const { data: lineItemsData, error: lineItemsError } = await supabase
        .from('invoice_line_items')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('sort_order');

      if (lineItemsError) throw lineItemsError;
      setSelectedLineItems((lineItemsData || []) as InvoiceLineItem[]);

      // Fetch payment history
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('payment_date', { ascending: false });

      if (paymentsError) throw paymentsError;
      setPaymentHistory((paymentsData || []) as Payment[]);
    } catch (err) {
      console.error('Error fetching invoice details:', err);
    }
  }

  // ============================================================================
  // SEND INVOICE FUNCTION
  // ============================================================================
  async function sendInvoice(invoiceId: string) {
    setSendingInvoiceId(invoiceId);
    
    try {
      // Define type for the query result
      type InvoiceWithFamily = Invoice & {
        family: Family | null;
      };

      // Fetch invoice with family details
      const { data: rawInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          *,
          family:families(
            id,
            display_name,
            primary_email,
            primary_contact_name
          )
        `)
        .eq('id', invoiceId)
        .single();

      if (invoiceError || !rawInvoice) {
        throw new Error('Failed to fetch invoice');
      }

      // Type assertion for the invoice
      const invoice = rawInvoice as unknown as InvoiceWithFamily;
      const family = invoice.family;
      
      if (!family?.primary_email) {
        throw new Error('Family has no email address');
      }

      // Fetch line items
      const { data: rawLineItems } = await supabase
        .from('invoice_line_items')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('sort_order');

      const lineItems = (rawLineItems || []) as InvoiceLineItem[];

      // Build the public invoice URL
      const publicInvoiceUrl = `${window.location.origin}/invoice/${invoice.public_id}`;

      // Trigger n8n workflow
      const n8nResponse = await fetch('https://eatonacademic.app.n8n.cloud/webhook/invoice-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          public_id: invoice.public_id,
          invoice_url: publicInvoiceUrl,
          family: {
            id: family.id,
            name: family.display_name,
            email: family.primary_email,
            contact_name: family.primary_contact_name || family.display_name,
          },
          amounts: {
            subtotal: invoice.subtotal,
            total: invoice.total_amount,
            amount_paid: invoice.amount_paid,
            balance_due: invoice.balance_due,
          },
          dates: {
            invoice_date: invoice.invoice_date,
            due_date: invoice.due_date,
            period_start: invoice.period_start,
            period_end: invoice.period_end,
          },
          line_items: lineItems.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            amount: item.amount,
          })),
        }),
      });

      if (!n8nResponse.ok) {
        const errorText = await n8nResponse.text();
        throw new Error(`Failed to send email: ${errorText}`);
      }

      // Update invoice status - cast .from() for UPDATE
      const { error: updateError } = await (supabase
        .from('invoices') as any)
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          sent_to: family.primary_email,
        })
        .eq('id', invoiceId);

      if (updateError) {
        console.error('Failed to update invoice status:', updateError);
      }

      // Log the email in invoice_emails table - cast .from() for INSERT
      await (supabase.from('invoice_emails') as any).insert({
        invoice_id: invoiceId,
        email_type: 'invoice',
        sent_to: family.primary_email,
        subject: `Invoice ${invoice.invoice_number} from Eaton Academic`,
      });

      // Update the selected invoice if it's the one we just sent
      if (selectedInvoice?.id === invoiceId) {
        setSelectedInvoice({
          ...selectedInvoice,
          status: 'sent',
          sent_at: new Date().toISOString(),
          sent_to: family.primary_email,
        });
      }

      // Refresh invoices
      fetchInvoices();
      
    } catch (error) {
      console.error('Error sending invoice:', error);
      alert(`Failed to send invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSendingInvoiceId(null);
    }
  }

  async function fetchWeeklyData() {
    try {
      // First get the academic coaching service ID
      const { data: serviceDataRaw } = await supabase
        .from('services')
        .select('id')
        .eq('code', 'academic_coaching')
        .single();

      const serviceData = serviceDataRaw as { id: string } | null;

      if (!serviceData) {
        console.log('Academic coaching service not found');
        setWeeklyRows([]);
        return;
      }

      // Fetch active academic coaching enrollments
      const { data: enrollmentsData, error: enrollmentError } = await supabase
        .from('enrollments')
        .select('id, family_id, hours_per_week, hourly_rate_customer, student_id')
        .eq('service_id', serviceData.id)
        .eq('status', 'active');

      if (enrollmentError) throw enrollmentError;

      // Type assertion for enrollments
      type EnrollmentRow = {
        id: string;
        family_id: string;
        student_id: string | null;
        hours_per_week: number | null;
        hourly_rate_customer: number | null;
      };
      const enrollments = (enrollmentsData || []) as EnrollmentRow[];

      if (enrollments.length === 0) {
        setWeeklyRows([]);
        return;
      }

      // Get student names
      const studentIds = enrollments
        .map(e => e.student_id)
        .filter(Boolean) as string[];

      const { data: studentsData } = await supabase
        .from('students')
        .select('id, full_name')
        .in('id', studentIds);

      type StudentRow = { id: string; full_name: string };
      const students = (studentsData || []) as StudentRow[];
      const studentMap = new Map(students.map(s => [s.id, s.full_name]));

      // Get teacher assignments
      const enrollmentIds = enrollments.map(e => e.id);
      const { data: assignmentsData } = await supabase
        .from('teacher_assignments')
        .select('enrollment_id, teacher_id, hourly_rate_teacher')
        .in('enrollment_id', enrollmentIds)
        .eq('is_active', true);

      type AssignmentRow = {
        enrollment_id: string;
        teacher_id: string;
        hourly_rate_teacher: number | null;
      };
      const assignments = (assignmentsData || []) as AssignmentRow[];

      // Get teacher names
      const teacherIds = [...new Set(assignments.map(a => a.teacher_id))];
      const { data: teachersData } = await supabase
        .from('teachers')
        .select('id, display_name')
        .in('id', teacherIds);

      type TeacherRow = { id: string; display_name: string };
      const teachers = (teachersData || []) as TeacherRow[];
      const teacherMap = new Map(teachers.map(t => [t.id, t.display_name]));

      // Build weekly rows
      const rows: WeeklyInvoiceRow[] = enrollments.map(enrollment => {
        const assignment = assignments.find(a => a.enrollment_id === enrollment.id);
        const studentName = enrollment.student_id
          ? studentMap.get(enrollment.student_id) || 'Unknown Student'
          : 'Unknown Student';
        const teacherName = assignment
          ? teacherMap.get(assignment.teacher_id) || 'Unassigned'
          : 'Unassigned';
        const agreedHours = enrollment.hours_per_week || 0;
        const hourlyRate = enrollment.hourly_rate_customer || 0;

        return {
          enrollment_id: enrollment.id,
          family_id: enrollment.family_id,
          student_name: studentName,
          teacher_name: teacherName,
          agreed_hours: agreedHours,
          worked_hours: agreedHours, // Default to agreed hours
          adjustments: 0,
          hourly_rate: hourlyRate,
          amount: agreedHours * hourlyRate,
          selected: false,
        };
      });

      setWeeklyRows(rows);
    } catch (err) {
      console.error('Error fetching weekly data:', err);
    }
  }

  useEffect(() => {
    if (activeTab === 'this-week') {
      fetchWeeklyData();
    }
  }, [activeTab, currentWeek]);

  function toggleRowSelection(enrollmentId: string) {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(enrollmentId)) {
        next.delete(enrollmentId);
      } else {
        next.add(enrollmentId);
      }
      return next;
    });
  }

  function toggleAllRows() {
    if (selectedRows.size === weeklyRows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(weeklyRows.map(r => r.enrollment_id)));
    }
  }

  function updateRowHours(enrollmentId: string, workedHours: number) {
    setWeeklyRows(prev =>
      prev.map(row => {
        if (row.enrollment_id === enrollmentId) {
          const amount = workedHours * row.hourly_rate;
          return { ...row, worked_hours: workedHours, amount };
        }
        return row;
      })
    );
  }

  async function generateInvoices() {
    if (selectedRows.size === 0) return;
    setGenerating(true);

    try {
      const selectedEnrollments = weeklyRows.filter(r => selectedRows.has(r.enrollment_id));

      // Group by family
      const byFamily = new Map<string, typeof selectedEnrollments>();
      for (const row of selectedEnrollments) {
        const existing = byFamily.get(row.family_id) || [];
        existing.push(row);
        byFamily.set(row.family_id, existing);
      }

      // Get next invoice number
      const { data: settingsDataRaw } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'invoice_defaults')
        .single();

      // Type assertion for settings
      type SettingsRow = { value: { next_number?: number; number_prefix?: string } };
      const settingsData = settingsDataRaw as SettingsRow | null;

      let nextNumber = 1;
      let prefix = 'INV-';
      if (settingsData?.value) {
        nextNumber = settingsData.value.next_number || 1;
        prefix = settingsData.value.number_prefix || 'INV-';
      }

      const periodStart = currentWeek.start.toISOString().split('T')[0];
      const periodEnd = currentWeek.end.toISOString().split('T')[0];
      const invoiceDate = new Date().toISOString().split('T')[0];
      const dueDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Create invoices for each family
      for (const [familyId, rows] of byFamily) {
        const invoiceNumber = `${prefix}${String(nextNumber).padStart(4, '0')}`;
        const subtotal = rows.reduce((sum, r) => sum + r.amount, 0);

        // Create invoice
        const { data: invoiceData, error: invoiceError } = await (supabase.from('invoices') as any)
          .insert({
            family_id: familyId,
            invoice_number: invoiceNumber,
            invoice_date: invoiceDate,
            due_date: dueDate,
            period_start: periodStart,
            period_end: periodEnd,
            subtotal,
            total_amount: subtotal,
            status: 'draft',
          })
          .select('id')
          .single();

        if (invoiceError) {
          console.error('Error creating invoice:', invoiceError);
          continue;
        }

        // Create line items
        const lineItems = rows.map((row, index) => ({
          invoice_id: invoiceData.id,
          enrollment_id: row.enrollment_id,
          description: `${row.student_name} - Academic Coaching: ${row.worked_hours} hrs × ${formatCurrency(row.hourly_rate)}`,
          quantity: row.worked_hours,
          unit_price: row.hourly_rate,
          amount: row.amount,
          sort_order: index,
        }));

        await (supabase.from('invoice_line_items') as any).insert(lineItems);

        nextNumber++;
      }

      // Update next invoice number
      await (supabase.from('app_settings') as any)
        .update({ value: { next_number: nextNumber, number_prefix: prefix } })
        .eq('key', 'invoice_defaults');

      // Refresh and clear selection
      setSelectedRows(new Set());
      fetchInvoices();
      setActiveTab('all');
    } catch (err) {
      console.error('Error generating invoices:', err);
      alert('Failed to generate invoices');
    } finally {
      setGenerating(false);
    }
  }

  function navigateWeek(direction: 'prev' | 'next') {
    setCurrentWeek(prev => {
      const newStart = new Date(prev.start);
      newStart.setDate(newStart.getDate() + (direction === 'next' ? 7 : -7));
      return getWeekBoundaries(newStart);
    });
  }

  function handleInvoiceClick(invoice: Invoice) {
    setSelectedInvoice(invoice);
    fetchInvoiceDetails(invoice);
  }

  function handlePaymentSuccess() {
    // Refresh invoice details and list
    if (selectedInvoice) {
      // Re-fetch the invoice to get updated balance
      supabase
        .from('invoices')
        .select(`
          *,
          family:families(id, display_name, primary_email, primary_phone, primary_contact_name)
        `)
        .eq('id', selectedInvoice.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setSelectedInvoice(data as Invoice);
            fetchInvoiceDetails(data as Invoice);
          }
        });
    }
    fetchInvoices();
  }

  const filteredInvoices = invoices.filter(
    invoice =>
      invoice.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.public_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.family?.display_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tabs: { id: TabType; label: string }[] = [
    { id: 'this-week', label: 'This Week' },
    { id: 'this-month', label: 'This Month' },
    { id: 'hub-sessions', label: 'Hub Sessions' },
    { id: 'electives', label: 'Electives' },
    { id: 'all', label: 'All Invoices' },
    { id: 'overdue', label: 'Overdue' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-none p-6 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Invoicing</h1>
            <p className="text-sm text-zinc-400 mt-1">Generate, send, and track invoices</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
            <Plus className="w-4 h-4" />
            Create Invoice
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-zinc-100">{stats.total}</div>
            <div className="text-sm text-zinc-400">Total Invoices</div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-zinc-400">{stats.draft}</div>
            <div className="text-sm text-zinc-400">Draft</div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-400">{stats.sent}</div>
            <div className="text-sm text-zinc-400">Sent</div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-red-400">{stats.overdue}</div>
            <div className="text-sm text-zinc-400">Overdue</div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-amber-400">{formatCurrency(stats.totalOutstanding)}</div>
            <div className="text-sm text-zinc-400">Outstanding</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-zinc-700 -mb-px">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content based on tab */}
      {activeTab === 'this-week' ? (
        <WeeklyInvoiceView
          currentWeek={currentWeek}
          weeklyRows={weeklyRows}
          selectedRows={selectedRows}
          generating={generating}
          onNavigateWeek={navigateWeek}
          onToggleRow={toggleRowSelection}
          onToggleAll={toggleAllRows}
          onUpdateHours={updateRowHours}
          onGenerate={generateInvoices}
        />
      ) : (
        <InvoiceListView
          invoices={filteredInvoices}
          loading={loading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onInvoiceClick={handleInvoiceClick}
          onSendInvoice={sendInvoice}
          sendingInvoiceId={sendingInvoiceId}
        />
      )}

      {/* Detail Panel */}
      {selectedInvoice && (
        <InvoiceDetailPanel
          invoice={selectedInvoice}
          lineItems={selectedLineItems}
          payments={paymentHistory}
          onClose={() => {
            setSelectedInvoice(null);
            setSelectedLineItems([]);
            setPaymentHistory([]);
          }}
          onSendInvoice={sendInvoice}
          sendingInvoiceId={sendingInvoiceId}
          onRecordPayment={() => setShowPaymentModal(true)}
        />
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <RecordPaymentModal
          invoice={selectedInvoice}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}

// ============================================================================
// WEEKLY INVOICE VIEW
// ============================================================================
interface WeeklyInvoiceViewProps {
  currentWeek: { start: Date; end: Date };
  weeklyRows: WeeklyInvoiceRow[];
  selectedRows: Set<string>;
  generating: boolean;
  onNavigateWeek: (direction: 'prev' | 'next') => void;
  onToggleRow: (enrollmentId: string) => void;
  onToggleAll: () => void;
  onUpdateHours: (enrollmentId: string, hours: number) => void;
  onGenerate: () => void;
}

function WeeklyInvoiceView({
  currentWeek,
  weeklyRows,
  selectedRows,
  generating,
  onNavigateWeek,
  onToggleRow,
  onToggleAll,
  onUpdateHours,
  onGenerate,
}: WeeklyInvoiceViewProps) {
  const selectedTotal = weeklyRows
    .filter(r => selectedRows.has(r.enrollment_id))
    .reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="flex-1 overflow-auto p-6">
      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigateWeek('prev')}
            className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-zinc-400" />
          </button>
          <span className="text-lg font-medium text-zinc-100">
            {formatWeekRange(currentWeek.start, currentWeek.end)}
          </span>
          <button
            onClick={() => onNavigateWeek('next')}
            className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-400">
            Selected: {selectedRows.size} ({formatCurrency(selectedTotal)})
          </span>
          <button
            onClick={onGenerate}
            disabled={selectedRows.size === 0 || generating}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg transition-colors"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Generate Invoices
              </>
            )}
          </button>
        </div>
      </div>

      {/* Weekly Table */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-zinc-800/50">
            <tr>
              <th className="w-10 px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedRows.size === weeklyRows.length && weeklyRows.length > 0}
                  onChange={onToggleAll}
                  className="rounded border-zinc-600 bg-zinc-700 text-blue-500 focus:ring-blue-500"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Student
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Teacher
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Agreed
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Worked
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Rate
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {weeklyRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                  No active Academic Coaching enrollments found
                </td>
              </tr>
            ) : (
              weeklyRows.map(row => (
                <tr
                  key={row.enrollment_id}
                  className={`hover:bg-zinc-800/50 ${
                    selectedRows.has(row.enrollment_id) ? 'bg-zinc-800/30' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedRows.has(row.enrollment_id)}
                      onChange={() => onToggleRow(row.enrollment_id)}
                      className="rounded border-zinc-600 bg-zinc-700 text-blue-500 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-100">{row.student_name}</td>
                  <td className="px-4 py-3 text-sm text-zinc-400">{row.teacher_name}</td>
                  <td className="px-4 py-3 text-sm text-center text-zinc-400">{row.agreed_hours}</td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={row.worked_hours}
                      onChange={e => onUpdateHours(row.enrollment_id, parseFloat(e.target.value) || 0)}
                      className="w-16 px-2 py-1 text-center bg-zinc-700 border border-zinc-600 rounded text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-zinc-400">
                    {formatCurrency(row.hourly_rate)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-zinc-100">
                    {formatCurrency(row.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// INVOICE LIST VIEW
// ============================================================================
interface InvoiceListViewProps {
  invoices: Invoice[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onInvoiceClick: (invoice: Invoice) => void;
  onSendInvoice: (invoiceId: string) => void;
  sendingInvoiceId: string | null;
}

function InvoiceListView({
  invoices,
  loading,
  searchQuery,
  onSearchChange,
  onInvoiceClick,
  onSendInvoice,
  sendingInvoiceId,
}: InvoiceListViewProps) {
  return (
    <div className="flex-1 overflow-auto p-6">
      {/* Search */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search invoices..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors">
          <Filter className="w-4 h-4" />
          Filters
        </button>
      </div>

      {/* Invoice Table */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-zinc-800/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Invoice
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Family
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Due
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Total
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Balance
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Status
              </th>
              <th className="w-24 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-zinc-500 mx-auto" />
                </td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-zinc-500">
                  No invoices found
                </td>
              </tr>
            ) : (
              invoices.map(invoice => {
                const status = statusConfig[invoice.status] || statusConfig.draft;
                const isSending = sendingInvoiceId === invoice.id;

                return (
                  <tr
                    key={invoice.id}
                    onClick={() => onInvoiceClick(invoice)}
                    className="hover:bg-zinc-800/50 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-zinc-100">
                        {invoice.invoice_number || `#${invoice.public_id}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-300">
                      {invoice.family?.display_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {formatDate(invoice.invoice_date)}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {formatDate(invoice.due_date)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-zinc-100">
                      {formatCurrency(invoice.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span
                        className={
                          invoice.balance_due > 0 ? 'text-amber-400' : 'text-green-400'
                        }
                      >
                        {formatCurrency(invoice.balance_due)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}
                      >
                        {status.icon}
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {invoice.status === 'draft' ? (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            onSendInvoice(invoice.id);
                          }}
                          disabled={isSending}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white text-xs rounded transition-colors"
                        >
                          {isSending ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Send className="w-3 h-3" />
                              Send
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={e => e.stopPropagation()}
                          className="p-1 hover:bg-zinc-700 rounded transition-colors"
                        >
                          <MoreHorizontal className="w-4 h-4 text-zinc-500" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// INVOICE DETAIL PANEL
// ============================================================================
interface InvoiceDetailPanelProps {
  invoice: Invoice;
  lineItems: InvoiceLineItem[];
  payments: Payment[];
  onClose: () => void;
  onSendInvoice: (invoiceId: string) => void;
  sendingInvoiceId: string | null;
  onRecordPayment: () => void;
}

function InvoiceDetailPanel({
  invoice,
  lineItems,
  payments,
  onClose,
  onSendInvoice,
  sendingInvoiceId,
  onRecordPayment,
}: InvoiceDetailPanelProps) {
  const status = statusConfig[invoice.status] || statusConfig.draft;
  const isSending = sendingInvoiceId === invoice.id;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-zinc-900 border-l border-zinc-700 shadow-xl overflow-auto z-40">
      {/* Header */}
      <div className="sticky top-0 bg-zinc-900 border-b border-zinc-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              {invoice.invoice_number || `#${invoice.public_id}`}
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}
            >
              {status.icon}
              {status.label}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Family Info */}
        <div className="bg-zinc-800/50 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-zinc-700 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-zinc-400" />
            </div>
            <div>
              <div className="font-medium text-zinc-100">{invoice.family?.display_name}</div>
              <div className="text-sm text-zinc-400">{invoice.family?.primary_email}</div>
            </div>
          </div>
          {invoice.family?.primary_phone && (
            <div className="text-sm text-zinc-400">{invoice.family.primary_phone}</div>
          )}
        </div>

        {/* Invoice Details */}
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Invoice Date</span>
            <span className="text-zinc-100">{formatDate(invoice.invoice_date)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Due Date</span>
            <span className="text-zinc-100">{formatDate(invoice.due_date)}</span>
          </div>
          {invoice.period_start && invoice.period_end && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Period</span>
              <span className="text-zinc-100">
                {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
              </span>
            </div>
          )}
          {invoice.sent_at && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Sent</span>
              <span className="text-zinc-100">
                {new Date(invoice.sent_at).toLocaleString()}
              </span>
            </div>
          )}
          {invoice.sent_to && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Sent To</span>
              <span className="text-zinc-100">{invoice.sent_to}</span>
            </div>
          )}
        </div>

        {/* Line Items */}
        <div>
          <h3 className="text-sm font-medium text-zinc-400 mb-3">Line Items</h3>
          {lineItems.length === 0 ? (
            <div className="text-sm text-zinc-500 text-center py-4">No line items</div>
          ) : (
            <div className="space-y-2">
              {lineItems.map(item => (
                <div
                  key={item.id}
                  className="flex justify-between items-start text-sm bg-zinc-800/30 p-3 rounded-lg"
                >
                  <div>
                    <div className="text-zinc-100">{item.description}</div>
                    {item.quantity !== 1 && (
                      <div className="text-zinc-500">
                        {item.quantity} × {formatCurrency(item.unit_price)}
                      </div>
                    )}
                  </div>
                  <div className="text-zinc-100 font-medium">{formatCurrency(item.amount)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment History */}
        {payments.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Payment History</h3>
            <div className="space-y-2">
              {payments.map(payment => (
                <div
                  key={payment.id}
                  className="flex justify-between items-center text-sm bg-green-900/20 border border-green-800/30 p-3 rounded-lg"
                >
                  <div>
                    <div className="text-green-300 font-medium">
                      {formatCurrency(payment.amount)}
                    </div>
                    <div className="text-zinc-500 text-xs">
                      {formatDate(payment.payment_date)} • {payment.payment_method}
                      {payment.reference && ` • ${payment.reference}`}
                    </div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Totals */}
        <div className="border-t border-zinc-700 pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Subtotal</span>
            <span className="text-zinc-100">{formatCurrency(invoice.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Amount Paid</span>
            <span className="text-green-400">-{formatCurrency(invoice.amount_paid)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span className="text-zinc-100">Balance Due</span>
            <span className={invoice.balance_due > 0 ? 'text-amber-400' : 'text-green-400'}>
              {formatCurrency(invoice.balance_due)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {invoice.status === 'draft' && (
            <button
              onClick={() => onSendInvoice(invoice.id)}
              disabled={isSending}
              className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg transition-colors"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending Invoice...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Invoice
                </>
              )}
            </button>
          )}
          {['sent', 'partial', 'overdue'].includes(invoice.status) && invoice.balance_due > 0 && (
            <>
              <button
                onClick={onRecordPayment}
                className="w-full flex items-center justify-center gap-2 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <DollarSign className="w-4 h-4" />
                Record Payment
              </button>
              <button className="w-full flex items-center justify-center gap-2 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors">
                <Mail className="w-4 h-4" />
                Send Reminder
              </button>
            </>
          )}
          <a
            href={`/invoice/${invoice.public_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
          >
            <FileText className="w-4 h-4" />
            View Public Invoice
          </a>
          <button className="w-full flex items-center justify-center gap-2 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors">
            <Download className="w-4 h-4" />
            Download PDF
          </button>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div>
            <h3 className="text-sm font-medium text-zinc-400 mb-2">Notes</h3>
            <p className="text-sm text-zinc-300 bg-zinc-800/30 p-3 rounded-lg">{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}