// ═══════════════════════════════════════════════════════
// FinMatrix — Journal Entry Serializer
// Sits between network and slice; maps raw API → UI-ready shape.
// ═══════════════════════════════════════════════════════

import type {
  JournalEntry,
  JournalEntryLine,
  JournalEntryStatus,
} from '../models/journalEntryModel';

const toNum = (v: any): number => {
  if (typeof v === 'number') return v;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

const mapLine = (raw: any): JournalEntryLine => ({
  id: raw.id,
  accountId: raw.accountId ?? '',
  accountNumber: raw.accountNumber ?? '',
  accountName: raw.accountName ?? '',
  description: raw.description ?? null,
  debit: toNum(raw.debit),
  credit: toNum(raw.credit),
  lineOrder: typeof raw.lineOrder === 'number' ? raw.lineOrder : 0,
});

export const mapJournalEntry = (raw: any): JournalEntry => ({
  id: raw.id ?? '',
  reference: raw.reference ?? '',
  date: raw.date ?? '',
  memo: raw.memo ?? null,
  status: (raw.status ?? 'draft') as JournalEntryStatus,
  totalDebits: toNum(raw.totalDebits),
  totalCredits: toNum(raw.totalCredits),
  reversalOfId: raw.reversalOfId ?? null,
  voidReason: raw.voidReason ?? null,
  postedAt: raw.postedAt ?? null,
  createdAt: raw.createdAt ?? '',
  lines: Array.isArray(raw.lines) ? raw.lines.map(mapLine) : [],
});

export const journalEntryListSerializer = (payload: any): JournalEntry[] => {
  const data = payload?.data ?? payload;
  const arr = Array.isArray(data) ? data : data?.entries ?? [];
  return Array.isArray(arr) ? arr.map(mapJournalEntry) : [];
};

export const journalEntrySingleSerializer = (payload: any): JournalEntry | null => {
  const raw = payload?.data ?? payload;
  if (!raw || Array.isArray(raw) || !raw.id) return null;
  return mapJournalEntry(raw);
};
