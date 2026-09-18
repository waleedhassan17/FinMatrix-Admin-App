// ═══════════════════════════════════════════════════════
// FinMatrix — Settings Network (Production API)
// ═══════════════════════════════════════════════════════

import { api, extractErrorMessage, getStoredCompanyId } from '../network/apiHelpers';
import {
  preferencesResponseSerializer,
  companiesResponseSerializer,
} from '../../serializers/settingsSerializer';
import type { CompanyProfilePayload } from '../../models/settingsModel';

// Entity shapes live in models/settingsModel.ts; re-exported here so
// existing imports from this module keep working.
export type {
  CompanyProfilePayload,
  CompanySwitcherItem,
} from '../../models/settingsModel';

export const getSettingsAPI = async (): Promise<any> => {
  try {
    const response = await api.get('/settings');
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const updateSettingsAPI = async (data: any): Promise<any> => {
  try {
    const response = await api.patch('/settings', data);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const getAllUsersAPI = async (): Promise<any> => {
  try {
    const response = await api.get('/settings/users');
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const inviteUserAPI = async (data: { email: string; role: string; displayName?: string }): Promise<any> => {
  try {
    const response = await api.post('/settings/users/invite', data);
    return response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

// ─── Aliases used by settingsSlice ──────────────────
export const fetchPreferences = async (): Promise<any> => {
  const res = await getSettingsAPI();
  return preferencesResponseSerializer(res);
};

export const savePreferences = async (preferences: any): Promise<any> => {
  const res = await updateSettingsAPI({ preferences });
  return res?.data?.preferences ?? res?.data ?? preferences;
};

/**
 * Persist the Company Profile onto the COMPANY RECORD (PATCH /companies/:id)
 * — the identity printed on invoices, statements and payslips. The previous
 * implementation PATCHed /settings, which writes the CompanySettings
 * preferences table: the profile silently never saved, so documents fell
 * back to placeholder branding.
 */
const FISCAL_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** The company stores the fiscal year start as a month number (1 = January); the form carries its name. */
const fiscalMonthNumber = (name?: string): number | undefined => {
  const i = FISCAL_MONTH_NAMES.indexOf(name ?? '');
  return i >= 0 ? i + 1 : undefined;
};

export const saveCompanyProfile = async (
  data: CompanyProfilePayload & {
    city?: string; state?: string; zipCode?: string; country?: string; website?: string;
    fiscalYearStart?: string;
  },
): Promise<any> => {
  const companyId = await getStoredCompanyId();
  if (!companyId) throw new Error('No active company.');
  // Empty strings fail backend field validators (@IsEmail etc.) — send only
  // filled values; address travels as the nested DTO shape.
  const clean = (v?: string) => (v && v.trim() !== '' ? v.trim() : undefined);
  const payload: Record<string, unknown> = {
    name: clean(data.name),
    industry: clean(data.industry),
    phone: clean(data.phone),
    email: clean(data.email),
    website: clean(data.website),
    taxId: clean(data.taxId),
    // The Company Profile screen has always shown a fiscal-year control, but
    // nothing sent it — the choice was lost on save. It lives on the company
    // record, the same field the web console writes.
    fiscalYearStartMonth: fiscalMonthNumber(data.fiscalYearStart),
  };
  const address = {
    street: clean(data.address),
    city: clean(data.city),
    state: clean(data.state),
    postalCode: clean(data.zipCode),
    country: clean(data.country),
  };
  if (Object.values(address).some(v => v !== undefined)) payload.address = address;
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
  try {
    const response = await api.patch(`/companies/${companyId}`, payload);
    return response.data?.data ?? response.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const fetchCompanies = async (): Promise<any> => {
  try {
    const response = await api.get('/auth/me');
    return companiesResponseSerializer(response.data);
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};


// ═══════════════════════════════════════════════════════
// Team management (/settings/users)
// ═══════════════════════════════════════════════════════
// Owner-only on the server. Staff are created with a USERNAME and a password
// the owner chooses and hands over — there is no invite email, because a
// warehouse hand may have no inbox and the owner is the custodian of the
// credential either way.

export interface CompanyUser {
  id: string;
  name: string;
  username: string | null;
  email: string | null;
  role: 'admin' | 'staff';
  status: 'active' | 'inactive';
  /** Whether a shareable password is on file for this account. */
  hasStoredCredential: boolean;
}

export interface IssuedCredentials {
  username: string;
  password: string;
}

const unwrapData = <T>(res: { data?: any }): T => res.data?.data ?? res.data;

export const listCompanyUsers = async (): Promise<CompanyUser[]> => {
  try {
    const response = await api.get('/settings/users');
    const body = unwrapData<{ data?: CompanyUser[] } | CompanyUser[]>(response);
    return Array.isArray(body) ? body : (body?.data ?? []);
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const createCompanyUser = async (payload: {
  name: string;
  username: string;
  password: string;
  role: 'admin' | 'staff';
  email?: string;
  phone?: string;
}): Promise<CompanyUser & { credentials: IssuedCredentials }> => {
  try {
    const response = await api.post('/settings/users', payload);
    return unwrapData(response);
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const changeCompanyUserRole = async (
  userId: string,
  role: 'admin' | 'staff',
): Promise<CompanyUser> => {
  try {
    const response = await api.patch(`/settings/users/${userId}/role`, { role });
    return unwrapData(response);
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

/**
 * Accounts are deactivated, never deleted — the ledger references them, and a
 * removed user would leave entries attributed to nobody.
 */
export const setCompanyUserActive = async (
  userId: string,
  isActive: boolean,
): Promise<CompanyUser> => {
  try {
    const response = await api.patch(
      `/settings/users/${userId}/${isActive ? 'activate' : 'deactivate'}`,
    );
    return unwrapData(response);
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

/**
 * Re-issue a password and get it back once, to read out to its holder. The
 * only recovery path for an owner-created account: there is no self-service
 * reset, because the account has no inbox to send one to.
 */
export const resetCompanyUserPassword = async (
  userId: string,
  password?: string,
): Promise<{ userId: string; username: string | null; password: string }> => {
  try {
    const response = await api.post(
      `/settings/users/${userId}/reset-password`,
      password ? { password } : {},
    );
    return unwrapData(response);
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

/** Show the stored password again. Audited server-side on every read. */
export const revealCompanyUserCredential = async (
  userId: string,
): Promise<{ userId: string; username: string | null; password: string | null }> => {
  try {
    const response = await api.get(`/settings/users/${userId}/credential`);
    return unwrapData(response);
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

/**
 * A readable password the owner can dictate over the phone: no 0/O/1/l/I, and
 * a digit plus mixed case so it satisfies the server's policy. The server can
 * also generate one — this exists so the owner sees it before submitting.
 */
export const generatePassword = (): string => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  // A password is a secret: draw from the platform's CSPRNG (polyfilled at
  // startup by react-native-get-random-values), not Math.random, whose output
  // is predictable. Math.random stays only as a fallback if the polyfill is absent.
  const randomIndex = (n: number): number => {
    const cryptoApi = (globalThis as { crypto?: { getRandomValues?: (a: Uint32Array) => Uint32Array } }).crypto;
    if (cryptoApi?.getRandomValues) {
      const buf = new Uint32Array(1);
      cryptoApi.getRandomValues(buf);
      return buf[0] % n;
    }
    return Math.floor(Math.random() * n);
  };
  const pick = (set: string, n: number) =>
    Array.from({ length: n }, () => set[randomIndex(set.length)]).join('');
  return `${pick(upper, 1)}${pick(lower, 5)}${pick(digits, 2)}${pick(upper, 1)}${pick(lower, 2)}`;
};

// ─── Deprecated aliases ─────────────────────────────
// Kept so nothing breaks mid-refactor; prefer the named functions above.

export const fetchUsers = async (): Promise<CompanyUser[]> => listCompanyUsers();

export const updateUserRole = async (userId: string, role: string) =>
  changeCompanyUserRole(userId, role === 'admin' ? 'admin' : 'staff');

/** Deactivates rather than deletes — see setCompanyUserActive. */
export const removeUser = async (userId: string) =>
  setCompanyUserActive(userId, false);

export const inviteUser = async (emailOrData: string | { email: string; role: string; displayName?: string }, role?: string): Promise<any> => {
  if (typeof emailOrData === 'string') {
    return inviteUserAPI({ email: emailOrData, role: role ?? 'member', displayName: emailOrData });
  }
  return inviteUserAPI(emailOrData);
};
