import { createAppSlice } from '@store/createAppSlice';
import type { PayloadAction } from '@reduxjs/toolkit';
import { searchAll } from '../../networks/search/auditSearchNetwork';
import { searchResultsSerializer } from '../../serializers/globalSearchSerializer';
import type { SearchResult } from '../../models/auditModel';

/** Shortest query the server is asked about — shared with the screen so the
 *  input, the results list and the slice all agree on when a search exists. */
export const MIN_QUERY_LENGTH = 2;

interface GlobalSearchState {
  query: string;
  results: SearchResult[];
  isSearching: boolean;
  error: string;
  recentSearches: string[];
}

const initialState: GlobalSearchState = {
  query: '',
  results: [],
  isSearching: false,
  error: '',
  recentSearches: [],
};

export const globalSearchSlice = createAppSlice({
  name: 'globalSearch',
  initialState,
  reducers: create => ({
    setQuery: create.reducer((state, action: PayloadAction<string>) => {
      state.query = action.payload;
      // Below the minimum query length nothing is searchable, so drop any
      // in-flight spinner — its response is now stale and will be ignored,
      // which would otherwise leave the screen spinning forever.
      if (action.payload.trim().length < MIN_QUERY_LENGTH) {
        state.results = [];
        state.error = '';
        state.isSearching = false;
      }
    }),
    clearSearch: create.reducer(state => {
      state.query = '';
      state.results = [];
      state.error = '';
      state.isSearching = false;
    }),
    addRecentSearch: create.reducer((state, action: PayloadAction<string>) => {
      state.recentSearches = [
        action.payload,
        ...state.recentSearches.filter(s => s !== action.payload),
      ].slice(0, 8);
    }),
    removeRecentSearch: create.reducer((state, action: PayloadAction<string>) => {
      state.recentSearches = state.recentSearches.filter(s => s !== action.payload);
    }),
    clearRecentSearches: create.reducer(state => {
      state.recentSearches = [];
    }),
    // Keystrokes are debounced on screen but responses can still land out of
    // order, so every settled request is checked against the query the user
    // is actually looking at and dropped if it is stale.
    performSearch: create.asyncThunk(
      // The raw arg is echoed back for the staleness check; only the trimmed
      // form is what the server is asked about.
      async (query: string) => ({ query, results: searchResultsSerializer(await searchAll(query.trim())) }),
      {
        pending: (state, action) => {
          if (action.meta.arg !== state.query) return;
          state.isSearching = true;
          state.error = '';
        },
        fulfilled: (state, action) => {
          if (action.payload.query !== state.query) return;
          state.isSearching = false;
          state.error = '';
          state.results = action.payload.results;
        },
        rejected: (state, action) => {
          if (action.meta.arg !== state.query) return;
          state.isSearching = false;
          state.results = [];
          state.error = action.error?.message ?? 'Search failed. Please try again.';
        },
      },
    ),
  }),
  selectors: {
    selectSearchQuery: state => state.query,
    selectSearchResults: state => state.results,
    selectIsSearching: state => state.isSearching,
    selectSearchError: state => state.error,
    selectRecentSearches: state => state.recentSearches,
  },
});

export const {
  setQuery,
  clearSearch,
  addRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
  performSearch,
} = globalSearchSlice.actions;
export const {
  selectSearchQuery,
  selectSearchResults,
  selectIsSearching,
  selectSearchError,
  selectRecentSearches,
} = globalSearchSlice.selectors;
