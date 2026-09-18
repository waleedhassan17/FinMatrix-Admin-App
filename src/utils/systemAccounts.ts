// ═══════════════════════════════════════════════════════
// FinMatrix — system account guard (client side)
// ═══════════════════════════════════════════════════════
// A system account is one the ledger posts to by itself: 1000 Cash, 1100 A/R,
// 1200 Inventory, 2000 A/P, 4000 Sales, 5000 COGS and friends. Deactivating one
// does not "hide it from new entries" — it makes every automatic posting that
// targets it throw, and because those postings run inside a transaction the
// whole operation rolls back. Deactivating 1000 is what stopped delivery
// approvals with "Account 1000 is not active".
//
// The backend refuses this (SYSTEM_ACCOUNT_REQUIRED), but a control that only
// fails after you tap it is still a trap. Check here so the option is never
// offered, and say why in the same words the server would.

import { Alert } from './alert';

export const isSystemAccount = (account: { isSystemAccount?: boolean }): boolean =>
  account.isSystemAccount === true;

/**
 * Returns true when deactivation was blocked (and the user has been told why),
 * false when the caller should go ahead.
 */
export const blockSystemDeactivation = (account: {
  isActive: boolean;
  isSystemAccount?: boolean;
  name: string;
  code?: string;
  accountNumber?: string;
}): boolean => {
  // Reactivating is always safe — only switching one OFF breaks postings.
  if (!account.isActive || !isSystemAccount(account)) return false;

  const label = `${account.code ?? account.accountNumber ?? ''} ${account.name}`.trim();
  Alert.alert(
    'This account cannot be deactivated',
    `${label} is a system account. Invoices, payments, bills, tax and payroll post to it ` +
      'automatically, so switching it off would make those entries fail.\n\n' +
      'If you no longer want to use it, rename it or stop selecting it manually — its ' +
      'history stays either way.',
    [{ text: 'OK' }],
  );
  return true;
};
