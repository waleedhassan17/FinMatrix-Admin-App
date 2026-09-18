import { api, extractErrorMessage } from '../network/apiHelpers';
const wrap = async (p: Promise<any>) => { try { return (await p).data; } catch (e: any) { throw new Error(extractErrorMessage(e)); } };
export const getEmployeesAPI = (params: any = {}) => wrap(api.get('/employees', { params }));
export const getEmployeeByIdAPI = (id: string) => wrap(api.get(`/employees/${id}`));
export const createEmployeeAPI = (data: any) => wrap(api.post('/employees', data));
export const updateEmployeeAPI = (id: string, data: any) => wrap(api.patch(`/employees/${id}`, data));
export const deleteEmployeeAPI = (id: string) => wrap(api.delete(`/employees/${id}`));
export const getPayrollRunsAPI = () => wrap(api.get('/payroll/runs'));
export const getPayrollRunByIdAPI = (id: string) => wrap(api.get(`/payroll/runs/${id}`));
export const createPayrollRunAPI = (data: any) => wrap(api.post('/payroll/runs', data));
export const processPayrollRunAPI = (id: string) => wrap(api.post(`/payroll/runs/${id}/process`, {}));
// Official PDF payslip (backend-rendered; figures tie to the posted entry).
export const getPayslipPdfAPI = async (runId: string, employeeId: string): Promise<Blob> => {
  try {
    const res = await api.get(`/payroll/runs/${runId}/payslip/${employeeId}/pdf`, { responseType: 'blob' });
    return res.data;
  } catch (e: any) { throw new Error(extractErrorMessage(e)); }
};
export const deletePayrollRunAPI = (id: string) => wrap(api.delete(`/payroll/runs/${id}`));
