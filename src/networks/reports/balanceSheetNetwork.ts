// ═══════════════════════════════════════════════════════
// FinMatrix — Balance Sheet Report Network (Production API)
// ═══════════════════════════════════════════════════════

import { fetchReport } from './reportHelpers';

export const getBalanceSheetAPI = async (paramsOrDate: string | { asOfDate?: string } = {}): Promise<any> => {
  const params = typeof paramsOrDate === 'string' ? { asOfDate: paramsOrDate } : paramsOrDate;
  return fetchReport('/reports/balance-sheet', params);
};
export const getBalanceSheetReportAPI = getBalanceSheetAPI;
