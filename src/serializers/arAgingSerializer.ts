import type { ARAgingReport, ARAgingReportResponse } from '../models/arAgingModel';
import { unwrapEnvelope } from '../networks/reports/reportHelpers';

export const arAgingSerializer = (
  payload: ARAgingReportResponse,
): ARAgingReport | null => unwrapEnvelope<ARAgingReport>(payload);
