// ═══════════════════════════════════════════════════════
// FinMatrix — DP Customer Confirm Network (Production API)
// ═══════════════════════════════════════════════════════

import { api, extractErrorMessage } from '../network/apiHelpers';

/** Mirrors the API enum — anything else is rejected. */
export type DeliveryIssueType =
  | 'damaged'
  | 'wrong_item'
  | 'customer_refused'
  | 'access_denied'
  | 'payment_issue'
  | 'other';

export const confirmReceiptAPI = async (deliveryId: string, data: any): Promise<any> => {
  try {
    const response = await api.post(`/deliveries/${deliveryId}/confirm`, data);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const reportIssueAPI = async (
  deliveryId: string,
  data: { issueType: DeliveryIssueType; notes: string; photoUrl?: string },
): Promise<any> => {
  try {
    const response = await api.post(`/deliveries/${deliveryId}/issues`, data);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const confirmCustomerReceiptAPI = async (payload: any): Promise<any> => {
  const { deliveryId, ...data } = payload;
  return confirmReceiptAPI(deliveryId, data);
};

/** DeliveryIssueDto requires `issueType` (an enum) and `notes`. The screens
 *  only collect free text, which was being sent as `note` — so the required
 *  fields were absent and every report 400'd, while the screen still said
 *  "Issue Reported". Free text maps to `other` unless the caller names a
 *  category. */
export const reportDeliveryIssueAPI = async (payload: {
  deliveryId: string;
  note?: string;
  notes?: string;
  issueType?: DeliveryIssueType;
  photoUrl?: string;
}): Promise<any> => {
  const { deliveryId, issueType, photoUrl } = payload;
  const notes = (payload.notes ?? payload.note ?? '').trim();
  return reportIssueAPI(deliveryId, {
    issueType: issueType ?? 'other',
    notes: notes || 'Issue reported by customer at delivery.',
    ...(photoUrl ? { photoUrl } : {}),
  });
};
