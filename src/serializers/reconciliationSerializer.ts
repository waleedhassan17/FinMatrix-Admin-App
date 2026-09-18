import type {
  ReconcilableAccount,
  Reconciliation,
  UnreconciledData,
  UnreconciledEntry,
} from '../models/reconciliationModel';

const num = (v: any): number => {
  if (typeof v === 'number') return v;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

// The global envelope wraps handler results at payload.data.
const unwrap = (payload: any) => payload?.data ?? payload;

export const mapAccount = (raw: any): ReconcilableAccount => ({
  accountId: raw.accountId ?? '',
  accountNumber: raw.accountNumber ?? '',
  name: raw.name ?? '',
  subType: raw.subType ?? '',
  bookBalance: num(raw.bookBalance),
  lastReconciledDate: raw.lastReconciledDate ?? null,
  lastReconciledBalance: raw.lastReconciledBalance == null ? null : num(raw.lastReconciledBalance),
});

export const mapEntry = (raw: any): UnreconciledEntry => ({
  id: raw.id ?? '',
  date: raw.date ?? '',
  reference: raw.reference ?? '',
  memo: raw.memo ?? null,
  sourceType: raw.sourceType ?? '',
  debit: num(raw.debit),
  credit: num(raw.credit),
  amount: num(raw.amount),
  cleared: raw.cleared === true,
});

export const mapReconciliation = (raw: any): Reconciliation => ({
  id: raw.id ?? '',
  accountId: raw.accountId ?? '',
  statementDate: raw.statementDate ?? '',
  statementEndingBalance: num(raw.statementEndingBalance),
  beginningBalance: num(raw.beginningBalance),
  clearedBalance: num(raw.clearedBalance),
  difference: num(raw.difference),
  clearedCount: num(raw.clearedCount),
  status: raw.status ?? 'completed',
  notes: raw.notes ?? null,
  reconciledAt: raw.reconciledAt ?? null,
  entries: Array.isArray(raw.entries) ? raw.entries.map(mapEntry) : undefined,
  outstanding: Array.isArray(raw.outstanding) ? raw.outstanding.map(mapEntry) : undefined,
  outstandingTotal: raw.outstandingTotal == null ? undefined : num(raw.outstandingTotal),
});

export function accountsSerializer(payload: any): ReconcilableAccount[] {
  const d = unwrap(payload);
  const arr: any[] = Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : [];
  return arr.map(mapAccount);
}

export function unreconciledSerializer(payload: any): UnreconciledData {
  const d = unwrap(payload);
  return {
    accountId: d?.accountId ?? '',
    accountName: d?.accountName ?? '',
    accountNumber: d?.accountNumber ?? '',
    beginningBalance: num(d?.beginningBalance),
    lastStatementDate: d?.lastStatementDate ?? null,
    lastStatementEndingBalance:
      d?.lastStatementEndingBalance == null ? null : num(d.lastStatementEndingBalance),
    beginningMismatch: d?.beginningMismatch == null ? null : num(d.beginningMismatch),
    entries: Array.isArray(d?.entries) ? d.entries.map(mapEntry) : [],
  };
}

export function reconciliationListSerializer(payload: any): Reconciliation[] {
  const d = unwrap(payload);
  const arr: any[] = Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : [];
  return arr.map(mapReconciliation);
}

export function reconciliationSingleSerializer(payload: any): Reconciliation | null {
  const d = unwrap(payload);
  if (!d || !d.id) return null;
  return mapReconciliation(d);
}
