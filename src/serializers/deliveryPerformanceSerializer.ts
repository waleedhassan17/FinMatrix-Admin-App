import type {
  DeliveryPerformanceReport,
  DeliveryPerformanceReportResponse,
} from '../models/deliveryPerformanceModel';
import { unwrapEnvelope } from '../networks/reports/reportHelpers';

export const deliveryPerformanceSerializer = (
  payload: DeliveryPerformanceReportResponse,
): DeliveryPerformanceReport | null => unwrapEnvelope<DeliveryPerformanceReport>(payload);
