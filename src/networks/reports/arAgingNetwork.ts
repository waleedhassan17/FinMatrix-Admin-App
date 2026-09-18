// ═══════════════════════════════════════════════════════
// FinMatrix — AR Aging Report Network (Production API)
// ═══════════════════════════════════════════════════════

import { fetchReport } from './reportHelpers';

export const getARAgingAPI = async (params: any = {}): Promise<any> => {
  // The slice passes asOfDate as a string; axios needs an object for `params`.
  const query = typeof params === 'string' ? { asOfDate: params } : params;
  return fetchReport('/reports/ar-aging', query);
};
export const getARAgingReportAPI = getARAgingAPI;
