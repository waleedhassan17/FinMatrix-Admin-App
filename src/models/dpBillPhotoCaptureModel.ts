// ─── Delivery-Personnel Bill-Photo-Capture Model (GL pattern) ────────────────
// Per-feature model owned by BillPhotoCapture screen. Holds the payload &
// envelope response for uploading a photo of the manually signed bill, which
// becomes the proof for the Inventory Update Request the admin approves.

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export type BillPhotoSource = 'camera' | 'gallery';

export interface BillPhotoChange {
  itemId: string;
  itemName: string;
  beforeQty: number;
  deliveredQty: number;
  returnedQty: number;
}

export type { DeliveryPaidStatus } from '../utils/deliveryCollection';
import type { DeliveryPaidStatus } from '../utils/deliveryCollection';

export interface SubmitBillPhotoPayload {
  deliveryId: string;
  deliveryReference: string;
  personnelId: string;
  personnelName: string;
  routeLabel: string;
  /** Local URI returned by expo-image-picker (file://...). */
  photoUri: string;
  source: BillPhotoSource;
  /** Customer name written on the bill. */
  signedBy: string;
  /**
   * PAID: the amount due collected. PARTIAL: some of it (amountCollected).
   * NOT PAID: on account. Posts nothing by itself — approval records the cash.
   * Always PAID when nothing is due (prepaid).
   */
  paidStatus: DeliveryPaidStatus;
  /** Cash received, required for PARTIAL. */
  amountCollected?: string;
  changes: BillPhotoChange[];
  note?: string;
}

export interface SubmitBillPhotoResult {
  /** Server-side id for the created Inventory Update Request. */
  requestId: string;
  deliveryId: string;
  photoUrl: string;
  uploadedAt: string;
  /** How the server settled the rider's answer. */
  paidStatus?: DeliveryPaidStatus;
  amountCollected?: string | null;
  amountDue?: string | null;
}

export type SubmitBillPhotoResponse = ApiEnvelope<SubmitBillPhotoResult>;
