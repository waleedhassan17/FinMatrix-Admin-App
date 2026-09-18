export type PayType = 'salary' | 'hourly';
export type EmployeeStatus = 'active' | 'inactive' | 'terminated';
export type PayrollStatus = 'draft' | 'processed' | 'paid';

export interface Employee {
  id: string; firstName: string; lastName: string; email: string; phone: string;
  department: string; position: string; hireDate: string | null; status: EmployeeStatus;
  payType: PayType; salary: number; hourlyRate: number; payFrequency: string; deductionAmount: number;
}

export interface PayrollItem {
  id?: string; employeeId: string; employeeName?: string; hours: number; gross: number; deductions: number; net: number;
}

export interface PayrollRun {
  id: string; payPeriod: string; periodStart: string; periodEnd: string; payDate: string;
  totalGross: number; totalDeductions: number; totalNet: number; status: PayrollStatus; items: PayrollItem[];
}
