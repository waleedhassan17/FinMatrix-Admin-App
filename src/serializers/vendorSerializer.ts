// ═══════════════════════════════════════════════════════
// FinMatrix — Vendor Serializer
// ═══════════════════════════════════════════════════════
// Sits BETWEEN network and slice.
// Takes the raw API envelope and returns a clean,
// UI-ready data structure with inline field mapping.
// Mirrors `glSerializer.ts`.

import type { Vendor } from '../types';
import type { VendorApiEntity } from '../models/vendorModel';
import { paymentTermsFromApi } from '../models/customerModel';

// ─── Serialized output for the slice ─────────────────
export interface SerializedVendorList {
  vendors: Vendor[];
  page: number;
  totalPages: number;
  totalVendors: number;
  activeCount: number;
  inactiveCount: number;
  totalBalance: number;
}

// ─── Raw → UI mapper ─────────────────────────────────
const toNum = (v: any): number => {
  if (typeof v === 'number') return v;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

export const mapVendor = (raw: Partial<VendorApiEntity> & { companyName?: string }): Vendor => {
  // The API stores the vendor address as a structured object
  // ({street, city, state, postalCode, country}); the app's Vendor type is
  // flat. Unpack it here so addresses actually display.
  const addr: any = raw.address && typeof raw.address === 'object' ? raw.address : {};
  return {
    id: raw.id ?? '',
    companyId: raw.companyId ?? '',
    name: (raw as any).companyName ?? raw.name ?? '',
    email: raw.email ?? '',
    phone: raw.phone ?? '',
    address: typeof raw.address === 'string' ? raw.address : (addr.street ?? ''),
    city: addr.city ?? raw.city ?? '',
    state: addr.state ?? raw.state ?? '',
    zipCode: addr.zipCode ?? addr.postalCode ?? raw.zipCode ?? '',
    country: addr.country ?? raw.country ?? '',
    taxId: raw.taxId ?? '',
    contactPerson: raw.contactPerson ?? '',
    notes: raw.notes ?? '',
    balance: toNum(raw.balance),
    paymentTerms: raw.paymentTerms ? paymentTermsFromApi(raw.paymentTerms) : '',
    defaultExpenseAccountId: raw.defaultExpenseAccountId ?? '',
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : true,
    createdAt: raw.createdAt ?? '',
    updatedAt: raw.updatedAt ?? '',
  };
};

// ─── Envelope serializers ────────────────────────────
export function vendorListSerializer(payload: any): SerializedVendorList {
  const data = payload?.data;
  const raw: any[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.vendors)
        ? data.vendors
        : [];
  const pagination = (data && !Array.isArray(data)) ? (data.pagination || {}) : {};
  const totals = (data && !Array.isArray(data)) ? (data.totals || {}) : {};

  const vendors = raw.map(mapVendor);

  return {
    vendors,
    page: pagination.page ?? 1,
    totalPages: pagination.totalPages ?? 1,
    totalVendors: pagination.total ?? vendors.length,
    activeCount: totals.activeCount ?? vendors.filter(v => v.isActive).length,
    inactiveCount:
      totals.inactiveCount ?? vendors.filter(v => !v.isActive).length,
    totalBalance:
      totals.totalBalance ?? vendors.reduce((s, v) => s + v.balance, 0),
  };
}

export function vendorSingleSerializer(payload: any): Vendor | null {
  const raw = payload?.data?.vendor ?? (payload?.data && !Array.isArray(payload.data) ? payload.data : null);
  if (!raw) return null;
  return mapVendor(raw);
}

// ─── Vendor sub-resource serializers (detail tabs) ───

export interface VendorBillRow {
  id: string;
  billNumber: string;
  date: string;
  dueDate: string;
  amount: number;
  balance: number;
  status: string;
}

export interface VendorPaymentRow {
  id: string;
  reference: string;
  date: string;
  amount: number;
  method: string;
}

export interface VendorPagedRows<T> {
  rows: T[];
  page: number;
  totalPages: number;
  total: number;
}

function unwrapPagedList(payload: any): { rows: any[]; pagination: any } {
  const data = payload?.data;
  if (Array.isArray(data)) return { rows: data, pagination: {} };
  if (Array.isArray(data?.data)) return { rows: data.data, pagination: data.pagination ?? {} };
  return { rows: [], pagination: {} };
}

export function vendorBillsSerializer(payload: any): VendorPagedRows<VendorBillRow> {
  const { rows, pagination } = unwrapPagedList(payload);
  return {
    rows: rows.map((raw: any) => ({
      id: raw?.id ?? '',
      billNumber: raw?.billNumber ?? raw?.number ?? '—',
      date: raw?.billDate ?? raw?.date ?? '',
      dueDate: raw?.dueDate ?? '',
      amount: toNum(raw?.total),
      balance: toNum(raw?.balanceDue ?? raw?.balance),
      status: raw?.status ?? 'open',
    })),
    page: pagination.page ?? 1,
    totalPages: pagination.totalPages ?? 1,
    total: pagination.total ?? rows.length,
  };
}

const VENDOR_PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  check: 'Cheque',
  bank_transfer: 'Bank Transfer',
  credit_card: 'Credit Card',
  other: 'Other',
};

export function vendorPaymentsSerializer(payload: any): VendorPagedRows<VendorPaymentRow> {
  const { rows, pagination } = unwrapPagedList(payload);
  return {
    rows: rows.map((raw: any) => ({
      id: raw?.id ?? '',
      reference: raw?.reference || `PAY-${String(raw?.id ?? '').slice(0, 8).toUpperCase()}`,
      date: raw?.paymentDate ?? raw?.date ?? '',
      amount: toNum(raw?.amount),
      method: VENDOR_PAYMENT_METHOD_LABELS[String(raw?.paymentMethod ?? '')] ?? 'Other',
    })),
    page: pagination.page ?? 1,
    totalPages: pagination.totalPages ?? 1,
    total: pagination.total ?? rows.length,
  };
}
