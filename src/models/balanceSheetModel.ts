import type { ApiEnvelope } from './reportModel';

export interface BalanceSheetLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  amount: number;
}

export interface BalanceSheetReport {
  asOfDate: string;
  assets: BalanceSheetLine[];
  liabilities: BalanceSheetLine[];
  equity: BalanceSheetLine[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  isBalanced: boolean;
}

export type BalanceSheetReportResponse = ApiEnvelope<BalanceSheetReport>;
