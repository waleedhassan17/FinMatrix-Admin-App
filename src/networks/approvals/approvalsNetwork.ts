// ═══════════════════════════════════════════════════════
// FinMatrix — Approvals Network
// ═══════════════════════════════════════════════════════
// The owner's inbox and the staff member's "My requests" read the SAME
// endpoint: the server scopes it by role, returning every request to an owner
// and only their own to staff. There is no client-side filtering to get wrong.

import { api, extractErrorMessage } from '../network/apiHelpers';
import type {
  ApprovalRequest,
  ApprovalStatus,
  ApprovalType,
} from '../../models/approvalModel';

export type ApprovalFilter = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'all';

const unwrap = <T>(res: { data?: any }): T => res.data?.data ?? res.data;

/**
 * `type` narrows the list to one kind of request, for screens that want to
 * show their own pending work in context — the PO list showing the POs a staff
 * member has asked for, say. Omit it for the inbox and My Requests, which want
 * everything. The server validates it against its own APPROVAL_TYPES.
 */
export const fetchApprovals = async (
  status: ApprovalFilter = 'pending',
  type?: ApprovalType,
): Promise<ApprovalRequest[]> => {
  try {
    const response = await api.get('/approvals', {
      params: type ? { status, type } : { status },
    });
    const body = unwrap<{ data?: ApprovalRequest[] } | ApprovalRequest[]>(response);
    return Array.isArray(body) ? body : (body?.data ?? []);
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const fetchApprovalById = async (id: string): Promise<ApprovalRequest> => {
  try {
    const response = await api.get(`/approvals/${id}`);
    return unwrap<ApprovalRequest>(response);
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

/** Badge count. Owners get the whole inbox; staff get their own pending. */
export const fetchPendingApprovalCount = async (): Promise<number> => {
  try {
    const response = await api.get('/approvals/pending-count');
    return unwrap<{ count: number }>(response)?.count ?? 0;
  } catch {
    // A badge is not worth an error state — an unreachable count reads as none.
    return 0;
  }
};

/**
 * Owner only; the server 403s for anyone else.
 *
 * A rejection must carry a comment — the server enforces it, because a request
 * turned down without a reason tells the requester nothing.
 */
export const decideApproval = async (
  id: string,
  decision: 'approve' | 'reject',
  comment?: string,
): Promise<ApprovalRequest> => {
  try {
    const response = await api.post(`/approvals/${id}/decide`, { decision, comment });
    return unwrap<ApprovalRequest>(response);
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

/** Withdraw your own pending request. */
export const cancelApproval = async (id: string): Promise<ApprovalRequest> => {
  try {
    const response = await api.post(`/approvals/${id}/cancel`);
    return unwrap<ApprovalRequest>(response);
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

/**
 * Ask the owner to undo an already-approved delivery.
 *
 * The reason is required: the owner is being asked to reverse recognised
 * revenue and needs to know what happened. The server refuses without one, and
 * refuses outright when the delivery is already ledger-committed — in that
 * case the honest route is a credit memo, which staff can also request.
 */
export const requestDeliveryUndo = async (
  requestId: string,
  reason: string,
): Promise<{ requestId: string }> => {
  try {
    const response = await api.post(
      `/inventory-update-requests/${requestId}/undo`,
      { reason },
    );
    return unwrap<{ requestId: string }>(response);
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export type { ApprovalRequest, ApprovalStatus };
