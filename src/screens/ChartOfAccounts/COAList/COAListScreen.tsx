// ═══════════════════════════════════════════════════════
// FinMatrix — Chart of Accounts List Screen
// Enterprise-consistent with Reports / Transactions (ReportUI kit)
// ═══════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActionSheetIOS,
  Platform,
  ScrollView
} from 'react-native';
import { Alert } from '../../../utils/alert';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MoreStackParamList } from '../../../navigators/stacks/MoreStack';

import { THEME } from '../../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import {
  fetchAccounts,
  selectAccounts,
  selectIsLoading,
  toggleAccount,
  setSearchQuery,
  setActiveFilter,
  selectSearchQuery,
  selectActiveFilter
} from './coaListSlice';
import type { COAFilter } from './coaListSlice';
import { blockSystemDeactivation, isSystemAccount } from '../../../utils/systemAccounts';
import type { Account, AccountType } from '../../../types';

// Design-system tokens (see src/theme/theme.ts).
const { colors } = THEME;
import {
  ReportContainer,
  ReportHeader,
  KpiGrid,
  EmptyBlock,
  ACCENT,
  HeaderAction
} from '../../../components/reports/ReportUI';

// ── Constants ─────────────────────────────────────────
const TYPE_COLORS: Record<AccountType, string> = {
  asset: ACCENT.brand,
  liability: ACCENT.red,
  equity: ACCENT.violet,
  revenue: ACCENT.green,
  expense: ACCENT.amber
};

const TYPE_LABELS: Record<AccountType, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  revenue: 'Revenue',
  expense: 'Expenses'
};

const FILTER_CHIPS: { key: COAFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'asset', label: 'Assets' },
  { key: 'liability', label: 'Liabilities' },
  { key: 'equity', label: 'Equity' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'expense', label: 'Expenses' },
];

const formatBalance = (balance: number): string => {
  const abs = Math.abs(balance).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return balance < 0 ? `-Rs ${abs}` : `Rs ${abs}`;
};

const fmtCompact = (n: number): string => {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}Rs ${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}Rs ${(abs / 1_000).toFixed(1)}K`;
  return `${sign}Rs ${Math.round(abs)}`;
};

interface Section {
  title: string;
  type: AccountType;
  count: number;
  totalBalance: number;
  data: Account[];
}

// ═══════════════════════════════════════════════════════
const COAListScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const dispatch = useAppDispatch();

  const accounts = useAppSelector(selectAccounts);
  const searchQuery = useAppSelector(selectSearchQuery);
  const activeFilter = useAppSelector(selectActiveFilter);
  const isLoading = useAppSelector(selectIsLoading);

  useEffect(() => {
    dispatch(fetchAccounts());
  }, [dispatch]);

  const onRefresh = useCallback(() => {
    dispatch(fetchAccounts());
  }, [dispatch]);

  const filteredAccounts = useMemo(() => {
    let result = accounts;
    if (activeFilter !== 'all') result = result.filter(a => a.type === activeFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a => a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q));
    }
    return [...result].sort((a, b) => a.code.localeCompare(b.code));
  }, [accounts, searchQuery, activeFilter]);

  const sections: Section[] = useMemo(() => {
    const grouped: Partial<Record<AccountType, Account[]>> = {};
    for (const acct of filteredAccounts) {
      if (!grouped[acct.type]) grouped[acct.type] = [];
      grouped[acct.type]!.push(acct);
    }
    const order: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense'];
    return order
      .filter(t => grouped[t] && grouped[t]!.length > 0)
      .map(t => ({
        title: TYPE_LABELS[t],
        type: t,
        count: grouped[t]!.length,
        totalBalance: grouped[t]!.reduce((sum, a) => sum + a.balance, 0),
        data: grouped[t]!,
      }));
  }, [filteredAccounts]);

  const summary = useMemo(() => {
    const total = accounts.length;
    const active = accounts.filter(a => a.isActive).length;
    return { total, active, inactive: total - active };
  }, [accounts]);

  // ── Long-press action sheet ───────────────────────
  const handleActionChoice = useCallback(
    (idx: number, account: Account) => {
      switch (idx) {
        case 0:
          navigation.navigate('COAForm', { accountId: account.id });
          break;
        case 1:
          if (blockSystemDeactivation(account)) break;
          dispatch(toggleAccount(account.id));
          break;
        case 2:
          navigation.navigate('COADetail', { accountId: account.id });
          break;
      }
    },
    [dispatch, navigation],
  );

  const showAccountActions = useCallback(
    (account: Account) => {
      // A system account keeps the slot (the indices below depend on it) but the
      // label stops promising something the ledger will not allow.
      const canDeactivate = !(account.isActive && isSystemAccount(account));
      const options = [
        'Edit',
        account.isActive ? (canDeactivate ? 'Deactivate' : 'Deactivate (system account)') : 'Activate',
        'View Detail',
        'Cancel',
      ];
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options,
            cancelButtonIndex: 3,
            destructiveButtonIndex: account.isActive && canDeactivate ? 1 : -1,
            title: `${account.code} — ${account.name}`
          },
          idx => handleActionChoice(idx, account),
        );
      } else {
        Alert.alert(`${account.code} — ${account.name}`, undefined, [
          { text: 'Edit', onPress: () => navigation.navigate('COAForm', { accountId: account.id }) },
          {
            text: options[1],
            style: account.isActive && canDeactivate ? 'destructive' : 'default',
            onPress: () => {
              if (blockSystemDeactivation(account)) return;
              dispatch(toggleAccount(account.id));
            }
          },
          { text: 'View Detail', onPress: () => navigation.navigate('COADetail', { accountId: account.id }) },
          { text: 'Cancel', style: 'cancel' },
        ]);
      }
    },
    [dispatch, navigation, handleActionChoice],
  );

  // ── Renderers ─────────────────────────────────────
  const renderSectionHeader = useCallback(
    ({ section }: { section: Section }) => (
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          <View style={[styles.sectionAccent, { backgroundColor: TYPE_COLORS[section.type] }]} />
          <Text style={styles.sectionHeaderTitle}>{section.title}</Text>
          <View style={[styles.countBadge, { backgroundColor: TYPE_COLORS[section.type] + '14' }]}>
            <Text style={[styles.countText, { color: TYPE_COLORS[section.type] }]}>{section.count}</Text>
          </View>
        </View>
        <Text style={styles.sectionTotal}>{formatBalance(section.totalBalance)}</Text>
      </View>
    ),
    [],
  );

  const renderItem = useCallback(
    ({ item, index, section }: { item: Account; index: number; section: Section }) => {
      const typeColor = TYPE_COLORS[item.type];
      const dimmed = !item.isActive;
      const isLast = index === section.data.length - 1;
      return (
        <TouchableOpacity
          style={[styles.accountRow, isLast && styles.accountRowLast]}
          activeOpacity={0.6}
          onPress={() => navigation.navigate('COADetail', { accountId: item.id })}
          onLongPress={() => showAccountActions(item)}
          delayLongPress={350}
        >
          <View style={[styles.accountDot, { backgroundColor: dimmed ? THEME.colors.neutral300 : typeColor }]} />
          <View style={styles.accountLeft}>
            <View style={styles.accountNameRow}>
              <Text style={[styles.accountName, dimmed && styles.dimmedText]} numberOfLines={1}>
                {item.name}
              </Text>
              {!item.isActive && (
                <View style={styles.inactiveBadge}>
                  <Text style={styles.inactiveText}>Inactive</Text>
                </View>
              )}
            </View>
            <Text style={styles.accountCode}>{item.code}</Text>
          </View>
          <View style={styles.accountRight}>
            <Text style={[styles.accountBalance, { color: dimmed ? THEME.colors.textTertiary : typeColor }]}>
              {formatBalance(item.balance)}
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={THEME.colors.textTertiary} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      );
    },
    [navigation, showAccountActions],
  );

  const keyExtractor = useCallback((item: Account) => item.id, []);

  const ListHeader = useMemo(
    () => (
      <View style={styles.listHeader}>
        <KpiGrid
          items={[
            { label: 'Total Accounts', value: String(summary.total), accent: ACCENT.brand, icon: 'list' },
            { label: 'Active', value: String(summary.active), accent: ACCENT.green, icon: 'check-circle' },
          ]}
        />

        {/* Search */}
        <View style={styles.searchWrap}>
          <Feather name="search" size={16} color={THEME.colors.textTertiary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or code…"
            placeholderTextColor={THEME.colors.textTertiary}
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

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {FILTER_CHIPS.map(chip => {
            const selected = activeFilter === chip.key;
            return (
              <TouchableOpacity
                key={chip.key}
                style={[styles.chip, selected && styles.chipSelected]}
                activeOpacity={0.7}
                onPress={() => dispatch(setActiveFilter(chip.key))}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{chip.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    ),
    [summary, searchQuery, activeFilter, dispatch],
  );

  return (
    <ReportContainer>
      <ReportHeader
        title="Chart of Accounts"
        subtitle="General ledger accounts"
        onBack={() => navigation.goBack()}
        backLabel="More"
        right={
          <HeaderAction label="New" onPress={() => navigation.navigate('COAForm')} />
        }
      />

      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <View style={styles.empty}>
            <EmptyBlock
              icon="folder"
              title="No accounts found"
              hint={searchQuery ? `Nothing matches "${searchQuery}".` : 'Tap Add to create your first account.'}
            />
          </View>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} colors={[THEME.colors.primary]} tintColor={THEME.colors.primary} />
        }
      />
    </ReportContainer>
  );
};

const styles = StyleSheet.create({

  listContent: { padding: THEME.spacing.md, paddingTop: THEME.spacing.sm, gap: 2, paddingBottom: THEME.spacing.xxxl },
  listHeader: { gap: THEME.spacing.sm + 2, marginBottom: THEME.spacing.xs },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.colors.border,
    paddingHorizontal: 12,
    height: 44,
    ...THEME.shadows.xs,
  },
  searchInput: { flex: 1, ...THEME.typography.bodyMd, color: THEME.colors.textPrimary, paddingVertical: 0 },

  // Chips
  chipRow: { gap: THEME.spacing.xs, paddingRight: THEME.spacing.md },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: THEME.radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
  },
  chipSelected: { backgroundColor: THEME.colors.primary, borderColor: THEME.colors.primary },
  chipText: { ...THEME.typography.labelMd, color: THEME.colors.textSecondary },
  chipTextSelected: { color: colors.neutral0 },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: THEME.spacing.sm,
    marginTop: THEME.spacing.sm,
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionAccent: { width: 3, height: 14, borderRadius: 2 },
  sectionHeaderTitle: { ...THEME.typography.labelLg, color: THEME.colors.textPrimary, textTransform: 'uppercase', letterSpacing: 0.4 },
  countBadge: { paddingHorizontal: 8, paddingVertical: 1, borderRadius: THEME.radius.full },
  countText: { ...THEME.typography.labelSm, letterSpacing: 0 },
  sectionTotal: { ...THEME.typography.labelMd, color: THEME.colors.textSecondary },

  // Account row
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: THEME.spacing.md,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.colors.borderLight,
  },
  accountRowLast: { borderBottomWidth: 0 },
  accountDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  accountLeft: { flex: 1, marginRight: THEME.spacing.sm },
  accountNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  accountName: { ...THEME.typography.h5, color: THEME.colors.textPrimary, flexShrink: 1 },
  accountCode: { ...THEME.typography.caption, color: THEME.colors.textTertiary, marginTop: 1 },
  dimmedText: { color: THEME.colors.textTertiary },
  inactiveBadge: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: THEME.radius.sm, backgroundColor: THEME.colors.dangerLight },
  inactiveText: { ...THEME.typography.labelSm, color: THEME.colors.danger, letterSpacing: 0 },
  accountRight: { alignItems: 'flex-end' },
  accountBalance: { ...THEME.typography.labelLg },

  empty: { paddingTop: THEME.spacing.xl }
});

export default COAListScreen;
