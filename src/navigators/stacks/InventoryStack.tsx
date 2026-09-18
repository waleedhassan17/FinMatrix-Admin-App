// ═══════════════════════════════════════════════════════
// FinMatrix — InventoryStack (dumb mapper over navigations-maps/Inventory)
// ═══════════════════════════════════════════════════════
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { INVENTORY_ROUTES } from '../../navigations-maps/Inventory';
import type { TransactionsStackParamList } from './TransactionsStack';

export type InventoryStackParamList = {
  InventoryList: undefined;
  InventoryForm: { itemId?: string } | undefined;
  InventoryDetail: { itemId: string };
  Adjustment: { itemId?: string } | undefined;
  // "Create PO" / "Request PO" from an item — mounted here so back returns to
  // the item instead of popping into the Transactions tab's history. See
  // navigations-maps/Inventory. Params are taken from TransactionsStackParamList
  // by reference rather than retyped, so the two registrations of the same
  // screen cannot drift into disagreeing about what it accepts.
  POForm: TransactionsStackParamList['POForm'];
};

const Stack = createNativeStackNavigator();

const InventoryStack: React.FC = () => (
  <Stack.Navigator id="InventoryStack" screenOptions={{ headerShown: false }}>
    {INVENTORY_ROUTES.map(route => (
      <Stack.Screen
        key={route.title}
        name={route.title}
        component={route.component}
        options={route.options}
      />
    ))}
  </Stack.Navigator>
);

export default InventoryStack;
