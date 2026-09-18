// ═══════════════════════════════════════════════════════
// FinMatrix — Delivery Serializer
// ═══════════════════════════════════════════════════════
// Sits BETWEEN network and slice.
// Takes the raw API envelope and returns a clean,
// UI-ready data structure with inline field mapping.
// Mirrors `glSerializer.ts` / `billSerializer.ts`.

import type {
  DeliveryRecord,
  DeliveryRecordStatus,
  DeliveryItemLine,
  StatusHistoryEntry,
  DummyDeliveryPerson,
  InventoryUpdateRequest,
  InventoryUpdateChange,
  ShadowInventoryRecord,
  ShadowInventoryChange,
} from '../models/deliveryModel';
import type { DeliveryPaidStatus } from '../utils/deliveryCollection';
import type {
  DeliveryApiEntity,
  DeliveryPersonApiEntity,
  InventoryUpdateRequestApiEntity,
  ShadowInventoryApiEntity,
} from '../models/deliveryModel';

// ─── Counts ─────────────────────────────────────────
export type DeliveryStatusCounts = Record<'all' | DeliveryRecordStatus, number>;

// ─── Serialized output for the list slice ────────────
export interface SerializedDeliveryList {
  deliveries: DeliveryRecord[];
  page: number;
  totalPages: number;
  totalDeliveries: number;
  counts: DeliveryStatusCounts;
}

export interface SerializedPersonnelList {
  personnel: DummyDeliveryPerson[];
  page: number;
  totalPages: number;
  totalPersonnel: number;
}

// ─── Raw → UI mappers ────────────────────────────────
const toNum = (v: any, fallback: number): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
};

const mapItemLine = (
  raw: Partial<DeliveryItemLine> & Record<string, any>,
): DeliveryItemLine => ({
  itemId: raw.itemId ?? '',
  itemName: raw.itemName ?? '',
  agencyId: raw.agencyId ?? '',
  agencyName: raw.agencyName ?? '',
  orderedQty: raw.orderedQty !== undefined ? toNum(raw.orderedQty, 0) : toNum(raw.quantity, 0),
  quantity: toNum(raw.quantity, 0),
  deliveredQty: raw.deliveredQty !== undefined ? toNum(raw.deliveredQty, 0) : undefined,
  returnedQty: raw.returnedQty !== undefined ? toNum(raw.returnedQty, 0) : undefined,
  unitPrice: toNum(raw.unitPrice, 0),
  taxRate: toNum(raw.taxRate, 0),
});

const mapStatusHistory = (
  raw: Partial<StatusHistoryEntry>,
): StatusHistoryEntry => ({
  status: (raw.status as DeliveryRecordStatus) ?? 'unassigned',
  timestamp: raw.timestamp ?? '',
  note: raw.note,
  updatedBy: raw.updatedBy,
});

/** Faithful pass-through; anything unrecognised (incl. null) stays undefined. */
const mapPaidStatus = (v: unknown): DeliveryPaidStatus | undefined =>
  v === 'paid' || v === 'partial' || v === 'unpaid' ? v : undefined;

export const mapDelivery = (
  raw: Partial<DeliveryApiEntity> & Record<string, any>,
): DeliveryRecord => ({
  id: raw.id ?? raw._id ?? '',
  reference: raw.reference ?? raw.referenceNo ?? raw.ref ?? '',
  referenceNo: raw.referenceNo ?? raw.reference ?? raw.ref ?? '',
  customerId: raw.customerId ?? raw.customer_id ?? '',
  customerName: raw.customerName ?? raw.customer_name ?? '',
  zone: raw.zone ?? '',
  scheduledDate: raw.scheduledDate ?? raw.scheduled_date ?? raw.preferredDate ?? raw.preferred_date ?? '',
  priority: raw.priority ?? 'medium',
  status: raw.status ?? 'unassigned',
  assignedTo: raw.assignedTo ?? raw.personnelId ?? raw.assigned_to ?? raw.personnelUserId,
  assignedAt: raw.assignedAt ?? raw.assigned_at,
  notes: raw.notes,
  items: Array.isArray(raw.items) ? raw.items.map(mapItemLine) : [],
  createdAt: raw.createdAt ?? raw.created_at ?? '',
  updatedAt: raw.updatedAt ?? raw.updated_at ?? '',
  address: raw.address ?? raw.deliveryAddress,
  destLat: raw.destLat ?? raw.dest_lat ?? raw.destination?.lat ?? undefined,
  destLng: raw.destLng ?? raw.dest_lng ?? raw.destination?.lng ?? undefined,
  customerPhone: raw.customerPhone ?? raw.customer_phone,
  statusHistory: Array.isArray(raw.statusHistory)
    ? raw.statusHistory.map(mapStatusHistory)
    : Array.isArray(raw.status_history)
      ? raw.status_history.map(mapStatusHistory)
      : [],
  signature: raw.signature,
  signatureBase64: raw.signatureBase64,
  photos: Array.isArray(raw.photos) ? [...raw.photos] : undefined,
  customerVerified: raw.customerVerified,
  pickedUpAt: raw.pickedUpAt ?? raw.picked_up_at,
  inTransitAt: raw.inTransitAt ?? raw.in_transit_at,
  arrivedAt: raw.arrivedAt ?? raw.arrived_at,
  deliveredAt: raw.deliveredAt ?? raw.delivered_at,
  issueNote: raw.issueNote ?? raw.issue_note,
  // The backend has always returned these (myDeliveries hands back whole
  // entities), but they were never mapped — so the rider's screens could not
  // tell a pre-paid job from a cash one and always asked for payment.
  prepaid: Boolean(raw.prepaid ?? raw.pre_paid),
  paidStatus: mapPaidStatus(raw.paidStatus ?? raw.paid_status),
  advanceAmount: toNum(raw.advanceAmount ?? raw.advance_amount, 0),
  advancePaymentId: raw.advancePaymentId ?? raw.advance_payment_id ?? null,
  amountCollected:
    raw.amountCollected === null || raw.amountCollected === undefined
      ? null
      : toNum(raw.amountCollected, 0),
});


export const mapDeliveryPerson = (
  raw: Partial<DeliveryPersonApiEntity> & Record<string, any>,
): DummyDeliveryPerson => {
  // Determine status: default to 'active' since the backend returns them from the personnel endpoint
  const rawStatus = raw.status ?? raw.accountStatus;
  const status: DummyDeliveryPerson['status'] =
    rawStatus === 'inactive' ? 'inactive'
    : rawStatus === 'on_leave' ? 'on_leave'
    // Must not fall through to 'active': a rider the plan has paused cannot
    // sign in or take work, and showing them as active would say otherwise.
    : rawStatus === 'plan_locked' ? 'plan_locked'
    : rawStatus === 'on_delivery' ? 'on_delivery'
    : 'active';

  // Build display name from available fields
  const displayName = raw.displayName ?? raw.name ?? raw.fullName ?? raw.username
    ?? raw.email?.split('@')[0]
    ?? `Driver ${raw.vehicleNumber ?? raw.userId?.slice(0, 6) ?? ''}`;

  return {
    userId: raw.userId ?? raw.id ?? raw._id ?? '',
    displayName,
    username: raw.username ?? raw.email?.split('@')[0] ?? '',
    email: raw.email ?? '',
    password: raw.password ?? '',
    phone: raw.phone ?? raw.phoneNumber ?? '',
    role: 'delivery',
    companyId: raw.companyId ?? raw.company ?? '',
    isAvailable: raw.isAvailable !== false,
    currentLoad: toNum(raw.currentLoad, 0),
    maxLoad: toNum(raw.maxLoad ?? raw.max_load, 10),
    rating: toNum(raw.rating, 0),
    totalDeliveries: toNum(raw.totalDeliveries, 0),
    onTimeRate: toNum(raw.onTimeRate, 0),
    status,
    vehicleType: raw.vehicleType ?? raw.vehicle_type ?? 'motorcycle',
    vehicleNumber: raw.vehicleNumber ?? raw.vehicle_number ?? '',
    zones: Array.isArray(raw.zones) ? [...raw.zones] : ['Zone A', 'Zone B', 'Zone C', 'Zone D'],
  };
};

const mapInventoryChange = (
  raw: Partial<InventoryUpdateChange>,
): InventoryUpdateChange => ({
  itemId: raw.itemId ?? '',
  itemName: raw.itemName ?? '',
  beforeQty: typeof raw.beforeQty === 'number' ? raw.beforeQty : 0,
  deliveredQty: typeof raw.deliveredQty === 'number' ? raw.deliveredQty : 0,
  returnedQty: typeof raw.returnedQty === 'number' ? raw.returnedQty : 0,
});

export const mapInventoryUpdateRequest = (
  raw: Partial<InventoryUpdateRequestApiEntity>,
): InventoryUpdateRequest => ({
  id: raw.id ?? '',
  deliveryId: raw.deliveryId ?? '',
  deliveryReference: raw.deliveryReference ?? '',
  personnelId: raw.personnelId ?? '',
  personnelName: raw.personnelName ?? '',
  routeLabel: raw.routeLabel ?? '',
  submittedAt: raw.submittedAt ?? '',
  status: raw.status ?? 'pending',
  shadowStatus: raw.shadowStatus ?? 'pending',
  reviewedAt: raw.reviewedAt,
  reviewedBy: raw.reviewedBy,
  reviewerRole: raw.reviewerRole ?? null,
  reversalCreditMemoId: (raw as any).reversalCreditMemoId ?? null,
  reviewerComment: raw.reviewerComment,
  paidStatus: mapPaidStatus((raw as any).paidStatus) ?? 'unpaid',
  prepaid: Boolean((raw as any).prepaid),
  advanceAmount: (raw as any).advanceAmount ?? '0',
  advanceApplied: (raw as any).advanceApplied ?? '0',
  amountDue: (raw as any).amountDue ?? (raw as any).saleAmount ?? '0',
  amountCollected: (raw as any).amountCollected ?? '0',
  balanceDue: (raw as any).balanceDue ?? '0',
  ledgerStatus: (raw as any).ledgerStatus ?? 'none',
  customerId: (raw as any).customerId ?? '',
  customerName: (raw as any).customerName ?? '',
  saleAmount: (raw as any).saleAmount ?? '0',
  changes: Array.isArray(raw.changes) ? raw.changes.map(mapInventoryChange) : [],
  proof: raw.proof
    ? (() => {
        const p = raw.proof as any;
        return {
          signatureBase64: p.signatureBase64 ?? '',
          signedBy: p.signedBy ?? '',
          verificationMethod: p.verificationMethod ?? 'bill_photo',
          verifiedBy: p.verifiedBy ?? '',
          verifiedAt: p.verifiedAt ?? '',
          billPhotoUri: p.billPhotoUri ?? p.bill_photo_uri ?? p.photoUrl ?? '',
          billPhotoCapturedAt: p.billPhotoCapturedAt ?? p.bill_photo_captured_at ?? '',
        };
      })()
    : {
        signatureBase64: '',
        signedBy: '',
        verificationMethod: 'manual',
        verifiedBy: '',
        verifiedAt: '',
      },
});

const mapShadowChange = (
  raw: Partial<ShadowInventoryChange>,
): ShadowInventoryChange => ({
  id: raw.id ?? '',
  timestamp: raw.timestamp ?? '',
  originalQty: typeof raw.originalQty === 'number' ? raw.originalQty : 0,
  currentQty: typeof raw.currentQty === 'number' ? raw.currentQty : 0,
  delta: typeof raw.delta === 'number' ? raw.delta : 0,
  reason: raw.reason ?? '',
  status: raw.status ?? 'pending',
});

export const mapShadowInventory = (
  raw: Partial<ShadowInventoryApiEntity>,
): ShadowInventoryRecord => ({
  id: raw.id ?? '',
  personnelId: raw.personnelId ?? '',
  itemId: raw.itemId ?? '',
  itemName: raw.itemName ?? '',
  originalQty: typeof raw.originalQty === 'number' ? raw.originalQty : 0,
  currentQty: typeof raw.currentQty === 'number' ? raw.currentQty : 0,
  status: raw.status ?? 'pending',
  changesToday: Array.isArray(raw.changesToday)
    ? raw.changesToday.map(mapShadowChange)
    : [],
});

// ─── Envelope serializers ────────────────────────────
export function deliveryListSerializer(payload: any): SerializedDeliveryList {
  const data = payload?.data;
  const raw: any[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.deliveries)
      ? data.deliveries
      : [];
  const pagination = (data && !Array.isArray(data)) ? (data.pagination || {}) : {};
  const totals = (data && !Array.isArray(data)) ? (data.totals || {}) : {};

  const deliveries = raw.map(mapDelivery);

  const counts: DeliveryStatusCounts = totals.counts || {
    all: deliveries.length,
    unassigned: deliveries.filter(d => d.status === 'unassigned').length,
    pending: deliveries.filter(d => d.status === 'pending').length,
    picked_up: deliveries.filter(d => d.status === 'picked_up').length,
    in_transit: deliveries.filter(d => d.status === 'in_transit').length,
    arrived: deliveries.filter(d => d.status === 'arrived').length,
    delivered: deliveries.filter(d => d.status === 'delivered').length,
    failed: deliveries.filter(d => d.status === 'failed').length,
    returned: deliveries.filter(d => d.status === 'returned').length,
    cancelled: deliveries.filter(d => d.status === 'cancelled').length,
  };

  return {
    deliveries,
    page: pagination.page ?? 1,
    totalPages: pagination.totalPages ?? 1,
    totalDeliveries: pagination.total ?? deliveries.length,
    counts,
  };
}

export function deliverySingleSerializer(
  payload: any,
): DeliveryRecord | null {
  const raw = payload?.data?.delivery ?? (payload?.data && !Array.isArray(payload.data) ? payload.data : null);
  if (!raw) return null;
  return mapDelivery(raw);
}

export function deliveryListMutationSerializer(payload: any): DeliveryRecord[] {
  const raw = payload?.data?.deliveries;
  if (!Array.isArray(raw)) return [];
  return raw.map(mapDelivery);
}

export function personnelListSerializer(payload: any): SerializedPersonnelList {
  const data = payload?.data;
  const raw: any[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.personnel)
      ? data.personnel
      : Array.isArray(data?.deliveryPersonnel)
        ? data.deliveryPersonnel
        : Array.isArray(data?.users)
          ? data.users
          : Array.isArray(payload?.personnel)
            ? payload.personnel
            : Array.isArray(payload?.deliveryPersonnel)
              ? payload.deliveryPersonnel
              : [];
  const pagination = (data && !Array.isArray(data)) ? (data.pagination || data.meta || {}) : {};
  const personnel = raw.map(mapDeliveryPerson);
  return {
    personnel,
    page: pagination.page ?? pagination.currentPage ?? 1,
    totalPages: pagination.totalPages ?? pagination.pages ?? 1,
    totalPersonnel: pagination.total ?? pagination.totalCount ?? personnel.length,
  };
}

export function personnelSingleSerializer(
  payload: any,
): DummyDeliveryPerson | null {
  const raw = payload?.data?.personnel ?? (payload?.data && !Array.isArray(payload.data) ? payload.data : null);
  if (!raw) return null;
  return mapDeliveryPerson(raw);
}

export function inventoryUpdateRequestListSerializer(
  payload: any,
): InventoryUpdateRequest[] {
  const raw =
    payload?.data?.requests ??
    payload?.data?.approvals ??
    payload?.data?.inventoryApprovals ??
    (Array.isArray(payload?.data) ? payload.data : null) ??
    (Array.isArray(payload) ? payload : null);
  if (!Array.isArray(raw)) return [];
  return raw.map(mapInventoryUpdateRequest);
}

export function inventoryUpdateRequestSingleSerializer(
  payload: any,
): InventoryUpdateRequest | null {
  const raw =
    payload?.data?.request ??
    payload?.data?.approval ??
    (payload?.data && !Array.isArray(payload.data) ? payload.data : null);
  if (!raw) return null;
  return mapInventoryUpdateRequest(raw);
}

export function shadowInventoryListSerializer(
  payload: any,
): ShadowInventoryRecord[] {
  const raw = payload?.data?.records;
  if (!Array.isArray(raw)) return [];
  return raw.map(mapShadowInventory);
}
