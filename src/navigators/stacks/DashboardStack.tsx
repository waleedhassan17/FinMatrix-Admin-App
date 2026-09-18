// ═══════════════════════════════════════════════════════
// FinMatrix — DashboardStack (dumb mapper over navigations-maps/Dashboard)
// ═══════════════════════════════════════════════════════
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DASHBOARD_ROUTES } from '../../navigations-maps/Dashboard';
import type { TransactionsStackParamList } from './TransactionsStack';

export type DashboardStackParamList = {
  AdminDashboard: undefined;
  GlobalSearch: undefined;
  DeliveryPersonnelList: undefined;
  AddDeliveryPersonnel: undefined;
  DeliveryPersonnelDetail: { userId: string };
  AssignDeliveries: undefined;
  CreateDelivery: undefined;
  AssignWork: undefined;
  DeliveryMonitor: undefined;
  AdminDeliveryDetail: { deliveryId: string };
  InventoryApproval: undefined;
  // First-run setup checklist — mounted here so each step's back arrow
  // returns to the dashboard it was launched from. See navigations-maps/Dashboard.
  OpeningBalance: undefined;
  JournalEntryForm: undefined;
  COAList: undefined;
  COAForm: { accountId?: string } | undefined;
  COADetail: { accountId: string };
  InventoryForm: { itemId?: string } | undefined;
  CustomerForm: { customerId?: string } | undefined;
  VendorForm: { vendorId?: string } | undefined;
  // SHELVED (Tax Management). Commented with the registration: leaving the
  // param declared would let navigate('TaxSettings') compile against a route
  // that no longer exists, which fails silently rather than at build time.
  // TaxSettings: undefined;
  // Revenue "View all" — mounted here so it does not strand Analytics on top
  // of the Reports tab.
  AnalyticsDashboard: undefined;
  // Opening a document from Recent transactions, and the closed set of screens
  // those documents can reach. Params are taken from TransactionsStackParamList
  // by reference rather than retyped, so the two registrations of the same
  // screen cannot drift into disagreeing about what it accepts.
  InvoiceDetail: TransactionsStackParamList['InvoiceDetail'];
  BillDetail: TransactionsStackParamList['BillDetail'];
  BillList: TransactionsStackParamList['BillList'];
  ReceivePayment: TransactionsStackParamList['ReceivePayment'];
  PayBills: TransactionsStackParamList['PayBills'];
  PaymentSuccess: TransactionsStackParamList['PaymentSuccess'];
  // Dashboard quick actions — mounted here so back returns to the dashboard
  // instead of popping into the Transactions tab's history.
  InvoiceForm: { invoiceId?: string; customerId?: string } | undefined;
  SalesOrderForm: { salesOrderId?: string } | undefined;
  POForm: { poId?: string; prefillItemId?: string } | undefined;
  BillForm: { billId?: string; vendorId?: string } | undefined;
};

const Stack = createNativeStackNavigator();

const DashboardStack: React.FC = () => (
  <Stack.Navigator id="DashboardStack" screenOptions={{ headerShown: false }}>
    {DASHBOARD_ROUTES.map(route => (
      <Stack.Screen
        key={route.title}
        name={route.title}
        component={route.component}
        options={route.options}
      />
    ))}
  </Stack.Navigator>
);

export default DashboardStack;
