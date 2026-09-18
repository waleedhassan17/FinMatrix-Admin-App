// ═══════════════════════════════════════════════════════
// FinMatrix — Agency Serializer
// ═══════════════════════════════════════════════════════
// Sits BETWEEN agencyNetwork and the Agency slices.
// Takes raw API envelopes and returns clean, UI-ready
// agency entities with inline field mapping. Mirrors
// `glSerializer.ts`, `bankingSerializer.ts`.

import type { AgencyApi, AgencyInventoryItemApi } from '../models/agencyModel';

const num = (v: any, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

// ─── Sub-mapper ──────────────────────────────────────
export const mapAgencyInventoryItem = (raw: any): AgencyInventoryItemApi => ({
  itemId: raw?.id ?? raw?.itemId ?? '',
  itemName: raw?.name ?? raw?.itemName ?? '',
  name: raw?.name ?? raw?.itemName ?? '',
  sku: raw?.sku ?? '',
  quantity: num(raw?.quantity ?? raw?.quantityOnHand),
  quantityOnHand: num(raw?.quantityOnHand ?? raw?.quantity),
  category: raw?.category ?? '',
  sellingPrice: num(raw?.sellingPrice),
  reorderLevel: num(raw?.reorderLevel ?? raw?.reorderPoint),
  reorderPoint: num(raw?.reorderPoint ?? raw?.reorderLevel),
  unitCost: num(raw?.unitCost ?? raw?.costPrice),
  id: raw?.id ?? '',
  description: raw?.description ?? '',
  unitOfMeasure: raw?.unitOfMeasure ?? '',
});

// ─── Helpers ─────────────────────────────────────────
const capitalize = (s: string): string =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';

// ─── Raw → UI mapper ─────────────────────────────────
export const mapAgency = (raw: any): AgencyApi => {
  // Backend may return address as object { street, city, state } or as a string
  const addr = raw?.address;
  const isAddrObj = addr && typeof addr === 'object';

  return {
    id: raw?.id ?? '',
    name: raw?.name ?? '',
    type: (capitalize(raw?.type ?? '') as AgencyApi['type']) || 'Supply',
    typeBadgeColor: raw?.typeBadgeColor ?? '',
    description: raw?.description ?? '',
    productCount: num(raw?.productCount, Array.isArray(raw?.inventory) ? raw.inventory.length : 0),
    city: raw?.city ?? (isAddrObj ? addr.city : '') ?? '',
    province: raw?.province ?? (isAddrObj ? addr.state : '') ?? '',
    address: isAddrObj ? addr : (raw?.address ?? ''),
    contactPhone: raw?.contactPhone ?? raw?.contact?.phone ?? '',
    contactEmail: raw?.contactEmail ?? raw?.contact?.email ?? '',
    inventory: Array.isArray(raw?.inventory)
      ? raw.inventory.map(mapAgencyInventoryItem)
      : [],
  };
};

// ─── Envelope serializers ────────────────────────────
export function agencyListSerializer(payload: any): AgencyApi[] {
  const list = payload?.data?.agencies ?? payload?.data ?? [];
  return Array.isArray(list) ? list.map(mapAgency) : [];
}

export function agencySingleSerializer(payload: any): AgencyApi | null {
  const raw = payload?.data?.agency ?? payload?.data;
  if (!raw) return null;
  return mapAgency(raw);
}

export function agencyDeleteSerializer(payload: any): string {
  return payload?.data?.id ?? payload?.id ?? '';
}
