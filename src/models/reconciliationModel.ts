// ═══════════════════════════════════════════════════════
// FinMatrix — Bank Reconciliation model + UI types (FinMatrix.md §27)
// ═══════════════════════════════════════════════════════

export interface ReconcilableAccount {
  accountId: string;
  accountNumber: string;
  name: string;
  subType: string;
  bookBalance: number;
  lastReconciledDate: string | null;
  lastReconciledBalance: number | null;
}

export interface UnreconciledEntry {
  id: string;
  date: string;
  reference: string;
  memo: string | null;
  sourceType: string;
  debit: number;
  credit: number;
  // Signed amount for the account (debit-normal): + deposit, − payment.
  amount: number;
  /** Save-and-resume: in-progress tick persisted on the GL row server-side. */
  cleared: boolean;
}

export interface UnreconciledData {
  accountId: string;
  accountName: string;
  accountNumber: string;
  beginningBalance: number;
  lastStatementDate: string | null;
  lastStatementEndingBalance: number | null;
  /** Non-null = WARN: beginning balance is off by this amount vs the last reconciliation. */
  beginningMismatch: number | null;
  entries: UnreconciledEntry[];
}

export interface Reconciliation {
  id: string;
  accountId: string;
  statementDate: string;
  statementEndingBalance: number;
  beginningBalance: number;
  clearedBalance: number;
  difference: number;
  clearedCount: number;
  status: string;
  notes: string | null;
  reconciledAt: string | null;
  entries?: UnreconciledEntry[];
  /** Report: uncleared book items as of the statement date (timing differences). */
  outstanding?: UnreconciledEntry[];
  outstandingTotal?: number;
}
