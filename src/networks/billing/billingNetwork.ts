// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Payment submission review network
// ═══════════════════════════════════════════════════════
// The reviewer's half of the manual bank-transfer flow: a tenant submits a
// bill screenshot, this console approves or rejects it. Everything under
// /admin/payment-submissions.
//
// The tenant app's half of this module — billing status, plan cards and
// limits, bank details, submitting a payment, starting a trial — is not here.
// A platform admin has no company to bill, and submitPaymentAPI in particular
// was a multipart receipt upload that has no business in the console.

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import {
  api,
  API_BASE_URL,
  getAccessToken,
  extractErrorMessage,
} from '../network/apiHelpers';

// ─── Types ────────────────────────────────────────────
// Entity shapes live in models/billingModel.ts; re-exported here so
// `import { … } from 'networks/billing/billingNetwork'` keeps working.
import type {
  SubmissionStatus,
  PaymentSubmissionView,
  RevenueSummary,
  SubmissionKindFilter,
} from '../../models/billingModel';
import {
  billingEnvelopeSerializer,
  submissionListSerializer,
} from '../../serializers/billingSerializer';

export type {
  PlanKey,
  TierPlanCard,
  SubmissionKind,
  SubmissionStatus,
  BillingStatus,
  PlanLimits,
  BankDetails,
  PaymentSubmissionView,
  RevenueSummary,
  StartTrialResult,
  SubmissionKindFilter,
} from '../../models/billingModel';

const unwrap = billingEnvelopeSerializer;

// ─── Super-admin review ───────────────────────────────

export const listPaymentSubmissionsAPI = async (
  status?: SubmissionStatus,
  filters: { kind?: SubmissionKindFilter; order?: 'asc' | 'desc' } = {},
): Promise<PaymentSubmissionView[]> => {
  try {
    const res = await api.get('/admin/payment-submissions', {
      params: {
        ...(status ? { status } : {}),
        ...(filters.kind ? { kind: filters.kind } : {}),
        ...(filters.order ? { order: filters.order } : {}),
      },
    });
    return submissionListSerializer(res);
  } catch (e) {
    throw new Error(extractErrorMessage(e));
  }
};

/** Platform revenue collected from approved submissions. */
export const getPlatformRevenueAPI = async (): Promise<RevenueSummary> => {
  try {
    const res = await api.get('/admin/payment-submissions/revenue/summary');
    return unwrap(res);
  } catch (e) {
    throw new Error(extractErrorMessage(e));
  }
};

export const approvePaymentSubmissionAPI = async (
  id: string,
): Promise<PaymentSubmissionView> => {
  try {
    const res = await api.patch(`/admin/payment-submissions/${id}/approve`);
    return unwrap(res);
  } catch (e) {
    throw new Error(extractErrorMessage(e));
  }
};

/**
 * Reject a submission. `blockFutureTrials` applies to TRIAL requests only:
 * false (default) frees the email/phone to ask again; true refuses future
 * trials for them permanently.
 */
export const rejectPaymentSubmissionAPI = async (
  id: string,
  reason: string,
  blockFutureTrials?: boolean,
): Promise<PaymentSubmissionView> => {
  try {
    const res = await api.patch(`/admin/payment-submissions/${id}/reject`, {
      reason,
      ...(blockFutureTrials ? { blockFutureTrials: true } : {}),
    });
    return unwrap(res);
  } catch (e) {
    throw new Error(extractErrorMessage(e));
  }
};

/**
 * The screenshot endpoint is auth-gated. React Native's <Image source={{ uri,
 * headers }} /> does NOT reliably attach auth headers, and fetch→blob→FileReader
 * base64 is unreliable for binary in RN. The robust path is a NATIVE download
 * (expo-file-system) that sends the bearer token and writes the real bytes to
 * disk; <Image source={{ uri: file://… }} /> then always renders it.
 * Returns a local file:// URI.
 *
 * The tenant version took a `scope` of 'admin' | 'company' to pick between two
 * endpoints and to decide whether to send x-company-id. Here there is only the
 * admin endpoint, and a platform admin has no company id to send.
 */
export const downloadSubmissionScreenshot = async (id: string): Promise<string> => {
  const token = await getAccessToken();
  const path = `/admin/payment-submissions/${id}/screenshot`;
  const headers = { Authorization: token ? `Bearer ${token}` : '' };

  const notAvailable = (status: number) =>
    new Error(
      status === 404
        ? 'Screenshot is no longer available.'
        : `Could not load screenshot (${status}).`,
    );

  if (Platform.OS === 'web') {
    // expo-file-system has no web implementation — fetch with auth headers
    // and hand <Image> an object URL instead.
    const res = await fetch(`${API_BASE_URL}${path}`, { headers });
    if (!res.ok) throw notAvailable(res.status);
    return URL.createObjectURL(await res.blob());
  }

  const dest = `${FileSystem.cacheDirectory}pay-screenshot-${id}-${Date.now()}.img`;
  const result = await FileSystem.downloadAsync(`${API_BASE_URL}${path}`, dest, { headers });
  if (result.status >= 400) throw notAvailable(result.status);
  return result.uri;
};
