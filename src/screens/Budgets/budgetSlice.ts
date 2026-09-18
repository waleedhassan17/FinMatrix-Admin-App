import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { Budget, BudgetVsActual } from '../../models/budgetModel';
import {
  getBudgetsAPI, getBudgetByIdAPI, getBudgetVsActualAPI, createBudgetAPI, deleteBudgetAPI,
} from '../../networks/payroll/budgetNetwork';
import { budgetListSerializer, budgetSingleSerializer, budgetVsActualSerializer } from '../../serializers/budgetSerializer';

interface BudgetState {
  budgets: Budget[];
  current: Budget | null;
  vsActual: BudgetVsActual | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string;
}

const initialState: BudgetState = { budgets: [], current: null, vsActual: null, isLoading: false, isSaving: false, error: '' };

export const budgetSlice = createAppSlice({
  name: 'budgets',
  initialState,
  reducers: create => ({
    fetchBudgets: create.asyncThunk(
      async () => getBudgetsAPI(),
      {
        pending: state => { state.isLoading = true; state.error = ''; },
        fulfilled: (state, action) => { state.isLoading = false; state.budgets = budgetListSerializer(action.payload); },
        rejected: (state, action) => { state.isLoading = false; state.error = action.error?.message ?? 'Failed to load budgets'; },
      },
    ),
    fetchBudget: create.asyncThunk(
      async (id: string): Promise<{ detail: any; va: any }> => {
        const [detail, va] = await Promise.all([getBudgetByIdAPI(id), getBudgetVsActualAPI(id).catch((): any => null)]);
        return { detail, va };
      },
      {
        pending: state => { state.isLoading = true; state.error = ''; state.current = null; state.vsActual = null; },
        fulfilled: (state, action) => {
          state.isLoading = false;
          state.current = budgetSingleSerializer(action.payload.detail);
          state.vsActual = action.payload.va ? budgetVsActualSerializer(action.payload.va) : null;
        },
        rejected: (state, action) => { state.isLoading = false; state.error = action.error?.message ?? 'Failed to load budget'; },
      },
    ),
    saveBudget: create.asyncThunk(
      async (data: any) => createBudgetAPI(data),
      {
        pending: state => { state.isSaving = true; state.error = ''; },
        fulfilled: (state) => { state.isSaving = false; },
        rejected: (state, action) => { state.isSaving = false; state.error = action.error?.message ?? 'Failed to save budget'; },
      },
    ),
    removeBudget: create.asyncThunk(
      async (id: string) => { await deleteBudgetAPI(id); return id; },
      { fulfilled: (state, action: PayloadAction<string>) => { state.budgets = state.budgets.filter(b => b.id !== action.payload); } },
    ),
  }),
  selectors: { selectBudgetState: state => state },
});

export const { fetchBudgets, fetchBudget, saveBudget, removeBudget } = budgetSlice.actions;
export const selectBudgetState = (rootState: { budgets?: BudgetState }) => rootState.budgets ?? initialState;
