// ═══════════════════════════════════════════════════════
// FinMatrix — Session Storage Utils
// ═══════════════════════════════════════════════════════
// Token + active-company persistence (AsyncStorage), moved verbatim from
// networks/network/apiHelpers.ts — Consultant_Mobile convention
// (utils/storage_utils/storageUtils.ts): screens/slices import these,
// never the axios client itself.

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Storage Keys ───────────────────────────────────
const ACCESS_TOKEN_KEY = '@finmatrix/accessToken';
const REFRESH_TOKEN_KEY = '@finmatrix/refreshToken';
const COMPANY_ID_KEY = '@finmatrix/companyId';

// ─── Token Helpers ──────────────────────────────────
export const setTokens = async (accessToken: string, refreshToken: string) => {
  await AsyncStorage.multiSet([
    [ACCESS_TOKEN_KEY, accessToken],
    [REFRESH_TOKEN_KEY, refreshToken],
  ]);
};

export const getAccessToken = async (): Promise<string | null> => {
  return AsyncStorage.getItem(ACCESS_TOKEN_KEY);
};

export const getRefreshToken = async (): Promise<string | null> => {
  return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
};

export const setStoredCompanyId = async (companyId: string) => {
  await AsyncStorage.setItem(COMPANY_ID_KEY, companyId);
};

export const getStoredCompanyId = async (): Promise<string | null> => {
  return AsyncStorage.getItem(COMPANY_ID_KEY);
};

export const clearTokens = async () => {
  await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, COMPANY_ID_KEY]);
};
