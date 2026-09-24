// ═══════════════════════════════════════════════════════
// FinMatrix — Super Admin Slice
// ═══════════════════════════════════════════════════════

import { createAppSlice } from '@store/createAppSlice';
import type { PayloadAction } from '@reduxjs/toolkit';
import {
  getSuperAdminStatsAPI,
  getAllCompaniesAPI,
  getSubscriptionPlansAPI,
  createSubscriptionPlanAPI,
  updateSubscriptionPlanAPI,
  deleteSubscriptionPlanAPI,
  updateCompanyStatusAPI,
  getCompanyDetailAPI,
  updateFeatureOverrideAPI,
  assignSubscriptionAPI,
  getAllSubscriptionsAPI,
} from '../../networks/billing/superAdminNetwork';
import type {
  PlatformStats,
  CompanyListItem,
  CompanyDetail,
  FeatureOverrideInput,
  SubscriptionPlan,
  CompanySubscription,
} from '../../models/superAdminModel';
import {
  platformStatsResponseSerializer,
  companyListResponseSerializer,
  companyStatusResponseSerializer,
  planListResponseSerializer,
  planResponseSerializer,
  subscriptionListResponseSerializer,
  subscriptionResponseSerializer,
  companyDetailResponseSerializer,
  featureOverrideResponseSerializer,
} from '../../serializers/superAdminSerializer';

// Entity shapes live in models/superAdminModel.ts; re-exported here so
// existing `import type { … } from './superAdminSlice'` keeps working.
export type {
  PlatformStats,
  CompanyListItem,
  CompanyDetail,
  SubscriptionPlan,
  CompanySubscription,
};

export interface SuperAdminState {
  stats: PlatformStats | null;
  statsStatus: 'idle' | 'loading' | 'failed';
  statsError: string;

  companies: CompanyListItem[];
  companiesTotal: number;
  companiesPage: number;
  companiesStatus: 'idle' | 'loading' | 'failed';
  companiesFilter: string;
  /** undefined = no ?isTrial param at all, which the server reads as "any". */
  companiesTrial: boolean | undefined;
  /** What the Companies search box holds; '' means no search. */
  companiesSearch: string;
  companiesError: string;

  plans: SubscriptionPlan[];
  plansStatus: 'idle' | 'loading' | 'failed';
  plansError: string;

  detail: CompanyDetail | null;
  detailStatus: 'idle' | 'loading' | 'failed';
  detailError: string;

  subscriptions: CompanySubscription[];
  subsTotal: number;
  subsPage: number;
  subsStatus: 'idle' | 'loading' | 'failed';
  subsError: string;

  // One sub-state shared by every MUTATING thunk, rather than a status pair per
  // thunk. Read thunks keep their own (statsStatus, companiesStatus, …) because
  // screens render those as skeletons in different places; a mutation is always
  // "the thing I just pressed", so one pair is enough and every action screen
  // reads the same two selectors.
  actionStatus: 'idle' | 'loading' | 'failed';
  actionError: string;
}

// Shared handlers for the mutating thunks below.
const beginAction = (s: SuperAdminState) => {
  s.actionStatus = 'loading';
  s.actionError = '';
};
const endAction = (s: SuperAdminState) => {
  s.actionStatus = 'idle';
};
const failAction = (s: SuperAdminState, action: { error?: { message?: string } }) => {
  s.actionStatus = 'failed';
  s.actionError = action.error?.message ?? 'That did not work. Please try again.';
};

const initialState: SuperAdminState = {
  stats: null,
  statsStatus: 'idle',
  statsError: '',

  companies: [],
  companiesTotal: 0,
  companiesPage: 1,
  companiesStatus: 'idle',
  companiesFilter: 'all',
  companiesTrial: undefined,
  companiesSearch: '',
  companiesError: '',

  plans: [],
  plansStatus: 'idle',
  plansError: '',

  detail: null,
  detailStatus: 'idle',
  detailError: '',

  subscriptions: [],
  subsTotal: 0,
  subsPage: 1,
  subsStatus: 'idle',
  subsError: '',

  actionStatus: 'idle',
  actionError: '',
};

export const superAdminSlice = createAppSlice({
  name: 'superAdmin',
  initialState,
  reducers: create => ({
    setCompaniesFilter: create.reducer(
      (state, action: PayloadAction<string>) => {
        state.companiesFilter = action.payload;
        state.companiesPage = 1;
        state.companies = [];
      },
    ),

    setCompaniesSearch: create.reducer((state, action: PayloadAction<string>) => {
      state.companiesSearch = action.payload;
      state.companiesPage = 1;
    }),

    setCompaniesTrial: create.reducer(
      (state, action: PayloadAction<boolean | undefined>) => {
        state.companiesTrial = action.payload;
        state.companiesPage = 1;
        state.companies = [];
      },
    ),

    loadPlatformStats: create.asyncThunk(
      async () => {
        const res = await getSuperAdminStatsAPI();
        return platformStatsResponseSerializer(res);
      },
      {
        pending: state => {
          state.statsStatus = 'loading';
          state.statsError = '';
        },
        fulfilled: (state, action) => {
          state.stats = action.payload;
          state.statsStatus = 'idle';
        },
        rejected: (state, action) => {
          state.statsStatus = 'failed';
          state.statsError = (action.error as any)?.message ?? 'Failed to load stats';
        },
      },
    ),

    loadCompanies: create.asyncThunk(
      async (
        args: { page?: number; filter?: string; isTrial?: boolean; search?: string } | undefined,
        { getState },
      ) => {
        const state = (getState() as { superAdmin: SuperAdminState }).superAdmin;
        const page = args?.page ?? state.companiesPage;
        const filter = args?.filter ?? state.companiesFilter;
        const isTrial =
          args && 'isTrial' in args ? args.isTrial : state.companiesTrial;
        const search = args?.search ?? state.companiesSearch;
        const res = await getAllCompaniesAPI(
          page,
          20,
          filter === 'all' ? undefined : filter,
          isTrial,
          search,
        );
        return { ...companyListResponseSerializer(res), page };
      },
      {
        pending: state => {
          state.companiesStatus = 'loading';
          state.companiesError = '';
        },
        fulfilled: (state, action) => {
          if (action.payload.page === 1) {
            state.companies = action.payload.data;
          } else {
            state.companies = [...state.companies, ...action.payload.data];
          }
          state.companiesTotal = action.payload.total;
          state.companiesPage = action.payload.page;
          state.companiesStatus = 'idle';
        },
        rejected: (state, action) => {
          state.companiesStatus = 'failed';
          state.companiesError = (action.error as any)?.message ?? 'Failed to load companies';
        },
      },
    ),

    updateCompanyStatusLocal: create.asyncThunk(
      async (args: { id: string; status: string; rejectionReason?: string }) => {
        const res = await updateCompanyStatusAPI(args.id, args.status, args.rejectionReason);
        return companyStatusResponseSerializer(res);
      },
      {
        pending: beginAction,
        rejected: failAction,
        fulfilled: (state, action) => {
          endAction(state);

          const idx = state.companies.findIndex(c => c.id === action.payload.id);
          if (idx === -1) return;

          const previous = state.companies[idx].status;
          const next = action.payload.status;
          state.companies[idx].status = next;
          state.companies[idx].rejectionReason = action.payload.rejectionReason;

          // Move the counts by a delta rather than recounting state.companies.
          // That array is only the page currently loaded, so on a platform with
          // 500 companies a recount reported the dashboard's pending total as
          // however many happened to be on screen.
          if (!state.stats || previous === next) return;
          const buckets = state.stats.companies;
          const bump = (key: keyof typeof buckets, by: number) => {
            const value = buckets[key];
            if (typeof value === 'number') {
              buckets[key] = Math.max(0, value + by) as typeof value;
            }
          };
          bump(previous as keyof typeof buckets, -1);
          bump(next as keyof typeof buckets, 1);
        },
      },
    ),

    loadCompanyDetail: create.asyncThunk(
      async (id: string) => {
        const res = await getCompanyDetailAPI(id);
        return companyDetailResponseSerializer(res);
      },
      {
        pending: state => {
          state.detailStatus = 'loading';
          state.detailError = '';
        },
        fulfilled: (state, action) => {
          state.detail = action.payload;
          state.detailStatus = 'idle';
        },
        rejected: (state, action) => {
          state.detailStatus = 'failed';
          state.detailError =
            (action.error as any)?.message ?? 'Failed to load this company';
        },
      },
    ),

    setCompanyFeatureOverride: create.asyncThunk(
      async (args: { id: string; input: FeatureOverrideInput }) => {
        const res = await updateFeatureOverrideAPI(args.id, args.input);
        return featureOverrideResponseSerializer(res);
      },
      {
        pending: beginAction,
        rejected: failAction,
        fulfilled: (state, action) => {
          endAction(state);
          // Merge rather than refetch: the payload carries exactly the three
          // fields the server applied.
          if (state.detail && state.detail.id === action.payload.id) {
            state.detail.companyType = action.payload.companyType;
            state.detail.inventoryEnabled = action.payload.inventoryEnabled;
            state.detail.allFeaturesUnlocked = action.payload.allFeaturesUnlocked;
          }
        },
      },
    ),

    loadPlans: create.asyncThunk(
      async () => {
        const res = await getSubscriptionPlansAPI();
        return planListResponseSerializer(res);
      },
      {
        pending: state => {
          state.plansStatus = 'loading';
          state.plansError = '';
        },
        fulfilled: (state, action) => {
          state.plans = Array.isArray(action.payload) ? action.payload : [];
          state.plansStatus = 'idle';
        },
        rejected: (state, action) => {
          state.plansStatus = 'failed';
          state.plansError = (action.error as any)?.message ?? 'Failed to load plans';
        },
      },
    ),

    createPlan: create.asyncThunk(
      async (planData: Parameters<typeof createSubscriptionPlanAPI>[0]) => {
        const res = await createSubscriptionPlanAPI(planData);
        return planResponseSerializer(res);
      },
      {
        fulfilled: (state, action) => {
          state.plans.push(action.payload);
        },
      },
    ),

    updatePlan: create.asyncThunk(
      async (args: { id: string; data: Parameters<typeof updateSubscriptionPlanAPI>[1] }) => {
        const res = await updateSubscriptionPlanAPI(args.id, args.data);
        return planResponseSerializer(res);
      },
      {
        fulfilled: (state, action) => {
          const idx = state.plans.findIndex(p => p.id === action.payload.id);
          if (idx !== -1) state.plans[idx] = action.payload;
        },
      },
    ),

    deletePlan: create.asyncThunk(
      async (planId: string) => {
        await deleteSubscriptionPlanAPI(planId);
        return planId;
      },
      {
        fulfilled: (state, action) => {
          state.plans = state.plans.filter(p => p.id !== action.payload);
        },
      },
    ),

    loadSubscriptions: create.asyncThunk(
      async (args: { page?: number } | undefined) => {
        const page = args?.page ?? 1;
        const res = await getAllSubscriptionsAPI(page, 20);
        return { ...subscriptionListResponseSerializer(res), page };
      },
      {
        pending: state => {
          state.subsStatus = 'loading';
          state.subsError = '';
        },
        fulfilled: (state, action) => {
          state.subscriptions =
            action.payload.page === 1
              ? action.payload.data
              : [...state.subscriptions, ...action.payload.data];
          state.subsTotal = action.payload.total;
          state.subsPage = action.payload.page;
          state.subsStatus = 'idle';
        },
        rejected: (state, action) => {
          state.subsStatus = 'failed';
          state.subsError =
            (action.error as any)?.message ?? 'Failed to load subscriptions';
        },
      },
    ),

    assignPlan: create.asyncThunk(
      async (args: Parameters<typeof assignSubscriptionAPI>[0]) => {
        const res = await assignSubscriptionAPI(args);
        return subscriptionResponseSerializer(res);
      },
      {
        pending: beginAction,
        rejected: failAction,
        fulfilled: (state, action) => {
          endAction(state);
          state.subscriptions.unshift(action.payload);
          state.subsTotal += 1;
        },
      },
    ),
  }),
  selectors: {
    selectPlatformStats: s => s.stats,
    selectStatsStatus: s => s.statsStatus,
    selectStatsError: s => s.statsError,
    selectCompanies: s => s.companies,
    selectCompaniesTotal: s => s.companiesTotal,
    selectCompaniesStatus: s => s.companiesStatus,
    selectCompaniesFilter: s => s.companiesFilter,
    selectCompaniesTrial: s => s.companiesTrial,
    selectCompaniesSearch: s => s.companiesSearch,
    selectCompaniesError: s => s.companiesError,
    selectPlans: s => s.plans,
    selectPlansStatus: s => s.plansStatus,
    // plansError was written on every failed load and had no selector, so the
    // Plans screen could not render a failure even though it had one to show.
    selectPlansError: s => s.plansError,
    selectSubscriptions: s => s.subscriptions,
    selectSubsTotal: s => s.subsTotal,
    selectSubsStatus: s => s.subsStatus,
    selectSubsError: s => s.subsError,
    selectCompanyDetail: s => s.detail,
    selectCompanyDetailStatus: s => s.detailStatus,
    selectCompanyDetailError: s => s.detailError,
    selectActionStatus: s => s.actionStatus,
    selectActionError: s => s.actionError,
  },
});

export const {
  setCompaniesFilter,
  setCompaniesTrial,
  setCompaniesSearch,
  loadPlatformStats,
  loadCompanies,
  updateCompanyStatusLocal,
  loadCompanyDetail,
  setCompanyFeatureOverride,
  loadPlans,
  createPlan,
  updatePlan,
  deletePlan,
  loadSubscriptions,
  assignPlan,
} = superAdminSlice.actions;

export const {
  selectPlatformStats,
  selectStatsStatus,
  selectStatsError,
  selectCompanies,
  selectCompaniesTotal,
  selectCompaniesStatus,
  selectCompaniesFilter,
  selectCompaniesTrial,
  selectCompaniesSearch,
  selectCompaniesError,
  selectPlans,
  selectPlansStatus,
  selectPlansError,
  selectSubscriptions,
  selectSubsTotal,
  selectSubsStatus,
  selectSubsError,
  selectCompanyDetail,
  selectCompanyDetailStatus,
  selectCompanyDetailError,
  selectActionStatus,
  selectActionError,
} = superAdminSlice.selectors;
