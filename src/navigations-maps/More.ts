// ═══════════════════════════════════════════════════════
// FinMatrix — More navigation map
// ═══════════════════════════════════════════════════════
// Route list for MoreStack (Consultant_Mobile convention): the
// navigator maps over this array — screens register here only.

import type { IRoute } from './types';
import { isFeatureEnabled } from '../utils/featureGates';
import MoreHubScreen from '../screens/More/MoreHubScreen';
import EmployeeListScreen from '../screens/Payroll/EmployeeListScreen';
import EmployeeFormScreen from '../screens/Payroll/EmployeeFormScreen';
import PayrollRunListScreen from '../screens/Payroll/PayrollRunListScreen';
import PayrollRunDetailScreen from '../screens/Payroll/PayrollRunDetailScreen';
import COAListScreen from '../screens/ChartOfAccounts/COAList/COAListScreen';
import COAFormScreen from '../screens/ChartOfAccounts/COAForm/COAFormScreen';
import COADetailScreen from '../screens/ChartOfAccounts/COADetail/COADetailScreen';
import AgencyListScreen from '../screens/Agency/AgencyList/AgencyListScreen';
import AgencyDetailScreen from '../screens/Agency/AgencyDetail/AgencyDetailScreen';
import AgencyFormScreen from '../screens/Agency/AgencyForm/AgencyFormScreen';
import AgencyInventorySyncScreen from '../screens/Agency/AgencyInventorySync/AgencyInventorySyncScreen';
import CustomerListScreen from '../screens/Customers/CustomerList/CustomerListScreen';
import CustomerDetailScreen from '../screens/Customers/CustomerDetail/CustomerDetailScreen';
import CustomerFormScreen from '../screens/Customers/CustomerForm/CustomerFormScreen';
import VendorListScreen from '../screens/Vendors/VendorList/VendorListScreen';
import VendorDetailScreen from '../screens/Vendors/VendorDetail/VendorDetailScreen';
import VendorFormScreen from '../screens/Vendors/VendorForm/VendorFormScreen';
import AssignDeliveriesScreen from '../screens/Delivery/Admin/AssignDeliveries/AssignDeliveriesScreen';
import CreateDeliveryScreen from '../screens/Delivery/Admin/CreateDelivery/CreateDeliveryScreen';
import AssignWorkScreen from '../screens/Delivery/Admin/AssignWork/AssignWorkScreen';
import DeliveryMonitorScreen from '../screens/Delivery/Admin/DeliveryMonitor/DeliveryMonitorScreen';
import AdminDeliveryDetailScreen from '../screens/Delivery/Admin/AdminDeliveryDetail/AdminDeliveryDetailScreen';
import InventoryApprovalScreen from '../screens/Delivery/Admin/InventoryApproval/InventoryApprovalScreen';
import DeliveryPersonnelListScreen from '../screens/Delivery/Admin/DeliveryPersonnelList/DeliveryPersonnelListScreen';
import AddDeliveryPersonnelScreen from '../screens/Delivery/Admin/AddDeliveryPersonnel/AddDeliveryPersonnelScreen';
import DeliveryPersonnelDetailScreen from '../screens/Delivery/Admin/DeliveryPersonnelDetail/DeliveryPersonnelDetailScreen';
import BankReconciliationListScreen from '../screens/BankReconciliation/BankReconciliationListScreen';
import BankReconciliationScreen from '../screens/BankReconciliation/BankReconciliationScreen';
import BankReconciliationDetailScreen from '../screens/BankReconciliation/BankReconciliationDetailScreen';
// SHELVED (Tax Management) — uncomment with the More hub row.
// import TaxSettingsScreen from '../screens/Tax/TaxSettings/TaxSettingsScreen';
import TaxLiabilityScreen from '../screens/Tax/TaxLiability/TaxLiabilityScreen';
import TaxPaymentScreen from '../screens/Tax/TaxPayment/TaxPaymentScreen';
import SettingsScreen from '../screens/Settings/SettingsMain/SettingsScreen';
import CompanyProfileScreen from '../screens/Settings/CompanyProfile/CompanyProfileScreen';
import UserManagementScreen from '../screens/Settings/UserManagement/UserManagementScreen';
import StaffApprovalsScreen from '../screens/Approvals/StaffApprovalsScreen';
import CompanySwitcherScreen from '../screens/Settings/CompanySwitcher/CompanySwitcherScreen';
import GlobalSearchScreen from '../screens/GlobalSearch/GlobalSearchScreen';
import RenewSubscriptionScreen from '../screens/Subscription/RenewSubscriptionScreen';
import SubscriptionPayScreen from '../screens/Subscription/SubscriptionPayScreen';

export const MoreRouteNames = {
  MoreHub: 'MoreHub',
  EmployeeList: 'EmployeeList',
  EmployeeForm: 'EmployeeForm',
  PayrollRunList: 'PayrollRunList',
  PayrollRunDetail: 'PayrollRunDetail',
  COAList: 'COAList',
  COAForm: 'COAForm',
  COADetail: 'COADetail',
  AgencyList: 'AgencyList',
  AgencyDetail: 'AgencyDetail',
  AgencyForm: 'AgencyForm',
  AgencyInventorySync: 'AgencyInventorySync',
  CustomerList: 'CustomerList',
  CustomerDetail: 'CustomerDetail',
  CustomerForm: 'CustomerForm',
  VendorList: 'VendorList',
  VendorDetail: 'VendorDetail',
  VendorForm: 'VendorForm',
  AssignDeliveries: 'AssignDeliveries',
  CreateDelivery: 'CreateDelivery',
  AssignWork: 'AssignWork',
  DeliveryMonitor: 'DeliveryMonitor',
  AdminDeliveryDetail: 'AdminDeliveryDetail',
  InventoryApproval: 'InventoryApproval',
  DeliveryPersonnelList: 'DeliveryPersonnelList',
  AddDeliveryPersonnel: 'AddDeliveryPersonnel',
  DeliveryPersonnelDetail: 'DeliveryPersonnelDetail',
  BankReconciliationList: 'BankReconciliationList',
  BankReconciliation: 'BankReconciliation',
  BankReconciliationDetail: 'BankReconciliationDetail',
  // SHELVED (Tax Management)
  // TaxSettings: 'TaxSettings',
  TaxLiability: 'TaxLiability',
  TaxPayment: 'TaxPayment',
  Settings: 'Settings',
  CompanyProfile: 'CompanyProfile',
  UserManagement: 'UserManagement',
  StaffApprovals: 'StaffApprovals',
  CompanySwitcher: 'CompanySwitcher',
  GlobalSearch: 'GlobalSearch',
  RenewSubscription: 'RenewSubscription',
  SubscriptionPay: 'SubscriptionPay',
} as const;

export type MoreRouteName = typeof MoreRouteNames[keyof typeof MoreRouteNames];

export const MORE_ROUTES: IRoute[] = [
  { title: MoreRouteNames.MoreHub, component: MoreHubScreen },
  { title: MoreRouteNames.EmployeeList, component: EmployeeListScreen },
  { title: MoreRouteNames.EmployeeForm, component: EmployeeFormScreen },
  { title: MoreRouteNames.PayrollRunList, component: PayrollRunListScreen },
  { title: MoreRouteNames.PayrollRunDetail, component: PayrollRunDetailScreen },
  { title: MoreRouteNames.COAList, component: COAListScreen },
  { title: MoreRouteNames.COAForm, component: COAFormScreen },
  { title: MoreRouteNames.COADetail, component: COADetailScreen },
  // Registered only while the feature is on. The screens, their slices and
  // MoreStackParamList's Agency entries all stay in place — the routes are
  // withheld, not removed, so re-enabling needs no change here.
  ...(isFeatureEnabled('agencies')
    ? [
        { title: MoreRouteNames.AgencyList, component: AgencyListScreen },
        { title: MoreRouteNames.AgencyDetail, component: AgencyDetailScreen },
        { title: MoreRouteNames.AgencyForm, component: AgencyFormScreen },
        { title: MoreRouteNames.AgencyInventorySync, component: AgencyInventorySyncScreen },
      ]
    : []),
  { title: MoreRouteNames.CustomerList, component: CustomerListScreen },
  { title: MoreRouteNames.CustomerDetail, component: CustomerDetailScreen },
  { title: MoreRouteNames.CustomerForm, component: CustomerFormScreen },
  { title: MoreRouteNames.VendorList, component: VendorListScreen },
  { title: MoreRouteNames.VendorDetail, component: VendorDetailScreen },
  { title: MoreRouteNames.VendorForm, component: VendorFormScreen },
  { title: MoreRouteNames.AssignDeliveries, component: AssignDeliveriesScreen },
  { title: MoreRouteNames.CreateDelivery, component: CreateDeliveryScreen },
  { title: MoreRouteNames.AssignWork, component: AssignWorkScreen },
  { title: MoreRouteNames.DeliveryMonitor, component: DeliveryMonitorScreen },
  { title: MoreRouteNames.AdminDeliveryDetail, component: AdminDeliveryDetailScreen },
  { title: MoreRouteNames.InventoryApproval, component: InventoryApprovalScreen },
  { title: MoreRouteNames.DeliveryPersonnelList, component: DeliveryPersonnelListScreen },
  { title: MoreRouteNames.AddDeliveryPersonnel, component: AddDeliveryPersonnelScreen },
  { title: MoreRouteNames.DeliveryPersonnelDetail, component: DeliveryPersonnelDetailScreen },
  { title: MoreRouteNames.BankReconciliationList, component: BankReconciliationListScreen },
  { title: MoreRouteNames.BankReconciliation, component: BankReconciliationScreen },
  { title: MoreRouteNames.BankReconciliationDetail, component: BankReconciliationDetailScreen },
  // SHELVED (Tax Management)
  // { title: MoreRouteNames.TaxSettings, component: TaxSettingsScreen },
  { title: MoreRouteNames.TaxLiability, component: TaxLiabilityScreen },
  { title: MoreRouteNames.TaxPayment, component: TaxPaymentScreen },
  { title: MoreRouteNames.Settings, component: SettingsScreen },
  { title: MoreRouteNames.CompanyProfile, component: CompanyProfileScreen },
  { title: MoreRouteNames.UserManagement, component: UserManagementScreen },
  { title: MoreRouteNames.StaffApprovals, component: StaffApprovalsScreen },
  { title: MoreRouteNames.CompanySwitcher, component: CompanySwitcherScreen },
  { title: MoreRouteNames.GlobalSearch, component: GlobalSearchScreen },
  { title: MoreRouteNames.RenewSubscription, component: RenewSubscriptionScreen },
  { title: MoreRouteNames.SubscriptionPay, component: SubscriptionPayScreen },
];
