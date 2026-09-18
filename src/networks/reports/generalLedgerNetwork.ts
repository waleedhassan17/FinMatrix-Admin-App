// ═══════════════════════════════════════════════════════
// FinMatrix — General Ledger Network (Production API)
// ═══════════════════════════════════════════════════════

import { fetchReport } from './reportHelpers';

export const getGeneralLedgerAPI = async (
  params: { startDate?: string; endDate?: string; account?: string } = {},
): Promise<any> => fetchReport('/ledger', params);

export const getLedgerAccountsAPI = async (
  params: { startDate?: string; endDate?: string } = {},
): Promise<any> => fetchReport('/ledger/accounts', params);
