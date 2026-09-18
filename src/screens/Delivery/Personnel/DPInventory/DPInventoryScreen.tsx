import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { selectUser } from '../../../Auth/authSlice';
import {
  selectInventoryUpdateRequests,
  selectDeliveryPersonnel,
  selectShadowInventory,
  fetchShadowInventory
} from '../../Admin/AssignDeliveries/deliverySlice';
import {
  selectDPInventoryUI,
  setInventorySearchTerm,
  setInventorySortBy,
  setInventoryCategory
} from './dpInventorySlice';
import type { DPInventoryStackParamList } from '../../../../navigators/stacks/DPInventoryStack';
import { Feather } from '@expo/vector-icons';
import { THEME } from '../../../../utils/theme';
import { DP_BRAND } from '../../../../utils/deliveryTheme';

type Props = NativeStackScreenProps<DPInventoryStackParamList, 'DPInventory'>;

const SORT_OPTIONS = [
  { key: 'name', label: 'Name', icon: 'type' },
  { key: 'qty', label: 'Quantity', icon: 'package' },
  { key: 'status', label: 'Status', icon: 'bar-chart-2' },
] as const;

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  synced: { color: THEME.colors.success, bg: THEME.colors.successLight, icon: 'check' },
  pending: { color: THEME.colors.warning, bg: THEME.colors.warningLight, icon: 'clock' },
  rejected: { color: THEME.colors.danger, bg: THEME.colors.dangerLight, icon: 'x' }
};

const DPInventoryScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const personnel = useAppSelector(selectDeliveryPersonnel);
  const requests = useAppSelector(selectInventoryUpdateRequests);
  const rawShadowInventory = useAppSelector(selectShadowInventory);
  const { searchTerm, sortBy, category } = useAppSelector(selectDPInventoryUI);
  const userId = user?.uid ?? 'dp_002';

  useEffect(() => {
    dispatch(fetchShadowInventory());
  }, [dispatch]);

  const me = useMemo(() => personnel.find(p => p.userId === userId), [personnel, userId]);

  const items = useMemo(() => {
    // Derive item status from inventory update requests
    const deriveStatus = (itemId: string, personnelId: string): 'synced' | 'pending' | 'rejected' => {
      const req = requests.find(r => r.personnelId === personnelId && r.itemId === itemId);
      if (!req) return 'synced';
      if (req.status === 'pending') return 'pending';
      if (req.status === 'rejected') return 'rejected';
      return 'synced';
    };

    let filtered = rawShadowInventory
      .filter(item => item.personnelId === userId)
      .map(item => ({
        id: `${item.personnelId}_${item.itemId}`,
        personnelId: item.personnelId,
        itemId: item.itemId,
        itemName: item.itemName,
        originalQty: item.quantity,
        currentQty: item.quantity,
        status: deriveStatus(item.itemId, item.personnelId),
        changesToday: [] as Array<{ id: string; delta: number; reason: string; timestamp: string }>
      }));

    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        item => item.itemName.toLowerCase().includes(search) || item.itemId.toLowerCase().includes(search),
      );
    }

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'qty':
          return b.currentQty - a.currentQty;
        case 'status':
          const statusOrder: Record<string, number> = { pending: 0, synced: 1, rejected: 2 };
          return (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1);
        default:
          return a.itemName.localeCompare(b.itemName);
      }
    });
  }, [rawShadowInventory, searchTerm, sortBy, userId, requests]);

  const myRequests = useMemo(
    () => requests.filter(r => r.personnelId === userId).slice(0, 5),
    [requests, userId],
  );

  const stats = useMemo(() => ({
    total: items.length,
    synced: items.filter(i => i.status === 'synced').length,
    pending: items.filter(i => i.status === 'pending').length,
    rejected: items.filter(i => i.status === 'rejected').length,
    totalQty: items.reduce((sum, i) => sum + i.currentQty, 0)
  }), [items]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={DP_BRAND.primary} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Inventory</Text>
            <Text style={styles.headerSubtitle}>Manage your assigned items</Text>
          </View>
          <TouchableOpacity
            style={styles.shadowBtn}
            onPress={() => navigation.navigate('DPShadowInventory')}
          >
            <Feather name="clipboard" size={14} color={DP_BRAND.white} style={{ marginRight: 6 }} />
            <Text style={styles.shadowBtnText}>Shadow</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Stats */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.statCardPrimary]}>
            <View style={styles.statIconWrap}>
              <Feather name="package" size={20} color={DP_BRAND.primary} />
            </View>
            <View style={styles.statInfo}>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total Items</Text>
            </View>
          </View>
          <View style={[styles.statCard, styles.statCardSecondary]}>
            <View style={styles.statIconWrap}>
              <Feather name="hash" size={20} color={THEME.colors.secondary} />
            </View>
            <View style={styles.statInfo}>
              <Text style={styles.statValue}>{stats.totalQty}</Text>
              <Text style={styles.statLabel}>Total Quantity</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.miniStat, { borderLeftColor: THEME.colors.success }]}>
            <Text style={[styles.miniStatValue, { color: THEME.colors.success }]}>{stats.synced}</Text>
            <Text style={styles.miniStatLabel}>Synced</Text>
          </View>
          <View style={[styles.miniStat, { borderLeftColor: THEME.colors.warning }]}>
            <Text style={[styles.miniStatValue, { color: THEME.colors.warning }]}>{stats.pending}</Text>
            <Text style={styles.miniStatLabel}>Pending</Text>
          </View>
          <View style={[styles.miniStat, { borderLeftColor: THEME.colors.danger }]}>
            <Text style={[styles.miniStatValue, { color: THEME.colors.danger }]}>{stats.rejected}</Text>
            <Text style={styles.miniStatLabel}>Rejected</Text>
          </View>
        </View>

        {/* Search & Sort Card */}
        <View style={styles.filterCard}>
          <View style={styles.searchContainer}>
            <View style={styles.searchIcon}>
              <Feather name="search" size={14} color={THEME.colors.textTertiary} />
            </View>
            <TextInput
              value={searchTerm}
              onChangeText={text => dispatch(setInventorySearchTerm(text))}
              placeholder="Search items..."
              placeholderTextColor={THEME.colors.textTertiary}
              style={styles.searchInput}
            />
            {searchTerm.length > 0 && (
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => dispatch(setInventorySearchTerm(''))}
              >
                <Feather name="x" size={14} color={THEME.colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.sortRow}>
            <Text style={styles.sortLabel}>Sort by:</Text>
            {SORT_OPTIONS.map(option => (
              <TouchableOpacity
                key={option.key}
                style={[styles.sortChip, sortBy === option.key && styles.sortChipActive]}
                onPress={() => dispatch(setInventorySortBy(option.key))}
              >
                <Feather name={option.icon as any} size={10} color={sortBy === option.key ? THEME.colors.textInverse : THEME.colors.textSecondary} style={{ marginRight: 4 }} />
                <Text style={[
                  styles.sortChipText,
                  sortBy === option.key && styles.sortChipTextActive,
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Inventory Items Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconWrap}>
              <Feather name="clipboard" size={18} color={DP_BRAND.primary} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Inventory Items</Text>
              <Text style={styles.cardSubtitle}>{items.length} items found</Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          {items.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Feather name="inbox" size={28} color={THEME.colors.textTertiary} />
              </View>
              <Text style={styles.emptyTitle}>No Items Found</Text>
              <Text style={styles.emptyText}>Try adjusting your search</Text>
            </View>
          ) : (
            <View style={styles.itemsList}>
              {items.map((item, index) => {
                const config = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
                const diff = item.currentQty - item.originalQty;

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.itemCard, index === items.length - 1 && styles.itemCardLast]}
                    onPress={() => navigation.navigate('DPShadowInventory')}
                    activeOpacity={0.7}
                  >
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemName}>{item.itemName}</Text>
                      <View style={[styles.itemBadge, { backgroundColor: config.bg }]}>
                        <Feather name={config.icon as any} size={10} color={config.color} style={{ marginRight: 4 }} />
                        <Text style={[styles.itemBadgeText, { color: config.color }]}>{item.status}</Text>
                      </View>
                    </View>

                    <View style={styles.itemDetails}>
                      <View style={styles.qtyBlock}>
                        <Text style={styles.qtyLabel}>Original</Text>
                        <Text style={styles.qtyValue}>{item.originalQty}</Text>
                      </View>
                      <View style={styles.qtyArrow}>
                        <Feather name="arrow-right" size={16} color={THEME.colors.textTertiary} />
                      </View>
                      <View style={styles.qtyBlock}>
                        <Text style={styles.qtyLabel}>Current</Text>
                        <Text style={styles.qtyValue}>{item.currentQty}</Text>
                      </View>
                      <View style={[
                        styles.diffBadge,
                        diff > 0 ? styles.diffPositive : diff < 0 ? styles.diffNegative : styles.diffNeutral,
                      ]}>
                        <Text style={[
                          styles.diffText,
                          diff > 0 ? styles.diffTextPositive : diff < 0 ? styles.diffTextNegative : styles.diffTextNeutral,
                        ]}>
                          {diff > 0 ? '+' : ''}{diff}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.itemFooter}>
                      <Text style={styles.changesText}>
                        {item.changesToday.length} change{item.changesToday.length !== 1 ? 's' : ''} today
                      </Text>
                      <Text style={styles.viewLink}>View <Feather name="arrow-right" size={12} color={DP_BRAND.primary} /></Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Pending Requests Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconWrap, { backgroundColor: THEME.colors.warningLight }]}>
              <Feather name="edit" size={18} color={THEME.colors.warning} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Pending Requests</Text>
              <Text style={styles.cardSubtitle}>Awaiting warehouse approval</Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          {myRequests.length === 0 ? (
            <View style={styles.emptyStateSmall}>
              <Text style={styles.emptyTextSmall}>No pending requests</Text>
            </View>
          ) : (
            <View style={styles.requestsList}>
              {myRequests.map((req, index) => {
                const config = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending;
                return (
                  <View
                    key={req.id}
                    style={[styles.requestItem, index === myRequests.length - 1 && styles.requestItemLast]}
                  >
                    <View style={styles.requestInfo}>
                      <Text style={styles.requestName}>{req.itemName}</Text>
                      <Text style={styles.requestQty}>Requested: {req.requestedQty}</Text>
                    </View>
                    <View style={[styles.requestBadge, { backgroundColor: config.bg }]}>
                      <Text style={[styles.requestBadgeText, { color: config.color }]}>{req.status}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

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
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    ...THEME.typography.bodySm,
    color: DP_BRAND.headerTextSecondary,
    marginTop: 3,
  },
  shadowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DP_BRAND.headerOverlaySolid,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: THEME.radius.full,
  },
  shadowBtnIcon: {
    ...THEME.typography.bodyMd,
    marginRight: 6,
  },
  shadowBtnText: {
    ...THEME.typography.labelMd,
    color: DP_BRAND.white,
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

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: THEME.radius.xl,
    ...THEME.shadows.sm,
    borderWidth: 1,
  },
  statCardPrimary: {
    backgroundColor: DP_BRAND.primarySoft,
    borderColor: DP_BRAND.primaryBorder,
  },
  statCardSecondary: {
    backgroundColor: THEME.colors.secondaryLight,
    borderColor: THEME.colors.infoLight,
  },
  statIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    ...THEME.shadows.xs,
  },
  statIcon: {
    ...THEME.typography.h2,
    
  },
  statInfo: {},
  statValue: {
    ...THEME.typography.h2,
    color: THEME.colors.textPrimary,
  },
  statLabel: {
    ...THEME.typography.caption,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  miniStat: {
    flex: 1,
    backgroundColor: THEME.colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: THEME.radius.lg,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    ...THEME.shadows.xs,
  },
  miniStatValue: {
    ...THEME.typography.h3,
    
  },
  miniStatLabel: {
    ...THEME.typography.caption,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },

  // Filter Card
  filterCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    padding: 16,
    marginBottom: 16,
    ...THEME.shadows.sm,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.neutral50,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchIconText: {
    ...THEME.typography.bodyMd,
    
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    ...THEME.typography.bodyMd,
    color: THEME.colors.textPrimary,
  },
  clearBtn: {
    padding: 4,
  },
  clearBtnText: {
    ...THEME.typography.bodyMd,
    color: THEME.colors.textTertiary,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sortLabel: {
    ...THEME.typography.caption,
    color: THEME.colors.textSecondary,
    marginRight: 4,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.neutral50,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  sortChipActive: {
    backgroundColor: DP_BRAND.primary,
    borderColor: DP_BRAND.primary,
  },
  sortChipIcon: {
    ...THEME.typography.caption,
    marginRight: 4,
  },
  sortChipText: {
    ...THEME.typography.caption,
    color: THEME.colors.textSecondary,
  },
  sortChipTextActive: {
    color: THEME.colors.textInverse,
    fontWeight: THEME.typography.labelMd.fontWeight,
  },

  // Card
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    marginBottom: 16,
    ...THEME.shadows.sm,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    overflow: 'hidden',
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

  // Items List
  itemsList: {
    padding: 12,
  },
  itemCard: {
    backgroundColor: THEME.colors.neutral50,
    borderRadius: THEME.radius.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  itemCardLast: {
    marginBottom: 0,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemName: {
    ...THEME.typography.h5,
    color: THEME.colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  itemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.sm,
  },
  itemBadgeIcon: {
    ...THEME.typography.caption,
    marginRight: 4,
  },
  itemBadgeText: {
    ...THEME.typography.overline,
    textTransform: 'capitalize',
  },
  itemDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  qtyBlock: {
    flex: 1,
    alignItems: 'center',
  },
  qtyLabel: {
    ...THEME.typography.caption,
    textTransform: undefined,
    color: THEME.colors.textTertiary,
    marginBottom: 2,
  },
  qtyValue: {
    ...THEME.typography.h3,
    color: THEME.colors.textPrimary,
  },
  qtyArrow: {
    paddingHorizontal: 12,
  },
  qtyArrowText: {
    ...THEME.typography.bodyLg,
    color: THEME.colors.textTertiary,
  },
  diffBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.sm,
  },
  diffPositive: {
    backgroundColor: THEME.colors.successLight,
  },
  diffNegative: {
    backgroundColor: THEME.colors.dangerLight,
  },
  diffNeutral: {
    backgroundColor: THEME.colors.neutral100,
  },
  diffText: {
    ...THEME.typography.labelMd,
    
  },
  diffTextPositive: {
    color: THEME.colors.success,
  },
  diffTextNegative: {
    color: THEME.colors.danger,
  },
  diffTextNeutral: {
    color: THEME.colors.textTertiary,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  changesText: {
    ...THEME.typography.caption,
    color: THEME.colors.textSecondary,
  },
  viewLink: {
    ...THEME.typography.labelMd,
    color: DP_BRAND.primary,
  },

  // Empty States
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
    ...THEME.typography.displayMd,
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
  emptyStateSmall: {
    padding: 24,
    alignItems: 'center',
  },
  emptyTextSmall: {
    ...THEME.typography.bodyMd,
    color: THEME.colors.textTertiary,
  },

  // Requests List
  requestsList: {
    padding: 12,
  },
  requestItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
  },
  requestItemLast: {
    borderBottomWidth: 0,
  },
  requestInfo: {},
  requestName: {
    ...THEME.typography.labelLg,
    color: THEME.colors.textPrimary,
  },
  requestQty: {
    ...THEME.typography.caption,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  requestBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.sm,
  },
  requestBadgeText: {
    ...THEME.typography.overline,
    textTransform: 'capitalize',
  }
});

export default DPInventoryScreen;