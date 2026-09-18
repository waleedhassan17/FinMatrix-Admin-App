// ═══════════════════════════════════════════════════════
// FinMatrix — DP Bill Photo Capture Slice (GL pattern)
// ═══════════════════════════════════════════════════════
// Co-located with BillPhotoCaptureScreen.tsx.
// Owns local UI state (selected photo URI, source, signedBy) and exposes an
// async thunk that submits the photo through network → serializer, then
// fans out cross-slice updates:
//   • deliverySlice.attachBillPhotoToDelivery        — store URI on delivery
//   • inventoryApprovalSlice.submitInventoryRequestFromBillPhoto
//                                                    — create approval request
//   • notificationCenterSlice.addRealtimeNotification — alert admin

import { createAppSlice } from '@store/createAppSlice';
import type {
  BillPhotoSource,
  DeliveryPaidStatus,
  SubmitBillPhotoPayload,
  SubmitBillPhotoResult,
} from '../../../../models/dpBillPhotoCaptureModel';
import { submitBillPhotoAPI } from '../../../../networks/delivery/dpBillPhotoCaptureNetwork';
import { dpBillPhotoCaptureSerializer } from '../../../../serializers/dpBillPhotoCaptureSerializer';
import { attachBillPhotoToDelivery, deductShadowInventory } from '../../Admin/AssignDeliveries/deliverySlice';
import { submitInventoryRequestFromBillPhoto } from '../../Admin/InventoryApproval/inventoryApprovalSlice';

export interface DPBillPhotoCaptureSliceState {
  photoUri: string;
  source: BillPhotoSource | null;
  signedBy: string;
  note: string;
  /** PAID / PARTIAL / NOT PAID — required before submitting, unless nothing is due. */
  paidStatus: DeliveryPaidStatus | null;
  /** Raw text of the amount received, read only for PARTIAL. */
  amountCollected: string;
  /**
   * Units the customer refused, keyed by itemId. Kept as raw strings because
   * they come straight off TextInputs; an absent or blank entry means nothing
   * was returned on that line.
   */
  returnedQtys: Record<string, string>;
  isSubmitting: boolean;
  error: string;
  lastResult: SubmitBillPhotoResult | null;
}

const initialState: DPBillPhotoCaptureSliceState = {
  photoUri: '',
  source: null,
  signedBy: '',
  note: '',
  paidStatus: null,
  amountCollected: '',
  returnedQtys: {},
  isSubmitting: false,
  error: '',
  lastResult: null,
};

export const dpBillPhotoCaptureSlice = createAppSlice({
  name: 'dpBillPhotoCapture',
  initialState,
  reducers: create => ({
    setBillPhoto: create.reducer(
      (state, action: { payload: { uri: string; source: BillPhotoSource } }) => {
        state.photoUri = action.payload.uri;
        state.source = action.payload.source;
      },
    ),
    clearBillPhoto: create.reducer(state => {
      state.photoUri = '';
      state.source = null;
    }),
    setSignedBy: create.reducer((state, action: { payload: string }) => {
      state.signedBy = action.payload;
    }),
    setNote: create.reducer((state, action: { payload: string }) => {
      state.note = action.payload;
    }),
    setPaidStatus: create.reducer((state, action: { payload: DeliveryPaidStatus }) => {
      state.paidStatus = action.payload;
    }),
    setAmountCollected: create.reducer((state, action: { payload: string }) => {
      state.amountCollected = action.payload;
    }),
    setReturnedQty: create.reducer(
      (state, action: { payload: { itemId: string; qty: string } }) => {
        state.returnedQtys[action.payload.itemId] = action.payload.qty;
      },
    ),
    resetBillPhotoState: create.reducer(() => initialState),

    submitBillPhoto: create.asyncThunk(
      async (payload: SubmitBillPhotoPayload, thunkAPI) => {
        const now = new Date().toISOString();

        // The upload MUST reach the server — a failure rejects this thunk so
        // the screen shows a retryable error and the rider re-taps Submit.
        // (Previously a failure was swallowed and a fake local request was
        // fabricated: the rider saw "success" while the server never received
        // the photo — a silent data loss.) The network layer already retries
        // transient connection drops, and the backend treats a replayed
        // submission as a 409 duplicate, so retrying is always safe.
        const apiResponse = await submitBillPhotoAPI(payload);
        const result = dpBillPhotoCaptureSerializer(apiResponse);

        const requestId = result?.requestId ?? `req_${Date.now()}_${payload.deliveryId}`;
        // Keep the LOCAL file:// uri for display, not the server URL. The URL
        // the server returns points at an authenticated API route, and RN's
        // <Image> will not attach a bearer token to it — swapping it in here
        // turned the rider's own just-captured photo into a black box. The
        // upload has already succeeded at this point; the server copy is the
        // record of truth, this uri is only what this device renders.
        const photoUrl = payload.photoUri || result?.photoUrl;
        const capturedAt = result?.uploadedAt ?? now;

        // 1. Attach photo + signedBy on the canonical delivery record.
        thunkAPI.dispatch(
          attachBillPhotoToDelivery({
            deliveryId: payload.deliveryId,
            billPhotoUri: photoUrl,
            billPhotoCapturedAt: capturedAt,
            signedBy: payload.signedBy,
          }),
        );

        // 2. Deduct from shadow inventory immediately so personnel sees updated stock.
        thunkAPI.dispatch(
          deductShadowInventory({
            personnelId: payload.personnelId,
            changes: payload.changes.map(c => ({
              itemId: c.itemId,
              itemName: c.itemName,
              deliveredQty: c.deliveredQty,
              returnedQty: c.returnedQty,
            })),
          }),
        );

        // 3. ALWAYS create the pending Inventory Update Request the admin will review.
        thunkAPI.dispatch(
          submitInventoryRequestFromBillPhoto({
            requestId,
            deliveryId: payload.deliveryId,
            deliveryReference: payload.deliveryReference,
            personnelId: payload.personnelId,
            personnelName: payload.personnelName,
            routeLabel: payload.routeLabel,
            billPhotoUri: photoUrl,
            billPhotoCapturedAt: capturedAt,
            signedBy: payload.signedBy,
            submittedAt: capturedAt,
            changes: payload.changes,
          }),
        );

        // The admin sees this pending request directly in the Inventory
        // Approvals queue. (The in-app Notification Centre is deferred to v2.)

        return result ?? { requestId, deliveryId: payload.deliveryId, photoUrl, uploadedAt: capturedAt };
      },
      {
        pending: state => {
          state.isSubmitting = true;
          state.error = '';
        },
        fulfilled: (state, action) => {
          state.isSubmitting = false;
          state.lastResult = action.payload;
        },
        rejected: (state, action) => {
          state.isSubmitting = false;
          state.error = action.error?.message ?? 'Failed to submit bill photo';
        },
      },
    ),
  }),
  selectors: {
    selectBillPhotoCaptureState: state => state,
    selectBillPhotoUri: state => state.photoUri,
    selectBillPhotoSource: state => state.source,
    selectBillPhotoSignedBy: state => state.signedBy,
    selectBillPhotoNote: state => state.note,
    selectBillPhotoPaidStatus: state => state.paidStatus,
    selectBillPhotoAmountCollected: state => state.amountCollected,
    selectBillPhotoReturnedQtys: state => state.returnedQtys,
    selectBillPhotoIsSubmitting: state => state.isSubmitting,
  },
});

export const {
  setBillPhoto,
  clearBillPhoto,
  setSignedBy,
  setNote,
  setPaidStatus,
  setAmountCollected,
  setReturnedQty,
  resetBillPhotoState,
  submitBillPhoto,
} = dpBillPhotoCaptureSlice.actions;

export const {
  selectBillPhotoCaptureState,
  selectBillPhotoUri,
  selectBillPhotoSource,
  selectBillPhotoSignedBy,
  selectBillPhotoNote,
  selectBillPhotoPaidStatus,
  selectBillPhotoAmountCollected,
  selectBillPhotoReturnedQtys,
  selectBillPhotoIsSubmitting,
} = dpBillPhotoCaptureSlice.selectors;
