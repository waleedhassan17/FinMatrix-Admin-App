// ═══════════════════════════════════════════════════════
// FinMatrix — Invoice Network (Production API)
// ═══════════════════════════════════════════════════════

import { api, extractErrorMessage, toApiError } from '../network/apiHelpers';
import { creditOverrideBody } from '../../models/creditModel';
import type { Invoice } from '../../types';

export interface InvoiceQueryParams {
  search?: string;
  status?: string;
  customerId?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export const getInvoicesAPI = async (params: InvoiceQueryParams = {}): Promise<any> => {
  try {
    const queryParams: any = { ...params };
    if (params.fromDate) { queryParams.startDate = params.fromDate; delete queryParams.fromDate; }
    if (params.toDate) { queryParams.endDate = params.toDate; delete queryParams.toDate; }
    const response = await api.get('/invoices', { params: queryParams });
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const getInvoiceByIdAPI = async (id: string): Promise<any> => {
  try {
    const response = await api.get(`/invoices/${id}`);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const createInvoiceAPI = async (data: Partial<Invoice>, overrideReason?: string): Promise<any> => {
  try {
    const response = await api.post('/invoices', { ...data, ...creditOverrideBody(overrideReason) });
    return response.data;
  } catch (e: any) {
    // Keeps the code and details: a posted invoice can be refused for the
    // customer's credit limit or an unclassified line.
    throw toApiError(e);
  }
};

export const updateInvoiceAPI = async (id: string, data: Partial<Invoice>): Promise<any> => {
  try {
    const response = await api.patch(`/invoices/${id}`, data);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const deleteInvoiceAPI = async (id: string): Promise<any> => {
  try {
    const response = await api.delete(`/invoices/${id}`);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const sendInvoiceAPI = async (
  id: string,
  meta?: { channel?: string; toPhone?: string },
  overrideReason?: string,
): Promise<any> => {
  try {
    const response = await api.post(`/invoices/${id}/send`, { ...(meta ?? {}), ...creditOverrideBody(overrideReason) });
    return response.data;
  } catch (e: any) {
    throw toApiError(e);
  }
};

export const voidInvoiceAPI = async (id: string, reason: string): Promise<any> => {
  try {
    const response = await api.post(`/invoices/${id}/void`, { reason });
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const getInvoicePdfAPI = async (id: string): Promise<Blob> => {
  try {
    const response = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};
