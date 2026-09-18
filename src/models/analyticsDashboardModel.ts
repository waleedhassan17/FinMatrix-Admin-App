import type { ApiEnvelope } from './reportModel';

export interface TrendPoint {
  label: string;
  value: number;
}

export interface ARAgingTrendPoint {
  label: string;
  current: number;
  bucket1to30: number;
  bucket31to60: number;
  bucket61to90: number;
  bucket90Plus: number;
}

export interface AnalyticsDashboardData {
  revenueTrend: TrendPoint[];
  expenseCategories: TrendPoint[];
  cashFlowTrend: TrendPoint[];
  topCustomers: TrendPoint[];
  arAgingTrend: ARAgingTrendPoint[];
}

export type AnalyticsDashboardResponse = ApiEnvelope<AnalyticsDashboardData>;
