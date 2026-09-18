export interface DashboardStat {
  id: string;
  label: string;
  value: string;
  trend?: string;
  trendDirection?: 'up' | 'down';
  trendPositive?: boolean;
  borderColor: string;
}

export interface RecentTransaction {
  id: string;
  /**
   * Which way the money went. Drives the arrow, the tint and the sign — a
   * presentation concern, and only that.
   */
  type: 'income' | 'expense';
  /**
   * Which document this is, carried through from the API rather than inferred
   * back from `type`.
   *
   * The row used to work out its own label with `isIncome ? 'Invoice' :
   * 'Bill'`, which was right only because there happen to be two kinds. It is
   * also not something to route on: "the arrow points down" is not a promise
   * that a record exists in the invoices table. `unknown` covers a document
   * type this build does not know about — it still renders, it just is not
   * offered as a link to somewhere that cannot open it.
   */
  kind: 'invoice' | 'bill' | 'unknown';
  description: string;
  date: string;
  amount: string;
}

export interface DeliveryOverviewData {
  assigned: number;
  inTransit: number;
  delivered: number;
  pending: number;
  total: number;
}

export interface DashboardAlert {
  id: string;
  message: string;
  severity: 'amber' | 'red' | 'blue';
}

// ─── Empty defaults for initial state ────────────────
export const dashboardStats: DashboardStat[] = [];
export const recentTransactions: RecentTransaction[] = [];
export const deliveryOverview: DeliveryOverviewData = {
  assigned: 0,
  inTransit: 0,
  delivered: 0,
  pending: 0,
  total: 0,
};
export const dashboardAlerts: DashboardAlert[] = [];

