import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { DeliveryPriority } from '../../../../models/deliveryModel';

interface DraftItem {
  agencyId: string;
  agencyName: string;
  itemId: string;
  itemName: string;
  /** Single source of truth. The wire carries it as `orderedQty`, which is
   *  what the ledger dispatches on — carrying a second copy meant the stepper
   *  updated one and the server read the other. */
  quantity: number;
  unitPrice: number;
}

export interface CreateDeliverySliceState {
  customerId: string;
  priority: DeliveryPriority;
  notes: string;
  items: DraftItem[];
}

const initialState: CreateDeliverySliceState = {
  customerId: '',
  priority: 'medium',
  notes: '',
  items: [],
};

export const createDeliveryScreenSlice = createAppSlice({
  name: 'createDeliveryScreen',
  initialState,
  reducers: create => ({
    setCustomerId: create.reducer((state, action: PayloadAction<string>) => {
      state.customerId = action.payload;
    }),
    setPriority: create.reducer((state, action: PayloadAction<DeliveryPriority>) => {
      state.priority = action.payload;
    }),
    setNotes: create.reducer((state, action: PayloadAction<string>) => {
      state.notes = action.payload;
    }),
    addDraftItem: create.reducer((state, action: PayloadAction<DraftItem>) => {
      state.items.push(action.payload);
    }),
    updateDraftItemQty: create.reducer((state, action: PayloadAction<{ index: number; quantity: number }>) => {
      const target = state.items[action.payload.index];
      if (!target) return;
      target.quantity = Math.max(1, action.payload.quantity);
    }),
    removeDraftItem: create.reducer((state, action: PayloadAction<number>) => {
      state.items.splice(action.payload, 1);
    }),
    resetCreateDeliveryDraft: create.reducer(() => initialState),
  }),
  selectors: {
    selectCreateDeliveryDraft: state => state,
  },
});

export const {
  setCustomerId,
  setPriority,
  setNotes,
  addDraftItem,
  updateDraftItemQty,
  removeDraftItem,
  resetCreateDeliveryDraft,
} = createDeliveryScreenSlice.actions;

export const { selectCreateDeliveryDraft } = createDeliveryScreenSlice.selectors;
