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
): Promise<any> => {
  try {
    const res = await api.get('/super-admin/companies', {
      params: { page, limit, ...(status ? { status } : {}) },
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

export const getSubscriptionPlansAPI = async (): Promise<any> => {
  try {
    const res = await api.get('/super-admin/plans');
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
