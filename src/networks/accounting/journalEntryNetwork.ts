// ═══════════════════════════════════════════════════════
// FinMatrix — Journal Entry (General Journal) Network (Production API)
// ═══════════════════════════════════════════════════════
import { api, extractErrorMessage } from '../network/apiHelpers';

const wrap = async (p: Promise<any>) => {
  try { return (await p).data; } catch (e: any) { throw new Error(extractErrorMessage(e)); }
};

export const getJournalEntriesAPI = (params: any = {}) => wrap(api.get('/journal-entries', { params }));
export const getJournalEntryByIdAPI = (id: string) => wrap(api.get(`/journal-entries/${id}`));
export const createJournalEntryAPI = (data: any) => wrap(api.post('/journal-entries', data));
export const postJournalEntryAPI = (id: string) => wrap(api.post(`/journal-entries/${id}/post`, {}));
export const voidJournalEntryAPI = (id: string, reason: string) =>
  wrap(api.post(`/journal-entries/${id}/void`, { reason }));
