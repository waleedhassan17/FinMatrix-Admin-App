import type {
  DeliveryCompleteResponse,
  DeliveryCompleteResult,
} from '../models/dpDeliveryCompleteModel';

export const dpDeliveryCompleteSerializer = (
  payload: DeliveryCompleteResponse,
): DeliveryCompleteResult | null => {
  if (!payload || payload.success === false) return null;
  return payload.data ?? null;
};
