// ═══════════════════════════════════════════════════════
// FinMatrix — Sales document lines: stock item or service
// ═══════════════════════════════════════════════════════
// In a company that keeps inventory, a product line on an estimate, sales
// order or invoice must be an inventory item, so selling it moves stock and
// posts cost of sales. A line with no item is allowed only when it is
// explicitly a service or charge (delivery, installation, labour). The server
// refuses anything else with LINE_ITEM_REQUIRED — QA managed to sell
// "Roar-X Drinks", a product the company neither stocks nor catalogues.

/** The few fields a line picker needs — satisfied by every inventory shape. */
export interface StockItemLike {
  id: string;
  sku?: string;
  name: string;
  quantityOnHand: number;
  isActive?: boolean;
}

export type SalesLineKind = 'item' | 'service';

/** The picker value for "this line is a service / charge". */
export const SERVICE_LINE_VALUE = '__service__';

export interface SalesLineDraftKind {
  itemId: string;
  /** '' until the user picks an item or chooses service. */
  lineKind: SalesLineKind | '';
}

/** Picker options: every active stock item, then the service choice. */
export function salesLineOptions(inventory: StockItemLike[]) {
  return [
    ...inventory
      .filter(it => it.isActive !== false)
      .map(it => ({
        label: `${it.sku ? `${it.sku} · ` : ''}${it.name} · on hand ${formatQty(it.quantityOnHand)}`,
        value: it.id,
      })),
    { label: 'Service / charge (no stock)', value: SERVICE_LINE_VALUE },
  ];
}

/** The picker's value for a line. */
export const salesLinePickerValue = (l: SalesLineDraftKind) =>
  l.itemId ? l.itemId : l.lineKind === 'service' ? SERVICE_LINE_VALUE : '';

/**
 * A line loaded from the server. A stored line with no item reads as a
 * service — that is what the server treats it as too.
 */
export const kindOfStoredLine = (itemId?: string | null): SalesLineKind =>
  itemId ? 'item' : 'service';

/** The classification keys for a save payload. */
export function salesLineKindPayload(
  l: SalesLineDraftKind,
  inventoryEnabled: boolean,
): { itemId?: string; lineKind?: SalesLineKind } {
  if (l.itemId) return { itemId: l.itemId, lineKind: 'item' };
  // Without inventory every line is free text, and a service by definition.
  if (!inventoryEnabled || l.lineKind === 'service') return { lineKind: 'service' };
  return {};
}

/** The first line that is neither an item nor a service, or -1. */
export const firstUnclassifiedLine = (
  lines: SalesLineDraftKind[],
  inventoryEnabled: boolean,
): number =>
  inventoryEnabled ? lines.findIndex(l => !l.itemId && l.lineKind !== 'service') : -1;

export const UNCLASSIFIED_LINE_MESSAGE =
  'Pick an inventory item for each product, or mark the line as a service / charge.';

function formatQty(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

/** A stock hint for an item line: on hand, and the shortfall if any. */
export function stockHint(
  item: StockItemLike | undefined,
  quantity: string,
): { text: string; short: boolean } | null {
  if (!item) return null;
  const onHand = Number(item.quantityOnHand) || 0;
  const qty = parseFloat(quantity) || 0;
  const short = qty > onHand;
  return {
    text: short
      ? `On hand ${formatQty(onHand)} · backorder ${formatQty(qty - onHand)}`
      : `On hand ${formatQty(onHand)}`,
    short,
  };
}

export interface BackorderShortfall {
  name: string;
  requested: number;
  available: number;
  shortfall: number;
}

export const BACKORDER_CONFIRMATION_REQUIRED = 'BACKORDER_CONFIRMATION_REQUIRED';

/** The shortfalls off a 409, or null when it is some other error. */
export function backorderShortfalls(error: any): BackorderShortfall[] | null {
  if (error?.code !== BACKORDER_CONFIRMATION_REQUIRED) return null;
  const lines: any[] = Array.isArray(error?.details?.lines) ? error.details.lines : [];
  return lines.map(l => ({
    name: String(l?.name ?? 'Item'),
    requested: parseFloat(l?.requested) || 0,
    available: parseFloat(l?.available) || 0,
    shortfall: parseFloat(l?.shortfall) || 0,
  }));
}

export const backorderMessage = (lines: BackorderShortfall[]) =>
  `${lines
    .map(l => `${l.name}: ordered ${formatQty(l.requested)}, available ${formatQty(l.available)} (short ${formatQty(l.shortfall)})`)
    .join('\n')}\n\nSave the order with the shortfall on backorder? It cannot be shipped or invoiced until stock arrives.`;
