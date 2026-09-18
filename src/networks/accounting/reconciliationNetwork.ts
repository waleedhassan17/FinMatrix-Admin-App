// ═══════════════════════════════════════════════════════
// FinMatrix — Bank Reconciliation Network (FinMatrix.md §27)
// ═══════════════════════════════════════════════════════

import { api, extractErrorMessage } from '../network/apiHelpers';

const wrap = async (p: Promise<any>) => {
  try { return (await p).data; } catch (e: any) { throw new Error(extractErrorMessage(e)); }
};

export const getReconcilableAccountsAPI = () =>
  wrap(api.get('/reconciliations/accounts'));

export const getUnreconciledAPI = (accountId: string, endDate?: string) =>
  wrap(api.get('/reconciliations/unreconciled', { params: { accountId, ...(endDate ? { endDate } : {}) } }));

export const getReconciliationsAPI = (accountId?: string) =>
  wrap(api.get('/reconciliations', { params: accountId ? { accountId } : {} }));

export const getReconciliationByIdAPI = (id: string) =>
  wrap(api.get(`/reconciliations/${id}`));

export const createReconciliationAPI = (data: {
  accountId: string;
  statementDate: string;
  statementEndingBalance: string;
  clearedEntryIds: string[];
  notes?: string;
}) => wrap(api.post('/reconciliations', data));

export const deleteReconciliationAPI = (id: string) =>
  wrap(api.delete(`/reconciliations/${id}`));

/**
 * Save-and-resume: persist in-progress cleared ticks server-side so exiting
 * mid-reconciliation retains them (marks only — no ledger impact).
 */
export const markClearedAPI = (
  accountId: string,
  marks: Array<{ entryId: string; cleared: boolean }>,
) => wrap(api.patch('/reconciliations/mark', { accountId, marks }));
