// ═══════════════════════════════════════════════════════
// FinMatrix — Delivery Slice (canonical data owner)
// ═══════════════════════════════════════════════════════
// Co-located with AssignDeliveriesScreen.tsx but read by 18+ Delivery
// screens (Admin + Personnel sub-modules).
//
// Architecture (mirrors GL):
//   Screen → Slice → Network → Serializer (in fulfilled) → Screen
//   • models/deliveryModel.ts        — entity types, validation
//   • network/deliveryNetwork.ts     — envelope-wrapped CRUD APIs
//   • serializers/deliverySerializer.ts — raw envelope → UI types
//
// Existing synchronous reducers (createDelivery, assignSelectedDeliveries,
// updateDeliveryStatus, …) are kept intact for backward-compatibility with
// the screens that depend on them. The `fetchDeliveries` async thunk below
// demonstrates the full GL pipeline; new code should prefer it.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createSelector } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { type DeliveryItemLine, type DeliveryPriority, type DeliveryRecord, type StatusHistoryEntry } from '../../../../models/deliveryModel';
import { type DummyDeliveryPerson } from '../../../../models/deliveryModel';
import {
  getDeliveriesAPI,
  getDeliveryPersonnelAPI,
  assignDeliveriesAPI,
  createDeliveryAPI,
  getShadowInventoryAPI,
  updateDeliveryStatusAPI,
  deleteDeliveryAPI,
} from '../../../../networks/delivery/deliveryNetwork';
import {
  deliveryListSerializer,
  personnelListSerializer,
  mapDelivery,
} from '../../../../serializers/deliverySerializer';

export interface ShadowInventoryItem {
  personnelId: string;
  itemId: string;
  itemName: string;
  quantity: number;      // currentQty after deductions
  originalQty: number;   // qty before any deliveries (from backend originalQty)
  syncStatus: string;    // 'synced' | 'pending' | 'rejected'
  updatedAt: string;
}

export interface InventoryUpdateRequest {
  id: string;
  personnelId: string;
  itemId: string;
  itemName: string;
  requestedQty: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface DeliveryNotification {
  id: string;
  type: 'delivery_assigned' | 'delivery_status';
  deliveryId: string;
  personnelId?: string;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
}

export interface DeliverySliceState {
  deliveries: DeliveryRecord[];
  deliveryPersonnel: DummyDeliveryPerson[];
  shadowInventory: ShadowInventoryItem[];
  inventoryUpdateRequests: InventoryUpdateRequest[];
  notifications: DeliveryNotification[];
}

const priorityRank: Record<DeliveryPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const buildLoadMap = (deliveries: DeliveryRecord[]): Record<string, number> => {
  return deliveries.reduce<Record<string, number>>((acc, d) => {
    if (!d.assignedTo) return acc;
    if (d.status === 'pending' || d.status === 'in_transit') {
      acc[d.assignedTo] = (acc[d.assignedTo] ?? 0) + 1;
    }
    return acc;
  }, {});
};

const initialState: DeliverySliceState = {
  deliveries: [],
  deliveryPersonnel: [],
  shadowInventory: [],
  inventoryUpdateRequests: [],
  notifications: [],
};

export const deliverySlice = createAppSlice({
  name: 'delivery',
  initialState,
  reducers: create => ({
    createDelivery: create.asyncThunk(
      async (payload: {
        customerId: string;
        customerName: string;
        zone: string;
        scheduledDate: string;
        priority: DeliveryPriority;
        notes?: string;
        /** The customer paid the whole order before dispatch. */
        prePaid?: boolean;
        /**
         * Paid before dispatch, in part. Recorded as a receipt held in Customer
         * Advances; the rider collects only the rest. Staff: the server files
         * the delivery for the owner instead of creating it.
         */
        advanceAmount?: string;
        items: DeliveryItemLine[];
        /** Owner only: past the customer's credit limit, with a reason. */
        overrideReason?: string;
      }, thunkAPI) => {
        const sanitizedItems = (payload.items || []).map(item => ({
          ...item,
          // The DTO requires orderedQty and the ledger dispatches on it;
          // `quantity` is the display copy. Derive both from the one the UI
          // edits so a stepper change cannot be lost between them.
          orderedQty: item.quantity,
          agencyId: (item.agencyId && item.agencyId.length === 36) ? item.agencyId : null,
          agencyName: item.agencyName || null,
        }));
        const { overrideReason, ...body } = payload;
        // rejectWithValue keeps the credit-limit breakdown, which a thrown
        // error loses on the way through RTK.
        let result: any;
        try {
          result = await createDeliveryAPI({ ...body, items: sanitizedItems }, overrideReason);
        } catch (e: any) {
          return thunkAPI.rejectWithValue({ message: e?.message, code: e?.code, details: e?.details });
        }
        return { ...body, items: sanitizedItems, apiResult: result };
      },
      {
        fulfilled: (state, action) => {
          const { apiResult, ...payload } = action.payload;
          // Only trust the server's record. The old fallback fabricated a
          // local delivery with a made-up id ('del_001') and reference
          // ('DEL-1001') whenever the envelope shape differed — ids the server
          // has never seen, which then 404 on every subsequent call and
          // disappear on the next refetch. A create that returns nothing
          // usable is a failure, not a delivery.
          const backendDelivery = apiResult?.data?.delivery ?? apiResult?.data;
          // A staff member's advance delivery comes back as a pending approval:
          // nothing exists yet, so there is nothing to list.
          if (backendDelivery?.id && !backendDelivery?.pending) {
            state.deliveries.unshift(mapDelivery(backendDelivery));
          }
        },
      },
    ),

    assignSelectedDeliveries: create.asyncThunk(
      async (
        payload: { deliveryIds: string[]; personnelId: string; assignedBy?: string; overrideReason?: string },
        thunkAPI,
      ) => {
        let result: any;
        try {
          result = await assignDeliveriesAPI(
            { deliveryIds: payload.deliveryIds, personnelId: payload.personnelId },
            payload.overrideReason,
          );
        } catch (e: any) {
          return thunkAPI.rejectWithValue({ message: e?.message, code: e?.code, details: e?.details });
        }
        return { ...payload, apiResult: result };
      },
      {
        fulfilled: (state, action) => {
          const { deliveryIds, personnelId } = action.payload;
          const now = new Date().toISOString();

          for (const delivery of state.deliveries) {
            if (!deliveryIds.includes(delivery.id)) continue;

            delivery.assignedTo = personnelId;
            delivery.assignedAt = now;
            delivery.status = 'pending';
            delivery.updatedAt = now;

            state.notifications.unshift({
              id: `notif_${Date.now()}_${delivery.id}`,
              type: 'delivery_assigned',
              deliveryId: delivery.id,
              personnelId,
              title: 'New delivery assigned',
              message: `${delivery.referenceNo} assigned to ${personnelId}.`,
              createdAt: now,
              isRead: false,
            });
          }

          const loadMap = buildLoadMap(state.deliveries);
          state.deliveryPersonnel = state.deliveryPersonnel.map(person => ({
            ...person,
            currentLoad: loadMap[person.userId] ?? 0,
          }));
        },
      },
    ),

    autoAssignDeliveries: create.reducer(
      (state, action: PayloadAction<{ deliveryIds?: string[] } | undefined>) => {
        const targetIds = action.payload?.deliveryIds;
        const now = new Date().toISOString();

        const candidates = state.deliveries
          .filter(d => d.status === 'unassigned' && (!targetIds || targetIds.includes(d.id)))
          .sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority]);

        const loadMap = buildLoadMap(state.deliveries);

        for (const delivery of candidates) {
          const eligible = state.deliveryPersonnel
            .filter(p => p.status === 'active' && p.zones.includes(delivery.zone))
            .sort((a, b) => (loadMap[a.userId] ?? 0) - (loadMap[b.userId] ?? 0));

          if (eligible.length === 0) continue;

          const selected = eligible[0];
          delivery.assignedTo = selected.userId;
          delivery.assignedAt = now;
          delivery.status = 'pending';
          delivery.updatedAt = now;

          loadMap[selected.userId] = (loadMap[selected.userId] ?? 0) + 1;

          state.notifications.unshift({
            id: `notif_${Date.now()}_${delivery.id}`,
            type: 'delivery_assigned',
            deliveryId: delivery.id,
            personnelId: selected.userId,
            title: 'Auto assignment completed',
            message: `${delivery.referenceNo} auto-assigned to ${selected.displayName}.`,
            createdAt: now,
            isRead: false,
          });
        }

        state.deliveryPersonnel = state.deliveryPersonnel.map(person => ({
          ...person,
          currentLoad: loadMap[person.userId] ?? 0,
        }));
      },
    ),

    updateDeliveryStatus: create.reducer(
      (state, action: PayloadAction<{ deliveryId: string; status: DeliveryRecord['status']; note?: string }>) => {
        const target = state.deliveries.find(d => d.id === action.payload.deliveryId);
        if (!target) return;

        target.status = action.payload.status;
        target.notes = action.payload.note ?? target.notes;
        target.updatedAt = new Date().toISOString();

        if (action.payload.status === 'picked_up') target.pickedUpAt = target.updatedAt;
        if (action.payload.status === 'in_transit') target.inTransitAt = target.updatedAt;
        if (action.payload.status === 'arrived') target.arrivedAt = target.updatedAt;
        if (action.payload.status === 'delivered') target.deliveredAt = target.updatedAt;

        if (!target.statusHistory) target.statusHistory = [];
        target.statusHistory.push({
          status: action.payload.status,
          timestamp: target.updatedAt,
          note: action.payload.note,
        } as StatusHistoryEntry);

        state.notifications.unshift({
          id: `notif_${Date.now()}_${target.id}`,
          type: 'delivery_status',
          deliveryId: target.id,
          personnelId: target.assignedTo,
          title: `Delivery ${action.payload.status.replace('_', ' ')}`,
          message: `${target.referenceNo} moved to ${action.payload.status}.`,
          createdAt: target.updatedAt,
          isRead: false,
        });
      },
    ),

    markNotificationRead: create.reducer((state, action: PayloadAction<string>) => {
      const n = state.notifications.find(item => item.id === action.payload);
      if (n) n.isRead = true;
    }),

    // Reassign and cancel were local-only reducers: they mutated state, the
    // screen alerted "successfully", and nothing was ever sent to the server —
    // the next fetchDeliveries() silently undid both. Cancel was the worse of
    // the two, because the backend restocks and reverses Goods in Transit on
    // cancel; never calling it left the dispatched units off the shelf and
    // their value parked in 1250 indefinitely.
    /**
     * Discard a delivery that was created but never dispatched.
     *
     * Calls the server FIRST and only mutates state once it confirms — see the
     * note above about reassign/cancel once being local-only reducers that
     * reported success while the next fetch silently undid them. The server
     * refuses with DELIVERY_COMMITTED if stock has already moved; that message
     * is surfaced to the caller rather than swallowed.
     */
    deleteDelivery: create.asyncThunk(
      async (deliveryId: string) => {
        await deleteDeliveryAPI(deliveryId);
        return deliveryId;
      },
      {
        fulfilled: (state, action) => {
          state.deliveries = state.deliveries.filter(d => d.id !== action.payload);
        },
      },
    ),

    reassignDelivery: create.asyncThunk(
      async (payload: { deliveryId: string; personnelId: string; overrideReason?: string }, thunkAPI) => {
        // The assign endpoint handles reassignment of an already-assigned
        // delivery (it sets personnelId unconditionally, does not re-commit
        // stock) and notifies the new rider, which a bare PATCH does not.
        try {
          await assignDeliveriesAPI(
            { deliveryIds: [payload.deliveryId], personnelId: payload.personnelId },
            payload.overrideReason,
          );
        } catch (e: any) {
          return thunkAPI.rejectWithValue({ message: e?.message, code: e?.code, details: e?.details });
        }
        return payload;
      },
      {
        fulfilled: (state, action) => {
          const delivery = state.deliveries.find(d => d.id === action.payload.deliveryId);
          if (!delivery) return;
          const now = new Date().toISOString();
          const person = state.deliveryPersonnel.find(
            p => p.userId === action.payload.personnelId,
          );
          delivery.assignedTo = action.payload.personnelId;
          delivery.assignedAt = now;
          // The status is NOT forced to 'pending' here. The server only moves
          // an unassigned/pending delivery, and rewinding one that is already
          // in transit is exactly the transition its state machine rejects.
          delivery.updatedAt = now;
          if (!delivery.statusHistory) delivery.statusHistory = [];
          delivery.statusHistory.push({
            status: delivery.status,
            timestamp: now,
            note: `Reassigned to ${person?.displayName ?? action.payload.personnelId}`,
            updatedBy: 'admin',
          } as StatusHistoryEntry);
          const loadMap = buildLoadMap(state.deliveries);
          state.deliveryPersonnel = state.deliveryPersonnel.map(p => ({
            ...p,
            currentLoad: loadMap[p.userId] ?? 0,
          }));
        },
      },
    ),

    cancelDelivery: create.asyncThunk(
      async (payload: { deliveryId: string; reason?: string }) => {
        // 'cancelled', not 'failed' — they are distinct states in the backend
        // enum, and the server records the reason as cancelReason, writes the
        // status-history row, and fires the restock + ledger reversal.
        await updateDeliveryStatusAPI(payload.deliveryId, {
          status: 'cancelled',
          notes: payload.reason ?? 'Cancelled by admin',
        });
        return payload;
      },
      {
        fulfilled: (state, action) => {
          const delivery = state.deliveries.find(d => d.id === action.payload.deliveryId);
          if (!delivery) return;
          const now = new Date().toISOString();
          delivery.status = 'cancelled';
          delivery.notes = action.payload.reason ?? 'Cancelled by admin';
          delivery.updatedAt = now;
          if (!delivery.statusHistory) delivery.statusHistory = [];
          delivery.statusHistory.push({
            status: 'cancelled',
            timestamp: now,
            note: action.payload.reason ?? 'Cancelled by admin',
            updatedBy: 'admin',
          } as StatusHistoryEntry);
          const loadMap = buildLoadMap(state.deliveries);
          state.deliveryPersonnel = state.deliveryPersonnel.map(p => ({
            ...p,
            currentLoad: loadMap[p.userId] ?? 0,
          }));
        },
      },
    ),

    /**
     * Persist the captured bill-photo URI + capture timestamp on the
     * canonical delivery record. Called via cross-slice dispatch from
     * dpBillPhotoCaptureSlice once the photo upload pipeline succeeds.
     */
    attachBillPhotoToDelivery: create.reducer(
      (
        state,
        action: PayloadAction<{
          deliveryId: string;
          billPhotoUri: string;
          billPhotoCapturedAt: string;
          signedBy: string;
        }>,
      ) => {
        const delivery = state.deliveries.find(d => d.id === action.payload.deliveryId);
        if (!delivery) return;
        const now = new Date().toISOString();
        delivery.billPhotoUri = action.payload.billPhotoUri;
        delivery.billPhotoCapturedAt = action.payload.billPhotoCapturedAt;
        delivery.billSignedBy = action.payload.signedBy;
        delivery.updatedAt = now;
        if (!delivery.statusHistory) delivery.statusHistory = [];
        delivery.statusHistory.push({
          status: delivery.status,
          timestamp: now,
          note: `Bill photo captured (signed by ${action.payload.signedBy})`,
          updatedBy: 'delivery_personnel',
        } as StatusHistoryEntry);
      },
    ),

    saveDeliverySignature: create.reducer(
      (state, action: PayloadAction<{ deliveryId: string; signatureBase64: string; signedBy: string }>) => {
        const delivery = state.deliveries.find(d => d.id === action.payload.deliveryId);
        if (!delivery) return;
        delivery.signatureBase64 = action.payload.signatureBase64;
        delivery.signature = `Signed by: ${action.payload.signedBy}`;
        delivery.updatedAt = new Date().toISOString();
      },
    ),

    confirmCustomerReceipt: create.reducer(
      (state, action: PayloadAction<{ deliveryId: string; verifiedBy: string }>) => {
        const delivery = state.deliveries.find(d => d.id === action.payload.deliveryId);
        if (!delivery) return;
        const now = new Date().toISOString();
        delivery.customerVerified = true;
        delivery.deliveredAt = now;
        delivery.status = 'delivered';
        delivery.updatedAt = now;
        if (!delivery.statusHistory) delivery.statusHistory = [];
        delivery.statusHistory.push({
          status: 'delivered',
          timestamp: now,
          note: `Customer confirmed receipt (${action.payload.verifiedBy})`,
          updatedBy: 'customer',
        } as StatusHistoryEntry);

        const loadMap = buildLoadMap(state.deliveries);
        state.deliveryPersonnel = state.deliveryPersonnel.map(p => ({
          ...p,
          currentLoad: loadMap[p.userId] ?? 0,
        }));
      },
    ),

    reportDeliveryIssue: create.reducer(
      (state, action: PayloadAction<{ deliveryId: string; note: string }>) => {
        const delivery = state.deliveries.find(d => d.id === action.payload.deliveryId);
        if (!delivery) return;
        const now = new Date().toISOString();
        delivery.status = 'arrived';
        delivery.issueNote = action.payload.note;
        delivery.notes = action.payload.note;
        delivery.updatedAt = now;
        if (!delivery.statusHistory) delivery.statusHistory = [];
        delivery.statusHistory.push({
          status: 'arrived',
          timestamp: now,
          note: `Issue reported by customer: ${action.payload.note}`,
          updatedBy: 'customer',
        } as StatusHistoryEntry);
      },
    ),

    submitShadowInventoryUpdateForDelivery: create.reducer(
      (state, action: PayloadAction<{ deliveryId: string; personnelId: string }>) => {
        const delivery = state.deliveries.find(d => d.id === action.payload.deliveryId);
        if (!delivery) return;
        const firstItem = delivery.items[0];
        if (!firstItem) return;
        const now = new Date().toISOString();
        state.inventoryUpdateRequests.unshift({
          id: `inv_req_${Date.now()}_${delivery.id}`,
          personnelId: action.payload.personnelId,
          itemId: firstItem.itemId,
          itemName: firstItem.itemName,
          requestedQty: Math.max(1, firstItem.quantity),
          reason: `Auto update after completed delivery ${delivery.referenceNo}`,
          status: 'pending',
          createdAt: now,
        });
      },
    ),

    /** Deduct items from shadow inventory when personnel submits for admin review */
    deductShadowInventory: create.reducer(
      (state, action: PayloadAction<{ personnelId: string; changes: Array<{ itemId: string; itemName: string; deliveredQty: number; returnedQty: number }> }>) => {
        const now = new Date().toISOString();
        action.payload.changes.forEach(change => {
          const idx = state.shadowInventory.findIndex(
            si => si.personnelId === action.payload.personnelId && si.itemId === change.itemId,
          );
          if (idx !== -1) {
            // Preserve originalQty before first deduction
            if (state.shadowInventory[idx].syncStatus === 'synced') {
              state.shadowInventory[idx].originalQty = state.shadowInventory[idx].quantity;
            }
            state.shadowInventory[idx].quantity = Math.max(
              0,
              state.shadowInventory[idx].quantity - change.deliveredQty + change.returnedQty,
            );
            state.shadowInventory[idx].syncStatus = 'pending';
            state.shadowInventory[idx].updatedAt = now;
          } else {
            const netDeducted = change.deliveredQty - change.returnedQty;
            state.shadowInventory.push({
              personnelId: action.payload.personnelId,
              itemId: change.itemId,
              itemName: change.itemName,
              quantity: Math.max(0, change.deliveredQty - netDeducted),
              originalQty: change.deliveredQty,
              syncStatus: 'pending',
              updatedAt: now,
            });
          }
        });
      },
    ),

    /** Remove shadow entries for a personnel after admin approval syncs to actual inventory */
    clearShadowInventoryForRequest: create.reducer(
      (state, action: PayloadAction<{ personnelId: string; itemIds: string[] }>) => {
        state.shadowInventory = state.shadowInventory.filter(
          si => !(si.personnelId === action.payload.personnelId && action.payload.itemIds.includes(si.itemId)),
        );
      },
    ),

    // ── Async thunks (GL pipeline: network → serializer → state) ──
    /** Fetch latest deliveries from the API and refresh state. */
    fetchDeliveries: create.asyncThunk(
      async () => {
        const response = await getDeliveriesAPI();
        return response;
      },
      {
        fulfilled: (state, action: PayloadAction<any>) => {
          const serialized = deliveryListSerializer(action.payload);
          state.deliveries = serialized.deliveries;
        },
      },
    ),
    /** Fetch latest delivery personnel from the API and refresh state. */
    fetchDeliveryPersonnel: create.asyncThunk(
      async () => {
        const response = await getDeliveryPersonnelAPI();
        return response;
      },
      {
        fulfilled: (state, action: PayloadAction<any>) => {
          const serialized = personnelListSerializer(action.payload);
          state.deliveryPersonnel = serialized.personnel;
        },
      },
    ),
    /** Fetch shadow inventory from the API */
    fetchShadowInventory: create.asyncThunk(
      async () => {
        const response = await getShadowInventoryAPI();
        return response;
      },
      {
        fulfilled: (state, action: PayloadAction<any>) => {
          const raw = action.payload?.data ?? action.payload;
          if (Array.isArray(raw)) {
            state.shadowInventory = raw.map((item: any) => ({
              personnelId: item.personnelId ?? item.personnel_id ?? '',
              itemId: item.itemId ?? item.item_id ?? '',
              itemName: item.itemName ?? item.item_name ?? '',
              quantity: parseFloat(item.currentQty ?? item.quantity) || 0,
              originalQty: parseFloat(item.originalQty) || parseFloat(item.currentQty ?? item.quantity) || 0,
              syncStatus: item.syncStatus ?? 'synced',
              updatedAt: item.updatedAt ?? item.updated_at ?? new Date().toISOString(),
            }));
          }
        },
      },
    ),
  }),

  selectors: {
    selectDeliveries: state => state.deliveries,
    selectDeliveryPersonnel: state => state.deliveryPersonnel,
    selectShadowInventory: state => state.shadowInventory,
    selectInventoryUpdateRequests: state => state.inventoryUpdateRequests,
    selectDeliveryNotifications: state => state.notifications,
    // ── Memoized selectors ───────────────────────────
    // These derive new references (array/object) so they must be
    // memoized, otherwise every unrelated state update causes a
    // new reference and triggers needless re-renders.
    selectUnassignedDeliveries: createSelector(
      [(state: DeliverySliceState) => state.deliveries],
      deliveries => deliveries.filter(d => d.status === 'unassigned'),
    ),
    selectDeliverySummary: createSelector(
      [(state: DeliverySliceState) => state.deliveries],
      deliveries => {
        const total = deliveries.length;
        let pending = 0;
        let inTransit = 0;
        let delivered = 0;
        let failed = 0;
        let returned = 0;
        let unassigned = 0;
        let cancelled = 0;
        for (const d of deliveries) {
          switch (d.status) {
            case 'pending': pending++; break;
            case 'in_transit': inTransit++; break;
            case 'delivered': delivered++; break;
            case 'failed': failed++; break;
            case 'returned': returned++; break;
            case 'unassigned': unassigned++; break;
            case 'cancelled': cancelled++; break;
          }
        }
        return { total, pending, inTransit, delivered, failed, returned, unassigned, cancelled };
      },
    ),
  },
});

export const {
  createDelivery,
  assignSelectedDeliveries,
  autoAssignDeliveries,
  updateDeliveryStatus,
  markNotificationRead,
  reassignDelivery,
  deleteDelivery,
  cancelDelivery,
  attachBillPhotoToDelivery,
  saveDeliverySignature,
  confirmCustomerReceipt,
  reportDeliveryIssue,
  submitShadowInventoryUpdateForDelivery,
  deductShadowInventory,
  clearShadowInventoryForRequest,
  fetchDeliveries,
  fetchDeliveryPersonnel,
  fetchShadowInventory,
} = deliverySlice.actions;

export const {
  selectDeliveries,
  selectDeliveryPersonnel,
  selectShadowInventory,
  selectInventoryUpdateRequests,
  selectDeliveryNotifications,
  selectUnassignedDeliveries,
  selectDeliverySummary,
} = deliverySlice.selectors;
