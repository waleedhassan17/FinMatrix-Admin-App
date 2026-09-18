// ═══════════════════════════════════════════════════════
// FinMatrix — Inventory Serializer
// ═══════════════════════════════════════════════════════
// Sits BETWEEN network and slice.
// Takes the raw API envelope and returns a clean,
// UI-ready data structure with inline field mapping.
// Mirrors `glSerializer.ts` / `billSerializer.ts`.

import type {
  CreateInventoryItemPayload,
  InventoryFormData,
  InventoryItemData,
  StockMovement,
  StockMovementType,
  UpdateInventoryItemPayload,
} from '../models/inventoryModel';

// ─── Stock-status counts (for tab badges) ────────────
export type InventoryStockCounts = {
  all: number;
  in_stock: number;
  low_stock: number;
  out_of_stock: number;
};

// ─── Serialized output for the list slice ────────────
export interface SerializedInventoryList {
  items: InventoryItemData[];
  page: number;
  totalPages: number;
  totalItems: number;
  counts: InventoryStockCounts;
  totalStockValue: number;
}

// ─── Helpers ─────────────────────────────────────────
const toNum = (v: any): number => {
  if (typeof v === 'number') return v;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

// ─── Raw → UI mapper ─────────────────────────────────
export const mapInventoryItem = (
  raw: any,
): InventoryItemData => ({
  id: raw.id ?? raw.itemId ?? '',
  itemId: raw.itemId ?? raw.id ?? '',
  companyId: raw.companyId ?? '',
  sku: raw.sku ?? '',
  name: raw.name ?? '',
  description: raw.description ?? '',
  category: raw.category ?? '',
  unitOfMeasure: raw.unitOfMeasure ?? 'Unit',
  costMethod: raw.costMethod ?? 'average',
  unitCost: toNum(raw.unitCost),
  sellingPrice: toNum(raw.sellingPrice),
  quantityOnHand: toNum(raw.quantityOnHand),
  quantityOnOrder: toNum(raw.quantityOnOrder),
  quantityCommitted: toNum(raw.quantityCommitted),
  reorderPoint: toNum(raw.reorderPoint),
  reorderQuantity: toNum(raw.reorderQuantity),
  minStock: toNum(raw.minStock),
  maxStock: toNum(raw.maxStock),
  isActive: raw.isActive ?? true,
  barcodeData: raw.barcodeData ?? '',
  locationId: raw.locationId ?? '',
  sourceAgencyId: raw.sourceAgencyId,
  imageUrl: raw.imageUrl ?? '',
  lastUpdated: raw.updatedAt ?? raw.lastUpdated ?? '',
  createdAt: raw.createdAt,
  updatedAt: raw.updatedAt,
});

// ─── Envelope serializers ────────────────────────────
export function inventoryListSerializer(payload: any): SerializedInventoryList {
  const data = payload?.data;
  const raw: any[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.items)
      ? data.items
      : [];
  const pagination = (data && !Array.isArray(data)) ? (data.pagination || {}) : {};
  const totals = (data && !Array.isArray(data)) ? (data.totals || {}) : {};

  const items = raw.map(mapInventoryItem);

  // Compute counts client-side if not provided.
  const counts: InventoryStockCounts = totals.counts || {
    all: items.length,
    in_stock: items.filter(i => toNum(i.quantityOnHand) > toNum(i.reorderPoint)).length,
    low_stock: items.filter(
      i => toNum(i.quantityOnHand) > 0 && toNum(i.quantityOnHand) <= toNum(i.reorderPoint),
    ).length,
    out_of_stock: items.filter(i => toNum(i.quantityOnHand) === 0).length,
  };

  const totalStockValue =
    typeof totals.totalStockValue === 'number'
      ? totals.totalStockValue
      : items.reduce((s, i) => s + toNum(i.quantityOnHand) * toNum(i.unitCost), 0);

  return {
    items,
    page: pagination.page ?? 1,
    totalPages: pagination.totalPages ?? 1,
    totalItems: pagination.total ?? items.length,
    counts,
    totalStockValue,
  };
}

// ─── Stock movements ─────────────────────────────────
export const mapStockMovement = (raw: any): StockMovement => ({
  id: raw.id ?? '',
  date: raw.date ?? '',
  type: (raw.type ?? 'adjustment') as StockMovementType,
  reference: raw.reference ?? '',
  description: raw.description ?? '',
  quantityChange: toNum(raw.quantityChange),
  balanceAfter: toNum(raw.balanceAfter),
  sourceType: raw.sourceType ?? '',
  sourceId: raw.sourceId ?? '',
  createdAt: raw.createdAt ?? '',
});

/**
 * GET items/:id/movements returns `{ data, total, page, limit }`, but the
 * global response envelope lifts `data` and drops its siblings — so no
 * pagination metadata ever reaches the client and the payload is just an
 * array.
 *
 * The server orders by `date` alone, a date-only column with no tiebreaker,
 * so movements made on the same day come back in arbitrary order and the
 * running balance reads as noise. Sorting on (date, createdAt) here restores
 * a sane order without waiting on a backend release.
 */
export function stockMovementsSerializer(payload: any): StockMovement[] {
  const data = payload?.data;
  const raw: any[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
      ? data.data
      : [];
  return raw
    .map(mapStockMovement)
    .sort((a, b) =>
      a.date === b.date
        ? b.createdAt.localeCompare(a.createdAt)
        : b.date.localeCompare(a.date),
    );
}

export function inventorySingleSerializer(
  payload: any,
): InventoryItemData | null {
  const raw = payload?.data?.item ?? (payload?.data && !Array.isArray(payload.data) ? payload.data : null);
  if (!raw) return null;
  return mapInventoryItem(raw);
}

// ═══════════════════════════════════════════════════════
// WRITE PATH — form → API payload
// ═══════════════════════════════════════════════════════
// The API's @IsOptional() only skips null/undefined, so an optional field sent
// as '' is still validated and fails (@Length on category/unitOfMeasure/
// barcodeData, @IsNumberString on the decimals, @IsUUID on sourceAgencyId).
// Everything optional is therefore OMITTED rather than blanked — `undefined`
// keys drop out of JSON.stringify.

/** Trimmed text, or undefined so the key is left out entirely. */
const text = (v: string): string | undefined => v.trim() || undefined;

/** Decimals go over the wire as strings (@IsNumberString), matching what the
 *  API's own acceptance tests send — not as numbers relying on the server's
 *  implicit conversion. */
const money = (v: string): string => String(parseFloat(v) || 0);

export const formDataToInventoryCreatePayload = (
  form: InventoryFormData,
): CreateInventoryItemPayload => ({
  // Required by the API and guaranteed non-empty by validateInventoryItem.
  sku: form.sku.trim(),
  name: form.name.trim(),
  description: text(form.description),
  category: text(form.category),
  unitOfMeasure: text(form.unitOfMeasure),
  costMethod: 'average',
  unitCost: money(form.unitCost),
  sellingPrice: money(form.sellingPrice),
  reorderPoint: money(form.reorderPoint),
  reorderQuantity: money(form.reorderQuantity),
  minStock: money(form.minStock),
  maxStock: money(form.maxStock),
  // isActive is deliberately NOT sent. The item form has no Active switch any
  // more, and sending the field anyway would let a plain edit re-assert an
  // active/inactive state that only the guarded Deactivate action should set.
  // Omitting it is safe both ways: the column defaults to true on create, and
  // PATCH is partial, so an existing item's state is left alone.
  barcodeData: text(form.barcodeData),
  // Only ever a real agency UUID — an empty string would fail @IsUUID.
  sourceAgencyId: text(form.sourceAgencyId),
});

/** `costLocked` mirrors the read-only Unit Cost field: once stock is on hand
 *  the API derives the cost from receipt history and rejects a change, so a
 *  field the user cannot edit is not sent at all. */
export const formDataToInventoryUpdatePayload = (
  form: InventoryFormData,
  opts: { costLocked?: boolean } = {},
): UpdateInventoryItemPayload => {
  const { costMethod, ...rest } = formDataToInventoryCreatePayload(form);
  void costMethod; // update DTO has no costMethod field
  if (opts.costLocked) delete rest.unitCost;
  return rest;
};
