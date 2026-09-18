// ═══════════════════════════════════════════════════════
// FinMatrix — Delivery Daily Report Network (Production API)
// ═══════════════════════════════════════════════════════

import { fetchReport } from './reportHelpers';

export const getDeliveryDailyReportAPI = async (params: any = {}): Promise<any> => {
  const query = typeof params === 'string' ? { date: params } : params;
  return fetchReport('/reports/delivery-daily', query);
};
