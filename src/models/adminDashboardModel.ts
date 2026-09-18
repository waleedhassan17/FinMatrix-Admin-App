// ═══════════════════════════════════════════════════════
// FinMatrix — Admin Dashboard Model
// ═══════════════════════════════════════════════════════
// Raw dashboard payload shapes (moved verbatim from adminDashboardSlice).
// The derived view models (DashboardStat, RecentTransaction, …) live in
// models/dashboardModel.ts.

export interface SetupStatus {
  completed: boolean;
  steps: {
    openingBalance: boolean;
    chartOfAccounts: boolean;
    inventory: boolean;
    customers: boolean;
    vendors: boolean;
    taxRates: boolean;
  };
}

// Raw list items from `/invoices` and `/deliveries`, used only by the
// fallback path that augments a summary-only dashboard response.
export interface RawInvoiceListItem {
  id: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  issueDate?: string;
  total?: string | number;
  status?: string;
}

export interface RawDeliveryListItem {
  status?: string;
}

export interface AdminDashboardData {
  totalRevenue: number;
  totalExpenses: number;
  outstandingAR: number;
  pendingAP: number;
  inventoryItems: number;
  deliveryBreakdown: {
    pending: number;
    assigned: number;
    in_transit: number;
    delivered: number;
    failed: number;
    cancelled: number;
  };
  deliveryTotal: number;
  recentTransactions: {
    id: string;
    type: 'invoice' | 'bill';
    description: string;
    date: string;
    amount: number;
    status: string;
  }[];
  alerts: { id: string; message: string; severity: 'red' | 'amber' | 'blue' }[];
  setup?: SetupStatus;
  // Window the summary figures cover (month-to-date on the server), so the
  // screen can label them "as of <date>" instead of implying a full month.
  period?: { startDate: string; endDate: string };
}

/** Raw `/reports/dashboard` body before serializing. Every field is optional:
 *  the endpoint may answer with a bare summary or wrap the same shape in
 *  `data`, and older deployments omit the richer fields entirely. */
export interface RawDashboardSummary extends Partial<AdminDashboardData> {
  data?: Partial<AdminDashboardData>;
}
