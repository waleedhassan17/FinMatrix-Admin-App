import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import {
  cancelApproval as apiCancel,
  decideApproval as apiDecide,
  fetchApprovals as apiFetch,
  fetchPendingApprovalCount as apiCount,
  type ApprovalFilter,
} from '../../networks/approvals/approvalsNetwork';
import type { ApprovalRequest } from '../../models/approvalModel';

/**
 * Shared by the owner's approvals inbox and the staff member's "My requests".
 *
 * One slice for both because they are the same data: the server scopes
 * /approvals by role, so an owner's fetch returns the company's requests and a
 * staff member's returns only their own. Splitting them would mean two copies
 * of the same list logic and a client-side filter that could disagree with the
 * server's.
 */
interface ApprovalsState {
  items: ApprovalRequest[];
  filter: ApprovalFilter;
  pendingCount: number;
  isLoading: boolean;
  /** Id of the request currently being approved/rejected/cancelled. */
  decidingId: string | null;
  error: string | null;
}

const initialState: ApprovalsState = {
  items: [],
  filter: 'pending',
  pendingCount: 0,
  isLoading: false,
  decidingId: null,
  error: null,
};

export const approvalsSlice = createAppSlice({
  name: 'approvals',
  initialState,
  reducers: create => ({
    setApprovalFilter: create.reducer(
      (state, action: PayloadAction<ApprovalFilter>) => {
        state.filter = action.payload;
      },
    ),
    clearApprovalsError: create.reducer(state => {
      state.error = null;
    }),

    fetchApprovals: create.asyncThunk(
      async (filter: ApprovalFilter | undefined, { getState }) => {
        const state = getState() as { approvals: ApprovalsState };
        return apiFetch(filter ?? state.approvals.filter);
      },
      {
        pending: state => {
          state.isLoading = true;
          state.error = null;
        },
        fulfilled: (state, action) => {
          state.isLoading = false;
          state.items = action.payload;
        },
        rejected: (state, action) => {
          state.isLoading = false;
          state.error = action.error?.message ?? 'Could not load requests';
        },
      },
    ),

    fetchPendingCount: create.asyncThunk(async () => apiCount(), {
      fulfilled: (state, action) => {
        state.pendingCount = action.payload;
      },
    }),

    decideApproval: create.asyncThunk(
      async (params: {
        id: string;
        decision: 'approve' | 'reject';
        comment?: string;
      }) => apiDecide(params.id, params.decision, params.comment),
      {
        pending: (state, action) => {
          state.decidingId = action.meta.arg.id;
          state.error = null;
        },
        fulfilled: (state, action) => {
          state.decidingId = null;
          // Replace in place so the row keeps its position while the reviewer
          // works down the list, rather than jumping as the list re-sorts.
          const i = state.items.findIndex(r => r.id === action.payload.id);
          if (i !== -1) state.items[i] = action.payload;
          state.pendingCount = Math.max(0, state.pendingCount - 1);
        },
        rejected: (state, action) => {
          state.decidingId = null;
          state.error = action.error?.message ?? 'Could not record the decision';
        },
      },
    ),

    cancelApproval: create.asyncThunk(async (id: string) => apiCancel(id), {
      pending: (state, action) => {
        state.decidingId = action.meta.arg;
      },
      fulfilled: (state, action) => {
        state.decidingId = null;
        const i = state.items.findIndex(r => r.id === action.payload.id);
        if (i !== -1) state.items[i] = action.payload;
        state.pendingCount = Math.max(0, state.pendingCount - 1);
      },
      rejected: (state, action) => {
        state.decidingId = null;
        state.error = action.error?.message ?? 'Could not cancel the request';
      },
    }),
  }),

  selectors: {
    selectApprovals: state => state.items,
    selectApprovalFilter: state => state.filter,
    selectApprovalsLoading: state => state.isLoading,
    selectApprovalsError: state => state.error,
    selectDecidingId: state => state.decidingId,
    selectPendingApprovalCount: state => state.pendingCount,
  },
});

export const {
  setApprovalFilter,
  clearApprovalsError,
  fetchApprovals,
  fetchPendingCount,
  decideApproval,
  cancelApproval,
} = approvalsSlice.actions;

export const {
  selectApprovals,
  selectApprovalFilter,
  selectApprovalsLoading,
  selectApprovalsError,
  selectDecidingId,
  selectPendingApprovalCount,
} = approvalsSlice.selectors;
