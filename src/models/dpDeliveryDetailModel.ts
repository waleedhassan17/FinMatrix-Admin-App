// ─── Delivery-Personnel Delivery-Detail Model (GL pattern) ───────────────────
// Per-feature model owned by DPDeliveryDetail screen. Holds the payload &
// envelope response for updating a delivery's execution status.

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export type DeliveryExecutionStatus = 'picked_up' | 'in_transit' | 'arrived';

export interface UpdateDeliveryStatusPayload {
  deliveryId: string;
  status: DeliveryExecutionStatus;
  note?: string;
}

export interface UpdateDeliveryStatusResult {
  deliveryId: string;
  status: DeliveryExecutionStatus;
  note?: string;
  updatedAt: string;
}

export type UpdateDeliveryStatusResponse = ApiEnvelope<UpdateDeliveryStatusResult>;
