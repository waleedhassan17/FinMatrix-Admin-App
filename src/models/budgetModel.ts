export type BudgetStatus = 'draft' | 'active' | 'archived';

export interface BudgetLine {
  id?: string;
  accountId: string;
  accountCode?: string;
  accountName?: string;
  monthlyAmounts: number[];
  annualTotal: number;
}

export interface Budget {
  id: string;
  name: string;
  fiscalYear: number;
  status: BudgetStatus;
  totalBudget: number;
  lines: BudgetLine[];
}

export interface BudgetVsActualMonth {
  /** 1 = January. */
  month: number;
  budgeted: number;
  actual: number;
  /** As the server sends it: budgeted − actual. */
  variance: number;
}

export interface BudgetVsActualRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  budgeted: number;
  actual: number;
  variance: number;
  percentUsed: number;
  /** The monthly breakdown the detail screen expands into. */
  months: BudgetVsActualMonth[];
}

export interface BudgetVsActual {
  budget: { id: string; name: string; fiscalYear: number; status: string };
  rows: BudgetVsActualRow[];
  totals: { budgeted: number; actual: number; variance: number };
}
