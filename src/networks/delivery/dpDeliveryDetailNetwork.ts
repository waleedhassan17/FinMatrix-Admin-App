// ═══════════════════════════════════════════════════════
// FinMatrix — DP Delivery Detail Network (Production API)
// ═══════════════════════════════════════════════════════

import { api, extractErrorMessage } from '../network/apiHelpers';

/** DeliveryStatusUpdateDto is `{ status, notes? }`. The rider screens speak
 *  `note` internally; sending that name meant the field was whitelisted away
 *  and every note the rider typed was silently dropped. */
export const updateDeliveryStatusAPI = async (payload: {
  deliveryId: string;
  status: string;
  note?: string;
}): Promise<any> => {
  try {
    const { deliveryId, status, note } = payload;
    const response = await api.patch(`/deliveries/${deliveryId}/status`, {
      status,
      ...(note ? { notes: note } : {}),
    });
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const getDeliveryDetailAPI = async (deliveryId: string): Promise<any> => {
  try {
    const response = await api.get(`/deliveries/${deliveryId}`);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};
