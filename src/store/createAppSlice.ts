// ═══════════════════════════════════════════════════════
// FinMatrix — createAppSlice Utility
// ═══════════════════════════════════════════════════════
// A wrapper around RTK's buildCreateSlice that enables
// async thunks directly inside the `reducers` callback.
// Every screen-level slice should use this instead of createSlice.

import { buildCreateSlice, asyncThunkCreator } from '@reduxjs/toolkit';

export const createAppSlice = buildCreateSlice({
  creators: { asyncThunk: asyncThunkCreator },
});
