// ═══════════════════════════════════════════════════════
// FinMatrix — Report Helpers (Production API)
// ═══════════════════════════════════════════════════════

import { api, extractErrorMessage } from '../network/apiHelpers';

export const fetchReport = async (endpoint: string, params: any = {}): Promise<any> => {
  try {
    const response = await api.get(endpoint, { params });
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const unwrapEnvelope = <T = any>(response: any): T => {
  if (response?.success && response?.data !== undefined) return response.data;
  if (response?.data?.success && response?.data?.data !== undefined) return response.data.data;
  return response?.data ?? response;
};
