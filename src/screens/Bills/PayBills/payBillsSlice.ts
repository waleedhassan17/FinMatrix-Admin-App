// ═══════════════════════════════════════════════════════
// FinMatrix — Pay Bills Slice (createAppSlice pattern)
// Manages form state: vendor, date, method, amount,
// bank account, outstanding bill checkboxes, and
// auto-distribute.
// ═══════════════════════════════════════════════════════

import type { PayloadAction } from '@reduxjs/toolkit';
import { toIsoDate } from '../../../models/reportModel';
import { createAppSlice } from '@store/createAppSlice';
import type { Bill, BillPayment, BillStatus, PaymentMethod } from '../../../types';
import {
  getBillsAPI,
  payBillsAPI,
  uploadBillPaymentProofAPI,
} from '../../../networks/purchases/billNetwork';
import { billListSerializer } from '../../../serializers/billSerializer';
import { applyVendorCreditAPI, getVendorCreditsAPI } from '../../../networks/purchases/vendorCreditNetwork';
import { vendorCreditListSerializer } from '../../../serializers/vendorCreditSerializer';

/** The API's enum is cash | check | bank_transfer | credit_card | other, so
 *  the UI's `cheque` / `online` have to be translated (same mapping the
 *  customer-side ReceivePayment uses). */
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

export interface OutstandingBillRow {
  billId: string;
  billNumber: string;
  vendorName: string;
  dueDate: string;
  total: number;
  amountPaid: number;
  balance: number;
  /** Cash portion. */
  allocated: number;
  /** Vendor-credit portion. Credits post no journal entry when applied — the
   *  credit's own creation already debited A/P — so this simply settles part
   *  of the bill without cash leaving the building. */
  creditApplied: number;
  checked: boolean;
}

export interface AvailableCredit {
  id: string;
  number: string;
  balance: number;
}

export interface PayBillsSliceState {
  vendorId: string;
  vendorName: string;
  paymentDate: string;
  method: PaymentMethod;
  reference: string;
  amount: string;
  bankAccountId: string;
  notes: string;
  outstandingRows: OutstandingBillRow[];
  allBills: Bill[];
  availableCredits: AvailableCredit[];
  errors: Record<string, string>;
  isSaving: boolean;
  isLoadingBills: boolean;
  /** Payment proof. `proofId` is what the API needs; the rest drives the UI. */
  proofId: string;
  proofName: string;
  proofMimeType: string;
  /** Local uri of the picked file, for the thumbnail before/after upload. */
  proofLocalUri: string;
  isUploadingProof: boolean;
  proofError: string;
}

const initialState: PayBillsSliceState = {
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
  paymentDate: toIsoDate(new Date()),
  method: 'bank_transfer',
  reference: '',
  amount: '',
  bankAccountId: '',
  notes: '',
  outstandingRows: [],
  allBills: [],
  availableCredits: [],
  errors: {},
  isSaving: false,
  isLoadingBills: false,
  proofId: '',
  proofName: '',
  proofMimeType: '',
  proofLocalUri: '',
  isUploadingProof: false,
  proofError: '',
};

/** The payment total is derived from the rows, never typed. */
function syncTotal(state: PayBillsSliceState) {
  const total = state.outstandingRows.reduce((sum, r) => sum + (r.checked ? r.allocated : 0), 0);
  state.amount = total > 0 ? String(Math.round(total * 100) / 100) : '';
}

/** Credit still unspent across the whole screen. */
function creditPoolLeft(state: PayBillsSliceState): number {
  const total = state.availableCredits.reduce((sum, c) => sum + c.balance, 0);
  const used = state.outstandingRows.reduce((sum, r) => sum + r.creditApplied, 0);
  return Math.round((total - used) * 100) / 100;
}

/** Clamp to the bill's balance — you can never pay a supplier more than the
 *  bill owes them from this screen. */
function clampToBalance(row: OutstandingBillRow, value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(Math.min(value, row.balance) * 100) / 100;
}

function buildRows(bills: Bill[], vendorId: string): OutstandingBillRow[] {
  return bills
    .filter(
      b =>
        b.vendorId === vendorId &&
        (b.status === 'open' || b.status === 'overdue' || b.status === 'partial') &&
        b.total - b.amountPaid > 0,
    )
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .map(b => ({
      billId: b.id,
      billNumber: b.billNumber,
      vendorName: b.vendorName,
      dueDate: b.dueDate,
      total: b.total,
      amountPaid: b.amountPaid,
      balance: Math.round((b.total - b.amountPaid) * 100) / 100,
      allocated: 0,
      creditApplied: 0,
      checked: false,
    }));
}

export const payBillsSlice = createAppSlice({
  name: 'payBills',
  initialState,
  reducers: create => ({
    setPayBillField: create.reducer(
      (state, action: PayloadAction<{ key: keyof PayBillsSliceState; value: any }>) => {
        (state as any)[action.payload.key] = action.payload.value;
        if (state.errors[action.payload.key]) {
          const { [action.payload.key]: _, ...rest } = state.errors;
          state.errors = rest;
        }
      },
    ),

    setPayBillVendor: create.reducer(
      (state, action: PayloadAction<{ id: string; name: string }>) => {
        state.vendorId = action.payload.id;
        state.vendorName = action.payload.name;
        if (state.errors.vendorId) {
          const { vendorId: _, ...rest } = state.errors;
          state.errors = rest;
        }
        state.outstandingRows = buildRows(state.allBills, action.payload.id);
      },
    ),

    toggleBillCheck: create.reducer(
      (state, action: PayloadAction<string>) => {
        const row = state.outstandingRows.find(r => r.billId === action.payload);
        if (row) {
          row.checked = !row.checked;
          // Checking a bill offers to settle it in full; unchecking clears it.
          if (!row.checked) row.creditApplied = 0;
          row.allocated = row.checked
            ? Math.max(0, Math.round((row.balance - row.creditApplied) * 100) / 100)
            : 0;
        }
        syncTotal(state);
      },
    ),

    /** Use available vendor credit against one bill, QuickBooks' "Set
     *  Credits". Credits are fungible against the same vendor and applying
     *  one posts nothing to the ledger, so which credit document funds which
     *  bill has no accounting consequence — they are consumed oldest-first
     *  behind the scenes and the user only chooses the amount per bill. */
    toggleBillCredit: create.reducer(
      (state, action: PayloadAction<string>) => {
        const row = state.outstandingRows.find(r => r.billId === action.payload);
        if (!row) return;
        if (row.creditApplied > 0) {
          row.creditApplied = 0;
        } else {
          const take = Math.min(row.balance, creditPoolLeft(state));
          row.creditApplied = Math.round(take * 100) / 100;
        }
        // Cash covers whatever the credit does not.
        row.checked = row.creditApplied > 0 ? true : row.checked;
        row.allocated = row.checked
          ? Math.max(0, Math.round((row.balance - row.creditApplied) * 100) / 100)
          : 0;
        syncTotal(state);
      },
    ),

    setAvailableCredits: create.reducer(
      (state, action: PayloadAction<AvailableCredit[]>) => {
        state.availableCredits = action.payload;
      },
    ),

    /** The per-bill "Amt To Pay" cell — the whole point of the redesign. */
    setBillAllocation: create.reducer(
      (state, action: PayloadAction<{ billId: string; value: string }>) => {
        const row = state.outstandingRows.find(r => r.billId === action.payload.billId);
        if (!row) return;
        const parsed = parseFloat(action.payload.value);
        const cashCeiling = Math.max(0, row.balance - row.creditApplied);
        row.allocated = Math.min(clampToBalance(row, parsed), Math.round(cashCeiling * 100) / 100);
        row.checked = row.allocated > 0;
        syncTotal(state);
      },
    ),

    toggleAllBills: create.reducer(state => {
      const allChecked = state.outstandingRows.every(r => r.checked);
      state.outstandingRows.forEach(r => {
        r.checked = !allChecked;
        if (allChecked) r.creditApplied = 0;
        r.allocated = allChecked ? 0 : Math.max(0, Math.round((r.balance - r.creditApplied) * 100) / 100);
      });
      syncTotal(state);
    }),

    payAllBills: create.reducer(state => {
      state.outstandingRows.forEach(r => {
        r.checked = true;
        r.allocated = Math.max(0, Math.round((r.balance - r.creditApplied) * 100) / 100);
      });
      syncTotal(state);
    }),

    clearPaymentProof: create.reducer(state => {
      state.proofId = '';
      state.proofName = '';
      state.proofMimeType = '';
      state.proofLocalUri = '';
      state.proofError = '';
    }),

    /**
     * Upload the proof and hold its id.
     *
     * Separate from savePayment on purpose: the file has to be durable before
     * any money moves, and the Pay button stays disabled until this resolves —
     * so a payment can never be recorded against an upload that failed.
     */
    uploadPaymentProof: create.asyncThunk(
      async (file: { uri: string; name: string; mimeType: string }) =>
        uploadBillPaymentProofAPI(file),
      {
        pending: (state, action) => {
          state.isUploadingProof = true;
          state.proofError = '';
          state.proofId = '';
          state.proofLocalUri = action.meta.arg.uri;
          state.proofName = action.meta.arg.name;
          state.proofMimeType = action.meta.arg.mimeType;
        },
        fulfilled: (state, action: PayloadAction<any>) => {
          state.isUploadingProof = false;
          state.proofId = action.payload?.id ?? '';
          state.proofMimeType = action.payload?.mimeType ?? state.proofMimeType;
          state.proofName = action.payload?.originalName ?? state.proofName;
        },
        rejected: (state, action) => {
          state.isUploadingProof = false;
          state.proofId = '';
          state.proofError = action.error?.message ?? 'Upload failed. Tap to retry.';
        },
      },
    ),

    preselectBill: create.reducer(
      (state, action: PayloadAction<string>) => {
        const row = state.outstandingRows.find(r => r.billId === action.payload);
        if (row) {
          row.checked = true;
          row.allocated = Math.max(0, Math.round((row.balance - row.creditApplied) * 100) / 100);
          syncTotal(state);
        }
      },
    ),

    setPayBillErrors: create.reducer((state, action: PayloadAction<Record<string, string>>) => {
      state.errors = action.payload;
    }),
    setPayBillIsSaving: create.reducer((state, action: PayloadAction<boolean>) => {
      state.isSaving = action.payload;
    }),

    resetPayBills: create.reducer(state => {
      Object.assign(state, { ...initialState });
    }),

    fetchAllBillsForPayment: create.asyncThunk(
      async () => getBillsAPI({ limit: 200 }),
      {
        pending: state => { state.isLoadingBills = true; },
        fulfilled: (state, action) => {
          const { bills } = billListSerializer(action.payload);
          state.allBills = bills;
          state.isLoadingBills = false;
          if (state.vendorId) {
            state.outstandingRows = buildRows(bills, state.vendorId);
          }
        },
        rejected: state => { state.isLoadingBills = false; },
      },
    ),

    /** Activity step: "Confirm Payment → JE: DR AP, CR Cash for each
     *  vendor → Bills marked Paid, AP & Cash updated".
     *  Creates the BillPayment then patches every allocated bill's
     *  amountPaid + status. Centralises what used to live in the
     *  screen so PayBillsScreen only has to dispatch one action. */
    /** Open credits for the selected vendor — what "Set Credits" can spend. */
    fetchVendorCreditsForPayment: create.asyncThunk(
      async (vendorId: string) =>
        vendorCreditListSerializer(await getVendorCreditsAPI({ vendorId, status: 'open' })),
      {
        fulfilled: (state, action: PayloadAction<any>) => {
          const list = Array.isArray(action.payload) ? action.payload : action.payload?.vendorCredits ?? [];
          state.availableCredits = list
            .filter((c: any) => Number(c.balance) > 0)
            .map((c: any) => ({
              id: c.id,
              number: c.vendorCreditNumber ?? c.number ?? '',
              balance: Number(c.balance) || 0,
            }));
        },
        rejected: state => { state.availableCredits = []; },
      },
    ),

    savePayment: create.asyncThunk(
      async (
        args: {
          paymentNumber: string;
          allocations: { billId: string; billNumber: string; amount: number }[];
        },
        thunkAPI,
      ): Promise<BillPayment> => {
        const root = thunkAPI.getState() as { payBills: PayBillsSliceState };
        const f = root.payBills;

        // Credits FIRST, cash second.
        //
        // Applying a credit reduces the bill's balance without posting
        // anything (the credit's creation already debited A/P). If the cash
        // went first the bill could be settled and the credit application
        // would then be refused for exceeding the balance. Credits are
        // consumed oldest-first; they are fungible against the same vendor,
        // so which document funds which bill has no ledger consequence.
        const pool = f.availableCredits.map(c => ({ ...c }));
        for (const row of f.outstandingRows) {
          let owed = row.creditApplied;
          if (owed <= 0) continue;
          for (const credit of pool) {
            if (owed <= 0) break;
            if (credit.balance <= 0) continue;
            const take = Math.round(Math.min(credit.balance, owed) * 100) / 100;
            await applyVendorCreditAPI(credit.id, row.billId, take.toFixed(2));
            credit.balance = Math.round((credit.balance - take) * 100) / 100;
            owed = Math.round((owed - take) * 100) / 100;
          }
        }

        // Nothing left to pay in cash — the credits covered it. Returning
        // early avoids posting a zero-value payment, which the API rejects.
        const cash = args.allocations.filter(a => a.amount > 0);
        if (cash.length === 0) return null as unknown as BillPayment;

        // PayBillsDto: vendorId, paymentDate, paymentMethod, bankAccountId,
        // applications[]. The old body sent `date`, `method` and
        // `allocations`, so three REQUIRED fields were simply absent and every
        // payment 400'd. Amounts are @IsNumberString, hence the .toFixed(2).
        const payment = await payBillsAPI({
          vendorId: f.vendorId,
          paymentDate: f.paymentDate,
          paymentMethod: toBackendPaymentMethod(f.method),
          bankAccountId: f.bankAccountId,
          reference: f.reference || undefined,
          proofId: f.proofId,
          applications: cash.map(a => ({
            billId: a.billId,
            amount: (Math.round(a.amount * 100) / 100).toFixed(2),
          })),
        });

        // The bills are NOT patched here. `pay()` is transactional: it locks
        // each bill, writes amountPaid/balance/status, adjusts the vendor
        // balance and posts DR AP / CR Bank. Re-applying the amounts from the
        // client would double-count every payment.

        return payment;
      },
      {
        pending: state => { state.isSaving = true; },
        fulfilled: state => { state.isSaving = false; },
        rejected: state => { state.isSaving = false; },
      },
    ),
  }),

  selectors: {
    selectPayBillsState: state => state,
    selectOutstandingBillRows: state => state.outstandingRows,
    selectPayBillErrors: state => state.errors,
    selectPayBillIsSaving: state => state.isSaving,
    selectPayBillProof: state => ({
      id: state.proofId,
      name: state.proofName,
      mimeType: state.proofMimeType,
      localUri: state.proofLocalUri,
      isUploading: state.isUploadingProof,
      error: state.proofError,
    }),
  },
});

export const {
  setPayBillField,
  setPayBillVendor,
  toggleBillCheck,
  payAllBills,
  setBillAllocation,
  toggleAllBills,
  toggleBillCredit,
  setAvailableCredits,
  fetchVendorCreditsForPayment,
  preselectBill,
  clearPaymentProof,
  uploadPaymentProof,
  setPayBillErrors,
  setPayBillIsSaving,
  resetPayBills,
  fetchAllBillsForPayment,
  savePayment,
} = payBillsSlice.actions;

export const {
  selectPayBillsState,
  selectOutstandingBillRows,
  selectPayBillErrors,
  selectPayBillIsSaving,
  selectPayBillProof,
} = payBillsSlice.selectors;
