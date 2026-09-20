// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Type Definitions
// ═══════════════════════════════════════════════════════
// What the platform console actually reaches for.
//
// This file used to be 835 lines: roughly sixty interfaces describing
// invoices, bills, purchase and sales orders, estimates, credit memos,
// inventory and shadow inventory, deliveries and riders, employees and
// payroll, bank accounts and reconciliation, tax and the chart of accounts --
// the tenant app's whole domain, carried over wholesale when the console was
// split out. A platform operator touches none of it; CompanyGuard closes
// every one of those endpoints to a super admin.
//
// Four types survive, and only four are imported anywhere in src/.

/**
 * `staff` is a company role like `admin`: it comes from the user's membership
 * of the company, not from the platform. `delivery` is the rider portal and
 * `super_admin` the platform console.
 */
export type UserRole = 'admin' | 'staff' | 'delivery' | 'super_admin';

export interface User {
  uid: string;
  email: string;
  username?: string;
  displayName: string;
  role: UserRole;
  companyId: string | null;
  phoneNumber: string;
  photoURL: string | null;
  isActive: boolean;
  /** Stage 1: company-admin email verification status. */
  isEmailVerified?: boolean;
  /** Stage 1: onboarding/approval state of the user's company. */
  companyStatus?: string | null;
  /** Three-tier model: small_business | large_org | warehouse (null = legacy). */
  companyType?: string | null;
  /** Effective feature flags for the company (server-computed, kill switch applied). */
  features?: Record<string, boolean> | null;
  /**
   * Plan + free-trial summary from signin / /auth/me. The trial countdown reads
   * this, so the shell never needs a billing fetch of its own.
   */
  subscription?: SubscriptionSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionSummary {
  plan: string;
  planLabel: string;
  /** ISO timestamp; null for a plan that never expires. */
  expiryDate: string | null;
  paymentStatus: string;
  /** Permanent history: true once a trial has been approved, even after paying. */
  isTrial: boolean;
  trialStartedAt: string | null;
  /** Set when a real payment was approved after the trial. */
  trialConvertedAt: string | null;
}

// The console's unauthenticated stack, and nothing else.
//
// Keep this one honest. Unlike the dead domain interfaces above — which are
// erased at build time and cost nothing — a stale route here is not free: it
// makes navigate('PendingApproval') type-check against a screen that no longer
// exists, turning a compile error into a runtime crash. The console's own tabs
// are typed separately, by SuperAdminTabParamList in navigators/.
export type RootStackParamList = {
  // `role` is optional because the password-reset flow returns the user to
  // sign-in without one. Under React Navigation v7 a navigate() to a
  // non-focused route PUSHES a fresh route rather than reusing the existing
  // one, so its params are exactly what the caller passed — declaring `role`
  // required made those call sites lie and crashed the destructure.
  SignIn: { role?: UserRole } | undefined;
  ForgotPassword: undefined;
};
