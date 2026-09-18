// ═══════════════════════════════════════════════════════
// FinMatrix — Staff "More" navigation map
// ═══════════════════════════════════════════════════════
// The staff equivalent of More.ts, and deliberately an ALLOW-LIST rather than
// the admin list with rows hidden.
//
// Hiding a row still leaves the route registered, so anything holding a
// navigation reference — a deep link, a stale param, a shared component that
// calls navigate('Settings') — reaches a screen staff must not see. Screens
// left out of this array simply do not exist in the staff navigator, and
// navigating to one is a no-op instead of a leak. The server's 403s remain the
// real enforcement; this is the matching UX.
//
// NOT here, on purpose:
//   Settings, CompanyProfile, CompanySwitcher   governance
//   UserManagement                              governance
//   COAList / COAForm / COADetail               chart of accounts
//   StaffApprovals                              the OWNER's inbox
//   EmployeeList / Payroll*                     owner-only areas
//
// InventoryApproval IS here: approving a rider's delivery is a staff action
// (Table B row 4). It is not the owner's approvals inbox — that is the separate
// StaffApprovals screen above.

import type { IRoute } from './types';
import {
  StaffMoreRouteNames,
  type StaffMoreRouteName,
} from './staffMoreRouteNames';
import { isFeatureEnabled } from '../utils/featureGates';
import StaffMoreHubScreen from '../screens/More/StaffMoreHubScreen';
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
import TaxLiabilityScreen from '../screens/Tax/TaxLiability/TaxLiabilityScreen';
import StaffSettingsScreen from '../screens/Settings/StaffSettings/StaffSettingsScreen';
import MyRequestsScreen from '../screens/Approvals/MyRequestsScreen';

/**
 * Each entry pairs an allow-listed NAME with its screen. `title` is typed as
 * StaffMoreRouteName, so registering a route that is not on the allow-list in
 * staffMoreRouteNames.ts is a compile error rather than a silent leak.
 */
type StaffRoute = IRoute & { title: StaffMoreRouteName };

/**
 * Split into two `as const` tuples rather than one array so the titles survive
 * as literal types — that is what makes the exhaustiveness check below
 * possible. STAFF_MORE_ROUTES recombines them exactly as before.
 */
const CORE_ROUTES = [
  { title: StaffMoreRouteNames.StaffMoreHub, component: StaffMoreHubScreen },
  { title: StaffMoreRouteNames.MyRequests, component: MyRequestsScreen },

  // People
  { title: StaffMoreRouteNames.CustomerList, component: CustomerListScreen },
  { title: StaffMoreRouteNames.CustomerDetail, component: CustomerDetailScreen },
  { title: StaffMoreRouteNames.CustomerForm, component: CustomerFormScreen },
  { title: StaffMoreRouteNames.VendorList, component: VendorListScreen },
  { title: StaffMoreRouteNames.VendorDetail, component: VendorDetailScreen },
  { title: StaffMoreRouteNames.VendorForm, component: VendorFormScreen },

  // Read-only reference
  { title: StaffMoreRouteNames.TaxLiability, component: TaxLiabilityScreen },

  // Staff's own account: who they are signed in as, and sign out.
  { title: StaffMoreRouteNames.StaffSettings, component: StaffSettingsScreen },
] as const;

/** Delivery — the staff working set, including signing off completions. */
const DELIVERY_ROUTES = [
  { title: StaffMoreRouteNames.AssignDeliveries, component: AssignDeliveriesScreen },
  { title: StaffMoreRouteNames.CreateDelivery, component: CreateDeliveryScreen },
  { title: StaffMoreRouteNames.AssignWork, component: AssignWorkScreen },
  { title: StaffMoreRouteNames.DeliveryMonitor, component: DeliveryMonitorScreen },
  { title: StaffMoreRouteNames.AdminDeliveryDetail, component: AdminDeliveryDetailScreen },
  { title: StaffMoreRouteNames.InventoryApproval, component: InventoryApprovalScreen },
  { title: StaffMoreRouteNames.DeliveryPersonnelList, component: DeliveryPersonnelListScreen },
  { title: StaffMoreRouteNames.AddDeliveryPersonnel, component: AddDeliveryPersonnelScreen },
  { title: StaffMoreRouteNames.DeliveryPersonnelDetail, component: DeliveryPersonnelDetailScreen },
] as const;

type RegisteredRoute =
  | (typeof CORE_ROUTES)[number]['title']
  | (typeof DELIVERY_ROUTES)[number]['title'];

// The allow-list type stops an EXTRA route being registered; this stops one
// going MISSING. A name on the allow-list with no screen behind it makes
// navigate() a silent no-op — the hub row is there, the tap does nothing —
// which is the same class of quiet failure the allow-list exists to prevent.
// Widen `Unregistered` beyond never and the assignment below stops compiling.
// The failure type is a labelled tuple rather than `never` so the compiler
// error names the route that is missing.
type Unregistered = Exclude<StaffMoreRouteName, RegisteredRoute>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _everyAllowedRouteIsRegistered: Unregistered extends never
  ? true
  : ['staff routes on the allow-list with no screen registered:', Unregistered] = true;

export const STAFF_MORE_ROUTES: StaffRoute[] = [
  ...CORE_ROUTES,
  ...(isFeatureEnabled('delivery') ? DELIVERY_ROUTES : []),
];

export { StaffMoreRouteNames };
export type { StaffMoreRouteName };
