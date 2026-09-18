// ═══════════════════════════════════════════════════════
// FinMatrix — Super Admin Navigator (Bottom Tabs)
// QuickBooks-inspired platform control panel
// ═══════════════════════════════════════════════════════

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';

import SuperAdminDashboardScreen from '../screens/SuperAdmin/SuperAdminDashboardScreen';
import CompanyManagementScreen from '../screens/SuperAdmin/CompanyManagement/CompanyManagementScreen';
import RevenueAnalyticsScreen from '../screens/SuperAdmin/Analytics/RevenueAnalyticsScreen';
import SubscriptionPlansScreen from '../screens/SuperAdmin/SubscriptionPlans/SubscriptionPlansScreen';
import PaymentSubmissionsScreen from '../screens/SuperAdmin/PaymentSubmissions/PaymentSubmissionsScreen';
import AdminSettingsScreen from '../screens/SuperAdmin/AdminSettings/AdminSettingsScreen';
import { THEME } from '../theme';

export type SuperAdminTabParamList = {
  Dashboard: undefined;
  Companies: { filter?: string; focusId?: string } | undefined;
  Payments: undefined;
  Analytics: undefined;
  Plans: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<SuperAdminTabParamList>();

// ── Tab icon + label map ──────────────────────────────
const TAB_CONFIG: Record<string, { icon: string; label: string }> = {
  Dashboard: { icon: 'grid', label: 'Dashboard' },
  Companies: { icon: 'briefcase', label: 'Companies' },
  Payments: { icon: 'check-square', label: 'Payments' },
  Analytics: { icon: 'bar-chart-2', label: 'Analytics' },
  Plans: { icon: 'credit-card', label: 'Plans' },
  Settings: { icon: 'settings', label: 'Settings' }
};

// ── Custom Tab Bar Icon ───────────────────────────────
const TabIcon: React.FC<{
  routeName: string;
  focused: boolean;
  color: string;
}> = ({ routeName, focused, color }) => {
  const cfg = TAB_CONFIG[routeName] ?? { icon: 'circle', label: routeName };
  return (
    <View style={[TS.iconWrap, focused && TS.iconWrapActive]}>
      <Feather name={cfg.icon as any} size={20} color={color} />
    </View>
  );
};

const SuperAdminNavigator: React.FC = () => (
  <Tab.Navigator
    id="SuperAdminTabs"
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarIcon: ({ focused, color }) => (
        <TabIcon routeName={route.name} focused={focused} color={color} />
      ),
      tabBarLabel: ({ focused, color }) => (
        <Text style={[TS.tabLabel, { color }]}>
          {TAB_CONFIG[route.name]?.label ?? route.name}
        </Text>
      ),
      tabBarStyle: TS.tabBar,
      tabBarActiveTintColor: THEME.colors.info,
      tabBarInactiveTintColor: THEME.colors.textTertiary,
      tabBarHideOnKeyboard: true,
    })}
  >
    <Tab.Screen name="Dashboard" component={SuperAdminDashboardScreen} />
    <Tab.Screen name="Companies" component={CompanyManagementScreen} />
    <Tab.Screen name="Payments" component={PaymentSubmissionsScreen} />
    <Tab.Screen name="Analytics" component={RevenueAnalyticsScreen} />
    <Tab.Screen name="Plans" component={SubscriptionPlansScreen} />
    <Tab.Screen name="Settings" component={AdminSettingsScreen} />
  </Tab.Navigator>
);

const TS = StyleSheet.create({
  tabBar: {
    backgroundColor: THEME.colors.neutral0,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    height: Platform.OS === 'ios' ? 80 : 62,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 6,
    elevation: 8,
    shadowColor: THEME.colors.neutral900,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8
  },
  iconWrap: {
    width: 36,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8
  },
  iconWrapActive: {
    backgroundColor: THEME.colors.infoLight
  },
  tabLabel: {
    ...THEME.typography.overline,
    marginTop: 1
  },
});

export default SuperAdminNavigator;
