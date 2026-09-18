// ═══════════════════════════════════════════════════════
// FinMatrix — Admin Dashboard Network (Production API)
// ═══════════════════════════════════════════════════════

import { api, extractErrorMessage } from '../network/apiHelpers';

export const getAdminDashboardSummaryAPI = async (): Promise<any> => {
  try {
    const response = await api.get('/reports/dashboard');
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const getRecentInvoicesAPI = async (): Promise<any> => {
  try {
    const response = await api.get('/invoices', { params: { page: 1, limit: 8 } });
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const getDeliveryStatsAPI = async (): Promise<any> => {
  try {
    const response = await api.get('/deliveries', { params: { page: 1, limit: 100 } });
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};
