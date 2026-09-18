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
export const extractErrorCode = (error: any): string | undefined => {
  if (axios.isAxiosError(error)) {
    const data: any = error.response?.data;
    // NestJS standard is { error: { code } }; some handlers put it at the top.
    return data?.error?.code ?? data?.code;
  }
  return error?.code;
};

/**
 * An Error that survives the trip to a screen with its server code intact.
 *
 * `code` matters beyond convenience: RTK's `miniSerializeError` copies exactly
 * name/message/stack/**code** off a thrown error, so a code set here is still
 * readable after `.unwrap()` on an async thunk. Any other property you attach
 * is dropped there.
 */
export class ApiError extends Error {
  code?: string;
  status?: number;
  /** The server's structured `error.details` (e.g. a credit-limit breakdown or
   *  the backorder shortfalls). NOT preserved through RTK `.unwrap()` — read
   *  it where the network function is awaited directly. */
  details?: any;
  constructor(message: string, code?: string, status?: number, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * Wrap a caught axios error, keeping both the readable message and the code.
 * Drop-in replacement for `new Error(extractErrorMessage(e))`.
 *
 * Note for anyone combining this with `withNetworkRetry`: that helper decides
 * "was this a network failure?" by testing `!e.response`, and an ApiError has
 * no `.response`. Retry on the RAW axios error, then convert — never the other
 * way round, or every server rejection looks like a dropped connection.
 */
export const toApiError = (error: any): ApiError =>
  new ApiError(
    extractErrorMessage(error),
    extractErrorCode(error),
    axios.isAxiosError(error) ? error.response?.status : undefined,
    axios.isAxiosError(error)
      ? (error.response?.data as any)?.error?.details ?? (error.response?.data as any)?.details
      : undefined,
  );

// ─── Multipart Upload (fetch, NOT axios) ────────────
// React Native must set the `multipart/form-data; boundary=...` header itself.
// Routing FormData through axios with a manually-set Content-Type drops the
// boundary, so the server's multer parser never sees the file ("photo file is
// required"). Same root cause + fix as billingNetwork.submitPaymentAPI — kept
// here so every upload in the app shares one correct implementation.

/**
 * Append a picked image to a FormData under `field`.
 * Handles the web platform, where the RN `{uri,name,type}` trick serializes
 * to "[object Object]" — there the blob:/data: URI is resolved to a real Blob.
 */
export const appendImageToForm = async (
  form: FormData,
  field: string,
  uri: string,
  opts: { name?: string; type?: string } = {},
): Promise<void> => {
  const filename = opts.name ?? uri.split('/').pop()?.split('?')[0] ?? `photo_${Date.now()}.jpg`;
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mime =
    opts.type ?? (ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg');
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    (form as any).append(field, blob, filename);
  } else {
    form.append(field, {
      uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
      name: filename,
      type: mime,
    } as any);
  }
};

/** POST a FormData with auth + company headers. Resolves to the parsed JSON body. */
export const postMultipart = async (path: string, form: FormData): Promise<any> => {
  const token = await getAccessToken();
  const companyId = await getStoredCompanyId();
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(companyId ? { 'x-company-id': companyId } : {}),
        // deliberately NO Content-Type — RN adds the multipart boundary itself
      },
      body: form as any,
    });
  } catch {
    throw new Error('Network error. Please check your connection.');
  }
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (res.status === 401) emitSessionExpired();
  if (!res.ok) {
    const raw = json?.error?.message ?? json?.message;
    const msg = Array.isArray(raw) ? raw.join(', ') : raw;
    const err: any = new Error(
      typeof msg === 'string' && msg ? msg : `Upload failed (${res.status}). Please try again.`,
    );
    // Mark as an HTTP (not network) failure so retry helpers that check
    // `!error.response` don't replay 4xx/5xx responses.
    err.response = { status: res.status, data: json };
    throw err;
  }
  return json;
};
