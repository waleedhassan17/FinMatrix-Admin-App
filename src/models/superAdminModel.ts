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
