// ═══════════════════════════════════════════════════════
// FinMatrix — Inventory List Screen
// ═══════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Modal
} from 'react-native';

import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { InventoryStackParamList } from '../../../navigators/stacks/InventoryStack';

import { THEME } from '../../../utils/theme';
import { ReportContainer, ReportHeader, HEADER_NAVY, HeaderAction } from '../../../components/reports/ReportUI';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import {
  fetchInventoryItems,
  selectInventoryItems,
  selectInventorySearchQuery,
  selectInventoryActiveFilter,
  selectInventoryCategoryFilter,
  selectInventoryAgencyFilter,
  selectInventoryViewMode,
  selectInventoryIsLoading,
  setSearchQuery,
  setActiveFilter,
  setCategoryFilter,
  setAgencyFilter,
  setViewMode
} from './inventoryListSlice';
import type { StockFilter, ViewMode } from './inventoryListSlice';
import type { InventoryItemData } from '../../../models/inventoryModel';
import { warehouseAgencies } from '../../../models/agencyModel';
import { isFeatureEnabled } from '../../../utils/featureGates';
import EmptyState from '../../../components/shared/EmptyState';
import { formatCurrency } from '../../../utils/formatters';

// Design-system tokens (see src/theme/theme.ts).
const { colors, radius, shadows, spacing, typography } = THEME;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_CARD_WIDTH = (SCREEN_WIDTH - spacing.xl * 2 - spacing.xs) / 2;
type PickerType = 'category' | 'agency' | null;

// ── Constants ─────────────────────────────────────────
type FilterChip = { key: StockFilter; label: string; color: string };
const STOCK_FILTER_CHIPS: FilterChip[] = [
  { key: 'all', label: 'All', color: colors.actionGreen },
  { key: 'in_stock', label: 'In Stock', color: colors.success },
  { key: 'low_stock', label: 'Low Stock', color: colors.warning },
  { key: 'out_of_stock', label: 'Out of Stock', color: colors.danger },
];

const getStockStatus = (item: InventoryItemData): StockFilter => {
  if (item.quantityOnHand <= 0) return 'out_of_stock';
  if (item.quantityOnHand <= item.reorderPoint) return 'low_stock';
  return 'in_stock';
};

const getStockColor = (status: StockFilter): string => {
  switch (status) {
    case 'in_stock': return colors.success;
    case 'low_stock': return colors.warning;
    case 'out_of_stock': return colors.danger;
    default: return colors.textSecondary;
  }
};

const getStockLabel = (status: StockFilter): string => {
  switch (status) {
    case 'in_stock': return 'In Stock';
    case 'low_stock': return 'Low Stock';
    case 'out_of_stock': return 'Out of Stock';
    default: return '';
  }
};

// ── Category options ────────────────────────────────
const buildCategoryOptions = (items: InventoryItemData[] | undefined | null) => {
  const safeItems = Array.isArray(items) ? items : [];
  const cats = [...new Set(safeItems.map(i => i.category))].sort();
  return [{ label: 'All Categories', value: 'all' }, ...cats.map(c => ({ label: c, value: c }))];
};

const buildAgencyOptions = () => {
  return [
    { label: 'All Sources', value: 'all' },
    { label: 'Company Owned', value: 'none' },
    ...warehouseAgencies.map(a => ({ label: a.name, value: a.id })),
  ];
};

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════
const InventoryListScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<InventoryStackParamList>>();
  const dispatch = useAppDispatch();

  const rawItems = useAppSelector(selectInventoryItems);
  const searchQuery = useAppSelector(selectInventorySearchQuery);
  const activeFilter = useAppSelector(selectInventoryActiveFilter);
  const categoryFilter = useAppSelector(selectInventoryCategoryFilter);
  const agencyFilter = useAppSelector(selectInventoryAgencyFilter);
  const agenciesEnabled = isFeatureEnabled('agencies');
  const viewMode = useAppSelector(selectInventoryViewMode);
  const isLoading = useAppSelector(selectInventoryIsLoading);
  const [activePicker, setActivePicker] = React.useState<PickerType>(null);

  const items = useMemo(() => (Array.isArray(rawItems) ? rawItems : []), [rawItems]);

  useEffect(() => {
    dispatch(fetchInventoryItems());
  }, [dispatch]);

  const onRefresh = useCallback(() => {
    dispatch(fetchInventoryItems());
  }, [dispatch]);

  // ── Derived filtered items ────────────────────────
  const filteredItems = useMemo(() => {
    let result = items.filter(i => i.isActive || activeFilter === 'all');

    // Stock filter
    if (activeFilter !== 'all') {
      result = result.filter(i => getStockStatus(i) === activeFilter);
    }

    // Category filter
    if (categoryFilter !== 'all') {
      result = result.filter(i => i.category === categoryFilter);
    }

    // Agency filter. Bypassed entirely when the feature is off, so a value
    // left over in the slice cannot silently hide rows from a user who has no
    // way to see or clear the filter.
    if (agenciesEnabled && agencyFilter !== 'all') {
      if (agencyFilter === 'none') {
        result = result.filter(i => !i.sourceAgencyId);
      } else {
        result = result.filter(i => i.sourceAgencyId === agencyFilter);
      }
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        i =>
          i.name.toLowerCase().includes(q) ||
          i.sku.toLowerCase().includes(q) ||
          // q is already lowercased; the barcode was not, so a barcode with
          // any letter in it only matched when typed in the exact case stored.
          i.barcodeData.toLowerCase().includes(q),
      );
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [items, searchQuery, activeFilter, categoryFilter, agencyFilter]);

  // ── Summary stats ─────────────────────────────────
  const summary = useMemo(() => {
    const activeItems = items.filter(i => i.isActive);
    const totalItems = activeItems.length;
    const totalValue = activeItems.reduce((sum, i) => sum + i.unitCost * i.quantityOnHand, 0);
    const lowStock = activeItems.filter(i => i.quantityOnHand > 0 && i.quantityOnHand <= i.reorderPoint).length;
    const outOfStock = activeItems.filter(i => i.quantityOnHand <= 0).length;
    return { totalItems, totalValue, lowStock, outOfStock };
  }, [items]);

  const categoryOptions = useMemo(() => buildCategoryOptions(items), [items]);
  const agencyOptions = useMemo(() => buildAgencyOptions(), []);

  const selectedCategoryLabel =
    categoryOptions.find(o => o.value === categoryFilter)?.label ?? 'All Categories';
  const selectedAgencyLabel =
    agencyOptions.find(o => o.value === agencyFilter)?.label ?? 'All Sources';

  const pickerTitle = activePicker === 'category' ? 'Select Category' : 'Select Source';
  const pickerOptions = activePicker === 'category' ? categoryOptions : agencyOptions;

  const handlePickerSelection = useCallback(
    (value: string) => {
      if (activePicker === 'category') {
        dispatch(setCategoryFilter(value));
      } else if (activePicker === 'agency') {
        dispatch(setAgencyFilter(value));
      }
      setActivePicker(null);
    },
    [activePicker, dispatch],
  );

  const getAgencyName = useCallback((agencyId?: string) => {
    if (!agenciesEnabled || !agencyId) return null;
    return warehouseAgencies.find(a => a.id === agencyId)?.name ?? null;
  }, [agenciesEnabled]);

  // ── List View Row ─────────────────────────────────
  const renderListItem = useCallback(
    ({ item }: { item: InventoryItemData }) => {
      const status = getStockStatus(item);
      const stockColor = getStockColor(status);
      const agencyName = getAgencyName(item.sourceAgencyId);
      const totalVal = item.unitCost * item.quantityOnHand;

      return (
        <TouchableOpacity
          style={styles.listRow}
          activeOpacity={0.6}
          onPress={() => navigation.navigate('InventoryDetail', { itemId: item.itemId })}
        >
          <View style={styles.listRowLeft}>
            <Text style={styles.listName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.listSku}>{item.sku}</Text>
            <View style={styles.listMeta}>
              <Text style={styles.listCategory}>{item.category}</Text>
              {agencyName && (
                <View style={styles.agencyBadge}>
                  <Text style={styles.agencyBadgeText}>{agencyName}</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.listRowRight}>
            <Text style={[styles.listQty, { color: stockColor }]}>
              {item.quantityOnHand}
            </Text>
            <Text style={styles.listUnitCost}>{formatCurrency(item.unitCost)}</Text>
            <Text style={styles.listTotalVal}>{formatCurrency(totalVal)}</Text>
          </View>
        </TouchableOpacity>
      );
    },
    [navigation, getAgencyName],
  );

  // ── Grid View Card ────────────────────────────────
  const renderGridItem = useCallback(
    ({ item }: { item: InventoryItemData }) => {
      const status = getStockStatus(item);
      const stockColor = getStockColor(status);

      return (
        <TouchableOpacity
          style={styles.gridCard}
          activeOpacity={0.6}
          onPress={() => navigation.navigate('InventoryDetail', { itemId: item.itemId })}
        >
          {/* Placeholder image */}
          <View style={styles.gridImagePlaceholder}>
            <Text style={styles.gridImageText}>📦</Text>
          </View>
          <View style={styles.gridCardBody}>
            <Text style={styles.gridName} numberOfLines={2}>{item.name}</Text>
            <Text style={styles.gridSku}>{item.sku}</Text>
            <View style={styles.gridBottom}>
              <Text style={[styles.gridQty, { color: stockColor }]}>
                Qty: {item.quantityOnHand}
              </Text>
              <View style={[styles.statusDot, { backgroundColor: stockColor }]} />
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [navigation],
  );

  const keyExtractor = useCallback((item: InventoryItemData) => item.itemId, []);

  const ListEmptyComponent = useMemo(
    () => (
      <EmptyState
        title="No Items Found"
        message={
          searchQuery
            ? `No items match "${searchQuery}". Try a different search.`
            : 'No inventory items match the current filters. Tap "+ Add Item" to create one.'
        }
      />
    ),
    [searchQuery],
  );

  // ═════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════
  return (
    <ReportContainer>
      {/* ── Header ── */}
      <ReportHeader
        title="Inventory"
        subtitle="Stock & items"
        right={
          <>
            <View style={styles.viewToggle}>
              <TouchableOpacity
                style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
                onPress={() => dispatch(setViewMode('list'))}
              >
                <Feather name="list" size={16} color={viewMode === 'list' ? colors.neutral0 : 'rgba(255,255,255,0.7)'} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewToggleBtn, viewMode === 'grid' && styles.viewToggleBtnActive]}
                onPress={() => dispatch(setViewMode('grid'))}
              >
                <Feather name="grid" size={15} color={viewMode === 'grid' ? colors.neutral0 : 'rgba(255,255,255,0.7)'} />
              </TouchableOpacity>
            </View>
            <HeaderAction label="New" onPress={() => navigation.navigate('InventoryForm')} />
          </>
        }
      />

      {/* ── Body content ── */}
      <View style={{ flex: 1, backgroundColor: colors.background }}>

      {/* ── Search Bar ── */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Feather name="search" size={16} color={THEME.colors.textTertiary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, SKU, or barcode..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={text => dispatch(setSearchQuery(text))}
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => dispatch(setSearchQuery(''))} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x-circle" size={16} color={THEME.colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Stock Filter Chips ── */}
      <View style={styles.chipRow}>
        {STOCK_FILTER_CHIPS.map(chip => {
          const selected = activeFilter === chip.key;
          return (
            <TouchableOpacity
              key={chip.key}
              style={[
                styles.chip,
                selected && { backgroundColor: chip.color, borderColor: chip.color },
              ]}
              activeOpacity={0.7}
              onPress={() => dispatch(setActiveFilter(chip.key))}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Category & Agency Dropdowns ── */}
      <View style={styles.dropdownRow}>
        <TouchableOpacity
          style={styles.dropdownBtn}
          activeOpacity={0.7}
          onPress={() => setActivePicker('category')}
        >
          <Text style={styles.dropdownBtnText} numberOfLines={1}>
            {selectedCategoryLabel}
          </Text>
          <Text style={styles.dropdownArrow}>▾</Text>
        </TouchableOpacity>

        {agenciesEnabled && (
          <TouchableOpacity
            style={styles.dropdownBtn}
            activeOpacity={0.7}
            onPress={() => setActivePicker('agency')}
          >
            <Text style={styles.dropdownBtnText} numberOfLines={1}>
              {selectedAgencyLabel}
            </Text>
            <Text style={styles.dropdownArrow}>▾</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal
        visible={activePicker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActivePicker(null)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setActivePicker(null)}
        >
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{pickerTitle}</Text>
              <TouchableOpacity onPress={() => setActivePicker(null)}>
                <Text style={styles.pickerClose}>X</Text>
              </TouchableOpacity>
            </View>

            {pickerOptions.map(option => {
              const isSelected =
                (activePicker === 'category' && option.value === categoryFilter) ||
                (activePicker === 'agency' && option.value === agencyFilter);

              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.pickerOption, isSelected && styles.pickerOptionSelected]}
                  activeOpacity={0.7}
                  onPress={() => handlePickerSelection(option.value)}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      isSelected && styles.pickerOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Summary Bar ── */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{summary.totalItems}</Text>
          <Text style={styles.summaryLabel}>Total Items</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{formatCurrency(summary.totalValue)}</Text>
          <Text style={styles.summaryLabel}>Total Value</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: colors.warning }]}>{summary.lowStock}</Text>
          <Text style={styles.summaryLabel}>Low Stock</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: colors.danger }]}>{summary.outOfStock}</Text>
          <Text style={styles.summaryLabel}>Out of Stock</Text>
        </View>
      </View>

      {/* ── List / Grid ── */}
      {viewMode === 'list' ? (
        <FlatList
          key="list"
          data={filteredItems}
          keyExtractor={keyExtractor}
          renderItem={renderListItem}
          ListEmptyComponent={ListEmptyComponent}
          contentContainerStyle={filteredItems.length === 0 ? styles.emptyContainer : styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={onRefresh}
              colors={[colors.actionGreen]}
              tintColor={colors.actionGreen}
            />
          }
        />
      ) : (
        <FlatList
          key="grid"
          data={filteredItems}
          keyExtractor={keyExtractor}
          renderItem={renderGridItem}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          ListEmptyComponent={ListEmptyComponent}
          contentContainerStyle={filteredItems.length === 0 ? styles.emptyContainer : styles.gridContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={onRefresh}
              colors={[colors.actionGreen]}
              tintColor={colors.actionGreen}
            />
          }
        />
      )}
      </View>
    </ReportContainer>
  );
};

// ═══════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // ── Header ────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    ...THEME.typography.h2,
    color: colors.textPrimary,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },

  // ── View Toggle ───────────────────────────────────
  viewToggle: {
    flexDirection: 'row',
    borderRadius: THEME.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  viewToggleBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  viewToggleBtnActive: {
    backgroundColor: THEME.colors.actionGreen,
  },

  // ── Search ────────────────────────────────────────
  searchContainer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs + 4,
    height: 42,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: { ...typography.bodySm, marginRight: spacing.xs },
  searchInput: {
    ...THEME.typography.bodyMd,
    flex: 1,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  clearBtn: {
    ...typography.bodyLg,
    color: colors.textTertiary,
    paddingHorizontal: spacing.xxs,
  },

  // ── Filter Chips ──────────────────────────────────
  chipRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs + 2,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipText: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    ...typography.h5,
    color: colors.surface,
  },

  // ── Dropdown Row ──────────────────────────────────
  dropdownRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xs,
    backgroundColor: colors.surface,
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs + 4,
    paddingVertical: spacing.xxs + 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  dropdownBtnText: {
    ...THEME.typography.caption,
    flex: 1,
    color: colors.textSecondary,
  },
  dropdownArrow: {
    ...typography.overline,
    color: colors.textTertiary,
    marginLeft: spacing.xxs,
  },

  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  pickerModal: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    maxHeight: '70%',
    ...shadows.sm,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerTitle: {
    ...THEME.typography.h5,
    
    color: colors.textPrimary,
  },
  pickerClose: {
    ...typography.h5,
    color: colors.textSecondary,
  },
  pickerOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pickerOptionSelected: {
    backgroundColor: colors.actionGreen + '12',
  },
  pickerOptionText: {
    ...THEME.typography.bodyMd,
    color: colors.textPrimary,
  },
  pickerOptionTextSelected: {
    ...typography.h5,
    color: colors.actionGreen,
  },

  // ── Summary Bar ───────────────────────────────────
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.xl,
    marginTop: spacing.xs,
    marginBottom: spacing.xxs,
    borderRadius: radius.lg,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.xs,
    ...shadows.sm,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    ...THEME.typography.h5,
    
    color: colors.textPrimary,
  },
  summaryLabel: {
    ...typography.overline,
    color: colors.textTertiary,
    marginTop: 1,
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },

  // ── List View ─────────────────────────────────────
  listContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xxs, paddingBottom: spacing.xxl },
  emptyContainer: { flexGrow: 1 },

  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 4,
    borderRadius: radius.sm,
    marginTop: spacing.xs,
    ...shadows.xs,
  },
  listRowLeft: { flex: 1, marginRight: spacing.xs },
  listName: {
    ...THEME.typography.h4,
    
    color: colors.textPrimary,
  },
  listSku: {
    ...THEME.typography.caption,
    marginTop: 1,
  },
  listMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xxs,
    gap: spacing.xxs,
  },
  listCategory: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  agencyBadge: {
    backgroundColor: colors.secondary + '15',
    paddingHorizontal: spacing.xxs + 4,
    paddingVertical: 1,
    borderRadius: 8,
  },
  agencyBadgeText: {
    ...typography.overline,
    color: colors.secondary,
  },
  listRowRight: { alignItems: 'flex-end' },
  listQty: {
    ...THEME.typography.h2,
    
  },
  listUnitCost: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 1,
  },
  listTotalVal: {
    ...THEME.typography.labelMd,
    color: colors.textSecondary,
  },

  // ── Grid View ─────────────────────────────────────
  gridContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xxs, paddingBottom: spacing.xxl },
  gridRow: {
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  gridCard: {
    width: GRID_CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.xs,
  },
  gridImagePlaceholder: {
    width: '100%',
    height: 90,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridImageText: {
    ...typography.displayMd,
    
  },
  gridCardBody: {
    padding: spacing.xs,
  },
  gridName: {
    ...THEME.typography.labelMd,
    
    color: colors.textPrimary,
    marginBottom: 2,
  },
  gridSku: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: spacing.xxs,
  },
  gridBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gridQty: {
    ...typography.labelMd,
    
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  }
});

export default InventoryListScreen;
