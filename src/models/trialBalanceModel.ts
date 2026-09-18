import type { ApiEnvelope, ReportDateRange } from './reportModel';

export interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

export interface TrialBalanceReport {
  range: ReportDateRange;
  rows: TrialBalanceRow[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
}

export type TrialBalanceReportResponse = ApiEnvelope<TrialBalanceReport>;
