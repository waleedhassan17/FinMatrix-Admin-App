import type {
  InventoryValuationReport,
  InventoryValuationReportResponse,
} from '../models/inventoryValuationModel';
import { unwrapEnvelope } from '../networks/reports/reportHelpers';

export const inventoryValuationSerializer = (
  payload: InventoryValuationReportResponse,
): InventoryValuationReport | null => {
  const raw = unwrapEnvelope<InventoryValuationReport>(payload);
  if (!raw) return null;
  return {
    rows: raw.rows ?? [],
    byCategory: raw.byCategory ?? [],
    totalValue: raw.totalValue ?? 0,
  };
};
