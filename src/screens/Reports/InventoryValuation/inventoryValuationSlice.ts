import { createAppSlice } from '@store/createAppSlice';
import type { InventoryValuationReport } from '../../../models/inventoryValuationModel';
import { getInventoryValuationReportAPI } from '../../../networks/reports/inventoryValuationNetwork';
import { inventoryValuationSerializer } from '../../../serializers/inventoryValuationSerializer';

interface InventoryValuationState {
  report: InventoryValuationReport | null;
  isLoading: boolean;
  error: string;
}

const initialState: InventoryValuationState = {
  report: null,
  isLoading: false,
  error: '',
};

export const inventoryValuationSlice = createAppSlice({
  name: 'inventoryValuation',
  initialState,
  reducers: create => ({
    fetchInventoryValuationReport: create.asyncThunk(
      async () => inventoryValuationSerializer(await getInventoryValuationReportAPI()),
      {
        pending: state => {
          state.isLoading = true;
          state.error = '';
        },
        fulfilled: (state, action) => {
          state.isLoading = false;
          state.report = action.payload;
        },
        rejected: (state, action) => {
          state.isLoading = false;
          state.error = action.error?.message ?? 'Failed to load inventory valuation';
        },
      },
    ),
  }),
  selectors: {
    selectInventoryValuationState: state => state,
  },
});

export const { fetchInventoryValuationReport } = inventoryValuationSlice.actions;
export const selectInventoryValuationState = (rootState: { inventoryValuation?: InventoryValuationState }) =>
  rootState.inventoryValuation ?? initialState;
