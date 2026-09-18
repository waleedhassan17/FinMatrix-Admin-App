import type { ApiEnvelope, ReportDateRange } from './reportModel';

export interface LedgerEntry {
  /** Posting date, 'YYYY-MM-DD'. A DATE in the ledger — it carries no time. */
  date: string;
  /** When the entry was actually recorded — the audit-trail timestamp. */
  postedAt: string;
  reference: string;
  accountCode: string;
  accountName: string;
  memo: string;
  debit: number;
  credit: number;
  balance: number;
  sourceType: string;
  sourceId: string;
  /** A voided journal shown beside its reversal, so the account still nets. */
  voided?: boolean;
}

export interface LedgerAccountBalance {
  accountCode: string;
  accountName: string;
  balance: number;
}

export interface GeneralLedgerReport {
  range: ReportDateRange;
  accountCode: string | null;
  entries: LedgerEntry[];
  /** Balance brought forward from before the range, per account in view. */
  openingBalances?: LedgerAccountBalance[];
  closingBalances?: LedgerAccountBalance[];
  totals: { debit: number; credit: number };
}

export interface LedgerAccountSummary {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  balance: number;
  entries: number;
}

export interface LedgerAccountsReport {
  range: ReportDateRange;
  accounts: LedgerAccountSummary[];
}

export type GeneralLedgerResponse = ApiEnvelope<GeneralLedgerReport>;
export type LedgerAccountsResponse = ApiEnvelope<LedgerAccountsReport>;
