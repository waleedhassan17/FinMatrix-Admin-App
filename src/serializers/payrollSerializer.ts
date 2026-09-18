import type { Employee, PayrollRun, PayrollItem, PayType, EmployeeStatus, PayrollStatus } from '../models/payrollModel';
const toNum = (v: any): number => { if (typeof v === 'number') return v; const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const arrayFrom = (payload: any): any[] => { const d = payload?.data ?? payload; if (Array.isArray(d)) return d; if (Array.isArray(d?.data)) return d.data; return []; };
export const mapEmployee = (r: any): Employee => ({
  id: r.id ?? '', firstName: r.firstName ?? '', lastName: r.lastName ?? '', email: r.email ?? '', phone: r.phone ?? '',
  department: r.department ?? '', position: r.position ?? '', hireDate: r.hireDate ?? null,
  status: (r.status ?? 'active') as EmployeeStatus, payType: (r.payType ?? 'salary') as PayType,
  salary: toNum(r.salary), hourlyRate: toNum(r.hourlyRate), payFrequency: r.payFrequency ?? 'monthly',
  deductionAmount: toNum(r.deductions?.amount),
});
export const employeeListSerializer = (p: any): Employee[] => arrayFrom(p).map(mapEmployee);
export const employeeSingleSerializer = (p: any): Employee | null => { const r = p?.data ?? p; if (!r || Array.isArray(r) || !r.id) return null; return mapEmployee(r); };
const mapItem = (r: any): PayrollItem => ({ id: r.id, employeeId: r.employeeId ?? '', employeeName: r.employeeName ?? '', hours: toNum(r.hours), gross: toNum(r.gross), deductions: toNum(r.deductions), net: toNum(r.net) });
export const mapRun = (r: any): PayrollRun => ({
  id: r.id ?? '', payPeriod: r.payPeriod ?? '', periodStart: r.periodStart ?? '', periodEnd: r.periodEnd ?? '', payDate: r.payDate ?? '',
  totalGross: toNum(r.totalGross), totalDeductions: toNum(r.totalDeductions), totalNet: toNum(r.totalNet),
  status: (r.status ?? 'draft') as PayrollStatus, items: Array.isArray(r.items) ? r.items.map(mapItem) : [],
});
export const payrollRunListSerializer = (p: any): PayrollRun[] => arrayFrom(p).map(mapRun);
export const payrollRunSingleSerializer = (p: any): PayrollRun | null => { const r = p?.data ?? p; if (!r || Array.isArray(r) || !r.id) return null; return mapRun(r); };
