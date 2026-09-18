// ─── Delivery-Personnel Delivery-Complete Model (GL pattern) ─────────────────
// Per-feature model owned by DeliveryComplete screen. Holds the payload &
// envelope response for the post-completion shadow-inventory submit.

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export interface SubmitDeliveryCompletePayload {
  deliveryId: string;
  personnelId: string;
}

export interface DeliveryCompleteResult {
  requestId: string;
  deliveryId: string;
  personnelId: string;
  submittedAt: string;
  status: 'submitted';
}

export type DeliveryCompleteResponse = ApiEnvelope<DeliveryCompleteResult>;
