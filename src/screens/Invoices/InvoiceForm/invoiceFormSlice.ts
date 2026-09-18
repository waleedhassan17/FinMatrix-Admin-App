// ═══════════════════════════════════════════════════════
// FinMatrix — Invoice Form Slice (createAppSlice pattern)
// Manages form state, line items, and auto-calculations.
// ═══════════════════════════════════════════════════════

import type { PayloadAction } from '@reduxjs/toolkit';
import { toIsoDate } from '../../../models/reportModel';
import { createAppSlice } from '@store/createAppSlice';
import type { DiscountType, InvoiceStatus } from '../../../types';
import {
  createInvoiceAPI,
  getInvoiceByIdAPI,
  updateInvoiceAPI,
} from '../../../networks/sales/invoiceNetwork';
import { invoiceSingleSerializer } from '../../../serializers/invoiceSerializer';
import {
  SERVICE_LINE_VALUE,
  kindOfStoredLine,
  salesLineKindPayload,
  type SalesLineKind,
} from '../../../models/salesLineModel';

// ── Line item (form representation — string values for inputs) ──
export interface FormLineItem {
  id: string;
  // Optional inventory item link. When set, the backend posts COGS/Inventory
  // and reduces stock on issue (FinMatrixGuide §3.1).
  itemId: string;
  /** 'item' when linked, 'service' when explicitly a service / charge, ''
   *  until chosen. Inventory companies may not save an unchosen line. */
  lineKind: SalesLineKind | '';
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
}

export interface InvoiceFormSliceState {
  // Header
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  notes: string;

  // Lines
  lines: FormLineItem[];

  // Discount
  discountType: DiscountType;
  discountValue: string;

  // Computed (derived by calculateTotals reducer)
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;

  // Meta
  errors: Record<string, string>;
  isSaving: boolean;
}

let nextLineId = 1;
const freshLine = (): FormLineItem => ({
  id: `line_${nextLineId++}_${Date.now()}`,
  itemId: '',
  lineKind: '',
  description: '',
  quantity: '',
  unitPrice: '',
  taxRate: '0',
});

const initialState: InvoiceFormSliceState = {
  invoiceNumber: '',
  customerId: '',
  customerName: '',
  // Fresh at every open, not once at bundle startup.
  //
  // This was seeded in initialState, which is evaluated a single time when the
  // store imports the slice. On an app left running for days the form then
  // opened pre-filled with the launch date and posted it as the ACCOUNTING
  // date — a wrong date written into the books, not merely displayed. Local
  // calendar date too: toISOString() is UTC and reads yesterday in PKT before
  // 05:00.
  issueDate: toIsoDate(new Date()),
  dueDate: '',
  status: 'draft',
  notes: '',
  lines: [freshLine()],
  discountType: 'none',
  discountValue: '0',
  subtotal: 0,
  taxAmount: 0,
  discountAmount: 0,
  total: 0,
  errors: {},
  isSaving: false,
};

// ── Helper: recalculate totals from current state ───
function recalc(state: InvoiceFormSliceState) {
  let sub = 0;
  let tax = 0;

  state.lines.forEach(l => {
    const qty = parseFloat(l.quantity) || 0;
    const price = parseFloat(l.unitPrice) || 0;
    const rate = parseFloat(l.taxRate) || 0;
    const lineAmt = qty * price;
    sub += lineAmt;
    tax += lineAmt * rate / 100;
  });

  const discVal = parseFloat(state.discountValue) || 0;
  const discAmt = state.discountType === 'percent'
    ? sub * discVal / 100
    : state.discountType === 'amount' ? discVal : 0;

  state.subtotal = Math.round(sub * 100) / 100;
  state.taxAmount = Math.round(tax * 100) / 100;
  state.discountAmount = Math.round(discAmt * 100) / 100;
  state.total = Math.round((sub + tax - discAmt) * 100) / 100;
}

/**
 * Only what CreateInvoiceDto accepts. `invoiceNumber` is deliberately absent:
 * the form generates one for display, the server assigns the real one and
 * ignores anything sent, so shipping it would promise a number that changes.
 *
 * Moved here from the screen when saving became a thunk — the request body is
 * also what an approval stores and replays, so it belongs beside the state it
 * is built from.
 */
const buildSavePayload = (
  state: InvoiceFormSliceState,
  status: InvoiceStatus,
  inventoryEnabled = true,
) => ({
  customerId: state.customerId,
  invoiceDate: state.issueDate,
  dueDate: state.dueDate,
  status,
  discountType: state.discountType,
  discountValue: state.discountValue || '0',
  lines: state.lines.map(l => ({
    description: l.description,
    quantity: l.quantity || '0',
    unitPrice: l.unitPrice || '0',
    taxRate: l.taxRate || '0',
    // itemId only when linked (an empty string fails @IsUUID); a line
    // without one says it is a service / charge.
    ...salesLineKindPayload(l, inventoryEnabled),
  })),
  notes: state.notes,
});

export const invoiceFormSlice = createAppSlice({
  name: 'invoiceForm',
  initialState,
  reducers: create => ({
    // ── Header fields ─────────────────────────────
    setField: create.reducer(
      (state, action: PayloadAction<{ key: keyof InvoiceFormSliceState; value: any }>) => {
        (state as any)[action.payload.key] = action.payload.value;
        if (state.errors[action.payload.key]) {
          const { [action.payload.key]: _, ...rest } = state.errors;
          state.errors = rest;
        }
      },
    ),
    setCustomer: create.reducer(
      (state, action: PayloadAction<{ id: string; name: string }>) => {
        state.customerId = action.payload.id;
        state.customerName = action.payload.name;
        if (state.errors.customerId) {
          const { customerId: _, ...rest } = state.errors;
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

    // ── Line item mutations ───────────────────────
    addLine: create.reducer(state => {
      state.lines.push(freshLine());
    }),
    removeLine: create.reducer((state, action: PayloadAction<string>) => {
      state.lines = state.lines.filter(l => l.id !== action.payload);
      recalc(state);
    }),
    updateLine: create.reducer(
      (state, action: PayloadAction<{ id: string; field: keyof FormLineItem; value: string }>) => {
        const line = state.lines.find(l => l.id === action.payload.id);
        if (line) {
          (line as any)[action.payload.field] = action.payload.value;
          recalc(state);
        }
      },
    ),
    // Link a line to an inventory item: stamps itemId and auto-fills the
    // description + unit price from the item (both still editable after).
    setLineItem: create.reducer(
      (
        state,
        action: PayloadAction<{
          id: string;
          itemId: string;
          description?: string;
          unitPrice?: string;
        }>,
      ) => {
        const line = state.lines.find(l => l.id === action.payload.id);
        if (line && action.payload.itemId === SERVICE_LINE_VALUE) {
          // A service keeps whatever the user typed.
          line.itemId = '';
          line.lineKind = 'service';
          return;
        }
        if (line) {
          line.itemId = action.payload.itemId;
          line.lineKind = action.payload.itemId ? 'item' : '';
          if (action.payload.description) line.description = action.payload.description;
          if (action.payload.unitPrice !== undefined) line.unitPrice = action.payload.unitPrice;
          recalc(state);
        }
      },
    ),

    // ── Totals ────────────────────────────────────
    calculateTotals: create.reducer(state => {
      recalc(state);
    }),

    /**
     * Load an invoice for editing from the API, by id.
     *
     * The screen used to hydrate by finding the invoice in the LIST slice.
     * List rows come through `invoiceListSerializer`, which maps lines as
     * `Array.isArray(raw.lines) ? … : []` — so when the list endpoint returns
     * summary rows, every row carries `lines: []`. The header fields exist on
     * a list row and filled in correctly, the lines did not and came through
     * empty, and saving from that form would have written the invoice back
     * with no items at all.
     *
     * It also meant editing was only possible after the list had loaded, which
     * is not true of every route that reaches this screen.
     *
     * Same shape as `fetchBillForEdit` and `fetchPOForEdit`; this form was the
     * only one of the three still reading from a list.
     */
    fetchInvoiceForEdit: create.asyncThunk(
      async (id: string) => getInvoiceByIdAPI(id),
      {
        fulfilled: (state, action: PayloadAction<unknown>) => {
          const inv = invoiceSingleSerializer(action.payload);
          if (!inv) return;
          state.invoiceNumber = inv.invoiceNumber;
          state.customerId = inv.customerId;
          state.customerName = inv.customerName;
          state.issueDate = inv.issueDate.slice(0, 10);
          state.dueDate = inv.dueDate.slice(0, 10);
          state.status = inv.status;
          state.notes = inv.notes;
          state.lines = inv.lines.map(l => ({
            id: l.id,
            itemId: l.itemId ?? '',
            lineKind: kindOfStoredLine(l.itemId),
            description: l.description,
            quantity: String(l.quantity),
            unitPrice: String(l.unitPrice),
            taxRate: String(l.taxRate),
          }));
          state.discountType = inv.discountType;
          state.discountValue = String(inv.discountValue);
          state.errors = {};
          state.isSaving = false;
          recalc(state);
        },
      },
    ),

    /**
     * Save (create or update) the invoice.
     *
     * The payload used to be assembled in the screen and the response thrown
     * away. That was survivable while every role posted directly; it is not now
     * that a staff member's invoice comes back as an approval request instead,
     * because there was nowhere to notice.
     */
    saveInvoice: create.asyncThunk(
      async (
        {
          status,
          editingId,
          inventoryEnabled = true,
          overrideReason,
        }: {
          status: InvoiceStatus;
          editingId?: string;
          inventoryEnabled?: boolean;
          /** Owner only: past the customer's credit limit, with a reason. */
          overrideReason?: string;
        },
        thunkAPI,
      ) => {
        const f = (thunkAPI.getState() as { invoiceForm: InvoiceFormSliceState })
          .invoiceForm;
        const payload = buildSavePayload(f, status, inventoryEnabled);

        let envelope: any;
        try {
          envelope = editingId
            ? await updateInvoiceAPI(editingId, payload as any)
            : overrideReason
              ? await createInvoiceAPI(payload as any, overrideReason)
              : await createInvoiceAPI(payload as any);
        } catch (e: any) {
          // rejectWithValue, not a rethrow: RTK keeps only name/message/code of
          // a thrown error, and the credit-limit refusal needs its breakdown.
          return thunkAPI.rejectWithValue({
            message: e?.message ?? 'Failed to save invoice',
            code: e?.code,
            details: e?.details,
          });
        }

        // Staff get an approval request back, not an invoice. Read off the raw
        // envelope, and check BOTH positions — `(envelope?.data ?? envelope)?.pending`
        // reads as equivalent and is not: ?? picks whichever operand is merely
        // present, so a truthy `data` wins and its missing `.pending` is
        // undefined. That exact grouping shipped a bug on the PO form once.
        if (envelope?.data?.pending ?? envelope?.pending) {
          return { invoice: null, pending: true };
        }
        return { invoice: envelope?.data ?? envelope ?? null, pending: false };
      },
      {
        pending: state => { state.isSaving = true; },
        fulfilled: state => { state.isSaving = false; },
        rejected: state => { state.isSaving = false; },
      },
    ),

    /**
     * Load a staff approval request back into the form so the owner can see
     * what they are approving.
     *
     * Inverts buildSavePayload. Line ids are minted fresh — the payload has
     * none, and every updateLine/removeLine targets one, which is also the
     * React key. Optional keys are OMITTED by the builder rather than blanked,
     * so nothing here may assume a field is present.
     *
     * The customer name is passed in: the payload stores an id, and a review
     * screen showing a bare uuid where the customer should be is not a review.
     */
    loadFromRequestPayload: create.reducer(
      (
        state,
        action: PayloadAction<{
          payload: Record<string, any>;
          customerName: string;
        }>,
      ) => {
        const { payload, customerName } = action.payload;
        state.invoiceNumber = '';
        state.customerId = payload.customerId ?? '';
        state.customerName = customerName;
        state.issueDate = String(payload.invoiceDate ?? '').slice(0, 10);
        state.dueDate = String(payload.dueDate ?? '').slice(0, 10);
        state.status = (payload.status as InvoiceStatus) ?? 'draft';
        state.notes = payload.notes ?? '';
        state.discountType = (payload.discountType as DiscountType) ?? 'percent';
        state.discountValue = String(payload.discountValue ?? '0');
        const lines = Array.isArray(payload.lines) ? payload.lines : [];
        state.lines = lines.map((l: any) => ({
          ...freshLine(),
          itemId: l?.itemId ?? '',
          lineKind:
            l?.lineKind === 'item' || l?.lineKind === 'service'
              ? l.lineKind
              : kindOfStoredLine(l?.itemId),
          description: l?.description ?? '',
          quantity: String(l?.quantity ?? '0'),
          unitPrice: String(l?.unitPrice ?? '0'),
          taxRate: String(l?.taxRate ?? '0'),
        }));
        // Every render indexes lines[0]; the screen refuses a request with no
        // lines, but the reducer must not hand the form an empty array either.
        if (state.lines.length === 0) state.lines = [freshLine()];
        state.errors = {};
        recalc(state);
      },
    ),

    resetInvoiceForm: create.reducer(state => {
      Object.assign(state, { ...initialState, lines: [freshLine()] });
    }),
  }),

  selectors: {
    selectInvoiceFormState: state => state,
    selectInvoiceFormLines: state => state.lines,
    selectInvoiceFormErrors: state => state.errors,
    selectInvoiceFormIsSaving: state => state.isSaving,
  },
});

export const {
  setField,
  setCustomer,
  setErrors,
  setIsSaving,
  addLine,
  removeLine,
  updateLine,
  setLineItem,
  calculateTotals,
  fetchInvoiceForEdit,
  saveInvoice,
  loadFromRequestPayload,
  resetInvoiceForm,
} = invoiceFormSlice.actions;

export const {
  selectInvoiceFormState,
  selectInvoiceFormLines,
  selectInvoiceFormErrors,
  selectInvoiceFormIsSaving,
} = invoiceFormSlice.selectors;
