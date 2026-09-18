import type { ApiEnvelope } from './reportModel';

export interface DeliveryPerformanceRow {
  personId: string;
  name: string;
  total: number;
  delivered: number;
  failed: number;
  onTimeRate: number;
}

export interface DeliveryTrendPoint {
  label: string;
  delivered: number;
  failed: number;
}

export interface DeliveryPerformanceReport {
  rows: DeliveryPerformanceRow[];
  dailyTrend: DeliveryTrendPoint[];
}

export type DeliveryPerformanceReportResponse = ApiEnvelope<DeliveryPerformanceReport>;
