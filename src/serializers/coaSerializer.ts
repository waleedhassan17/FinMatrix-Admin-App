// ═══════════════════════════════════════════════════════
// FinMatrix — Chart of Accounts Serializer
// ═══════════════════════════════════════════════════════
// Sits BETWEEN network and slice.
// Takes the raw API response and returns a clean,
// UI-ready data structure with inline field mapping.

import type { COAApiAccount } from '../models/coaModel';

// ─── Serialized output for the slice ─────────────────

export interface SerializedCOAListData {
  accounts: COAApiAccount[];
}

export interface SerializedCOASingleData {
  account: COAApiAccount;
}

// ─── Helpers ─────────────────────────────────────────

function serializeAccount(raw: any): COAApiAccount {
  // Backend sends `accountNumber` and numeric strings for balances.
  const balance = typeof raw.balance === 'number' ? raw.balance : parseFloat(raw.balance);
  return {
    id: raw.id || '',
    companyId: raw.companyId || '',
    code: raw.code || raw.accountNumber || '',
    name: raw.name || '',
    type: raw.type || 'asset',
    subType: raw.subType || 'current_asset',
    description: raw.description || '',
    parentId: raw.parentId ?? null,
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : true,
    isSystemAccount: typeof raw.isSystemAccount === 'boolean' ? raw.isSystemAccount : false,
    balance: isNaN(balance) ? 0 : balance,
    normalBalance: raw.normalBalance === 'credit' ? 'credit' : 'debit',
    createdAt: raw.createdAt || '',
    updatedAt: raw.updatedAt || '',
  };
}

// ─── List Serializer ─────────────────────────────────

export function coaListSerializer(payload: any): SerializedCOAListData {
  const data = payload?.data || {};
  const rawAccounts = data.accounts || [];

  const accounts: COAApiAccount[] = rawAccounts.map((raw: any) => serializeAccount(raw));

  return { accounts };
}

// ─── Single Account Serializer ───────────────────────

export function coaSingleSerializer(payload: any): SerializedCOASingleData {
  const data = payload?.data || {};
  const rawAccount = data.account || {};

  return { account: serializeAccount(rawAccount) };
}
