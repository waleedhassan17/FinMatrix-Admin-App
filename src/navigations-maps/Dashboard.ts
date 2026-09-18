// ═══════════════════════════════════════════════════════
// FinMatrix — Dashboard navigation map
// ═══════════════════════════════════════════════════════
// Route list for DashboardStack (Consultant_Mobile convention): the
// navigator maps over this array — screens register here only.

import type { IRoute } from './types';
import AdminDashboardScreen from '../screens/HomeScreen/AdminDashboardScreen';
import DeliveryPersonnelListScreen from '../screens/Delivery/Admin/DeliveryPersonnelList/DeliveryPersonnelListScreen';
import AddDeliveryPersonnelScreen from '../screens/Delivery/Admin/AddDeliveryPersonnel/AddDeliveryPersonnelScreen';
import DeliveryPersonnelDetailScreen from '../screens/Delivery/Admin/DeliveryPersonnelDetail/DeliveryPersonnelDetailScreen';
import AssignDeliveriesScreen from '../screens/Delivery/Admin/AssignDeliveries/AssignDeliveriesScreen';
import CreateDeliveryScreen from '../screens/Delivery/Admin/CreateDelivery/CreateDeliveryScreen';
import AssignWorkScreen from '../screens/Delivery/Admin/AssignWork/AssignWorkScreen';
import DeliveryMonitorScreen from '../screens/Delivery/Admin/DeliveryMonitor/DeliveryMonitorScreen';
import AdminDeliveryDetailScreen from '../screens/Delivery/Admin/AdminDeliveryDetail/AdminDeliveryDetailScreen';
import InventoryApprovalScreen from '../screens/Delivery/Admin/InventoryApproval/InventoryApprovalScreen';
import GlobalSearchScreen from '../screens/GlobalSearch/GlobalSearchScreen';

// ── First-run setup checklist destinations (FinMatrixGuide §5.7) ──
// These screens are ALSO registered in their own feature stacks; they are
// duplicated here on purpose, the same way GlobalSearch already is.
//
// The checklist is a self-contained onboarding flow launched from the
// dashboard, so each step has to push onto DashboardStack. Jumping into the
// sibling tab stack instead (navigate('MoreStack', { screen: 'CustomerForm' }))
// stacked the form on top of that tab's EXISTING history, so the back arrow
// returned to whatever the user had previously opened there — Chart of
// Accounts, typically — rather than to the dashboard they started from.
//
// Every screen below either only calls goBack() or navigates within the
// COAList/COAForm/COADetail trio, which is why the set is closed and safe to
// mount in a second stack.
import COAListScreen from '../screens/ChartOfAccounts/COAList/COAListScreen';
import COAFormScreen from '../screens/ChartOfAccounts/COAForm/COAFormScreen';
import COADetailScreen from '../screens/ChartOfAccounts/COADetail/COADetailScreen';
import CustomerFormScreen from '../screens/Customers/CustomerForm/CustomerFormScreen';
import VendorFormScreen from '../screens/Vendors/VendorForm/VendorFormScreen';
// SHELVED (Tax Management) — uncomment with the checklist step in SetupChecklist.
// import TaxSettingsScreen from '../screens/Tax/TaxSettings/TaxSettingsScreen';
import InventoryFormScreen from '../screens/Inventory/InventoryForm/InventoryFormScreen';
import GeneralJournalFormScreen from '../screens/GeneralJournal/GeneralJournalFormScreen';
import OpeningBalanceScreen from '../screens/GeneralJournal/OpeningBalance/OpeningBalanceScreen';

// ── Dashboard quick-action destinations ──
// Registered here for exactly the reason described above, and the reason the
// checklist screens are: navigate('TransactionsStack', { screen: 'InvoiceForm' })
// pushes the form onto the TRANSACTIONS tab's existing history. Open "New
// invoice", leave via the tab bar, then open "New sales order", and back from
// it lands on the invoice form rather than the dashboard it was launched from.
//
// The same closure rule applies: all four only call goBack(). POForm also has
// a replace('PODetail') on save, which it guards by checking the navigator it
// is actually in — see POFormScreen.
// Revenue's "View all". Registered here for the same reason as the forms
// below, with one extra consequence: navigate('ReportsStack', { screen:
// 'AnalyticsDashboard' }) did not just make back go to the wrong place, it
// left Analytics sitting on top of the REPORTS TAB. Tapping Reports afterwards
// opened Analytics instead of the reports hub, permanently, because a tab
// restores whatever its stack was last showing. The screen only calls
// goBack(), so it is safe to mount here.
import AnalyticsDashboardScreen from '../screens/Reports/AnalyticsDashboard/AnalyticsDashboardScreen';
// ── Opening a document from Recent transactions ──
// Same reason as everything above, and the same symptom the Reports tab had:
// navigate('TransactionsStack', { screen: 'InvoiceDetail' }) left that invoice
// sitting on the TRANSACTIONS tab, so tapping Transactions afterwards opened
// the document instead of the hub.
//
// The closure was checked before duplicating, and it is bounded:
//   InvoiceDetail  -> InvoiceForm*, ReceivePayment
//   BillDetail     -> BillForm*,    PayBills
//   ReceivePayment -> goBack only
//   PayBills       -> PaymentSuccess, BillForm*
//   PaymentSuccess -> PayBills, BillDetail, BillList
//   BillList       -> BillDetail, BillForm*        (* already registered here)
// Nothing reaches outside that set, so no screen here can navigate somewhere
// this stack does not know about.
import InvoiceDetailScreen from '../screens/Invoices/InvoiceDetail/InvoiceDetailScreen';
import BillDetailScreen from '../screens/Bills/BillDetail/BillDetailScreen';
import BillListScreen from '../screens/Bills/BillList/BillListScreen';
import ReceivePaymentScreen from '../screens/Payments/ReceivePayment/ReceivePaymentScreen';
import PayBillsScreen from '../screens/Bills/PayBills/PayBillsScreen';
import PaymentSuccessScreen from '../screens/Bills/PayBills/PaymentSuccessScreen';
import InvoiceFormScreen from '../screens/Invoices/InvoiceForm/InvoiceFormScreen';
import SalesOrderFormScreen from '../screens/SalesOrders/SalesOrderFormScreen';
import POFormScreen from '../screens/PurchaseOrders/POForm/POFormScreen';
import BillFormScreen from '../screens/Bills/BillForm/BillFormScreen';

export const DashboardRouteNames = {
  AdminDashboard: 'AdminDashboard',
  DeliveryPersonnelList: 'DeliveryPersonnelList',
  AddDeliveryPersonnel: 'AddDeliveryPersonnel',
  DeliveryPersonnelDetail: 'DeliveryPersonnelDetail',
  AssignDeliveries: 'AssignDeliveries',
  CreateDelivery: 'CreateDelivery',
  AssignWork: 'AssignWork',
  DeliveryMonitor: 'DeliveryMonitor',
  AdminDeliveryDetail: 'AdminDeliveryDetail',
  InventoryApproval: 'InventoryApproval',
  GlobalSearch: 'GlobalSearch',
  // setup checklist
  OpeningBalance: 'OpeningBalance',
  JournalEntryForm: 'JournalEntryForm',
  COAList: 'COAList',
  COAForm: 'COAForm',
  COADetail: 'COADetail',
  InventoryForm: 'InventoryForm',
  CustomerForm: 'CustomerForm',
  VendorForm: 'VendorForm',
  // SHELVED (Tax Management)
  // TaxSettings: 'TaxSettings',
  // dashboard drill-downs
  AnalyticsDashboard: 'AnalyticsDashboard',
  InvoiceDetail: 'InvoiceDetail',
  BillDetail: 'BillDetail',
  BillList: 'BillList',
  ReceivePayment: 'ReceivePayment',
  PayBills: 'PayBills',
  PaymentSuccess: 'PaymentSuccess',
  // dashboard quick actions
  InvoiceForm: 'InvoiceForm',
  SalesOrderForm: 'SalesOrderForm',
  POForm: 'POForm',
  BillForm: 'BillForm',
} as const;

export type DashboardRouteName = typeof DashboardRouteNames[keyof typeof DashboardRouteNames];

export const DASHBOARD_ROUTES: IRoute[] = [
  { title: DashboardRouteNames.AdminDashboard, component: AdminDashboardScreen },
  { title: DashboardRouteNames.DeliveryPersonnelList, component: DeliveryPersonnelListScreen },
  { title: DashboardRouteNames.AddDeliveryPersonnel, component: AddDeliveryPersonnelScreen },
  { title: DashboardRouteNames.DeliveryPersonnelDetail, component: DeliveryPersonnelDetailScreen },
  { title: DashboardRouteNames.AssignDeliveries, component: AssignDeliveriesScreen },
  { title: DashboardRouteNames.CreateDelivery, component: CreateDeliveryScreen },
  { title: DashboardRouteNames.AssignWork, component: AssignWorkScreen },
  { title: DashboardRouteNames.DeliveryMonitor, component: DeliveryMonitorScreen },
  { title: DashboardRouteNames.AdminDeliveryDetail, component: AdminDeliveryDetailScreen },
  { title: DashboardRouteNames.InventoryApproval, component: InventoryApprovalScreen },
  { title: DashboardRouteNames.GlobalSearch, component: GlobalSearchScreen },
  // setup checklist — see the import block above for why these are duplicated
  { title: DashboardRouteNames.OpeningBalance, component: OpeningBalanceScreen },
  { title: DashboardRouteNames.JournalEntryForm, component: GeneralJournalFormScreen },
  { title: DashboardRouteNames.COAList, component: COAListScreen },
  { title: DashboardRouteNames.COAForm, component: COAFormScreen },
  { title: DashboardRouteNames.COADetail, component: COADetailScreen },
  { title: DashboardRouteNames.InventoryForm, component: InventoryFormScreen },
  { title: DashboardRouteNames.CustomerForm, component: CustomerFormScreen },
  { title: DashboardRouteNames.VendorForm, component: VendorFormScreen },
  // SHELVED (Tax Management)
  // { title: DashboardRouteNames.TaxSettings, component: TaxSettingsScreen },
  { title: DashboardRouteNames.AnalyticsDashboard, component: AnalyticsDashboardScreen },
  // recent-transaction drill-down — see the import block above
  { title: DashboardRouteNames.InvoiceDetail, component: InvoiceDetailScreen },
  { title: DashboardRouteNames.BillDetail, component: BillDetailScreen },
  { title: DashboardRouteNames.BillList, component: BillListScreen },
  { title: DashboardRouteNames.ReceivePayment, component: ReceivePaymentScreen },
  { title: DashboardRouteNames.PayBills, component: PayBillsScreen },
  { title: DashboardRouteNames.PaymentSuccess, component: PaymentSuccessScreen },
  // quick actions — see the import block above
  { title: DashboardRouteNames.InvoiceForm, component: InvoiceFormScreen },
  { title: DashboardRouteNames.SalesOrderForm, component: SalesOrderFormScreen },
  { title: DashboardRouteNames.POForm, component: POFormScreen },
  { title: DashboardRouteNames.BillForm, component: BillFormScreen },
];
