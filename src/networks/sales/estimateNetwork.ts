// ═══════════════════════════════════════════════════════
// FinMatrix — Estimate Network (Production API)
// ═══════════════════════════════════════════════════════

import { api, toApiError } from '../network/apiHelpers';
import { creditOverrideBody } from '../../models/creditModel';
import type { EstimateQueryParams } from '../../models/estimateModel';

const wrap = async (p: Promise<any>) => {
  // toApiError keeps the server's code and details (credit breakdown,
  // backorder shortfalls) so screens can offer the right way forward.
  try { return (await p).data; } catch (e: any) { throw toApiError(e); }
};

export const getEstimatesAPI = (params: EstimateQueryParams = {}) =>
  wrap(api.get('/estimates', { params }));

export const getEstimateByIdAPI = (id: string) => wrap(api.get(`/estimates/${id}`));

export const createEstimateAPI = (data: any) => wrap(api.post('/estimates', data));

export const updateEstimateAPI = (id: string, data: any) => wrap(api.patch(`/estimates/${id}`, data));

export const setEstimateStatusAPI = (id: string, status: 'sent' | 'accepted' | 'declined') =>
  wrap(api.patch(`/estimates/${id}/status`, { status }));

export const convertEstimateToInvoiceAPI = (id: string, dueDate?: string, overrideReason?: string) =>
  wrap(api.post(`/estimates/${id}/convert-to-invoice`, {
    ...(dueDate ? { dueDate } : {}),
    ...creditOverrideBody(overrideReason),
  }));

export const convertEstimateToSalesOrderAPI = (id: string, opts: { acceptBackorder?: boolean } = {}) =>
  wrap(api.post(`/estimates/${id}/convert-to-sales-order`, opts.acceptBackorder ? { acceptBackorder: true } : {}));

export const deleteEstimateAPI = (id: string) => wrap(api.delete(`/estimates/${id}`));
