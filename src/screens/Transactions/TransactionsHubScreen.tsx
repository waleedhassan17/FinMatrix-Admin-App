// ═══════════════════════════════════════════════════════
// FinMatrix — Transactions Hub
// Sales + Purchases entry points (enterprise-consistent UI)
// ═══════════════════════════════════════════════════════

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { THEME } from '../../utils/theme';
import { useAppSelector } from '../../hooks/useReduxHooks';
import { selectFeatures, selectUser } from '../Auth/authSlice';
import { isFeatureVisible } from '../../utils/featureGates';
import type { TransactionsStackParamList } from '../../navigators/stacks/TransactionsStack';
import { ReportContainer, ReportHeader, SectionCard, ACCENT } from '../../components/reports/ReportUI';

type Nav = NativeStackNavigationProp<TransactionsStackParamList>;

interface HubRow {
  key: string;
  icon: keyof typeof Feather.glyphMap;
  accent: string;
  label: string;
  subtitle: string;
  onPress: (nav: Nav) => void;
  /** Three-tier model: row only shows when this feature is on (undefined = always). */
  feature?: string;
}

const SALES_ROWS: HubRow[] = [
  {
    key: 'estimates',
    icon: 'edit-3',
    accent: ACCENT.blue,
    label: 'Estimates',
    subtitle: 'Create quotes; convert to invoice or sales order',
    onPress: nav => nav.navigate('EstimateList'),
  },
  {
    key: 'salesOrders',
    icon: 'clipboard',
    accent: ACCENT.amber,
    label: 'Sales Orders',
    subtitle: 'Track fulfillment and invoice orders',
    onPress: nav => nav.navigate('SalesOrderList'),
    feature: 'salesOrders',
  },
  {
    key: 'invoices',
    icon: 'file-text',
    accent: ACCENT.brand,
    label: 'Invoices',
    subtitle: 'Create, send, and track customer invoices',
    onPress: nav => nav.navigate('InvoiceList'),
  },
  {
    key: 'payments',
    icon: 'dollar-sign',
    accent: ACCENT.green,
    label: 'Receive Payments',
    subtitle: 'Record and allocate customer payments',
    onPress: nav => nav.navigate('ReceivePayment'),
  },
  {
    key: 'creditMemos',
    icon: 'rotate-ccw',
    accent: ACCENT.red,
    label: 'Credit Memos',
    subtitle: 'Issue customer credits; apply or refund',
    onPress: nav => nav.navigate('CreditMemoList'),
  },
];

const PURCHASE_ROWS: HubRow[] = [
  {
    key: 'bills',
    icon: 'file',
    accent: ACCENT.blue,
    label: 'Bills',
    subtitle: 'Manage vendor bills and expenses',
    onPress: nav => nav.navigate('BillList'),
  },
  {
    key: 'payBills',
    icon: 'credit-card',
    accent: ACCENT.violet,
    label: 'Pay Bills',
    subtitle: 'Record payments to vendors',
    onPress: nav => nav.navigate('PayBills'),
  },
  {
    key: 'purchaseOrders',
    icon: 'clipboard',
    accent: ACCENT.amber,
    label: 'Purchase Orders',
    subtitle: 'Create and track vendor purchase orders',
    onPress: nav => nav.navigate('POList'),
    feature: 'purchaseOrders',
  },
  {
    key: 'vendorCredits',
    icon: 'corner-up-left',
    accent: ACCENT.teal,
    label: 'Vendor Credits',
    subtitle: 'Record vendor returns; apply to bills',
    onPress: nav => nav.navigate('VendorCreditList'),
  },
];

const ACCOUNTING_ROWS: HubRow[] = [
  {
    key: 'generalJournal',
    icon: 'book-open',
    accent: ACCENT.violet,
    label: 'General Journal',
    subtitle: 'Record manual double-entry journal entries',
    onPress: nav => nav.navigate('JournalEntryList'),
  },
];

const TransactionsHubScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  // Feature-filtered rows (three-tier model): legacy sessions (no flags)
  // see everything, matching the server's fully-unlocked fallback;
  // warehouse-only rows are hard-gated by company type (featureGates.ts).
  const features = useAppSelector(selectFeatures);
  const companyType = useAppSelector(selectUser)?.companyType;
  const visible = (rows: HubRow[]) =>
    rows.filter(r => isFeatureVisible(r.feature, features, companyType));
  const salesRows = visible(SALES_ROWS);
  const purchaseRows = visible(PURCHASE_ROWS);
  const accountingRows = visible(ACCOUNTING_ROWS);

  const renderRow = (row: HubRow, last: boolean) => (
    <TouchableOpacity
      key={row.key}
      style={[styles.row, !last && styles.rowBordered]}
      activeOpacity={0.6}
      onPress={() => row.onPress(navigation)}
    >
      <View style={[styles.rowIcon, { backgroundColor: `${row.accent}14` }]}>
        <Feather name={row.icon} size={18} color={row.accent} />
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{row.label}</Text>
        <Text style={styles.rowSubtitle}>{row.subtitle}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={THEME.colors.textTertiary} />
    </TouchableOpacity>
  );

  return (
    <ReportContainer>
      <ReportHeader title="Transactions" subtitle="Sales & purchases" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SectionCard title="Sales" icon="trending-up">
          <View style={styles.list}>{salesRows.map((r, i) => renderRow(r, i === salesRows.length - 1))}</View>
        </SectionCard>

        <SectionCard title="Purchases" icon="shopping-cart">
          <View style={styles.list}>{purchaseRows.map((r, i) => renderRow(r, i === purchaseRows.length - 1))}</View>
        </SectionCard>

        <SectionCard title="Accounting" icon="book">
          <View style={styles.list}>{accountingRows.map((r, i) => renderRow(r, i === accountingRows.length - 1))}</View>
        </SectionCard>

        <View style={{ height: THEME.spacing.xl }} />
      </ScrollView>
    </ReportContainer>
  );
};

const styles = StyleSheet.create({
  content: { padding: THEME.spacing.md, gap: THEME.spacing.sm + 2 },
  list: { marginHorizontal: -THEME.spacing.md, marginVertical: -THEME.spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 13,
  },
  rowBordered: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: THEME.colors.borderLight },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: THEME.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: THEME.spacing.sm,
  },
  rowContent: { flex: 1, marginRight: THEME.spacing.sm },
  rowLabel: { ...THEME.typography.h5, color: THEME.colors.textPrimary, marginBottom: 1 },
  rowSubtitle: { ...THEME.typography.caption, color: THEME.colors.textSecondary },
});

export default TransactionsHubScreen;
