// ═══════════════════════════════════════════════════════
// FinMatrix — Billing Serializer
// ═══════════════════════════════════════════════════════
// Defensive envelope unwrapping for /billing responses (extracted
// verbatim from billingNetwork). The backend's global envelope nests
// payloads at res.data.data; some list endpoints return the array
// directly, others nest it once more.

import type { PaymentSubmissionView } from '../models/billingModel';

export const billingEnvelopeSerializer = (res: any) =>
  res?.data?.data ?? res?.data;

export const submissionListSerializer = (res: any): PaymentSubmissionView[] => {
  const data = billingEnvelopeSerializer(res);
  return Array.isArray(data) ? data : data?.data ?? [];
};
