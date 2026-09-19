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
  assignSubscriptionAPI,
  getAllSubscriptionsAPI,
} from '../../networks/billing/superAdminNetwork';
import type {
  PlatformStats,
  CompanyListItem,
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
} from '../../serializers/superAdminSerializer';

// Entity shapes live in models/superAdminModel.ts; re-exported here so
// existing `import type { … } from './superAdminSlice'` keeps working.
export type {
  PlatformStats,
  CompanyListItem,
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
  companiesError: string;

  plans: SubscriptionPlan[];
  plansStatus: 'idle' | 'loading' | 'failed';
  plansError: string;

  subscriptions: CompanySubscription[];
  subsTotal: number;
  subsStatus: 'idle' | 'loading' | 'failed';

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
  companiesError: '',

  plans: [],
  plansStatus: 'idle',
  plansError: '',

  subscriptions: [],
  subsTotal: 0,
  subsStatus: 'idle',

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
        args: { page?: number; filter?: string } | undefined,
        { getState },
      ) => {
        const state = (getState() as { superAdmin: SuperAdminState }).superAdmin;
        const page = args?.page ?? state.companiesPage;
        const filter = args?.filter ?? state.companiesFilter;
        const res = await getAllCompaniesAPI(page, 20, filter === 'all' ? undefined : filter);
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
      async () => {
        const res = await getAllSubscriptionsAPI(1, 50);
        return subscriptionListResponseSerializer(res);
      },
      {
        pending: state => { state.subsStatus = 'loading'; },
        fulfilled: (state, action) => {
          state.subscriptions = action.payload.data;
          state.subsTotal = action.payload.total;
          state.subsStatus = 'idle';
        },
        rejected: state => { state.subsStatus = 'failed'; },
      },
    ),

    assignPlan: create.asyncThunk(
      async (args: Parameters<typeof assignSubscriptionAPI>[0]) => {
        const res = await assignSubscriptionAPI(args);
        return subscriptionResponseSerializer(res);
      },
      {
        fulfilled: (state, action) => {
          state.subscriptions.unshift(action.payload);
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
    selectCompaniesError: s => s.companiesError,
    selectPlans: s => s.plans,
    selectPlansStatus: s => s.plansStatus,
    // plansError was written on every failed load and had no selector, so the
    // Plans screen could not render a failure even though it had one to show.
    selectPlansError: s => s.plansError,
    selectSubscriptions: s => s.subscriptions,
    selectSubsStatus: s => s.subsStatus,
    selectActionStatus: s => s.actionStatus,
    selectActionError: s => s.actionError,
  },
});

export const {
  setCompaniesFilter,
  loadPlatformStats,
  loadCompanies,
  updateCompanyStatusLocal,
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
  selectCompaniesError,
  selectPlans,
  selectPlansStatus,
  selectPlansError,
  selectSubscriptions,
  selectSubsStatus,
  selectActionStatus,
  selectActionError,
} = superAdminSlice.selectors;
