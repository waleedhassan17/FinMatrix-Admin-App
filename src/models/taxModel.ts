// ═══════════════════════════════════════════════════════
// FinMatrix — Tax Model
// ═══════════════════════════════════════════════════════
// API contract + UI form contract for the Tax feature.
// Mirrors the GL / Banking / Employees / Payroll pattern.
// Backed by:
//   - Tax Settings:  manage tax rates (CRUD)
//   - Tax Liability: collected vs paid summary report
//   - Tax Payment:   record a payment against a tax rate

import type {
  TaxLiabilityReport,
  TaxLiabilityRow,
  TaxPaymentRecord,
  TaxRate,
  TaxType,
} from '../types';

// ─── Re-export entity types so screens import from the model ─
export type { TaxRate, TaxPaymentRecord, TaxLiabilityRow, TaxLiabilityReport, TaxType };

// ─── API entity aliases ──────────────────────────────
export type TaxRateApi = TaxRate;
export type TaxPaymentApi = TaxPaymentRecord;
export type TaxLiabilityApi = TaxLiabilityReport;

// ─── Envelope responses ──────────────────────────────
export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export interface TaxRateListResponse {
  rates: TaxRateApi[];
}
export interface TaxRateSingleResponse {
  rate: TaxRateApi;
}
export interface TaxRateDeleteResponse {
  id: string;
}
export interface TaxPaymentListResponse {
  payments: TaxPaymentApi[];
}
export interface TaxPaymentSingleResponse {
  payment: TaxPaymentApi;
}
export interface TaxLiabilityResponse {
  report: TaxLiabilityApi;
}

// ─── Payload types ───────────────────────────────────
export type CreateTaxRatePayload = Omit<
  TaxRate,
  'id' | 'companyId' | 'createdAt' | 'updatedAt'
>;
export type UpdateTaxRatePayload = Partial<
  Omit<TaxRate, 'id' | 'companyId' | 'createdAt'>
>;
export type CreateTaxPaymentPayload = Omit<
  TaxPaymentRecord,
  'id' | 'companyId' | 'createdAt' | 'updatedAt'
>;

// ─── Form helpers / options ──────────────────────────
export const TAX_TYPE_OPTIONS: { label: string; value: TaxType }[] = [
  { label: 'GST', value: 'GST' },
  { label: 'WHT', value: 'WHT' },
  { label: 'Income Tax', value: 'Income Tax' },
  { label: 'Sales Tax', value: 'Sales Tax' },
  { label: 'Custom', value: 'Custom' },
];

export interface ValidationErrors {
  [key: string]: string;
}

export const validateTaxRate = (data: {
  name: string;
  rate: string;
}): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (!data.name.trim()) errors.name = 'Tax name is required';
  const rateNum = parseFloat(data.rate);
  if (!(rateNum >= 0)) errors.rate = 'Rate must be a non-negative number';
  return errors;
};

export const validateTaxPayment = (data: {
  taxRateId: string;
  amount: string;
  date: string;
  bankAccountId: string;
}): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (!data.taxRateId) errors.taxRateId = 'Select a tax rate';
  const amt = parseFloat(data.amount);
  if (!(amt > 0)) errors.amount = 'Amount must be greater than 0';
  if (!data.date) errors.date = 'Date is required';
  if (!data.bankAccountId) errors.bankAccountId = 'Select a bank account';
  return errors;
};
