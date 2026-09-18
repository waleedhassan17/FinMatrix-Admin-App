/**
 * SMALL BUSINESS navigator (FinMatrix.md Phase 3) — accounting only:
 * Dashboard · Transactions (invoices/bills/estimates/payments/JEs) · Reports ·
 * More (customers/vendors/COA/tax/settings). No inventory, no delivery, no
 * payroll/budgets tabs or routes anywhere in this tree.
 *
 * Reuses the existing screen components; only the route lists differ
 * (see tierRoutes.tsx).
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { THEME } from '../../utils/theme';
import {
  SB_DASHBOARD_ROUTES,
  SB_TRANSACTIONS_ROUTES,
  SB_REPORTS_ROUTES,
  SB_MORE_ROUTES,
  TierRoute
} from './tierRoutes';

const ACTIVE = THEME.colors.actionGreen;
const INACTIVE = THEME.colors.textTertiary;
const TAB_HEIGHT = 72;

type IconName = React.ComponentProps<typeof Feather>['name'];

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const makeStack = (id: string, routes: TierRoute[]) => {
  const TierStack: React.FC = () => (
    <Stack.Navigator id={id as any} screenOptions={{ headerShown: false }}>
      {routes.map(r => (
        <Stack.Screen key={r.name} name={r.name} component={r.component} />
      ))}
    </Stack.Navigator>
  );
  return TierStack;
};

const SBDashboardStack = makeStack('SBDashboardStack', SB_DASHBOARD_ROUTES);
const SBTransactionsStack = makeStack('SBTransactionsStack', SB_TRANSACTIONS_ROUTES);
const SBReportsStack = makeStack('SBReportsStack', SB_REPORTS_ROUTES);
const SBMoreStack = makeStack('SBMoreStack', SB_MORE_ROUTES);

const TabIcon: React.FC<{ icon: IconName; focused: boolean }> = ({ icon, focused }) => (
  <View style={styles.iconWrapper}>
    <View style={[styles.iconPill, focused && styles.iconPillActive]}>
      <Feather name={icon} size={16} color={focused ? ACTIVE : INACTIVE} />
    </View>
  </View>
);

const SmallBusinessNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      id="SmallBusinessNavigator"
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: TAB_HEIGHT + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
          backgroundColor: THEME.colors.neutral0,
          borderTopWidth: 1,
          borderTopColor: THEME.colors.border,
          elevation: 8,
          shadowColor: THEME.colors.neutral900,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8
        },
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarLabelStyle: { ...THEME.typography.labelSm, marginTop: 2 },
        tabBarItemStyle: { paddingTop: 2 },
      }}>
      <Tab.Screen
        name="DashboardStack"
        component={SBDashboardStack}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ focused }) => <TabIcon icon="grid" focused={focused} />
        }}
      />
      <Tab.Screen
        name="TransactionsStack"
        component={SBTransactionsStack}
        options={{
          tabBarLabel: 'Transactions',
          tabBarIcon: ({ focused }) => <TabIcon icon="repeat" focused={focused} />
        }}
      />
      <Tab.Screen
        name="ReportsStack"
        component={SBReportsStack}
        options={{
          tabBarLabel: 'Reports',
          tabBarIcon: ({ focused }) => <TabIcon icon="bar-chart-2" focused={focused} />
        }}
      />
      <Tab.Screen
        name="MoreStack"
        component={SBMoreStack}
        options={{
          tabBarLabel: 'More',
          tabBarIcon: ({ focused }) => <TabIcon icon="menu" focused={focused} />
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  iconWrapper: { alignItems: 'center', justifyContent: 'center', width: 56, position: 'relative' },
  iconPill: { width: 34, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  iconPillActive: { backgroundColor: THEME.colors.actionGreenLighter }
});

export default SmallBusinessNavigator;
