import type { BalanceSheetReport, BalanceSheetReportResponse } from '../models/balanceSheetModel';
import { unwrapEnvelope } from '../networks/reports/reportHelpers';

export const balanceSheetSerializer = (
  payload: BalanceSheetReportResponse,
): BalanceSheetReport | null => unwrapEnvelope<BalanceSheetReport>(payload);
