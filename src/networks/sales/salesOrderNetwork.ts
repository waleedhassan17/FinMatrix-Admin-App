// ═══════════════════════════════════════════════════════
// FinMatrix — Sales Order Network (Production API)
// ═══════════════════════════════════════════════════════

import { api, toApiError } from '../network/apiHelpers';
import { creditOverrideBody } from '../../models/creditModel';

const wrap = async (p: Promise<any>) => {
  // toApiError keeps the server's code and details (credit breakdown,
  // backorder shortfalls) so screens can offer the right way forward.
  try { return (await p).data; } catch (e: any) { throw toApiError(e); }
};

export const getSalesOrdersAPI = (params: any = {}) => wrap(api.get('/sales-orders', { params }));
export const getSalesOrderByIdAPI = (id: string) => wrap(api.get(`/sales-orders/${id}`));
/** `acceptBackorder` confirms saving with items short; without it the server
 *  answers 409 BACKORDER_CONFIRMATION_REQUIRED listing the shortfalls. */
export const createSalesOrderAPI = (data: any, opts: { acceptBackorder?: boolean } = {}) =>
  wrap(api.post('/sales-orders', opts.acceptBackorder ? { ...data, acceptBackorder: true } : data));
export const updateSalesOrderAPI = (id: string, data: any, opts: { acceptBackorder?: boolean } = {}) =>
  wrap(api.patch(`/sales-orders/${id}`, opts.acceptBackorder ? { ...data, acceptBackorder: true } : data));
/** Shipping is checked against the credit limit; the owner may override with a reason. */
export const fulfillSalesOrderAPI = (
  id: string,
  lines: { lineId: string; quantityFulfilled: string }[],
  overrideReason?: string,
) => wrap(api.post(`/sales-orders/${id}/fulfill`, { lines, ...creditOverrideBody(overrideReason) }));
export const convertSalesOrderToInvoiceAPI = (id: string, dueDate?: string, overrideReason?: string) =>
  wrap(api.post(`/sales-orders/${id}/convert-to-invoice`, {
    ...(dueDate ? { dueDate } : {}),
    ...creditOverrideBody(overrideReason),
  }));
export const cancelSalesOrderAPI = (id: string) => wrap(api.post(`/sales-orders/${id}/cancel`, {}));
export const deleteSalesOrderAPI = (id: string) => wrap(api.delete(`/sales-orders/${id}`));
