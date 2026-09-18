import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { JournalEntry, JournalEntryStatus } from '../../models/journalEntryModel';
import {
  getJournalEntriesAPI, getJournalEntryByIdAPI, createJournalEntryAPI,
  postJournalEntryAPI, voidJournalEntryAPI,
} from '../../networks/accounting/journalEntryNetwork';
import { journalEntryListSerializer, journalEntrySingleSerializer } from '../../serializers/journalEntrySerializer';

export type JournalEntryStatusFilter = 'all' | JournalEntryStatus;

interface JournalEntryState {
  entries: JournalEntry[];
  current: JournalEntry | null;
  statusFilter: JournalEntryStatusFilter;
  isLoading: boolean;
  isSaving: boolean;
  error: string;
}

const initialState: JournalEntryState = {
  entries: [], current: null, statusFilter: 'all', isLoading: false, isSaving: false, error: '',
};

export const journalEntrySlice = createAppSlice({
  name: 'journalEntries',
  initialState,
  reducers: create => ({
    setJournalStatusFilter: create.reducer((state, action: PayloadAction<JournalEntryStatusFilter>) => {
      state.statusFilter = action.payload;
    }),
    fetchJournalEntries: create.asyncThunk(
      async (params: { status?: string } | undefined) => getJournalEntriesAPI(params ?? {}),
      {
        pending: state => { state.isLoading = true; state.error = ''; },
        fulfilled: (state, action) => { state.isLoading = false; state.entries = journalEntryListSerializer(action.payload); },
        rejected: (state, action) => { state.isLoading = false; state.error = action.error?.message ?? 'Failed to load journal entries'; },
      },
    ),
    fetchJournalEntry: create.asyncThunk(
      async (id: string) => getJournalEntryByIdAPI(id),
      {
        pending: state => { state.isLoading = true; state.error = ''; state.current = null; },
        fulfilled: (state, action) => { state.isLoading = false; state.current = journalEntrySingleSerializer(action.payload); },
        rejected: (state, action) => { state.isLoading = false; state.error = action.error?.message ?? 'Failed to load journal entry'; },
      },
    ),
    saveJournalEntry: create.asyncThunk(
      async (data: any) => createJournalEntryAPI(data),
      {
        pending: state => { state.isSaving = true; state.error = ''; },
        fulfilled: (state, action) => { state.isSaving = false; state.current = journalEntrySingleSerializer(action.payload); },
        rejected: (state, action) => { state.isSaving = false; state.error = action.error?.message ?? 'Failed to save journal entry'; },
      },
    ),
    postJournalEntry: create.asyncThunk(
      async (id: string) => postJournalEntryAPI(id),
      { fulfilled: (state, action) => { state.current = journalEntrySingleSerializer(action.payload); } },
    ),
    voidJournalEntry: create.asyncThunk(
      async (p: { id: string; reason: string }) => voidJournalEntryAPI(p.id, p.reason),
      { fulfilled: (state, action) => { state.current = journalEntrySingleSerializer(action.payload); } },
    ),
  }),
  selectors: { selectJournalEntryState: state => state },
});

export const {
  setJournalStatusFilter, fetchJournalEntries, fetchJournalEntry,
  saveJournalEntry, postJournalEntry, voidJournalEntry,
} = journalEntrySlice.actions;

export const selectJournalEntryState = (rootState: { journalEntries?: JournalEntryState }) =>
  rootState.journalEntries ?? initialState;
