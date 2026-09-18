// ═══════════════════════════════════════════════════════
// FinMatrix — Super Admin Serializer
// ═══════════════════════════════════════════════════════
// Defensive raw→model mapping for /super-admin responses.
// The global envelope nests payloads at res.data; paginated lists nest
// again as { data: [...], pagination: { total } } (see backend
// ResponseEnvelopeInterceptor note in super-admin.service). Extracted
// verbatim from superAdminSlice's inline parsing.

import type {
  PlatformStats,
  CompanyListItem,
  SubscriptionPlan,
  CompanySubscription,
} from '../models/superAdminModel';

const unwrapEnvelope = (res: any): any => res?.data ?? res;

export interface PaginatedList<T> {
  data: T[];
  total: number;
}

const paginatedListSerializer = <T>(res: any): PaginatedList<T> => {
  const envelope = unwrapEnvelope(res);
  return {
    data: (envelope?.data ?? []) as T[],
    total: (envelope?.pagination?.total ?? 0) as number,
  };
};

export const platformStatsResponseSerializer = (res: any): PlatformStats =>
  unwrapEnvelope(res) as PlatformStats;

export const companyListResponseSerializer = (
  res: any,
): PaginatedList<CompanyListItem> => paginatedListSerializer<CompanyListItem>(res);

export const companyStatusResponseSerializer = (
  res: any,
): { id: string; status: string; rejectionReason: string | null } =>
  unwrapEnvelope(res);

export const planListResponseSerializer = (res: any): SubscriptionPlan[] => {
  const data = unwrapEnvelope(res);
  return Array.isArray(data) ? (data as SubscriptionPlan[]) : [];
};

export const planResponseSerializer = (res: any): SubscriptionPlan =>
  unwrapEnvelope(res) as SubscriptionPlan;

export const subscriptionListResponseSerializer = (
  res: any,
): PaginatedList<CompanySubscription> =>
  paginatedListSerializer<CompanySubscription>(res);

export const subscriptionResponseSerializer = (res: any): CompanySubscription =>
  unwrapEnvelope(res) as CompanySubscription;
