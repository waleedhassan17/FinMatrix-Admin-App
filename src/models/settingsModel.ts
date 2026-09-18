// ═══════════════════════════════════════════════════════
// FinMatrix — Settings Model
// ═══════════════════════════════════════════════════════
// User-facing app preferences plus option lists. Server settings
// (currency / locale / etc.) load via /api/v1/settings; this file
// only exposes the local defaults the slice falls back to.

import type { CompanyMember } from '../screens/Auth/companySlice';

export interface AppPreferences {
  dateFormat: string;
  numberFormat: string;
  currency: string;
  invoicePrefix: string;
  invoiceStartNumber: number;
  defaultPaymentTerms: string;
  notifyInvoice: boolean;
  notifyPayment: boolean;
  notifyBill: boolean;
  notifyInventory: boolean;
  notifyDelivery: boolean;
  demoMode: boolean;
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  dateFormat: 'DD/MM/YYYY',
  numberFormat: '1,234.56',
  currency: 'PKR',
  invoicePrefix: 'INV-',
  invoiceStartNumber: 1001,
  defaultPaymentTerms: 'Net 30',
  notifyInvoice: true,
  notifyPayment: true,
  notifyBill: true,
  notifyInventory: false,
  notifyDelivery: true,
  demoMode: true,
};

export const DATE_FORMAT_OPTIONS: string[] = [];
export const NUMBER_FORMAT_OPTIONS: string[] = [];
export const CURRENCY_OPTIONS: string[] = [];
export const PAYMENT_TERMS_OPTIONS: string[] = [];

/** Members for the User Management screen. Populated from /api/v1/users. */
export const DUMMY_USERS: CompanyMember[] = [];

// ─── Settings network entity shapes ──────────────────
// (moved verbatim from settingsNetwork — Consultant_Mobile convention)

export interface CompanyProfilePayload {
  name?: string;
  industry?: string;
  address?: string;
  phone?: string;
  email?: string;
  taxId?: string;
}

export interface CompanySwitcherItem {
  id: string;
  companyId?: string;
  name: string;
  role: string;
  industry?: string;
  memberCount?: number;
  inviteCode?: string;
  [key: string]: any;
}
