// ═══════════════════════════════════════════════════════
// FinMatrix — Inventory Approval Slice (Shadow Inventory & Approvals flow)
// ═══════════════════════════════════════════════════════
// Co-located with InventoryApprovalScreen.tsx
// Owns: pending/approved/rejected requests, notifications, audit trail.
//
// Architecture (mirrors GL):
//   Screen → Slice → Network → Serializer (in fulfilled) → Screen
//   • models/deliveryModel.ts        — entity types (InventoryUpdateRequest)
//   • network/deliveryNetwork.ts     — getInventoryUpdateRequestsAPI,
//                                      approveInventoryUpdateRequestAPI,
//                                      rejectInventoryUpdateRequestAPI
//   • serializers/deliverySerializer.ts — inventoryUpdateRequestListSerializer,
//                                         inventoryUpdateRequestSingleSerializer
//
// The synchronous `setRequestStatus` reducer is kept intact for the existing
// screen flow that needs to atomically update inventory + the request in a
// single render cycle. New consumers should prefer the async thunks below.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import {
  type InventoryUpdateRequest,
  type InventoryUpdateRequestStatus,
} from '../../../../models/deliveryModel';
import {
  getInventoryUpdateRequestsAPI,
  approveInventoryUpdateRequestAPI,
  rejectInventoryUpdateRequestAPI,
  undoInventoryApprovalAPI,
} from '../../../../networks/delivery/deliveryNetwork';
import {
  inventoryUpdateRequestListSerializer,
  inventoryUpdateRequestSingleSerializer,
} from '../../../../serializers/deliverySerializer';

export type InventoryApprovalFilter = 'pending' | 'approved' | 'rejected' | 'all';

export interface InventoryApprovalNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  createdAt: string;
}

export interface InventoryApprovalAuditEntry {
  id: string;
  requestId: string;
  action: 'approved' | 'rejected' | 'undone';
  reviewedBy: string;
  createdAt: string;
  details: string;
}

export interface InventoryApprovalSliceState {
  requests: InventoryUpdateRequest[];
  activeFilter: InventoryApprovalFilter;
  notifications: InventoryApprovalNotification[];
  auditTrail: InventoryApprovalAuditEntry[];
}

const initialState: InventoryApprovalSliceState = {
  // Real backend requests only (they carry UUID ids the approve endpoint needs).
  // No seeded dummies — approving a non-UUID dummy id triggers a 400.
  requests: [],
  activeFilter: 'pending',
  notifications: [],
  auditTrail: [],
};

const summarizeChanges = (request: InventoryUpdateRequest): string => {
  return request.changes
    .map(c => `${c.itemName}: ${c.beforeQty} -> ${Math.max(0, c.beforeQty - c.deliveredQty + c.returnedQty)}`)
    .join(' | ');
};

export const inventoryApprovalSlice = createAppSlice({
  name: 'inventoryApproval',
  initialState,
  reducers: create => ({
    setInventoryApprovalFilter: create.reducer(
      (state, action: PayloadAction<InventoryApprovalFilter>) => {
        state.activeFilter = action.payload;
      },
    ),
    /**
     * Push a new pending Inventory Update Request created by the
     * Delivery Personnel right after they upload the bill photo.
     * This is what makes the request appear in the admin's review queue.
     */
    submitInventoryRequestFromBillPhoto: create.reducer(
      (
        state,
        action: PayloadAction<{
          requestId: string;
          deliveryId: string;
          deliveryReference: string;
          personnelId: string;
          personnelName: string;
          routeLabel: string;
          billPhotoUri: string;
          billPhotoCapturedAt: string;
          signedBy: string;
          submittedAt: string;
          changes: Array<{
            itemId: string;
            itemName: string;
            beforeQty: number;
            deliveredQty: number;
            returnedQty: number;
          }>;
        }>,
      ) => {
        const exists = state.requests.some(r => r.id === action.payload.requestId);
        if (exists) return;
        state.requests.unshift({
          id: action.payload.requestId,
          deliveryId: action.payload.deliveryId,
          deliveryReference: action.payload.deliveryReference,
          personnelId: action.payload.personnelId,
          personnelName: action.payload.personnelName,
          routeLabel: action.payload.routeLabel,
          submittedAt: action.payload.submittedAt,
          status: 'pending',
          shadowStatus: 'pending',
          changes: action.payload.changes,
          proof: {
            signatureBase64: '',
            signedBy: action.payload.signedBy,
            verificationMethod: 'bill_photo',
            verifiedBy: action.payload.personnelName,
            verifiedAt: action.payload.billPhotoCapturedAt,
            billPhotoUri: action.payload.billPhotoUri,
            billPhotoCapturedAt: action.payload.billPhotoCapturedAt,
          },
        });
      },
    ),

    setRequestStatus: create.reducer(
      (
        state,
        action: PayloadAction<{
          requestId: string;
          status: InventoryUpdateRequestStatus;
          reviewedBy: string;
          reviewerComment?: string;
        }>,
      ) => {
        const request = state.requests.find(r => r.id === action.payload.requestId);
        if (!request) return;

        const now = new Date().toISOString();
        request.status = action.payload.status;
        request.reviewedAt = now;
        request.reviewedBy = action.payload.reviewedBy;
        request.reviewerComment = action.payload.reviewerComment?.trim() || request.reviewerComment;
        request.shadowStatus = action.payload.status === 'approved' ? 'synced' : action.payload.status;

        const actionLabel = action.payload.status === 'approved' ? 'approved' : 'rejected';
        state.notifications.unshift({
          id: `notif_${Date.now()}_${request.id}`,
          userId: request.personnelId,
          title: `Inventory request ${actionLabel}`,
          message:
            action.payload.status === 'approved'
              ? `${request.deliveryReference} inventory changes were approved and synced.`
              : `${request.deliveryReference} inventory changes were rejected. ${request.reviewerComment ?? ''}`.trim(),
          createdAt: now,
        });

        if (action.payload.status === 'approved' || action.payload.status === 'rejected') {
          state.auditTrail.unshift({
            id: `audit_${Date.now()}_${request.id}`,
            requestId: request.id,
            action: action.payload.status,
            reviewedBy: action.payload.reviewedBy,
            createdAt: now,
            details: `${request.deliveryReference} | ${summarizeChanges(request)}`,
          });
        }
      },
    ),

    // ── Async thunks (GL pipeline: network → serializer → state) ──
    /** Fetch all approval requests from the API and merge with local state. */
    fetchApprovalRequests: create.asyncThunk(
      async () => getInventoryUpdateRequestsAPI(),
      {
        fulfilled: (state, action: PayloadAction<any>) => {
          // The backend is authoritative — replace entirely so non-persisted /
          // dummy requests (which lack real UUID ids) never reach the approve
          // call. An empty response means there are genuinely no requests.
          state.requests = inventoryUpdateRequestListSerializer(action.payload);
        },
      },
    ),
    /** Approve a request through the API and merge the serialized response. */
    approveRequestAsync: create.asyncThunk(
      async (params: {
        requestId: string;
        reviewedBy: string;
        reviewerComment?: string;
        /** The owner's cash count, when it differs from the rider's figure. */
        amountCollected?: string;
      }) =>
        approveInventoryUpdateRequestAPI(
          params.requestId,
          params.reviewerComment,
          params.reviewedBy,
          params.amountCollected,
        ),
      {
        fulfilled: (state, action: PayloadAction<any>) => {
          const updated = inventoryUpdateRequestSingleSerializer(action.payload);
          if (!updated) return;
          const idx = state.requests.findIndex(r => r.id === updated.id);
          if (idx !== -1) state.requests[idx] = updated;
          const now = updated.reviewedAt ?? new Date().toISOString();
          state.notifications.unshift({
            id: `notif_${Date.now()}_${updated.id}`,
            userId: updated.personnelId,
            title: 'Inventory request approved',
            message: `${updated.deliveryReference} inventory changes were approved and synced.`,
            createdAt: now,
          });
          state.auditTrail.unshift({
            id: `audit_${Date.now()}_${updated.id}`,
            requestId: updated.id,
            action: 'approved',
            reviewedBy: updated.reviewedBy ?? 'admin',
            createdAt: now,
            details: `${updated.deliveryReference} | ${summarizeChanges(updated)}`,
          });
        },
      },
    ),
    /** Reject a request through the API and merge the serialized response. */
    rejectRequestAsync: create.asyncThunk(
      async (params: { requestId: string; reviewedBy: string; reviewerComment?: string }) =>
        rejectInventoryUpdateRequestAPI(
          params.requestId,
          params.reviewerComment,
          params.reviewedBy,
        ),
      {
        fulfilled: (state, action: PayloadAction<any>) => {
          const updated = inventoryUpdateRequestSingleSerializer(action.payload);
          if (!updated) return;
          const idx = state.requests.findIndex(r => r.id === updated.id);
          if (idx !== -1) state.requests[idx] = updated;
          const now = updated.reviewedAt ?? new Date().toISOString();
          state.notifications.unshift({
            id: `notif_${Date.now()}_${updated.id}`,
            userId: updated.personnelId,
            title: 'Inventory request rejected',
            message: `${updated.deliveryReference} inventory changes were rejected. ${updated.reviewerComment ?? ''}`.trim(),
            createdAt: now,
          });
          state.auditTrail.unshift({
            id: `audit_${Date.now()}_${updated.id}`,
            requestId: updated.id,
            action: 'rejected',
            reviewedBy: updated.reviewedBy ?? 'admin',
            createdAt: now,
            details: `${updated.deliveryReference} | ${summarizeChanges(updated)}`,
          });
        },
      },
    ),
    /**
     * Undo an approved request — reverses inventory changes and marks it
     * as rejected on the server.
     */
    undoApprovalAsync: create.asyncThunk(
      async (params: { requestId: string }) => undoInventoryApprovalAPI(params.requestId),
      {
        fulfilled: (state, action: PayloadAction<any>) => {
          const updated = inventoryUpdateRequestSingleSerializer(action.payload);
          if (!updated) return;
          const idx = state.requests.findIndex(r => r.id === updated.id);
          if (idx !== -1) state.requests[idx] = updated;
          const now = updated.reviewedAt ?? new Date().toISOString();
          state.notifications.unshift({
            id: `notif_${Date.now()}_${updated.id}`,
            userId: updated.personnelId,
            title: 'Inventory approval reversed',
            message: `The approval for ${updated.deliveryReference} was undone and sent back to pending for re-review.`,
            createdAt: now,
          });
          state.auditTrail.unshift({
            id: `audit_${Date.now()}_${updated.id}`,
            requestId: updated.id,
            action: 'undone',
            reviewedBy: updated.reviewedBy ?? 'admin',
            createdAt: now,
            details: `[UNDONE → PENDING] ${updated.deliveryReference} | ${summarizeChanges(updated)}`,
          });
        },
      },
    ),
  }),
  selectors: {
    selectInventoryApprovalState: state => state,
    selectInventoryApprovalRequests: state => state.requests,
    selectInventoryApprovalFilter: state => state.activeFilter,
    selectInventoryApprovalNotifications: state => state.notifications,
    selectInventoryApprovalAuditTrail: state => state.auditTrail,
    selectPendingApprovalCount: state => state.requests.filter(r => r.status === 'pending').length,
  },
});

export const {
  setInventoryApprovalFilter,
  submitInventoryRequestFromBillPhoto,
  setRequestStatus,
  fetchApprovalRequests,
  approveRequestAsync,
  rejectRequestAsync,
  undoApprovalAsync,
} = inventoryApprovalSlice.actions;

export const {
  selectInventoryApprovalState,
  selectInventoryApprovalRequests,
  selectInventoryApprovalFilter,
  selectInventoryApprovalNotifications,
  selectInventoryApprovalAuditTrail,
  selectPendingApprovalCount,
} = inventoryApprovalSlice.selectors;
