// ═══════════════════════════════════════════════════════
// FinMatrix — Journal Entry (General Journal) Model + UI types
// ═══════════════════════════════════════════════════════

export type JournalEntryStatus = 'draft' | 'posted' | 'void';

export interface JournalEntryLine {
  id?: string;
  accountId: string;
  accountNumber: string;
  accountName: string;
  description: string | null;
  debit: number;
  credit: number;
  lineOrder: number;
}

export interface JournalEntry {
  id: string;
  reference: string;
  date: string;
  memo: string | null;
  status: JournalEntryStatus;
  totalDebits: number;
  totalCredits: number;
  reversalOfId: string | null;
  voidReason: string | null;
  postedAt: string | null;
  createdAt: string;
  lines: JournalEntryLine[];
}
