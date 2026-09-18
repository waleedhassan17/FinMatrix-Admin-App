import type {
  UpdateDeliveryStatusResponse,
  UpdateDeliveryStatusResult,
} from '../models/dpDeliveryDetailModel';

export const dpDeliveryDetailSerializer = (
  payload: UpdateDeliveryStatusResponse,
): UpdateDeliveryStatusResult | null => {
  if (!payload || payload.success === false) return null;
  return payload.data ?? null;
};
