// ═══════════════════════════════════════════════════════
// FinMatrix — Customer Model & Validation
// ═══════════════════════════════════════════════════════

import type { PaymentTerms } from '../types';

export interface ValidationErrors {
  [key: string]: string;
}

export interface CustomerFormData {
  name: string;
  company: string;
  email: string;
  phone: string;
  // Billing Address
  billingStreet: string;
  billingCity: string;
  billingState: string;
  billingZipCode: string;
  billingCountry: string;
  // Shipping Address
  sameAsBilling: boolean;
  shippingStreet: string;
  shippingCity: string;
  shippingState: string;
  shippingZipCode: string;
  shippingCountry: string;
  // Credit & Terms
  creditLimit: string;
  paymentTerms: PaymentTerms | '';
  // Extra
  contactPerson: string;
  taxId: string;
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

// ─── API ↔ app payment-terms mapping ─────────────────
// The API uses `net30`-style codes; the app uses `net_30`-style codes.
// Sending the app code raw fails the API's enum validation (400).
export const PAYMENT_TERMS_TO_API: Record<PaymentTerms, string> = {
  due_on_receipt: 'due_on_receipt',
  net_15: 'net15',
  net_30: 'net30',
  net_45: 'net45',
  net_60: 'net60',
  '2_10_net30': '2_10_net30',
  custom: 'custom',
};

export const paymentTermsFromApi = (raw: unknown): PaymentTerms => {
  const map: Record<string, PaymentTerms> = {
    due_on_receipt: 'due_on_receipt',
    net15: 'net_15',
    net30: 'net_30',
    net45: 'net_45',
    net60: 'net_60',
    '2_10_net30': '2_10_net30',
    custom: 'custom',
    net_15: 'net_15',
    net_30: 'net_30',
    net_45: 'net_45',
    net_60: 'net_60',
  };
  return map[String(raw ?? '')] ?? 'net_30';
};

export const validateCustomer = (data: CustomerFormData): ValidationErrors => {
  const errors: ValidationErrors = {};

  if (!data.name.trim()) {
    errors.name = 'Customer name is required';
  }

  if (!data.email.trim()) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'Invalid email format';
  }

  if (data.phone && !/^[+\d\s\-()]+$/.test(data.phone)) {
    errors.phone = 'Invalid phone format';
  }

  if (!data.billingStreet.trim()) {
    errors.billingStreet = 'Billing street is required';
  }
  if (!data.billingCity.trim()) {
    errors.billingCity = 'Billing city is required';
  }

  if (!data.sameAsBilling) {
    if (!data.shippingStreet.trim()) {
      errors.shippingStreet = 'Shipping street is required';
    }
    if (!data.shippingCity.trim()) {
      errors.shippingCity = 'Shipping city is required';
    }
  }

  if (data.creditLimit) {
    const limit = parseFloat(data.creditLimit);
    if (isNaN(limit) || limit < 0) {
      errors.creditLimit = 'Credit limit must be a positive number';
    }
  }

  if (!data.paymentTerms) {
    errors.paymentTerms = 'Payment terms are required';
  }

  return errors;
};

// ═══════════════════════════════════════════════════════
// Raw API entity types (what the backend returns)
// ═══════════════════════════════════════════════════════
// The network layer returns these raw shapes, and the
// serializer converts them to UI-ready `Customer` objects.

export interface CustomerApiAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface CustomerApiEntity {
  id: string;
  companyId: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  billingAddress: CustomerApiAddress;
  shippingAddress: CustomerApiAddress;
  balance: number;
  creditLimit: number;
  totalPurchases: number;
  paymentTerms: PaymentTerms;
  contactPerson: string;
  taxId: string;
  notes: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerApiPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ─── Legacy shape used by delivery screens ──────────
export interface LegacyCustomer {
  id: string;
  name: string;
  shippingAddress: { city: string };
}

export const customers: LegacyCustomer[] = [];

