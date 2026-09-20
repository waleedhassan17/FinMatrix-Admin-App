// ═══════════════════════════════════════════════════════
// FinMatrix — Super Admin Model
// ═══════════════════════════════════════════════════════
// Plain entity interfaces for the platform control panel
// (moved verbatim from superAdminSlice — Consultant_Mobile convention:
// models hold the shapes, slices hold the state).

export interface PlatformStats {
  companies: {
    total: number;
    pending: number;
    active: number;
    suspended: number;
    rejected: number;
    recentWeek: number;
  };
  subscriptions: {
    totalPlans: number;
    totalSubscriptions: number;
    activeSubscriptions: number;
  };
  recentRegistrations: {
    id: string;
    name: string;
    industry: string | null;
    email: string | null;
    status: string;
    createdAt: string;
  }[];
}

export interface CompanyListItem {
  id: string;
  name: string;
  industry: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  rejectionReason: string | null;
  memberCount: number;
  planName: string | null;
  createdAt: string;
  reviewedAt: string | null;
  // The server has always sent these three and neither console modelled them,
  // so a company on a free trial looked identical to a paying one.
  isTrial: boolean;
  trialStartedAt: string | null;
  trialConvertedAt: string | null;
}

export type CompanyType = 'small_business' | 'large_org' | 'warehouse';

/** A member row on the company detail payload. */
export interface CompanyMember {
  id: string;
  email: string | null;
  displayName: string | null;
  role: string;
  joinedAt: string | null;
}

/**
 * GET /super-admin/companies/:id — the company ENTITY plus a status and two
 * joined collections. It carries no memberCount and no planName; those exist
 * only on the list row.
 */
export interface CompanyDetail {
  id: string;
  name: string;
  industry: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  inviteCode: string | null;
  companyType: CompanyType | null;
  inventoryEnabled: boolean | null;
  allFeaturesUnlocked: boolean | null;
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  subscriptionExpiryDate: string | null;
  isTrial: boolean;
  trialStartedAt: string | null;
  trialConvertedAt: string | null;
  members: CompanyMember[];
  subscriptions: CompanySubscription[];
}

/**
 * PATCH /super-admin/companies/:id/feature-override. Every field is optional —
 * the server applies only what it is sent. allFeaturesUnlocked is a kill
 * switch: it bypasses the feature guard before any plan logic runs.
 */
export interface FeatureOverrideInput {
  allFeaturesUnlocked?: boolean;
  companyType?: CompanyType;
  inventoryEnabled?: boolean;
}

export interface FeatureOverrideResult {
  id: string;
  name: string;
  companyType: CompanyType | null;
  inventoryEnabled: boolean | null;
  allFeaturesUnlocked: boolean | null;
}

/** POST /admin/payment-submissions/run-expiry-scan. */
export interface ExpiryScanResult {
  remindersSent: number;
  expiringMarked: number;
  deactivated: number;
  scanned: number;
}

/** What the console may change on a plan. Amounts in MINOR UNITS (paisa). */
export interface UpdatePlanInput {
  label?: string;
  monthlyMinorUnits?: number;
  priceMinorUnits?: number;
  deliveryPersonnelLimit?: number;
  /** false retires the plan: sold to nobody new, unchanged for its members. */
  isOffered?: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  priceMonthly: string;
  priceYearly: string;
  maxUsers: number;
  maxInvoices: number | null;
  features: string[] | null;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
  // Three-tier model (served from the server's PLAN_CONFIG):
  companyType?: 'small_business' | 'large_org' | 'warehouse' | null;
  durationMonths?: number | null;
  monthlyLabel?: string;
  totalLabel?: string;
  currency?: string;
  deliveryPersonnelLimit?: number;
  /** Per-month price in MINOR UNITS — the editable number, not the label. */
  monthlyMinorUnits?: number;
  /** TOTAL charged up front for the period, in minor units. */
  totalMinorUnits?: number;
  /** Still sold to new customers. A retired plan keeps working for its members. */
  isOffered?: boolean;
  /** Whether an admin has changed anything from the configured default. */
  isEdited?: boolean;
  editedFields?: string[];
}

export interface CompanySubscription {
  id: string;
  companyId: string;
  companyName: string;
  companyEmail: string | null;
  planId: string;
  plan: SubscriptionPlan | null;
  status: string;
  startDate: string;
  endDate: string | null;
  notes: string | null;
  createdAt: string;
}
