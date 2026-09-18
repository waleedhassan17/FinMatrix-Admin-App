// ═══════════════════════════════════════════════════════
// FinMatrix — Tax Network (Production API)
// ═══════════════════════════════════════════════════════

import { api, extractErrorMessage } from '../network/apiHelpers';

export const getTaxRatesAPI = async (): Promise<any> => {
  try {
    const response = await api.get('/taxes/rates');
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const createTaxRateAPI = async (data: any): Promise<any> => {
  try {
    const response = await api.post('/taxes/rates', data);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const getTaxLiabilityAPI = async (startDate?: string, endDate?: string): Promise<any> => {
  try {
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const response = await api.get('/taxes/liability', { params });
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const recordTaxPaymentAPI = async (data: any): Promise<any> => {
  try {
    const response = await api.post('/taxes/payments', data);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const createTaxPaymentAPI = async (data: any): Promise<any> => {
  return recordTaxPaymentAPI(data);
};

export const updateTaxRateAPI = async (id: string, data: any): Promise<any> => {
  try {
    const response = await api.patch(`/taxes/rates/${id}`, data);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const deleteTaxRateAPI = async (id: string): Promise<any> => {
  try {
    const response = await api.delete(`/taxes/rates/${id}`);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};
