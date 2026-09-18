// ═══════════════════════════════════════════════════════
// FinMatrix — Delivery Model & Validation
// ═══════════════════════════════════════════════════════
// Mirrors `glModel.ts` / `billModel.ts`:
//   • API entity types describing the raw backend shape
//   • Pagination envelope
//   • Query params for the list endpoints
// Plus form-validation helpers used by the create/assign screens.

// ─── Type Definitions ────────────────────────────────

import type { DeliveryPaidStatus } from '../utils/deliveryCollection';

// Mirrors the backend DeliveryStatus enum exactly. 'cancelled' was missing,
// which is why the admin cancel action wrote 'failed' — a different terminal
// state that the server distinguishes and that routes the delivery into the
// wrong admin queues.
export type DeliveryRecordStatus = 'unassigned' | 'pending' | 'picked_up' | 'in_transit' | 'arrived' | 'delivered' | 'failed' | 'returned' | 'cancelled';
export type DeliveryPriority = 'high' | 'medium' | 'low';
export type InventoryUpdateRequestStatus = 'pending' | 'approved' | 'rejected';
export type ShadowInventoryStatus = 'pending' | 'synced' | 'rejected';

export interface DeliveryItemLine {
  itemId: string;
  itemName: string;
  agencyId?: string;
  agencyName?: string;
  /** What the ledger dispatches on. Derived from `quantity` when a draft is
   *  sent, so the two can never disagree. */
  orderedQty?: number;
  quantity: number;
  deliveredQty?: number;
  returnedQty?: number;
  unitPrice: number;
  /** Sales tax %, frozen on the line. Needed to show the rider the amount due. */
  taxRate?: number;
}

export interface StatusHistoryEntry {
  status: DeliveryRecordStatus;
  timestamp: string;
  note?: string;
  updatedBy?: string;
  location?: { lat: number; lng: number };
}

export interface DeliveryRecord {
  id: string;
  reference: string;
  referenceNo?: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  address?: string;
  destLat?: number;
  destLng?: number;
  personnelId?: string;
  personnelName?: string;
  assignedTo?: string;
  assignedAt?: string;
  status: DeliveryRecordStatus;
  priority: DeliveryPriority;
  zone?: string;
  scheduledDate?: string;
  preferredDate?: string;
  preferredTimeSlot?: string;
  items: DeliveryItemLine[];
  statusHistory: StatusHistoryEntry[];
  photos?: string[];
  signature?: string;
  signatureBase64?: string;
  customerVerified?: boolean;
  issueNote?: string;
  notes?: string;
  pickedUpAt?: string;
  inTransitAt?: string;
  arrivedAt?: string;
  deliveredAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  cancelReason?: string;
  billPhotoUrl?: string;
  billPhotoStorageKey?: string;
  billPhotoCapturedAt?: string;
  billSignedBy?: string;
  /**
   * Paid for in full before dispatch. The rider must NOT ask for money on
   * these, so the bill step shows "Already paid" instead of a choice — see
   * BillPhotoCaptureScreen.
   */
  prepaid?: boolean;
  /** Paid before dispatch, fully or in part. The rider collects only the rest. */
  advanceAmount?: number;
  /** The receipt holding the advance. */
  advancePaymentId?: string | null;
  /** Cash taken at the door: the rider's figure, final once approved. */
  amountCollected?: number | null;
  /** PAID / PART PAID / NOT PAID. Follows the invoice once approved. */
  paidStatus?: DeliveryPaidStatus;
  [key: string]: any;
}

export interface DummyDeliveryPerson {
  userId: string;
  email?: string;
  username?: string;
  displayName: string;
  phone?: string;
  vehicleType: string;
  vehicleNumber: string;
  zones: string[];
  maxLoad: number;
  // plan_locked: paused by the server because the plan allows fewer active
  // riders than the company has. Set by the system, cleared by a seat.
  status: 'active' | 'inactive' | 'on_delivery' | 'on_leave' | 'plan_locked';
  companyId?: string;
  role?: string;
  address?: string;
  isAvailable?: boolean;
  totalDeliveries?: number;
  onTimeRate?: number;
  password?: string;
  completedDeliveries?: number;
  rating?: number;
  currentLoad?: number;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface InventoryUpdateChange {
  itemId: string;
  itemName: string;
  beforeQty: number;
  deliveredQty: number;
  returnedQty: number;
}

export interface DeliveryProof {
  billPhotoUri?: string;
  signedBy?: string;
  signatureBase64?: string;
  verificationMethod?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  billPhotoCapturedAt?: string;
}

export interface InventoryUpdateRequest {
  id: string;
  deliveryId: string;
  deliveryReference?: string;
  personnelId: string;
  personnelName?: string;
  routeLabel?: string;
  submittedAt: string;
  status: InventoryUpdateRequestStatus;
  shadowStatus?: string;
  changes: InventoryUpdateChange[];
  proof?: DeliveryProof;
  reviewedAt?: string;
  reviewedBy?: string;
  /**
   * Which authority signed the delivery off — 'admin' or 'staff'. Both may
   * approve (Table B row 4), and the server snapshots the role at the time so
   * the badge reflects the authority that actually approved, not whatever the
   * reviewer's role happens to be now. Null on rows approved before the
   * column existed.
   */
  reviewerRole?: string | null;
  /**
   * The credit memo that reversed this delivery, once one has. Present means
   * the reversal already happened — the screen shows it instead of offering
   * the action again.
   */
  reversalCreditMemoId?: string | null;
  reviewNotes?: string;
  reviewerComment?: string;
  /** PAID / PART PAID / NOT PAID — the rider's answer until approval. */
  paidStatus?: DeliveryPaidStatus;
  /** Paid for in full before dispatch. */
  prepaid?: boolean;
  /** Paid before dispatch (fully or in part), as decimal strings from here down. */
  advanceAmount?: string;
  /** The part of the advance this sale uses. */
  advanceApplied?: string;
  /** What the advance leaves for the door. */
  amountDue?: string;
  /** Cash the rider collected — their figure until approval. */
  amountCollected?: string;
  /** Left for Accounts Receivable. */
  balanceDue?: string;
  /** 'none' | 'in_transit' | 'committed' | 'returned' */
  ledgerStatus?: string;
  customerId?: string;
  customerName?: string;
  /** Amount approval will invoice (delivered qty × price, tax incl.). */
  saleAmount?: string;
}

export interface ShadowInventoryChange {
  id: string;
  timestamp: string;
  originalQty: number;
  currentQty: number;
  delta: number;
  reason: string;
  status: ShadowInventoryStatus;
}

export interface ShadowInventoryRecord {
  id: string;
  personnelId: string;
  itemId: string;
  itemName: string;
  originalQty: number;
  currentQty: number;
  status: ShadowInventoryStatus;
  changesToday: ShadowInventoryChange[];
}

// ─── Raw API entity aliases (backend shape) ──────────
export type DeliveryApiEntity = DeliveryRecord;
export type DeliveryPersonApiEntity = DummyDeliveryPerson;
export type InventoryUpdateRequestApiEntity = InventoryUpdateRequest;
export type ShadowInventoryApiEntity = ShadowInventoryRecord;

// ─── Empty defaults for initial state ────────────────
export const deliveryRecords: DeliveryRecord[] = [];
export const dummyDeliveryPersonnel: DummyDeliveryPerson[] = [];
export const inventoryUpdateRequests: InventoryUpdateRequest[] = [];
export const shadowInventoryRecords: ShadowInventoryRecord[] = [];

// ─── Pagination envelope ─────────────────────────────
export interface DeliveryApiPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ─── Query params for list endpoints ─────────────────
export interface DeliveryQueryParams {
  search?: string;
  status?: 'all' | DeliveryRecordStatus;
  priority?: 'all' | DeliveryPriority;
  zone?: string;
  assignedTo?: string;
  page?: number;
  limit?: number;
}

export interface DeliveryPersonnelQueryParams {
  search?: string;
  status?: 'all' | DummyDeliveryPerson['status'];
  zone?: string;
  page?: number;
  limit?: number;
}


// ─── Status / priority labels & colors ───────────────
export const DELIVERY_STATUS_LABELS: Record<DeliveryRecordStatus, string> = {
  unassigned: 'Unassigned',
  pending: 'Pending',
  picked_up: 'Picked Up',
  in_transit: 'In Transit',
  arrived: 'Arrived',
  delivered: 'Delivered',
  failed: 'Failed',
  returned: 'Returned',
  cancelled: 'Cancelled',
};

export const DELIVERY_STATUS_COLORS: Record<DeliveryRecordStatus, string> = {
  unassigned: '#8993A4',
  pending: '#FF991F',
  picked_up: '#0065FF',
  in_transit: '#059669',
  arrived: '#6554C0',
  delivered: '#00875A',
  failed: '#DE350B',
  returned: '#5E6C84',
  // Matches theme.ts's existing cancelled entry (neutral, not an error red —
  // a cancellation is a deliberate admin action, not a delivery failure).
  cancelled: '#94A3B8',
};

export const DELIVERY_PRIORITY_LABELS: Record<DeliveryPriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const DELIVERY_PRIORITY_COLORS: Record<DeliveryPriority, string> = {
  high: '#DE350B',
  medium: '#FF991F',
  low: '#00875A',
};

// ─── Form types & validation ─────────────────────────
export interface ValidationErrors {
  [key: string]: string;
}

export interface DeliveryFormItem {
  itemId: string;
  itemName: string;
  agencyId: string;
  agencyName: string;
  quantity: string;
}

export interface DeliveryFormData {
  customerId: string;
  customerName: string;
  zone: string;
  scheduledDate: string;
  priority: DeliveryPriority;
  notes: string;
  items: DeliveryFormItem[];
}

export const validateDeliveryForm = (data: DeliveryFormData): ValidationErrors => {
  const errors: ValidationErrors = {};

  if (!data.customerId) errors.customerId = 'Select a customer';
  if (!data.zone.trim()) errors.zone = 'Zone is required';
  if (!data.scheduledDate) errors.scheduledDate = 'Scheduled date is required';

  if (data.items.length === 0) {
    errors.items = 'At least one item is required';
  } else {
    const hasInvalid = data.items.some(
      it => !it.itemId || !(parseFloat(it.quantity) > 0),
    );
    if (hasInvalid) errors.items = 'Every item must have an item and a positive quantity';
  }

  return errors;
};

export interface AssignDeliveryFormData {
  deliveryIds: string[];
  personnelId: string;
}

export const validateAssignment = (
  data: AssignDeliveryFormData,
): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (data.deliveryIds.length === 0) errors.deliveries = 'Select at least one delivery';
  if (!data.personnelId) errors.personnelId = 'Select a personnel';
  return errors;
};
