// ═══════════════════════════════════════════════════════
// FinMatrix — DP Delivery Complete Network (Production API)
// ═══════════════════════════════════════════════════════

import { api, extractErrorMessage } from '../network/apiHelpers';

export const completeDeliveryAPI = async (deliveryId: string, data: any): Promise<any> => {
  try {
    const response = await api.patch(`/deliveries/${deliveryId}/status`, { status: 'delivered', ...data });
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const submitDeliveryCompleteAPI = async (payload: any): Promise<any> => {
  const { deliveryId, ...data } = payload;
  return completeDeliveryAPI(deliveryId, data);
};
