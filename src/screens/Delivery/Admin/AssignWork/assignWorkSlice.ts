import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';

export interface AssignWorkSliceState {
  selectedDeliveryIds: string[];
  selectedPersonnelId: string;
}

const initialState: AssignWorkSliceState = {
  selectedDeliveryIds: [],
  selectedPersonnelId: '',
};

export const assignWorkSlice = createAppSlice({
  name: 'assignWork',
  initialState,
  reducers: create => ({
    toggleDelivery: create.reducer((state, action: PayloadAction<string>) => {
      if (state.selectedDeliveryIds.includes(action.payload)) {
        state.selectedDeliveryIds = state.selectedDeliveryIds.filter(id => id !== action.payload);
      } else {
        state.selectedDeliveryIds.push(action.payload);
      }
    }),
    setPersonnel: create.reducer((state, action: PayloadAction<string>) => {
      state.selectedPersonnelId = action.payload;
    }),
    resetAssignWork: create.reducer(() => initialState),
  }),
  selectors: {
    selectAssignWorkState: state => state,
  },
});

export const { toggleDelivery, setPersonnel, resetAssignWork } = assignWorkSlice.actions;
export const { selectAssignWorkState } = assignWorkSlice.selectors;
