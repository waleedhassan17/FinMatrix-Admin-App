import React, { useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { THEME } from '../../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import {
  fetchBalanceSheetReport,
  selectBalanceSheetState,
  setBalanceSheetAsOfDate, refreshBalanceSheetAsOfDate
} from './balanceSheetSlice';
import { formatCurrency } from '../../../utils/formatters';
import type { ReportsStackParamList } from '../../../navigators/stacks/ReportsStack';
import {
  ReportContainer,
  ReportHeader,
  Card,
  SectionCard,
  KpiGrid,
  DateField,
  Badge,
  LoadingBlock,
  ErrorBlock,
  ACCENT,
  reportContentStyle,
  ReportTitleBlock,
  StatementRow,
  useStatementCompany,
  asOfLabel,
  classifyAccount,
  reconcile,
  type AccountGroup
} from '../../../components/reports/ReportUI';

type ReportsNav = NativeStackNavigationProp<ReportsStackParamList>;

const rs = (n: number) => formatCurrency(n, 'Rs ');

type AcctItem = { accountId: string; accountCode: string; accountName: string; amount: number };

/**
 * Assets, liabilities and equity, in the order a balance sheet presents them.
 * Only the buckets that actually hold an account are rendered.
 */
const ASSET_GROUPS: Array<{ key: AccountGroup; label: string }> = [
  { key: 'bank', label: 'Bank Accounts' },
  { key: 'ar', label: 'Accounts Receivable' },
  { key: 'otherCurrentAsset', label: 'Other Current Assets' },
];
const LIABILITY_GROUPS: Array<{ key: AccountGroup; label: string }> = [
  { key: 'currentLiability', label: 'Current Liabilities' },
  { key: 'longTermLiability', label: 'Long-Term Liabilities' },
];

const sum = (items: AcctItem[]): number => items.reduce((t, i) => t + (i.amount || 0), 0);

/**
 * Split a server-supplied account list into the named statement buckets, in
 * the order given, with every account the named buckets do not claim collected
 * into `leftover`. Nothing can be dropped: a hand-coded account still shows up,
 * under "Other", rather than vanishing from a total.
 */
const bucket = (
  items: AcctItem[] | undefined,
  keys: AccountGroup[],
): { named: Map<AccountGroup, AcctItem[]>; leftover: AcctItem[] } => {
  const named = new Map<AccountGroup, AcctItem[]>();
  const leftover: AcctItem[] = [];
  for (const item of Array.isArray(items) ? items : []) {
    const group = classifyAccount(item.accountCode ?? '');
    if (keys.includes(group)) {
      const list = named.get(group);
      if (list) list.push(item);
      else named.set(group, [item]);
    } else {
      leftover.push(item);
    }
  }
  const byCode = (a: AcctItem, b: AcctItem) => (a.accountCode ?? '').localeCompare(b.accountCode ?? '');
  for (const list of named.values()) list.sort(byCode);
  leftover.sort(byCode);
  return { named, leftover };
};

const BalanceSheetScreen: React.FC = () => {
  const navigation = useNavigation<ReportsNav>();
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectBalanceSheetState);
  const company = useStatementCompany();

  // Bring the window up to today every time the screen is opened.
  //
  // The default is seeded in the slice's initialState, which is evaluated once
  // at bundle startup — so on a device left running for days it silently keeps
  // asking for a window that ended when the app launched, and the report looks
  // like the books stopped. The reducer leaves a range the user chose alone.
  useFocusEffect(
    useCallback(() => {
      dispatch(refreshBalanceSheetAsOfDate());
    }, [dispatch]),
  );

  useEffect(() => {
    dispatch(fetchBalanceSheetReport(state.asOfDate));
  }, [dispatch, state.asOfDate]);

  const report = state.report;

  const assets = useMemo(
    () => bucket(report?.assets, [...ASSET_GROUPS.map(g => g.key), 'fixedAsset']),
    [report],
  );
  const liabilities = useMemo(
    () => bucket(report?.liabilities, LIABILITY_GROUPS.map(g => g.key)),
    [report],
  );

  // Every figure below comes from the API response. Subtotals are display sums
  // of the very lines shown; the two grand totals are the server's own
  // `totalAssets` / `totalLiabilities + totalEquity`, and `reconcile` only warns
  // a developer if the lines and the server disagree — it never alters a number.
  const currentAssetGroups = ASSET_GROUPS.filter(g => (assets.named.get(g.key)?.length ?? 0) > 0);
  const currentAssets = currentAssetGroups.reduce((t, g) => t + sum(assets.named.get(g.key) ?? []), 0);
  const fixedAssets = sum(assets.named.get('fixedAsset') ?? []);
  const otherAssets = sum(assets.leftover);
  const equityItems = Array.isArray(report?.equity) ? report.equity : [];

  return (
    <ReportContainer>
      <ReportHeader title="Balance Sheet" subtitle="Financial position" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={reportContentStyle} showsVerticalScrollIndicator={false}>
        <Card>
          <DateField
            label="As of date"
            value={state.asOfDate}
            onChangeText={text => dispatch(setBalanceSheetAsOfDate(text))}
          />
        </Card>

        {state.isLoading && <LoadingBlock label="Building balance sheet…" />}
        {!!state.error && (
          <ErrorBlock message={state.error} onRetry={() => dispatch(fetchBalanceSheetReport(state.asOfDate))} />
        )}

        {report && !state.isLoading && (
          <>
            <KpiGrid
              items={[
                { label: 'Total Assets', value: rs(report.totalAssets), accent: ACCENT.brand, icon: 'trending-up' },
                { label: 'Total Liabilities', value: rs(report.totalLiabilities), accent: ACCENT.amber, icon: 'credit-card' },
                { label: 'Total Equity', value: rs(report.totalEquity), accent: ACCENT.blue, icon: 'pie-chart' },
              ]}
            />

            <ReportTitleBlock
              company={company}
              report="Balance Sheet"
              periodLabel={asOfLabel(state.asOfDate)}
            />

            <SectionCard title="Assets" icon="trending-up">
              {currentAssetGroups.map(g => (
                <AccountGroupBlock key={g.key} label={g.label} items={assets.named.get(g.key)} />
              ))}
              {currentAssetGroups.length > 0 && (
                <StatementRow label="Total Current Assets" amount={currentAssets} bold isTotal />
              )}

              <AccountGroupBlock label="Fixed Assets" items={assets.named.get('fixedAsset')} total={fixedAssets} />
              <AccountGroupBlock label="Other Assets" items={assets.leftover} total={otherAssets} />

              <StatementRow
                label="TOTAL ASSETS"
                amount={reconcile(currentAssets + fixedAssets + otherAssets, report.totalAssets, 'Balance Sheet — assets')}
                isGrand
              />
            </SectionCard>

            <SectionCard title="Liabilities and Equity" icon="credit-card">
              {LIABILITY_GROUPS.map(g => (
                <AccountGroupBlock key={g.key} label={g.label} items={liabilities.named.get(g.key)} />
              ))}
              <AccountGroupBlock label="Other Liabilities" items={liabilities.leftover} />
              <StatementRow
                label="Total Liabilities"
                amount={reconcile(
                  LIABILITY_GROUPS.reduce((t, g) => t + sum(liabilities.named.get(g.key) ?? []), 0) +
                    sum(liabilities.leftover),
                  report.totalLiabilities,
                  'Balance Sheet — liabilities',
                )}
                bold
                isTotal
              />

              {/* Equity labels come from the server and are shown verbatim. */}
              <StatementRow label="Equity" bold />
              {equityItems.length === 0 ? (
                <Text style={styles.empty}>No accounts</Text>
              ) : (
                equityItems.map((item, idx) => (
                  <StatementRow
                    key={`${item.accountId ?? ''}-${item.accountCode ?? ''}-${idx}`}
                    label={`${item.accountCode}  ${item.accountName}`}
                    amount={item.amount}
                    depth={1}
                  />
                ))
              )}
              <StatementRow
                label="Total Equity"
                amount={reconcile(sum(equityItems), report.totalEquity, 'Balance Sheet — equity')}
                bold
                isTotal
              />

              <StatementRow
                label="TOTAL LIABILITIES AND EQUITY"
                amount={report.totalLiabilities + report.totalEquity}
                isGrand
              />

              <View style={styles.balanceBadge}>
                <Badge
                  label={report.isBalanced ? 'Balanced' : 'Out of balance'}
                  color={report.isBalanced ? THEME.colors.success : THEME.colors.danger}
                />
              </View>
            </SectionCard>
          </>
        )}
      </ScrollView>
    </ReportContainer>
  );
};

/**
 * One named group of accounts and its subtotal. Renders nothing at all when the
 * group is empty, which is how a balance sheet with no fixed assets should read.
 */
const AccountGroupBlock: React.FC<{ label: string; items?: AcctItem[]; total?: number }> = ({
  label,
  items,
  total
}) => {
  if (!items || items.length === 0) return null;
  return (
    <>
      <StatementRow label={label} bold />
      {items.map((item, idx) => (
        <StatementRow
          key={`${item.accountId ?? ''}-${item.accountCode ?? ''}-${idx}`}
          label={`${item.accountCode}  ${item.accountName}`}
          amount={item.amount}
          depth={1}
        />
      ))}
      <StatementRow label={`Total ${label}`} amount={total ?? sum(items)} depth={1} isTotal />
    </>
  );
};

const styles = StyleSheet.create({
  empty: { ...THEME.typography.bodySm, color: THEME.colors.textTertiary, textAlign: 'center', paddingVertical: 8 },
  balanceBadge: { marginTop: 10 }
});

export default BalanceSheetScreen;
