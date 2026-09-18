// ═══════════════════════════════════════════════════════
// FinMatrix — Free trial helpers
// ═══════════════════════════════════════════════════════
// Pure functions shared by the trial banner, the pending screen and the renew
// screen, so "is this company trialing?" and "how many days are left?" are
// answered the same way everywhere — and the same way the server answers them
// (billing.service daysBetween rounds UP, so the last partial day shows as 1).

import type { SubscriptionSummary } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days until `expiryDate`, rounded up; 0 once it has passed; null if unknown. */
export const daysUntil = (
  expiryDate: string | null | undefined,
  now: Date = new Date(),
): number | null => {
  if (!expiryDate) return null;
  const t = new Date(expiryDate).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.ceil((t - now.getTime()) / DAY_MS));
};

/**
 * Days left in a RUNNING trial — approved, never converted to paid, not yet
 * expired. null in every other state (pending request, paid, lapsed), which is
 * exactly when no countdown should be shown.
 */
export const trialDaysLeft = (
  subscription: SubscriptionSummary | null | undefined,
  now: Date = new Date(),
): number | null => {
  if (!subscription?.isTrial || subscription.trialConvertedAt) return null;
  const days = daysUntil(subscription.expiryDate, now);
  return days !== null && days > 0 ? days : null;
};

/** The trial ran out and nothing was bought — the renew screen's trial wording. */
export const isLapsedTrial = (
  status: { isTrial?: boolean; trialConvertedAt?: string | null } | null | undefined,
): boolean => !!status?.isTrial && !status.trialConvertedAt;

/** "1 day" / "12 days". */
export const pluralDays = (n: number): string => `${n} day${n === 1 ? '' : 's'}`;

/** Hours a request has waited, as a short label: "35 min", "3 h", "1 d 4 h". */
export const waitingLabel = (hours: number): string => {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 24) return `${Math.floor(hours)} h`;
  const d = Math.floor(hours / 24);
  const h = Math.floor(hours - d * 24);
  return h ? `${d} d ${h} h` : `${d} d`;
};

/** Owners are told a trial is activated within 24 hours — flag it before then. */
export const TRIAL_REVIEW_WARN_HOURS = 20;
