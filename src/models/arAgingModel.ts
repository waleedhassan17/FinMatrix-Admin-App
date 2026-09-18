import type { ApiEnvelope } from './reportModel';

export interface ARAgingRow {
  customerId: string;
  customerName: string;
  current: number;
  bucket1to30: number;
  bucket31to60: number;
  bucket61to90: number;
  bucket90Plus: number;
  total: number;
}

export interface ARAgingTotals {
  current: number;
  bucket1to30: number;
  bucket31to60: number;
  bucket61to90: number;
  bucket90Plus: number;
  total: number;
}

export interface ARAgingReport {
  asOfDate: string;
  rows: ARAgingRow[];
  totals: ARAgingTotals;
}

export type ARAgingReportResponse = ApiEnvelope<ARAgingReport>;
