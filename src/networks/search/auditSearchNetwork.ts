// ═══════════════════════════════════════════════════════
// FinMatrix — Audit & Search Network (Production API)
// ═══════════════════════════════════════════════════════

import { api, extractErrorMessage } from '../network/apiHelpers';

export interface AuditFilters {
  module?: string;
  resourceType?: string;
  userId?: string;
  action?: string;
  page?: number;
  limit?: number;
  [key: string]: unknown;
}

export const getAuditEntriesAPI = async (params: AuditFilters = {}): Promise<unknown> => {
  try {
    const response = await api.get('/audit', { params });
    return response.data;
  } catch (e) {
    throw new Error(extractErrorMessage(e));
  }
};

export const getAuditByResourceAPI = async (type: string, id: string): Promise<unknown> => {
  try {
    const response = await api.get(`/audit/resource/${type}/${id}`);
    return response.data;
  } catch (e) {
    throw new Error(extractErrorMessage(e));
  }
};

export const fetchAuditTrail = async (params: AuditFilters = {}): Promise<unknown> => {
  return getAuditEntriesAPI(params);
};

/** `/search` → `{ query, results: { customers, vendors, invoices, bills,
 *  inventory } }`. Errors surface: a failed search has to look different
 *  from a search that genuinely found nothing. Buckets are tier-gated
 *  server-side, so the response shape varies by company type — the
 *  serializer, not this layer, is what makes it safe to render. */
export const searchAll = async (query: string): Promise<unknown> => {
  try {
    const response = await api.get('/search', { params: { q: query } });
    return response.data;
  } catch (e) {
    throw new Error(extractErrorMessage(e));
  }
};
