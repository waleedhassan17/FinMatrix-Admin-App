// ═══════════════════════════════════════════════════════
// FinMatrix Admin — superAdmin slice
// ═══════════════════════════════════════════════════════
// Two behaviours here shipped broken, and both were invisible from the screen:
//
//   1. updateCompanyStatusLocal had no `rejected` handler at all, so a failed
//      approve left no error anywhere in the store. CompanyManagementScreen
//      then announced "Approved" because it awaited the dispatch without
//      .unwrap(), and a rejected thunk still resolves.
//
//   2. The `fulfilled` handler recounted stats.companies from state.companies
//      -- the page currently loaded. Approving one company on page 1 of a
//      500-company platform rewrote the dashboard's pending total as however
//      many pending rows happened to be on screen.

// The slice imports its network module, which reaches axios and expo's ESM
// `env` virtual module -- neither is transformed for jest, and none of it is
// under test here. Reducers are pure; only the thunk action types matter.
jest.mock('../../../networks/billing/superAdminNetwork', () => ({
  getSuperAdminStatsAPI: jest.fn(),
  getAllCompaniesAPI: jest.fn(),
  getCompanyDetailAPI: jest.fn(),
  updateCompanyStatusAPI: jest.fn(),
  getSubscriptionPlansAPI: jest.fn(),
  createSubscriptionPlanAPI: jest.fn(),
  updateSubscriptionPlanAPI: jest.fn(),
  deleteSubscriptionPlanAPI: jest.fn(),
  getAllSubscriptionsAPI: jest.fn(),
  assignSubscriptionAPI: jest.fn(),
}));

import {
  superAdminSlice,
  updateCompanyStatusLocal,
  type SuperAdminState,
} from '../superAdminSlice';

const reducer = superAdminSlice.reducer;

type Stats = NonNullable<SuperAdminState['stats']>;

const stats = (over: Partial<Stats> = {}): Stats => ({
  companies: {
    total: 500,
    pending: 40,
    active: 300,
    suspended: 10,
    rejected: 5,
    recentWeek: 12,
  },
  subscriptions: { totalPlans: 6, totalSubscriptions: 300, activeSubscriptions: 280 },
  recentRegistrations: [],
  ...over,
});

const company = (id: string, status: string) => ({
  id,
  name: `Company ${id}`,
  status,
  rejectionReason: null,
}) as SuperAdminState['companies'][number];

const baseState = (): SuperAdminState =>
  reducer(undefined, { type: '@@INIT' });

describe('updateCompanyStatusLocal', () => {
  it('records an error when the request fails', () => {
    const state = reducer(
      { ...baseState(), actionStatus: 'loading' },
      {
        type: updateCompanyStatusLocal.rejected.type,
        error: { message: 'Super admin access required' },
      },
    );

    expect(state.actionStatus).toBe('failed');
    expect(state.actionError).toBe('Super admin access required');
  });

  it('falls back to a readable message when the error carries none', () => {
    const state = reducer(baseState(), {
      type: updateCompanyStatusLocal.rejected.type,
      error: {},
    });

    expect(state.actionStatus).toBe('failed');
    expect(state.actionError).not.toBe('');
  });

  it('marks the action in flight while pending', () => {
    const state = reducer(
      { ...baseState(), actionStatus: 'failed', actionError: 'stale' },
      { type: updateCompanyStatusLocal.pending.type },
    );

    expect(state.actionStatus).toBe('loading');
    expect(state.actionError).toBe('');
  });

  it('moves the stat buckets by one, not by the loaded page size', () => {
    // One pending company on screen, forty pending across the platform.
    const start: SuperAdminState = {
      ...baseState(),
      stats: stats(),
      companies: [company('a', 'pending')],
    };

    const state = reducer(start, {
      type: updateCompanyStatusLocal.fulfilled.type,
      payload: { id: 'a', status: 'active', rejectionReason: null },
    });

    // The bug recounted from `companies` and wrote pending: 0, active: 1.
    expect(state.stats?.companies.pending).toBe(39);
    expect(state.stats?.companies.active).toBe(301);
    expect(state.companies[0].status).toBe('active');
    expect(state.actionStatus).toBe('idle');
  });

  it('never drives a bucket below zero', () => {
    const start: SuperAdminState = {
      ...baseState(),
      stats: stats({ companies: { ...stats().companies, pending: 0 } }),
      companies: [company('a', 'pending')],
    };

    const state = reducer(start, {
      type: updateCompanyStatusLocal.fulfilled.type,
      payload: { id: 'a', status: 'active', rejectionReason: null },
    });

    expect(state.stats?.companies.pending).toBe(0);
  });

  it('leaves the counts alone when the status did not change', () => {
    const start: SuperAdminState = {
      ...baseState(),
      stats: stats(),
      companies: [company('a', 'active')],
    };

    const state = reducer(start, {
      type: updateCompanyStatusLocal.fulfilled.type,
      payload: { id: 'a', status: 'active', rejectionReason: null },
    });

    expect(state.stats?.companies.active).toBe(300);
  });
});
