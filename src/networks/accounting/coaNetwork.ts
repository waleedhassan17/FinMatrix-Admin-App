// ═══════════════════════════════════════════════════════
// FinMatrix — Chart of Accounts Network (Production API)
// ═══════════════════════════════════════════════════════

import { api, extractErrorMessage } from '../network/apiHelpers';

export interface AccountQueryParams {
  type?: string;
  subType?: string;
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export const getAccountsAPI = async (params: AccountQueryParams = {}): Promise<any> => {
  try {
    const response = await api.get('/accounts', { params });
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const getAccountByIdAPI = async (id: string): Promise<any> => {
  try {
    const response = await api.get(`/accounts/${id}`);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const createAccountAPI = async (data: any): Promise<any> => {
  try {
    const response = await api.post('/accounts', data);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const updateAccountAPI = async (id: string, data: any): Promise<any> => {
  try {
    const response = await api.patch(`/accounts/${id}`, data);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const toggleAccountActiveAPI = async (id: string): Promise<any> => {
  try {
    const response = await api.patch(`/accounts/${id}/toggle`);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const getAccountTransactionsAPI = async (id: string, params: any = {}): Promise<any> => {
  try {
    const response = await api.get(`/accounts/${id}/transactions`, { params });
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const toggleAccountAPI = async (id: string): Promise<any> => {
  return toggleAccountActiveAPI(id);
};
