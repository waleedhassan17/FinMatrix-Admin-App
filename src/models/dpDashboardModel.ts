// ─── Delivery-Personnel Dashboard Model (GL pattern) ───────────────────────────
// Per-feature model owned by DPDashboard screen. Holds the payload &
// envelope response for starting a delivery from the dashboard.

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export interface StartDeliveryPayload {
  deliveryId: string;
  note?: string;
}

export interface StartDeliveryResult {
  deliveryId: string;
  status: 'in_transit';
  note?: string;
  updatedAt: string;
}

export type StartDeliveryResponse = ApiEnvelope<StartDeliveryResult>;
