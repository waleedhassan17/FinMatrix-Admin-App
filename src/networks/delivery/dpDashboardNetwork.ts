// ═══════════════════════════════════════════════════════
// FinMatrix — DP Dashboard Network (Production API)
// ═══════════════════════════════════════════════════════

import { api, extractErrorMessage } from '../network/apiHelpers';

export const getMyDashboardAPI = async (): Promise<any> => {
  try {
    const response = await api.get('/deliveries/my/dashboard');
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

/**
 * Advance a delivery to `status`.
 *
 * The target used to be hardcoded to 'in_transit', which the server rejects
 * from 'pending' — its state machine only allows
 * pending → picked_up → in_transit, because picking stock up at the warehouse
 * and setting off with it are genuinely different events. The dashboard's
 * shortcut button therefore failed for every rider starting a job. The caller
 * now passes the next LEGAL status instead.
 */
export const startDeliveryAPI = async (payload: any): Promise<any> => {
  try {
    const deliveryId = typeof payload === 'string' ? payload : payload.deliveryId;
    const note = typeof payload === 'object' ? payload.note : undefined;
    const status =
      (typeof payload === 'object' && payload.status) || 'in_transit';
    // `notes`, not `note` — see dpDeliveryDetailNetwork.
    const response = await api.patch(`/deliveries/${deliveryId}/status`, {
      status,
      ...(note ? { notes: note } : {}),
    });
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};
