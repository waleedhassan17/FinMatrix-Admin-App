// ═══════════════════════════════════════════════════════
// FinMatrix — Customer Serializer
// ═══════════════════════════════════════════════════════
// Sits BETWEEN network and slice.
// Takes the raw API response and returns a clean,
// UI-ready data structure with inline field mapping.

import type { Customer, PaymentTerms } from '../types';
import type { CustomerFormData } from '../models/customerModel';
import { PAYMENT_TERMS_TO_API, paymentTermsFromApi } from '../models/customerModel';
import { formatCurrency } from '../utils/formatters';

// ─── Serialized outputs for the slice ────────────────

export interface SerializedCustomerList {
  customers: Customer[];
  page: number;
  totalPages: number;
  totalCustomers: number;
}

// The API stores decimals as strings ("1500.0000") and addresses with
// `postalCode`; the app uses numbers and `zipCode`. Coerce both here so
// every screen sees consistent values.
const toNumber = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};

const mapAddress = (raw: any) => ({
  street: raw?.street ?? '',
  city: raw?.city ?? '',
  state: raw?.state ?? '',
  zipCode: raw?.zipCode ?? raw?.postalCode ?? '',
  country: raw?.country ?? 'Pakistan',
});

// ─── Raw entity → UI Customer ────────────────────────

export const mapCustomer = (raw: any): Customer => {
  const billing = mapAddress(raw?.billingAddress);
  const shipping = mapAddress(raw?.shippingAddress);
  return {
    id: raw?.id ?? '',
    companyId: raw?.companyId ?? '',
    name: raw?.name ?? '',
    company: raw?.company ?? '',
    email: raw?.email ?? '',
    phone: raw?.phone ?? '',
    address: raw?.address ?? [billing.street, billing.city].filter(Boolean).join(', '),
    billingAddress: billing,
    shippingAddress: shipping,
    balance: toNumber(raw?.balance),
    creditLimit: toNumber(raw?.creditLimit),
    totalPurchases: toNumber(raw?.totalPurchases),
    paymentTerms: paymentTermsFromApi(raw?.paymentTerms),
    contactPerson: raw?.contactPerson ?? '',
    taxId: raw?.taxId ?? '',
    notes: raw?.notes ?? '',
    isActive: raw?.isActive ?? true,
    createdAt: raw?.createdAt ?? '',
    updatedAt: raw?.updatedAt ?? '',
    ...(raw?.credit
      ? {
          credit: {
            limited: raw.credit.limited !== false && toNumber(raw.credit.limit) > 0,
            exposure: toNumber(raw.credit.exposure ?? raw.credit.used),
            advances: toNumber(raw.credit.advances),
            available: raw.credit.available == null ? null : toNumber(raw.credit.available),
          },
        }
      : {}),
  };
};

// ─── List serializer ─────────────────────────────────

export function customerListSerializer(payload: any): SerializedCustomerList {
  const data = payload?.data;
  const rawCustomers: any[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.customers)
        ? data.customers
        : [];
  const pagination = (data && !Array.isArray(data)) ? (data.pagination || {}) : {};

  return {
    customers: rawCustomers.map(mapCustomer),
    page: pagination.page ?? 1,
    totalPages: pagination.totalPages ?? 1,
    totalCustomers: pagination.total ?? rawCustomers.length,
  };
}

// ─── Single-customer serializer ──────────────────────

export function customerSingleSerializer(payload: any): Customer | null {
  const data = payload?.data;
  const raw = data?.customer ?? (data?.id ? data : null);
  if (!raw) return null;
  const customer = mapCustomer(raw);
  // GET /customers/:id returns totalPurchases alongside the record.
  if (data?.totalPurchases != null) customer.totalPurchases = toNumber(data.totalPurchases);
  return customer;
}

// ─── Customer sub-resource serializers (detail tabs) ─

export interface CustomerInvoiceRow {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  amount: number;
  balance: number;
  status: string;
}

export interface CustomerPaymentRow {
  id: string;
  reference: string;
  date: string;
  amount: number;
  method: string;
  /** e.g. "INV-2026-0052: Rs 758.00 · Rs 6,823.60 still owing" per invoice. */
  applied: string[];
}

interface PagedRows<T> {
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

export function customerInvoicesSerializer(payload: any): PagedRows<CustomerInvoiceRow> {
  const { rows, pagination } = unwrapPagedList(payload);
  return {
    rows: rows.map((raw: any) => ({
      id: raw?.id ?? '',
      invoiceNumber: raw?.invoiceNumber ?? raw?.number ?? '—',
      date: raw?.invoiceDate ?? raw?.date ?? '',
      dueDate: raw?.dueDate ?? '',
      amount: toNumber(raw?.total),
      balance: toNumber(raw?.balanceDue ?? raw?.balance),
      status: raw?.status ?? 'sent',
    })),
    page: pagination.page ?? 1,
    totalPages: pagination.totalPages ?? 1,
    total: pagination.total ?? rows.length,
  };
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  check: 'Cheque',
  bank_transfer: 'Bank Transfer',
  credit_card: 'Credit Card',
  other: 'Other',
};

export function customerPaymentsSerializer(payload: any): PagedRows<CustomerPaymentRow> {
  const { rows, pagination } = unwrapPagedList(payload);
  return {
    rows: rows.map((raw: any) => ({
      id: raw?.id ?? '',
      // RCT-YYYY-NNNN from the server; the reference is the customer's own
      // cheque / transfer id and only stands in for receipts numbered before.
      reference: raw?.paymentNumber || raw?.reference || `PAY-${String(raw?.id ?? '').slice(0, 8).toUpperCase()}`,
      date: raw?.paymentDate ?? raw?.date ?? '',
      amount: toNumber(raw?.amount),
      method: PAYMENT_METHOD_LABELS[String(raw?.paymentMethod ?? '')] ?? 'Other',
      // A part-payment leaves the rest in receivables; each line says how much.
      applied: (Array.isArray(raw?.applications) ? raw.applications : []).map((a: any) => {
        const head = `${a?.invoiceNumber || 'Invoice'}: ${formatCurrency(toNumber(a?.amountApplied), 'Rs ')}`;
        if (a?.invoiceBalance == null) return head;
        const left = toNumber(a.invoiceBalance);
        return left > 0.005 ? `${head} · ${formatCurrency(left, 'Rs ')} still owing` : `${head} · settled`;
      }),
    })),
    page: pagination.page ?? 1,
    totalPages: pagination.totalPages ?? 1,
    total: pagination.total ?? rows.length,
  };
}

// ═══════════════════════════════════════════════════════
// Form ↔ API helpers
// ═══════════════════════════════════════════════════════

/**
 * Converts a Customer object from API into form-ready data for editing.
 */
export const customerToFormData = (customer: Customer): CustomerFormData => {
  const billingSameAsShipping =
    customer.billingAddress.street === customer.shippingAddress.street &&
    customer.billingAddress.city === customer.shippingAddress.city &&
    customer.billingAddress.state === customer.shippingAddress.state &&
    customer.billingAddress.zipCode === customer.shippingAddress.zipCode &&
    customer.billingAddress.country === customer.shippingAddress.country;

  return {
    name: customer.name,
    company: customer.company,
    email: customer.email,
    phone: customer.phone,
    billingStreet: customer.billingAddress.street,
    billingCity: customer.billingAddress.city,
    billingState: customer.billingAddress.state,
    billingZipCode: customer.billingAddress.zipCode,
    billingCountry: customer.billingAddress.country,
    sameAsBilling: billingSameAsShipping,
    shippingStreet: customer.shippingAddress.street,
    shippingCity: customer.shippingAddress.city,
    shippingState: customer.shippingAddress.state,
    shippingZipCode: customer.shippingAddress.zipCode,
    shippingCountry: customer.shippingAddress.country,
    creditLimit: String(customer.creditLimit),
    paymentTerms: customer.paymentTerms,
    contactPerson: customer.contactPerson,
    taxId: customer.taxId,
    notes: customer.notes,
  };
};

/**
 * Converts form data into the API payload for creating / updating a
 * customer. Shapes every field the way the API's DTO expects — decimals as
 * strings, `postalCode` addresses, `net30`-style terms — so nothing is
 * stripped or rejected by server-side validation.
 */
export const formDataToCustomerPayload = (form: CustomerFormData) => {
  const billingAddress = {
    street: form.billingStreet.trim(),
    city: form.billingCity.trim(),
    state: form.billingState.trim(),
    postalCode: form.billingZipCode.trim(),
    country: form.billingCountry.trim() || 'Pakistan',
  };

  const shippingAddress = form.sameAsBilling
    ? { ...billingAddress }
    : {
        street: form.shippingStreet.trim(),
        city: form.shippingCity.trim(),
        state: form.shippingState.trim(),
        postalCode: form.shippingZipCode.trim(),
        country: form.shippingCountry.trim() || 'Pakistan',
      };

  return {
    name: form.name.trim(),
    company: form.company.trim() || undefined,
    email: form.email.trim() || undefined,
    phone: form.phone.trim() || undefined,
    billingAddress,
    shippingAddress,
    creditLimit: String(parseFloat(form.creditLimit) || 0),
    paymentTerms: PAYMENT_TERMS_TO_API[(form.paymentTerms || 'net_30') as PaymentTerms],
    contactPerson: form.contactPerson.trim() || undefined,
    taxId: form.taxId.trim() || undefined,
    notes: form.notes.trim() || undefined,
  };
};
