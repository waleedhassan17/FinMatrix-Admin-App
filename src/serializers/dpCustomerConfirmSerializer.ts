import type {
  ConfirmReceiptResponse,
  ConfirmReceiptResult,
  ReportIssueResponse,
  ReportIssueResult,
} from '../models/dpCustomerConfirmModel';

export const confirmReceiptSerializer = (
  payload: ConfirmReceiptResponse,
): ConfirmReceiptResult | null => {
  if (!payload || payload.success === false) return null;
  return payload.data ?? null;
};

export const reportIssueSerializer = (
  payload: ReportIssueResponse,
): ReportIssueResult | null => {
  if (!payload || payload.success === false) return null;
  return payload.data ?? null;
};
