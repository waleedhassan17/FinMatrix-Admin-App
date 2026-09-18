import type { ApiEnvelope } from './reportModel';

export interface InventoryValuationRow {
  itemId: string;
  itemName: string;
  sku: string;
  category: string;
  qty: number;
  cost: number;
  value: number;
}

export interface InventoryValuationCategoryTotal {
  category: string;
  totalValue: number;
}

export interface InventoryValuationReport {
  rows: InventoryValuationRow[];
  byCategory: InventoryValuationCategoryTotal[];
  totalValue: number;
}

export type InventoryValuationReportResponse = ApiEnvelope<InventoryValuationReport>;
