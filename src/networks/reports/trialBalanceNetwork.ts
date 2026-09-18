// ═══════════════════════════════════════════════════════
// FinMatrix — Trial Balance Report Network (Production API)
// ═══════════════════════════════════════════════════════

import { fetchReport } from './reportHelpers';

export const getTrialBalanceAPI = async (
  params: { startDate?: string; endDate?: string } = {},
): Promise<any> => fetchReport('/reports/trial-balance', params);

export const getTrialBalanceReportAPI = getTrialBalanceAPI;
