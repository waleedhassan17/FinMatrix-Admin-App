// ═══════════════════════════════════════════════════════
// FinMatrix — COA Detail Screen
// ═══════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
  ActivityIndicator
} from 'react-native';
import { Alert } from '../../../utils/alert';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { THEME } from '../../../utils/theme';
import { ReportHeader, HEADER_NAVY } from '../../../components/reports/ReportUI';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { selectAccounts, toggleAccount } from '../COAList/coaListSlice';
import { blockSystemDeactivation, isSystemAccount } from '../../../utils/systemAccounts';
import {
  selectActiveTab,
  setActiveTab,
  resetCoaDetail
} from './coaDetailSlice';
import type { DetailTab } from './coaDetailSlice';
import {
  fetchAccountTransactions,
  type AccountTransaction
} from '../../../models/accountTransactionModel';
import type { AccountType } from '../../../types';
import type { MoreStackParamList } from '../../../navigators/stacks/MoreStack';

// Design-system tokens (see src/theme/theme.ts).
const { colors, radius, shadows, spacing, typography } = THEME;

type DetailRoute = RouteProp<MoreStackParamList, 'COADetail'>;
type Nav = NativeStackNavigationProp<MoreStackParamList>;

// ── Constants ─────────────────────────────────────────
const TYPE_COLORS: Record<AccountType, string> = {
  asset: colors.actionGreen,
  liability: colors.danger,
  equity: colors.secondary,
  revenue: colors.success,
  expense: colors.warning
};

const TYPE_LABELS: Record<AccountType, string> = {
  asset: 'Asset',
  liability: 'Liability',
  equity: 'Equity',
  revenue: 'Revenue',
  expense: 'Expense'
};

const formatBalance = (balance: number): string => {
  const abs = Math.abs(balance);
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return balance < 0 ? `-Rs ${formatted}` : `Rs ${formatted}`;
};

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════
const COADetailScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<DetailRoute>();
  const dispatch = useAppDispatch();

  const accounts = useAppSelector(selectAccounts);
  const account = accounts.find(a => a.id === route.params.accountId);
  const activeTab = useAppSelector(selectActiveTab);

  // Reset tab state on unmount
  useEffect(() => {
    return () => { dispatch(resetCoaDetail()); };
  }, [dispatch]);

  // Real ledger activity for this account (was a hardcoded-empty stub).
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [txnsLoading, setTxnsLoading] = useState(false);
  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    setTxnsLoading(true);
    fetchAccountTransactions(account.id)
      .then(rows => { if (!cancelled) setTransactions(rows); })
      .catch(() => { if (!cancelled) setTransactions([]); })
      .finally(() => { if (!cancelled) setTxnsLoading(false); });
    return () => { cancelled = true; };
  }, [account?.id]);

  const handleEdit = useCallback(() => {
    if (account) {
      navigation.navigate('COAForm', { accountId: account.id });
    }
  }, [account, navigation]);

  const handleToggle = useCallback(() => {
    if (!account) return;
    if (blockSystemDeactivation(account)) return;
    Alert.alert(
      account.isActive ? 'Deactivate Account' : 'Activate Account',
      `Are you sure you want to ${account.isActive ? 'deactivate' : 'activate'} "${account.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: account.isActive ? 'Deactivate' : 'Activate',
          style: account.isActive ? 'destructive' : 'default',
          onPress: () => dispatch(toggleAccount(account.id)),
        },
      ],
    );
  }, [account, dispatch]);

  if (!account) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.notFound}>Account not found</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}><Feather name="arrow-left" size={17} color={colors.actionGreen} style={{ marginRight: 2 }} /><Text style={styles.goBack}>Go Back</Text></View>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const typeColor = TYPE_COLORS[account.type];

  // ── Transaction row ───────────────────────────────
  const renderTxnRow = ({ item, index }: { item: AccountTransaction; index: number }) => (
    <View
      style={[
        styles.txnRow,
        index % 2 === 0 && styles.txnRowAlt,
      ]}
    >
      <View style={styles.txnLeft}>
        <Text style={styles.txnDate}>{item.date}</Text>
        <Text style={styles.txnRef}>{item.reference}</Text>
      </View>
      <Text style={styles.txnMemo} numberOfLines={1}>
        {item.memo}
      </Text>
      <Text style={[styles.txnAmount, item.debit > 0 && styles.txnDebit]}>
        {item.debit > 0 ? formatBalance(item.debit) : '—'}
      </Text>
      <Text style={[styles.txnAmount, item.credit > 0 && styles.txnCredit]}>
        {item.credit > 0 ? formatBalance(item.credit) : '—'}
      </Text>
      <Text style={styles.txnRunning}>{formatBalance(item.runningBalance)}</Text>
    </View>
  );

  // ── Info rows ─────────────────────────────────────
  const infoRows = [
    { label: 'Account Number', value: account.code },
    { label: 'Account Name', value: account.name },
    { label: 'Type', value: TYPE_LABELS[account.type] },
    { label: 'Sub Type', value: account.subType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) },
    { label: 'Normal Balance', value: account.normalBalance === 'debit' ? 'Debit' : 'Credit' },
    { label: 'Description', value: account.description || '—' },
    { label: 'System Account', value: account.isSystemAccount ? 'Yes' : 'No' },
    { label: 'Status', value: account.isActive ? 'Active' : 'Inactive' },
    { label: 'Created', value: new Date(account.createdAt).toLocaleDateString() },
    { label: 'Updated', value: new Date(account.updatedAt).toLocaleDateString() },
  ];

  // ═════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: HEADER_NAVY[0] }]} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={HEADER_NAVY[0]} />
      {/* Header */}
      <ReportHeader title="Account Detail" subtitle="Ledger account" onBack={() => navigation.goBack()} backLabel="Back" />

      <ScrollView
        style={[styles.scroll, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Top Card ── */}
        <View style={[styles.topCard, { borderLeftColor: typeColor }]}>
          <View style={styles.topCardRow}>
            <View style={styles.topCardLeft}>
              <Text style={styles.accountCode}>{account.code}</Text>
              <Text style={styles.accountName}>{account.name}</Text>
            </View>
            <View>
              <View style={[styles.typeBadge, { backgroundColor: typeColor + '1A' }]}>
                <Text style={[styles.typeBadgeText, { color: typeColor }]}>
                  {TYPE_LABELS[account.type]}
                </Text>
              </View>
            </View>
          </View>
          <Text style={styles.subType}>
            {account.subType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </Text>
          <View style={styles.topCardFooter}>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: account.isActive ? colors.success : colors.danger },
                ]}
              />
              <Text style={styles.statusText}>
                {account.isActive ? 'Active' : 'Inactive'}
              </Text>
            </View>
            <Text style={[styles.balanceValue, { color: typeColor }]}>
              {formatBalance(account.balance)}
            </Text>
          </View>
        </View>

        {/* ── Action Buttons ── */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.7}
            onPress={handleEdit}
          >
            <Text style={styles.actionBtnIcon}>✏️</Text>
            <Text style={styles.actionBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              !account.isActive && styles.actionBtnActive,
              account.isActive && isSystemAccount(account) && styles.actionBtnLocked,
            ]}
            activeOpacity={0.7}
            onPress={handleToggle}
          >
            <Text style={styles.actionBtnIcon}>
              {account.isActive ? (isSystemAccount(account) ? '🔒' : '⛔') : '✅'}
            </Text>
            <Text
              style={[
                styles.actionBtnText,
                !account.isActive && styles.actionBtnTextActive,
              ]}
            >
              {account.isActive ? 'Deactivate' : 'Activate'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Tabs ── */}
        <View style={styles.tabBar}>
          {([
            { key: 'transactions' as DetailTab, label: 'Transactions' },
            { key: 'info' as DetailTab, label: 'Info' },
          ]).map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              activeOpacity={0.7}
              onPress={() => dispatch(setActiveTab(tab.key))}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.key && styles.tabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Tab Content ── */}
        {activeTab === 'transactions' ? (
          <View style={styles.txnCard}>
            {/* Column headers */}
            <View style={styles.txnHeaderRow}>
              <Text style={[styles.txnHeaderText, styles.txnLeft]}>Date / Ref</Text>
              <Text style={[styles.txnHeaderText, styles.txnMemo]}>Memo</Text>
              <Text style={[styles.txnHeaderText, styles.txnAmount]}>Debit</Text>
              <Text style={[styles.txnHeaderText, styles.txnAmount]}>Credit</Text>
              <Text style={[styles.txnHeaderText, styles.txnRunning]}>Balance</Text>
            </View>
            {txnsLoading ? (
              <View style={{ paddingVertical: 28, alignItems: 'center' }}>
                <ActivityIndicator color={colors.actionGreen} />
              </View>
            ) : transactions.length === 0 ? (
              <View style={{ paddingVertical: 28, alignItems: 'center' }}>
                <Text style={styles.infoLabel}>No ledger activity on this account yet.</Text>
              </View>
            ) : (
              transactions.map((txn, idx) => renderTxnRow({ item: txn, index: idx }))
            )}
          </View>
        ) : (
          <View style={styles.infoCard}>
            {infoRows.map(row => (
              <View key={row.label} style={styles.infoRow}>
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={styles.infoValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

// ═══════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound: { ...typography.bodyLg, color: colors.textSecondary, marginBottom: spacing.md },
  goBack: { ...typography.labelLg, color: colors.secondary },

  // ── Header ────────────────────────────────────────
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
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  headerSpacer: { width: 60 },

  scroll: { flex: 1 },
  scrollContent: { padding: spacing.xl },

  // ── Top Card ──────────────────────────────────────
  topCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderLeftWidth: 4,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  topCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xxs,
  },
  topCardLeft: { flex: 1, marginRight: spacing.xs },
  accountCode: {
    ...typography.bodySm,
    color: colors.textTertiary,
    marginBottom: 2,
  },
  accountName: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  typeBadge: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: spacing.xxs,
    borderRadius: 12,
  },
  typeBadgeText: {
    ...typography.labelSm,
    
  },
  subType: {
    ...typography.bodySm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  topCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xs,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.xxs },
  statusText: { ...typography.bodySm, color: colors.textSecondary },
  balanceValue: { ...typography.h2 },

  // ── Action Buttons ────────────────────────────────
  actionRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBtnLocked: { opacity: 0.55 },
  actionBtnActive: {
    borderColor: colors.success,
    backgroundColor: colors.success + '08',
  },
  actionBtnIcon: { ...typography.bodyLg, marginRight: spacing.xxs },
  actionBtnText: { ...typography.h5, color: colors.textPrimary },
  actionBtnTextActive: { color: colors.success },

  // ── Tabs ──────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: 3,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    borderRadius: radius.sm - 2,
  },
  tabActive: { backgroundColor: colors.actionGreen },
  tabText: { ...typography.h5, color: colors.textSecondary },
  tabTextActive: { color: colors.surface, fontWeight: typography.labelLg.fontWeight },

  // ── Transactions ──────────────────────────────────
  txnCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  txnHeaderRow: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.actionGreen + '08',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  txnHeaderText: {
    ...typography.overline,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  txnRow: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  txnRowAlt: { backgroundColor: colors.backgroundAlt },
  txnLeft: { width: 72 },
  txnDate: { ...typography.caption, color: colors.textPrimary },
  txnRef: { ...typography.overline, color: colors.textTertiary },
  txnMemo: { ...typography.caption, flex: 1, color: colors.textPrimary, marginHorizontal: spacing.xxs },
  txnAmount: { ...typography.labelSm, width: 62, textAlign: 'right', color: colors.textSecondary },
  txnDebit: { color: colors.success },
  txnCredit: { color: colors.danger },
  txnRunning: { ...typography.labelSm, width: 70, textAlign: 'right', color: colors.textPrimary },

  // ── Info ──────────────────────────────────────────
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  infoLabel: { ...typography.bodySm, color: colors.textSecondary },
  infoValue: { ...typography.labelMd, color: colors.textPrimary, maxWidth: '60%', textAlign: 'right' }
});

export default COADetailScreen;
