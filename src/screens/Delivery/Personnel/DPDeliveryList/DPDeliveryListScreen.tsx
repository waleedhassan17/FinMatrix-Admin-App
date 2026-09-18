import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppSelector, useAppDispatch } from '../../../../hooks/useReduxHooks';
import { selectUser } from '../../../Auth/authSlice';
import { selectDeliveries, fetchDeliveries } from '../../Admin/AssignDeliveries/deliverySlice';
import type { DPDeliveriesStackParamList } from '../../../../navigators/stacks/DPDeliveriesStack';
import { THEME, STATUS_CONFIG, PRIORITY_CONFIG } from '../../../../utils/theme';
import { DP_BRAND } from '../../../../utils/deliveryTheme';

type Props = NativeStackScreenProps<DPDeliveriesStackParamList, 'DPDeliveries'>;

type Delivery = ReturnType<typeof selectDeliveries>[number];

const DeliveryCard: React.FC<{
  delivery: Delivery;
  onPress: () => void;
}> = ({ delivery, onPress }) => {
  const statusConfig = STATUS_CONFIG[delivery.status] ?? STATUS_CONFIG.unassigned;
  const priorityConfig = PRIORITY_CONFIG[delivery.priority] ?? PRIORITY_CONFIG.medium;

  return (
    <TouchableOpacity
      style={styles.deliveryCard}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.deliveryCardHeader}>
        <View style={styles.deliveryCardInfo}>
          <View style={styles.customerRow}>
            <Text style={styles.customerName}>{delivery.customerName}</Text>
            <View style={[styles.priorityBadge, { backgroundColor: priorityConfig.bg }]}>
              <Text style={[styles.priorityBadgeText, { color: priorityConfig.color }]}>
                {delivery.priority.toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={styles.referenceNo}>{delivery.referenceNo}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
          <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      <View style={styles.deliveryCardBody}>
        <View style={styles.detailRow}>
          <Feather name="map-pin" size={13} color={THEME.colors.textTertiary} style={styles.detailFeatherIcon} />
          <Text style={styles.detailText} numberOfLines={1}>
            {delivery.address ?? delivery.zone}
          </Text>
        </View>
        <View style={styles.detailRowDivider} />
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Feather name="package" size={12} color={THEME.colors.textTertiary} />
            <Text style={styles.metaText}> {delivery.items.length} items</Text>
          </View>
          <View style={styles.metaDot} />
          <View style={styles.metaItem}>
            <Feather name="calendar" size={12} color={THEME.colors.textTertiary} />
            <Text style={styles.metaText}> {delivery.scheduledDate}</Text>
          </View>
        </View>
      </View>

      <View style={styles.deliveryCardFooter}>
        <Text style={styles.viewDetailsText}>View Details</Text>
        <View style={styles.arrowCircle}>
          <Feather name="arrow-right" size={12} color={DP_BRAND.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const SectionCard: React.FC<{
  title: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  count: number;
  color: string;
  children: React.ReactNode;
  emptyText?: string;
}> = ({ title, icon, count, color, children, emptyText }) => (
  <View style={styles.sectionCard}>
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionIconWrap, { backgroundColor: `${color}15` }]}>
        <Feather name={icon} size={16} color={color} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={[styles.sectionCount, { backgroundColor: `${color}15` }]}>
        <Text style={[styles.sectionCountText, { color }]}>{count}</Text>
      </View>
    </View>
    {count === 0 ? (
      <View style={styles.emptySection}>
        <Feather name="inbox" size={20} color={THEME.colors.textDisabled} />
        <Text style={styles.emptySectionText}>{emptyText ?? 'No deliveries'}</Text>
      </View>
    ) : (
      <View style={styles.sectionContent}>{children}</View>
    )}
  </View>
);

const DPDeliveryListScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const deliveries = useAppSelector(selectDeliveries);
  const userId = user?.uid ?? 'dp_002';
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    dispatch(fetchDeliveries());
  }, [dispatch]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await dispatch(fetchDeliveries());
    setRefreshing(false);
  }, [dispatch]);

  const myDeliveries = useMemo(
    () => deliveries.filter(d => d.assignedTo === userId),
    [deliveries, userId],
  );

  const { inProgress, pending, completed } = useMemo(() => {
    const inProgress = myDeliveries.filter(d =>
      ['picked_up', 'in_transit', 'arrived'].includes(d.status),
    );
    const pending = myDeliveries.filter(d => d.status === 'pending');
    const completed = myDeliveries.filter(d => d.status === 'delivered');
    return { inProgress, pending, completed };
  }, [myDeliveries]);

  const totalActive = inProgress.length + pending.length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={DP_BRAND.primary} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>My Deliveries</Text>
            <Text style={styles.headerSubtitle}>Manage your assigned deliveries</Text>
          </View>
          <View style={styles.headerBadge}>
            <View style={styles.headerBadgeDot} />
            <Text style={styles.headerBadgeText}>{totalActive} Active</Text>
          </View>
        </View>
      </View>

      {/* Quick Stats */}
      <View style={styles.quickStats}>
        <View style={[styles.quickStatItem, styles.quickStatPending]}>
          <Feather name="clock" size={14} color={THEME.colors.primary} style={{ marginBottom: 4 }} />
          <Text style={styles.quickStatValue}>{pending.length}</Text>
          <Text style={styles.quickStatLabel}>Pending</Text>
        </View>
        <View style={[styles.quickStatItem, styles.quickStatInProgress]}>
          <Feather name="truck" size={14} color={THEME.colors.warning} style={{ marginBottom: 4 }} />
          <Text style={styles.quickStatValue}>{inProgress.length}</Text>
          <Text style={styles.quickStatLabel}>In Progress</Text>
        </View>
        <View style={[styles.quickStatItem, styles.quickStatCompleted]}>
          <Feather name="check-circle" size={14} color={THEME.colors.success} style={{ marginBottom: 4 }} />
          <Text style={styles.quickStatValue}>{completed.length}</Text>
          <Text style={styles.quickStatLabel}>Completed</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={DP_BRAND.primary}
            colors={[DP_BRAND.primary]}
          />
        }
      >
        {/* In Progress Section */}
        <SectionCard
          title="In Progress"
          icon="truck"
          count={inProgress.length}
          color={THEME.colors.warning}
          emptyText="No deliveries in progress"
        >
          {inProgress.map(delivery => (
            <DeliveryCard
              key={delivery.id}
              delivery={delivery}
              onPress={() => navigation.navigate('DPDeliveryDetail', { deliveryId: delivery.id })}
            />
          ))}
        </SectionCard>

        {/* Pending Section */}
        <SectionCard
          title="Up Next"
          icon="clock"
          count={pending.length}
          color={DP_BRAND.primary}
          emptyText="No pending deliveries"
        >
          {pending.map(delivery => (
            <DeliveryCard
              key={delivery.id}
              delivery={delivery}
              onPress={() => navigation.navigate('DPDeliveryDetail', { deliveryId: delivery.id })}
            />
          ))}
        </SectionCard>

        {/* Completed Section */}
        <SectionCard
          title="Completed Today"
          icon="check-circle"
          count={completed.slice(0, 5).length}
          color={THEME.colors.success}
          emptyText="No completed deliveries yet"
        >
          {completed.slice(0, 5).map(delivery => (
            <DeliveryCard
              key={delivery.id}
              delivery={delivery}
              onPress={() => navigation.navigate('DPDeliveryDetail', { deliveryId: delivery.id })}
            />
          ))}
          {completed.length > 5 && (
            <TouchableOpacity style={styles.viewAllLink}>
              <Text style={styles.viewAllText}>View all {completed.length} completed</Text>
              <Feather name="chevron-right" size={14} color={DP_BRAND.primary} />
            </TouchableOpacity>
          )}
        </SectionCard>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DP_BRAND.primary,
  },

  // Header
  header: {
    backgroundColor: DP_BRAND.primary,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 18,
  },
  headerTitle: {
    ...THEME.typography.h1,
    color: DP_BRAND.white,
  },
  headerSubtitle: {
    ...THEME.typography.bodySm,
    color: DP_BRAND.headerTextSecondary,
    marginTop: 3,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DP_BRAND.headerOverlaySolid,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: THEME.radius.full,
  },
  headerBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: DP_BRAND.white,
    marginRight: 8,
  },
  headerBadgeText: {
    ...THEME.typography.labelMd,
    color: DP_BRAND.white,
  },

  // Quick Stats
  quickStats: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
  },
  quickStatPending: {
    backgroundColor: THEME.colors.primaryLighter,
    borderColor: THEME.colors.primaryLight,
  },
  quickStatInProgress: {
    backgroundColor: THEME.colors.warningLighter,
    borderColor: THEME.colors.warningLight,
  },
  quickStatCompleted: {
    backgroundColor: THEME.colors.successLighter,
    borderColor: THEME.colors.successLight,
  },
  quickStatValue: {
    ...THEME.typography.h2,
    color: THEME.colors.textPrimary,
  },
  quickStatLabel: {
    ...THEME.typography.labelSm,
    color: THEME.colors.textSecondary,
    marginTop: 4,
  },

  // Scroll
  scrollView: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 18,
  },

  // Section Card
  sectionCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    marginBottom: 16,
    ...THEME.shadows.sm,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
  },
  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: THEME.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    ...THEME.typography.h4,
    flex: 1,
    color: THEME.colors.textPrimary,
  },
  sectionCount: {
    minWidth: 28,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.full,
  },
  sectionCountText: {
    ...THEME.typography.labelMd,
    
  },
  sectionContent: {
    padding: 12,
  },
  emptySection: {
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptySectionText: {
    ...THEME.typography.bodySm,
    color: THEME.colors.textTertiary,
  },

  // Delivery Card
  deliveryCard: {
    backgroundColor: THEME.colors.neutral25,
    borderRadius: THEME.radius.lg,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    overflow: 'hidden',
  },
  deliveryCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 14,
    paddingBottom: 10,
  },
  deliveryCardInfo: {
    flex: 1,
    marginRight: 12,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  customerName: {
    ...THEME.typography.h5,
    color: THEME.colors.textPrimary,
  },
  priorityBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: THEME.radius.xs,
  },
  priorityBadgeText: {
    ...THEME.typography.overline,
    letterSpacing: 0.5,
  },
  referenceNo: {
    ...THEME.typography.caption,
    color: THEME.colors.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.radius.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusBadgeText: {
    ...THEME.typography.labelSm,
    
  },
  deliveryCardBody: {
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailFeatherIcon: {
    marginRight: 8,
    width: 20,
  },
  detailText: {
    ...THEME.typography.bodySm,
    flex: 1,
    color: THEME.colors.textSecondary,
  },
  detailRowDivider: {
    height: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    ...THEME.typography.caption,
    color: THEME.colors.textTertiary,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: THEME.colors.neutral300,
    marginHorizontal: 8,
  },
  deliveryCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: THEME.colors.surface,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.borderLight,
  },
  viewDetailsText: {
    ...THEME.typography.labelMd,
    color: DP_BRAND.primary,
  },
  arrowCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: DP_BRAND.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // View All Link
  viewAllLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 4,
  },
  viewAllText: {
    ...THEME.typography.labelMd,
    color: DP_BRAND.primary,
  }
});

export default DPDeliveryListScreen;