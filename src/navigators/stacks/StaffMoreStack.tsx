// ═══════════════════════════════════════════════════════
// FinMatrix — StaffMoreStack (dumb mapper over navigations-maps/StaffMore)
// ═══════════════════════════════════════════════════════
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { STAFF_MORE_ROUTES } from '../../navigations-maps/StaffMore';

export type StaffMoreStackParamList = {
  StaffMoreHub: undefined;
  MyRequests: undefined;
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
  TaxLiability: undefined;
  StaffSettings: undefined;
};

const Stack = createNativeStackNavigator();

const StaffMoreStack: React.FC = () => (
  <Stack.Navigator id="StaffMoreStack" screenOptions={{ headerShown: false }}>
    {STAFF_MORE_ROUTES.map(route => (
      <Stack.Screen
        key={route.title}
        name={route.title}
        component={route.component}
        options={route.options}
      />
    ))}
  </Stack.Navigator>
);

export default StaffMoreStack;
