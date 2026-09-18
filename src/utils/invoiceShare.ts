// ═══════════════════════════════════════════════════════
// FinMatrix — Invoice Sharing (WhatsApp-first)
// ═══════════════════════════════════════════════════════
// Professional "send invoice" flow used by the Detail screen.
//
// Design notes
// ------------
// WhatsApp's public URL scheme (`whatsapp://send?phone=...`
// and `https://wa.me/...`) intentionally DOES NOT support
// file attachments — only a pre-filled text can be passed.
// To attach a real PDF we have to go through the platform
// share-sheet (Android ACTION_SEND / iOS UIActivityViewController).
// The share-sheet is what QuickBooks, Zoho Books, Wave and
// Xero all use on their mobile apps, so it is the expected
// production pattern here as well.
//
// What this module does:
//   1. Generates a PDF of the invoice using expo-print.
//   2. Builds a locale-aware greeting message and copies it
//      to the clipboard so the user can paste it in the
//      WhatsApp chat window after selecting the recipient.
//   3. Opens the native share-sheet with `dialogTitle: "Send
//      via WhatsApp"` and mime type `application/pdf`. On
//      both Android and iOS WhatsApp appears as the top /
//      first option for PDFs when it is installed.
//   4. Optionally jumps straight into the customer's chat
//      via `wa.me/<phone>?text=...` when a phone number is
//      available — lets the user attach the PDF from the
//      WhatsApp attachment menu using "Document".

import { Alert, Linking, Platform } from 'react-native';
import * as Sharing from 'expo-sharing';

import type { Customer, Invoice } from '../types';
import { formatCurrency, formatDate } from './formatters';
import {
  DEFAULT_COMPANY,
  generateInvoicePdf,
  type CompanyInfo,
} from './invoicePdf';

// ─── Public types ────────────────────────────────────

export interface ShareInvoiceOptions {
  invoice: Invoice;
  customer?: Customer | null;
  company?: CompanyInfo;
}

export interface ShareInvoiceResult {
  /** True if the share-sheet / WhatsApp was actually shown. */
  shared: boolean;
  /** The generated PDF URI, regardless of whether it was
   *  shared (callers may still want to cache it). */
  pdfUri: string;
  /** Nice filename (e.g. "INV-0021.pdf"). */
  filename: string;
  /** Reason when `shared === false`. */
  reason?: string;
}

// ─── Greeting message (WhatsApp body text) ───────────

/**
 * Builds the default text message that accompanies the PDF.
 * This is what the business sends to the customer — short,
 * polite and includes the key numbers so the customer does
 * not have to open the PDF to see what they owe.
 */
export function buildInvoiceMessage(
  invoice: Invoice,
  customer?: Customer | null,
  company: CompanyInfo = DEFAULT_COMPANY,
): string {
  const balance = invoice.total - invoice.amountPaid;
  const customerFirstName =
    (customer?.name || invoice.customerName || 'there').split(' ')[0] || 'there';

  const lines = [
    `Hi ${customerFirstName},`,
    '',
    `Please find attached invoice *${invoice.invoiceNumber}* from ${company.name}.`,
    '',
    `• Amount due: *${formatCurrency(balance, 'Rs ')}*`,
    `• Due date: ${formatDate(invoice.dueDate)}`,
    '',
    `Kindly arrange the payment at your earliest convenience. Reply to this message if you have any questions.`,
    '',
    `Thank you for your business.`,
    company.name,
  ];
  return lines.join('\n');
}

// ─── Phone sanitizer (WhatsApp deep-link) ────────────

/**
 * Converts any international phone number to the digits-only
 * form required by `wa.me/<number>` (no leading `+`, no
 * spaces, no dashes, no parentheses).
 */
export function sanitizePhoneForWhatsApp(phone?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  // Strip a leading `00` international prefix if the user
  // entered e.g. "0092…" instead of "+92…".
  const normalized = digits.startsWith('00') ? digits.slice(2) : digits;
  return normalized.length >= 8 ? normalized : null;
}

// ═══════════════════════════════════════════════════════
// Main share flow — "Send via WhatsApp"
// ═══════════════════════════════════════════════════════

/*
 * `shareInvoiceViaWhatsApp` used to live here. It was a copy of
 * `shareInvoicePdf` with a different dialogTitle and a clipboard write: same
 * PDF, same Sharing.shareAsync, same OS sheet. It never opened WhatsApp.
 *
 * It was removed with the button that called it, because the caller recorded
 * the send as channel 'whatsapp' whichever app the user actually picked in
 * that sheet -- an invoice could read "sent via WhatsApp" after being emailed.
 * The real deep link is `openWhatsAppChat` below.
 */

// ═══════════════════════════════════════════════════════
// Optional: "Open WhatsApp chat" deep-link (no attachment)
// ═══════════════════════════════════════════════════════

/**
 * When the customer has a phone number on file, this deep-
 * links directly into their WhatsApp chat with the greeting
 * message pre-filled. The PDF is NOT attached (WhatsApp does
 * not support that via URL scheme); the user can tap the
 * paperclip → "Document" inside WhatsApp to attach the file
 * that was just generated and cached.
 *
 * Returns:
 *   - `{ opened: true }`  if we successfully opened WhatsApp.
 *   - `{ opened: false, reason }` otherwise (no phone, not
 *     installed, user cancelled, …).
 */
export async function openWhatsAppChat(args: {
  invoice: Invoice;
  customer?: Customer | null;
  company?: CompanyInfo;
}): Promise<{ opened: boolean; reason?: string }> {
  const { invoice, customer, company } = args;
  const phone = sanitizePhoneForWhatsApp(customer?.phone);
  if (!phone) {
    return { opened: false, reason: 'Customer has no WhatsApp phone number on file.' };
  }

  const text = encodeURIComponent(buildInvoiceMessage(invoice, customer, company));
  // `wa.me` works on both iOS and Android and will fall back
  // to the web version if WhatsApp is not installed.
  const url = `https://wa.me/${phone}?text=${text}`;

  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      // Last-resort scheme for older Android devices where
      // the `https` URL isn't auto-claimed by WhatsApp.
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

/**
 * Same as `shareInvoiceViaWhatsApp` but with a neutral
 * dialog title — use this when the user taps the "Share PDF"
 * / "More options" button instead of the WhatsApp CTA.
 */
export async function shareInvoicePdf(
  options: ShareInvoiceOptions,
): Promise<ShareInvoiceResult> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    const msg = 'Sharing is not available on this device.';
    Alert.alert('Cannot share', msg);
    return { shared: false, pdfUri: '', filename: '', reason: msg };
  }

  let pdfUri = '';
  let filename = '';
  try {
    const result = await generateInvoicePdf(options);
    pdfUri = result.uri;
    filename = result.filename;
  } catch (err: any) {
    const msg = err?.message || 'Failed to generate invoice PDF.';
    Alert.alert('PDF error', msg);
    return { shared: false, pdfUri: '', filename: '', reason: msg };
  }

  try {
    await Sharing.shareAsync(pdfUri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: `Share ${options.invoice.invoiceNumber}`,
    });
    return { shared: true, pdfUri, filename };
  } catch (err: any) {
    return { shared: false, pdfUri, filename, reason: err?.message };
  }
}

// Silence unused import warning on iOS-only branches
void Platform;
