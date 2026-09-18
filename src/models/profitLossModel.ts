import type { ApiEnvelope, ReportDateRange } from './reportModel';

export interface ProfitLossReport {
  range: ReportDateRange;
  comparisonRange: ReportDateRange | null;
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netIncome: number;
  comparison?: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    expenses: number;
    netIncome: number;
  };
}

export type ProfitLossReportResponse = ApiEnvelope<ProfitLossReport>;
