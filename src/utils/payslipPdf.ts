// ═══════════════════════════════════════════════════════
// FinMatrix — Payslip PDF (view / download / share)
// ═══════════════════════════════════════════════════════
// The payslip PDF is rendered by the BACKEND
// (GET /payroll/runs/:runId/payslip/:employeeId/pdf) so every figure on
// the document comes off the posted payroll entry — this module only
// fetches the bytes (through the authenticated axios instance, so token
// refresh and x-company-id apply) and hands them to the platform:
//
//   view      → open in the OS PDF viewer (Android content-URI intent,
//               iOS share-sheet Quick Look, web new tab)
//   download  → save a copy (Android SAF picker, iOS "Save to Files"
//               via share-sheet, web anchor download)
//   share     → native share-sheet / web share, mime application/pdf
//
// Payslips carry personal salary data: the file only ever lands in the
// app's private cache (or wherever the user explicitly saves it).

import { Linking, Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

import { getPayslipPdfAPI } from '../networks/payroll/payrollNetwork';

export interface PayslipRef {
  runId: string;
  employeeId: string;
  /** e.g. "June 2026" — used for the filename only. */
  payPeriod: string;
  /** Used for the filename only. */
  employeeName: string;
}

export interface PayslipActionResult {
  done: boolean;
  /** Human-readable reason when `done === false` (cancel is not an error). */
  reason?: string;
}

const sanitize = (v: string) => v.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60) || 'Payslip';
const filenameFor = (p: PayslipRef) => `Payslip_${sanitize(p.payPeriod)}_${sanitize(p.employeeName)}.pdf`;

// ─── Fetch helpers ──────────────────────────────────

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the PDF data.'));
    reader.onloadend = () => {
      const dataUrl = String(reader.result || '');
      const base64 = dataUrl.split(',')[1];
      if (!base64) reject(new Error('Empty PDF received.'));
      else resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

/** Native: fetch the PDF and persist it in the app-private cache dir. */
async function fetchToCache(p: PayslipRef): Promise<{ uri: string; filename: string; base64: string }> {
  const blob = await getPayslipPdfAPI(p.runId, p.employeeId);
  const base64 = await blobToBase64(blob);
  const filename = filenameFor(p);
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  return { uri, filename, base64 };
}

/** Web: fetch the PDF as an object URL. */
async function fetchToObjectUrl(p: PayslipRef): Promise<{ url: string; filename: string }> {
  const blob = await getPayslipPdfAPI(p.runId, p.employeeId);
  const pdfBlob = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
  return { url: URL.createObjectURL(pdfBlob), filename: filenameFor(p) };
}

async function openShareSheet(uri: string, dialogTitle: string): Promise<PayslipActionResult> {
  if (!(await Sharing.isAvailableAsync())) {
    return { done: false, reason: 'Sharing is not available on this device.' };
  }
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle });
  return { done: true };
}

// ─── Actions ────────────────────────────────────────

/** Open the payslip in a PDF viewer. */
export async function viewPayslipPdf(p: PayslipRef): Promise<PayslipActionResult> {
  if (Platform.OS === 'web') {
    const { url } = await fetchToObjectUrl(p);
    window.open(url, '_blank');
    return { done: true };
  }
  const { uri, filename } = await fetchToCache(p);
  if (Platform.OS === 'android') {
    try {
      // ACTION_VIEW on a FileProvider content-URI → default PDF viewer.
      const contentUri = await FileSystem.getContentUriAsync(uri);
      await Linking.openURL(contentUri);
      return { done: true };
    } catch {
      // No PDF viewer installed / intent refused → share-sheet ("Open with…").
      return openShareSheet(uri, `Open ${filename}`);
    }
  }
  // iOS: the share-sheet gives Quick Look plus every installed PDF app.
  return openShareSheet(uri, `View ${filename}`);
}

/** Save a copy of the payslip where the user chooses. */
export async function downloadPayslipPdf(p: PayslipRef): Promise<PayslipActionResult> {
  if (Platform.OS === 'web') {
    const { url, filename } = await fetchToObjectUrl(p);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return { done: true };
  }
  const { uri, filename, base64 } = await fetchToCache(p);
  if (Platform.OS === 'android') {
    // Storage Access Framework: the user picks a folder (e.g. Downloads)
    // and we write the PDF there — a real, persistent download.
    const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!perm.granted) return { done: false, reason: 'Folder selection cancelled.' };
    const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
      perm.directoryUri, filename, 'application/pdf',
    );
    await FileSystem.writeAsStringAsync(destUri, base64, { encoding: FileSystem.EncodingType.Base64 });
    return { done: true };
  }
  // iOS has no folder picker API — "Save to Files" on the share-sheet is
  // the platform-standard download.
  return openShareSheet(uri, `Save ${filename}`);
}

/** Share the payslip PDF (WhatsApp, email, Drive, …). */
export async function sharePayslipPdf(p: PayslipRef): Promise<PayslipActionResult> {
  if (Platform.OS === 'web') {
    const blob = await getPayslipPdfAPI(p.runId, p.employeeId);
    const filename = filenameFor(p);
    const file = new File([blob], filename, { type: 'application/pdf' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return { done: true };
    }
    // No web-share support → fall back to downloading the file.
    return downloadPayslipPdf(p);
  }
  const { uri, filename } = await fetchToCache(p);
  return openShareSheet(uri, `Share ${filename}`);
}
