import type { TrialBalanceReport, TrialBalanceReportResponse } from '../models/trialBalanceModel';
import { unwrapEnvelope } from '../networks/reports/reportHelpers';

export const trialBalanceSerializer = (
  payload: TrialBalanceReportResponse,
): TrialBalanceReport | null => unwrapEnvelope<TrialBalanceReport>(payload);
