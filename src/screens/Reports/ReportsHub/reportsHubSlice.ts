import { createAppSlice } from '@store/createAppSlice';
import { createSelector } from '@reduxjs/toolkit';
import type { ReportHubCategory } from '../../../models/reportModel';
import { isFeatureVisible } from '../../../utils/featureGates';

const initialCategories: ReportHubCategory[] = [
  {
    key: 'financial',
    title: 'Financial',
    icon: 'FIN',
    items: [
      { key: 'pl', title: 'P&L', icon: 'PL', target: 'ProfitLoss' },
      { key: 'bs', title: 'Balance Sheet', icon: 'BS', target: 'BalanceSheet' },
      { key: 'tb', title: 'Trial Balance', icon: 'TB', target: 'TrialBalance' },
      { key: 'cf', title: 'Cash Flow', icon: 'CF', target: 'CashFlow' },
      { key: 'gl', title: 'General Ledger', icon: 'GL', target: 'GeneralLedger' },
      { key: 'budgets', title: 'Budgets', icon: 'BUD', target: 'BudgetList', feature: 'budgets' },
      { key: 'analytics', title: 'Analytics Dashboard', icon: 'ANL', target: 'AnalyticsDashboard' },
    ],
  },
  {
    key: 'ar',
    title: 'Accounts Receivable',
    icon: 'AR',
    items: [
      { key: 'ar-aging', title: 'Aging', icon: 'AG', target: 'ARAging' },
    ],
  },
  {
    key: 'ap',
    title: 'Accounts Payable',
    icon: 'AP',
    items: [
      { key: 'ap-aging', title: 'Aging', icon: 'AG', target: 'APAging' },
    ],
  },
  {
    key: 'inventory',
    title: 'Inventory',
    icon: 'INV',
    feature: 'inventory',
    items: [
      { key: 'inv-valuation', title: 'Valuation', icon: 'VAL', target: 'InventoryValuation' },
    ],
  },
  {
    key: 'delivery',
    title: 'Delivery',
    icon: 'DEL',
    feature: 'delivery',
    items: [
      { key: 'delivery-daily', title: 'Daily Report', icon: 'DR', target: 'DeliveryDailyReport' },
      { key: 'delivery-performance', title: 'Performance', icon: 'DP', target: 'DeliveryPerformance' },
    ],
  },
];

interface ReportsHubState {
  categories: ReportHubCategory[];
}

const initialState: ReportsHubState = {
  categories: initialCategories,
};

export const reportsHubSlice = createAppSlice({
  name: 'reportsHub',
  initialState,
  reducers: create => ({
    setReportCategories: create.reducer(
      (state, action: { payload: ReportHubCategory[] }) => {
        state.categories = action.payload;
      },
    ),
  }),
  selectors: {
    selectReportCategories: state => state.categories,
  },
});

export const { setReportCategories } = reportsHubSlice.actions;
export const selectReportCategories = (rootState: { reportsHub?: ReportsHubState }) =>
  (rootState.reportsHub ?? initialState).categories;

/**
 * Three-tier model: report categories/items filtered by the company's
 * feature flags (from auth). Legacy sessions (no flags) see everything —
 * matching the server's fully-unlocked fallback for pre-tiering companies.
 * Warehouse-only categories (inventory/delivery) are additionally hard-gated
 * by company type (see featureGates.ts).
 */
type AuthUserState = {
  auth?: {
    user?: {
      features?: Record<string, boolean> | null;
      companyType?: string | null;
    } | null;
  };
};

export const selectVisibleReportCategories = createSelector(
  selectReportCategories,
  (rootState: AuthUserState) => rootState.auth?.user?.features ?? null,
  (rootState: AuthUserState) => rootState.auth?.user?.companyType ?? null,
  (categories, features, companyType): ReportHubCategory[] => {
    return categories
      .filter(c => isFeatureVisible((c as any).feature, features, companyType))
      .map(c => ({
        ...c,
        items: c.items.filter(i => isFeatureVisible((i as any).feature, features, companyType)),
      }))
      .filter(c => c.items.length > 0);
  },
);

/* ── Derived selectors ── */

export const selectReportStats = createSelector(
  selectReportCategories,
  (categories): { total: number; ready: number; categoryCount: number } => {
    let total = 0;
    categories.forEach(c => {
      total += c.items.length;
    });
    return { total, ready: total, categoryCount: categories.length };
  },
);