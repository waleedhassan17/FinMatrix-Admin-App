// ═══════════════════════════════════════════════════════
// FinMatrix — Vendor Credit Network (Production API)
// ═══════════════════════════════════════════════════════
import { api, extractErrorMessage } from '../network/apiHelpers';

const wrap = async (p: Promise<any>) => {
  try { return (await p).data; } catch (e: any) { throw new Error(extractErrorMessage(e)); }
};

export const getVendorCreditsAPI = (params: any = {}) => wrap(api.get('/vendor-credits', { params }));
export const getVendorCreditByIdAPI = (id: string) => wrap(api.get(`/vendor-credits/${id}`));
export const createVendorCreditAPI = (data: any) => wrap(api.post('/vendor-credits', data));
export const applyVendorCreditAPI = (id: string, billId: string, amount: string) =>
  wrap(api.post(`/vendor-credits/${id}/apply`, { billId, amount }));
export const voidVendorCreditAPI = (id: string) => wrap(api.post(`/vendor-credits/${id}/void`, {}));
export const deleteVendorCreditAPI = (id: string) => wrap(api.delete(`/vendor-credits/${id}`));
