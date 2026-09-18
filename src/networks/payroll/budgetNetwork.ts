import { api, extractErrorMessage } from '../network/apiHelpers';
const wrap = async (p: Promise<any>) => { try { return (await p).data; } catch (e: any) { throw new Error(extractErrorMessage(e)); } };
export const getBudgetsAPI = (params: any = {}) => wrap(api.get('/budgets', { params }));
export const getBudgetByIdAPI = (id: string) => wrap(api.get(`/budgets/${id}`));
export const getBudgetVsActualAPI = (id: string) => wrap(api.get(`/budgets/${id}/vs-actual`));
/** QuickBooks "from previous year's data": per-account monthly actuals. */
export const getBudgetPrefillAPI = async (fiscalYear: number): Promise<any> => {
  try {
    const res = await api.get('/budgets/prefill', { params: { fiscalYear } });
    return res.data?.data ?? res.data;
  } catch (e: any) {
    throw new Error(extractErrorMessage(e));
  }
};

export const createBudgetAPI = (data: any) => wrap(api.post('/budgets', data));
export const updateBudgetAPI = (id: string, data: any) => wrap(api.patch(`/budgets/${id}`, data));
export const deleteBudgetAPI = (id: string) => wrap(api.delete(`/budgets/${id}`));
