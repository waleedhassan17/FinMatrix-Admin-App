// ═══════════════════════════════════════════════════════
// FinMatrix — Inventory Network (Production API)
// ═══════════════════════════════════════════════════════

import { api, extractErrorMessage } from '../network/apiHelpers';
import type {
  CreateInventoryItemPayload,
  UpdateInventoryItemPayload,
} from '../../models/inventoryModel';
import type { AdjustmentReason } from '../../models/adjustmentModel';

export interface InventoryQueryParams {
  search?: string;
  category?: string;
  stockStatus?: string;
  agencyId?: string;
  sortBy?: string;
  page?: number;
  limit?: number;
}

export const getInventoryItemsAPI = async (params: InventoryQueryParams = {}): Promise<any> => {
  try {
    // 50 silently truncated every item dropdown in the app (PO, invoice, credit
  // memo, delivery) with no indication anything was missing, because the
  // screens filter client-side. The API caps nothing.
  const queryParams = { page: 1, limit: 500, ...params };
    const response = await api.get('/inventory/items', { params: queryParams });
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const getInventoryItemByIdAPI = async (id: string): Promise<any> => {
  try {
    const response = await api.get(`/inventory/items/${id}`);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const createInventoryItemAPI = async (
  data: CreateInventoryItemPayload,
): Promise<any> => {
  try {
    const response = await api.post('/inventory/items', data);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const updateInventoryItemAPI = async (
  id: string,
  data: UpdateInventoryItemPayload,
): Promise<any> => {
  try {
    const response = await api.patch(`/inventory/items/${id}`, data);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

// AdjustQuantityDto: newQty is the ABSOLUTE target quantity as a numeric
// string (@IsNumberString), not a delta — the service derives the variance
// itself. The old `number | { newQuantity ... }` union let callers post a bare
// scalar that axios sent as raw JSON, and named the field `newQuantity`, which
// the API has never accepted. Both arms 400'd; the union is what let them
// type-check.
//
// referenceNum is intentionally not sent: the DTO validates it @IsUUID() while
// the column is varchar(64), and adjust() never persists it anyway.
export const adjustStockAPI = async (
  id: string,
  data: { itemId: string; newQty: string; reason: AdjustmentReason; notes?: string },
): Promise<any> => {
  try {
    const response = await api.post(`/inventory/items/${id}/adjust`, data);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

// Records stock the company already owned before it started using FinMatrix.
// Posts Dr Inventory 1200 / Cr Opening Balance Equity 3900 — no vendor, no
// payable, and no P&L movement, which is why this exists instead of letting
// people type an opening quantity onto the item form. One-time per item; the
// server refuses a second call and points at Stock Adjustment.
export const setOpeningStockAPI = async (
  id: string,
  data: { quantity: string; asOfDate?: string; notes?: string },
): Promise<any> => {
  try {
    const response = await api.post(`/inventory/items/${id}/opening-stock`, data);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const getStockMovementsAPI = async (id: string, params: any = {}): Promise<any> => {
  try {
    const response = await api.get(`/inventory/items/${id}/movements`, { params });
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

// The dedicated /toggle route flips isActive server-side and takes no body.
// This used to PATCH the plain item route with a hardcoded `{ isActive: true }`,
// so Deactivate reactivated an already-active item and the UI never changed —
// deactivation has never worked. Admin-only on the server (the rest of
// inventory is admin+staff), so a staff user gets a 403 that the caller
// surfaces.
export const toggleInventoryItemAPI = async (id: string): Promise<any> => {
  try {
    const response = await api.patch(`/inventory/items/${id}/toggle`);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};
