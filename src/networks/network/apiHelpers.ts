// ═══════════════════════════════════════════════════════
// FinMatrix — API Infrastructure (Production)
// ═══════════════════════════════════════════════════════

import { Platform } from 'react-native';
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import {
  setTokens,
  getAccessToken,
  getRefreshToken,
  setStoredCompanyId,
  getStoredCompanyId,
  clearTokens,
} from '../../utils/storageUtils';
import {
  emitSessionExpired,
  emitCompanyStatusStale,
  emitRiderSeatLocked,
  isIntentionalSignOut,
} from '../../utils/authEvents';

// ★ BACKEND BASE URL ★
// Production by default, so a normal build is unchanged. Override to run
// against a backend you are still working on — otherwise every request goes
// to Heroku and a server-side change cannot be tested before it ships:
//
//   EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1 npm run web
//
// On a physical device use the machine's LAN address, not localhost, since
// localhost there resolves to the phone itself.
// Expo inlines EXPO_PUBLIC_* at build time, so this must stay a static read
// of process.env rather than a computed key.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  'https://finmatrix-api-prod-665c6b5cb6a1.herokuapp.com/api/v1';

// Token/company storage lives in utils/storageUtils.ts (Consultant_Mobile
// convention); re-exported here so the domain network files keep importing
// everything they need from the shared client module.
export {
  setTokens,
  getAccessToken,
  getRefreshToken,
  setStoredCompanyId,
  getStoredCompanyId,
  clearTokens,
};

// ─── Axios Instance ─────────────────────────────────
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request Interceptor ────────────────────────────
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const companyId = await getStoredCompanyId();
    if (companyId) {
      config.headers['x-company-id'] = companyId;
    }
    return config;
  },
  error => Promise.reject(error),
);

// ─── Response Interceptor (401 refresh logic) ───────
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: any) => void; reject: (e: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Skip refresh for auth endpoints — a 401 there IS the real error
    const url = originalRequest?.url ?? '';
    const isAuthRoute = url.includes('/auth/signin') || url.includes('/auth/signup') || url.includes('/auth/refresh-token');

    // ── Company no longer active (server gate) ──────────────────────────
    // CompanyGuard 403s every business request once the company stops being
    // active — subscription lapsed (enforced live, ahead of the billing
    // cron), deactivated, or un-approved. Redux only learns companyStatus at
    // signin / cold start, so without this the user would stay on dead
    // screens until the next restart. The handler (AppContainer) re-fetches
    // /auth/me and the navigator routes to the matching gate screen.
    if (error.response?.status === 403) {
      const body: any = error.response.data;
      const code = body?.error?.code ?? body?.code;
      if (code === 'COMPANY_NOT_ACTIVE') {
        emitCompanyStatusStale();
      } else if (code === 'RIDER_SEAT_LOCKED') {
        emitRiderSeatLocked(
          body?.error?.message ??
            "Your company's plan doesn't include your rider seat right now. Ask your manager.",
        );
      }
    }

    // The user just signed out on purpose: a 401 on a request still in flight
    // is expected. Refreshing would fail (its token was revoked), and a late
    // failure could clear the tokens of a sign-in made moments later.
    if (error.response?.status === 401 && !isAuthRoute && isIntentionalSignOut()) {
      return Promise.reject(error);
    }

    // Only attempt refresh on 401 and if we haven't already retried
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) {
          throw new Error('No refresh token');
        }
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {
          refreshToken,
        });
        const newAccess = data.data.accessToken;
        const newRefresh = data.data.refreshToken;
        await setTokens(newAccess, newRefresh);
        processQueue(null, newAccess);
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await clearTokens();
        // Tell the app the session is gone so it dispatches signOut() and
        // returns to sign-in (handler registered in AppContainer). Without
        // this, Redux stays "authenticated" on screens whose every request
        // now fails until the next cold start. Skipped for the signout
        // endpoint itself — that flow already resets the store, and the
        // "Session expired" toast would be wrong during an intentional
        // sign-out.
        if (!url.includes('/auth/signout') && !url.includes('/auth/logout')) {
          emitSessionExpired();
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// ─── Error Extractor ────────────────────────────────
export const extractErrorMessage = (error: any): string => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data;

    // If backend returned HTML (e.g. Heroku error page), don't try to parse it
    if (typeof data === 'string' && data.includes('<!DOCTYPE')) {
      if (status === 502 || status === 503) return 'Server is temporarily unavailable. Please try again in a moment.';
      if (status === 500) return 'Internal server error. Please try again later.';
      return `Server error (${status}). Please try again later.`;
    }

    // NestJS standard: { error: { message: '...' } }
    const serverMsg = data?.error?.message;
    if (serverMsg) return serverMsg;
    // NestJS validation pipe: { message: '...' } or { message: ['...'] }
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(', ') : String(data.message);
    }
    if (status === 401) return 'Invalid email or password.';
    if (status === 429) return 'Too many requests. Please wait a moment.';
    if (status === 403) return 'You do not have permission for this action.';
    if (status === 404) return 'Resource not found.';
    if (status === 502 || status === 503) return 'Server is temporarily unavailable. Please try again in a moment.';
    if (status === 500) return 'Internal server error. Please try again later.';
    if (!error.response) return 'Network error. Please check your connection.';
  }
  return error?.message || 'An unexpected error occurred.';
};

// ─── Error Code Extractor ───────────────────────────
// The message alone cannot be branched on. Every network function here wraps
// failures as `new Error(extractErrorMessage(e))`, which flattens the server's
// `{ error: { code, message } }` down to a string and throws the code away — so
// a screen that wants to react to a SPECIFIC rejection has nothing to test. The
// auth module worked around this with its own AuthError class, which is why
// SignInScreen can route EMAIL_NOT_VERIFIED to the right screen and nothing
// else in the app can do the same. This is that pattern, generalised.



