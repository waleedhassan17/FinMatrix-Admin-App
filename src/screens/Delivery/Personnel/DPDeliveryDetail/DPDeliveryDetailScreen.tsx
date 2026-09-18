import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
  StatusBar,
  Animated
} from 'react-native';
import { Alert } from '../../../../utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { selectDeliveries } from '../../Admin/AssignDeliveries/deliverySlice';
import { updateDeliveryExecutionStatus, selectDPDeliveryDetailState } from './dpDeliveryDetailSlice';
import type { DPDeliveriesStackParamList } from '../../../../navigators/stacks/DPDeliveriesStack';
import { THEME, STATUS_CONFIG, PRIORITY_CONFIG } from '../../../../utils/theme';
import { DP_BRAND } from '../../../../utils/deliveryTheme';
import { locationService } from '../../../../services/locationService';

const ACTIVE_STATUSES = ['pending', 'picked_up', 'in_transit', 'arrived'];

type Props = NativeStackScreenProps<DPDeliveriesStackParamList, 'DPDeliveryDetail'>;

const EXECUTION_STEPS = [
  { key: 'pending', label: 'Pending', description: 'Awaiting pickup' },
  { key: 'picked_up', label: 'Picked Up', description: 'Items collected' },
  { key: 'in_transit', label: 'In Transit', description: 'On the way' },
  { key: 'arrived', label: 'Arrived', description: 'At destination' },
  { key: 'delivered', label: 'Delivered', description: 'Successfully completed' },
];

const DPDeliveryDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { deliveryId } = route.params;
  const dispatch = useAppDispatch();
  const deliveries = useAppSelector(selectDeliveries);
  const { isUpdatingStatus } = useAppSelector(selectDPDeliveryDetailState);
  const [isTracking, setIsTracking] = useState(locationService.isTracking);

  // Status updates must never be lost silently: await the request, surface
  // failures with a retry prompt, and block double-taps while in flight.
  const advanceStatus = React.useCallback(
    async (status: 'picked_up' | 'in_transit' | 'arrived', note: string) => {
      if (isUpdatingStatus) return;
      const action: any = await dispatch(
        updateDeliveryExecutionStatus({ deliveryId, status, note }),
      );
      if (updateDeliveryExecutionStatus.rejected.match(action)) {
        const message =
          (action.error?.message as string) ||
          'Could not update the delivery status. Check your connection and try again.';
        if (Platform.OS === 'web') {
          // eslint-disable-next-line no-alert
          (globalThis as any).alert(`Update failed\n\n${message}\n\nNothing was lost — tap the button again to retry.`);
        } else {
          Alert.alert('Update failed', `${message}\n\nNothing was lost — tap the button again to retry.`);
        }
      }
    },
    [dispatch, deliveryId, isUpdatingStatus],
  );
  const gpsAnim = useRef(new Animated.Value(1)).current;

  const delivery = useMemo(
    () => deliveries.find(item => item.id === deliveryId),
    [deliveries, deliveryId],
  );

  const isActiveDelivery = delivery ? ACTIVE_STATUSES.includes(delivery.status) : false;

  useEffect(() => {
    if (!isActiveDelivery) return;

    locationService.startTracking(30_000);
    setIsTracking(true);

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(gpsAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        Animated.timing(gpsAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    pulse.start();

    return () => {
      pulse.stop();
      locationService.stopTracking();
      setIsTracking(false);
    };
  }, [isActiveDelivery]);

  if (!delivery) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={DP_BRAND.primary} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={20} color={DP_BRAND.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Delivery Detail</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <Feather name="inbox" size={28} color={THEME.colors.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>Delivery Not Found</Text>
          <Text style={styles.emptySubtitle}>This delivery may have been removed or updated.</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={() => navigation.goBack()}>
            <Text style={styles.emptyButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusConfig = STATUS_CONFIG[delivery.status] ?? STATUS_CONFIG.unassigned;
  const priorityConfig = PRIORITY_CONFIG[delivery.priority] ?? PRIORITY_CONFIG.medium;

  const openMap = () => {
    // Prefer precise geocoded coordinates → turn-by-turn directions.
    // Fall back to the address/zone text query if not geocoded yet.
    const hasCoords =
      typeof delivery.destLat === 'number' && typeof delivery.destLng === 'number';
    const target = delivery.address ?? delivery.zone ?? '';
    const mapUrl = hasCoords
      ? `https://www.google.com/maps/dir/?api=1&destination=${delivery.destLat},${delivery.destLng}&travelmode=driving`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target)}&travelmode=driving`;
    Linking.openURL(mapUrl).catch(() =>
      Alert.alert('Navigation', `Navigate to: ${target || 'destination'}`),
    );
  };

  const callCustomer = () => {
    if (!delivery.customerPhone) {
      Alert.alert('No Phone', 'No customer phone number available.');
      return;
    }
    Linking.openURL(`tel:${delivery.customerPhone}`).catch(() =>
      Alert.alert('Call', delivery.customerPhone)
    );
  };

  const actionConfig = (() => {
    switch (delivery.status) {
      case 'pending':
        return {
          title: 'Pick Up Items',
          subtitle: 'Collect items from warehouse',
          icon: 'package',
          color: THEME.colors.secondary,
          handler: () => advanceStatus('picked_up', `Items picked up at ${new Date().toISOString()}`)
        };
      case 'picked_up':
        return {
          title: 'Start Delivery',
          subtitle: 'Begin your route',
          icon: 'truck',
          color: THEME.colors.warning,
          handler: () => advanceStatus('in_transit', `Delivery started at ${new Date().toISOString()}`)
        };
      case 'in_transit':
        return {
          title: 'Mark as Arrived',
          subtitle: 'Confirm arrival at destination',
          icon: 'map-pin',
          color: THEME.colors.info,
          handler: () => advanceStatus('arrived', `Arrived at location at ${new Date().toISOString()}`)
        };
      case 'arrived':
        return {
          title: 'Capture Signed Bill',
          subtitle: 'Photograph the customer-signed bill',
          icon: 'camera',
          color: THEME.colors.success,
          handler: () => navigation.navigate('BillPhotoCapture', { deliveryId: delivery.id })
        };
      default:
        // delivered / failed / cancelled / returned → no further action.
        return null;
    }
  })();

  // Read-only banner shown for terminal statuses (no action button).
  const TERMINAL_CONFIG: Record<string, { label: string; sub: string; icon: string; color: string }> = {
    delivered: { label: 'Delivered', sub: 'This delivery is complete', icon: 'check-circle', color: THEME.colors.success },
    failed: { label: 'Delivery Failed', sub: 'This delivery was marked failed', icon: 'x-circle', color: THEME.colors.danger },
    cancelled: { label: 'Cancelled', sub: 'This delivery was cancelled', icon: 'slash', color: THEME.colors.textSecondary },
    returned: { label: 'Returned', sub: 'Items were returned', icon: 'corner-up-left', color: THEME.colors.warning }
  };
  const terminalConfig = TERMINAL_CONFIG[delivery.status] ?? null;
  const completedAtLabel = delivery.deliveredAt
    ? ` · ${new Date(delivery.deliveredAt).toLocaleDateString()}`
    : '';

  const currentStepIndex = Math.max(
    EXECUTION_STEPS.findIndex(step => step.key === delivery.status),
    0,
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={DP_BRAND.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={20} color={DP_BRAND.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{delivery.referenceNo}</Text>
          <View style={styles.headerBadgeRow}>
            <View style={[styles.headerBadge, { backgroundColor: statusConfig.bg }]}>
              <Text style={[styles.headerBadgeText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
            {isTracking && (
              <View style={styles.gpsPill}>
                <Animated.View style={[styles.gpsDot, { opacity: gpsAnim }]} />
                <Text style={styles.gpsText}>GPS</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Customer Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconWrap}>
              <Feather name="user" size={18} color={DP_BRAND.primary} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Customer Information</Text>
              <Text style={styles.cardSubtitle}>Contact and location details</Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.cardBody}>
            <Text style={styles.customerName}>{delivery.customerName}</Text>

            <TouchableOpacity style={styles.actionRow} onPress={openMap}>
              <View style={styles.actionRowIcon}>
                <Feather name="map-pin" size={16} color={DP_BRAND.primary} />
              </View>
              <View style={styles.actionRowContent}>
                <Text style={styles.actionRowLabel}>Delivery Address</Text>
                <Text style={styles.actionRowValue}>{delivery.address ?? delivery.zone}</Text>
              </View>
              <View style={styles.actionRowChevron}>
                <Feather name="chevron-right" size={16} color={THEME.colors.textTertiary} />
              </View>
            </TouchableOpacity>

            {delivery.customerPhone && (
              <TouchableOpacity style={styles.actionRow} onPress={callCustomer}>
                <View style={[styles.actionRowIcon, { backgroundColor: THEME.colors.successLight }]}>
                  <Feather name="phone" size={16} color={THEME.colors.success} />
                </View>
                <View style={styles.actionRowContent}>
                  <Text style={styles.actionRowLabel}>Phone Number</Text>
                  <Text style={styles.actionRowValue}>{delivery.customerPhone}</Text>
                </View>
                <View style={styles.actionRowChevron}>
                  <Feather name="chevron-right" size={16} color={THEME.colors.textTertiary} />
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Delivery Info Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconWrap, { backgroundColor: THEME.colors.warningLight }]}>
              <Feather name="clipboard" size={18} color={THEME.colors.warning} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Delivery Information</Text>
              <Text style={styles.cardSubtitle}>Order and schedule details</Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>PRIORITY</Text>
                <View style={[styles.priorityBadge, { backgroundColor: priorityConfig.bg }]}>
                  <Text style={[styles.priorityText, { color: priorityConfig.color }]}>
                    {delivery.priority.toUpperCase()}
                  </Text>
                </View>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>SCHEDULED</Text>
                <Text style={styles.infoValue}>{delivery.scheduledDate}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>ZONE</Text>
                <Text style={styles.infoValue}>{delivery.zone}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>TOTAL ITEMS</Text>
                <Text style={styles.infoValue}>{delivery.items.length} items</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Items Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconWrap, { backgroundColor: THEME.colors.secondaryLight }]}>
              <Feather name="package" size={18} color={THEME.colors.secondary} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Package Contents</Text>
              <Text style={styles.cardSubtitle}>{delivery.items.length} items to deliver</Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.itemsTable}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderCell}>Item Name</Text>
              <Text style={[styles.tableHeaderCell, styles.tableHeaderCellRight]}>Qty</Text>
            </View>
            {delivery.items.map((item, index) => (
              <View
                key={item.itemId}
                style={[styles.tableRow, index === delivery.items.length - 1 && styles.tableRowLast]}
              >
                <View style={styles.tableRowContent}>
                  <View style={styles.itemBullet}>
                    <Text style={styles.itemBulletText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.itemName}>{item.itemName}</Text>
                </View>
                <View style={styles.qtyBadge}>
                  <Text style={styles.qtyText}>×{item.quantity}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Notes Card */}
        {delivery.notes && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconWrap, { backgroundColor: THEME.colors.neutral100 }]}>
                <Feather name="edit" size={18} color={THEME.colors.neutral600} />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>Delivery Notes</Text>
                <Text style={styles.cardSubtitle}>Special instructions</Text>
              </View>
            </View>
            <View style={styles.cardDivider} />
            <View style={styles.notesBody}>
              <Text style={styles.notesText}>{delivery.notes}</Text>
            </View>
          </View>
        )}

        {/* Progress Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconWrap, { backgroundColor: THEME.colors.successLight }]}>
              <Feather name="bar-chart-2" size={18} color={THEME.colors.success} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Delivery Progress</Text>
              <Text style={styles.cardSubtitle}>Current status timeline</Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.progressTimeline}>
            {EXECUTION_STEPS.map((step, index) => {
              const isCompleted = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;
              const isPending = index > currentStepIndex;

              return (
                <View key={step.key} style={styles.timelineStep}>
                  <View style={styles.timelineLeft}>
                    <View style={[
                      styles.timelineDot,
                      isCompleted && styles.timelineDotCompleted,
                      isCurrent && styles.timelineDotCurrent,
                    ]}>
                      {isCompleted ? (
                        <Feather name="check" size={12} color={THEME.colors.textInverse} />
                      ) : (
                        <Text style={[
                          styles.timelineDotNumber,
                          isCurrent && styles.timelineDotNumberCurrent
                        ]}>{index + 1}</Text>
                      )}
                    </View>
                    {index < EXECUTION_STEPS.length - 1 && (
                      <View style={[
                        styles.timelineLine,
                        isCompleted && styles.timelineLineCompleted
                      ]} />
                    )}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={[
                      styles.timelineLabel,
                      (isCompleted || isCurrent) && styles.timelineLabelActive
                    ]}>{step.label}</Text>
                    <Text style={styles.timelineDescription}>{step.description}</Text>
                    {isCurrent && (
                      <View style={styles.currentBadge}>
                        <View style={styles.currentBadgeDot} />
                        <Text style={styles.currentBadgeText}>Current Step</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Action Button */}
        {actionConfig && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: actionConfig.color }, isUpdatingStatus && { opacity: 0.65 }]}
            onPress={actionConfig.handler}
            activeOpacity={0.9}
            disabled={isUpdatingStatus}
          >
            <View style={styles.actionButtonContent}>
              {isUpdatingStatus ? (
                <ActivityIndicator size="small" color={THEME.colors.textInverse} style={{ marginRight: 4 }} />
              ) : (
                <Feather name={actionConfig.icon as any} size={24} color={THEME.colors.textInverse} style={{ marginRight: 4 }} />
              )}
              <View style={styles.actionButtonText}>
                <Text style={styles.actionButtonTitle}>{isUpdatingStatus ? 'Updating…' : actionConfig.title}</Text>
                <Text style={styles.actionButtonSubtitle}>{actionConfig.subtitle}</Text>
              </View>
            </View>
            <View style={styles.actionButtonArrow}>
              <Feather name="arrow-right" size={18} color={THEME.colors.textInverse} />
            </View>
          </TouchableOpacity>
        )}

        {/* Terminal state — read-only, no further delivery action */}
        {!actionConfig && terminalConfig && (
          <View style={[styles.completedBanner, { borderColor: terminalConfig.color + '40', backgroundColor: terminalConfig.color + '12' }]}>
            <Feather name={terminalConfig.icon as any} size={26} color={terminalConfig.color} />
            <View style={styles.completedTextWrap}>
              <Text style={[styles.completedTitle, { color: terminalConfig.color }]}>{terminalConfig.label}</Text>
              <Text style={styles.completedSub}>{terminalConfig.sub}{completedAtLabel}</Text>
            </View>
          </View>
        )}

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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: DP_BRAND.primary,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DP_BRAND.headerOverlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    ...THEME.typography.h3,
    color: THEME.colors.neutral700,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    ...THEME.typography.h4,
    color: DP_BRAND.white,
    marginBottom: 5,
  },
  headerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.full,
  },
  headerBadgeText: {
    ...THEME.typography.labelSm,
    
  },
  gpsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.5)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.full,
    gap: 4,
  },
  gpsDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.success,
  },
  gpsText: {
    ...THEME.typography.overline,
    color: THEME.colors.successLighter,
  },
  moreBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DP_BRAND.headerOverlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreIcon: {
    ...THEME.typography.h3,
    color: DP_BRAND.white,
  },
  headerSpacer: {
    width: 40,
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

  // Cards
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    marginBottom: 16,
    ...THEME.shadows.sm,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  cardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: THEME.radius.lg,
    backgroundColor: DP_BRAND.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardIcon: {
    ...THEME.typography.h3,
    
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    ...THEME.typography.h4,
    color: THEME.colors.textPrimary,
  },
  cardSubtitle: {
    ...THEME.typography.caption,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  cardDivider: {
    height: 1,
    backgroundColor: THEME.colors.borderLight,
  },
  cardBody: {
    padding: 16,
  },

  // Customer Card
  customerName: {
    ...THEME.typography.h2,
    color: THEME.colors.textPrimary,
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: THEME.colors.neutral50,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    marginBottom: 10,
  },
  actionRowIcon: {
    width: 40,
    height: 40,
    borderRadius: THEME.radius.md,
    backgroundColor: DP_BRAND.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  actionRowIconText: {
    ...THEME.typography.h3,
    
  },
  actionRowContent: {
    flex: 1,
  },
  actionRowLabel: {
    ...THEME.typography.labelSm,
    color: THEME.colors.textTertiary,
    marginBottom: 2,
  },
  actionRowValue: {
    ...THEME.typography.bodyMd,
    color: THEME.colors.textPrimary,
  },
  actionRowChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRowChevronText: {
    ...THEME.typography.labelLg,
    color: THEME.colors.primary,
  },

  // Info Grid
  infoGrid: {
    padding: 16,
    gap: 16,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 16,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    ...THEME.typography.overline,
    textTransform: undefined,
    color: THEME.colors.textTertiary,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  infoValue: {
    ...THEME.typography.h4,
    color: THEME.colors.textPrimary,
  },
  priorityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.sm,
  },
  priorityText: {
    ...THEME.typography.labelSm,
    letterSpacing: 0.5,
  },

  // Items Table
  itemsTable: {
    padding: 16,
    paddingTop: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  tableHeaderCell: {
    ...THEME.typography.labelSm,
    color: THEME.colors.textTertiary,
    letterSpacing: 0.5,
    flex: 1,
  },
  tableHeaderCellRight: {
    textAlign: 'right',
    flex: 0,
    width: 50,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: DP_BRAND.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemBulletText: {
    ...THEME.typography.labelSm,
    color: THEME.colors.textInverse,
  },
  itemName: {
    ...THEME.typography.bodyMd,
    color: THEME.colors.textPrimary,
    flex: 1,
  },
  qtyBadge: {
    backgroundColor: DP_BRAND.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.md,
  },
  qtyText: {
    ...THEME.typography.labelMd,
    color: DP_BRAND.primary,
  },

  // Notes
  notesBody: {
    padding: 16,
  },
  notesText: {
    ...THEME.typography.bodyMd,
    color: THEME.colors.textSecondary,
  },

  // Progress Timeline
  progressTimeline: {
    padding: 16,
  },
  timelineStep: {
    flexDirection: 'row',
    minHeight: 64,
  },
  timelineLeft: {
    width: 40,
    alignItems: 'center',
  },
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.neutral200,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  timelineDotCompleted: {
    backgroundColor: THEME.colors.success,
  },
  timelineDotCurrent: {
    backgroundColor: DP_BRAND.primary,
    ...THEME.shadows.sm,
  },
  timelineDotCheck: {
    ...THEME.typography.labelLg,
    color: THEME.colors.textInverse,
  },
  timelineDotNumber: {
    ...THEME.typography.labelSm,
    color: THEME.colors.textTertiary,
  },
  timelineDotNumberCurrent: {
    color: THEME.colors.textInverse,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: THEME.colors.neutral200,
    marginVertical: 4,
  },
  timelineLineCompleted: {
    backgroundColor: THEME.colors.success,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 14,
    paddingBottom: 16,
  },
  timelineLabel: {
    ...THEME.typography.labelLg,
    color: THEME.colors.textTertiary,
  },
  timelineLabelActive: {
    color: THEME.colors.textPrimary,
  },
  timelineDescription: {
    ...THEME.typography.caption,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: DP_BRAND.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.full,
    alignSelf: 'flex-start',
  },
  currentBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: DP_BRAND.primary,
    marginRight: 6,
  },
  currentBadgeText: {
    ...THEME.typography.labelSm,
    color: DP_BRAND.primary,
  },

  // Action Button
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderRadius: THEME.radius.xl,
    ...THEME.shadows.md,
  },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
  },
  completedTextWrap: { flex: 1, marginLeft: 12 },
  completedTitle: { ...THEME.typography.h4 },
  completedSub: { ...THEME.typography.bodySm, color: THEME.colors.textSecondary, marginTop: 2 },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 16,
  },
  actionButtonIcon: {
    ...THEME.typography.displaySm,
    marginRight: 16,
  },
  actionButtonText: {
    justifyContent: 'center',
    flexShrink: 1,
  },
  actionButtonTitle: {
    ...THEME.typography.h4,
    color: THEME.colors.textInverse,
  },
  actionButtonSubtitle: {
    ...THEME.typography.bodySm,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  actionButtonArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonArrowText: {
    ...THEME.typography.h3,
    color: THEME.colors.textInverse,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: THEME.colors.background,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: THEME.colors.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyIcon: {
    ...THEME.typography.displayLg,
    
  },
  emptyTitle: {
    ...THEME.typography.h2,
    color: THEME.colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    ...THEME.typography.bodyMd,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: DP_BRAND.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: THEME.radius.lg,
    ...THEME.shadows.sm,
  },
  emptyButtonText: {
    ...THEME.typography.labelLg,
    color: THEME.colors.textInverse,
  }
});

export default DPDeliveryDetailScreen;