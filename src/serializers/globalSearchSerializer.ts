// ═══════════════════════════════════════════════════════
// FinMatrix — Global Search Serializer
// ═══════════════════════════════════════════════════════
// Raw `/search` rows → flat, openable SearchResult list. Pure functions
// only; the slice keeps the API call. Every bucket is treated as untrusted:
// a missing key, a non-array, or a row without an id is skipped rather than
// crashing the results list.

import type {
  RawSearchBill,
  RawSearchCustomer,
  RawSearchDocument,
  RawSearchInventoryItem,
  RawSearchInvoice,
  RawSearchPayload,
  RawSearchResults,
  RawSearchVendor,
  SearchResult,
} from '../models/auditModel';
import { unwrapEnvelope } from '../networks/reports/reportHelpers';
import { formatCurrency, formatDate } from '../utils/formatters';

// Totals arrive as decimal strings ("39312.0000"); anything unparseable
// becomes 0 rather than "RsNaN".
const toNum = (v: string | number | null | undefined): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};

const money = (v: string | number | null | undefined): string => formatCurrency(toNum(v));

// 'partially_paid' → 'Partially paid'
const titleCase = (s?: string): string =>
  s ? s.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()) : '';

/** Joins the parts of a subtitle that actually exist, so a row missing an
 *  email or a due date never renders a dangling separator. */
const line = (...parts: Array<string | undefined | null | false>): string =>
  parts.filter((p): p is string => typeof p === 'string' && p.trim().length > 0).join(' · ');

const asArray = <T>(v: T[] | undefined): T[] => (Array.isArray(v) ? v : []);

const invoiceResult = (row: RawSearchInvoice): SearchResult | null =>
  row?.id
    ? {
        id: `Invoices:${row.id}`,
        module: 'Invoices',
        title: row.invoiceNumber ?? 'Invoice',
        subtitle: line(money(row.total), titleCase(row.status), row.dueDate && `Due ${formatDate(row.dueDate)}`),
        stack: 'TransactionsStack',
        routeName: 'InvoiceDetail',
        routeParams: { invoiceId: row.id },
      }
    : null;

const billResult = (row: RawSearchBill): SearchResult | null =>
  row?.id
    ? {
        id: `Bills:${row.id}`,
        module: 'Bills',
        title: row.billNumber ?? 'Bill',
        subtitle: line(money(row.total), titleCase(row.status), row.dueDate && `Due ${formatDate(row.dueDate)}`),
        stack: 'TransactionsStack',
        routeName: 'BillDetail',
        routeParams: { billId: row.id },
      }
    : null;

const customerResult = (row: RawSearchCustomer): SearchResult | null =>
  row?.id
    ? {
        id: `Customers:${row.id}`,
        module: 'Customers',
        title: row.name ?? row.company ?? 'Customer',
        subtitle: line(row.email ?? row.phone, `Balance ${money(row.balance)}`),
        stack: 'MoreStack',
        routeName: 'CustomerDetail',
        routeParams: { customerId: row.id },
      }
    : null;

const vendorResult = (row: RawSearchVendor): SearchResult | null =>
  row?.id
    ? {
        id: `Vendors:${row.id}`,
        module: 'Vendors',
        title: row.companyName ?? row.contactPerson ?? 'Vendor',
        subtitle: line(row.email ?? row.phone, `Balance ${money(row.balance)}`),
        stack: 'MoreStack',
        routeName: 'VendorDetail',
        routeParams: { vendorId: row.id },
      }
    : null;

const inventoryResult = (row: RawSearchInventoryItem): SearchResult | null =>
  row?.id
    ? {
        id: `Inventory:${row.id}`,
        module: 'Inventory',
        title: row.name ?? row.sku ?? 'Item',
        // "Qty n" matches how the inventory list states stock; the raw
        // unitOfMeasure is free text and reads badly inline ("10 unit").
        subtitle: line(row.sku, `Qty ${toNum(row.quantityOnHand)}`, row.category),
        stack: 'InventoryStack',
        routeName: 'InventoryDetail',
        routeParams: { itemId: row.id },
      }
    : null;

const date = (d?: string) => (d ? formatDate(d) : undefined);

const poResult = (row: RawSearchDocument): SearchResult | null =>
  row?.id
    ? {
        id: `Purchase Orders:${row.id}`,
        module: 'Purchase Orders',
        title: row.poNumber ?? 'Purchase order',
        // A draft is a requisition, not yet an order.
        subtitle: line(row.vendorName, money(row.total), row.status === 'draft' ? 'Requisition' : titleCase(row.status)),
        stack: 'TransactionsStack',
        routeName: 'PODetail',
        routeParams: { poId: row.id },
      }
    : null;

const salesOrderResult = (row: RawSearchDocument): SearchResult | null =>
  row?.id
    ? {
        id: `Sales Orders:${row.id}`,
        module: 'Sales Orders',
        title: row.orderNumber ?? 'Sales order',
        subtitle: line(row.customerName, money(row.total), titleCase(row.status)),
        stack: 'TransactionsStack',
        routeName: 'SalesOrderDetail',
        routeParams: { salesOrderId: row.id },
      }
    : null;

const estimateResult = (row: RawSearchDocument): SearchResult | null =>
  row?.id
    ? {
        id: `Estimates:${row.id}`,
        module: 'Estimates',
        title: row.estimateNumber ?? 'Estimate',
        subtitle: line(row.customerName, money(row.total), titleCase(row.status)),
        stack: 'TransactionsStack',
        routeName: 'EstimateDetail',
        routeParams: { estimateId: row.id },
      }
    : null;

// The app has no receipt screen of its own; a receipt opens its customer,
// where the payment history and any advance it holds are listed.
const paymentResult = (row: RawSearchDocument): SearchResult | null =>
  row?.id && row.customerId
    ? {
        id: `Receipts:${row.id}`,
        module: 'Receipts',
        title: row.paymentNumber || row.reference || 'Receipt',
        subtitle: line(row.customerName, money(row.amount), date(row.paymentDate)),
        stack: 'MoreStack',
        routeName: 'CustomerDetail',
        routeParams: { customerId: row.customerId },
      }
    : null;

const creditMemoResult = (row: RawSearchDocument): SearchResult | null =>
  row?.id
    ? {
        id: `Credit Memos:${row.id}`,
        module: 'Credit Memos',
        title: row.creditMemoNumber ?? 'Credit memo',
        subtitle: line(row.customerName, money(row.total), titleCase(row.status)),
        stack: 'TransactionsStack',
        routeName: 'CreditMemoDetail',
        routeParams: { creditMemoId: row.id },
      }
    : null;

const vendorCreditResult = (row: RawSearchDocument): SearchResult | null =>
  row?.id
    ? {
        id: `Vendor Credits:${row.id}`,
        module: 'Vendor Credits',
        title: row.vendorCreditNumber ?? 'Vendor credit',
        subtitle: line(row.vendorName, money(row.total), titleCase(row.status)),
        stack: 'TransactionsStack',
        routeName: 'VendorCreditDetail',
        routeParams: { vendorCreditId: row.id },
      }
    : null;

const journalEntryResult = (row: RawSearchDocument): SearchResult | null =>
  row?.id
    ? {
        id: `Journal Entries:${row.id}`,
        module: 'Journal Entries',
        title: row.reference || 'Journal entry',
        subtitle: line(row.memo, date(row.date), titleCase(row.status)),
        stack: 'TransactionsStack',
        routeName: 'JournalEntryDetail',
        routeParams: { entryId: row.id },
      }
    : null;

const isResult = (r: SearchResult | null): r is SearchResult => r !== null;

/** Flattens the bucketed payload in module order (money documents first). */
export const searchResultsSerializer = (payload: unknown): SearchResult[] => {
  const body = unwrapEnvelope<RawSearchPayload>(payload);
  const buckets: RawSearchResults = body?.results ?? {};

  return [
    ...asArray(buckets.invoices).map(invoiceResult),
    ...asArray(buckets.bills).map(billResult),
    ...asArray(buckets.purchaseOrders).map(poResult),
    ...asArray(buckets.salesOrders).map(salesOrderResult),
    ...asArray(buckets.estimates).map(estimateResult),
    ...asArray(buckets.payments).map(paymentResult),
    ...asArray(buckets.creditMemos).map(creditMemoResult),
    ...asArray(buckets.vendorCredits).map(vendorCreditResult),
    ...asArray(buckets.journalEntries).map(journalEntryResult),
    ...asArray(buckets.customers).map(customerResult),
    ...asArray(buckets.vendors).map(vendorResult),
    ...asArray(buckets.inventory).map(inventoryResult),
  ].filter(isResult);
};
