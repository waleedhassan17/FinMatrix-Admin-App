// ═══════════════════════════════════════════════════════
// FinMatrix — Payment Network (Production API)
// ═══════════════════════════════════════════════════════

import { api, extractErrorMessage } from '../network/apiHelpers';

export const receivePaymentAPI = async (data: any): Promise<any> => {
  try {
    const response = await api.post('/payments', data);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const getOutstandingInvoicesAPI = async (customerId: string): Promise<any> => {
  try {
    const response = await api.get(`/payments/customer/${customerId}/outstanding`);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const getPaymentHistoryAPI = async (params: any = {}): Promise<any> => {
  try {
    const response = await api.get('/payments', { params });
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const getPaymentByIdAPI = async (id: string): Promise<any> => {
  try {
    const response = await api.get(`/payments/${id}`);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const createPaymentAPI = async (data: any): Promise<any> => {
  return receivePaymentAPI(data);
};

export const getPaymentsAPI = async (params: any = {}): Promise<any> => {
  return getPaymentHistoryAPI(params);
};

export const getPaymentsByInvoiceAPI = async (invoiceId: string): Promise<any> => {
  try {
    const response = await api.get('/payments', { params: { invoiceId } });
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

/** Receipts still holding unapplied money (customer advances). */
export const getCustomerAdvancesAPI = async (customerId: string): Promise<any> => {
  try {
    const response = await api.get(`/payments/customer/${customerId}/advances`);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

/**
 * Apply money a receipt holds as an advance to invoices. No cash moves: the
 * server posts Dr Customer Advances / Cr Accounts Receivable. Staff get an
 * approval request back (`pending: true`).
 */
export const applyPaymentAdvanceAPI = async (
  paymentId: string,
  applications: Array<{ invoiceId: string; amount: string }>,
): Promise<any> => {
  try {
    const response = await api.post(`/payments/${paymentId}/apply`, { applications });
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};
