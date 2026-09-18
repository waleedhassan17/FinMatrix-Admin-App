// ═══════════════════════════════════════════════════════
// FinMatrix — Invoice PDF Generator
// ═══════════════════════════════════════════════════════
// Converts a FinMatrix Invoice into a professionally
// styled PDF file on disk using expo-print.
//
// The visual style mirrors the InvoiceDetailScreen preview
// so what the user sees on-screen is what the customer gets.
//
// Returns the final PDF file URI together with a suggested
// filename (e.g. "INV-0021.pdf"). The caller (share util)
// is responsible for any subsequent I/O (sharing, email,
// WhatsApp intent, etc).

import * as Print from 'expo-print';
import { File, Paths } from 'expo-file-system';

import type { Customer, Invoice } from '../types';
import { formatCurrency, formatDate } from './formatters';

// ─── Company branding (header block) ─────────────────
// In production these would come from the Company entity.
export interface CompanyInfo {
  name: string;
  addressLine1: string;
  addressLine2?: string;
  email?: string;
  phone?: string;
  taxId?: string;
  website?: string;
}

/**
 * Neutral last-resort fallback ONLY. Every share/download call site passes
 * the signed-in company via useCompanyInfo() (utils/companyInfo.ts) so the
 * documents carry the REAL business identity from Company Profile — a
 * customer-facing slip must never show the app vendor's branding.
 */
export const DEFAULT_COMPANY: CompanyInfo = {
  name: 'Your Company',
  addressLine1: '',
};

// ─── HTML escaping (defence-in-depth for user-supplied text) ──
const esc = (v: string | number | undefined | null): string => {
  if (v === undefined || v === null) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// ─── Status → colour mapping (mirrors the app) ───────
const STATUS_META: Record<Invoice['status'], { label: string; color: string }> = {
  draft:     { label: 'DRAFT',     color: '#64748B' },
  sent:      { label: 'SENT',      color: '#2563EB' },
  partial:   { label: 'PARTIAL',   color: '#FF991F' },
  paid:      { label: 'PAID',      color: '#00875A' },
  overdue:   { label: 'OVERDUE',   color: '#DE350B' },
  void:      { label: 'VOID',      color: '#94A3B8' },
  cancelled: { label: 'CANCELLED', color: '#475569' },
};

// ═══════════════════════════════════════════════════════
// HTML TEMPLATE
// ═══════════════════════════════════════════════════════

export interface BuildInvoiceHtmlOptions {
  invoice: Invoice;
  customer?: Customer | null;
  company?: CompanyInfo;
}

export function buildInvoiceHtml({
  invoice,
  customer,
  company = DEFAULT_COMPANY,
}: BuildInvoiceHtmlOptions): string {
  const status = STATUS_META[invoice.status];
  const balance = invoice.total - invoice.amountPaid;

  const lineRows = invoice.lines
    .map(
      (l, idx) => `
        <tr class="${idx % 2 === 0 ? 'row-even' : ''}">
          <td class="desc">${esc(l.description || l.itemName)}</td>
          <td class="right">${esc(l.quantity)}</td>
          <td class="right">${esc(formatCurrency(l.unitPrice, 'Rs '))}</td>
          <td class="right">${esc(l.taxRate)}%</td>
          <td class="right strong">${esc(formatCurrency(l.amount, 'Rs '))}</td>
        </tr>`,
    )
    .join('');

  const billTo = customer
    ? `
      <div class="bill-to-name">${esc(customer.name)}</div>
      ${customer.company ? `<div class="bill-to-line">${esc(customer.company)}</div>` : ''}
      ${
        customer.billingAddress
          ? `<div class="bill-to-line">${esc([
              customer.billingAddress.street,
              customer.billingAddress.city,
              customer.billingAddress.state,
              customer.billingAddress.zipCode,
              customer.billingAddress.country,
            ]
              .filter(Boolean)
              .join(', '))}</div>`
          : ''
      }
      ${customer.email ? `<div class="bill-to-line">${esc(customer.email)}</div>` : ''}
      ${customer.phone ? `<div class="bill-to-line">${esc(customer.phone)}</div>` : ''}
    `
    : `<div class="bill-to-name">${esc(invoice.customerName)}</div>`;

  const discountRow =
    invoice.discountAmount > 0
      ? `
        <tr>
          <td>${
            invoice.discountType === 'percent'
              ? `Discount (${esc(invoice.discountValue)}%)`
              : 'Discount (Fixed)'
          }</td>
          <td class="right success">− ${esc(formatCurrency(invoice.discountAmount, 'Rs '))}</td>
        </tr>`
      : '';

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(invoice.invoiceNumber)}</title>
    <style>
      * { box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
        color: #0F172A;
        margin: 0;
        padding: 32px 40px;
        font-size: 11px;
        background: #FFFFFF;
      }

      /* Header */
      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding-bottom: 18px;
        border-bottom: 2px solid #0F172A;
      }
      .company {
        max-width: 60%;
      }
      .company-name {
        font-size: 22px;
        font-weight: 800;
        color: #0F172A;
        letter-spacing: 0.3px;
        margin-bottom: 4px;
      }
      .company-meta {
        font-size: 10.5px;
        line-height: 1.5;
        color: #475569;
      }
      .invoice-title-block {
        text-align: right;
      }
      .invoice-title {
        font-size: 28px;
        font-weight: 800;
        letter-spacing: 3px;
        color: #0F172A;
        margin: 0 0 4px;
      }
      .invoice-number {
        font-size: 13px;
        font-weight: 700;
        color: #475569;
        margin-bottom: 6px;
      }
      .status-pill {
        display: inline-block;
        padding: 4px 10px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 1px;
        border-radius: 4px;
        color: #FFFFFF;
        background: ${status.color};
      }

      /* Meta row */
      .meta-row {
        display: flex;
        justify-content: space-between;
        margin-top: 22px;
        gap: 24px;
      }
      .meta-block {
        flex: 1;
      }
      .meta-label {
        font-size: 9.5px;
        text-transform: uppercase;
        letter-spacing: 1.2px;
        color: #94A3B8;
        font-weight: 700;
        margin-bottom: 4px;
      }
      .meta-value {
        font-size: 12px;
        font-weight: 600;
        color: #0F172A;
      }

      /* Bill to */
      .bill-to {
        margin-top: 24px;
        padding: 14px 16px;
        background: #F8FAFC;
        border-left: 3px solid #0F172A;
        border-radius: 4px;
      }
      .bill-to-name {
        font-size: 14px;
        font-weight: 700;
        color: #0F172A;
        margin-bottom: 2px;
      }
      .bill-to-line {
        font-size: 11px;
        color: #475569;
        line-height: 1.55;
      }

      /* Line items */
      .items {
        width: 100%;
        border-collapse: collapse;
        margin-top: 24px;
      }
      .items thead th {
        background: #0F172A;
        color: #FFFFFF;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 1px;
        font-weight: 700;
        padding: 10px 12px;
        text-align: left;
      }
      .items thead th.right { text-align: right; }
      .items tbody td {
        padding: 10px 12px;
        border-bottom: 1px solid #E2E8F0;
        font-size: 11px;
        color: #0F172A;
      }
      .items tbody td.right { text-align: right; }
      .items tbody td.strong { font-weight: 700; }
      .items tbody td.desc { max-width: 220px; }
      .items tbody tr.row-even td { background: #F8FAFC; }

      /* Totals */
      .totals {
        margin-top: 18px;
        display: flex;
        justify-content: flex-end;
      }
      .totals table {
        width: 42%;
        border-collapse: collapse;
      }
      .totals td {
        padding: 6px 0;
        font-size: 12px;
        color: #475569;
      }
      .totals td.right { text-align: right; font-weight: 600; color: #0F172A; }
      .totals .grand td {
        border-top: 2px solid #0F172A;
        padding-top: 10px;
        font-size: 15px;
        font-weight: 800;
        color: #0F172A;
      }
      .totals .due td {
        padding-top: 8px;
        border-top: 1px solid #E2E8F0;
        font-weight: 700;
      }
      .success { color: #16A34A; }
      .danger  { color: #DC2626; }

      /* Notes */
      .notes {
        margin-top: 26px;
        padding: 12px 14px;
        background: #F1F5F9;
        border-radius: 4px;
        font-size: 11px;
        color: #334155;
      }
      .notes-title {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #64748B;
        margin-bottom: 4px;
      }

      /* Footer */
      .footer {
        margin-top: 40px;
        padding-top: 16px;
        border-top: 1px solid #E2E8F0;
        font-size: 10px;
        color: #94A3B8;
        text-align: center;
        line-height: 1.5;
      }
      .footer strong { color: #475569; }
    </style>
  </head>
  <body>
    <!-- ────────── Header ────────── -->
    <div class="header">
      <div class="company">
        <div class="company-name">${esc(company.name)}</div>
        <div class="company-meta">
          ${company.addressLine1 ? esc(company.addressLine1) : ''}${company.addressLine2 ? `<br/>${esc(company.addressLine2)}` : ''}
          ${company.email || company.phone ? `<br/>${esc(company.email ?? '')}${company.email && company.phone ? '  •  ' : ''}${esc(company.phone ?? '')}` : ''}
          ${company.taxId ? `<br/>Tax ID: ${esc(company.taxId)}` : ''}
        </div>
      </div>
      <div class="invoice-title-block">
        <div class="invoice-title">INVOICE</div>
        <div class="invoice-number">${esc(invoice.invoiceNumber)}</div>
        <span class="status-pill">${status.label}</span>
      </div>
    </div>

    <!-- ────────── Metadata ────────── -->
    <div class="meta-row">
      <div class="meta-block">
        <div class="meta-label">Issue Date</div>
        <div class="meta-value">${esc(formatDate(invoice.issueDate))}</div>
      </div>
      <div class="meta-block">
        <div class="meta-label">Due Date</div>
        <div class="meta-value">${esc(formatDate(invoice.dueDate))}</div>
      </div>
      <div class="meta-block">
        <div class="meta-label">Balance Due</div>
        <div class="meta-value ${balance > 0 ? 'danger' : 'success'}">
          ${esc(formatCurrency(balance, 'Rs '))}
        </div>
      </div>
    </div>

    <!-- ────────── Bill To ────────── -->
    <div class="bill-to">
      <div class="meta-label" style="margin-bottom:6px;">Bill To</div>
      ${billTo}
    </div>

    <!-- ────────── Line items ────────── -->
    <table class="items">
      <thead>
        <tr>
          <th>Description</th>
          <th class="right">Qty</th>
          <th class="right">Rate</th>
          <th class="right">Tax</th>
          <th class="right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lineRows}
      </tbody>
    </table>

    <!-- ────────── Totals ────────── -->
    <div class="totals">
      <table>
        <tbody>
          <tr>
            <td>Subtotal</td>
            <td class="right">${esc(formatCurrency(invoice.subtotal, 'Rs '))}</td>
          </tr>
          ${discountRow}
          <tr>
            <td>Tax</td>
            <td class="right">${esc(formatCurrency(invoice.taxAmount, 'Rs '))}</td>
          </tr>
          <tr class="grand">
            <td>Grand Total</td>
            <td class="right">${esc(formatCurrency(invoice.total, 'Rs '))}</td>
          </tr>
          ${
            invoice.amountPaid > 0
              ? `<tr>
                  <td>Amount Paid</td>
                  <td class="right success">${esc(formatCurrency(invoice.amountPaid, 'Rs '))}</td>
                </tr>`
              : ''
          }
          <tr class="due">
            <td>Balance Due</td>
            <td class="right ${balance > 0 ? 'danger' : 'success'}">
              ${esc(formatCurrency(balance, 'Rs '))}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    ${
      invoice.notes
        ? `<div class="notes">
             <div class="notes-title">Notes</div>
             ${esc(invoice.notes).replace(/\n/g, '<br/>')}
           </div>`
        : ''
    }

    <!-- ────────── Footer ────────── -->
    <div class="footer">
      Thank you for your business.<br/>
      <strong>${esc(company.name)}</strong>${company.website ? `  •  ${esc(company.website)}` : ''}
    </div>
  </body>
</html>`;
}

// ═══════════════════════════════════════════════════════
// PDF GENERATION
// ═══════════════════════════════════════════════════════

export interface GenerateInvoicePdfResult {
  /** Absolute file:// URI of the PDF on local cache. */
  uri: string;
  /** Human-friendly filename, e.g. "INV-0021.pdf". */
  filename: string;
}

/**
 * Renders the invoice to a PDF file and returns its local
 * file URI. The file lives in the app's cache directory
 * under a stable filename so consumers can share it.
 */
export async function generateInvoicePdf(
  options: BuildInvoiceHtmlOptions,
): Promise<GenerateInvoicePdfResult> {
  const html = buildInvoiceHtml(options);

  // Step 1 — render HTML → PDF using expo-print. Returns a
  // temp path like `file:///.../Print/<uuid>.pdf`.
  const { uri: tmpUri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  // Step 2 — rename to a nice filename in the cache dir so
  // WhatsApp / the share-sheet displays e.g. "INV-0021.pdf"
  // rather than an opaque uuid.
  const filename = `${sanitizeForFilename(options.invoice.invoiceNumber || 'Invoice')}.pdf`;

  try {
    const tmpFile = new File(tmpUri);
    const destFile = new File(Paths.cache, filename);

    // Delete any stale file with the same name from a
    // previous export; ignore errors.
    if (destFile.exists) {
      try { destFile.delete(); } catch { /* noop */ }
    }

    tmpFile.move(destFile);
    return { uri: destFile.uri, filename };
  } catch {
    // If rename fails (e.g. different volume / unsupported
    // on this platform), fall back to the temp URI — it's
    // still a valid PDF for sharing.
    return { uri: tmpUri, filename };
  }
}

// Removes characters that are illegal on Android/iOS filesystems.
function sanitizeForFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9_\-]+/g, '_').slice(0, 60) || 'Invoice';
}
