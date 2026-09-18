// ═══════════════════════════════════════════════════════
// FinMatrix — Inventory Valuation Report Network (Production API)
// ═══════════════════════════════════════════════════════

import { fetchReport } from './reportHelpers';

export const getInventoryValuationAPI = async (params: any = {}): Promise<any> => {
  return fetchReport('/reports/inventory-valuation', params);
};
export const getInventoryValuationReportAPI = getInventoryValuationAPI;
