// ═══════════════════════════════════════════════════════
// FinMatrix — AP Aging Report Network (Production API)
// ═══════════════════════════════════════════════════════
// The endpoint has existed since the reports module was written; nothing in
// the app ever called it, so there was no payables counterpart to A/R Aging.

import { fetchReport } from './reportHelpers';

export const getAPAgingAPI = async (params: any = {}): Promise<any> => {
  // The slice passes asOfDate as a string; axios needs an object for `params`.
  const query = typeof params === 'string' ? { asOfDate: params } : params;
  return fetchReport('/reports/ap-aging', query);
};
export const getAPAgingReportAPI = getAPAgingAPI;
