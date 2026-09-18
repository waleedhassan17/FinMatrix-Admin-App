// ─── Delivery-Personnel Customer-Confirm Model (GL pattern) ──────────────────
// Per-feature model owned by CustomerConfirm screen. Holds the payloads &
// envelope responses for the two write actions: confirm receipt, report issue.

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

// ── Confirm receipt ─────────────────────────────────────────────────────────
export interface ConfirmReceiptPayload {
  deliveryId: string;
  verifiedBy: string;
}

export interface ConfirmReceiptResult {
  deliveryId: string;
  verifiedAt: string;
  verifiedBy: string;
}

export type ConfirmReceiptResponse = ApiEnvelope<ConfirmReceiptResult>;

// ── Report issue ────────────────────────────────────────────────────────────
export interface ReportIssuePayload {
  deliveryId: string;
  note: string;
}

export interface ReportIssueResult {
  deliveryId: string;
  reportedAt: string;
  note: string;
}

export type ReportIssueResponse = ApiEnvelope<ReportIssueResult>;
