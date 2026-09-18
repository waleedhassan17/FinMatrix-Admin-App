// ═══════════════════════════════════════════════════════
// FinMatrix — Purchase Order Form Slice (createAppSlice)
// ═══════════════════════════════════════════════════════
// Owns form state, line items, auto-totals, AND the save
// thunk that posts via the network + serializer pipeline.
// Mirrors `billFormSlice.ts`.

import type { PayloadAction } from '@reduxjs/toolkit';
import { toIsoDate } from '../../../models/reportModel';
import { createAppSlice } from '@store/createAppSlice';
import type { PurchaseOrder, PurchaseOrderStatus } from '../../../types';
import {
  createPurchaseOrderAPI,
  updatePurchaseOrderAPI,
  updatePOStatusAPI,
  getPurchaseOrderByIdAPI,
} from '../../../networks/purchases/purchaseOrderNetwork';
import type { PurchaseOrderWritePayload } from '../../../networks/purchases/purchaseOrderNetwork';
import { purchaseOrderSingleSerializer } from '../../../serializers/purchaseOrderSerializer';

// ── Line item (form representation — string values for inputs) ──
export interface POFormLine {
  id: string;
  itemId: string;
  itemName: string;
  description: string;
  quantity: string;
  unitPrice: string;
  /** Purchase tax %, typed — whatever the supplier charged. */
  taxRate: string;
  /** Excluding tax. */
  amount: number;
}

export interface POFormSliceState {
  poNumber: string;
  vendorId: string;
  vendorName: string;
  orderDate: string;
  expectedDate: string;
  notes: string;
  lines: POFormLine[];
  subtotal: number;
  taxAmount: number;
  total: number;
  errors: Record<string, string>;
  isSaving: boolean;
  saveError: string;
  isEditMode: boolean;
  editingId: string;
}

let nextLineId = 1;
const freshLine = (): POFormLine => ({
  id: `pofl_${nextLineId++}_${Date.now()}`,
  itemId: '',
  itemName: '',
  description: '',
  quantity: '',
  unitPrice: '',
  taxRate: '0',
  amount: 0,
});

const initialState: POFormSliceState = {
  poNumber: '',
  vendorId: '',
  vendorName: '',
  // Fresh at every open, not once at bundle startup.
  //
  // This was seeded in initialState, which is evaluated a single time when the
  // store imports the slice. On an app left running for days the form then
  // opened pre-filled with the launch date and posted it as the ACCOUNTING
  // date — a wrong date written into the books, not merely displayed. Local
  // calendar date too: toISOString() is UTC and reads yesterday in PKT before
  // 05:00.
  orderDate: toIsoDate(new Date()),
  expectedDate: '',
  notes: '',
  lines: [freshLine()],
  subtotal: 0,
  taxAmount: 0,
  total: 0,
  errors: {},
  isSaving: false,
  saveError: '',
  isEditMode: false,
  editingId: '',
};

function recalc(state: POFormSliceState) {
  let sub = 0;
  let tax = 0;
  state.lines.forEach(l => {
    const qty = parseFloat(l.quantity) || 0;
    const price = parseFloat(l.unitPrice) || 0;
    l.amount = Math.round(qty * price * 100) / 100;
    sub += l.amount;
    tax += Math.round(l.amount * (parseFloat(l.taxRate) || 0)) / 100;
  });
  // Tax was hard-coded to 0 here and never sent, so a PO saved from the app
  // carried no tax and editing a web-created draft silently stripped it.
  state.subtotal = Math.round(sub * 100) / 100;
  state.taxAmount = Math.round(tax * 100) / 100;
  state.total = Math.round((state.subtotal + state.taxAmount) * 100) / 100;
}

// Save payload builder.
// Only what CreatePurchaseOrderDto accepts. Everything the form used to send
// besides this — companyId, poNumber, vendorName, status, the totals,
// createdBy, and per-line id/itemName/amount — is computed or assigned
// server-side and was silently whitelisted away, while the two fields the DTO
// actually requires (orderedQty, unitCost) were never sent at all.
//
// Optional keys are OMITTED, not blanked: @IsOptional() skips only
// null/undefined, so '' still gets validated and fails @IsDateString/@IsUUID.
const buildSavePayload = (state: POFormSliceState): PurchaseOrderWritePayload => ({
  vendorId: state.vendorId,
  orderDate: state.orderDate,
  expectedDate: state.expectedDate || undefined,
  notes: state.notes.trim() || undefined,
  lines: state.lines
    .filter(l => l.itemId && parseFloat(l.quantity) > 0)
    .map(l => ({
      // Becomes the bill line description on convert-to-bill, so it must
      // never be empty.
      description: l.description.trim() || l.itemName || 'Item',
      orderedQty: String(parseFloat(l.quantity) || 0),
      unitCost: String(parseFloat(l.unitPrice) || 0),
      taxRate: String(parseFloat(l.taxRate) || 0),
      lineKind: 'item' as const,
      ...(l.itemId ? { itemId: l.itemId } : {}),
    })),
});

export const poFormSlice = createAppSlice({
  name: 'poForm',
  initialState,
  reducers: create => ({
    setField: create.reducer(
      (state, action: PayloadAction<{ key: keyof POFormSliceState; value: any }>) => {
        (state as any)[action.payload.key] = action.payload.value;
        if (state.errors[action.payload.key]) {
          const { [action.payload.key]: _omit, ...rest } = state.errors;
          state.errors = rest;
        }
      },
    ),
    setVendor: create.reducer(
      (state, action: PayloadAction<{ id: string; name: string }>) => {
        state.vendorId = action.payload.id;
        state.vendorName = action.payload.name;
        if (state.errors.vendorId) {
          const { vendorId: _omit, ...rest } = state.errors;
          state.errors = rest;
        }
      },
    ),
    setErrors: create.reducer((state, action: PayloadAction<Record<string, string>>) => {
      state.errors = action.payload;
    }),
    setIsSaving: create.reducer((state, action: PayloadAction<boolean>) => {
      state.isSaving = action.payload;
    }),

    addLine: create.reducer(state => {
      state.lines.push(freshLine());
    }),
    removeLine: create.reducer((state, action: PayloadAction<string>) => {
      state.lines = state.lines.filter(l => l.id !== action.payload);
      recalc(state);
    }),
    updateLine: create.reducer(
      (state, action: PayloadAction<{ id: string; field: keyof POFormLine; value: string }>) => {
        const line = state.lines.find(l => l.id === action.payload.id);
        if (line) {
          (line as any)[action.payload.field] = action.payload.value;
          recalc(state);
        }
      },
    ),
    setLineItem: create.reducer(
      (state, action: PayloadAction<{
        id: string;
        itemId: string;
        itemName: string;
        description: string;
        unitPrice: string;
      }>) => {
        const line = state.lines.find(l => l.id === action.payload.id);
        if (line) {
          line.itemId = action.payload.itemId;
          line.itemName = action.payload.itemName;
          line.description = action.payload.description;
          line.unitPrice = action.payload.unitPrice;
          recalc(state);
        }
      },
    ),

    /** Pre-populate the form from an existing PO (used by Convert-to-Bill
     *  flow on the Bills side). */
    loadForEdit: create.reducer(
      (state, action: PayloadAction<PurchaseOrder>) => {
        const po = action.payload;
        state.poNumber = po.poNumber;
        state.vendorId = po.vendorId;
        state.vendorName = po.vendorName;
        state.orderDate = po.orderDate.slice(0, 10);
        state.expectedDate = po.expectedDate.slice(0, 10);
        state.notes = po.notes;
        state.lines = po.lines.map(l => ({
          id: l.id,
          itemId: l.itemId,
          itemName: l.itemName,
          description: l.description,
          quantity: String(l.quantity),
          unitPrice: String(l.unitPrice),
          taxRate: String(l.taxRate ?? 0),
          amount: l.amount,
        }));
        state.editingId = po.id;
        state.isEditMode = true;
        state.errors = {};
        recalc(state);
      },
    ),

    /**
     * Load a staff approval request back into the form so the owner can see
     * what they are approving.
     *
     * Inverts buildSavePayload rather than reusing loadForEdit, which takes a
     * serialized PurchaseOrder and would be wrong here three times over: the
     * payload names its quantities orderedQty/unitCost, it carries no line ids
     * (which every updateLine/removeLine targets and React keys on), and its
     * optional keys are OMITTED, so `expectedDate.slice(0, 10)` throws.
     *
     * `isEditMode` and `editingId` are deliberately left alone. An approval
     * request has no purchase order behind it yet, so a save from this state
     * must not become updatePurchaseOrderAPI(undefined, …).
     *
     * Names are passed in, not looked up: the reducer cannot reach the vendor
     * and inventory lists, and the payload only stores ids.
     */
    loadFromRequestPayload: create.reducer(
      (
        state,
        action: PayloadAction<{
          payload: Partial<PurchaseOrderWritePayload>;
          vendorName: string;
          itemNames: Record<string, string>;
        }>,
      ) => {
        const { payload, vendorName, itemNames } = action.payload;
        state.poNumber = '';
        state.vendorId = payload.vendorId ?? '';
        state.vendorName = vendorName;
        state.orderDate = (payload.orderDate ?? '').slice(0, 10);
        state.expectedDate = (payload.expectedDate ?? '').slice(0, 10);
        state.notes = payload.notes ?? '';
        state.lines = (Array.isArray(payload.lines) ? payload.lines : []).map(l => ({
          ...freshLine(),
          itemId: l?.itemId ?? '',
          itemName: (l?.itemId && itemNames[l.itemId]) || '',
          description: l?.description ?? '',
          quantity: String(parseFloat(String(l?.orderedQty ?? '')) || 0),
          unitPrice: String(parseFloat(String(l?.unitCost ?? '')) || 0),
          taxRate: String(parseFloat(String(l?.taxRate ?? '')) || 0),
        }));
        // A request with no usable lines cannot be reviewed meaningfully; the
        // screen checks for this and refuses rather than showing a blank form.
        if (state.lines.length === 0) state.lines = [freshLine()];
        state.errors = {};
        recalc(state);
      },
    ),

    resetForm: create.reducer(state => {
      Object.assign(state, { ...initialState, lines: [freshLine()] });
    }),

    // ── Async thunks ────────────────────────────────

    /** Save (create or update) the purchase order.
     *
     *  The API always creates a PO as 'draft' and has no status field on the
     *  create DTO, so "Save & Send" is unavoidably two calls. The second one
     *  is allowed to fail on its own: the PO exists either way, and reporting
     *  a failure for a document that was created would be worse than telling
     *  the user it is still a draft. */
    savePurchaseOrder: create.asyncThunk(
      async (saveStatus: PurchaseOrderStatus, thunkAPI) => {
        const f = (thunkAPI.getState() as { poForm: POFormSliceState }).poForm;
        const payload = buildSavePayload(f);
        const envelope = f.isEditMode && f.editingId
          ? await updatePurchaseOrderAPI(f.editingId, payload)
          : await createPurchaseOrderAPI(payload);

        // Staff get an approval request back, not a purchase order. It has to
        // be read off the raw envelope: mapPO() builds a fixed PurchaseOrder
        // shape with no `pending` key, so serializing first drops the flag and
        // flattens the request into a PO with a blank id — which then sent the
        // status PATCH below to /purchase-orders//status and had the screen
        // announce a PO that was never created.
        //
        // Both positions are checked, matching the three sibling approval
        // forms (CreditMemoFormScreen, PayBillsScreen, GeneralJournalFormScreen).
        // `(envelope?.data ?? envelope)?.pending` is NOT the same test: ?? picks
        // whichever of the two is merely present, so an envelope shaped
        // { pending: true, data: {...} } resolves to data, reads undefined, and
        // falls straight back into the bug this guard exists to stop.
        if (envelope?.data?.pending ?? envelope?.pending) {
          return { po: null, pending: true, sendFailed: false };
        }

        const po = purchaseOrderSingleSerializer(envelope);

        if (po && saveStatus === 'sent' && po.status !== 'sent') {
          try {
            const sent = purchaseOrderSingleSerializer(await updatePOStatusAPI(po.id, 'sent'));
            return { po: sent ?? po, pending: false, sendFailed: false };
          } catch {
            return { po, pending: false, sendFailed: true };
          }
        }
        return { po, pending: false, sendFailed: false };
      },
      {
        pending: state => { state.isSaving = true; state.saveError = ''; },
        fulfilled: (
          state,
          action: PayloadAction<{ po: PurchaseOrder | null; pending: boolean; sendFailed: boolean }>,
        ) => {
          state.isSaving = false;
          // Nothing to edit on the pending path — no PO exists until the owner
          // approves, so leaving the form in edit mode would point a later save
          // at an id that was never issued.
          if (action.payload.po && !action.payload.pending) {
            state.editingId = action.payload.po.id;
            state.isEditMode = true;
          }
        },
        rejected: (state, action) => {
          state.isSaving = false;
          state.saveError = action.error?.message ?? 'Failed to save purchase order';
        },
      },
    ),

    /** Loads an existing PO into the form for editing — survives deep-links
     *  (no need for the list slice to be hydrated). */
    fetchPOForEdit: create.asyncThunk(
      async (id: string) => getPurchaseOrderByIdAPI(id),
      {
        fulfilled: (state, action: PayloadAction<any>) => {
          const po = purchaseOrderSingleSerializer(action.payload);
          if (!po) return;
          state.isEditMode = true;
          state.editingId = po.id;
          state.poNumber = po.poNumber;
          state.vendorId = po.vendorId;
          state.vendorName = po.vendorName;
          state.orderDate = po.orderDate.slice(0, 10);
          state.expectedDate = po.expectedDate.slice(0, 10);
          state.notes = po.notes;
          state.lines = po.lines.map(l => ({
            id: l.id,
            itemId: l.itemId,
            itemName: l.itemName,
            description: l.description,
            quantity: String(l.quantity),
            unitPrice: String(l.unitPrice),
            taxRate: String(l.taxRate ?? 0),
            amount: l.amount,
          }));
          state.errors = {};
          recalc(state);
        },
      },
    ),
  }),

  selectors: {
    selectPOFormState: s => s,
    selectPOFormLines: s => s.lines,
    selectPOFormErrors: s => s.errors,
    selectPOFormIsSaving: s => s.isSaving,
    selectPOFormIsEditMode: s => s.isEditMode,
  },
});

export const {
  setField,
  setVendor,
  setErrors,
  setIsSaving,
  addLine,
  removeLine,
  updateLine,
  setLineItem,
  loadForEdit,
  loadFromRequestPayload,
  resetForm,
  savePurchaseOrder,
  fetchPOForEdit,
} = poFormSlice.actions;

export const {
  selectPOFormState,
  selectPOFormLines,
  selectPOFormErrors,
  selectPOFormIsSaving,
  selectPOFormIsEditMode,
} = poFormSlice.selectors;
