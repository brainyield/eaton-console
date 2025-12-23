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

export default function Invoicing() {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedLineItems, setSelectedLineItems] = useState<InvoiceLineItem[]>([]);
  
  // Weekly invoice state
  const [currentWeek, setCurrentWeek] = useState<{ start: Date; end: Date }>(getWeekBoundaries());
  const [weeklyRows, setWeeklyRows] = useState<WeeklyInvoiceRow[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);

  // Send invoice state
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);

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
      const { data, error } = await supabase
        .from('invoice_line_items')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('sort_order');

      if (error) throw error;
      setSelectedLineItems((data || []) as InvoiceLineItem[]);
    } catch (err) {
      console.error('Error fetching line items:', err);
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
        .filter((id): id is string => id !== null);
      
      const { data: studentsData } = await supabase
        .from('students')
        .select('id, full_name')
        .in('id', studentIds);

      // Type assertion for students
      type StudentRow = { id: string; full_name: string };
      const students = (studentsData || []) as StudentRow[];
      const studentMap = new Map(students.map(s => [s.id, s.full_name]));

      // Get teacher assignments for these enrollments
      const enrollmentIds = enrollments.map(e => e.id);
      const { data: assignmentsData } = await supabase
        .from('teacher_assignments')
        .select('enrollment_id, teacher_id, hours_per_week')
        .in('enrollment_id', enrollmentIds)
        .eq('is_active', true);

      // Type assertion for assignments
      type AssignmentRow = { enrollment_id: string; teacher_id: string; hours_per_week: number | null };
      const assignments = (assignmentsData || []) as AssignmentRow[];

      // Get teacher names
      const teacherIds = assignments
        .map(a => a.teacher_id)
        .filter((id): id is string => id !== null);
      
      const { data: teachersData } = await supabase
        .from('teachers')
        .select('id, display_name')
        .in('id', teacherIds);

      // Type assertion for teachers
      type TeacherRow = { id: string; display_name: string };
      const teachers = (teachersData || []) as TeacherRow[];
      const teacherMap = new Map(teachers.map(t => [t.id, t.display_name]));
      const assignmentMap = new Map(assignments.map(a => [a.enrollment_id, a]));

      // Map to weekly rows
      const rows: WeeklyInvoiceRow[] = enrollments.map(e => {
        const assignment = assignmentMap.get(e.id);
        const teacherName = assignment ? teacherMap.get(assignment.teacher_id) : null;
        const studentName = e.student_id ? studentMap.get(e.student_id) : null;
        const hours = e.hours_per_week || 0;
        const rate = e.hourly_rate_customer || 0;
        
        return {
          enrollment_id: e.id,
          family_id: e.family_id,
          student_name: studentName || 'Unknown Student',
          teacher_name: teacherName || 'Unassigned',
          agreed_hours: hours,
          worked_hours: hours, // Default to agreed
          adjustments: 0,
          hourly_rate: rate,
          amount: hours * rate,
          selected: false,
        };
      });

      setWeeklyRows(rows);
    } catch (err) {
      console.error('Error fetching weekly data:', err);
      setWeeklyRows([]);
    }
  }

  async function generateInvoices() {
    const selectedEnrollments = weeklyRows.filter(r => selectedRows.has(r.enrollment_id));
    
    if (selectedEnrollments.length === 0) {
      alert('No enrollments selected');
      return;
    }

    setGenerating(true);

    try {
      // Group selected rows by family_id
      const byFamily = new Map<string, WeeklyInvoiceRow[]>();
      for (const row of selectedEnrollments) {
        const existing = byFamily.get(row.family_id) || [];
        existing.push(row);
        byFamily.set(row.family_id, existing);
      }

      // Get next invoice number from app_settings
      const { data: settingsData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'invoice_defaults')
        .single();
      
      type SettingsRow = { value: { due_days: number; number_prefix: string; next_number: number } };
      const settings = settingsData as SettingsRow | null;
      const duedays = settings?.value?.due_days || 15;
      const prefix = settings?.value?.number_prefix || 'INV-';
      let nextNumber = settings?.value?.next_number || 1;

      const createdInvoiceIds: string[] = [];

      // Create one invoice per family
      for (const [familyId, rows] of byFamily) {
        const totalAmount = rows.reduce((sum, r) => sum + r.amount, 0);
        
        // Calculate dates
        const invoiceDate = new Date();
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + duedays);

        // Create invoice
        const invoiceNumber = `${prefix}${String(nextNumber).padStart(4, '0')}`;
        nextNumber++;

        const invoiceInsert = {
          family_id: familyId,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate.toISOString().split('T')[0],
          due_date: dueDate.toISOString().split('T')[0],
          period_start: currentWeek.start.toISOString().split('T')[0],
          period_end: currentWeek.end.toISOString().split('T')[0],
          subtotal: totalAmount,
          total_amount: totalAmount,
          status: 'draft' as const,
        };

        const { data: invoiceData, error: invoiceError } = await (supabase
          .from('invoices') as any)
          .insert(invoiceInsert)
          .select('id')
          .single();

        if (invoiceError) {
          console.error('Error creating invoice:', invoiceError);
          throw invoiceError;
        }

        type InvoiceInsertResult = { id: string };
        const invoice = invoiceData as InvoiceInsertResult;
        createdInvoiceIds.push(invoice.id);

        // Create line items for each enrollment
        const lineItems = rows.map((row, index) => {
          const totalHours = row.worked_hours + row.adjustments;
          return {
            invoice_id: invoice.id,
            enrollment_id: row.enrollment_id,
            description: `${row.student_name} - Academic Coaching: ${totalHours} hrs × ${formatCurrency(row.hourly_rate)}`,
            quantity: totalHours,
            unit_price: row.hourly_rate,
            amount: row.amount,
            sort_order: index,
          };
        });

        const { error: lineItemError } = await (supabase
          .from('invoice_line_items') as any)
          .insert(lineItems);

        if (lineItemError) {
          console.error('Error creating line items:', lineItemError);
          throw lineItemError;
        }
      }

      // Update the next invoice number in settings
      if (settings) {
        const updatedValue = {
          ...settings.value,
          next_number: nextNumber,
        };
        await (supabase
          .from('app_settings') as any)
          .update({ value: updatedValue })
          .eq('key', 'invoice_defaults');
      }

      // Success feedback
      alert(`Created ${createdInvoiceIds.length} invoice(s) for ${selectedEnrollments.length} enrollment(s)`);

      // Clear selection and refresh
      setSelectedRows(new Set());
      
      // Switch to All Invoices tab to show the new invoices
      setActiveTab('all');
      fetchInvoices();

    } catch (err) {
      console.error('Error generating invoices:', err);
      alert('Error generating invoices. Check console for details.');
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'this-week') {
      fetchWeeklyData();
    }
  }, [activeTab, currentWeek]);

  function navigateWeek(direction: 'prev' | 'next') {
    const newStart = new Date(currentWeek.start);
    newStart.setDate(newStart.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeek(getWeekBoundaries(newStart));
  }

  function handleSelectInvoice(invoice: Invoice) {
    setSelectedInvoice(invoice);
    fetchInvoiceDetails(invoice);
  }

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

  function updateWorkedHours(enrollmentId: string, hours: number) {
    setWeeklyRows(prev =>
      prev.map(row =>
        row.enrollment_id === enrollmentId
          ? { ...row, worked_hours: hours, amount: (hours + row.adjustments) * row.hourly_rate }
          : row
      )
    );
  }

  function updateAdjustments(enrollmentId: string, adj: number) {
    setWeeklyRows(prev =>
      prev.map(row =>
        row.enrollment_id === enrollmentId
          ? { ...row, adjustments: adj, amount: (row.worked_hours + adj) * row.hourly_rate }
          : row
      )
    );
  }

  const filteredInvoices = invoices.filter(inv => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      inv.invoice_number?.toLowerCase().includes(q) ||
      inv.family?.display_name?.toLowerCase().includes(q) ||
      inv.public_id?.toLowerCase().includes(q)
    );
  });

  const tabs: { id: TabType; label: string }[] = [
    { id: 'this-week', label: 'This Week' },
    { id: 'this-month', label: 'This Month' },
    { id: 'hub-sessions', label: 'Hub Sessions' },
    { id: 'electives', label: 'Electives' },
    { id: 'all', label: 'All Invoices' },
    { id: 'overdue', label: 'Overdue' },
  ];

  return (
    <div className="flex h-full">
      {/* Main Content */}
      <div className={`flex-1 flex flex-col ${selectedInvoice ? 'mr-96' : ''}`}>
        {/* Header */}
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-semibold text-zinc-100">Invoicing</h1>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
              <Plus className="w-4 h-4" />
              New Invoice
            </button>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-5 gap-4 mb-6">
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-zinc-100">{stats.total}</div>
              <div className="text-sm text-zinc-400">Total Invoices</div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-zinc-400">{stats.draft}</div>
              <div className="text-sm text-zinc-400">Drafts</div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-blue-400">{stats.sent}</div>
              <div className="text-sm text-zinc-400">Sent</div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-red-400">{stats.overdue}</div>
              <div className="text-sm text-zinc-400">Overdue</div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-amber-400">{formatCurrency(stats.totalOutstanding)}</div>
              <div className="text-sm text-zinc-400">Outstanding</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-zinc-800/50 p-1 rounded-lg w-fit">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
                }`}
              >
                {tab.label}
                {tab.id === 'overdue' && stats.overdue > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-600 text-white rounded-full">
                    {stats.overdue}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'this-week' ? (
            <WeeklyInvoiceView
              currentWeek={currentWeek}
              onNavigateWeek={navigateWeek}
              rows={weeklyRows}
              selectedRows={selectedRows}
              onToggleRow={toggleRowSelection}
              onToggleAll={toggleAllRows}
              onUpdateWorkedHours={updateWorkedHours}
              onUpdateAdjustments={updateAdjustments}
              onGenerate={generateInvoices}
              generating={generating}
            />
          ) : activeTab === 'hub-sessions' ? (
            <PlaceholderTab 
              title="Hub Sessions" 
              description="Unbilled Eaton Hub drop-in sessions will appear here"
            />
          ) : activeTab === 'electives' ? (
            <PlaceholderTab 
              title="Elective Classes" 
              description="Friday elective class invoices will appear here"
            />
          ) : (
            <AllInvoicesView
              invoices={filteredInvoices}
              loading={loading}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSelectInvoice={handleSelectInvoice}
              selectedInvoiceId={selectedInvoice?.id}
              onSendInvoice={sendInvoice}
              sendingInvoiceId={sendingInvoiceId}
            />
          )}
        </div>
      </div>

      {/* Invoice Detail Panel */}
      {selectedInvoice && (
        <InvoiceDetailPanel
          invoice={selectedInvoice}
          lineItems={selectedLineItems}
          onClose={() => setSelectedInvoice(null)}
          onSendInvoice={sendInvoice}
          sendingInvoiceId={sendingInvoiceId}
        />
      )}
    </div>
  );
}

// Placeholder for tabs not yet implemented
function PlaceholderTab({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <FileText className="w-16 h-16 text-zinc-600 mb-4" />
      <h3 className="text-lg font-medium text-zinc-300 mb-2">{title}</h3>
      <p className="text-zinc-500">{description}</p>
    </div>
  );
}

// Weekly Invoice View Component
interface WeeklyInvoiceViewProps {
  currentWeek: { start: Date; end: Date };
  onNavigateWeek: (direction: 'prev' | 'next') => void;
  rows: WeeklyInvoiceRow[];
  selectedRows: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  onUpdateWorkedHours: (id: string, hours: number) => void;
  onUpdateAdjustments: (id: string, adj: number) => void;
  onGenerate: () => void;
  generating: boolean;
}

function WeeklyInvoiceView({
  currentWeek,
  onNavigateWeek,
  rows,
  selectedRows,
  onToggleRow,
  onToggleAll,
  onUpdateWorkedHours,
  onUpdateAdjustments,
  onGenerate,
  generating,
}: WeeklyInvoiceViewProps) {
  const totalAmount = rows.reduce((sum, r) => sum + r.amount, 0);
  const selectedAmount = rows
    .filter(r => selectedRows.has(r.enrollment_id))
    .reduce((sum, r) => sum + r.amount, 0);

  return (
    <div>
      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigateWeek('prev')}
            className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-zinc-400" />
          </button>
          <div className="text-lg font-medium text-zinc-100">
            {formatWeekRange(currentWeek.start, currentWeek.end)}
          </div>
          <button
            onClick={() => onNavigateWeek('next')}
            className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-400">
            {selectedRows.size > 0
              ? `${selectedRows.size} selected • ${formatCurrency(selectedAmount)}`
              : `${rows.length} enrollments • ${formatCurrency(totalAmount)}`}
          </span>
          <button
            onClick={onGenerate}
            disabled={selectedRows.size === 0 || generating}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Generate Selected
              </>
            )}
          </button>
          <button
            disabled={selectedRows.size === 0}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            Send Selected
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-zinc-800/30 rounded-lg border border-zinc-700/50 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-700/50">
              <th className="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectedRows.size === rows.length && rows.length > 0}
                  onChange={onToggleAll}
                  className="rounded border-zinc-600 bg-zinc-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                />
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Student</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Teacher</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-zinc-400">Agreed</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-zinc-400">Worked</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-zinc-400">Adj</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-zinc-400">Rate</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-zinc-400">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-zinc-500">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No active Academic Coaching enrollments found</p>
                  <p className="text-sm mt-1">Enrollments will appear here when added</p>
                </td>
              </tr>
            ) : (
              rows.map(row => (
                <tr
                  key={row.enrollment_id}
                  className={`border-b border-zinc-700/30 hover:bg-zinc-700/20 transition-colors ${
                    selectedRows.has(row.enrollment_id) ? 'bg-blue-900/20' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedRows.has(row.enrollment_id)}
                      onChange={() => onToggleRow(row.enrollment_id)}
                      className="rounded border-zinc-600 bg-zinc-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                    />
                  </td>
                  <td className="px-4 py-3 text-zinc-100">{row.student_name}</td>
                  <td className="px-4 py-3 text-zinc-300">{row.teacher_name}</td>
                  <td className="px-4 py-3 text-center text-zinc-400">{row.agreed_hours}</td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="number"
                      value={row.worked_hours}
                      onChange={e => onUpdateWorkedHours(row.enrollment_id, parseFloat(e.target.value) || 0)}
                      className="w-16 px-2 py-1 text-center bg-zinc-700 border border-zinc-600 rounded text-zinc-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      step="0.5"
                      min="0"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="number"
                      value={row.adjustments}
                      onChange={e => onUpdateAdjustments(row.enrollment_id, parseFloat(e.target.value) || 0)}
                      className="w-16 px-2 py-1 text-center bg-zinc-700 border border-zinc-600 rounded text-zinc-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      step="0.5"
                    />
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-400">{formatCurrency(row.hourly_rate)}/hr</td>
                  <td className="px-4 py-3 text-right font-medium text-zinc-100">
                    {formatCurrency(row.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-zinc-800/50">
                <td colSpan={7} className="px-4 py-3 text-right font-medium text-zinc-300">
                  Total:
                </td>
                <td className="px-4 py-3 text-right font-bold text-zinc-100">
                  {formatCurrency(totalAmount)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// All Invoices View Component
interface AllInvoicesViewProps {
  invoices: Invoice[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectInvoice: (invoice: Invoice) => void;
  selectedInvoiceId?: string;
  onSendInvoice: (invoiceId: string) => void;
  sendingInvoiceId: string | null;
}

function AllInvoicesView({
  invoices,
  loading,
  searchQuery,
  onSearchChange,
  onSelectInvoice,
  selectedInvoiceId,
  onSendInvoice,
  sendingInvoiceId,
}: AllInvoicesViewProps) {
  return (
    <div>
      {/* Search and Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search invoices..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <button className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 hover:bg-zinc-700 transition-colors">
          <Filter className="w-4 h-4" />
          Filters
        </button>
        <button className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 hover:bg-zinc-700 transition-colors">
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Table */}
      <div className="bg-zinc-800/30 rounded-lg border border-zinc-700/50 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-700/50">
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Invoice #</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Family</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Date</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Period</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-zinc-400">Amount</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-zinc-400">Balance</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-zinc-400">Status</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-zinc-400">Due Date</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-zinc-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-zinc-500">
                  Loading invoices...
                </td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-zinc-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No invoices found</p>
                  <p className="text-sm mt-1">
                    {searchQuery
                      ? 'Try a different search term'
                      : 'Generate your first invoice from the "This Week" tab'}
                  </p>
                </td>
              </tr>
            ) : (
              invoices.map(invoice => {
                const status = statusConfig[invoice.status] || statusConfig.draft;
                return (
                  <tr
                    key={invoice.id}
                    onClick={() => onSelectInvoice(invoice)}
                    className={`border-b border-zinc-700/30 hover:bg-zinc-700/20 cursor-pointer transition-colors ${
                      selectedInvoiceId === invoice.id ? 'bg-blue-900/20' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-zinc-100">
                      {invoice.invoice_number || invoice.public_id}
                    </td>
                    <td className="px-4 py-3 text-zinc-100">{invoice.family?.display_name || '—'}</td>
                    <td className="px-4 py-3 text-zinc-400">{formatDate(invoice.invoice_date)}</td>
                    <td className="px-4 py-3 text-zinc-400">
                      {invoice.period_start && invoice.period_end
                        ? `${formatDate(invoice.period_start)} - ${formatDate(invoice.period_end)}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-100">
                      {formatCurrency(invoice.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={
                          invoice.balance_due > 0 ? 'text-amber-400 font-medium' : 'text-zinc-400'
                        }
                      >
                        {formatCurrency(invoice.balance_due)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}
                      >
                        {status.icon}
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-zinc-400">
                      {formatDate(invoice.due_date)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {invoice.status === 'draft' ? (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            onSendInvoice(invoice.id);
                          }}
                          disabled={sendingInvoiceId === invoice.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white text-xs font-medium rounded transition-colors"
                        >
                          {sendingInvoiceId === invoice.id ? (
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

// Invoice Detail Panel Component
interface InvoiceDetailPanelProps {
  invoice: Invoice;
  lineItems: InvoiceLineItem[];
  onClose: () => void;
  onSendInvoice: (invoiceId: string) => void;
  sendingInvoiceId: string | null;
}

function InvoiceDetailPanel({ invoice, lineItems, onClose, onSendInvoice, sendingInvoiceId }: InvoiceDetailPanelProps) {
  const status = statusConfig[invoice.status] || statusConfig.draft;
  const isSending = sendingInvoiceId === invoice.id;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-zinc-900 border-l border-zinc-700 shadow-xl overflow-auto">
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
          {['sent', 'partial', 'overdue'].includes(invoice.status) && (
            <>
              <button className="w-full flex items-center justify-center gap-2 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
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