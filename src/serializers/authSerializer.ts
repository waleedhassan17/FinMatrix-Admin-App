// ═══════════════════════════════════════════════════════
// FinMatrix — Auth Serializer
// ═══════════════════════════════════════════════════════
// Defensive backend→app mapping for the session user (Consultant_Mobile
// serializer convention). Extracted verbatim from authNetwork's mapUser —
// every auth response (signin, signup, /auth/me) funnels through this.

import type { SubscriptionSummary, User } from '../types';

/** Normalise the server's subscription summary; null when absent or malformed. */
export const subscriptionSummarySerializer = (raw: any): SubscriptionSummary | null => {
  if (!raw || typeof raw !== 'object') return null;
  const iso = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
  return {
    plan: typeof raw.plan === 'string' ? raw.plan : '',
    planLabel: typeof raw.planLabel === 'string' ? raw.planLabel : '',
    expiryDate: iso(raw.expiryDate),
    paymentStatus: typeof raw.paymentStatus === 'string' ? raw.paymentStatus : 'none',
    isTrial: raw.isTrial === true,
    trialStartedAt: iso(raw.trialStartedAt),
    trialConvertedAt: iso(raw.trialConvertedAt),
  };
};

export const userResponseSerializer = (
  backendUser: any,
  companyStatus?: string | null,
  tier?: {
    companyType?: string | null;
    features?: Record<string, boolean> | null;
    subscription?: unknown;
  },
): User => ({
  uid: backendUser.id,
  email: backendUser.email,
  displayName: backendUser.displayName,
  role: backendUser.role,
  companyId: backendUser.companyId || backendUser.defaultCompanyId || null,
  phoneNumber: backendUser.phone || '',
  photoURL: backendUser.photoURL || null,
  username: backendUser.username,
  isActive: true,
  isEmailVerified: backendUser.isEmailVerified ?? true,
  companyStatus: companyStatus ?? null,
  companyType: tier?.companyType ?? null,
  features: tier?.features ?? null,
  subscription: subscriptionSummarySerializer(tier?.subscription),
  createdAt: backendUser.createdAt || new Date().toISOString(),
  updatedAt: backendUser.updatedAt || new Date().toISOString(),
});
