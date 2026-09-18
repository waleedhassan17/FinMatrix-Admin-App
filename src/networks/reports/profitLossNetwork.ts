// ═══════════════════════════════════════════════════════
// FinMatrix — Profit & Loss Report Network (Production API)
// ═══════════════════════════════════════════════════════

import { fetchReport } from './reportHelpers';

export const getProfitLossAPI = async (params: { startDate?: string; endDate?: string } = {}, comparisonParams?: any): Promise<any> => {
  const combined = comparisonParams ? { ...params, comparison: comparisonParams } : params;
  return fetchReport('/reports/profit-loss', combined);
};
export const getProfitLossReportAPI = getProfitLossAPI;
