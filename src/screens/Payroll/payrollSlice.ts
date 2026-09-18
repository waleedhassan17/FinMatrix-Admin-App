import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { Employee, PayrollRun } from '../../models/payrollModel';
import {
  getEmployeesAPI, getPayrollRunsAPI, getPayrollRunByIdAPI, createPayrollRunAPI,
  processPayrollRunAPI, deletePayrollRunAPI, deleteEmployeeAPI,
} from '../../networks/payroll/payrollNetwork';
import {
  employeeListSerializer, payrollRunListSerializer, payrollRunSingleSerializer,
} from '../../serializers/payrollSerializer';

interface PayrollState {
  employees: Employee[];
  runs: PayrollRun[];
  currentRun: PayrollRun | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string;
}

const initialState: PayrollState = { employees: [], runs: [], currentRun: null, isLoading: false, isSaving: false, error: '' };

export const payrollSlice = createAppSlice({
  name: 'payroll',
  initialState,
  reducers: create => ({
    fetchEmployees: create.asyncThunk(
      async () => getEmployeesAPI({ limit: 200 }),
      {
        pending: state => { state.isLoading = true; state.error = ''; },
        fulfilled: (state, action) => { state.isLoading = false; state.employees = employeeListSerializer(action.payload); },
        rejected: (state, action) => { state.isLoading = false; state.error = action.error?.message ?? 'Failed to load employees'; },
      },
    ),
    removeEmployee: create.asyncThunk(
      async (id: string) => { await deleteEmployeeAPI(id); return id; },
      { fulfilled: (state, action: PayloadAction<string>) => { state.employees = state.employees.filter(e => e.id !== action.payload); } },
    ),
    fetchPayrollRuns: create.asyncThunk(
      async () => getPayrollRunsAPI(),
      {
        pending: state => { state.isLoading = true; state.error = ''; },
        fulfilled: (state, action) => { state.isLoading = false; state.runs = payrollRunListSerializer(action.payload); },
        rejected: (state, action) => { state.isLoading = false; state.error = action.error?.message ?? 'Failed to load payroll runs'; },
      },
    ),
    fetchPayrollRun: create.asyncThunk(
      async (id: string) => getPayrollRunByIdAPI(id),
      {
        pending: state => { state.isLoading = true; state.error = ''; state.currentRun = null; },
        fulfilled: (state, action) => { state.isLoading = false; state.currentRun = payrollRunSingleSerializer(action.payload); },
        rejected: (state, action) => { state.isLoading = false; state.error = action.error?.message ?? 'Failed to load payroll run'; },
      },
    ),
    createRun: create.asyncThunk(
      async (data: any) => createPayrollRunAPI(data),
      {
        pending: state => { state.isSaving = true; state.error = ''; },
        fulfilled: (state, action) => { state.isSaving = false; state.currentRun = payrollRunSingleSerializer(action.payload); },
        rejected: (state, action) => { state.isSaving = false; state.error = action.error?.message ?? 'Failed to create payroll run'; },
      },
    ),
    processRun: create.asyncThunk(
      async (id: string) => processPayrollRunAPI(id),
      {
        pending: state => { state.isSaving = true; },
        fulfilled: (state, action) => { state.isSaving = false; state.currentRun = payrollRunSingleSerializer(action.payload); },
        rejected: (state, action) => { state.isSaving = false; state.error = action.error?.message ?? 'Failed to process payroll'; },
      },
    ),
    removeRun: create.asyncThunk(
      async (id: string) => { await deletePayrollRunAPI(id); return id; },
      { fulfilled: (state, action: PayloadAction<string>) => { state.runs = state.runs.filter(r => r.id !== action.payload); } },
    ),
  }),
  selectors: { selectPayrollState: state => state },
});

export const {
  fetchEmployees, removeEmployee, fetchPayrollRuns, fetchPayrollRun, createRun, processRun, removeRun,
} = payrollSlice.actions;
export const selectPayrollState = (rootState: { payroll?: PayrollState }) => rootState.payroll ?? initialState;
