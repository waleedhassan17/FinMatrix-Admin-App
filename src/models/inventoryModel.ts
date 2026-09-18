// ═══════════════════════════════════════════════════════
// FinMatrix — Inventory Model & Validation
// ═══════════════════════════════════════════════════════
// Mirrors `glModel.ts` / `billModel.ts`:
//   • API entity types describing the raw backend shape
//   • Pagination envelope
//   • Query params for the list endpoint
// Plus the existing form-validation helpers used by the form screen.

// ─── Raw API entity (backend shape) ──────────────────
export interface InventoryItemData {
  id: string;
  itemId?: string;
  companyId?: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  unitOfMeasure: string;
  costMethod: string;
  unitCost: number;
  sellingPrice: number;
  quantityOnHand: number;
  quantityOnOrder: number;
  quantityCommitted: number;
  reorderPoint: number;
  reorderQuantity: number;
  minStock: number;
  maxStock: number;
  isActive: boolean;
  barcodeData: string;
  locationId: string;
  sourceAgencyId?: string;
  sourceAgencyName?: string;
  imageUrl: string;
  lastUpdated: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export type InventoryApiEntity = InventoryItemData;

// ─── Write payloads (mirror the API DTOs) ────────────
// Deliberately separate from InventoryItemData, which carries an index
// signature that makes any `Omit<>` of it vacuous — that is how a fake
// `locationId` and blank optional fields reached the API unchecked and 400'd
// every create. These types have no index signature, so a stray field is a
// compile error.
//
// Decimals are strings on purpose: the API validates them with
// @IsNumberString. Optional fields must be OMITTED rather than sent empty —
// its @IsOptional() only skips null/undefined, so '' is still validated and
// fails @Length / @IsNumberString / @IsUUID.
//
// `locationId` is absent by design: the backend has an inventory_locations
// table but no endpoint exposes it, so the app can never hold a real location
// UUID. Every screen that offered a location has been removed for the same
// reason.
export interface CreateInventoryItemPayload {
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unitOfMeasure?: string;
  /** Weighted average is the only method the API accepts. */
  costMethod?: 'average';
  unitCost?: string;
  sellingPrice?: string;
  reorderPoint?: string;
  reorderQuantity?: string;
  minStock?: string;
  maxStock?: string;
  // isActive is deliberately absent: activation is a guarded action on the
  // item detail screen, never a field on the edit form. See
  // formDataToInventoryCreatePayload.
  // serialTracking / lotTracking are deliberately absent. The columns exist
  // and the DTO accepts them, but nothing in the product ever reads them back
  // to enforce serial or lot capture, so the toggles only persisted a promise
  // the app does not keep.
  barcodeData?: string;
  sourceAgencyId?: string;
}

/** UpdateInventoryItemDto has no `costMethod` field; everything else is
 *  optional there too, including `sku`. */
export type UpdateInventoryItemPayload = Partial<Omit<CreateInventoryItemPayload, 'costMethod'>>;

// ─── Pagination envelope ─────────────────────────────
export interface InventoryApiPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ─── Query params for list endpoint ──────────────────
export type StockFilterParam = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';

export interface InventoryQueryParams {
  search?: string;
  stockFilter?: StockFilterParam;
  category?: string;
  agencyId?: string;
  page?: number;
  limit?: number;
}


export interface ValidationErrors {
  [key: string]: string;
}

export interface InventoryFormData {
  // Basic Info
  name: string;
  sku: string;
  description: string;
  category: string;
  unitOfMeasure: string;
  // Pricing
  costMethod: string;
  unitCost: string;
  sellingPrice: string;
  // Stock
  quantityOnHand: string;
  reorderPoint: string;
  reorderQuantity: string;
  minStock: string;
  maxStock: string;
  // Tracking
  barcodeData: string;
  // Warehouse
  sourceAgencyId: string;
}

export const CATEGORY_OPTIONS = [
  { label: 'Electronics', value: 'Electronics' },
  { label: 'Office Supplies', value: 'Office Supplies' },
  { label: 'Furniture', value: 'Furniture' },
  { label: 'Cleaning Supplies', value: 'Cleaning Supplies' },
  { label: 'Packaging', value: 'Packaging' },
  { label: 'Cooking Oil', value: 'Cooking Oil' },
  { label: 'Bottled Water', value: 'Bottled Water' },
  { label: 'Detergent', value: 'Detergent' },
];

export const UOM_OPTIONS = [
  { label: 'Unit', value: 'Unit' },
  { label: 'Piece', value: 'Piece' },
  { label: 'Box', value: 'Box' },
  { label: 'Pack', value: 'Pack' },
  { label: 'Bottle', value: 'Bottle' },
  { label: 'Can', value: 'Can' },
  { label: 'Tin', value: 'Tin' },
  { label: 'Roll', value: 'Roll' },
  { label: 'Ream', value: 'Ream' },
  { label: 'Set', value: 'Set' },
  { label: 'Case', value: 'Case' },
  { label: 'Bag', value: 'Bag' },
  { label: 'Cartridge', value: 'Cartridge' },
];

/**
 * Weighted average is the only costing method the backend implements, and the
 * only value its API accepts.
 *
 * These options used to send 'FIFO' / 'LIFO' / 'Weighted Average' — none of
 * which match the API enum ('average'), so every item create and edit from
 * this form was rejected with a 400. The form also defaulted to FIFO, so it
 * failed on every submission.
 */
export const COST_METHOD_OPTIONS = [
  { label: 'Weighted Average', value: 'average' },
];

export const generateNextSKU = (existingSKUs: string[], category: string): string => {
  const prefixMap: Record<string, string> = {
    Electronics: 'ELC',
    'Office Supplies': 'OFS',
    Furniture: 'FRN',
    'Cleaning Supplies': 'CLN',
    Packaging: 'PKG',
    'Cooking Oil': 'COK',
    'Bottled Water': 'BTW',
    Detergent: 'DET',
  };
  const prefix = prefixMap[category] || 'ITM';
  const matching = existingSKUs.filter(s => s.startsWith(prefix));
  const num = matching.length + 1;
  return `${prefix}-${String(num).padStart(3, '0')}`;
};

export const validateInventoryItem = (
  data: InventoryFormData,
  existingSKUs: string[],
  editingId?: string,
): ValidationErrors => {
  const errors: ValidationErrors = {};

  // Name
  if (!data.name.trim()) {
    errors.name = 'Item name is required';
  } else if (data.name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters';
  }

  // SKU
  if (!data.sku.trim()) {
    errors.sku = 'SKU is required';
  } else if (existingSKUs.includes(data.sku.trim()) && !editingId) {
    errors.sku = 'SKU already exists';
  }

  // Category
  if (!data.category) {
    errors.category = 'Category is required';
  }

  // Unit Cost
  const cost = parseFloat(data.unitCost);
  if (!data.unitCost.trim()) {
    errors.unitCost = 'Unit cost is required';
  } else if (isNaN(cost) || cost < 0) {
    errors.unitCost = 'Enter a valid cost';
  }

  // Selling Price
  const price = parseFloat(data.sellingPrice);
  if (!data.sellingPrice.trim()) {
    errors.sellingPrice = 'Selling price is required';
  } else if (isNaN(price) || price < 0) {
    errors.sellingPrice = 'Enter a valid price';
  }

  // Quantity is deliberately NOT validated here, because it is no longer
  // entered here. It used to be a required field that the API silently
  // discarded — the form demanded a number, reported success, and saved zero.
  // Stock now only arrives through a path that posts a journal entry:
  // a Purchase Order receipt, an Opening Stock entry, or a Stock Adjustment.

  return errors;
};

// ─── Empty defaults for screens that reference data locally ──
/**
 * Projects the weighted-average cost a receipt would produce, mirroring the
 * server's fold in purchase-orders.service.ts exactly — including its guard
 * against a negative on-hand contributing negative value:
 *
 *     newCost = (Q·A + q·P) / (Q + q)
 *
 * Display only. The cost itself moves when goods are RECEIVED, together with
 * the DR Inventory / CR GRNI entry; nothing here writes it.
 */
export const previewWeightedAverage = (
  onHand: number,
  avgCost: number,
  receivingQty: number,
  unitPrice: number,
): number => {
  const newQty = onHand + receivingQty;
  if (!(receivingQty > 0) || !(newQty > 0)) return avgCost;
  const oldValue = onHand < 0 ? 0 : onHand * avgCost;
  return (oldValue + receivingQty * unitPrice) / newQty;
};

// ─── Stock movements (the inventory audit trail) ─────
/**
 * The six types the API actually emits. There is no 'opening' and no
 * 'reversal': opening stock is an 'adjustment' with sourceType
 * 'opening_stock', and a voided adjustment is an 'adjustment' with sourceType
 * 'inventory_adjustment_void'. `sourceType` is the only thing that tells them
 * apart, which is why movementLabel() below reads it rather than `type`.
 */
export type StockMovementType =
  | 'adjustment'
  | 'delivery'
  | 'receipt'
  | 'transfer'
  | 'sale'
  | 'return';

/**
 * Mirrors the InventoryMovement entity, which GET items/:id/movements returns
 * unmapped. `date` is a date-only column ('YYYY-MM-DD'), so `createdAt` is the
 * only within-day ordering the rows carry.
 */
export interface StockMovement {
  id: string;
  date: string;
  type: StockMovementType;
  reference: string;
  description: string;
  /** Signed: negative is stock leaving. */
  quantityChange: number;
  /** Running balance snapshotted by the server at insert time. */
  balanceAfter: number;
  sourceType: string;
  sourceId: string;
  createdAt: string;
}

/**
 * What to call a movement on screen. `type` alone is too coarse — opening
 * stock, a physical count and a voided adjustment are all 'adjustment' — so
 * the more specific `sourceType` wins where it says something the type does
 * not.
 */
export const movementLabel = (mv: Pick<StockMovement, 'type' | 'sourceType'>): string => {
  switch (mv.sourceType) {
    case 'opening_stock': return 'Opening';
    case 'inventory_adjustment_void': return 'Reversal';
    case 'physical_count': return 'Count';
    case 'purchase_order': return 'Receipt';
    default:
      return mv.type ? mv.type.charAt(0).toUpperCase() + mv.type.slice(1) : '—';
  }
};
