// ═══════════════════════════════════════════════════════
// FinMatrix — Customer Network (Production API)
// ═══════════════════════════════════════════════════════

import { api, extractErrorMessage } from '../network/apiHelpers';
import type { Customer } from '../../types';

// ─── Query Params ────────────────────────────────────

export interface CustomerQueryParams {
  search?: string;
  isActive?: boolean;
  hasBalance?: boolean;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  limit?: number;
}

// ═══════════════════════════════════════════════════════
// API Functions
// ═══════════════════════════════════════════════════════

export const getCustomersAPI = async (params: CustomerQueryParams = {}): Promise<any> => {
  try {
    const response = await api.get('/customers', { params });
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const getCustomerByIdAPI = async (id: string): Promise<any> => {
  try {
    const response = await api.get(`/customers/${id}`);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const createCustomerAPI = async (data: Partial<Customer>): Promise<any> => {
  try {
    const response = await api.post('/customers', data);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const updateCustomerAPI = async (id: string, data: Partial<Customer>): Promise<any> => {
  try {
    const response = await api.patch(`/customers/${id}`, data);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const deleteCustomerAPI = async (id: string): Promise<any> => {
  try {
    const response = await api.delete(`/customers/${id}`);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const toggleCustomerActiveAPI = async (id: string): Promise<any> => {
  try {
    const response = await api.patch(`/customers/${id}/toggle-active`);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const getCustomerInvoicesAPI = async (
  customerId: string,
  params: { page?: number; limit?: number } = {},
): Promise<any> => {
  try {
    const response = await api.get(`/customers/${customerId}/invoices`, { params });
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const getCustomerPaymentsAPI = async (
  customerId: string,
  params: { page?: number; limit?: number } = {},
): Promise<any> => {
  try {
    const response = await api.get(`/customers/${customerId}/payments`, { params });
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const getCustomerStatementAPI = async (customerId: string, params?: { startDate?: string; endDate?: string }): Promise<any> => {
  try {
    const response = await api.get(`/customers/${customerId}/statement`, { params });
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};
