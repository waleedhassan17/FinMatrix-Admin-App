// ═══════════════════════════════════════════════════════
// FinMatrix — DPInventoryStack (dumb mapper over navigations-maps/DPInventory)
// ═══════════════════════════════════════════════════════
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DP_INVENTORY_ROUTES } from '../../navigations-maps/DPInventory';

export type DPInventoryStackParamList = {
  DPInventory: undefined;
  DPShadowInventory: undefined;
};

const Stack = createNativeStackNavigator();

const DPInventoryStack: React.FC = () => (
  <Stack.Navigator id="DPInventoryStack" screenOptions={{ headerShown: false }}>
    {DP_INVENTORY_ROUTES.map(route => (
      <Stack.Screen
        key={route.title}
        name={route.title}
        component={route.component}
        options={route.options}
      />
    ))}
  </Stack.Navigator>
);

export default DPInventoryStack;
