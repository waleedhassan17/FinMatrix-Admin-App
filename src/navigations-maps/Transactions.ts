// ═══════════════════════════════════════════════════════
// FinMatrix — Transactions navigation map
// ═══════════════════════════════════════════════════════
// Route list for TransactionsStack (Consultant_Mobile convention): the
// navigator maps over this array — screens register here only.

import type { IRoute } from './types';
import TransactionsHubScreen from '../screens/Transactions/TransactionsHubScreen';
import InvoiceListScreen from '../screens/Invoices/InvoiceList/InvoiceListScreen';
import InvoiceFormScreen from '../screens/Invoices/InvoiceForm/InvoiceFormScreen';
import InvoiceDetailScreen from '../screens/Invoices/InvoiceDetail/InvoiceDetailScreen';
import EstimateListScreen from '../screens/Estimates/EstimateListScreen';
import EstimateFormScreen from '../screens/Estimates/EstimateFormScreen';
import EstimateDetailScreen from '../screens/Estimates/EstimateDetailScreen';
import SalesOrderListScreen from '../screens/SalesOrders/SalesOrderListScreen';
import SalesOrderFormScreen from '../screens/SalesOrders/SalesOrderFormScreen';
import SalesOrderDetailScreen from '../screens/SalesOrders/SalesOrderDetailScreen';
import CreditMemoListScreen from '../screens/CreditMemos/CreditMemoListScreen';
import CreditMemoFormScreen from '../screens/CreditMemos/CreditMemoFormScreen';
import CreditMemoDetailScreen from '../screens/CreditMemos/CreditMemoDetailScreen';
import VendorCreditListScreen from '../screens/VendorCredits/VendorCreditListScreen';
import VendorCreditFormScreen from '../screens/VendorCredits/VendorCreditFormScreen';
import VendorCreditDetailScreen from '../screens/VendorCredits/VendorCreditDetailScreen';
import ReceivePaymentScreen from '../screens/Payments/ReceivePayment/ReceivePaymentScreen';
import BillListScreen from '../screens/Bills/BillList/BillListScreen';
import BillFormScreen from '../screens/Bills/BillForm/BillFormScreen';
import BillDetailScreen from '../screens/Bills/BillDetail/BillDetailScreen';
import PayBillsScreen from '../screens/Bills/PayBills/PayBillsScreen';
import PaymentSuccessScreen from '../screens/Bills/PayBills/PaymentSuccessScreen';
import POListScreen from '../screens/PurchaseOrders/POList/POListScreen';
import POFormScreen from '../screens/PurchaseOrders/POForm/POFormScreen';
import PODetailScreen from '../screens/PurchaseOrders/PODetail/PODetailScreen';
import GeneralJournalListScreen from '../screens/GeneralJournal/GeneralJournalListScreen';
import GeneralJournalDetailScreen from '../screens/GeneralJournal/GeneralJournalDetailScreen';
import GeneralJournalFormScreen from '../screens/GeneralJournal/GeneralJournalFormScreen';

export const TransactionsRouteNames = {
  TransactionsHub: 'TransactionsHub',
  InvoiceList: 'InvoiceList',
  InvoiceForm: 'InvoiceForm',
  InvoiceDetail: 'InvoiceDetail',
  EstimateList: 'EstimateList',
  EstimateForm: 'EstimateForm',
  EstimateDetail: 'EstimateDetail',
  SalesOrderList: 'SalesOrderList',
  SalesOrderForm: 'SalesOrderForm',
  SalesOrderDetail: 'SalesOrderDetail',
  CreditMemoList: 'CreditMemoList',
  CreditMemoForm: 'CreditMemoForm',
  CreditMemoDetail: 'CreditMemoDetail',
  VendorCreditList: 'VendorCreditList',
  VendorCreditForm: 'VendorCreditForm',
  VendorCreditDetail: 'VendorCreditDetail',
  ReceivePayment: 'ReceivePayment',
  BillList: 'BillList',
  BillForm: 'BillForm',
  BillDetail: 'BillDetail',
  PayBills: 'PayBills',
  PaymentSuccess: 'PaymentSuccess',
  POList: 'POList',
  POForm: 'POForm',
  PODetail: 'PODetail',
  JournalEntryList: 'JournalEntryList',
  JournalEntryForm: 'JournalEntryForm',
  JournalEntryDetail: 'JournalEntryDetail',
} as const;

export type TransactionsRouteName = typeof TransactionsRouteNames[keyof typeof TransactionsRouteNames];

export const TRANSACTIONS_ROUTES: IRoute[] = [
  { title: TransactionsRouteNames.TransactionsHub, component: TransactionsHubScreen },
  { title: TransactionsRouteNames.InvoiceList, component: InvoiceListScreen },
  { title: TransactionsRouteNames.InvoiceForm, component: InvoiceFormScreen },
  { title: TransactionsRouteNames.InvoiceDetail, component: InvoiceDetailScreen },
  { title: TransactionsRouteNames.EstimateList, component: EstimateListScreen },
  { title: TransactionsRouteNames.EstimateForm, component: EstimateFormScreen },
  { title: TransactionsRouteNames.EstimateDetail, component: EstimateDetailScreen },
  { title: TransactionsRouteNames.SalesOrderList, component: SalesOrderListScreen },
  { title: TransactionsRouteNames.SalesOrderForm, component: SalesOrderFormScreen },
  { title: TransactionsRouteNames.SalesOrderDetail, component: SalesOrderDetailScreen },
  { title: TransactionsRouteNames.CreditMemoList, component: CreditMemoListScreen },
  { title: TransactionsRouteNames.CreditMemoForm, component: CreditMemoFormScreen },
  { title: TransactionsRouteNames.CreditMemoDetail, component: CreditMemoDetailScreen },
  { title: TransactionsRouteNames.VendorCreditList, component: VendorCreditListScreen },
  { title: TransactionsRouteNames.VendorCreditForm, component: VendorCreditFormScreen },
  { title: TransactionsRouteNames.VendorCreditDetail, component: VendorCreditDetailScreen },
  { title: TransactionsRouteNames.ReceivePayment, component: ReceivePaymentScreen },
  { title: TransactionsRouteNames.BillList, component: BillListScreen },
  { title: TransactionsRouteNames.BillForm, component: BillFormScreen },
  { title: TransactionsRouteNames.BillDetail, component: BillDetailScreen },
  { title: TransactionsRouteNames.PayBills, component: PayBillsScreen },
  { title: TransactionsRouteNames.PaymentSuccess, component: PaymentSuccessScreen },
  { title: TransactionsRouteNames.POList, component: POListScreen },
  { title: TransactionsRouteNames.POForm, component: POFormScreen },
  { title: TransactionsRouteNames.PODetail, component: PODetailScreen },
  { title: TransactionsRouteNames.JournalEntryList, component: GeneralJournalListScreen },
  { title: TransactionsRouteNames.JournalEntryForm, component: GeneralJournalFormScreen },
  { title: TransactionsRouteNames.JournalEntryDetail, component: GeneralJournalDetailScreen },
];
