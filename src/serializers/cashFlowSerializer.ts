import type { CashFlowReport, CashFlowReportResponse } from '../models/cashFlowModel';
import { unwrapEnvelope } from '../networks/reports/reportHelpers';

export const cashFlowSerializer = (
  payload: CashFlowReportResponse,
): CashFlowReport | null => unwrapEnvelope<CashFlowReport>(payload);
