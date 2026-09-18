// ═══════════════════════════════════════════════════════
// FinMatrix — Vendor Model & Validation
// ═══════════════════════════════════════════════════════
// Mirrors `glModel.ts`:
//   • API entity types describing the raw backend shape
//   • Pagination envelope
//   • Query params for the list endpoint
// Plus the existing form-validation helpers used by the form screen.

import type { PaymentTerms, Vendor } from '../types';

// ─── Raw API entity (backend shape) ──────────────────
// 1-to-1 with the `Vendor` UI type today; defined separately so
// future backend-only fields (e.g. version stamps) can be added
// without leaking into the UI layer.
export interface VendorApiEntity {
  id: string;
  companyId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  taxId: string;
  contactPerson: string;
  notes: string;
  balance: number;
  paymentTerms: string;
  defaultExpenseAccountId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Pagination envelope ─────────────────────────────
export interface VendorApiPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ─── Query params for list endpoint ──────────────────
export interface VendorQueryParams {
  search?: string;
  status?: 'all' | 'active' | 'inactive';
  sort?: 'name' | 'balance' | 'recent';
  page?: number;
  limit?: number;
}

// ─── Re-export the canonical UI type for convenience ─
export type { Vendor };

export interface ValidationErrors {
  [key: string]: string;
}

export interface VendorFormData {
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  paymentTerms: PaymentTerms | '';
  taxId: string;
  defaultExpenseAccountId: string;
  notes: string;
}

export const PAYMENT_TERMS_OPTIONS: { label: string; value: PaymentTerms }[] = [
  { label: 'Due on Receipt', value: 'due_on_receipt' },
  { label: 'Net 15', value: 'net_15' },
  { label: 'Net 30', value: 'net_30' },
  { label: 'Net 45', value: 'net_45' },
  { label: 'Net 60', value: 'net_60' },
  { label: '2/10 Net 30', value: '2_10_net30' },
  { label: 'Custom', value: 'custom' },
];

export const PAYMENT_TERMS_LABELS: Record<PaymentTerms, string> = {
  due_on_receipt: 'Due on Receipt',
  net_15: 'Net 15',
  net_30: 'Net 30',
  net_45: 'Net 45',
  net_60: 'Net 60',
  '2_10_net30': '2/10 Net 30',
  custom: 'Custom',
};

export const validateVendor = (data: VendorFormData): ValidationErrors => {
  const errors: ValidationErrors = {};

  if (!data.name.trim()) {
    errors.name = 'Company name is required';
  }

  if (!data.email.trim()) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'Invalid email format';
  }

  if (data.phone && !/^[+\d\s\-()]+$/.test(data.phone)) {
    errors.phone = 'Invalid phone format';
  }

  if (!data.paymentTerms) {
    errors.paymentTerms = 'Payment terms are required';
  }

  return errors;
};
