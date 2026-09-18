import type {
  StartDeliveryResponse,
  StartDeliveryResult,
} from '../models/dpDashboardModel';

export const dpDashboardSerializer = (
  payload: StartDeliveryResponse,
): StartDeliveryResult | null => {
  if (!payload || payload.success === false) return null;
  return payload.data ?? null;
};
