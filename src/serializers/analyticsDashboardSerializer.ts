import type {
  AnalyticsDashboardData,
  AnalyticsDashboardResponse,
} from '../models/analyticsDashboardModel';
import { unwrapEnvelope } from '../networks/reports/reportHelpers';

export const analyticsDashboardSerializer = (
  payload: AnalyticsDashboardResponse,
): AnalyticsDashboardData | null => unwrapEnvelope<AnalyticsDashboardData>(payload);
