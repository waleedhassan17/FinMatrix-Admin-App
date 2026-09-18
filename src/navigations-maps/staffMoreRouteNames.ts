// ═══════════════════════════════════════════════════════
// FinMatrix — Staff "More" allow-list
// ═══════════════════════════════════════════════════════
// The route names staff may reach, and NOTHING ELSE.
//
// This file deliberately has no imports. StaffMore.ts pairs each name with a
// screen component, and its array is typed against StaffMoreRouteName, so a
// route that is not on this list cannot be registered — TypeScript rejects it
// before any test runs. Keeping the names separate also means the allow-list
// can be asserted without loading every screen (and with them, the whole Expo
// native stack) into a unit test.
//
// Left off on purpose — these are governance screens the server 403s for
// staff, and leaving the ROUTE out means a deep link or a stale navigation
// reference cannot reach them either:
//
//   Settings · CompanyProfile · CompanySwitcher
//   UserManagement
//   COAList · COAForm · COADetail
//   StaffApprovals            (the OWNER's inbox)
//   EmployeeList · Payroll*
//   BankReconciliation*       (segregation of duties: staff record the
//                              receipts and payments this control checks)
//
// GlobalSearch is off this list too, but for a product reason rather than a
// governance one: it was a duplicate. Staff still reach search from the search
// icon on the dashboard header, which is registered in DashboardStack.
//
// InventoryApproval IS on the list: signing off a rider's delivery is a staff
// action (Table B row 4), and it is not the owner's approvals inbox.

export const StaffMoreRouteNames = {
  StaffMoreHub: 'StaffMoreHub',
  MyRequests: 'MyRequests',
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
  TaxLiability: 'TaxLiability',
  // Staff's own settings: who they are signed in as, and sign out. NOT the
  // owner's 'Settings', which is on the forbidden list -- that one carries the
  // plan, company profile and company switcher.
  StaffSettings: 'StaffSettings',
} as const;

export type StaffMoreRouteName =
  typeof StaffMoreRouteNames[keyof typeof StaffMoreRouteNames];

/** Every name staff may reach, as a plain array. */
export const STAFF_MORE_ROUTE_NAMES = Object.values(
  StaffMoreRouteNames,
) as StaffMoreRouteName[];

/**
 * Screens staff must never reach. Named explicitly rather than inferred as
 * "everything not on the list", so that adding a governance screen to the
 * admin stack without thinking about staff is caught by a failing test rather
 * than passing silently.
 */
export const STAFF_FORBIDDEN_ROUTES = [
  'Settings',
  'CompanyProfile',
  'CompanySwitcher',
  'UserManagement',
  'StaffApprovals',
  'COAList',
  'COAForm',
  'COADetail',
  'EmployeeList',
  'EmployeeForm',
  'PayrollRunList',
  'PayrollRunDetail',
  // Bank reconciliation is the control that checks the value-in work staff
  // themselves record -- receipts, bills, payments. One role doing both the
  // recording and the reconciling defeats segregation of duties, so it is the
  // owner's. The server enforces it with 403; this keeps a deep link from
  // reaching a screen the API will refuse anyway.
  'BankReconciliationList',
  'BankReconciliation',
  'BankReconciliationDetail',
] as const;
