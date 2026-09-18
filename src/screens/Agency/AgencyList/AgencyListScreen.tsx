// ═══════════════════════════════════════════════════════
// FinMatrix — Agency List Screen
// ═══════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  StatusBar
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { HEADER_NAVY,
  HeaderAction
} from '../../../components/reports/ReportUI';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { THEME } from '../../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import {
  fetchAgencies,
  selectAgencies,
  selectAgencySearchQuery,
  selectAgencyTypeFilter,
  selectAgencyIsLoading,
  selectAgencyError,
  setSearchQuery,
  setTypeFilter
} from './agencyListSlice';
import EmptyState from '../../../components/shared/EmptyState';
import CustomButton from '../../../Custom-Components/CustomButton';
import { formatCurrency } from '../../../utils/formatters';
import { AGENCY_TYPE_COLORS } from '../../../models/agencyModel';
import type { WarehouseAgency } from '../../../models/agencyModel';
import type { MoreStackParamList } from '../../../navigators/stacks/MoreStack';

// Design-system tokens (see src/theme/theme.ts).
const { colors, radius, shadows, spacing, typography } = THEME;

type Nav = NativeStackNavigationProp<MoreStackParamList>;

const TYPE_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Manufacturing', value: 'Manufacturing' },
  { label: 'Supply', value: 'Supply' },
  { label: 'Distribution', value: 'Distribution' },
];

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════
const AgencyListScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const agencies = useAppSelector(selectAgencies);
  const searchQuery = useAppSelector(selectAgencySearchQuery);
  const typeFilter = useAppSelector(selectAgencyTypeFilter);
  const isLoading = useAppSelector(selectAgencyIsLoading);
  const error = useAppSelector(selectAgencyError);

  useFocusEffect(
    useCallback(() => {
      dispatch(fetchAgencies());
    }, [dispatch]),
  );

  // ── Filtered list ───────────────────────────────
  const filtered = useMemo(() => {
    let list = agencies;
    if (typeFilter !== 'all') {
      list = list.filter(a => a.type === typeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        a =>
          a.name.toLowerCase().includes(q) ||
          a.city.toLowerCase().includes(q) ||
          a.type.toLowerCase().includes(q),
      );
    }
    return list;
  }, [agencies, typeFilter, searchQuery]);

  // ── Summary ─────────────────────────────────────
  const totalAgencies = agencies.length;
  const totalSKUs = agencies.reduce((sum, a) => sum + a.inventory.length, 0);
  const totalValue = agencies.reduce(
    (sum, a) =>
      sum + a.inventory.reduce((s, i) => s + i.sellingPrice * i.quantityOnHand, 0),
    0,
  );

  // ── Agency card value helper ────────────────────
  const getAgencyValue = (a: WarehouseAgency) =>
    a.inventory.reduce((s, i) => s + i.sellingPrice * i.quantityOnHand, 0);

  // ── Render card ─────────────────────────────────
  const renderCard = ({ item: agency }: { item: WarehouseAgency }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('AgencyDetail', { agencyId: agency.id })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardName} numberOfLines={1}>{agency.name}</Text>
        <View style={[styles.typeBadge, { backgroundColor: AGENCY_TYPE_COLORS[agency.type] + '18' }]}>
          <Text style={[styles.typeBadgeText, { color: AGENCY_TYPE_COLORS[agency.type] }]}>
            {agency.type}
          </Text>
        </View>
      </View>

      <View style={styles.cardRow}>
        <View style={styles.cardStat}>
          <Text style={styles.cardStatLabel}>Items</Text>
          <Text style={styles.cardStatValue}>{agency.inventory.length}</Text>
        </View>
        <View style={styles.cardStat}>
          <Text style={styles.cardStatLabel}>Value</Text>
          <Text style={styles.cardStatValue}>{formatCurrency(getAgencyValue(agency), 'Rs ')}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.cardContact} numberOfLines={1}>📞 {agency.contactPhone}</Text>
        <Text style={styles.cardCity}>📍 {agency.city}</Text>
      </View>
    </TouchableOpacity>
  );

  // ═════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════
  return (
    <SafeAreaView style={[styles.container, styles.safeTop]} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={HEADER_NAVY[0]} />
      <View style={styles.body}>
      {/* Header */}
      <LinearGradient colors={HEADER_NAVY} style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Feather name="arrow-left" size={24} color={colors.neutral0} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Warehouse Agencies</Text>
        </View>
        <HeaderAction label="New" onPress={() => navigation.navigate('AgencyForm')} />
      </LinearGradient>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{totalAgencies}</Text>
          <Text style={styles.summaryLabel}>Agencies</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{totalSKUs}</Text>
          <Text style={styles.summaryLabel}>Total SKUs</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryValue, typography.h5]}>{formatCurrency(totalValue, 'Rs ')}</Text>
          <Text style={styles.summaryLabel}>Total Value</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={v => dispatch(setSearchQuery(v))}
          placeholder="Search agencies…"
          placeholderTextColor={colors.textTertiary}
        />
      </View>

      {/* Type Filter Chips */}
      <View style={styles.filterRow}>
        {TYPE_FILTERS.map(f => {
          const isActive = typeFilter === f.value;
          return (
            <TouchableOpacity
              key={f.value}
              style={[styles.chip, isActive && styles.chipActive]}
              activeOpacity={0.7}
              onPress={() => dispatch(setTypeFilter(f.value))}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List */}
      {isLoading && agencies.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.actionGreen} />
        </View>
      ) : error && agencies.length === 0 ? (
        <View style={styles.center}>
          <EmptyState
            title="Failed to Load"
            message={error}
            actionLabel="Retry"
            onAction={() => dispatch(fetchAgencies())}
          />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <EmptyState
            title="No Agencies Found"
            message={searchQuery ? `No results for "${searchQuery}"` : 'No warehouse agencies yet.'}
          />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={a => a.id}
          renderItem={renderCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={() => dispatch(fetchAgencies())} colors={[colors.actionGreen]} />
          }
        />
      )}
      </View>
    </SafeAreaView>
  );
};

// ═══════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  safeTop: { backgroundColor: HEADER_NAVY[0] },
  body: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: spacing.xxs, padding: spacing.xxs / 2 },
  headerTitle: { ...typography.h3, color: colors.neutral0 },

  // ── Summary ───────────────────────────────────────
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs + 4,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    ...shadows.xs,
  },
  summaryValue: { ...typography.h3, color: colors.actionGreen },
  summaryLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  // ── Search ────────────────────────────────────────
  searchRow: { paddingHorizontal: spacing.xl, marginBottom: spacing.xs },
  searchInput: {
    ...typography.bodySm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    color: colors.textPrimary,
  },

  // ── Filter chips ──────────────────────────────────
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xs,
    gap: spacing.xxs + 2,
  },
  chip: {
    paddingHorizontal: spacing.xs + 4,
    paddingVertical: spacing.xxs + 2,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.actionGreen, borderColor: colors.actionGreen },
  chipText: { ...typography.labelSm, color: colors.textSecondary },
  chipTextActive: { color: colors.surface },

  // ── Cards ─────────────────────────────────────────
  listContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.xs,
    ...shadows.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  cardName: { ...typography.h4, color: colors.textPrimary, flex: 1, marginRight: spacing.xs },
  typeBadge: { paddingHorizontal: spacing.xs, paddingVertical: spacing.xxs, borderRadius: 6 },
  typeBadgeText: { ...typography.overline },

  cardRow: { flexDirection: 'row', marginBottom: spacing.xs, gap: spacing.xl },
  cardStat: {},
  cardStatLabel: { ...typography.caption, color: colors.textTertiary },
  cardStatValue: { ...typography.h5, color: colors.textPrimary },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardContact: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  cardCity: { ...typography.labelSm, color: colors.textSecondary },

  // ── Empty / Loading ───────────────────────────────
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { ...typography.displayLg, marginBottom: spacing.xs },
  emptyText: { ...typography.bodyMd, color: colors.textSecondary }
});

export default AgencyListScreen;
