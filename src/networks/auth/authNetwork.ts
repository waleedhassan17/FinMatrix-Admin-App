// ═══════════════════════════════════════════════════════
// FinMatrix — Auth Network (Production API)
// ═══════════════════════════════════════════════════════

import { api, setTokens, setStoredCompanyId, clearTokens, getAccessToken, extractErrorMessage } from '../network/apiHelpers';
import { clearIntentionalSignOut } from '../../utils/authEvents';
import { userResponseSerializer } from '../../serializers/authSerializer';
import { normalizePkPhone } from '../../utils/phone';

// ─── Types ────────────────────────────────────────────

export interface SignInPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface DeliverySignInPayload {
  username: string;
  password: string;
}

export interface VerifyEmailPayload {
  email: string;
}

export interface ResendVerificationPayload {
  email: string;
}

export interface CheckVerificationPayload {
  email: string;
}

// Backend→app user mapping lives in serializers/authSerializer.ts.
const mapUser = userResponseSerializer;

// Error augmented with a backend error code (used to detect EMAIL_NOT_VERIFIED).
export class AuthError extends Error {
  code?: string;
  email?: string;
  companyStatus?: string | null;
  rejectionReason?: string | null;
  /** COMPANY_PENDING only: what is in review — a free-trial request or a payment. */
  pendingKind?: 'trial' | 'payment' | null;
  constructor(
    message: string,
    code?: string,
    email?: string,
    extra?: {
      companyStatus?: string | null;
      rejectionReason?: string | null;
      pendingKind?: 'trial' | 'payment' | null;
    },
  ) {
    super(message);
    this.code = code;
    this.email = email;
    this.companyStatus = extra?.companyStatus ?? null;
    this.rejectionReason = extra?.rejectionReason ?? null;
    this.pendingKind = extra?.pendingKind ?? null;
  }
}

// Login-gate codes the server returns when a company is not active.
const LOGIN_GATE_CODES = ['COMPANY_PENDING', 'COMPANY_INACTIVE', 'COMPANY_REJECTED'];

// ─── Login ────────────────────────────────────────────

export const authLogin = async ({
  signInInfo,
}: {
  signInInfo: SignInPayload;
}) => {
  try {
    // `identifier` accepts a username OR an email. `email` is still sent so a
    // server that predates the username login keeps working.
    const identifier = signInInfo.email.trim();
    const response = await api.post('/auth/signin', {
      identifier,
      email: identifier,
      password: signInInfo.password,
      // The Business Portal admits owners (and the platform console) only: a
      // staff or rider account typed in here is refused with WRONG_PORTAL
      // before any token is issued.
      portal: 'admin',
    });
    const responseData = response.data?.data ?? response.data;
    const { user: backendUser, tokens, companyId, companyStatus, companyType, features, subscription } = responseData;
    if (!tokens?.accessToken) {
      throw new Error('Login succeeded but no token received. Please try again.');
    }
    // Store tokens
    await setTokens(tokens.accessToken, tokens.refreshToken);
    // A new session starts: its 401s are real and must be handled.
    clearIntentionalSignOut();
    if (companyId) {
      await setStoredCompanyId(companyId);
    }
    const user = mapUser(backendUser, companyStatus, { companyType, features, subscription });
    return { data: user };
  } catch (e: any) {
    console.warn('[authLogin] error:', e?.response?.status, e?.response?.data ?? e?.message);
    // Surface the EMAIL_NOT_VERIFIED gate so the UI can route to verification.
    const body = e?.response?.data;
    const err = body?.error ?? body ?? {};
    const code = err.code ?? body?.code;
    if (code === 'EMAIL_NOT_VERIFIED') {
      throw new AuthError(
        'Please verify your email before signing in.',
        'EMAIL_NOT_VERIFIED',
        err.email ?? body?.email,
      );
    }
    // Company-status login gate: pending / inactive / rejected → route to the
    // correct screen with the reason.
    if (LOGIN_GATE_CODES.includes(code)) {
      throw new AuthError(err.message ?? 'Sign in is not available yet.', code, err.email, {
        companyStatus: err.companyStatus ?? null,
        rejectionReason: err.rejectionReason ?? null,
        // The exception filter keeps only `details`, so that is where the
        // server says whether a trial request or a payment is in review.
        pendingKind:
          err.details?.pendingKind === 'trial' || err.details?.pendingKind === 'payment'
            ? err.details.pendingKind
            : null,
      });
    }
    throw new Error(extractErrorMessage(e));
  }
};

// ─── Username login (staff and delivery riders) ──────
//
// Owner-created accounts sign in with a username, never an email: the owner
// creates them and hands the credentials over, so there is no inbox involved.
// Same endpoint and same response shape as the owner's email login — the
// SERVER decides the role from the account, so the tab the user picked on the
// sign-in screen sets expectations but never authority.

export const authDeliveryLogin = async ({
  signInInfo,
}: {
  signInInfo: DeliverySignInPayload;
}) => {
  try {
    const identifier = signInInfo.username.trim();
    const response = await api.post('/auth/signin', {
      identifier,
      email: identifier,
      password: signInInfo.password,
      // The User Portal admits staff and riders; an owner's email typed in here
      // is refused with WRONG_PORTAL and pointed at the Business Portal.
      portal: 'team',
    });
    const responseData = response.data?.data ?? response.data;
    const { user: backendUser, tokens, companyId, companyStatus, companyType, features, subscription } =
      responseData;
    if (!tokens?.accessToken) {
      throw new Error('Login succeeded but no token received. Please try again.');
    }
    await setTokens(tokens.accessToken, tokens.refreshToken);
    // A new session starts: its 401s are real and must be handled.
    clearIntentionalSignOut();
    if (companyId) {
      await setStoredCompanyId(companyId);
    }
    // Staff need companyStatus/companyType/features exactly as an owner does —
    // they mount a company navigator and their tier gates the same rows. The
    // rider path never used them, which is why they were dropped here.
    const user = mapUser(backendUser, companyStatus, { companyType, features, subscription });
    return { data: user };
  } catch (e: any) {
    console.warn('[authDeliveryLogin] error:', e?.response?.status, e?.response?.data ?? e?.message);
    throw new Error(extractErrorMessage(e));
  }
};

// ─── Register ─────────────────────────────────────────

export const authRegister = async ({
  registerInfo,
}: {
  registerInfo: RegisterPayload;
}) => {
  try {
    const response = await api.post('/auth/signup', {
      email: registerInfo.email.trim(),
      password: registerInfo.password,
      displayName: registerInfo.fullName.trim(),
      // Canonical +92XXXXXXXXXX, or omitted entirely when blank — posting ''
      // would fail the server's optional-phone check (@IsOptional only skips
      // undefined/null).
      phone: normalizePkPhone(registerInfo.phone),
      role: 'admin',
    });
    const { user: backendUser, tokens, companyId, companyStatus, companyType, features, subscription } = response.data.data;
    await setTokens(tokens.accessToken, tokens.refreshToken);
    // A new session starts: its 401s are real and must be handled.
    clearIntentionalSignOut();
    if (companyId) {
      await setStoredCompanyId(companyId);
    }
    const user = mapUser(backendUser, companyStatus, { companyType, features, subscription });
    return { data: user };
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

// ─── Get Current User (Me) ───────────────────────────

export const authMe = async () => {
  try {
    const response = await api.get('/auth/me');
    const { user: backendUser, companies, companyId, companyStatus, companyType, features, subscription } = response.data.data;
    const user = mapUser(backendUser, companyStatus, { companyType, features, subscription });
    return { data: { user, companies, companyId } };
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

// ─── Sign Out ─────────────────────────────────────────

export const authSignOut = async () => {
  // Capture the token BEFORE clearing: the request interceptor only attaches
  // Authorization from storage, so clearing first would post an anonymous
  // request and the server could never revoke the session. Passing it
  // explicitly lets the local sign-out complete immediately while revocation
  // still happens.
  const accessToken = await getAccessToken();

  // Local sign-out first, and it must not depend on the network: tokens are
  // gone whether or not the request ever lands.
  await clearTokens();

  // Nothing to revoke (already signed out) — keeps repeat calls idempotent.
  if (!accessToken) return;

  try {
    // Short timeout: revocation is best-effort. Callers no longer await this,
    // but a bounded request still avoids a socket lingering for the client's
    // default 30s.
    await api.post('/auth/signout', undefined, {
      timeout: 8000,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    // Ignore errors on signout — the session is already gone locally.
  }
};

// ─── Forgot Password ─────────────────────────────────

export const authForgotPassword = async ({
  forgotPasswordInfo,
}: {
  forgotPasswordInfo: ForgotPasswordPayload;
}) => {
  try {
    const response = await api.post('/auth/forgot-password', {
      email: forgotPasswordInfo.email.trim(),
    });
    return { data: response.data };
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

// ─── Forgot Password: Verify OTP ─────────────────────
// Returns a single-use resetToken used to set the new password.

export const authVerifyOtp = async (email: string, otp: string) => {
  try {
    const response = await api.post('/auth/verify-otp', { email: email.trim(), otp });
    const data = response.data?.data ?? response.data;
    return { resetToken: data.resetToken as string };
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

// ─── Reset Password (with OTP reset token) ───────────

export const authResetPassword = async (
  email: string,
  resetToken: string,
  password: string,
) => {
  try {
    const response = await api.post('/auth/reset-password', {
      email: email.trim(),
      resetToken,
      password,
    });
    return { data: response.data };
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

// ─── Verify Email (deep-link token) ──────────────────
// Accepts a raw token string (deep link) or the legacy { verifyEmailInfo }
// object shape still used by emailVerificationSlice.
export const authVerifyEmail = async (
  arg: string | { verifyEmailInfo: VerifyEmailPayload },
) => {
  const token = typeof arg === 'string' ? arg : '';
  try {
    const response = await api.post('/auth/verify-email', { token });
    const data = response.data?.data ?? response.data;
    return { data };
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

// ─── Resend Verification ──────────────────────────────

export const authResendVerification = async ({
  resendInfo,
}: {
  resendInfo: ResendVerificationPayload;
}) => {
  try {
    const response = await api.post('/auth/resend-verification', {
      email: resendInfo.email.trim(),
    });
    return { data: response.data };
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

// ─── Check Verification Status (via /auth/me) ────────

export const authCheckVerificationStatus = async (_args?: unknown) => {
  try {
    const response = await api.get('/auth/me');
    const data = response.data?.data ?? response.data;
    return { data: { verified: Boolean(data?.user?.isEmailVerified) } };
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

// ─── Company APIs ─────────────────────────────────────

export interface CreateCompanyData {
  name: string;
  industry?: string;
  /** Three-tier model: small_business | large_org | warehouse. */
  companyType?: string;
  legalStructure?: string;
  // Accepts a structured address (preferred) or a legacy concatenated string.
  address?:
    | string
    | {
        street?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
      };
  phone?: string;
  email?: string;
  website?: string;
  taxId?: string;
  fiscalYearStartMonth?: number;
  // accountingMethod removed: reports are accrual-basis only and the server
  // now sets the field itself. Nothing here ever sent it.
  homeCurrency?: string;
  logo?: string;
}

export const createCompanyAPI = async (data: CreateCompanyData) => {
  try {
    const response = await api.post('/companies', data);
    return response.data.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

// ─── Submit company onboarding for platform-admin approval (Step C) ──────────

export const submitCompanyAPI = async (companyId: string) => {
  try {
    const response = await api.post(`/companies/${companyId}/submit`);
    return response.data?.data ?? response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const joinCompanyAPI = async (inviteCode: string) => {
  try {
    const response = await api.post('/companies/join', { inviteCode });
    return response.data.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const getCompanyAPI = async (companyId: string) => {
  try {
    const response = await api.get(`/companies/${companyId}`);
    return response.data.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const updateCompanyAPI = async (companyId: string, data: any) => {
  try {
    const response = await api.patch(`/companies/${companyId}`, data);
    return response.data.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const getCompanyMembersAPI = async (companyId: string) => {
  try {
    const response = await api.get(`/companies/${companyId}/members`);
    return response.data.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const removeCompanyMemberAPI = async (companyId: string, userId: string) => {
  try {
    const response = await api.delete(`/companies/${companyId}/members/${userId}`);
    return response.data.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const regenerateInviteCodeAPI = async (companyId: string) => {
  try {
    const response = await api.post(`/companies/${companyId}/regenerate-code`);
    return response.data.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const registerAdminCreatedPersonnel = async (info: any): Promise<any> => {
  try {
    const response = await api.post('/delivery-personnel', {
      email: info.email,
      username: info.username,
      password: info.password,
      name: info.user?.displayName ?? info.email?.split('@')[0],
      phone: info.user?.phoneNumber ?? '',
      companyId: info.user?.companyId,
      vehicleType: info.vehicleType ?? 'motorcycle',
      vehicleNumber: info.vehicleNumber ?? '',
      zones: info.zones ?? [],
      maxLoad: info.maxLoad ?? 10,
    });
    return response.data;
  } catch (e: any) {
    console.warn('[registerAdminCreatedPersonnel] error:', e?.response?.status, e?.response?.data ?? e?.message);
    throw new Error(extractErrorMessage(e));
  }
};
