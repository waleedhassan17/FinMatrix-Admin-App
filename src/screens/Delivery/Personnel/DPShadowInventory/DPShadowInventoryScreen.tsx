import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  StatusBar
} from 'react-native';
import { Alert } from '../../../../utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DPInventoryStackParamList } from '../../../../navigators/stacks/DPInventoryStack';
import { Feather } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { selectUser } from '../../../Auth/authSlice';
import { selectInventoryUpdateRequests, selectShadowInventory, fetchShadowInventory } from '../../Admin/AssignDeliveries/deliverySlice';
import {
  openChangeLog,
  closeChangeLog,
  selectShadowInventoryUI,
  setShadowInventorySearchTerm,
  setShadowInventorySortBy
} from './dpShadowInventorySlice';
import { THEME } from '../../../../utils/theme';
import { DP_BRAND } from '../../../../utils/deliveryTheme';

type Props = NativeStackScreenProps<DPInventoryStackParamList, 'DPShadowInventory'>;

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  synced: { color: THEME.colors.success, bg: THEME.colors.successLight, icon: 'check' },
  pending: { color: THEME.colors.warning, bg: THEME.colors.warningLight, icon: 'clock' },
  rejected: { color: THEME.colors.danger, bg: THEME.colors.dangerLight, icon: 'x' }
};

const SORT_OPTIONS = [
  { key: 'name_asc', label: 'A-Z', icon: 'type' },
  { key: 'name_desc', label: 'Z-A', icon: 'type' },
  { key: 'qty_low', label: 'Qty \u2191', icon: 'package' },
  { key: 'qty_high', label: 'Qty \u2193', icon: 'package' },
  { key: 'changes_high', label: 'Changes', icon: 'edit' },
] as const;

/** Projected shape that the UI uses for rendering */
interface ShadowDisplayItem {
  id: string;
  personnelId: string;
  itemId: string;
  itemName: string;
  originalQty: number;
  currentQty: number;
  status: 'synced' | 'pending' | 'rejected';
  changesToday: Array<{ id: string; delta: number; reason: string; timestamp: string }>;
}

const DPShadowInventoryScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const requests = useAppSelector(selectInventoryUpdateRequests);
  const shadowItems = useAppSelector(selectShadowInventory);
  const { selectedItemId, showChangeLog, searchTerm, sortBy } = useAppSelector(selectShadowInventoryUI);
  const userId = user?.uid ?? 'dp_002';

  useEffect(() => {
    dispatch(fetchShadowInventory());
  }, [dispatch]);

  const items: ShadowDisplayItem[] = useMemo(() => {
    const filtered = shadowItems
      .filter(item => item.personnelId === userId)
      .filter(item => {
        if (!searchTerm.trim()) return true;
        const text = searchTerm.trim().toLowerCase();
        return item.itemName.toLowerCase().includes(text) || item.itemId.toLowerCase().includes(text);
      })
      .map(item => {
        const status = (item.syncStatus as 'synced' | 'pending' | 'rejected') ?? 'synced';
        return {
          id: `${item.personnelId}_${item.itemId}`,
          personnelId: item.personnelId,
          itemId: item.itemId,
          itemName: item.itemName,
          originalQty: item.originalQty ?? item.quantity,
          currentQty: item.quantity,
          status,
          changesToday: [] as ShadowDisplayItem['changesToday']
        };
      });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name_desc':
          return b.itemName.localeCompare(a.itemName);
        case 'qty_low':
          return a.currentQty - b.currentQty;
        case 'qty_high':
          return b.currentQty - a.currentQty;
        case 'changes_high':
          return b.changesToday.length - a.changesToday.length;
        default:
          return a.itemName.localeCompare(b.itemName);
      }
    });
  }, [shadowItems, searchTerm, sortBy, userId]);

  const selectedItem = items.find(i => i.id === selectedItemId);

  const myRequests = useMemo(
    () => requests.filter(r => r.personnelId === userId).slice(0, 5),
    [requests, userId],
  );

  const stats = useMemo(() => ({
    total: items.length,
    synced: items.filter(i => i.status === 'synced').length,
    pending: items.filter(i => i.status === 'pending').length,
    totalChanges: items.reduce((sum, i) => sum + i.changesToday.length, 0)
  }), [items]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={DP_BRAND.primary} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={20} color={DP_BRAND.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Shadow Inventory</Text>
          <Text style={styles.headerSubtitle}>Your local inventory copy</Text>
        </View>
        <TouchableOpacity 
          style={styles.infoBtn}
          onPress={() => Alert.alert(
            'Shadow Inventory', 
            'This is your local copy of inventory used during deliveries. Changes sync to the warehouse after approval.'
          )}
        >
          <Feather name="info" size={18} color={DP_BRAND.white} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: DP_BRAND.primarySoft, borderColor: DP_BRAND.primaryBorder }]}>
            <Feather name="package" size={18} color={DP_BRAND.primary} style={{ marginBottom: 4 }} />
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Items</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: THEME.colors.successLighter, borderColor: THEME.colors.successLight }]}>
            <Feather name="check" size={18} color={THEME.colors.success} style={{ marginBottom: 4 }} />
            <Text style={[styles.statValue, { color: THEME.colors.success }]}>{stats.synced}</Text>
            <Text style={styles.statLabel}>Synced</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: THEME.colors.warningLighter, borderColor: THEME.colors.warningLight }]}>
            <Feather name="clock" size={18} color={THEME.colors.warning} style={{ marginBottom: 4 }} />
            <Text style={[styles.statValue, { color: THEME.colors.warning }]}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: THEME.colors.secondaryLight, borderColor: THEME.colors.secondary + '33' }]}>
            <Feather name="edit" size={18} color={THEME.colors.secondary} style={{ marginBottom: 4 }} />
            <Text style={[styles.statValue, { color: THEME.colors.secondary }]}>{stats.totalChanges}</Text>
            <Text style={styles.statLabel}>Changes</Text>
          </View>
        </View>

        {/* Filter Card */}
        <View style={styles.filterCard}>
          <View style={styles.searchContainer}>
            <Feather name="search" size={14} color={THEME.colors.textTertiary} style={{ marginRight: 8 }} />
            <TextInput
              value={searchTerm}
              onChangeText={text => dispatch(setShadowInventorySearchTerm(text))}
              placeholder="Search items..."
              placeholderTextColor={THEME.colors.textTertiary}
              style={styles.searchInput}
            />
            {searchTerm.length > 0 && (
              <TouchableOpacity onPress={() => dispatch(setShadowInventorySearchTerm(''))}>
                <Feather name="x" size={14} color={THEME.colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.sortRow}
          >
            {SORT_OPTIONS.map(option => {
              const active = sortBy === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.sortChip, active && styles.sortChipActive]}
                  onPress={() => dispatch(setShadowInventorySortBy(option.key))}
                >
                  <Feather name={option.icon as any} size={10} color={active ? THEME.colors.textInverse : THEME.colors.textSecondary} style={{ marginRight: 4 }} />
                  <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Items Card */}
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
                    onPress={() => dispatch(openChangeLog(item.id))}
                    activeOpacity={0.7}
                  >
                    <View style={styles.itemHeader}>
                      <View style={styles.itemNameRow}>
                        <Text style={styles.itemName}>{item.itemName}</Text>
                        <Text style={styles.itemId}>{item.itemId}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
                        <Feather name={config.icon as any} size={10} color={config.color} style={{ marginRight: 4 }} />
                        <Text style={[styles.statusText, { color: config.color }]}>
                          {item.status}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.qtyRow}>
                      <View style={styles.qtyBox}>
                        <Text style={styles.qtyLabel}>ORIGINAL</Text>
                        <Text style={styles.qtyValue}>{item.originalQty}</Text>
                      </View>
                      <View style={styles.qtyArrow}>
                        <Feather name="arrow-right" size={16} color={THEME.colors.textTertiary} />
                      </View>
                      <View style={styles.qtyBox}>
                        <Text style={styles.qtyLabel}>CURRENT</Text>
                        <Text style={styles.qtyValue}>{item.currentQty}</Text>
                      </View>
                      <View style={[
                        styles.diffBadge,
                        diff > 0 ? styles.diffPositive : diff < 0 ? styles.diffNegative : styles.diffNeutral
                      ]}>
                        <Text style={[
                          styles.diffText,
                          diff > 0 ? styles.diffTextPositive : diff < 0 ? styles.diffTextNegative : styles.diffTextNeutral
                        ]}>
                          {diff > 0 ? '+' : ''}{diff}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.itemFooter}>
                      <View style={styles.changesInfo}>
                        <View style={[styles.changesDot, item.changesToday.length > 0 && styles.changesDotActive]} />
                        <Text style={styles.changesText}>
                          {item.changesToday.length} change{item.changesToday.length !== 1 ? 's' : ''} today
                        </Text>
                      </View>
                      <Text style={styles.viewLink}>View Log <Feather name="arrow-right" size={12} color={DP_BRAND.primary} /></Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Submit Button */}
        <TouchableOpacity 
          style={styles.submitButton}
          onPress={() => Alert.alert('Submitted', 'Inventory update request queued for warehouse review.')}
          activeOpacity={0.9}
        >
          <View style={styles.submitButtonContent}>
            <Feather name="upload" size={24} color={THEME.colors.textInverse} style={{ marginRight: 14 }} />
            <View>
              <Text style={styles.submitTitle}>Submit Inventory Update</Text>
              <Text style={styles.submitSubtitle}>Send changes for warehouse approval</Text>
            </View>
          </View>
          <View style={styles.submitArrow}>
            <Feather name="arrow-right" size={18} color={THEME.colors.textInverse} />
          </View>
        </TouchableOpacity>

        {/* Pending Requests Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconWrap, { backgroundColor: THEME.colors.warningLight }]}>
              <Feather name="edit" size={18} color={THEME.colors.warning} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Submitted Requests</Text>
              <Text style={styles.cardSubtitle}>Awaiting approval</Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          {myRequests.length === 0 ? (
            <View style={styles.emptyStateSmall}>
              <Text style={styles.emptyTextSmall}>No submitted requests yet</Text>
            </View>
          ) : (
            <View style={styles.requestsList}>
              {myRequests.map((req, index) => {
                const config = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending;
                return (
                  <View 
                    key={req.id} 
                    style={[styles.requestRow, index === myRequests.length - 1 && styles.requestRowLast]}
                  >
                    <View style={styles.requestInfo}>
                      <Text style={styles.requestName}>{req.itemName}</Text>
                      <Text style={styles.requestQty}>Qty: {req.requestedQty}</Text>
                    </View>
                    <View style={[styles.requestBadge, { backgroundColor: config.bg }]}>
                      <Text style={[styles.requestBadgeText, { color: config.color }]}>
                        {req.status}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Change Log Modal */}
      <Modal 
        visible={showChangeLog} 
        transparent 
        animationType="slide" 
        onRequestClose={() => dispatch(closeChangeLog())}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}>
                <Feather name="edit" size={28} color={DP_BRAND.primary} />
              </View>
              <Text style={styles.modalTitle}>{selectedItem?.itemName ?? 'Change Log'}</Text>
              <Text style={styles.modalSubtitle}>Today's inventory changes</Text>
            </View>

            <View style={styles.modalDivider} />

            <ScrollView style={styles.changesList}>
              {(selectedItem?.changesToday ?? []).length === 0 ? (
                <View style={styles.emptyStateSmall}>
                  <Text style={styles.emptyTextSmall}>No changes recorded today</Text>
                </View>
              ) : (
                (selectedItem?.changesToday ?? []).map(ch => (
                  <View key={ch.id} style={styles.changeItem}>
                    <View style={styles.changeLeft}>
                      <View style={[
                        styles.changeDot,
                        ch.delta > 0 ? styles.changeDotPositive : styles.changeDotNegative
                      ]} />
                      <View>
                        <Text style={styles.changeTime}>
                          {new Date(ch.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        <Text style={styles.changeReason}>{ch.reason}</Text>
                      </View>
                    </View>
                    <View style={[
                      styles.changeDeltaBadge,
                      ch.delta > 0 ? styles.changeDeltaPositive : styles.changeDeltaNegative
                    ]}>
                      <Text style={[
                        styles.changeDeltaText,
                        ch.delta > 0 ? styles.changeDeltaTextPositive : styles.changeDeltaTextNegative
                      ]}>
                        {ch.delta > 0 ? '+' : ''}{ch.delta}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            <TouchableOpacity 
              style={styles.modalCloseBtn} 
              onPress={() => dispatch(closeChangeLog())}
            >
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    ...THEME.typography.h2,
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
  infoBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DP_BRAND.headerOverlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIcon: {
    ...THEME.typography.h3,
    
  },

  scrollView: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  scrollContent: {
    padding: 16,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
  },
  statIcon: {
    ...THEME.typography.h3,
    marginBottom: 4,
  },
  statValue: {
    ...THEME.typography.h2,
    color: THEME.colors.textPrimary,
  },
  statLabel: {
    ...THEME.typography.caption,
    textTransform: undefined,
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
    ...THEME.typography.bodyMd,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    ...THEME.typography.bodyMd,
    color: THEME.colors.textPrimary,
  },
  clearIcon: {
    ...THEME.typography.bodyMd,
    color: THEME.colors.textTertiary,
    padding: 4,
  },
  sortRow: {
    gap: 8,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.neutral50,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginRight: 8,
  },
  sortChipActive: {
    backgroundColor: DP_BRAND.primary,
    borderColor: DP_BRAND.primary,
  },
  sortChipIcon: {
    ...THEME.typography.overline,
    textTransform: undefined,
    marginRight: 4,
  },
  sortChipText: {
    ...THEME.typography.labelSm,
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
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  itemNameRow: {},
  itemName: {
    ...THEME.typography.h5,
    color: THEME.colors.textPrimary,
  },
  itemId: {
    ...THEME.typography.caption,
    color: THEME.colors.textTertiary,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.sm,
  },
  statusIcon: {
    ...THEME.typography.overline,
    textTransform: undefined,
    marginRight: 4,
  },
  statusText: {
    ...THEME.typography.overline,
    textTransform: 'capitalize',
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  qtyBox: {
    flex: 1,
    alignItems: 'center',
  },
  qtyLabel: {
    ...THEME.typography.overline,
    textTransform: undefined,
    color: THEME.colors.textTertiary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  qtyValue: {
    ...THEME.typography.h2,
    color: THEME.colors.textPrimary,
  },
  qtyArrow: {
    paddingHorizontal: 12,
  },
  qtyArrowText: {
    ...THEME.typography.h4,
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
  changesInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  changesDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.neutral300,
    marginRight: 8,
  },
  changesDotActive: {
    backgroundColor: THEME.colors.success,
  },
  changesText: {
    ...THEME.typography.caption,
    color: THEME.colors.textSecondary,
  },
  viewLink: {
    ...THEME.typography.labelMd,
    color: DP_BRAND.primary,
  },

  // Submit Button
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.success,
    borderRadius: THEME.radius.xl,
    padding: 16,
    marginBottom: 16,
    ...THEME.shadows.md,
  },
  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submitIcon: {
    ...THEME.typography.h1,
    marginRight: 14,
  },
  submitTitle: {
    ...THEME.typography.h4,
    color: THEME.colors.textInverse,
  },
  submitSubtitle: {
    ...THEME.typography.caption,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  submitArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitArrowText: {
    ...THEME.typography.h3,
    color: THEME.colors.textInverse,
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
  requestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
  },
  requestRowLast: {
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
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: THEME.colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: THEME.radius.xxl,
    borderTopRightRadius: THEME.radius.xxl,
    padding: 20,
    paddingTop: 12,
    maxHeight: '70%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: THEME.colors.neutral200,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: DP_BRAND.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalIcon: {
    ...THEME.typography.displayMd,
  },
  modalTitle: {
    ...THEME.typography.h2,
    color: THEME.colors.textPrimary,
    marginBottom: 4,
  },
  modalSubtitle: {
    ...THEME.typography.bodyMd,
    color: THEME.colors.textSecondary,
  },
  modalDivider: {
    height: 1,
    backgroundColor: THEME.colors.borderLight,
    marginBottom: 16,
  },
  changesList: {
    maxHeight: 300,
  },
  changeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
  },
  changeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  changeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  changeDotPositive: {
    backgroundColor: THEME.colors.success,
  },
  changeDotNegative: {
    backgroundColor: THEME.colors.danger,
  },
  changeTime: {
    ...THEME.typography.labelLg,
    color: THEME.colors.textPrimary,
  },
  changeReason: {
    ...THEME.typography.caption,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  changeDeltaBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.md,
  },
  changeDeltaPositive: {
    backgroundColor: THEME.colors.successLight,
  },
  changeDeltaNegative: {
    backgroundColor: THEME.colors.dangerLight,
  },
  changeDeltaText: {
    ...THEME.typography.h5,
    
  },
  changeDeltaTextPositive: {
    color: THEME.colors.success,
  },
  changeDeltaTextNegative: {
    color: THEME.colors.danger,
  },
  modalCloseBtn: {
    backgroundColor: DP_BRAND.primary,
    borderRadius: THEME.radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  modalCloseBtnText: {
    ...THEME.typography.h4,
    color: THEME.colors.textInverse,
  }
});

export default DPShadowInventoryScreen;