import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { THEME } from '../utils/theme';
import NotificationBadge from '../components/shared/NotificationBadge';

import DashboardStack from './stacks/DashboardStack';
import TransactionsStack from './stacks/TransactionsStack';
import ReportsStack from './stacks/ReportsStack';
import InventoryStack from './stacks/InventoryStack';
import MoreStack from './stacks/MoreStack';

// ── Design Tokens ──
const ACTIVE = THEME.colors.actionGreen;
// textSecondary, not textTertiary: #94A3B8 on white is around 2.8:1, under the
// 4.5:1 needed for text this size, and a tab label is a navigation control
// rather than a hint. #475569 clears it and still reads as unselected beside
// the navy active state.
const INACTIVE = THEME.colors.textSecondary;
const TAB_HEIGHT = 72;

type IconName = React.ComponentProps<typeof Feather>['name'];

type AdminTabParamList = {
  DashboardStack: undefined;
  TransactionsStack: undefined;
  ReportsStack: undefined;
  InventoryStack: undefined;
  MoreStack: undefined;
};

const Tab = createBottomTabNavigator<AdminTabParamList>();

const TabIcon: React.FC<{ icon: IconName; focused: boolean; badgeCount?: number }> = ({
  icon,
  focused,
  badgeCount = 0
}) => (
  <View style={styles.iconWrapper}>
    <View style={[styles.iconPill, focused && styles.iconPillActive]}>
      <Feather name={icon} size={16} color={focused ? ACTIVE : INACTIVE} />
    </View>
    <NotificationBadge count={badgeCount} />
  </View>
);

const AdminTabNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      id="AdminTabNavigator"
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
        tabBarLabelStyle: {
          ...THEME.typography.labelSm,
          marginTop: 2
        },
        tabBarItemStyle: {
          paddingTop: 2
        },
      }}>
      <Tab.Screen
        name="DashboardStack"
        component={DashboardStack}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="grid" focused={focused} />
          )
        }}
      />
      <Tab.Screen
        name="TransactionsStack"
        component={TransactionsStack}
        options={{
          tabBarLabel: 'Transactions',
          tabBarIcon: ({ focused }) => <TabIcon icon="repeat" focused={focused} />
        }}
      />
      <Tab.Screen
        name="ReportsStack"
        component={ReportsStack}
        options={{
          tabBarLabel: 'Reports',
          tabBarIcon: ({ focused }) => <TabIcon icon="bar-chart-2" focused={focused} />
        }}
      />
      <Tab.Screen
        name="InventoryStack"
        component={InventoryStack}
        options={{
          tabBarLabel: 'Inventory',
          tabBarIcon: ({ focused }) => <TabIcon icon="archive" focused={focused} />
        }}
      />
      <Tab.Screen
        name="MoreStack"
        component={MoreStack}
        options={{
          tabBarLabel: 'More',
          tabBarIcon: ({ focused }) => <TabIcon icon="menu" focused={focused} />
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    position: 'relative',
  },
  iconPill: {
    width: 34,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActive: {
    backgroundColor: THEME.colors.actionGreenLighter,
  }
});

export default AdminTabNavigator;
