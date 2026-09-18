// ═══════════════════════════════════════════════════════
// FinMatrix — Agency Network (Production API)
// ═══════════════════════════════════════════════════════

import { api, extractErrorMessage } from '../network/apiHelpers';

export const getAgenciesAPI = async (params: any = {}): Promise<any> => {
  try {
    const queryParams = { page: 1, limit: 50, ...params };
    const response = await api.get('/agencies', { params: queryParams });
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const getAgencyByIdAPI = async (id: string): Promise<any> => {
  try {
    const response = await api.get(`/agencies/${id}`);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const createAgencyAPI = async (data: any): Promise<any> => {
  try {
    const response = await api.post('/agencies', data);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const syncAgencyInventoryAPI = async (id: string, data?: any): Promise<any> => {
  try {
    const response = await api.post(`/agencies/${id}/sync-inventory`, data);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const updateAgencyAPI = async (id: string, data: any): Promise<any> => {
  try {
    const response = await api.patch(`/agencies/${id}`, data);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const deleteAgencyAPI = async (id: string): Promise<any> => {
  try {
    const response = await api.delete(`/agencies/${id}`);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

/**
 * GET /agencies/:id/items
 * Returns all InventoryItem records linked to the specified agency
 * (i.e. sourceAgencyId = id).
 */
export const getAgencyItemsAPI = async (agencyId: string): Promise<any> => {
  try {
    const response = await api.get(`/agencies/${agencyId}/items`);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

/**
 * POST /agencies/:id/items
 * Creates a new InventoryItem with sourceAgencyId set to the given agency.
 */
export const addAgencyItemAPI = async (agencyId: string, data: {
  name: string;
  sku: string;
  category?: string;
  unitCost?: string;
  sellingPrice?: string;
  quantityOnHand?: string;
  unitOfMeasure?: string;
}): Promise<any> => {
  try {
    const response = await api.post(`/agencies/${agencyId}/items`, data);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};
