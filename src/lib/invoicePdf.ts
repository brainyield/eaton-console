import { jsPDF } from 'jspdf'
import type { InvoiceWithDetails } from './hooks'
import { parseLocalDate } from './dateUtils'

// =============================================================================
// Constants
// =============================================================================

const COLORS = {
  primary: [30, 64, 175] as const,    // Blue-700
  text: [31, 41, 55] as const,        // Gray-800
  textLight: [107, 114, 128] as const, // Gray-500
  border: [229, 231, 235] as const,   // Gray-200
  background: [249, 250, 251] as const, // Gray-50
}

const MARGIN = 20
const PAGE_WIDTH = 210 // A4 width in mm
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN

// =============================================================================
// Helper Functions
// =============================================================================

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatDate(date: string | null): string {
  if (!date) return '-'
  return parseLocalDate(date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatPeriod(start: string | null, end: string | null): string {
  if (!start || !end) return '-'
  const s = parseLocalDate(start)
  const e = parseLocalDate(end)
  return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

// =============================================================================
// PDF Generation
// =============================================================================

export function generateInvoicePdf(invoice: InvoiceWithDetails): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  let y = MARGIN

  // --------------------------------------------------------------------------
  // Header Section
  // --------------------------------------------------------------------------

  // Company name / branding
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text('INVOICE', MARGIN, y)

  // Invoice number on the right
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.text)
  const invoiceNumber = invoice.invoice_number || 'DRAFT'
  doc.text(invoiceNumber, PAGE_WIDTH - MARGIN, y, { align: 'right' })

  y += 15

  // --------------------------------------------------------------------------
  // Invoice Details & Customer Info (Two Columns)
  // --------------------------------------------------------------------------

  const leftColX = MARGIN
  const rightColX = PAGE_WIDTH / 2 + 10

  // Left column - Invoice details
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.textLight)
  doc.text('INVOICE DETAILS', leftColX, y)

  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.text)
  doc.setFontSize(10)

  const detailsStartY = y
  doc.text(`Invoice Date: ${formatDate(invoice.invoice_date)}`, leftColX, y)
  y += 5
  doc.text(`Due Date: ${formatDate(invoice.due_date)}`, leftColX, y)
  y += 5
  if (invoice.period_start && invoice.period_end) {
    doc.text(`Period: ${formatPeriod(invoice.period_start, invoice.period_end)}`, leftColX, y)
    y += 5
  }

  // Status badge
  const statusText = invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)
  y += 2
  doc.setFont('helvetica', 'bold')
  if (invoice.status === 'paid') {
    doc.setTextColor(22, 163, 74) // Green
  } else if (invoice.status === 'overdue') {
    doc.setTextColor(220, 38, 38) // Red
  } else if (invoice.status === 'void') {
    doc.setTextColor(...COLORS.textLight)
  } else {
    doc.setTextColor(...COLORS.primary)
  }
  doc.text(`Status: ${statusText}`, leftColX, y)

  // Right column - Bill To
  let rightY = detailsStartY - 6
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.textLight)
  doc.text('BILL TO', rightColX, rightY)

  rightY += 6
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.text)
  doc.text(invoice.family?.display_name || 'Unknown', rightColX, rightY)

  if (invoice.family?.primary_email) {
    rightY += 5
    doc.text(invoice.family.primary_email, rightColX, rightY)
  }

  if (invoice.family?.primary_phone) {
    rightY += 5
    doc.text(invoice.family.primary_phone, rightColX, rightY)
  }

  // Address if available
  if (invoice.family?.address_line1) {
    rightY += 5
    doc.text(invoice.family.address_line1, rightColX, rightY)
    if (invoice.family.address_line2) {
      rightY += 5
      doc.text(invoice.family.address_line2, rightColX, rightY)
    }
    if (invoice.family.city || invoice.family.state || invoice.family.zip) {
      rightY += 5
      const cityStateZip = [
        invoice.family.city,
        invoice.family.state,
        invoice.family.zip
      ].filter(Boolean).join(', ')
      doc.text(cityStateZip, rightColX, rightY)
    }
  }

  y = Math.max(y, rightY) + 15

  // --------------------------------------------------------------------------
  // Line Items Table
  // --------------------------------------------------------------------------

  // Table header
  const colWidths = {
    description: CONTENT_WIDTH * 0.5,
    qty: CONTENT_WIDTH * 0.15,
    unitPrice: CONTENT_WIDTH * 0.175,
    amount: CONTENT_WIDTH * 0.175,
  }

  // Header background
  doc.setFillColor(...COLORS.background)
  doc.rect(MARGIN, y - 4, CONTENT_WIDTH, 8, 'F')

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.textLight)

  let colX = MARGIN + 2
  doc.text('Description', colX, y)
  colX += colWidths.description
  doc.text('Qty', colX, y, { align: 'center' })
  colX += colWidths.qty
  doc.text('Unit Price', colX + colWidths.unitPrice - 2, y, { align: 'right' })
  colX += colWidths.unitPrice
  doc.text('Amount', colX + colWidths.amount - 2, y, { align: 'right' })

  y += 8

  // Table rows
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.text)

  const lineItems = invoice.line_items || []

  if (lineItems.length === 0) {
    doc.setTextColor(...COLORS.textLight)
    doc.text('No line items', MARGIN + 2, y)
    y += 8
  } else {
    for (const item of lineItems) {
      // Check if we need a new page
      if (y > 270) {
        doc.addPage()
        y = MARGIN
      }

      colX = MARGIN + 2

      // Description - wrap text if needed
      const descLines = doc.splitTextToSize(item.description || '', colWidths.description - 4)
      doc.text(descLines, colX, y)

      colX += colWidths.description
      doc.text(String(item.quantity || 0), colX, y, { align: 'center' })

      colX += colWidths.qty
      doc.text(formatCurrency(item.unit_price), colX + colWidths.unitPrice - 2, y, { align: 'right' })

      colX += colWidths.unitPrice

      // Strike through if voided
      if (invoice.status === 'void') {
        doc.setTextColor(...COLORS.textLight)
      }
      doc.text(formatCurrency(item.amount), colX + colWidths.amount - 2, y, { align: 'right' })
      doc.setTextColor(...COLORS.text)

      // Row height based on description lines
      y += Math.max(6, descLines.length * 5)

      // Subtle row separator
      doc.setDrawColor(...COLORS.border)
      doc.setLineWidth(0.1)
      doc.line(MARGIN, y - 1, PAGE_WIDTH - MARGIN, y - 1)

      y += 2
    }
  }

  y += 5

  // --------------------------------------------------------------------------
  // Totals Section
  // --------------------------------------------------------------------------

  const totalsX = PAGE_WIDTH - MARGIN - 60
  const totalsValueX = PAGE_WIDTH - MARGIN

  doc.setFontSize(10)

  // Subtotal
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.textLight)
  doc.text('Subtotal', totalsX, y)
  doc.setTextColor(...COLORS.text)
  doc.text(formatCurrency(invoice.subtotal), totalsValueX, y, { align: 'right' })
  y += 6

  // Amount Paid
  if ((invoice.amount_paid || 0) > 0) {
    doc.setTextColor(...COLORS.textLight)
    doc.text('Amount Paid', totalsX, y)
    doc.setTextColor(22, 163, 74) // Green
    doc.text(`-${formatCurrency(invoice.amount_paid)}`, totalsValueX, y, { align: 'right' })
    y += 6
  }

  // Balance Due - larger and bold
  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.3)
  doc.line(totalsX - 5, y - 2, totalsValueX, y - 2)

  y += 4
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.text)
  doc.text('Balance Due', totalsX, y)

  // Color based on status
  if (invoice.status === 'void') {
    doc.setTextColor(...COLORS.textLight)
  } else if (invoice.status === 'paid') {
    doc.setTextColor(22, 163, 74) // Green
  } else if (invoice.status === 'overdue') {
    doc.setTextColor(220, 38, 38) // Red
  }
  doc.text(formatCurrency(invoice.balance_due), totalsValueX, y, { align: 'right' })

  y += 15

  // --------------------------------------------------------------------------
  // Notes Section
  // --------------------------------------------------------------------------

  if (invoice.notes) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.textLight)
    doc.text('Notes', MARGIN, y)
    y += 5

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.text)
    const noteLines = doc.splitTextToSize(invoice.notes, CONTENT_WIDTH)
    doc.text(noteLines, MARGIN, y)
  }

  // --------------------------------------------------------------------------
  // Footer
  // --------------------------------------------------------------------------

  const footerY = 285
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.textLight)
  doc.text('Thank you for your business!', PAGE_WIDTH / 2, footerY, { align: 'center' })

  // --------------------------------------------------------------------------
  // Save the PDF
  // --------------------------------------------------------------------------

  const filename = `invoice-${invoice.invoice_number || 'draft'}.pdf`
  doc.save(filename)
}
