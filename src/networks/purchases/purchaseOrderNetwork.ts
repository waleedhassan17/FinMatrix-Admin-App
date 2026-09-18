// ═══════════════════════════════════════════════════════
// FinMatrix — Purchase Order Network (Production API)
// ═══════════════════════════════════════════════════════

import { api, extractErrorMessage } from '../network/apiHelpers';
import type { ApiPOStatus } from '../../models/purchaseOrderModel';

// ─── Write payloads (mirror the API DTOs) ────────────
// Typed rather than `any` because this is exactly the bug class that shipped:
// the app posted `quantity`/`unitPrice`, the DTO requires `orderedQty`/
// `unitCost`, and with `whitelist: true` the former were stripped and the
// latter reported missing. Decimals go over the wire as numeric strings.
export interface PurchaseOrderLineWritePayload {
  description: string;
  orderedQty: string;
  unitCost: string;
  taxRate?: string;
  /** Inventory companies require every line to be classified: 'item' needs
   *  itemId, 'expense' needs accountId. */
  lineKind?: 'item' | 'expense';
  /** Omitted entirely for non-inventory lines — '' would fail @IsUUID. */
  itemId?: string;
  accountId?: string;
}

export interface PurchaseOrderWritePayload {
  vendorId: string;
  orderDate: string;
  expectedDate?: string;
  notes?: string;
  lines: PurchaseOrderLineWritePayload[];
}

/** `receivedQty` is the ABSOLUTE cumulative total received, not this
 *  receipt's delta — the server derives the delta itself. */
export interface ReceivePOPayload {
  lines: Array<{ lineId: string; receivedQty: string }>;
}

export interface POQueryParams {
  search?: string;
  status?: string;
  vendorId?: string;
  page?: number;
  limit?: number;
}

export const getPurchaseOrdersAPI = async (params: POQueryParams = {}): Promise<any> => {
  try {
    const response = await api.get('/purchase-orders', { params });
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const getPurchaseOrderByIdAPI = async (id: string): Promise<any> => {
  try {
    const response = await api.get(`/purchase-orders/${id}`);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const createPurchaseOrderAPI = async (
  data: PurchaseOrderWritePayload,
): Promise<any> => {
  try {
    const response = await api.post('/purchase-orders', data);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const receivePurchaseOrderAPI = async (
  id: string,
  data: ReceivePOPayload,
): Promise<any> => {
  try {
    const response = await api.post(`/purchase-orders/${id}/receive`, data);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

/** Server-side conversion of received goods into a vendor bill. This is the
 *  ONLY correct way to bill a PO: it debits GRNI to clear what the receipt
 *  accrued, rather than debiting Inventory a second time, and it bills the
 *  received-but-not-yet-billed quantity carrying each line's tax. It can be
 *  called once per receipt; with nothing left to bill it fails NOTHING_TO_BILL.
 *
 *  Every field is optional. Leave the dates out and the server uses the
 *  business date and the vendor's payment terms — the phone's UTC date read
 *  yesterday in Pakistan before 05:00. Responds `{ po, billId, bill }`. */
export const convertPOToBillAPI = async (
  id: string,
  data: { billNumber?: string; billDate?: string; dueDate?: string; defaultAccountId?: string } = {},
): Promise<any> => {
  try {
    const response = await api.post(`/purchase-orders/${id}/create-bill`, data);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

/** Status lives on its own route with a `{ status }` body. This used to PATCH
 *  the PO itself with a bare string, which the body parser rejected — so
 *  "Send to Vendor" and "Close" never worked. */
export const updatePOStatusAPI = async (id: string, status: ApiPOStatus): Promise<any> => {
  try {
    const response = await api.patch(`/purchase-orders/${id}/status`, { status });
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const deletePurchaseOrderAPI = async (id: string): Promise<any> => {
  try {
    const response = await api.delete(`/purchase-orders/${id}`);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

/** The PATCH route takes the same DTO as create, so vendorId/orderDate/lines
 *  are required here too. Note the server rebuilds every line and resets
 *  receivedQty — callers must refuse to edit a PO that has receipts. */
export const updatePurchaseOrderAPI = async (
  id: string,
  data: PurchaseOrderWritePayload,
): Promise<any> => {
  try {
    const response = await api.patch(`/purchase-orders/${id}`, data);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};
