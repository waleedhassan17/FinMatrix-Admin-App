// ═══════════════════════════════════════════════════════
// FinMatrix — DP Customer Confirm Slice (GL pattern)
// ═══════════════════════════════════════════════════════
// Co-located with CustomerConfirmScreen.tsx.
// Owns UI state (issue modal + text) and exposes two async thunks:
// confirmReceipt + reportIssue. Each goes through network → serializer
// then dispatches cross-slice into the canonical deliverySlice.

import { createAppSlice } from '@store/createAppSlice';
import type {
  ConfirmReceiptResult,
  ReportIssueResult,
} from '../../../../models/dpCustomerConfirmModel';
import {
  confirmCustomerReceiptAPI,
  reportDeliveryIssueAPI,
} from '../../../../networks/delivery/dpCustomerConfirmNetwork';
import {
  confirmReceiptSerializer,
  reportIssueSerializer,
} from '../../../../serializers/dpCustomerConfirmSerializer';
import {
  confirmCustomerReceipt,
  reportDeliveryIssue,
} from '../../Admin/AssignDeliveries/deliverySlice';

export interface DPCustomerConfirmSliceState {
  issueModalVisible: boolean;
  issueText: string;
  isConfirming: boolean;
  isReportingIssue: boolean;
  confirmError: string;
  issueError: string;
  lastConfirmResult: ConfirmReceiptResult | null;
  lastIssueResult: ReportIssueResult | null;
}

const initialState: DPCustomerConfirmSliceState = {
  issueModalVisible: false,
  issueText: '',
  isConfirming: false,
  isReportingIssue: false,
  confirmError: '',
  issueError: '',
  lastConfirmResult: null,
  lastIssueResult: null,
};

export const dpCustomerConfirmSlice = createAppSlice({
  name: 'dpCustomerConfirm',
  initialState,
  reducers: create => ({
    setIssueModalVisible: create.reducer((state, action: { payload: boolean }) => {
      state.issueModalVisible = action.payload;
      if (!action.payload) state.issueError = '';
    }),
    setIssueText: create.reducer((state, action: { payload: string }) => {
      state.issueText = action.payload;
    }),
    resetCustomerConfirmState: create.reducer(() => initialState),

    confirmReceipt: create.asyncThunk(
      async (payload: { deliveryId: string; verifiedBy: string }, thunkAPI) => {
        const result = confirmReceiptSerializer(await confirmCustomerReceiptAPI(payload));
        if (result) {
          thunkAPI.dispatch(
            confirmCustomerReceipt({
              deliveryId: payload.deliveryId,
              verifiedBy: payload.verifiedBy,
            }),
          );
        }
        return result;
      },
      {
        pending: state => {
          state.isConfirming = true;
          state.confirmError = '';
        },
        fulfilled: (state, action) => {
          state.isConfirming = false;
          state.lastConfirmResult = action.payload;
        },
        rejected: (state, action) => {
          state.isConfirming = false;
          state.confirmError = action.error?.message ?? 'Failed to confirm receipt';
        },
      },
    ),

    reportIssue: create.asyncThunk(
      async (payload: { deliveryId: string; note: string }, thunkAPI) => {
        const result = reportIssueSerializer(await reportDeliveryIssueAPI(payload));
        if (result) {
          thunkAPI.dispatch(
            reportDeliveryIssue({
              deliveryId: payload.deliveryId,
              note: payload.note,
            }),
          );
        }
        return result;
      },
      {
        pending: state => {
          state.isReportingIssue = true;
          state.issueError = '';
        },
        fulfilled: (state, action) => {
          state.isReportingIssue = false;
          state.lastIssueResult = action.payload;
          state.issueModalVisible = false;
          state.issueText = '';
        },
        rejected: (state, action) => {
          state.isReportingIssue = false;
          state.issueError = action.error?.message ?? 'Failed to report issue';
        },
      },
    ),
  }),
  selectors: {
    selectIssueModalVisible: state => state.issueModalVisible,
    selectIssueText: state => state.issueText,
    selectDPCustomerConfirmState: state => state,
  },
});

export const {
  setIssueModalVisible,
  setIssueText,
  resetCustomerConfirmState,
  confirmReceipt,
  reportIssue,
} = dpCustomerConfirmSlice.actions;
export const { selectIssueModalVisible, selectIssueText, selectDPCustomerConfirmState } =
  dpCustomerConfirmSlice.selectors;
