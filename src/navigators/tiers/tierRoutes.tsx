/**
 * Three-tier navigation maps (FinMatrix.md Phase 3).
 *
 * Each tier's navigator mounts EXPLICIT route lists — arrays of
 * { name, component } — instead of one shared stack with conditionally hidden
 * items. Screens are the EXISTING components, imported once here and reused
 * across tiers; only the route lists differ, so the tier boundary is visible
 * in code:
 *
 *   small business ⊂ large organization ⊂ warehouse
 *
 * Warehouse itself keeps the original AdminTabNavigator (it has everything).
 * Server-side FeatureGuard 403s are the real enforcement — these maps are the
 * matching UX so no user ever sees a menu item their tier can't open.
 */
import type React from 'react';

// ── Shared / accounting-core screens ──
import AdminDashboardScreen from '../../screens/HomeScreen/AdminDashboardScreen';
import GlobalSearchScreen from '../../screens/GlobalSearch/GlobalSearchScreen';

import TransactionsHubScreen from '../../screens/Transactions/TransactionsHubScreen';
import InvoiceListScreen from '../../screens/Invoices/InvoiceList/InvoiceListScreen';
import InvoiceFormScreen from '../../screens/Invoices/InvoiceForm/InvoiceFormScreen';
import InvoiceDetailScreen from '../../screens/Invoices/InvoiceDetail/InvoiceDetailScreen';
import EstimateListScreen from '../../screens/Estimates/EstimateListScreen';
import EstimateFormScreen from '../../screens/Estimates/EstimateFormScreen';
import EstimateDetailScreen from '../../screens/Estimates/EstimateDetailScreen';
import CreditMemoListScreen from '../../screens/CreditMemos/CreditMemoListScreen';
import CreditMemoFormScreen from '../../screens/CreditMemos/CreditMemoFormScreen';
import CreditMemoDetailScreen from '../../screens/CreditMemos/CreditMemoDetailScreen';
import VendorCreditListScreen from '../../screens/VendorCredits/VendorCreditListScreen';
import VendorCreditFormScreen from '../../screens/VendorCredits/VendorCreditFormScreen';
import VendorCreditDetailScreen from '../../screens/VendorCredits/VendorCreditDetailScreen';
import ReceivePaymentScreen from '../../screens/Payments/ReceivePayment/ReceivePaymentScreen';
import BillListScreen from '../../screens/Bills/BillList/BillListScreen';
import BillFormScreen from '../../screens/Bills/BillForm/BillFormScreen';
import BillDetailScreen from '../../screens/Bills/BillDetail/BillDetailScreen';
import PayBillsScreen from '../../screens/Bills/PayBills/PayBillsScreen';
import GeneralJournalListScreen from '../../screens/GeneralJournal/GeneralJournalListScreen';
import OpeningBalanceScreen from '../../screens/GeneralJournal/OpeningBalance/OpeningBalanceScreen';
import GeneralJournalFormScreen from '../../screens/GeneralJournal/GeneralJournalFormScreen';
import GeneralJournalDetailScreen from '../../screens/GeneralJournal/GeneralJournalDetailScreen';

import ReportsHubScreen from '../../screens/Reports/ReportsHub/ReportsHubScreen';
import ProfitLossScreen from '../../screens/Reports/ProfitLoss/ProfitLossScreen';
import BalanceSheetScreen from '../../screens/Reports/BalanceSheet/BalanceSheetScreen';
import TrialBalanceScreen from '../../screens/Reports/TrialBalance/TrialBalanceScreen';
import CashFlowScreen from '../../screens/Reports/CashFlow/CashFlowScreen';
import GeneralLedgerScreen from '../../screens/Reports/GeneralLedger/GeneralLedgerScreen';
import ARAgingScreen from '../../screens/Reports/ARAging/ARAgingScreen';
import APAgingScreen from '../../screens/Reports/APAging/APAgingScreen';
import AnalyticsDashboardScreen from '../../screens/Reports/AnalyticsDashboard/AnalyticsDashboardScreen';

import MoreHubScreen from '../../screens/More/MoreHubScreen';
import COAListScreen from '../../screens/ChartOfAccounts/COAList/COAListScreen';
import COAFormScreen from '../../screens/ChartOfAccounts/COAForm/COAFormScreen';
import COADetailScreen from '../../screens/ChartOfAccounts/COADetail/COADetailScreen';
import CustomerListScreen from '../../screens/Customers/CustomerList/CustomerListScreen';
import CustomerDetailScreen from '../../screens/Customers/CustomerDetail/CustomerDetailScreen';
import CustomerFormScreen from '../../screens/Customers/CustomerForm/CustomerFormScreen';
import VendorListScreen from '../../screens/Vendors/VendorList/VendorListScreen';
import VendorDetailScreen from '../../screens/Vendors/VendorDetail/VendorDetailScreen';
import VendorFormScreen from '../../screens/Vendors/VendorForm/VendorFormScreen';
// SHELVED (Tax Management)
// import TaxSettingsScreen from '../../screens/Tax/TaxSettings/TaxSettingsScreen';
import TaxLiabilityScreen from '../../screens/Tax/TaxLiability/TaxLiabilityScreen';
import TaxPaymentScreen from '../../screens/Tax/TaxPayment/TaxPaymentScreen';
import SettingsScreen from '../../screens/Settings/SettingsMain/SettingsScreen';
import CompanyProfileScreen from '../../screens/Settings/CompanyProfile/CompanyProfileScreen';
import CompanySwitcherScreen from '../../screens/Settings/CompanySwitcher/CompanySwitcherScreen';
import RenewSubscriptionScreen from '../../screens/Subscription/RenewSubscriptionScreen';
import SubscriptionPayScreen from '../../screens/Subscription/SubscriptionPayScreen';
// Bank Reconciliation is a CORE feature (phase3.md): every tier gets it.
import BankReconciliationListScreen from '../../screens/BankReconciliation/BankReconciliationListScreen';
import BankReconciliationScreen from '../../screens/BankReconciliation/BankReconciliationScreen';
import BankReconciliationDetailScreen from '../../screens/BankReconciliation/BankReconciliationDetailScreen';

// ── Large-organization additions ──
import EmployeeListScreen from '../../screens/Payroll/EmployeeListScreen';
import EmployeeFormScreen from '../../screens/Payroll/EmployeeFormScreen';
import PayrollRunListScreen from '../../screens/Payroll/PayrollRunListScreen';
import PayrollRunDetailScreen from '../../screens/Payroll/PayrollRunDetailScreen';
import BudgetListScreen from '../../screens/Budgets/BudgetListScreen';
import BudgetFormScreen from '../../screens/Budgets/BudgetFormScreen';
import BudgetDetailScreen from '../../screens/Budgets/BudgetDetailScreen';
import UserManagementScreen from '../../screens/Settings/UserManagement/UserManagementScreen';

export interface TierRoute {
  name: string;
  component: React.ComponentType<any>;
}

// ═══ SMALL BUSINESS — accounting only ═══

export const SB_DASHBOARD_ROUTES: TierRoute[] = [
  { name: 'AdminDashboard', component: AdminDashboardScreen },
  { name: 'GlobalSearch', component: GlobalSearchScreen },
  // Revenue's "View all". These tiers name their navigators SBReportsStack /
  // LOReportsStack, so the old navigate('ReportsStack', { screen:
  // 'AnalyticsDashboard' }) named a navigator that does not exist here and was
  // dropped without an error — the action simply did nothing. The screen is in
  // SB_REPORTS_ROUTES below, so it was reachable from Reports, just not from
  // the dashboard. Mounted here for the same reason as in
  // navigations-maps/Dashboard: back returns to the dashboard, and the Reports
  // tab is left where the user put it.
  { name: 'AnalyticsDashboard', component: AnalyticsDashboardScreen },
  // First-run setup checklist destinations, mounted here as well as in their
  // own stacks so each step's back arrow returns to the dashboard rather than
  // stacking on another tab's history. Mirrors navigations-maps/Dashboard.
  // InventoryForm is deliberately absent: inventory is warehouse-only, and
  // the checklist row is feature-gated off on these tiers.
  { name: 'OpeningBalance', component: OpeningBalanceScreen },
  { name: 'JournalEntryForm', component: GeneralJournalFormScreen },
  { name: 'COAList', component: COAListScreen },
  { name: 'COAForm', component: COAFormScreen },
  { name: 'COADetail', component: COADetailScreen },
  { name: 'CustomerForm', component: CustomerFormScreen },
  { name: 'VendorForm', component: VendorFormScreen },
  // SHELVED (Tax Management)
  // { name: 'TaxSettings', component: TaxSettingsScreen },
];

export const SB_TRANSACTIONS_ROUTES: TierRoute[] = [
  { name: 'TransactionsHub', component: TransactionsHubScreen },
  { name: 'InvoiceList', component: InvoiceListScreen },
  { name: 'InvoiceForm', component: InvoiceFormScreen },
  { name: 'InvoiceDetail', component: InvoiceDetailScreen },
  { name: 'EstimateList', component: EstimateListScreen },
  { name: 'EstimateForm', component: EstimateFormScreen },
  { name: 'EstimateDetail', component: EstimateDetailScreen },
  { name: 'CreditMemoList', component: CreditMemoListScreen },
  { name: 'CreditMemoForm', component: CreditMemoFormScreen },
  { name: 'CreditMemoDetail', component: CreditMemoDetailScreen },
  { name: 'VendorCreditList', component: VendorCreditListScreen },
  { name: 'VendorCreditForm', component: VendorCreditFormScreen },
  { name: 'VendorCreditDetail', component: VendorCreditDetailScreen },
  { name: 'ReceivePayment', component: ReceivePaymentScreen },
  { name: 'BillList', component: BillListScreen },
  { name: 'BillForm', component: BillFormScreen },
  { name: 'BillDetail', component: BillDetailScreen },
  { name: 'PayBills', component: PayBillsScreen },
  { name: 'JournalEntryList', component: GeneralJournalListScreen },
  { name: 'JournalEntryForm', component: GeneralJournalFormScreen },
  { name: 'JournalEntryDetail', component: GeneralJournalDetailScreen },
];

export const SB_REPORTS_ROUTES: TierRoute[] = [
  { name: 'ReportsHub', component: ReportsHubScreen },
  { name: 'ProfitLoss', component: ProfitLossScreen },
  { name: 'BalanceSheet', component: BalanceSheetScreen },
  { name: 'TrialBalance', component: TrialBalanceScreen },
  { name: 'CashFlow', component: CashFlowScreen },
  { name: 'GeneralLedger', component: GeneralLedgerScreen },
  { name: 'ARAging', component: ARAgingScreen },
  { name: 'APAging', component: APAgingScreen },
  { name: 'AnalyticsDashboard', component: AnalyticsDashboardScreen },
];

export const SB_MORE_ROUTES: TierRoute[] = [
  { name: 'MoreHub', component: MoreHubScreen },
  { name: 'COAList', component: COAListScreen },
  { name: 'COAForm', component: COAFormScreen },
  { name: 'COADetail', component: COADetailScreen },
  { name: 'CustomerList', component: CustomerListScreen },
  { name: 'CustomerDetail', component: CustomerDetailScreen },
  { name: 'CustomerForm', component: CustomerFormScreen },
  { name: 'VendorList', component: VendorListScreen },
  { name: 'VendorDetail', component: VendorDetailScreen },
  { name: 'VendorForm', component: VendorFormScreen },
  { name: 'BankReconciliationList', component: BankReconciliationListScreen },
  { name: 'BankReconciliation', component: BankReconciliationScreen },
  { name: 'BankReconciliationDetail', component: BankReconciliationDetailScreen },
  // SHELVED (Tax Management)
  // { name: 'TaxSettings', component: TaxSettingsScreen },
  { name: 'TaxLiability', component: TaxLiabilityScreen },
  { name: 'TaxPayment', component: TaxPaymentScreen },
  { name: 'Settings', component: SettingsScreen },
  { name: 'CompanyProfile', component: CompanyProfileScreen },
  { name: 'CompanySwitcher', component: CompanySwitcherScreen },
  { name: 'GlobalSearch', component: GlobalSearchScreen },
  { name: 'RenewSubscription', component: RenewSubscriptionScreen },
  { name: 'SubscriptionPay', component: SubscriptionPayScreen },
];

// ═══ LARGE ORGANIZATION — small business + payroll/budgets/roles/bank-rec ═══
// (warehouse operations — inventory, delivery, purchase orders — are NEVER
// available on this tier.)

export const LO_DASHBOARD_ROUTES: TierRoute[] = SB_DASHBOARD_ROUTES;

export const LO_TRANSACTIONS_ROUTES: TierRoute[] = SB_TRANSACTIONS_ROUTES;

export const LO_REPORTS_ROUTES: TierRoute[] = [
  ...SB_REPORTS_ROUTES,
  { name: 'BudgetList', component: BudgetListScreen },
  { name: 'BudgetForm', component: BudgetFormScreen },
  { name: 'BudgetDetail', component: BudgetDetailScreen },
];

export const LO_MORE_ROUTES: TierRoute[] = [
  ...SB_MORE_ROUTES,
  { name: 'EmployeeList', component: EmployeeListScreen },
  { name: 'EmployeeForm', component: EmployeeFormScreen },
  { name: 'PayrollRunList', component: PayrollRunListScreen },
  { name: 'PayrollRunDetail', component: PayrollRunDetailScreen },
  { name: 'UserManagement', component: UserManagementScreen },
];
