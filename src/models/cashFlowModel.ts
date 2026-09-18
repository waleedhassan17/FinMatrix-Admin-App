import type { ApiEnvelope, ReportDateRange } from './reportModel';

export interface CashFlowLine {
  label: string;
  amount: number;
}

export interface CashFlowSection {
  lines: CashFlowLine[];
  total: number;
}

export interface CashFlowTrendPoint {
  label: string;
  value: number;
}

export interface CashFlowReport {
  range: ReportDateRange;
  operating: CashFlowSection;
  investing: CashFlowSection;
  financing: CashFlowSection;
  netChange: number;
  beginningCash: number;
  endingCash: number;
  monthlyTrend: CashFlowTrendPoint[];
}

export type CashFlowReportResponse = ApiEnvelope<CashFlowReport>;
