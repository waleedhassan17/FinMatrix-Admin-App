// ═══════════════════════════════════════════════════════
// FinMatrix — Cash Flow Report Network (Production API)
// ═══════════════════════════════════════════════════════

import { fetchReport } from './reportHelpers';

export const getCashFlowAPI = async (
  params: { startDate?: string; endDate?: string } = {},
): Promise<any> => fetchReport('/reports/cash-flow', params);

export const getCashFlowReportAPI = getCashFlowAPI;
