import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { HEADER_NAVY } from '../../../../components/reports/ReportUI';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { THEME, STATUS_CONFIG, PRIORITY_CONFIG } from '../../../../utils/theme';
import type { DashboardStackParamList } from '../../../../navigators/stacks/DashboardStack';
import { useAppSelector, useAppDispatch } from '../../../../hooks/useReduxHooks';
import {
  selectDeliveries,
  selectDeliveryPersonnel,
  fetchDeliveries,
  fetchDeliveryPersonnel,
} from '../AssignDeliveries/deliverySlice';
import {
  selectMonitorFilter,
  selectMonitorSort,
  setFilterStatus,
  setSortBy,
  type MonitorFilterStatus,
  type MonitorSortBy
} from './deliveryMonitorSlice';
import { getDeliveryMapDataAPI } from '../../../../networks/delivery/deliveryNetwork';

// Design-system tokens (see src/theme/theme.ts).
const { colors, radius, shadows, spacing, typography } = THEME;

type Props = NativeStackScreenProps<DashboardStackParamList, 'DeliveryMonitor'>;

// ── Types ────────────────────────────────────────────────────────────────────
interface MapMarker {
  deliveryId: string;
  status: string;
  priority: string;
  customerId: string;
  customerName?: string | null;
  personnelId: string | null;
  itemCount: number;
  assignedAt: string | null;
  createdAt: string;
  address?: string | null;
  destination?: { lat: number; lng: number; address: string | null } | null;
  personnel: {
    vehicleType: string | null;
    rating: string;
    isAvailable: boolean;
    lat: number | null;
    lng: number | null;
    locationUpdatedAt: string | null;
  } | null;
}

interface MapData {
  markers: MapMarker[];
  summary: {
    total: number;
    pending: number;
    inTransit: number;
    delivered: number;
    failed: number;
    unassigned: number;
  };
  locatedPersonnel: number;
}

// ── Constants ────────────────────────────────────────────────────────────────
// Delivery status colours come from THEME.STATUS_CONFIG, the same source
// the driver-facing screens read, so a delivery is one colour on both sides.
const STATUS_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.color]),
);

const STATUS_LABELS: Record<string, string> = {
  unassigned: 'Unassigned',
  pending: 'Pending',
  picked_up: 'Picked Up',
  in_transit: 'In Transit',
  arrived: 'Arrived',
  delivered: 'Delivered',
  failed: 'Failed',
  returned: 'Returned'
};

// Priority colours come from THEME.PRIORITY_CONFIG, the same source the
// driver-facing screens read. The local copies disagreed: `high` was dark
// red on three screens and dark amber on the delivery monitor.
const PRIORITY_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(PRIORITY_CONFIG).map(([k, v]) => [k, v.color]),
);

const PRIORITY_RANK: Record<string, number> = { urgent: 3, high: 2, normal: 1 };
const STATUS_RANK: Record<string, number> = {
  in_transit: 6, arrived: 5, picked_up: 4, pending: 3, unassigned: 2, failed: 1, returned: 0, delivered: 0
};

const FILTER_CHIPS: Array<{ label: string; value: MonitorFilterStatus }> = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'In Transit', value: 'in_transit' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Failed', value: 'failed' },
  { label: 'Returned', value: 'returned' },
];

const SORT_OPTIONS: Array<{ label: string; value: MonitorSortBy }> = [
  { label: 'Time', value: 'time' },
  { label: 'Status', value: 'status' },
  { label: 'Priority', value: 'priority' },
];

// Default map region (Lahore, Pakistan)
type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

const elapsedLabel = (from: string): string => {
  const diff = Date.now() - new Date(from).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

// ── Component ────────────────────────────────────────────────────────────────
const DeliveryMonitorScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const deliveries = useAppSelector(selectDeliveries);
  const personnel = useAppSelector(selectDeliveryPersonnel);
  const filterStatus = useAppSelector(selectMonitorFilter);
  const sortBy = useAppSelector(selectMonitorSort);

  const [mapData, setMapData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const personnelMap = useMemo(
    () => Object.fromEntries(personnel.map(p => [p.userId, p.displayName ?? p.userId])),
    [personnel],
  );

  const customerMap = useMemo(
    () => Object.fromEntries(deliveries.map(d => [d.id, { name: d.customerName, address: d.address ?? d.zone }])),
    [deliveries],
  );

  // ── Fetch map data ────────────────────────────────────────────────────────
  const fetchMapData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await getDeliveryMapDataAPI();
      setMapData(data);
      setLastUpdated(new Date());
    } catch {
      // Use Redux data as fallback — map just won't show GPS pins
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // fetchMapData only loads the GPS pins. Every number and row on this
    // screen comes from the Redux delivery list, which nothing here was
    // asking for -- so opened from anywhere other than Delivery Management
    // (which happens to fetch it) the monitor showed an empty board while
    // deliveries were in fact running.
    dispatch(fetchDeliveries());
    dispatch(fetchDeliveryPersonnel());
    fetchMapData();
    refreshTimerRef.current = setInterval(() => fetchMapData(true), 30_000);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [fetchMapData, dispatch]);

  // ── Compute stats from Redux deliveries ────────────────────────────────────
  const stats = useMemo(() => ({
    total: deliveries.length,
    pending: deliveries.filter(d => d.status === 'pending').length,
    inTransit: deliveries.filter(d => ['picked_up', 'in_transit', 'arrived'].includes(d.status)).length,
    delivered: deliveries.filter(d => d.status === 'delivered').length,
    failed: deliveries.filter(d => d.status === 'failed').length,
    unassigned: deliveries.filter(d => d.status === 'unassigned').length
  }), [deliveries]);

  // ── List (filtered + sorted) ──────────────────────────────────────────────
  const filteredList = useMemo(() => {
    const list = filterStatus === 'all'
      ? [...deliveries]
      : deliveries.filter(d => d.status === filterStatus);
    switch (sortBy) {
      case 'priority':
        return [...list].sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]);
      case 'status':
        return [...list].sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status]);
      default:
        return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  }, [deliveries, filterStatus, sortBy]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.container, styles.safeTop]} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={HEADER_NAVY[0]} />
      <View style={styles.body}>
      {/* ── Header ── */}
      <LinearGradient colors={HEADER_NAVY} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Feather name="arrow-left" size={20} color={colors.neutral0} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Delivery Monitor</Text>
          <Text style={styles.subtitle}>
            {refreshing ? 'Refreshing…' : `Updated ${elapsedLabel(lastUpdated.toISOString())}`}
          </Text>
        </View>
        <TouchableOpacity onPress={() => fetchMapData(true)} style={styles.headerBtn}>
          <Feather name="refresh-cw" size={18} color={colors.neutral0} />
        </TouchableOpacity>
      </LinearGradient>

      {/* ── Stats Bar ── */}
      <View style={styles.statsBar}>
        {[
          { label: 'Total', count: stats.total, color: colors.actionGreen },
          { label: 'Pending', count: stats.pending, color: STATUS_COLORS.pending },
          { label: 'Transit', count: stats.inTransit, color: STATUS_COLORS.in_transit },
          { label: 'Done', count: stats.delivered, color: STATUS_COLORS.delivered },
          { label: 'Failed', count: stats.failed, color: STATUS_COLORS.failed },
          { label: 'Tracking', count: mapData?.locatedPersonnel ?? 0, color: colors.secondary },
        ].map(item => (
          <View key={item.label} style={styles.statItem}>
            <View style={[styles.statDot, { backgroundColor: item.color }]} />
            <Text style={styles.statCount}>{item.count}</Text>
            <Text style={styles.statLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* The admin live-tracking map was removed by product decision (no Maps
           SDK key shipped). Riders navigate via Google Maps deep links from
           their delivery screens, which need no API key. */}

      {/* ── List View ── */}
      <View style={{ flex: 1 }}>
          {/* Sort + Filter */}
          <View style={styles.listControls}>
            <View style={styles.sortRow}>
              <Text style={styles.sortLabel}>Sort:</Text>
              {SORT_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.sortChip, sortBy === opt.value && styles.sortChipActive]}
                  onPress={() => dispatch(setSortBy(opt.value))}
                >
                  <Text style={[styles.sortChipText, sortBy === opt.value && styles.sortChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRowContent}
            >
              {FILTER_CHIPS.map(chip => {
                const active = filterStatus === chip.value;
                const chipColor = chip.value === 'all' ? colors.actionGreen : STATUS_COLORS[chip.value] ?? colors.neutral500;
                return (
                  <TouchableOpacity
                    key={chip.value}
                    style={[styles.filterChip, active && { backgroundColor: chipColor, borderColor: chipColor }]}
                    onPress={() => dispatch(setFilterStatus(chip.value))}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                      {chip.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <FlatList
            data={filteredList}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <Text style={styles.feedHeader}>
                {filteredList.length} deliver{filteredList.length !== 1 ? 'ies' : 'y'}
              </Text>
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Feather name="inbox" size={40} color={colors.neutral300} />
                <Text style={styles.emptyText}>No deliveries match this filter</Text>
              </View>
            }
            renderItem={({ item: delivery }) => {
              const statusColor = STATUS_COLORS[delivery.status] ?? colors.neutral500;
              const personName = delivery.assignedTo ? personnelMap[delivery.assignedTo] : null;
              const hasGps = (mapData?.markers ?? []).some(
                m => m.deliveryId === delivery.id && m.personnel?.lat != null,
              );
              return (
                <TouchableOpacity
                  style={styles.card}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('AdminDeliveryDetail', { deliveryId: delivery.id })}
                >
                  <View style={styles.cardTop}>
                    <View style={[styles.cardStatusStripe, { backgroundColor: statusColor }]} />
                    <View style={styles.cardMain}>
                      <View style={styles.cardRow}>
                        <Text style={styles.cardCustomer} numberOfLines={1}>{delivery.customerName}</Text>
                        <View style={[styles.priorityBadge, { backgroundColor: PRIORITY_COLORS[delivery.priority] + '22' }]}>
                          <Text style={[styles.priorityText, { color: PRIORITY_COLORS[delivery.priority] }]}>
                            {delivery.priority.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.cardAddress} numberOfLines={1}>
                        {delivery.address ?? delivery.zone}
                      </Text>
                      <View style={styles.cardMetaRow}>
                        {personName && <Text style={styles.metaChip}>👤 {personName}</Text>}
                        <Text style={styles.metaChip}>📦 {delivery.items.length}</Text>
                        <Text style={styles.metaChip}>{elapsedLabel(delivery.createdAt)}</Text>
                        {hasGps && (
                          <View style={styles.gpsPill}>
                            <View style={styles.gpsPillDot} />
                            <Text style={styles.gpsPillText}>GPS</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                  <View style={styles.cardFooter}>
                    <Text style={styles.refNo}>{delivery.referenceNo}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '18' }]}>
                      <Text style={[styles.statusText, { color: statusColor }]}>
                        {STATUS_LABELS[delivery.status] ?? delivery.status}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  safeTop: { backgroundColor: HEADER_NAVY[0] },
  body: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20
  },
  headerBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)'
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { ...typography.h4, color: colors.neutral0 },
  subtitle: { ...typography.caption, color: 'rgba(255,255,255,0.65)', marginTop: 1 },

  // Stats Bar
  statsBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    justifyContent: 'space-around'
  },
  statItem: { alignItems: 'center', flex: 1 },
  statDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 2 },
  statCount: { ...typography.h4, color: colors.textPrimary },
  statLabel: { ...typography.overline, color: colors.textSecondary, textAlign: 'center' },

  // View Toggle
  viewToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
    gap: 5
  },
  toggleBtnActive: { backgroundColor: colors.actionGreen },
  toggleBtnText: { ...typography.labelMd, color: colors.textSecondary },
  toggleBtnTextActive: { color: colors.neutral0 },
  fitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.actionGreen + '15',
    borderWidth: 1,
    borderColor: colors.actionGreen + '30'
  },
  fitBtnText: { ...typography.labelSm, color: colors.actionGreen },

  // Map
  mapContainer: { flex: 1 },
  map: { flex: 1 },
  mapLoading: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12,
    backgroundColor: colors.neutral100
  },
  mapLoadingText: { ...typography.bodySm, color: colors.textSecondary },

  // Marker
  markerContainer: { alignItems: 'center' },
  markerPin: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.neutral0,
    shadowColor: colors.neutral900, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 3, elevation: 5
  },
  markerTail: {
    width: 0, height: 0,
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    marginTop: -1
  },

  // Destination pin — hollow white pin with a status-colored border,
  // visually distinct from the filled "truck" personnel pin.
  destMarkerContainer: { alignItems: 'center' },
  destMarkerPin: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.neutral0, borderWidth: 2.5,
    shadowColor: colors.neutral900, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 3, elevation: 4
  },
  destMarkerTail: {
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 7,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    marginTop: -1
  },

  // Callout
  callout: { width: 220 },
  calloutContent: { padding: 12 },
  calloutHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  calloutStatusDot: { width: 8, height: 8, borderRadius: 4 },
  calloutStatus: { ...typography.labelMd, color: colors.neutral800, flex: 1 },
  calloutPriority: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  calloutPriorityText: { ...typography.overline, letterSpacing: 0.5 },
  calloutCustomer: { ...typography.h5, color: colors.neutral900, marginBottom: 2 },
  calloutAddress: { ...typography.overline, color: colors.neutral500, marginBottom: 8 },
  calloutDivider: { height: 1, backgroundColor: colors.neutral200, marginBottom: 8 },
  calloutMeta: { gap: 4, marginBottom: 8 },
  calloutMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  calloutMetaText: { ...typography.caption, color: colors.neutral500 },
  calloutTapHint: { alignItems: 'flex-end' },
  calloutTapHintText: { ...typography.caption, color: colors.info },

  // No GPS overlay
  noGpsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingBottom: 24,
    alignItems: 'center',
    pointerEvents: 'none' as any
  },
  noGpsCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    width: '85%',
    shadowColor: colors.neutral900, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 6
  },
  noGpsIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.neutral100, alignItems: 'center', justifyContent: 'center',
    marginBottom: 10
  },
  noGpsTitle: { ...typography.labelLg, color: colors.neutral800, marginBottom: 4 },
  noGpsText: { ...typography.caption, color: colors.neutral500, textAlign: 'center', lineHeight: 16 },

  // GPS count badge
  gpsCountBadge: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20,
    shadowColor: colors.neutral900, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3
  },
  gpsDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  gpsCountText: { ...typography.labelSm, color: colors.neutral800 },

  // List Controls
  listControls: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    paddingBottom: 4
  },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sortLabel: { ...typography.labelSm, color: colors.textSecondary },
  sortChip: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 6, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface
  },
  sortChipActive: { backgroundColor: colors.actionGreen, borderColor: colors.actionGreen },
  sortChipText: { ...typography.caption, color: colors.textSecondary },
  sortChipTextActive: { color: colors.neutral0, fontWeight: typography.labelLg.fontWeight },
  filterRowContent: { gap: 6, paddingBottom: 10, paddingRight: spacing.md },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface
  },
  filterChipText: { ...typography.caption, color: colors.textSecondary },
  filterChipTextActive: { color: colors.neutral0, fontWeight: typography.labelLg.fontWeight },

  // List
  listContent: { padding: spacing.md, paddingBottom: 32 },
  feedHeader: { ...typography.bodySm, color: colors.textSecondary, marginBottom: 10 },

  // Delivery Card
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: 10,
    ...shadows.sm,
    overflow: 'hidden'
  },
  cardTop: { flexDirection: 'row' },
  cardStatusStripe: { width: 4 },
  cardMain: { flex: 1, padding: 14 },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardCustomer: { ...typography.labelLg, color: colors.textPrimary, flex: 1, marginRight: 8 },
  cardAddress: { ...typography.labelSm, color: colors.textSecondary, marginBottom: 8 },
  cardMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  metaChip: { ...typography.caption, color: colors.textSecondary },
  priorityBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
  priorityText: { ...typography.overline, letterSpacing: 0.5 },
  gpsPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.successLighter, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10
  },
  gpsPillDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.success },
  gpsPillText: { ...typography.overline, color: colors.success },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.background
  },
  refNo: { ...typography.overline, color: colors.textTertiary },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  statusText: { ...typography.overline, textTransform: 'capitalize' },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { ...typography.bodySm, color: colors.textSecondary },
});

export default DeliveryMonitorScreen;
