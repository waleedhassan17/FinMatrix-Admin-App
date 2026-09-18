// ═══════════════════════════════════════════════════════
// FinMatrix — Receive Payment Slice (createAppSlice pattern)
// Manages the form state for the "Receive Customer Payment"
// flow: customer, date, method, reference, amount,
// outstanding-invoice allocations, and overpayment-as-credit
// behaviour. Also exposes the `savePayment` thunk that talks
// to the backend.
// ═══════════════════════════════════════════════════════

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { Invoice, PaymentMethod } from '../../../types';
import { getInvoicesAPI } from '../../../networks/sales/invoiceNetwork';
import { createPaymentAPI } from '../../../networks/sales/paymentNetwork';
import { invoiceListSerializer } from '../../../serializers/invoiceSerializer';
import { toUiPaymentMethod } from '../../../serializers/paymentSerializer';
import { toIsoDate } from '../../../models/reportModel';

/**
 * The UI's payment-method vocabulary differs from the backend's. Map the
 * client values onto the values accepted by the API's ReceivePaymentDto
 * (`cash | check | bank_transfer | credit_card | other`).
 */
function toBackendPaymentMethod(method: PaymentMethod): string {
  switch (method) {
    case 'cheque':
      return 'check';
    case 'online':
      return 'other';
    case 'cash':
    case 'bank_transfer':
      return method;
    default:
      return 'other';
  }
}

// ── Outstanding invoice row (used in the allocations table) ────
export interface OutstandingRow {
  invoiceId: string;
  invoiceNumber: string;
  dueDate: string;
  total: number;
  amountPaid: number;
  balance: number;
  allocated: number;
  checked: boolean;
}

export interface ReceivePaymentSliceState {
  customerId: string;
  customerName: string;
  paymentDate: string;
  method: PaymentMethod;
  reference: string;
  amount: string;
  notes: string;
  /** When true, money not applied to an invoice is held as a customer
   *  advance (Customer Advances, a liability) to apply later. When false,
   *  the user is blocked from saving until the allocations match. */
  saveOverpaymentAsCredit: boolean;
  outstandingRows: OutstandingRow[];
  allInvoices: Invoice[];
  errors: Record<string, string>;
  isSaving: boolean;
  isLoadingInvoices: boolean;
}

const initialState: ReceivePaymentSliceState = {
  customerId: '',
  customerName: '',
  // Local calendar date: toISOString() is UTC and reads yesterday in PKT
  // before 05:00. Refreshed again on reset, since initialState is evaluated
  // once at bundle load.
  paymentDate: toIsoDate(new Date()),
  method: 'bank_transfer',
  reference: '',
  amount: '',
  notes: '',
  saveOverpaymentAsCredit: true,
  outstandingRows: [],
  allInvoices: [],
  errors: {},
  isSaving: false,
  isLoadingInvoices: false,
};

// ── Helper: auto-distribute payment to checked rows (oldest first) ──
function autoDistribute(state: ReceivePaymentSliceState) {
  let remaining = parseFloat(state.amount) || 0;

  // Sort checked rows by due date ascending (oldest first)
  const checkedIds = new Set(
    state.outstandingRows.filter(r => r.checked).map(r => r.invoiceId),
  );

  state.outstandingRows.forEach(row => {
    if (checkedIds.has(row.invoiceId) && remaining > 0) {
      const alloc = Math.min(row.balance, remaining);
      row.allocated = Math.round(alloc * 100) / 100;
      remaining = Math.round((remaining - alloc) * 100) / 100;
    } else {
      row.allocated = 0;
    }
  });
}

// ── Helper: rebuild outstanding rows for a customer ─────
function buildOutstandingForCustomer(
  invoices: Invoice[],
  customerId: string,
): OutstandingRow[] {
  return invoices
    .filter(
      inv =>
        inv.customerId === customerId &&
        (inv.status === 'sent' ||
          inv.status === 'overdue' ||
          inv.status === 'partial') &&
        inv.total - inv.amountPaid > 0,
    )
    .sort(
      (a, b) =>
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    )
    .map(inv => ({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      dueDate: inv.dueDate,
      total: inv.total,
      amountPaid: inv.amountPaid,
      balance: Math.round((inv.total - inv.amountPaid) * 100) / 100,
      allocated: 0,
      checked: false,
    }));
}

export const receivePaymentSlice = createAppSlice({
  name: 'receivePayment',
  initialState,
  reducers: create => ({
    setPaymentField: create.reducer(
      (state, action: PayloadAction<{ key: keyof ReceivePaymentSliceState; value: any }>) => {
        (state as any)[action.payload.key] = action.payload.value;
        if (state.errors[action.payload.key]) {
          const { [action.payload.key]: _, ...rest } = state.errors;
          state.errors = rest;
        }
      },
    ),

    setPaymentCustomer: create.reducer(
      (state, action: PayloadAction<{ id: string; name: string }>) => {
        state.customerId = action.payload.id;
        state.customerName = action.payload.name;
        if (state.errors.customerId) {
          const { customerId: _, ...rest } = state.errors;
          state.errors = rest;
        }
        // Rebuild outstanding rows for the selected customer
        state.outstandingRows = buildOutstandingForCustomer(
          state.allInvoices,
          action.payload.id,
        );
      },
    ),

    toggleInvoiceCheck: create.reducer(
      (state, action: PayloadAction<string>) => {
        const row = state.outstandingRows.find(r => r.invoiceId === action.payload);
        if (row) row.checked = !row.checked;
        autoDistribute(state);
      },
    ),

    setAllocatedAmount: create.reducer(
      (state, action: PayloadAction<{ invoiceId: string; amount: number }>) => {
        const row = state.outstandingRows.find(r => r.invoiceId === action.payload.invoiceId);
        if (row) {
          row.allocated = Math.min(action.payload.amount, row.balance);
          row.checked = row.allocated > 0;
        }
      },
    ),

    payInFull: create.reducer(state => {
      const totalOutstanding = state.outstandingRows.reduce((s, r) => s + r.balance, 0);
      state.amount = String(Math.round(totalOutstanding * 100) / 100);
      state.outstandingRows.forEach(r => { r.checked = true; });
      autoDistribute(state);
    }),

    distributeAmount: create.reducer(state => {
      autoDistribute(state);
    }),

    toggleSaveOverpaymentAsCredit: create.reducer(state => {
      state.saveOverpaymentAsCredit = !state.saveOverpaymentAsCredit;
    }),

    setPaymentErrors: create.reducer((state, action: PayloadAction<Record<string, string>>) => {
      state.errors = action.payload;
    }),

    preselectInvoice: create.reducer(
      (state, action: PayloadAction<string>) => {
        const row = state.outstandingRows.find(r => r.invoiceId === action.payload);
        if (row) {
          row.checked = true;
          if (!state.amount || parseFloat(state.amount) === 0) {
            state.amount = String(row.balance);
          }
          autoDistribute(state);
        }
      },
    ),

    /**
     * Load a staff approval request back into the form so the owner can see the
     * figures they are approving. Phase one: everything that does not depend on
     * the invoice list.
     *
     * Inverts what savePayment builds. Two renames to watch — the payload's
     * `memo` is the form's `notes`, and `paymentMethod` carries the API's
     * vocabulary, not the form's. Optional keys are OMITTED by the builder
     * rather than blanked, so nothing here may assume a field is present; the
     * auto-generated reference in particular has to be overwritten, not
     * defaulted around.
     *
     * The customer name is passed in: the payload stores an id, and a review
     * screen showing a bare uuid where the customer should be is not a review.
     */
    loadFromRequestPayload: create.reducer(
      (
        state,
        action: PayloadAction<{ payload: Record<string, any>; customerName: string }>,
      ) => {
        const { payload, customerName } = action.payload;
        state.customerId = payload.customerId ?? '';
        state.customerName = customerName;
        state.paymentDate = String(payload.paymentDate ?? '').slice(0, 10);
        state.method = toUiPaymentMethod(String(payload.paymentMethod ?? ''));
        state.amount = String(payload.amount ?? '');
        state.reference = payload.reference ?? '';
        state.notes = payload.memo ?? '';
        state.errors = {};
        // Rows come from allInvoices, which may not have arrived yet. Rebuilding
        // here is harmless when it has; phase two puts the allocations on.
        if (state.customerId) {
          state.outstandingRows = buildOutstandingForCustomer(
            state.allInvoices,
            state.customerId,
          );
        }
      },
    ),

    /**
     * Phase two: put the request's allocations onto the rows, once they exist.
     *
     * Separate from the load above because outstandingRows are built from
     * allInvoices, and fetchAllInvoicesForPayment rebuilds them from scratch
     * when it lands — so allocations set before that arrives are wiped. The
     * screen chains this off outstandingRows appearing, the same way
     * preselectInvoice already does.
     *
     * Deliberately does NOT call autoDistribute: this is a replay of a split
     * somebody already chose, and autoDistribute would redistribute it
     * oldest-first and zero every row it considers unchecked.
     */
    applyRequestAllocations: create.reducer(
      (state, action: PayloadAction<Array<{ invoiceId?: string; amount?: string }>>) => {
        for (const app of action.payload) {
          if (!app?.invoiceId) continue;
          const row = state.outstandingRows.find(r => r.invoiceId === app.invoiceId);
          // A row can legitimately be missing — the invoice may have been paid
          // another way since, or fall outside the page this screen fetches.
          // The amount above still tells the owner what they are approving.
          if (!row) continue;
          const amount = parseFloat(String(app.amount ?? '')) || 0;
          row.allocated = Math.min(amount, row.balance);
          row.checked = row.allocated > 0;
        }
      },
    ),

    resetReceivePayment: create.reducer(state => {
      Object.assign(state, { ...initialState, paymentDate: toIsoDate(new Date()) });
    }),

    // ── Async thunks ────────────────────────────────
    fetchAllInvoicesForPayment: create.asyncThunk(
      async () => {
        // Pull the largest page the API allows so a customer's open invoices
        // aren't missed by the default page size when building allocations.
        const envelope = await getInvoicesAPI({ limit: 200 });
        return invoiceListSerializer(envelope);
      },
      {
        pending: state => { state.isLoadingInvoices = true; },
        fulfilled: (state, action) => {
          const invoices = action.payload.invoices;
          state.allInvoices = invoices;
          state.isLoadingInvoices = false;

          // If customer already selected, rebuild rows
          if (state.customerId) {
            state.outstandingRows = buildOutstandingForCustomer(
              invoices,
              state.customerId,
            );
          }
        },
        rejected: state => { state.isLoadingInvoices = false; },
      },
    ),

    /**
     * Persists the payment to the backend via `POST /payments`. The
     * backend atomically applies the payment to each invoice (updating
     * `amountPaid` / `balance` / `status`), decrements the customer's AR
     * balance, and posts the double-entry journal — so the client must
     * NOT separately mutate invoices (that would double-count).
     *
     * Any portion not allocated to an invoice is held by the backend as a
     * customer advance (Cr Customer Advances), applied later from the
     * customer or invoice screen.
     */
    savePayment: create.asyncThunk(
      async (_arg, thunkAPI) => {
        const state = thunkAPI.getState() as { receivePayment: ReceivePaymentSliceState };
        const f = state.receivePayment;

        const paymentAmount = Math.round((parseFloat(f.amount) || 0) * 100) / 100;
        const applications = f.outstandingRows
          .filter(r => r.allocated > 0)
          .map(r => ({
            invoiceId: r.invoiceId,
            amount: (Math.round(r.allocated * 100) / 100).toFixed(2),
          }));

        const created = await createPaymentAPI({
          customerId: f.customerId,
          paymentDate: f.paymentDate, // 'YYYY-MM-DD' — valid ISO date
          paymentMethod: toBackendPaymentMethod(f.method),
          amount: paymentAmount.toFixed(2),
          reference: f.reference || undefined,
          memo: f.notes || undefined,
          applications: applications.length > 0 ? applications : undefined,
          // With no applications the server AUTO-APPLIES oldest-first, so
          // omitting them alone did the opposite of "save as customer credit".
          // holdAsAdvance keeps the whole receipt as an advance.
          ...(applications.length === 0 ? { holdAsAdvance: true } : {}),
        });

        // Staff get an approval request back, not a payment. Read the flag off
        // the raw envelope and check BOTH positions: the network layer returns
        // response.data un-unwrapped, so it may sit at either depth, and
        // `(created?.data ?? created)?.pending` is NOT the same test — ?? picks
        // whichever operand is merely present, so a truthy `data` wins and its
        // missing `.pending` reads undefined.
        if (created?.data?.pending ?? created?.pending) {
          return { payment: null, pending: true };
        }
        return { payment: created, pending: false };
      },
      {
        pending: state => {
          state.isSaving = true;
          state.errors = {};
        },
        fulfilled: state => {
          state.isSaving = false;
        },
        rejected: (state, action) => {
          state.isSaving = false;
          state.errors = {
            _root: action.error?.message ?? 'Failed to record payment',
          };
        },
      },
    ),
  }),

  selectors: {
    selectReceivePaymentState: state => state,
    selectOutstandingRows: state => state.outstandingRows,
    selectPaymentErrors: state => state.errors,
    selectPaymentIsSaving: state => state.isSaving,
  },
});

export const {
  setPaymentField,
  setPaymentCustomer,
  toggleInvoiceCheck,
  setAllocatedAmount,
  payInFull,
  distributeAmount,
  toggleSaveOverpaymentAsCredit,
  setPaymentErrors,
  preselectInvoice,
  loadFromRequestPayload,
  applyRequestAllocations,
  resetReceivePayment,
  fetchAllInvoicesForPayment,
  savePayment,
} = receivePaymentSlice.actions;

export const {
  selectReceivePaymentState,
  selectOutstandingRows,
  selectPaymentErrors,
  selectPaymentIsSaving,
} = receivePaymentSlice.selectors;
