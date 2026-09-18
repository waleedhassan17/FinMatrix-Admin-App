// ═══════════════════════════════════════════════════════
// FinMatrix — Estimate Serializer
// ═══════════════════════════════════════════════════════
import type { Estimate, EstimateLine, EstimateStatus, DiscountType } from '../models/estimateModel';

const toNum = (v: any): number => {
  if (typeof v === 'number') return v;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

export const mapEstimateLine = (raw: any): EstimateLine => ({
  id: raw.id,
  // '' rather than null so it drops straight into CustomDropdown's `value`.
  itemId: raw.itemId ?? '',
  description: raw.description ?? '',
  quantity: toNum(raw.quantity),
  unitPrice: toNum(raw.unitPrice),
  taxRate: toNum(raw.taxRate),
  lineTotal: toNum(raw.lineTotal),
});

export const mapEstimate = (raw: any): Estimate => ({
  id: raw.id ?? '',
  estimateNumber: raw.estimateNumber ?? '',
  customerId: raw.customerId ?? '',
  customerName: raw.customerName ?? raw.customer?.name ?? '',
  estimateDate: raw.estimateDate ?? '',
  expiryDate: raw.expiryDate ?? null,
  status: (raw.status ?? 'draft') as EstimateStatus,
  lines: Array.isArray(raw.lines) ? raw.lines.map(mapEstimateLine) : [],
  subtotal: toNum(raw.subtotal),
  discountType: (raw.discountType ?? 'none') as DiscountType,
  discountValue: toNum(raw.discountValue),
  discountAmount: toNum(raw.discountAmount),
  taxAmount: toNum(raw.taxAmount),
  total: toNum(raw.total),
  notes: raw.notes ?? '',
  convertedToType: raw.convertedToType ?? null,
  convertedToId: raw.convertedToId ?? null,
});

export interface SerializedEstimateList {
  estimates: Estimate[];
  page: number;
  totalPages: number;
  total: number;
}

export function estimateListSerializer(payload: any): SerializedEstimateList {
  const d = payload?.data ?? payload;
  const arr: any[] = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
  const pg = (d && !Array.isArray(d) ? d.pagination : null) ?? {};
  return {
    estimates: arr.map(mapEstimate),
    page: pg.page ?? 1,
    totalPages: pg.totalPages ?? 1,
    total: pg.total ?? arr.length,
  };
}

export function estimateSingleSerializer(payload: any): Estimate | null {
  const raw = payload?.data?.estimate ?? payload?.data ?? payload;
  if (!raw || Array.isArray(raw) || !raw.id) return null;
  return mapEstimate(raw);
}
