// ═══════════════════════════════════════════════════════
// FinMatrix — Tax Serializer
// ═══════════════════════════════════════════════════════
// Sits BETWEEN taxNetwork and the Tax slices.
// Mirrors `glSerializer.ts`, `bankingSerializer.ts`.

import type {
  TaxLiabilityApi,
  TaxLiabilityRow,
  TaxPaymentApi,
  TaxRateApi,
  TaxType,
} from '../models/taxModel';

const num = (v: any, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

// ─── Raw → UI mappers ────────────────────────────────
export const mapTaxRate = (raw: any): TaxRateApi => ({
  id: raw?.id ?? '',
  companyId: raw?.companyId ?? '',
  name: raw?.name ?? '',
  rate: num(raw?.rate),
  taxType: (raw?.taxType as TaxType) ?? 'GST',
  description: raw?.description ?? '',
  isActive: raw?.isActive ?? true,
  createdAt: raw?.createdAt ?? '',
  updatedAt: raw?.updatedAt ?? '',
});

export const mapTaxPayment = (raw: any): TaxPaymentApi => ({
  id: raw?.id ?? '',
  companyId: raw?.companyId ?? '',
  taxRateId: raw?.taxRateId ?? '',
  taxRateName: raw?.taxRateName ?? '',
  taxType: (raw?.taxType as TaxType) ?? 'GST',
  amount: num(raw?.amount),
  date: raw?.date ?? '',
  bankAccountId: raw?.bankAccountId ?? '',
  bankAccountName: raw?.bankAccountName ?? '',
  reference: raw?.reference ?? '',
  notes: raw?.notes ?? '',
  createdAt: raw?.createdAt ?? '',
  updatedAt: raw?.updatedAt ?? '',
});

const mapLiabilityRow = (raw: any): TaxLiabilityRow => ({
  taxRateId: raw?.taxRateId ?? '',
  taxName: raw?.taxName ?? '',
  taxType: (raw?.taxType as TaxType) ?? 'GST',
  rate: num(raw?.rate),
  collected: num(raw?.collected),
  paid: num(raw?.paid),
  net: num(raw?.net),
});

export const mapTaxLiability = (raw: any): TaxLiabilityApi => ({
  fromDate: raw?.fromDate ?? '',
  toDate: raw?.toDate ?? '',
  rows: Array.isArray(raw?.rows) ? raw.rows.map(mapLiabilityRow) : [],
  totalCollected: num(raw?.totalCollected),
  totalPaid: num(raw?.totalPaid),
  totalNet: num(raw?.totalNet),
});

// ─── Envelope serializers ────────────────────────────
export function taxRateListSerializer(payload: any): TaxRateApi[] {
  const list = payload?.data?.rates ?? payload?.data ?? [];
  return Array.isArray(list) ? list.map(mapTaxRate) : [];
}

export function taxRateSingleSerializer(payload: any): TaxRateApi | null {
  const raw = payload?.data?.rate ?? payload?.data;
  if (!raw) return null;
  return mapTaxRate(raw);
}

export function taxRateDeleteSerializer(payload: any): string {
  return payload?.data?.id ?? payload?.id ?? '';
}

export function taxPaymentListSerializer(payload: any): TaxPaymentApi[] {
  const list = payload?.data?.payments ?? payload?.data ?? [];
  return Array.isArray(list) ? list.map(mapTaxPayment) : [];
}

export function taxPaymentSingleSerializer(payload: any): TaxPaymentApi | null {
  const raw = payload?.data?.payment ?? payload?.data;
  if (!raw) return null;
  return mapTaxPayment(raw);
}

export function taxLiabilitySerializer(payload: any): TaxLiabilityApi {
  const raw = payload?.data?.report ?? payload?.data ?? payload;
  return mapTaxLiability(raw);
}
