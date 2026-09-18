// ═══════════════════════════════════════════════════════
// FinMatrix — DPDeliveriesStack (dumb mapper over navigations-maps/DPDeliveries)
// ═══════════════════════════════════════════════════════
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DP_DELIVERIES_ROUTES } from '../../navigations-maps/DPDeliveries';

export type DPDeliveriesStackParamList = {
  DPDeliveries: undefined;
  DPDeliveryDetail: { deliveryId: string };
  BillPhotoCapture: { deliveryId: string };
  CustomerConfirm: { deliveryId: string };
  DeliveryComplete: { deliveryId: string };
};

const Stack = createNativeStackNavigator();

const DPDeliveriesStack: React.FC = () => (
  <Stack.Navigator id="DPDeliveriesStack" screenOptions={{ headerShown: false }}>
    {DP_DELIVERIES_ROUTES.map(route => (
      <Stack.Screen
        key={route.title}
        name={route.title}
        component={route.component}
        options={route.options}
      />
    ))}
  </Stack.Navigator>
);

export default DPDeliveriesStack;
