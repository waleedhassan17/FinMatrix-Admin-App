import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { THEME } from '../utils/theme';

// Design-system tokens (see src/theme/theme.ts).
const { colors } = THEME;
import NotificationBadge from '../components/shared/NotificationBadge';

import DPDashboardStack from './stacks/DPDashboardStack';
import DPDeliveriesStack from './stacks/DPDeliveriesStack';
import DPInventoryStack from './stacks/DPInventoryStack';
import DPProfileStack from './stacks/DPProfileStack';

// ── Design Tokens (aligned with app primary brand) ──
const ACTIVE = THEME.colors.actionGreen;
const INACTIVE = colors.neutral400;
const TAB_HEIGHT = 72;

type IconName = React.ComponentProps<typeof Feather>['name'];

type DeliveryTabParamList = {
  DPDashboardStack: undefined;
  DPDeliveriesStack: undefined;
  DPInventoryStack: undefined;
  DPProfileStack: undefined;
};

const Tab = createBottomTabNavigator<DeliveryTabParamList>();

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

const DeliveryTabNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      id="DeliveryTabNavigator"
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: TAB_HEIGHT + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
          backgroundColor: THEME.colors.neutral0,
          borderTopWidth: 0,
          elevation: 14,
          shadowColor: THEME.colors.neutral900,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 10
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
        name="DPDashboardStack"
        component={DPDashboardStack}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="grid" focused={focused} />
          )
        }}
      />
      <Tab.Screen
        name="DPDeliveriesStack"
        component={DPDeliveriesStack}
        options={{
          tabBarLabel: 'Deliveries',
          tabBarIcon: ({ focused }) => <TabIcon icon="truck" focused={focused} />
        }}
      />
      <Tab.Screen
        name="DPInventoryStack"
        component={DPInventoryStack}
        options={{
          tabBarLabel: 'Inventory',
          tabBarIcon: ({ focused }) => <TabIcon icon="archive" focused={focused} />
        }}
      />
      <Tab.Screen
        name="DPProfileStack"
        component={DPProfileStack}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon icon="user" focused={focused} />
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
    backgroundColor: THEME.colors.warningLighter,
  }
});

export default DeliveryTabNavigator;
