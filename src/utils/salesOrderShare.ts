// ═══════════════════════════════════════════════════════
// FinMatrix — Sales Order Sharing (WhatsApp-first)
// ═══════════════════════════════════════════════════════
// Professional "send sales order" flow used by the Detail
// screen. Mirrors invoiceShare.ts architecture.

import { Alert, Linking } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';

import type { Customer, SalesOrder } from '../types';
import { formatCurrency, formatDate } from './formatters';
import {
  DEFAULT_COMPANY,
  generateSalesOrderPdf,
  type CompanyInfo,
} from './salesOrderPdf';
import { sanitizePhoneForWhatsApp } from './invoiceShare';

// ─── Public types ────────────────────────────────────

export interface ShareSOOptions {
  salesOrder: SalesOrder;
  customer?: Customer | null;
  company?: CompanyInfo;
}

export interface ShareSOResult {
  shared: boolean;
  pdfUri: string;
  filename: string;
  reason?: string;
}

// ─── Greeting message (WhatsApp body text) ───────────

export function buildSalesOrderMessage(
  salesOrder: SalesOrder,
  customer?: Customer | null,
  company: CompanyInfo = DEFAULT_COMPANY,
): string {
  const customerFirstName =
    (customer?.name || salesOrder.customerName || 'there').split(' ')[0] || 'there';

  const lines = [
    `Hi ${customerFirstName},`,
    '',
    `Please find attached sales order *${salesOrder.soNumber}* from ${company.name}.`,
    '',
    `• Total: *${formatCurrency(salesOrder.total, 'Rs ')}*`,
    `• Expected delivery: ${formatDate(salesOrder.expectedDate)}`,
    '',
    `Reply to this message if you have any questions.`,
    '',
    `Thank you for your business.`,
    company.name,
  ];
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════
// Main share flow — "Send via WhatsApp"
// ═══════════════════════════════════════════════════════

export async function shareSalesOrderViaWhatsApp({
  salesOrder,
  customer,
  company,
}: ShareSOOptions): Promise<ShareSOResult> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    const msg = 'Sharing is not available on this device.';
    Alert.alert('Cannot share', msg);
    return { shared: false, pdfUri: '', filename: '', reason: msg };
  }

  let pdfUri = '';
  let filename = '';
  try {
    const result = await generateSalesOrderPdf({ salesOrder, customer, company });
    pdfUri = result.uri;
    filename = result.filename;
  } catch (err: any) {
    const msg = err?.message || 'Failed to generate sales order PDF.';
    Alert.alert('PDF error', msg);
    return { shared: false, pdfUri: '', filename: '', reason: msg };
  }

  const message = buildSalesOrderMessage(salesOrder, customer, company);
  try { await Clipboard.setStringAsync(message); } catch { /* noop */ }

  try {
    await Sharing.shareAsync(pdfUri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: `Send ${salesOrder.soNumber} via WhatsApp`,
    });
    return { shared: true, pdfUri, filename };
  } catch (err: any) {
    const msg = err?.message || 'Share cancelled.';
    return { shared: false, pdfUri, filename, reason: msg };
  }
}

// ═══════════════════════════════════════════════════════
// "Open WhatsApp chat" deep-link (no attachment)
// ═══════════════════════════════════════════════════════

export async function openSOWhatsAppChat(args: {
  salesOrder: SalesOrder;
  customer?: Customer | null;
  company?: CompanyInfo;
}): Promise<{ opened: boolean; reason?: string }> {
  const { salesOrder, customer, company } = args;
  const phone = sanitizePhoneForWhatsApp(customer?.phone);
  if (!phone) {
    return { opened: false, reason: 'Customer has no WhatsApp phone number on file.' };
  }

  const text = encodeURIComponent(buildSalesOrderMessage(salesOrder, customer, company));
  const url = `https://wa.me/${phone}?text=${text}`;

  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      const scheme = `whatsapp://send?phone=${phone}&text=${text}`;
      const schemeSupported = await Linking.canOpenURL(scheme);
      if (!schemeSupported) {
        return { opened: false, reason: 'WhatsApp is not installed on this device.' };
      }
      await Linking.openURL(scheme);
      return { opened: true };
    }
    await Linking.openURL(url);
    return { opened: true };
  } catch (err: any) {
    return { opened: false, reason: err?.message || 'Failed to open WhatsApp.' };
  }
}

// ═══════════════════════════════════════════════════════
// Generic "Share PDF" (email, Drive, Files, etc.)
// ═══════════════════════════════════════════════════════

export async function shareSalesOrderPdf(
  options: ShareSOOptions,
): Promise<ShareSOResult> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    const msg = 'Sharing is not available on this device.';
    Alert.alert('Cannot share', msg);
    return { shared: false, pdfUri: '', filename: '', reason: msg };
  }

  let pdfUri = '';
  let filename = '';
  try {
    const result = await generateSalesOrderPdf(options);
    pdfUri = result.uri;
    filename = result.filename;
  } catch (err: any) {
    const msg = err?.message || 'Failed to generate sales order PDF.';
    Alert.alert('PDF error', msg);
    return { shared: false, pdfUri: '', filename: '', reason: msg };
  }

  try {
    await Sharing.shareAsync(pdfUri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: `Share ${options.salesOrder.soNumber}`,
    });
    return { shared: true, pdfUri, filename };
  } catch (err: any) {
    return { shared: false, pdfUri, filename, reason: err?.message };
  }
}
