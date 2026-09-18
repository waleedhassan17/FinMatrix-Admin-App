import React, { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { THEME } from '../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { selectFeatures, selectUser } from '../Auth/authSlice';
import { isFeatureVisible } from '../../utils/featureGates';
import NotificationBadge from '../../components/shared/NotificationBadge';
import { ReportContainer, ReportHeader } from '../../components/reports/ReportUI';
import {
  fetchPendingCount,
  selectPendingApprovalCount,
} from '../Approvals/approvalsSlice';
import { selectUnassignedDeliveries } from '../Delivery/Admin/AssignDeliveries/deliverySlice';
import type { StaffMoreRouteName } from '../../navigations-maps/StaffMore';

const { colors, radius, shadows, spacing, typography } = THEME;

type Nav = NativeStackNavigationProp<Record<string, undefined>>;

interface StaffRow {
  key: string;
  icon: keyof typeof Feather.glyphMap;
  iconBg: string;
  iconColor: string;
  label: string;
  subtitle: string;
  route: StaffMoreRouteName;
  badge?: 'requests' | 'deliveries';
  feature?: string;
}

interface StaffSection {
  title: string;
  rows: StaffRow[];
}

const IC = {
  green: { bg: colors.successLighter, fg: colors.success },
  blue: { bg: colors.actionGreenLighter, fg: colors.actionGreen },
  amber: { bg: colors.warningLighter, fg: colors.warning },
  purple: { bg: colors.secondaryLight, fg: colors.secondary },
  gray: { bg: colors.neutral100, fg: colors.textSecondary },
};

/**
 * The staff "More" hub.
 *
 * A separate screen from MoreHubScreen rather than the same one with rows
 * filtered: the two roles genuinely have different jobs, and the staff list is
 * short enough that hiding half of the owner's rows would read as a stripped
 * version of somebody else's screen instead of their own.
 *
 * There is deliberately no Settings, User management, Chart of Accounts or
 * approvals-inbox row — those routes are not even registered in the staff
 * navigator (see navigations-maps/StaffMore.ts).
 */
const SECTIONS: StaffSection[] = [
  {
    title: 'MY WORK',
    rows: [
      {
        key: 'my-requests',
        icon: 'send',
        iconBg: IC.amber.bg,
        iconColor: IC.amber.fg,
        label: 'My requests',
        subtitle: 'What you have sent the owner to approve',
        route: 'MyRequests',
        badge: 'requests',
      },
    ],
  },
  {
    title: 'DELIVERY',
    rows: [
      {
        key: 'assign',
        icon: 'truck',
        iconBg: IC.blue.bg,
        iconColor: IC.blue.fg,
        label: 'Assign deliveries',
        subtitle: 'Plan a delivery and put it on a rider',
        route: 'AssignDeliveries',
        badge: 'deliveries',
        feature: 'delivery',
      },
      {
        key: 'approvals',
        icon: 'check-square',
        iconBg: IC.green.bg,
        iconColor: IC.green.fg,
        label: 'Approve completions',
        subtitle: 'Sign off deliveries the rider has finished',
        route: 'InventoryApproval',
        feature: 'delivery',
      },
      {
        key: 'monitor',
        icon: 'map',
        iconBg: IC.purple.bg,
        iconColor: IC.purple.fg,
        label: 'Delivery monitor',
        subtitle: 'Where everything is right now',
        route: 'DeliveryMonitor',
        feature: 'delivery',
      },
      {
        key: 'personnel',
        icon: 'user-plus',
        iconBg: IC.purple.bg,
        iconColor: IC.purple.fg,
        label: 'Delivery personnel',
        subtitle: 'Add riders and share their login',
        route: 'DeliveryPersonnelList',
        feature: 'delivery',
      },
    ],
  },
  {
    title: 'PEOPLE',
    rows: [
      {
        key: 'customers',
        icon: 'users',
        iconBg: IC.green.bg,
        iconColor: IC.green.fg,
        label: 'Customers',
        subtitle: 'Manage customers and their balances',
        route: 'CustomerList',
      },
      {
        key: 'vendors',
        icon: 'shopping-bag',
        iconBg: IC.amber.bg,
        iconColor: IC.amber.fg,
        label: 'Vendors',
        subtitle: 'Suppliers you raise purchase orders against',
        route: 'VendorList',
      },
    ],
  },
  {
    title: 'REFERENCE',
    rows: [
      {
        key: 'tax',
        icon: 'percent',
        iconBg: IC.gray.bg,
        iconColor: IC.gray.fg,
        label: 'Tax liability',
        subtitle: 'What is owed this period',
        route: 'TaxLiability',
      },
    ],
  },
  {
    title: 'ACCOUNT',
    rows: [
      // Replaces the Search row, which duplicated the search icon already in
      // the dashboard header. This is also the only way a staff member can
      // sign out -- before it there was none anywhere in their surface.
      {
        key: 'settings',
        icon: 'settings',
        iconBg: IC.gray.bg,
        iconColor: IC.gray.fg,
        label: 'Settings',
        subtitle: 'Your account and sign out',
        route: 'StaffSettings',
      },
    ],
  },
];

const StaffMoreHubScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const features = useAppSelector(selectFeatures);
  const companyType = useAppSelector(selectUser)?.companyType;
  const pendingRequests = useAppSelector(selectPendingApprovalCount);
  const pendingDeliveries = useAppSelector(selectUnassignedDeliveries).length;

  // Refresh the badge on focus — a request the owner approved while this sat
  // in the background should stop being counted.
  useFocusEffect(
    useCallback(() => {
      dispatch(fetchPendingCount());
    }, [dispatch]),
  );

  const sections = SECTIONS.map(section => ({
    ...section,
    rows: section.rows.filter(r => isFeatureVisible(r.feature, features, companyType)),
  })).filter(section => section.rows.length > 0);

  const badgeFor = (row: StaffRow): number => {
    if (row.badge === 'requests') return pendingRequests;
    if (row.badge === 'deliveries') return pendingDeliveries;
    return 0;
  };

  return (
    <ReportContainer>
      <ReportHeader title="More" subtitle="Your tools and requests" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: colors.background }}
      >
        {sections.map(section => (
          <View key={section.title}>
            <Text style={styles.sectionHeader}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.rows.map((row, idx) => {
                const badge = badgeFor(row);
                return (
                  <React.Fragment key={row.key}>
                    {idx > 0 && <View style={styles.divider} />}
                    <TouchableOpacity
                      style={styles.row}
                      activeOpacity={0.6}
                      onPress={() => navigation.navigate(row.route as never)}
                    >
                      <View style={[styles.rowIcon, { backgroundColor: row.iconBg }]}>
                        <Feather name={row.icon} size={20} color={row.iconColor} />
                        {badge > 0 && <NotificationBadge count={badge} />}
                      </View>
                      <View style={styles.rowContent}>
                        <Text style={styles.rowLabel}>{row.label}</Text>
                        <Text style={styles.rowSubtitle}>{row.subtitle}</Text>
                      </View>
                      <Feather
                        name="chevron-right"
                        size={20}
                        color={colors.textTertiary}
                      />
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </ReportContainer>
  );
};

const styles = StyleSheet.create({
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  sectionHeader: {
    ...typography.labelSm,
    color: colors.textTertiary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
  },
  sectionCard: {
    backgroundColor: colors.neutral0,
    borderRadius: radius.lg,
    ...shadows.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 64,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  rowContent: { flex: 1 },
  rowLabel: { ...typography.labelMd, color: colors.textPrimary },
  rowSubtitle: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2 },
});

export default StaffMoreHubScreen;
