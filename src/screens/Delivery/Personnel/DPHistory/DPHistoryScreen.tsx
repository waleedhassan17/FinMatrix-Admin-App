import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, StatusBar, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { selectDeliveries } from '../../Admin/AssignDeliveries/deliverySlice';
import { selectUser } from '../../../Auth/authSlice';
import {
  selectDPHistoryUI,
  setHistoryStatusFilter,
  setHistoryDateFilter,
  setHistoryCustomDateStart,
  setHistoryCustomDateEnd,
  setHistoryPage
} from './dpHistorySlice';
import type { DPProfileStackParamList } from '../../../../navigators/stacks/DPProfileStack';
import { THEME, STATUS_CONFIG } from '../../../../utils/theme';
import { DP_BRAND } from '../../../../utils/deliveryTheme';

type Props = NativeStackScreenProps<DPProfileStackParamList, 'DPHistory'>;

const DATE_PRESETS = [
  { key: 'all', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
] as const;

const STATUS_FILTERS = [
  { key: 'all', label: 'All', icon: 'list' },
  { key: 'delivered', label: 'Delivered', icon: 'check' },
  { key: 'failed', label: 'Failed', icon: 'x' },
  { key: 'returned', label: 'Returned', icon: 'corner-down-left' },
] as const;

const ITEMS_PER_PAGE = 10;

const DPHistoryScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const deliveries = useAppSelector(selectDeliveries);
  const { statusFilter, dateFilter, customDateStart, customDateEnd, page } = useAppSelector(selectDPHistoryUI);
  const userId = user?.uid ?? 'dp_002';

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const myDeliveries = useMemo(() => {
    let filtered = deliveries.filter(d => d.assignedTo === userId);

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(d => d.status === statusFilter);
    } else {
      filtered = filtered.filter(d => ['delivered', 'failed', 'returned'].includes(d.status));
    }

    // Date filter
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    filtered = filtered.filter(d => {
      const date = new Date(d.updatedAt);
      switch (dateFilter) {
        case 'today':
          return date >= todayStart;
        case 'week':
          return date >= weekStart;
        case 'month':
          return date >= monthStart;
        case 'custom':
          const start = customDateStart ? new Date(customDateStart) : null;
          const end = customDateEnd ? new Date(customDateEnd) : null;
          if (start && date < start) return false;
          if (end) {
            const endOfDay = new Date(end);
            endOfDay.setHours(23, 59, 59, 999);
            if (date > endOfDay) return false;
          }
          return true;
        default:
          return true;
      }
    });

    return filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [deliveries, userId, statusFilter, dateFilter, customDateStart, customDateEnd]);

  const stats = useMemo(() => ({
    total: myDeliveries.length,
    delivered: myDeliveries.filter(d => d.status === 'delivered').length,
    failed: myDeliveries.filter(d => d.status === 'failed').length,
    returned: myDeliveries.filter(d => d.status === 'returned').length
  }), [myDeliveries]);

  const totalPages = Math.ceil(myDeliveries.length / ITEMS_PER_PAGE);
  const paginatedDeliveries = myDeliveries.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={DP_BRAND.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={20} color={DP_BRAND.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Delivery History</Text>
          <Text style={styles.headerSubtitle}>Past delivery records</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Filters Card */}
        <View style={styles.filtersCard}>
          <Text style={styles.filterLabel}>DATE RANGE</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChips}
          >
            {DATE_PRESETS.map(preset => (
              <TouchableOpacity
                key={preset.key}
                style={[
                  styles.filterChip,
                  dateFilter === preset.key && styles.filterChipActive,
                ]}
                onPress={() => dispatch(setHistoryDateFilter(preset.key))}
              >
                <Text style={[
                  styles.filterChipText,
                  dateFilter === preset.key && styles.filterChipTextActive,
                ]}>
                  {preset.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {dateFilter === 'custom' && (
            <View style={styles.customDateRow}>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowStartPicker(true)}
              >
                <Feather name="calendar" size={14} color={THEME.colors.textSecondary} style={{ marginRight: 8 }} />
                <Text style={styles.dateInputText}>
                  {customDateStart ? formatDate(customDateStart) : 'Start Date'}
                </Text>
              </TouchableOpacity>
              <Feather name="arrow-right" size={14} color={THEME.colors.textTertiary} />
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowEndPicker(true)}
              >
                <Feather name="calendar" size={14} color={THEME.colors.textSecondary} style={{ marginRight: 8 }} />
                <Text style={styles.dateInputText}>
                  {customDateEnd ? formatDate(customDateEnd) : 'End Date'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.filterDivider} />

          <Text style={styles.filterLabel}>STATUS</Text>
          <View style={styles.statusFilters}>
            {STATUS_FILTERS.map(filter => (
              <TouchableOpacity
                key={filter.key}
                style={[
                  styles.statusFilterChip,
                  statusFilter === filter.key && styles.statusFilterChipActive,
                ]}
                onPress={() => dispatch(setHistoryStatusFilter(filter.key))}
              >
                <Feather name={filter.icon as any} size={12} color={statusFilter === filter.key ? THEME.colors.primary : THEME.colors.textSecondary} style={{ marginRight: 4 }} />
                <Text style={[
                  styles.statusFilterText,
                  statusFilter === filter.key && styles.statusFilterTextActive,
                ]}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Stats Bar */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: THEME.colors.success }]}>{stats.delivered}</Text>
            <Text style={styles.statLabel}>Delivered</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: THEME.colors.danger }]}>{stats.failed}</Text>
            <Text style={styles.statLabel}>Failed</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: THEME.colors.secondary }]}>{stats.returned}</Text>
            <Text style={styles.statLabel}>Returned</Text>
          </View>
        </View>

        {/* Results */}
        <View style={styles.resultsCard}>
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsTitle}>Results</Text>
            <Text style={styles.resultsCount}>{myDeliveries.length} records</Text>
          </View>

          {paginatedDeliveries.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Feather name="inbox" size={28} color={THEME.colors.textTertiary} />
              </View>
              <Text style={styles.emptyTitle}>No Records Found</Text>
              <Text style={styles.emptyText}>Try adjusting your filters</Text>
            </View>
          ) : (
            <>
              {paginatedDeliveries.map((delivery, index) => {
                const config = STATUS_CONFIG[delivery.status] ?? STATUS_CONFIG.unassigned;
                return (
                  <View
                    key={delivery.id}
                    style={[
                      styles.historyItem,
                      index === paginatedDeliveries.length - 1 && styles.historyItemLast,
                    ]}
                  >
                    <View style={[styles.historyIcon, { backgroundColor: config.bg }]}>
                      <Feather name={config.icon as any} size={16} color={config.color} />
                    </View>
                    <View style={styles.historyContent}>
                      <View style={styles.historyHeader}>
                        <Text style={styles.historyRef}>{delivery.referenceNo}</Text>
                        <View style={[styles.historyBadge, { backgroundColor: config.bg }]}>
                          <Text style={[styles.historyBadgeText, { color: config.color }]}>
                            {config.label}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.historyCustomer}>{delivery.customerName}</Text>
                      <View style={styles.historyMeta}>
                        <Text style={styles.historyMetaText}><Feather name="map-pin" size={11} color={THEME.colors.textTertiary} /> {delivery.zone}</Text>
                        <Text style={styles.historyMetaDot}>•</Text>
                        <Text style={styles.historyMetaText}>
                          {formatDate(delivery.updatedAt)} at {formatTime(delivery.updatedAt)}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </View>

        {/* Pagination */}
        {totalPages > 1 && (
          <View style={styles.pagination}>
            <TouchableOpacity
              style={[styles.pageBtn, page === 1 && styles.pageBtnDisabled]}
              onPress={() => dispatch(setHistoryPage(page - 1))}
              disabled={page === 1}
            >
              <Text style={[styles.pageBtnText, page === 1 && styles.pageBtnTextDisabled]}><Feather name="arrow-left" size={13} /> Previous</Text>
            </TouchableOpacity>
            <View style={styles.pageInfo}>
              <Text style={styles.pageInfoText}>Page {page} of {totalPages}</Text>
            </View>
            <TouchableOpacity
              style={[styles.pageBtn, page === totalPages && styles.pageBtnDisabled]}
              onPress={() => dispatch(setHistoryPage(page + 1))}
              disabled={page === totalPages}
            >
              <Text style={[styles.pageBtnText, page === totalPages && styles.pageBtnTextDisabled]}>Next <Feather name="chevron-right" size={13} /></Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Date Pickers */}
      {showStartPicker && (
        <DateTimePicker
          value={customDateStart ? new Date(customDateStart) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            setShowStartPicker(false);
            if (date) dispatch(setHistoryCustomDateStart(date.toISOString()));
          }}
        />
      )}
      {showEndPicker && (
        <DateTimePicker
          value={customDateEnd ? new Date(customDateEnd) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            setShowEndPicker(false);
            if (date) dispatch(setHistoryCustomDateEnd(date.toISOString()));
          }}
        />
      )}
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
    ...THEME.typography.h3,
    color: DP_BRAND.white,
  },
  headerSubtitle: {
    ...THEME.typography.caption,
    color: DP_BRAND.headerTextSecondary,
    marginTop: 2,
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

  // Filters Card
  filtersCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    padding: 16,
    marginBottom: 16,
    ...THEME.shadows.sm,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
  },
  filterLabel: {
    ...THEME.typography.overline,
    textTransform: undefined,
    color: THEME.colors.textTertiary,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  filterChips: {
    gap: 8,
    paddingBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.neutral50,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  filterChipActive: {
    backgroundColor: DP_BRAND.primary,
    borderColor: DP_BRAND.primary,
  },
  filterChipText: {
    ...THEME.typography.bodySm,
    color: THEME.colors.textSecondary,
  },
  filterChipTextActive: {
    color: THEME.colors.textInverse,
    fontWeight: THEME.typography.labelMd.fontWeight,
  },
  customDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  dateInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: THEME.colors.neutral50,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  dateInputIcon: {
    ...THEME.typography.bodyMd,
    marginRight: 8,
  },
  dateInputText: {
    ...THEME.typography.bodySm,
    color: THEME.colors.textSecondary,
  },
  dateInputSeparator: {
    ...THEME.typography.bodyMd,
    color: THEME.colors.textTertiary,
  },
  filterDivider: {
    height: 1,
    backgroundColor: THEME.colors.borderLight,
    marginVertical: 16,
  },
  statusFilters: {
    flexDirection: 'row',
    gap: 8,
  },
  statusFilterChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.neutral50,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  statusFilterChipActive: {
    backgroundColor: DP_BRAND.primarySoft,
    borderColor: DP_BRAND.primary,
  },
  statusFilterIcon: {
    ...THEME.typography.caption,
    marginRight: 4,
  },
  statusFilterText: {
    ...THEME.typography.labelSm,
    color: THEME.colors.textSecondary,
  },
  statusFilterTextActive: {
    color: DP_BRAND.primary,
    fontWeight: THEME.typography.labelMd.fontWeight,
  },

  // Stats Bar
  statsBar: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 16,
    marginBottom: 16,
    ...THEME.shadows.sm,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: THEME.colors.borderLight,
  },
  statValue: {
    ...THEME.typography.h2,
    color: THEME.colors.textPrimary,
  },
  statLabel: {
    ...THEME.typography.caption,
    color: THEME.colors.textSecondary,
    marginTop: 4,
  },

  // Results Card
  resultsCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    ...THEME.shadows.sm,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    overflow: 'hidden',
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
  },
  resultsTitle: {
    ...THEME.typography.h4,
    color: THEME.colors.textPrimary,
  },
  resultsCount: {
    ...THEME.typography.caption,
    color: THEME.colors.textSecondary,
  },

  // Empty State
  emptyState: {
    padding: 48,
    alignItems: 'center',
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: THEME.colors.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyIcon: {
    ...THEME.typography.h1,
    
  },
  emptyTitle: {
    ...THEME.typography.h4,
    color: THEME.colors.textPrimary,
    marginBottom: 4,
  },
  emptyText: {
    ...THEME.typography.bodyMd,
    color: THEME.colors.textSecondary,
  },

  // History Item
  historyItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
  },
  historyItemLast: {
    borderBottomWidth: 0,
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  historyIconText: {
    ...THEME.typography.bodyLg,
    
  },
  historyContent: {
    flex: 1,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  historyRef: {
    ...THEME.typography.h5,
    color: THEME.colors.textPrimary,
  },
  historyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
  },
  historyBadgeText: {
    ...THEME.typography.overline,
    textTransform: undefined,
  },
  historyCustomer: {
    ...THEME.typography.bodySm,
    color: THEME.colors.textSecondary,
    marginBottom: 6,
  },
  historyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  historyMetaText: {
    ...THEME.typography.caption,
    color: THEME.colors.textTertiary,
  },
  historyMetaDot: {
    ...THEME.typography.caption,
    color: THEME.colors.textTertiary,
    marginHorizontal: 6,
  },

  // Pagination
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 12,
    ...THEME.shadows.sm,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
  },
  pageBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: THEME.radius.md,
    backgroundColor: DP_BRAND.primary,
  },
  pageBtnDisabled: {
    backgroundColor: THEME.colors.neutral200,
  },
  pageBtnText: {
    ...THEME.typography.labelMd,
    color: THEME.colors.textInverse,
  },
  pageBtnTextDisabled: {
    color: THEME.colors.textTertiary,
  },
  pageInfo: {
    paddingHorizontal: 16,
  },
  pageInfoText: {
    ...THEME.typography.bodySm,
    color: THEME.colors.textSecondary,
  }
});

export default DPHistoryScreen;