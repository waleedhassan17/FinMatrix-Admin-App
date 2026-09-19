// ═══════════════════════════════════════════════════════
// FinMatrix — Super Admin Serializer
// ═══════════════════════════════════════════════════════
// Defensive raw→model mapping for /super-admin responses.
// The global envelope nests payloads at res.data; paginated lists nest
// again as { data: [...], pagination: { total } } (see backend
// ResponseEnvelopeInterceptor note in super-admin.service).
//
// "Defensive" used to describe only the paginated reader. Everything else was
// `unwrapEnvelope(res) as T` -- a cast, which checks nothing at runtime. A
// response body of {} satisfies the dashboard's `stats ?` truthiness check and
// then throws on stats.companies.pending, so a malformed payload was a white
// screen rather than a zeroed one.
//
// The coercers below are hand-written on purpose. zod is a web-only dependency
// here, and adding a runtime validator to an RN bundle for a handful of call
// sites is not proportionate -- authSerializer.ts already establishes this
// shape of defence.

import type {
  PlatformStats,
  CompanyListItem,
  CompanyDetail,
  CompanyMember,
  SubscriptionPlan,
  CompanySubscription,
  FeatureOverrideResult,
  CompanyType,
} from '../models/superAdminModel';

const unwrapEnvelope = (res: any): any => res?.data ?? res;

// ─── Coercers ────────────────────────────────────────
const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const str = (v: unknown, fallback = ''): string =>
  typeof v === 'string' ? v : fallback;
const nstr = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const bool = (v: unknown, fallback = false): boolean =>
  typeof v === 'boolean' ? v : fallback;
const nbool = (v: unknown): boolean | null =>
  typeof v === 'boolean' ? v : null;
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

const COMPANY_TYPES: CompanyType[] = ['small_business', 'large_org', 'warehouse'];
const companyType = (v: unknown): CompanyType | null =>
  COMPANY_TYPES.includes(v as CompanyType) ? (v as CompanyType) : null;

export interface PaginatedList<T> {
  data: T[];
  total: number;
  page: number;
  pages: number;
}

const paginatedListSerializer = <T>(
  res: any,
  mapRow: (row: unknown) => T,
): PaginatedList<T> => {
  const envelope = obj(unwrapEnvelope(res));
  const rows = arr<unknown>(envelope.data).map(mapRow);
  const pagination = obj(envelope.pagination);
  const total = num(pagination.total, rows.length);
  const limit = num(pagination.limit, 20) || 20;
  return {
    data: rows,
    total,
    page: num(pagination.page, 1),
    // `pages`, not `totalPages` -- the admin endpoints use the short spelling
    // while the rest of the API uses the long one.
    pages: num(pagination.pages, Math.max(1, Math.ceil(total / limit))),
  };
};

// ─── Companies ───────────────────────────────────────
/**
 * A row coercer, not a cast. CompanyCard renders `company.name.slice(0, 2)`
 * and keyExtractor returns `item.id`, so a row missing either throws or makes
 * FlatList recycle rows against an undefined key.
 */
export const companyRowSerializer = (raw: unknown): CompanyListItem => {
  const c = obj(raw);
  return {
    id: str(c.id),
    name: str(c.name, 'Unnamed company'),
    industry: nstr(c.industry),
    email: nstr(c.email),
    phone: nstr(c.phone),
    status: str(c.status, 'pending'),
    rejectionReason: nstr(c.rejectionReason),
    memberCount: num(c.memberCount),
    planName: nstr(c.planName),
    createdAt: str(c.createdAt),
    reviewedAt: nstr(c.reviewedAt),
    isTrial: bool(c.isTrial),
    trialStartedAt: nstr(c.trialStartedAt),
    trialConvertedAt: nstr(c.trialConvertedAt),
  };
};

export const companyListResponseSerializer = (
  res: any,
): PaginatedList<CompanyListItem> =>
  paginatedListSerializer<CompanyListItem>(res, companyRowSerializer);

const companyMemberSerializer = (raw: unknown): CompanyMember => {
  const m = obj(raw);
  return {
    id: str(m.id),
    email: nstr(m.email),
    displayName: nstr(m.displayName),
    role: str(m.role, 'staff'),
    joinedAt: nstr(m.joinedAt),
  };
};

export const companyDetailResponseSerializer = (res: any): CompanyDetail => {
  const c = obj(unwrapEnvelope(res));
  return {
    id: str(c.id),
    name: str(c.name, 'Unnamed company'),
    industry: nstr(c.industry),
    email: nstr(c.email),
    phone: nstr(c.phone),
    status: str(c.status, 'pending'),
    rejectionReason: nstr(c.rejectionReason),
    createdAt: str(c.createdAt),
    reviewedAt: nstr(c.reviewedAt),
    inviteCode: nstr(c.inviteCode),
    companyType: companyType(c.companyType),
    inventoryEnabled: nbool(c.inventoryEnabled),
    allFeaturesUnlocked: nbool(c.allFeaturesUnlocked),
    subscriptionPlan: nstr(c.subscriptionPlan),
    subscriptionStatus: nstr(c.subscriptionStatus),
    subscriptionExpiryDate: nstr(c.subscriptionExpiryDate),
    isTrial: bool(c.isTrial),
    trialStartedAt: nstr(c.trialStartedAt),
    trialConvertedAt: nstr(c.trialConvertedAt),
    members: arr<unknown>(c.members).map(companyMemberSerializer),
    subscriptions: arr<unknown>(c.subscriptions).map(subscriptionRowSerializer),
  };
};

/**
 * The status result is indexed back into state.companies by id. An empty body
 * used to produce `undefined`, findIndex returned -1, and the row silently
 * never updated -- which reads as the approve button having done nothing.
 */
export const companyStatusResponseSerializer = (
  res: any,
): { id: string; name: string; status: string; rejectionReason: string | null } => {
  const c = obj(unwrapEnvelope(res));
  return {
    id: str(c.id),
    name: str(c.name),
    status: str(c.status, 'pending'),
    rejectionReason: nstr(c.rejectionReason),
  };
};

export const featureOverrideResponseSerializer = (
  res: any,
): FeatureOverrideResult => {
  const c = obj(unwrapEnvelope(res));
  return {
    id: str(c.id),
    name: str(c.name),
    companyType: companyType(c.companyType),
    inventoryEnabled: nbool(c.inventoryEnabled),
    allFeaturesUnlocked: nbool(c.allFeaturesUnlocked),
  };
};

// ─── Platform stats ──────────────────────────────────
/**
 * The deepest object in the console and the only one dereferenced without
 * optional chaining (SuperAdminDashboardScreen reads stats.companies.pending
 * directly), so this is the one whose failure mode was a white screen.
 *
 * The server sends BOTH `suspended` and `inactive` for the same bucket; the
 * model calls it suspended, so `inactive` is read as a fallback.
 */
export const platformStatsResponseSerializer = (res: any): PlatformStats => {
  const root = obj(unwrapEnvelope(res));
  const c = obj(root.companies);
  const s = obj(root.subscriptions);
  return {
    companies: {
      total: num(c.total),
      pending: num(c.pending),
      active: num(c.active),
      suspended: num(c.suspended, num(c.inactive)),
      rejected: num(c.rejected),
      recentWeek: num(c.recentWeek),
    },
    subscriptions: {
      totalPlans: num(s.totalPlans),
      totalSubscriptions: num(s.totalSubscriptions),
      activeSubscriptions: num(s.activeSubscriptions),
    },
    recentRegistrations: arr<unknown>(root.recentRegistrations).map((raw) => {
      const r = obj(raw);
      return {
        id: str(r.id),
        name: str(r.name, 'Unnamed company'),
        industry: nstr(r.industry),
        email: nstr(r.email),
        status: str(r.status, 'pending'),
        createdAt: str(r.createdAt),
      };
    }),
  };
};

// ─── Plans ───────────────────────────────────────────
/**
 * Number(priceMonthly) on a malformed row renders "Rs NaN", so the numeric
 * fields are coerced rather than trusted.
 */
export const planRowSerializer = (raw: unknown): SubscriptionPlan => {
  const p = obj(raw);
  return {
    id: str(p.id),
    name: str(p.name, 'Unnamed plan'),
    description: nstr(p.description),
    priceMonthly: str(p.priceMonthly, '0'),
    priceYearly: str(p.priceYearly, '0'),
    maxUsers: num(p.maxUsers),
    maxInvoices: typeof p.maxInvoices === 'number' ? p.maxInvoices : null,
    features: Array.isArray(p.features) ? (p.features as string[]) : null,
    isActive: bool(p.isActive, true),
    sortOrder: num(p.sortOrder),
    companyType: companyType(p.companyType),
    durationMonths:
      typeof p.durationMonths === 'number' ? p.durationMonths : null,
    monthlyLabel: str(p.monthlyLabel),
    totalLabel: str(p.totalLabel),
    currency: str(p.currency, 'PKR'),
    deliveryPersonnelLimit: num(p.deliveryPersonnelLimit),
  } as SubscriptionPlan;
};

export const planListResponseSerializer = (res: any): SubscriptionPlan[] =>
  arr<unknown>(unwrapEnvelope(res)).map(planRowSerializer);

/**
 * Only reachable through the create/update plan thunks, which the server
 * refuses with PLANS_CONFIG_DEFINED. Kept until that whole chain is removed;
 * it has to outlive its callers, not predecease them.
 */
export const planResponseSerializer = (res: any): SubscriptionPlan =>
  planRowSerializer(unwrapEnvelope(res));

// ─── Subscriptions ───────────────────────────────────
export function subscriptionRowSerializer(raw: unknown): CompanySubscription {
  const s = obj(raw);
  return {
    id: str(s.id),
    companyId: str(s.companyId),
    planId: str(s.planId),
    status: str(s.status, 'active'),
    startDate: nstr(s.startDate),
    endDate: nstr(s.endDate),
    notes: nstr(s.notes),
    companyName: nstr(s.companyName) ?? undefined,
    companyEmail: nstr(s.companyEmail) ?? undefined,
    plan: s.plan ? planRowSerializer(s.plan) : null,
  } as CompanySubscription;
}

export const subscriptionListResponseSerializer = (
  res: any,
): PaginatedList<CompanySubscription> =>
  paginatedListSerializer<CompanySubscription>(res, subscriptionRowSerializer);

export const subscriptionResponseSerializer = (
  res: any,
): CompanySubscription => subscriptionRowSerializer(unwrapEnvelope(res));
