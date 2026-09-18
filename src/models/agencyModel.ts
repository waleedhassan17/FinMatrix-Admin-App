// ═══════════════════════════════════════════════════════
// FinMatrix — Agency Model & Validation
// ═══════════════════════════════════════════════════════
// API contract + UI form contract for the Agency feature.
// Mirrors the GL / Banking / Employees / Payroll pattern.

export type AgencyType = 'Manufacturing' | 'Supply' | 'Distribution';

export interface WarehouseAgency {
  id: string;
  name: string;
  type: AgencyType;
  description?: string;
  address?: { city?: string; state?: string; street?: string } | string;
  contact?: { name?: string; phone?: string; email?: string };
  isActive?: boolean;
  inventory: AgencyInventoryItem[];
  createdAt?: string;
  updatedAt?: string;
  // Legacy UI fields used by CreateCompanyScreen
  typeBadgeColor?: string;
  productCount?: number;
  city?: string;
  province?: string;
  contactPhone?: string;
  contactEmail?: string;
}

export interface AgencyInventoryItem {
  itemId: string;
  itemName: string;
  name: string;
  sku: string;
  quantity: number;
  quantityOnHand: number;
  category: string;
  sellingPrice: number;
  reorderLevel: number;
  reorderPoint: number;
  unitCost: number;
  [key: string]: any;
}

// ─── API entity & envelope types ─────────────────────
export type AgencyApi = WarehouseAgency;
export type AgencyInventoryItemApi = AgencyInventoryItem;

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export interface AgencyListResponse {
  agencies: AgencyApi[];
}
export interface AgencySingleResponse {
  agency: AgencyApi;
}
export interface AgencyDeleteResponse {
  id: string;
}

export interface ValidationErrors {
  [key: string]: string;
}

export interface AgencyFormData {
  name: string;
  type: AgencyType | '';
  description: string;
  address: string;
  city: string;
  province: string;
  contactPhone: string;
  contactEmail: string;
}

export const AGENCY_TYPE_OPTIONS: { label: string; value: AgencyType }[] = [
  { label: 'Manufacturing', value: 'Manufacturing' },
  { label: 'Supply', value: 'Supply' },
  { label: 'Distribution', value: 'Distribution' },
];

export const AGENCY_TYPE_COLORS: Record<AgencyType, string> = {
  Manufacturing: '#059669',
  Supply: '#00875A',
  Distribution: '#6554C0',
};

export const PROVINCE_OPTIONS = [
  { label: 'Sindh', value: 'Sindh' },
  { label: 'Punjab', value: 'Punjab' },
  { label: 'KPK', value: 'KPK' },
  { label: 'Balochistan', value: 'Balochistan' },
  { label: 'Islamabad', value: 'Islamabad' },
  { label: 'Gilgit-Baltistan', value: 'Gilgit-Baltistan' },
  { label: 'AJK', value: 'AJK' },
];

export const validateAgency = (data: AgencyFormData): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (!data.name.trim()) errors.name = 'Agency name is required';
  if (!data.type) errors.type = 'Agency type is required';
  if (!data.address.trim()) errors.address = 'Address is required';
  if (!data.city.trim()) errors.city = 'City is required';
  if (!data.contactPhone.trim()) errors.contactPhone = 'Phone number is required';
  if (data.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail)) {
    errors.contactEmail = 'Invalid email format';
  }
  return errors;
};

// ─── Empty default for screens that reference agencies locally ──
export const warehouseAgencies: WarehouseAgency[] = [];
