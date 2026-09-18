// ═══════════════════════════════════════════════════════
// FinMatrix — Admin Dashboard Serializer
// ═══════════════════════════════════════════════════════
// Defensive raw→model mapping for the admin dashboard (moved verbatim
// from adminDashboardSlice). Pure functions only — the slice keeps the
// API orchestration (summary + fallback invoice/delivery calls).

import type {
  AdminDashboardData,
  RawDashboardSummary,
  RawDeliveryListItem,
  RawInvoiceListItem,
  SetupStatus,
} from '../models/adminDashboardModel';
import type {
  DashboardStat,
  RecentTransaction,
  DeliveryOverviewData,
  DashboardAlert,
} from '../models/dashboardModel';
import type { AnalyticsDashboardData, TrendPoint } from '../models/analyticsDashboardModel';

// ── Currency: compact, sign-aware, finite-safe ────────
const fmtCurrency = (n: number): string => {
  if (!Number.isFinite(n)) return 'Rs 0';
  const sign = n < 0 ? '−' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${sign}Rs ${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}Rs ${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${sign}Rs ${Math.round(abs / 1_000)}K`;
  if (abs >= 1_000) return `${sign}Rs ${(abs / 1_000).toFixed(1)}K`;
  return `${sign}Rs ${Math.round(abs).toLocaleString()}`;
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const dashboardSummarySerializer = (
  summaryRaw: RawDashboardSummary | null | undefined,
): RawDashboardSummary | null | undefined => summaryRaw?.data ?? summaryRaw;

/** Fallback path: build the dashboard payload from raw invoice/delivery lists
 *  when the summary endpoint lacks recentTransactions. */
export const fallbackDashboardDataSerializer = (
  summary: RawDashboardSummary | null | undefined,
  invoiceList: RawInvoiceListItem[],
  deliveryList: RawDeliveryListItem[],
): AdminDashboardData => {
  const deliveryBreakdown = {
    pending: 0, assigned: 0, in_transit: 0, delivered: 0, failed: 0, cancelled: 0,
  };
  for (const d of deliveryList) {
    const st = d.status as keyof typeof deliveryBreakdown;
    if (st in deliveryBreakdown) deliveryBreakdown[st]++;
  }

  const recentTransactions = invoiceList.slice(0, 8).map(inv => ({
    id: inv.id,
    type: 'invoice' as const,
    description: inv.invoiceNumber ?? inv.id,
    date: inv.invoiceDate ?? inv.issueDate ?? '',
    amount: parseFloat(String(inv.total ?? '0')),
    status: inv.status ?? 'draft',
  }));

  return {
    totalRevenue: summary?.totalRevenue ?? 0,
    totalExpenses: summary?.totalExpenses ?? 0,
    outstandingAR: summary?.outstandingAR ?? 0,
    pendingAP: summary?.pendingAP ?? 0,
    inventoryItems: summary?.inventoryItems ?? 0,
    deliveryBreakdown,
    deliveryTotal: deliveryList.length,
    recentTransactions,
    alerts: [],
    period: summary?.period,
  };
};

/** Monthly revenue for the dashboard chart, taken from the analytics report.
 *  `null` means the call failed (card says "unavailable"); an empty array
 *  means the company genuinely has no revenue history yet — the two states
 *  read very differently to a user, so they stay distinct. */
export function revenueTrendSerializer(
  data: AnalyticsDashboardData | null,
  months = 6,
): TrendPoint[] | null {
  const points = data?.revenueTrend;
  if (!Array.isArray(points)) return null;
  return points
    .filter(p => !!p && typeof p.label === 'string' && Number.isFinite(p.value))
    .map(p => ({ label: p.label, value: p.value }))
    .slice(-months);
}

// ── Stat metadata (id stays in sync with KPI_META on screen) ──
export function dashboardStatsSerializer(data: AdminDashboardData): DashboardStat[] {
  return [
    {
      id: 'revenue',
      label: "This month's revenue",
      value: fmtCurrency(data.totalRevenue),
      borderColor: '#059669',
    },
    {
      id: 'ar',
      label: 'Outstanding receivables',
      value: fmtCurrency(data.outstandingAR),
      borderColor: '#1D4ED8',
    },
    {
      id: 'expenses',
      label: "This month's expenses",
      value: fmtCurrency(data.totalExpenses),
      borderColor: '#7C3AED',
    },
    {
      id: 'ap',
      label: 'Pending payables',
      value: fmtCurrency(data.pendingAP),
      borderColor: '#D97706',
    },
  ];
}

export function recentTransactionsSerializer(data: AdminDashboardData): RecentTransaction[] {
  return data.recentTransactions.map(t => {
    // Narrowed explicitly rather than folded into the income/expense flag.
    // That flag maps anything-not-an-invoice to 'expense', so a credit memo or
    // a payment appearing in this feed would have rendered as a Bill — and,
    // now that rows are links, would have opened BillDetail with an id that is
    // not a bill's. An unrecognised type stays visible and stays inert.
    const kind: RecentTransaction['kind'] =
      t.type === 'invoice' ? 'invoice' : t.type === 'bill' ? 'bill' : 'unknown';

    const label =
      kind === 'invoice' ? `Invoice ${t.description}`
      : kind === 'bill' ? `Bill ${t.description}`
      : t.description;

    return {
      id: t.id,
      type: t.type === 'invoice' ? ('income' as const) : ('expense' as const),
      kind,
      description: label,
      date: formatDate(t.date),
      amount: fmtCurrency(t.amount),
    };
  });
}

// Keep "assigned" and "pending" as distinct buckets so the
// segmented bar and chips don't double-count.
export function deliveryOverviewSerializer(data: AdminDashboardData): DeliveryOverviewData {
  const d = data.deliveryBreakdown;
  return {
    assigned: d.assigned ?? 0,
    inTransit: d.in_transit ?? 0,
    delivered: d.delivered ?? 0,
    pending: d.pending ?? 0,
    total: data.deliveryTotal,
  };
}

export function dashboardAlertsSerializer(data: AdminDashboardData): DashboardAlert[] {
  return (data.alerts ?? []).map(a => ({
    id: a.id,
    message: a.message,
    severity: a.severity,
  }));
}

export const dashboardSetupSerializer = (
  summary: RawDashboardSummary | null | undefined,
): SetupStatus | null => summary?.setup ?? null;
