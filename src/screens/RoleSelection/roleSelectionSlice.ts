// ═══════════════════════════════════════════════════════
// FinMatrix — Role Selection Slice (createAppSlice pattern)
// ═══════════════════════════════════════════════════════
// Co-located with RoleSelectionScreen.tsx

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import type { UserRole } from '../../types';

export interface RoleSelectionSliceState {
  selectedRole: UserRole | null;
  status: 'idle' | 'loading' | 'failed';
  error: string;
}

const initialState: RoleSelectionSliceState = {
  selectedRole: null,
  status: 'idle',
  error: '',
};

export const roleSelectionSlice = createAppSlice({
  name: 'roleSelection',
  initialState,
  reducers: create => ({
    setRole: create.reducer(
      (state, action: PayloadAction<UserRole>) => {
        state.selectedRole = action.payload;
      },
    ),
    clearRole: create.reducer(state => {
      state.selectedRole = null;
    }),
    resetRoleSelection: create.reducer(state => {
      state.selectedRole = null;
      state.status = 'idle';
      state.error = '';
    }),
  }),

  selectors: {
    selectRole: state => state.selectedRole,
    selectRoleSelectionStatus: state => state.status,
    selectRoleSelectionError: state => state.error,
  },
});

export const { setRole, clearRole, resetRoleSelection } =
  roleSelectionSlice.actions;

export const {
  selectRole,
  selectRoleSelectionStatus,
  selectRoleSelectionError,
} = roleSelectionSlice.selectors;
