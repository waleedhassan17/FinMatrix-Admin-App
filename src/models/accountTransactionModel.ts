// ═══════════════════════════════════════════════════════
// FinMatrix — Account Transaction Model
// ═══════════════════════════════════════════════════════
// Real data: GET /accounts/:id/transactions (general-ledger rows for the
// account, newest first, paginated {data:{data,pagination}} after the
// response envelope).

import { getAccountTransactionsAPI } from '../networks/accounting/coaNetwork';

export interface AccountTransaction {
  id: string;
  date: string;
  reference: string;
  memo: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

const num = (v: unknown) => parseFloat(String(v ?? '0')) || 0;

/** Ledger rows for one account, mapped for the COA detail Transactions tab. */
export const fetchAccountTransactions = async (
  accountId: string,
  limit = 50,
): Promise<AccountTransaction[]> => {
  const raw = await getAccountTransactionsAPI(accountId, { page: 1, limit });
  const payload = raw?.data ?? raw;
  const rows: any[] = Array.isArray(payload) ? payload : payload?.data ?? [];
  return rows.map(g => ({
    id: g.id,
    date: g.date,
    reference: g.reference ?? '',
    memo: g.memo ?? '',
    debit: num(g.debit),
    credit: num(g.credit),
    runningBalance: num(g.balance),
  }));
};

/** @deprecated kept for compatibility; the screen now fetches for real. */
export const getAccountTransactions = (_accountId: string): AccountTransaction[] => [];
