// ═══════════════════════════════════════════════════════
// FinMatrix — MoreStack (dumb mapper over navigations-maps/More)
// ═══════════════════════════════════════════════════════
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MORE_ROUTES } from '../../navigations-maps/More';

export type MoreStackParamList = {
  MoreHub: undefined;
  EmployeeList: undefined;
  EmployeeForm: { employeeId?: string } | undefined;
  PayrollRunList: undefined;
  PayrollRunDetail: { payrollRunId: string };
  COAList: undefined;
  COAForm: { accountId?: string } | undefined;
  COADetail: { accountId: string };
  AgencyList: undefined;
  AgencyDetail: { agencyId: string };
  AgencyForm: { agencyId?: string } | undefined;
  AgencyInventorySync: { agencyId: string };
  CustomerList: undefined;
  CustomerDetail: { customerId: string };
  CustomerForm: { customerId?: string } | undefined;
  VendorList: undefined;
  VendorDetail: { vendorId: string };
  VendorForm: { vendorId?: string } | undefined;
  AssignDeliveries: undefined;
  CreateDelivery: undefined;
  AssignWork: undefined;
  DeliveryMonitor: undefined;
  AdminDeliveryDetail: { deliveryId: string };
  InventoryApproval: undefined;
  DeliveryPersonnelList: undefined;
  AddDeliveryPersonnel: undefined;
  DeliveryPersonnelDetail: { userId: string };
  BankReconciliationList: undefined;
  BankReconciliation: { accountId: string; accountName: string };
  BankReconciliationDetail: { reconciliationId: string };
  // SHELVED (Tax Management). Commented with the registration: leaving the
  // param declared would let navigate('TaxSettings') compile against a route
  // that no longer exists, which fails silently rather than at build time.
  // TaxSettings: undefined;
  TaxLiability: undefined;
  TaxPayment: { taxRateId?: string } | undefined;
  Settings: undefined;
  CompanyProfile: undefined;
  UserManagement: undefined;
  StaffApprovals: undefined;
  CompanySwitcher: undefined;
  GlobalSearch: undefined;
  RenewSubscription: { mode?: 'renew' | 'change' } | undefined;
  SubscriptionPay: { plan: 'standard' | 'pro'; mode?: 'renew' | 'change' };
};

const Stack = createNativeStackNavigator();

const MoreStack: React.FC = () => (
  <Stack.Navigator id="MoreStack" screenOptions={{ headerShown: false }}>
    {MORE_ROUTES.map(route => (
      <Stack.Screen
        key={route.title}
        name={route.title}
        component={route.component}
        options={route.options}
      />
    ))}
  </Stack.Navigator>
);

export default MoreStack;
