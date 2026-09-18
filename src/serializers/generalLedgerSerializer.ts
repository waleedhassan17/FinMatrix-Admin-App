import type {
  GeneralLedgerReport, GeneralLedgerResponse, LedgerAccountsReport, LedgerAccountsResponse,
} from '../models/generalLedgerModel';
import { unwrapEnvelope } from '../networks/reports/reportHelpers';

export const generalLedgerSerializer = (
  payload: GeneralLedgerResponse,
): GeneralLedgerReport | null => unwrapEnvelope<GeneralLedgerReport>(payload);

export const ledgerAccountsSerializer = (
  payload: LedgerAccountsResponse,
): LedgerAccountsReport | null => unwrapEnvelope<LedgerAccountsReport>(payload);
