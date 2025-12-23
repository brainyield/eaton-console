import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CheckCircle, Clock, AlertCircle, FileText, Building2, Calendar, CreditCard } from 'lucide-react';

interface Invoice {
  id: string;
  family_id: string;
  public_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  period_start: string | null;
  period_end: string | null;
  subtotal: number | null;
  total_amount: number | null;
  amount_paid: number;
  balance_due: number | null;
  status: string;
  notes: string | null;
}

interface Family {
  id: string;
  display_name: string;
  primary_email: string | null;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number | null;
  amount: number | null;
  sort_order: number;
}

interface PublicInvoicePageProps {
  publicId: string;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
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

function getStatusConfig(status: string) {
  switch (status) {
    case 'paid':
      return { 
        label: 'Paid', 
        bgColor: 'bg-green-100', 
        textColor: 'text-green-800',
        icon: CheckCircle,
        iconColor: 'text-green-600'
      };
    case 'partial':
      return { 
        label: 'Partially Paid', 
        bgColor: 'bg-amber-100', 
        textColor: 'text-amber-800',
        icon: Clock,
        iconColor: 'text-amber-600'
      };
    case 'overdue':
      return { 
        label: 'Overdue', 
        bgColor: 'bg-red-100', 
        textColor: 'text-red-800',
        icon: AlertCircle,
        iconColor: 'text-red-600'
      };
    case 'sent':
      return { 
        label: 'Awaiting Payment', 
        bgColor: 'bg-blue-100', 
        textColor: 'text-blue-800',
        icon: Clock,
        iconColor: 'text-blue-600'
      };
    case 'draft':
      return { 
        label: 'Draft', 
        bgColor: 'bg-gray-100', 
        textColor: 'text-gray-800',
        icon: FileText,
        iconColor: 'text-gray-600'
      };
    default:
      return { 
        label: status, 
        bgColor: 'bg-gray-100', 
        textColor: 'text-gray-800',
        icon: FileText,
        iconColor: 'text-gray-600'
      };
  }
}

export default function PublicInvoicePage({ publicId }: PublicInvoicePageProps) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoice();
  }, [publicId]);

  async function fetchInvoice() {
    setLoading(true);
    setError(null);

    try {
      // Fetch invoice by public_id
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('*')
        .eq('public_id', publicId)
        .single();

      if (invoiceError) {
        if (invoiceError.code === 'PGRST116') {
          setError('Invoice not found');
        } else {
          throw invoiceError;
        }
        return;
      }

      const inv = invoiceData as Invoice;
      setInvoice(inv);

      // Fetch family info
      const { data: familyData } = await supabase
        .from('families')
        .select('id, display_name, primary_email')
        .eq('id', inv.family_id)
        .single();

      setFamily(familyData as Family | null);

      // Fetch line items
      const { data: lineItemsData } = await supabase
        .from('invoice_line_items')
        .select('*')
        .eq('invoice_id', inv.id)
        .order('sort_order', { ascending: true });

      type LineItemRow = LineItem;
      setLineItems((lineItemsData || []) as LineItemRow[]);

    } catch (err) {
      console.error('Error fetching invoice:', err);
      setError('Unable to load invoice');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-gray-800 mb-2">Invoice Not Found</h1>
          <p className="text-gray-600">
            {error || 'The invoice you are looking for does not exist or has been removed.'}
          </p>
        </div>
      </div>
    );
  }

  const statusConfig = getStatusConfig(invoice.status);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Building2 className="w-8 h-8 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900">Eaton Academic</h1>
              </div>
              <p className="text-gray-500">Miami, FL</p>
            </div>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${statusConfig.bgColor}`}>
              <StatusIcon className={`w-5 h-5 ${statusConfig.iconColor}`} />
              <span className={`font-medium ${statusConfig.textColor}`}>{statusConfig.label}</span>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">Bill To</h2>
                <p className="text-lg font-semibold text-gray-900">{family?.display_name || 'Customer'}</p>
                {family?.primary_email && (
                  <p className="text-gray-600">{family.primary_email}</p>
                )}
              </div>
              <div className="text-right">
                <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">Invoice</h2>
                <p className="text-lg font-semibold text-gray-900">{invoice.invoice_number}</p>
                <p className="text-gray-600">ID: {invoice.public_id}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Invoice Date</p>
                <p className="font-medium text-gray-900">{formatDate(invoice.invoice_date)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Due Date</p>
                <p className="font-medium text-gray-900">{formatDate(invoice.due_date)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Service Period</p>
                <p className="font-medium text-gray-900">
                  {invoice.period_start && invoice.period_end 
                    ? `${formatDate(invoice.period_start)} - ${formatDate(invoice.period_end)}`
                    : '-'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 uppercase tracking-wide">Description</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-500 uppercase tracking-wide w-20">Qty</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500 uppercase tracking-wide w-28">Rate</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-500 uppercase tracking-wide w-28">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {lineItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No line items
                  </td>
                </tr>
              ) : (
                lineItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 text-gray-900">{item.description}</td>
                    <td className="px-4 py-4 text-center text-gray-600">{item.quantity}</td>
                    <td className="px-4 py-4 text-right text-gray-600">{formatCurrency(item.unit_price)}</td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">{formatCurrency(item.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex justify-end">
            <div className="w-64">
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium text-gray-900">{formatCurrency(invoice.subtotal)}</span>
              </div>
              {invoice.amount_paid > 0 && (
                <div className="flex justify-between py-2 text-green-600">
                  <span>Amount Paid</span>
                  <span className="font-medium">-{formatCurrency(invoice.amount_paid)}</span>
                </div>
              )}
              <div className="flex justify-between py-3 border-t border-gray-200 mt-2">
                <span className="text-lg font-semibold text-gray-900">Balance Due</span>
                <span className="text-lg font-bold text-gray-900">{formatCurrency(invoice.balance_due)}</span>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          {invoice.status !== 'paid' && (invoice.balance_due ?? 0) > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
                <CreditCard className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-blue-900 mb-1">Payment Methods</h3>
                  <p className="text-blue-800 text-sm">
                    We accept payment via Zelle, check, or bank transfer. 
                    Please contact us at <a href="mailto:ivan@eatonacademic.com" className="underline">ivan@eatonacademic.com</a> for payment instructions.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Paid Message */}
          {invoice.status === 'paid' && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="font-medium text-green-800">
                  This invoice has been paid in full. Thank you!
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          <p>Questions about this invoice? Contact us at ivan@eatonacademic.com</p>
          <p className="mt-1">Eaton Academic • Miami, FL</p>
        </div>
      </div>
    </div>
  );
}