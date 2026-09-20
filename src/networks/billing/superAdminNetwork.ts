// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Super Admin Network (Production)
// ═══════════════════════════════════════════════════════
// Everything under /super-admin. Two tenant-facing functions that used to live
// here are gone: getPublicPlansAPI (the plan chooser shown during signup) and
// selfSubscribeAPI, which posted to /companies/subscribe and was never a
// super-admin endpoint at all. Both belong to the tenant app's
// SubscriptionSelect screen — and are the reason this module cannot simply be
// deleted from FinMatrix when the console screens are removed there.

import { api, extractErrorMessage } from '../network/apiHelpers';
import type { FeatureOverrideInput } from '../../models/superAdminModel';

export const getSuperAdminStatsAPI = async (): Promise<any> => {
  try {
    const res = await api.get('/super-admin/stats');
    return res.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const getAllCompaniesAPI = async (
  page = 1,
  limit = 20,
  status?: string,
  isTrial?: boolean,
): Promise<any> => {
  try {
    const res = await api.get('/super-admin/companies', {
      params: {
        page,
        limit,
        ...(status ? { status } : {}),
        // Only sent when filtering. The server ignores anything that is not
        // 'true'/'false', and page/limit go through a ParseIntPipe that 400s
        // on an empty string -- so undefined is omitted, never serialised.
        ...(isTrial === undefined ? {} : { isTrial: String(isTrial) }),
      },
    });
    return res.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const getCompanyDetailAPI = async (id: string): Promise<any> => {
  try {
    const res = await api.get(`/super-admin/companies/${id}`);
    return res.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const updateCompanyStatusAPI = async (
  id: string,
  status: string,
  rejectionReason?: string,
): Promise<any> => {
  try {
    const res = await api.patch(`/super-admin/companies/${id}/status`, {
      status,
      rejectionReason,
    });
    return res.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

/**
 * The feature kill switch.
 *
 * allFeaturesUnlocked bypasses the server's FeatureGuard before any plan or
 * company-type logic runs, so a company carrying it sees everything regardless
 * of what it pays for. Callers confirm first and describe it by effect, not by
 * field name.
 */
export const updateFeatureOverrideAPI = async (
  id: string,
  input: FeatureOverrideInput,
): Promise<any> => {
  try {
    const res = await api.patch(
      `/super-admin/companies/${id}/feature-override`,
      input,
    );
    return res.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const getSubscriptionPlansAPI = async (): Promise<any> => {
  try {
    const res = await api.get('/super-admin/plans');
    return res.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

/**
 * Edit one plan.
 *
 * `key` is the plan key the catalogue returns as `id`
 * ('warehouse_starter_6mo'), not a UUID. Only what is passed is changed, and
 * amounts are in MINOR UNITS -- the conversion from rupees happens in the
 * screen, once, so a decimal never reaches the wire.
 *
 * This changes what NEW customers are quoted and charged. Nobody already on
 * the plan is re-billed.
 */
export const updatePlanAPI = async (
  key: string,
  input: {
    label?: string;
    monthlyMinorUnits?: number;
    priceMinorUnits?: number;
    deliveryPersonnelLimit?: number;
    isOffered?: boolean;
  },
): Promise<any> => {
  try {
    const res = await api.patch(
      `/super-admin/plans/${encodeURIComponent(key)}`,
      input,
    );
    return res.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

/** Put a plan back to exactly what the server configuration declares. */
export const resetPlanAPI = async (key: string): Promise<any> => {
  try {
    const res = await api.delete(
      `/super-admin/plans/${encodeURIComponent(key)}`,
    );
    return res.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const createSubscriptionPlanAPI = async (data: {
  name: string;
  description?: string;
  priceMonthly: number;
  priceYearly: number;
  maxUsers: number;
  maxInvoices?: number;
  features?: string[];
}): Promise<any> => {
  try {
    const res = await api.post('/super-admin/plans', data);
    return res.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const updateSubscriptionPlanAPI = async (
  id: string,
  data: Partial<{
    name: string;
    description: string;
    priceMonthly: number;
    priceYearly: number;
    maxUsers: number;
    maxInvoices: number;
    features: string[];
    isActive: boolean;
  }>,
): Promise<any> => {
  try {
    const res = await api.patch(`/super-admin/plans/${id}`, data);
    return res.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const deleteSubscriptionPlanAPI = async (id: string): Promise<any> => {
  try {
    const res = await api.delete(`/super-admin/plans/${id}`);
    return res.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const getAllSubscriptionsAPI = async (page = 1, limit = 20): Promise<any> => {
  try {
    const res = await api.get('/super-admin/subscriptions', { params: { page, limit } });
    return res.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const assignSubscriptionAPI = async (data: {
  companyId: string;
  planId: string;
  startDate: string;
  endDate?: string;
  notes?: string;
}): Promise<any> => {
  try {
    const res = await api.post('/super-admin/subscriptions', data);
    return res.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};
