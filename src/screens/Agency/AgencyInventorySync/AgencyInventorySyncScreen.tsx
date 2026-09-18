// ═══════════════════════════════════════════════════════
// FinMatrix — Agency Inventory Sync Screen
// ═══════════════════════════════════════════════════════
// Table: Agency Item | SKU | Agency Qty | System Qty | Status
// Sync All & Selective Sync buttons.

import React, { useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator
} from 'react-native';
import { Alert } from '../../../utils/alert';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { THEME } from '../../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { selectAgencies } from '../AgencyList/agencyListSlice';
import {
  selectSyncRows,
  selectSyncIsLoading,
  selectSyncIsSyncing,
  selectSyncSearchQuery,
  selectSyncStatusFilter,
  setRows,
  setSearchQuery,
  setStatusFilter,
  toggleRowSelection,
  selectAll,
  deselectAll,
  markRowsSynced,
  setIsLoading,
  setIsSyncing,
  resetSync,
  syncSelectedItems,
  type SyncRow,
  type SyncStatus
} from './agencyInventorySyncSlice';
import CustomButton from '../../../Custom-Components/CustomButton';
import type { MoreStackParamList } from '../../../navigators/stacks/MoreStack';

// Design-system tokens (see src/theme/theme.ts).
const { colors, radius, shadows, spacing, typography } = THEME;

type SyncRoute = RouteProp<MoreStackParamList, 'AgencyInventorySync'>;
type Nav = NativeStackNavigationProp<MoreStackParamList>;

// ── Status config ─────────────────────────────────
const STATUS_CONFIG: Record<SyncStatus, { label: string; color: string; bg: string }> = {
  synced: { label: 'Synced', color: colors.success, bg: colors.success + '18' },
  mismatch: { label: 'Mismatch', color: colors.warning, bg: colors.warning + '18' },
  agency_only: { label: 'Agency Only', color: colors.secondary, bg: colors.secondary + '18' },
  system_only: { label: 'System Only', color: colors.textTertiary, bg: colors.textTertiary + '18' }
};

const FILTER_CHIPS: { key: SyncStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'mismatch', label: 'Mismatch' },
  { key: 'agency_only', label: 'Agency Only' },
  { key: 'synced', label: 'Synced' },
];

// ═══════════════════════════════════════════════════════
// ROW COMPONENT
// ═══════════════════════════════════════════════════════
const SyncRowCard: React.FC<{ item: SyncRow; onToggle: () => void }> = React.memo(
  ({ item, onToggle }) => {
    const statusCfg = STATUS_CONFIG[item.status];
    const isMismatch = item.status === 'mismatch';
    return (
      <TouchableOpacity style={styles.rowCard} activeOpacity={0.7} onPress={onToggle}>
        <View style={[styles.checkbox, item.selected && styles.checkboxChecked]}>
          {item.selected && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.rowSku}>{item.sku}</Text>
        </View>
        <View style={styles.qtyCol}>
          <Text style={styles.qtyLabel}>Agency</Text>
          <Text style={styles.qtyValue}>{item.agencyQty}</Text>
        </View>
        <View style={styles.qtyCol}>
          <Text style={styles.qtyLabel}>System</Text>
          <Text style={[styles.qtyValue, isMismatch && { color: colors.danger }]}>
            {item.systemQty}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
          <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
        </View>
      </TouchableOpacity>
    );
  },
);

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════
const AgencyInventorySyncScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<SyncRoute>();
  const dispatch = useAppDispatch();

  const { agencyId } = route.params;
  const agencies = useAppSelector(selectAgencies);
  const rows = useAppSelector(selectSyncRows);
  const isLoading = useAppSelector(selectSyncIsLoading);
  const isSyncing = useAppSelector(selectSyncIsSyncing);
  const searchQuery = useAppSelector(selectSyncSearchQuery);
  const statusFilter = useAppSelector(selectSyncStatusFilter);

  const agency = useMemo(() => agencies.find(a => a.id === agencyId), [agencies, agencyId]);

  // ── Build sync rows from agency data ────────────
  useEffect(() => {
    if (!agency) return;
    dispatch(setIsLoading(true));

    // Simulate building comparison rows
    // In the real app, this would compare with system inventory via API
    const syncRows: SyncRow[] = agency.inventory.map((item, idx) => {
      // Generate a simulated system qty for demo purposes
      const variance = idx % 3 === 0 ? 0 : idx % 3 === 1 ? Math.floor(item.quantityOnHand * 0.85) : 0;
      const systemQty = idx % 4 === 3 ? 0 : (variance || item.quantityOnHand);
      let status: SyncStatus = 'synced';
      if (systemQty === 0) status = 'agency_only';
      else if (systemQty !== item.quantityOnHand) status = 'mismatch';

      return {
        agencyItemId: item.id,
        name: item.name,
        sku: item.sku,
        agencyQty: item.quantityOnHand,
        systemQty,
        status,
        selected: false,
      };
    });

    dispatch(setRows(syncRows));

    return () => { dispatch(resetSync()); };
  }, [agency, dispatch]);

  // ── Filtered rows ───────────────────────────────
  const filteredRows = useMemo(() => {
    let result = rows;
    if (statusFilter !== 'all') {
      result = result.filter(r => r.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q));
    }
    return result;
  }, [rows, statusFilter, searchQuery]);

  const selectedCount = rows.filter(r => r.selected).length;
  const mismatchCount = rows.filter(r => r.status === 'mismatch').length;
  const agencyOnlyCount = rows.filter(r => r.status === 'agency_only').length;
  const syncedCount = rows.filter(r => r.status === 'synced').length;

  // ── Handlers ────────────────────────────────────
  const handleSyncAll = useCallback(() => {
    const unsyncedIds = rows.filter(r => r.status !== 'synced').map(r => r.agencyItemId);
    if (unsyncedIds.length === 0) {
      Alert.alert('All Synced', 'All items are already in sync.');
      return;
    }
    Alert.alert(
      'Sync All Items',
      `Sync ${unsyncedIds.length} items to system inventory?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sync All',
          onPress: async () => {
            dispatch(setIsSyncing(true));
            await dispatch(syncSelectedItems({ agencyId, itemIds: unsyncedIds })).unwrap();
            dispatch(markRowsSynced(unsyncedIds));
            dispatch(setIsSyncing(false));
            Alert.alert('Success', `${unsyncedIds.length} items synced successfully.`);
          },
        },
      ],
    );
  }, [rows, agencyId, dispatch]);

  const handleSyncSelected = useCallback(() => {
    const selectedIds = rows.filter(r => r.selected).map(r => r.agencyItemId);
    if (selectedIds.length === 0) {
      Alert.alert('No Selection', 'Please select items to sync.');
      return;
    }
    Alert.alert(
      'Selective Sync',
      `Sync ${selectedIds.length} selected items?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sync',
          onPress: async () => {
            dispatch(setIsSyncing(true));
            await dispatch(syncSelectedItems({ agencyId, itemIds: selectedIds })).unwrap();
            dispatch(markRowsSynced(selectedIds));
            dispatch(setIsSyncing(false));
            Alert.alert('Success', `${selectedIds.length} items synced.`);
          },
        },
      ],
    );
  }, [rows, agencyId, dispatch]);

  // ── Render item ─────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: SyncRow }) => (
      <SyncRowCard item={item} onToggle={() => dispatch(toggleRowSelection(item.agencyItemId))} />
    ),
    [dispatch],
  );

  if (!agency) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.textSecondary }}>Agency not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}><Feather name="arrow-left" size={17} color={colors.secondary} style={{ marginRight: 2 }} /><Text style={styles.backBtn}>Back</Text></View>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Inventory Sync</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Agency name bar */}
      <View style={styles.agencyBar}>
        <Text style={styles.agencyName}>{agency.name}</Text>
        <Text style={styles.agencyMeta}>{agency.inventory.length} items · {agency.city}</Text>
      </View>

      {/* Summary row */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryBox, { borderColor: colors.success }]}>
          <Text style={[styles.summaryVal, { color: colors.success }]}>{syncedCount}</Text>
          <Text style={styles.summaryLabel}>Synced</Text>
        </View>
        <View style={[styles.summaryBox, { borderColor: colors.warning }]}>
          <Text style={[styles.summaryVal, { color: colors.warning }]}>{mismatchCount}</Text>
          <Text style={styles.summaryLabel}>Mismatch</Text>
        </View>
        <View style={[styles.summaryBox, { borderColor: colors.secondary }]}>
          <Text style={[styles.summaryVal, { color: colors.secondary }]}>{agencyOnlyCount}</Text>
          <Text style={styles.summaryLabel}>Agency Only</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search items…"
          placeholderTextColor={colors.textTertiary}
          value={searchQuery}
          onChangeText={v => dispatch(setSearchQuery(v))}
        />
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {FILTER_CHIPS.map(chip => {
          const active = statusFilter === chip.key;
          return (
            <TouchableOpacity
              key={chip.key}
              style={[styles.chip, active && styles.chipActive]}
              activeOpacity={0.7}
              onPress={() => dispatch(setStatusFilter(chip.key))}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{chip.label}</Text>
            </TouchableOpacity>
          );
        })}
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={() => (selectedCount > 0 ? dispatch(deselectAll()) : dispatch(selectAll()))}>
          <Text style={styles.selectAllText}>
            {selectedCount > 0 ? `Deselect (${selectedCount})` : 'Select All'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.secondary} />
        </View>
      ) : (
        <FlatList
          data={filteredRows}
          keyExtractor={item => item.agencyItemId}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{ padding: spacing.xxl, alignItems: 'center' }}>
              <Text style={[typography.h5, { color: colors.textTertiary }]}>No items match your filter</Text>
            </View>
          }
        />
      )}

      {/* Bottom buttons */}
      <View style={styles.bottomBar}>
        {isSyncing && (
          <View style={styles.syncingOverlay}>
            <ActivityIndicator size="small" color={colors.surface} />
            <Text style={styles.syncingText}>Syncing…</Text>
          </View>
        )}
        <CustomButton
          title="Sync All"
          onPress={handleSyncAll}
          variant="secondary"
          size="lg"
          fullWidth
          disabled={isSyncing}
        />
        <View style={{ width: spacing.xs }} />
        <CustomButton
          title={`Sync Selected (${selectedCount})`}
          onPress={handleSyncSelected}
          variant="primary"
          size="lg"
          fullWidth
          disabled={isSyncing || selectedCount === 0}
        />
      </View>
    </SafeAreaView>
  );
};

// ═══════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { ...typography.labelLg, color: colors.secondary },
  headerTitle: { ...typography.h3, color: colors.textPrimary, flex: 1, textAlign: 'center' },

  agencyBar: {
    backgroundColor: colors.actionGreen + '0A',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  agencyName: { ...typography.labelLg, color: colors.textPrimary },
  agencyMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    borderWidth: 1,
  },
  summaryVal: { ...typography.h3 },
  summaryLabel: { ...typography.overline, color: colors.textSecondary, marginTop: 2 },

  searchWrap: { paddingHorizontal: spacing.xl, paddingTop: spacing.xs },
  searchInput: {
    ...typography.bodySm,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },

  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
    gap: spacing.xxs,
  },
  chip: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  chipText: { ...typography.overline, color: colors.textSecondary },
  chipTextActive: { color: colors.surface },
  selectAllText: { ...typography.labelSm, color: colors.secondary },

  // ── Row card ───────────────────────────────────────
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.xl,
    marginTop: spacing.xxs + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  checkmark: { ...typography.labelMd, color: colors.surface },

  rowName: { ...typography.labelMd, color: colors.textPrimary },
  rowSku: { ...typography.caption, color: colors.textTertiary },

  qtyCol: { alignItems: 'center', width: 48 },
  qtyLabel: { ...typography.overline, color: colors.textTertiary, textTransform: 'uppercase' },
  qtyValue: { ...typography.h5, color: colors.textPrimary },

  statusBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, minWidth: 55, alignItems: 'center' },
  statusText: { ...typography.overline },

  // ── Bottom bar ─────────────────────────────────────
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.sm,
  },
  syncingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    zIndex: 1,
  },
  syncingText: { ...typography.h5, color: colors.surface }
});

export default AgencyInventorySyncScreen;
