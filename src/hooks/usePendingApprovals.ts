import { useCallback, useState } from 'react';
import { useCapability } from './useCapability';
import { fetchApprovals } from '../networks/approvals/approvalsNetwork';
import type { ApprovalRequest, ApprovalType } from '../models/approvalModel';
import type { Capability } from '../utils/capabilities';

/**
 * The requests the signed-in user is currently waiting on the owner for.
 *
 * Three screens had hand-rolled this: the PO list's "waiting for approval"
 * strip, the inventory item's PO tab, and now the invoice list and invoice
 * detail. They all repeat the same three things, and getting any of them wrong
 * is quiet rather than loud:
 *
 *   • the capability gate — an owner has no pending requests of their own, and
 *     an unfiltered GET /approvals would hand them the whole company inbox;
 *   • the type filter, which the server validates;
 *   • failing soft, because this is always supplementary to a screen that has
 *     its own job, and losing the strip beats blanking the rows beneath it.
 *
 * `inventoryDetailSlice` keeps its own copy: it shares a requestId stale guard
 * with the purchase-order fetch beside it, which a hook cannot reach.
 */
export const usePendingApprovals = (type: ApprovalType, capability: Capability) => {
  const cap = useCapability(capability);
  const showsPending = cap.needsApproval;
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);

  const reload = useCallback(async () => {
    if (!showsPending) {
      setRequests([]);
      return;
    }
    try {
      setRequests(await fetchApprovals('pending', type));
    } catch {
      setRequests([]);
    }
  }, [showsPending, type]);

  return { requests, reload, showsPending };
};
