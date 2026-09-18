// ═══════════════════════════════════════════════════════
// FinMatrix — Bill Form Slice (createAppSlice)
// ═══════════════════════════════════════════════════════
// Owns form state, line items, auto-totals, AND the save
// thunk that posts via the network + serializer pipeline.
// Mirrors GL/Vendor/Credit-Memo slice architecture.

import type { PayloadAction } from '@reduxjs/toolkit';
import { toIsoDate } from '../../../models/reportModel';
import { createAppSlice } from '@store/createAppSlice';
import type { Bill, BillStatus } from '../../../types';
import {
  createBillAPI,
  updateBillAPI,
  getBillByIdAPI,
} from '../../../networks/purchases/billNetwork';
import { billSingleSerializer } from '../../../serializers/billSerializer';

// ── Line item (form representation — string values for inputs) ──
export interface BillFormLine {
  id: string;
  accountId: string;
  accountName: string;
  description: string;
  amount: string;
  taxRate: string;
}

export interface BillFormSliceState {
  billNumber: string;
  vendorId: string;
  vendorName: string;
  issueDate: string;
  dueDate: string;
  status: BillStatus;
  notes: string;
  lines: BillFormLine[];
  subtotal: number;
  taxAmount: number;
  total: number;
  errors: Record<string, string>;
  isSaving: boolean;
  saveError: string;
  isEditMode: boolean;
  editId: string;
}

let nextLineId = 1;
const freshLine = (): BillFormLine => ({
  id: `bfl_${nextLineId++}_${Date.now()}`,
  accountId: '',
  accountName: '',
  description: '',
  amount: '',
  taxRate: '0',
});

const initialState: BillFormSliceState = {
  billNumber: '',
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
  issueDate: toIsoDate(new Date()),
  dueDate: '',
  status: 'draft',
  notes: '',
  lines: [freshLine()],
  subtotal: 0,
  taxAmount: 0,
  total: 0,
  errors: {},
  isSaving: false,
  saveError: '',
  isEditMode: false,
  editId: '',
};

function recalc(state: BillFormSliceState) {
  let sub = 0;
  let tax = 0;
  state.lines.forEach(l => {
    const amt = parseFloat(l.amount) || 0;
    const rate = parseFloat(l.taxRate) || 0;
    sub += amt;
    tax += amt * rate / 100;
  });
  state.subtotal = Math.round(sub * 100) / 100;
  state.taxAmount = Math.round(tax * 100) / 100;
  state.total = Math.round((sub + tax) * 100) / 100;
}

// Save payload builder — Activity step "Save — JE: DR Expense, CR AP".
const buildSavePayload = (
  state: BillFormSliceState,
  saveStatus: BillStatus,
) => ({
  vendorId: state.vendorId,
  billDate: state.issueDate,
  dueDate: state.dueDate,
  status: saveStatus as 'draft' | 'open',
  memo: state.notes,
  lines: state.lines
    .filter(l => l.accountId && parseFloat(l.amount) > 0)
    .map(l => ({
      accountId: l.accountId,
      description: l.description,
      amount: l.amount || '0',
      taxRate: l.taxRate || '0',
    })),
});

export const billFormSlice = createAppSlice({
  name: 'billForm',
  initialState,
  reducers: create => ({
    setBillField: create.reducer(
      (state, action: PayloadAction<{ key: keyof BillFormSliceState; value: any }>) => {
        (state as any)[action.payload.key] = action.payload.value;
        if (state.errors[action.payload.key]) {
          const { [action.payload.key]: _, ...rest } = state.errors;
          state.errors = rest;
        }
      },
    ),
    setBillVendor: create.reducer(
      (state, action: PayloadAction<{ id: string; name: string }>) => {
        state.vendorId = action.payload.id;
        state.vendorName = action.payload.name;
        if (state.errors.vendorId) {
          const { vendorId: _, ...rest } = state.errors;
          state.errors = rest;
        }
      },
    ),
    setBillErrors: create.reducer((state, action: PayloadAction<Record<string, string>>) => {
      state.errors = action.payload;
    }),
    setBillIsSaving: create.reducer((state, action: PayloadAction<boolean>) => {
      state.isSaving = action.payload;
    }),

    addBillLine: create.reducer(state => {
      state.lines.push(freshLine());
    }),
    removeBillLine: create.reducer((state, action: PayloadAction<string>) => {
      state.lines = state.lines.filter(l => l.id !== action.payload);
      recalc(state);
    }),
    updateBillLine: create.reducer(
      (state, action: PayloadAction<{ id: string; field: keyof BillFormLine; value: string }>) => {
        const line = state.lines.find(l => l.id === action.payload.id);
        if (line) {
          (line as any)[action.payload.field] = action.payload.value;
          recalc(state);
        }
      },
    ),
    setBillLineAccount: create.reducer(
      (state, action: PayloadAction<{ lineId: string; accountId: string; accountName: string }>) => {
        const line = state.lines.find(l => l.id === action.payload.lineId);
        if (line) {
          line.accountId = action.payload.accountId;
          line.accountName = action.payload.accountName;
        }
      },
    ),

    calculateBillTotals: create.reducer(state => {
      recalc(state);
    }),

    loadBillForEdit: create.reducer(
      (state, action: PayloadAction<{
        billNumber: string;
        vendorId: string;
        vendorName: string;
        issueDate: string;
        dueDate: string;
        status: BillStatus;
        notes: string;
        lines: BillFormLine[];
        editId?: string;
      }>) => {
        const d = action.payload;
        state.billNumber = d.billNumber;
        state.vendorId = d.vendorId;
        state.vendorName = d.vendorName;
        state.issueDate = d.issueDate;
        state.dueDate = d.dueDate;
        state.status = d.status;
        state.notes = d.notes;
        state.lines = d.lines;
        state.errors = {};
        state.isSaving = false;
        if (d.editId) {
          state.isEditMode = true;
          state.editId = d.editId;
        }
        recalc(state);
      },
    ),

    resetBillForm: create.reducer(state => {
      Object.assign(state, { ...initialState, lines: [freshLine()] });
    }),

    // ── Async thunks ────────────────────────────────

    /** Activity step: "Save — JE: DR Expense, CR AP" */
    saveBill: create.asyncThunk(
      async (saveStatus: BillStatus, thunkAPI) => {
        const root = thunkAPI.getState() as { billForm: BillFormSliceState };
        const f = root.billForm;
        const payload = buildSavePayload(f, saveStatus);
        const envelope = f.isEditMode && f.editId
          ? await updateBillAPI(f.editId, payload)
          : await createBillAPI(payload);
        return billSingleSerializer(envelope);
      },
      {
        pending: state => { state.isSaving = true; state.saveError = ''; },
        fulfilled: (state, action: PayloadAction<Bill | null>) => {
          state.isSaving = false;
          if (action.payload) {
            state.editId = action.payload.id;
            state.isEditMode = true;
          }
        },
        rejected: (state, action) => {
          state.isSaving = false;
          state.saveError = action.error?.message ?? 'Failed to save bill';
        },
      },
    ),

    /** Loads an existing bill into the form for editing. */
    fetchBillForEdit: create.asyncThunk(
      async (id: string) => getBillByIdAPI(id),
      {
        fulfilled: (state, action: PayloadAction<any>) => {
          const b = billSingleSerializer(action.payload);
          if (!b) return;
          state.isEditMode = true;
          state.editId = b.id;
          state.billNumber = b.billNumber;
          state.vendorId = b.vendorId;
          state.vendorName = b.vendorName;
          state.issueDate = b.issueDate.slice(0, 10);
          state.dueDate = b.dueDate.slice(0, 10);
          state.status = b.status;
          state.notes = b.notes;
          state.lines = b.lines.map(l => ({
            id: l.id,
            accountId: l.accountId,
            accountName: l.accountName,
            description: l.description,
            amount: String(l.amount),
            taxRate: String(l.taxRate),
          }));
          state.errors = {};
          recalc(state);
        },
      },
    ),

  }),

  selectors: {
    selectBillFormState: state => state,
    selectBillFormLines: state => state.lines,
    selectBillFormErrors: state => state.errors,
    selectBillFormIsSaving: state => state.isSaving,
    selectBillFormIsEditMode: state => state.isEditMode,
  },
});

export const {
  setBillField,
  setBillVendor,
  setBillErrors,
  setBillIsSaving,
  addBillLine,
  removeBillLine,
  updateBillLine,
  setBillLineAccount,
  calculateBillTotals,
  loadBillForEdit,
  resetBillForm,
  saveBill,
  fetchBillForEdit,
} = billFormSlice.actions;

export const {
  selectBillFormState,
  selectBillFormLines,
  selectBillFormErrors,
  selectBillFormIsSaving,
  selectBillFormIsEditMode,
} = billFormSlice.selectors;
