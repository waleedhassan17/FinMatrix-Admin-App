// ═══════════════════════════════════════════════════════
// FinMatrix — Bill Network (Production API)
// ═══════════════════════════════════════════════════════

import { Platform } from 'react-native';
// The /legacy entrypoint, as deliveryNetwork and billingNetwork use: the SDK
// 19 API dropped cacheDirectory/downloadAsync in favour of File/Paths.
import * as FileSystem from 'expo-file-system/legacy';
import {
  api,
  appendImageToForm,
  extractErrorMessage,
  postMultipart,
  API_BASE_URL,
  getAccessToken,
  getStoredCompanyId,
} from '../network/apiHelpers';

export interface BillQueryParams {
  search?: string;
  status?: string;
  vendorId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export const getBillsAPI = async (params: BillQueryParams = {}): Promise<any> => {
  try {
    const response = await api.get('/bills', { params });
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const getBillByIdAPI = async (id: string): Promise<any> => {
  try {
    const response = await api.get(`/bills/${id}`);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const createBillAPI = async (data: any): Promise<any> => {
  try {
    const response = await api.post('/bills', data);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const updateBillAPI = async (id: string, data: any): Promise<any> => {
  try {
    const response = await api.patch(`/bills/${id}`, data);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

/** POST /bills/pay — PayBillsDto. Mirrors the API exactly: it is transactional
 *  (locks each bill, writes amountPaid/balance/status, adjusts the vendor
 *  balance, posts DR AP / CR Bank), so callers must NOT patch the bills
 *  afterwards. Amounts are @IsNumberString. */
export interface PayBillsPayload {
  vendorId: string;
  paymentDate: string;
  paymentMethod: string;
  bankAccountId: string;
  reference?: string;
  /** Required by the API — see uploadBillPaymentProofAPI. */
  proofId: string;
  applications: Array<{ billId: string; amount: string }>;
}

export const payBillsAPI = async (data: PayBillsPayload): Promise<any> => {
  try {
    const response = await api.post('/bills/pay', data);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

// ── Payment proof ─────────────────────────────────────
// Two steps by design: the file is uploaded here and the pay request quotes
// the id it returns, so the financial endpoint stays JSON.

export interface BillPaymentProof {
  id: string;
  url: string;
  mimeType: string;
  originalName: string;
  size: number;
}

/**
 * Upload a receipt, bank confirmation or photo of a cash voucher.
 *
 * appendImageToForm, not a hand-built FormData: the `{uri, name, type}` shape
 * is React Native's, and on web it appends the literal string
 * "[object Object]" — the request reaches the server carrying no file at all,
 * which surfaces as the API's own "a payment proof is required" 400. The
 * helper resolves blob:/data:/file: URIs to a real Blob on web and keeps the
 * native shape (with the iOS file:// strip) everywhere else.
 *
 * name and type are passed explicitly because the helper otherwise guesses the
 * MIME from the extension and only knows about images — a PDF would go up
 * labelled image/jpeg and be refused.
 *
 * postMultipart, not `api.post`: it omits Content-Type so the platform writes
 * the multipart boundary itself.
 */
export const uploadBillPaymentProofAPI = async (file: {
  uri: string;
  name: string;
  mimeType: string;
}): Promise<BillPaymentProof> => {
  const form = new FormData();
  await appendImageToForm(form, 'proof', file.uri, {
    name: file.name,
    type: file.mimeType,
  });
  const res = await postMultipart('/bill-payments/proofs', form);
  return res?.data ?? res;
};

/**
 * Fetch a proof as a LOCAL file:// URI.
 *
 * The stored url points at an auth-gated API route, not a CDN. React Native's
 * `<Image source={{ uri, headers }} />` does not reliably attach the token, so
 * pointing an <Image> straight at it yields a 401 and renders blank. Mirrors
 * downloadBillPhoto in deliveryNetwork.
 */
export const downloadBillPaymentProof = async (proofId: string): Promise<string> => {
  const token = await getAccessToken();
  const companyId = await getStoredCompanyId();
  const path = `/bill-payments/proofs/${proofId}/file`;
  const headers = {
    Authorization: token ? `Bearer ${token}` : '',
    ...(companyId ? { 'x-company-id': companyId } : {}),
  };

  if (Platform.OS === 'web') {
    // expo-file-system has no web implementation.
    const res = await fetch(`${API_BASE_URL}${path}`, { headers });
    if (!res.ok) {
      throw new Error(
        res.status === 404
          ? 'This payment has no proof on file.'
          : `Could not load the proof (${res.status}).`,
      );
    }
    return URL.createObjectURL(await res.blob());
  }

  const dest = `${FileSystem.cacheDirectory}payment-proof-${proofId}-${Date.now()}`;
  const result = await FileSystem.downloadAsync(`${API_BASE_URL}${path}`, dest, { headers });
  if (result.status >= 400) {
    throw new Error(
      result.status === 404
        ? 'This payment has no proof on file.'
        : `Could not load the proof (${result.status}).`,
    );
  }
  return result.uri;
};

/**
 * The proof id out of a stored proof URL (`/bill-payments/proofs/<id>/file`).
 * Payments store the url, not the id, so the viewer recovers it from there —
 * and historical payments, which have neither, simply yield null.
 */
export const proofIdFromUrl = (url?: string | null): string | null =>
  url?.match(/\/bill-payments\/proofs\/([0-9a-f-]{36})\/file/i)?.[1] ?? null;

export const deleteBillAPI = async (id: string): Promise<any> => {
  try {
    const response = await api.delete(`/bills/${id}`);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const getBillPaymentsByBillAPI = async (billId: string): Promise<any> => {
  try {
    const response = await api.get(`/bills/${billId}/payments`);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};
