import type {
  DeliveryDailyReport,
  DeliveryDailyReportResponse,
} from '../models/deliveryDailyReportModel';
import { unwrapEnvelope } from '../networks/reports/reportHelpers';

export const deliveryDailyReportSerializer = (
  payload: DeliveryDailyReportResponse,
): DeliveryDailyReport | null => unwrapEnvelope<DeliveryDailyReport>(payload);
