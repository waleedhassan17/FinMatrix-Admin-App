import dayjs from 'dayjs';
import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { THEME } from '../../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import {
  fetchGeneralLedger, selectGeneralLedgerState, setLedgerAccount, setLedgerRange, refreshLedgerRange
} from './generalLedgerSlice';
import { formatCurrency } from '../../../utils/formatters';
import type { LedgerEntry } from '../../../models/generalLedgerModel';
import { displayOrder, visibleLedgerRows } from './ledgerRows';
import type { ReportsStackParamList } from '../../../navigators/stacks/ReportsStack';

// Design-system tokens (see src/theme/theme.ts).
const { typography } = THEME;
import {
  ReportContainer, ReportHeader, Card, SectionCard, KpiGrid, DateField, Badge,
  LoadingBlock, ErrorBlock, EmptyBlock, ACCENT, reportContentStyle, amountColWidth,
  ReportTitleBlock, useStatementCompany, rangeLabel
} from '../../../components/reports/ReportUI';

type ReportsNav = NativeStackNavigationProp<ReportsStackParamList>;
const rs = (n: number) => formatCurrency(n, 'Rs ');

// The posting date is the accounting date; the time comes from when the entry
// was recorded, which is what an audit trail needs.
const fmtLedgerDate = (d: string): string => (d ? dayjs(d).format('MMM D, YYYY') : '—');
const fmtLedgerTime = (ts: string): string => (ts ? dayjs(ts).format('HH:mm:ss') : '');

/**
 * Group entries by account WITHOUT reordering them: accounts appear in the
 * order they first occur in the response, and each account's entries keep the
 * order the API returned. Nothing is sorted, summed into a balance, or
 * otherwise recomputed here.
 */
const groupByAccount = (entries: LedgerEntry[]) => {
  const order: string[] = [];
  const byCode = new Map<string, { code: string; name: string; rows: LedgerEntry[] }>();
  for (const e of entries) {
    const code = e.accountCode ?? '';
    let group = byCode.get(code);
    if (!group) {
      group = { code, name: e.accountName ?? '', rows: [] };
      byCode.set(code, group);
      order.push(code);
    }
    group.rows.push(e);
  }
  return order.map(code => byCode.get(code)!);
};

const GeneralLedgerScreen: React.FC = () => {
  const navigation = useNavigation<ReportsNav>();
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectGeneralLedgerState);
  const company = useStatementCompany();

  // Bring the window up to today every time the screen is opened.
  //
  // The default is seeded in the slice's initialState, which is evaluated once
  // at bundle startup — so on a device left running for days it silently keeps
  // asking for a window that ended when the app launched, and the report looks
  // like the books stopped. The reducer leaves a range the user chose alone.
  //
  // And re-fetch on every focus: postings made elsewhere (a payment, a bill)
  // while this screen sat in the stack otherwise never appeared — "the ledger
  // is not updating".
  const range = state.range;
  const account = state.account;
  const reload = useCallback(
    () => dispatch(fetchGeneralLedger({ range, account })),
    [dispatch, range, account],
  );
  const isFirstFocus = React.useRef(true);
  useFocusEffect(
    useCallback(() => {
      dispatch(refreshLedgerRange());
      // The effect below loads on mount; later focuses reload here.
      if (isFirstFocus.current) { isFirstFocus.current = false; return; }
      void reload();
    }, [dispatch, reload]),
  );

  useEffect(() => {
    dispatch(fetchGeneralLedger({ range: state.range, account: state.account }));
  }, [dispatch, state.range.startDate, state.range.endDate, state.account]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  // Newest first by default: the latest postings are what people check.
  const [newestFirst, setNewestFirst] = useState(true);

  const { ledger, accounts } = state;

  // The most recent lines, never the oldest — see ledgerRows.ts for why that
  // distinction cost a week of apparently missing accounts.
  const { rows, hiddenCount } = useMemo(
    () => visibleLedgerRows(ledger ? ledger.entries : []),
    [ledger],
  );
  const groups = useMemo(() => groupByAccount(rows), [rows]);
  const openingByCode = useMemo(
    () => new Map((ledger?.openingBalances ?? []).map(b => [b.accountCode, b.balance])),
    [ledger],
  );
  const closingByCode = useMemo(
    () => new Map((ledger?.closingBalances ?? []).map(b => [b.accountCode, b.balance])),
    [ledger],
  );

  // Ledger rule: amounts are shown COMPLETE at full size. The Debit/Credit
  // columns are sized to the longest amount in the data; on narrow screens
  // the table pans horizontally instead of shrinking the figures.
  const valW = useMemo(() => {
    if (!ledger) return 96;
    const formatted = rows
      .flatMap(e => [e.debit ? rs(e.debit) : '', e.credit ? rs(e.credit) : '', rs(e.balance)])
      .concat([rs(ledger.totals.debit), rs(ledger.totals.credit)]);
    return amountColWidth(formatted);
  }, [ledger, rows]);

  return (
    <ReportContainer>
      <ReportHeader title="General Ledger" subtitle="Chronological account activity" onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={reportContentStyle}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[THEME.colors.primary]} />}
      >
        <Card>
          <View style={styles.filterRow}>
            <DateField label="From" value={state.range.startDate}
              onChangeText={t => dispatch(setLedgerRange({ ...state.range, startDate: t }))} />
            <DateField label="To" value={state.range.endDate}
              onChangeText={t => dispatch(setLedgerRange({ ...state.range, endDate: t }))} />
          </View>
        </Card>

        {state.isLoading && <LoadingBlock label="Loading ledger…" />}
        {!!state.error && (
          <ErrorBlock message={state.error}
            onRetry={() => dispatch(fetchGeneralLedger({ range: state.range, account: state.account }))} />
        )}

        {!state.isLoading && ledger && (
          <>
            <ReportTitleBlock
              company={company}
              report="General Ledger"
              periodLabel={rangeLabel(state.range.startDate, state.range.endDate)}
            />

            <KpiGrid items={[
              { label: 'Total Debits', value: rs(ledger.totals.debit), accent: ACCENT.blue, icon: 'arrow-down-circle' },
              { label: 'Total Credits', value: rs(ledger.totals.credit), accent: ACCENT.violet, icon: 'arrow-up-circle' },
            ]} />

            {/* Account filter chips */}
            {accounts && accounts.accounts.length > 0 && (
              <SectionCard title="Accounts" subtitle="Tap to filter the ledger" icon="folder">
                <View style={styles.chipsRow}>
                  <Chip label="All" active={!state.account} onPress={() => dispatch(setLedgerAccount(null))} />
                  {accounts.accounts.map(a => (
                    <Chip key={a.accountCode} label={`${a.accountCode} ${a.accountName.split(' ')[0]}`}
                      active={state.account === a.accountCode}
                      onPress={() => dispatch(setLedgerAccount(a.accountCode))} />
                  ))}
                </View>
                {accounts.accounts.map(a => (
                  <View key={a.accountCode} style={styles.acctRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.acctName}>{a.accountName}</Text>
                      <Text style={styles.acctCode}>{a.accountCode} · {a.entries} entries</Text>
                    </View>
                    <Text style={styles.acctBal}>{rs(a.balance)}</Text>
                  </View>
                ))}
              </SectionCard>
            )}

            <SectionCard
              title="Ledger Entries"
              subtitle={state.account ? `Account ${state.account}` : 'All accounts'}
              icon="list"
            >
              {rows.length === 0 && <EmptyBlock title="No ledger activity for this period." />}

              {rows.length > 0 && (
                <View style={styles.chipsRow}>
                  <Chip label="Newest first" active={newestFirst} onPress={() => setNewestFirst(true)} />
                  <Chip label="Oldest first" active={!newestFirst} onPress={() => setNewestFirst(false)} />
                </View>
              )}

              {/* Truncation has to announce itself. The old cap cut the newest
                  rows away in silence, which is indistinguishable from the
                  ledger having stopped. */}
              {hiddenCount > 0 && (
                <View style={styles.truncationNotice}>
                  <Text style={styles.truncationText}>
                    Showing the most recent {rows.length.toLocaleString()} of{' '}
                    {ledger.entries.length.toLocaleString()} lines. Narrow the date range above to
                    see the {hiddenCount.toLocaleString()} earlier{' '}
                    {hiddenCount === 1 ? 'line' : 'lines'}.
                  </Text>
                </View>
              )}

              {rows.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableScroll}>
                  <View style={styles.table}>
                    <View style={styles.headRow}>
                      <Text style={[styles.colDate, styles.headText]}>Date</Text>
                      <Text style={[styles.colAcct, styles.headText]}>Ref / Memo</Text>
                      <Text style={[{ width: valW }, styles.colVal, styles.headText]}>Debit</Text>
                      <Text style={[{ width: valW }, styles.colVal, styles.headText]}>Credit</Text>
                      <Text style={[{ width: valW }, styles.colVal, styles.headText]}>Balance</Text>
                    </View>

                    {groups.map(group => {
                      // Display sums of exactly the rows above them.
                      const debit = group.rows.reduce((t, e) => t + (e.debit || 0), 0);
                      const credit = group.rows.reduce((t, e) => t + (e.credit || 0), 0);
                      // The API's own closing balance (or its balance on the
                      // account's last chronological entry) — never a running
                      // balance recomputed on the client.
                      const closing = closingByCode.get(group.code) ?? group.rows[group.rows.length - 1]?.balance ?? 0;
                      const opening = openingByCode.get(group.code);
                      const openingRow = opening !== undefined && hiddenCount === 0 ? (
                        <View style={styles.bodyRow}>
                          <Text style={[styles.colDate, styles.refText]} />
                          <Text style={[styles.colAcct, styles.refText]}>Opening balance</Text>
                          <Text style={[{ width: valW }, styles.colVal, styles.refText]} />
                          <Text style={[{ width: valW }, styles.colVal, styles.refText]} />
                          <Text style={[{ width: valW }, styles.colVal, styles.bodyText]}>{rs(opening)}</Text>
                        </View>
                      ) : null;
                      const heading = `${group.code} — ${group.name}`;
                      return (
                        <View key={group.code}>
                          <View style={styles.groupHead}>
                            <Text style={styles.groupHeadText} numberOfLines={1}>{heading}</Text>
                          </View>

                          {!newestFirst && openingRow}
                          {displayOrder(group.rows, newestFirst).map((e, i) => (
                            <View key={`${e.sourceId}-${e.accountCode}-${i}`} style={styles.bodyRow}>
                              <View style={styles.colDate}>
                                <Text style={styles.bodyText}>{fmtLedgerDate(e.date)}</Text>
                                <Text style={styles.refText}>{fmtLedgerTime(e.postedAt)}</Text>
                              </View>
                              <View style={styles.colAcct}>
                                <Text style={styles.bodyText} numberOfLines={1}>
                                  {e.reference}{e.voided ? '  · Voided' : ''}
                                </Text>
                                {!!e.memo && <Text style={styles.refText} numberOfLines={1}>{e.memo}</Text>}
                              </View>
                              <Text style={[{ width: valW }, styles.colVal, styles.bodyText]}>{e.debit ? rs(e.debit) : '—'}</Text>
                              <Text style={[{ width: valW }, styles.colVal, styles.bodyText]}>{e.credit ? rs(e.credit) : '—'}</Text>
                              <Text style={[{ width: valW }, styles.colVal, styles.bodyText]}>{rs(e.balance)}</Text>
                            </View>
                          ))}
                          {newestFirst && openingRow}

                          <View style={styles.groupTotalRow}>
                            <Text style={[styles.colDate, styles.groupTotalText]} />
                            <Text style={[styles.colAcct, styles.groupTotalText]} numberOfLines={1}>
                              Total for {heading}
                            </Text>
                            <Text style={[{ width: valW }, styles.colVal, styles.groupTotalText]}>{rs(debit)}</Text>
                            <Text style={[{ width: valW }, styles.colVal, styles.groupTotalText]}>{rs(credit)}</Text>
                            <Text style={[{ width: valW }, styles.colVal, styles.groupTotalText]}>{rs(closing)}</Text>
                          </View>
                        </View>
                      );
                    })}

                    {/* These come from the server and cover the WHOLE period,
                        so when rows are capped they deliberately do not foot to
                        what is above them. Say which it is rather than letting
                        the mismatch look like an arithmetic error. */}
                    <View style={styles.totalRow}>
                      <Text style={[styles.colDate, styles.totalText]}>Total</Text>
                      <Text style={[styles.colAcct, styles.totalText]} numberOfLines={1}>
                        {hiddenCount > 0 ? 'for the whole period, including lines not shown' : ''}
                      </Text>
                      <Text style={[{ width: valW }, styles.colVal, styles.totalText]}>{rs(ledger.totals.debit)}</Text>
                      <Text style={[{ width: valW }, styles.colVal, styles.totalText]}>{rs(ledger.totals.credit)}</Text>
                      <Text style={[{ width: valW }, styles.colVal, styles.totalText]} />
                    </View>
                  </View>
                </ScrollView>
              )}
            </SectionCard>
          </>
        )}
      </ScrollView>
    </ReportContainer>
  );
};

const Chip: React.FC<{ label: string; active: boolean; onPress: () => void }> = ({ label, active, onPress }) => (
  <TouchableOpacity onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', gap: THEME.spacing.sm },
  truncationNotice: {
    backgroundColor: THEME.colors.warning + '14',
    borderWidth: 1,
    borderColor: THEME.colors.warning + '33',
    borderRadius: THEME.radius.md,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  truncationText: { ...THEME.typography.labelSm, color: THEME.colors.textSecondary },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chip: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 16, backgroundColor: THEME.colors.neutral100, borderWidth: 1, borderColor: THEME.colors.border },
  chipActive: { backgroundColor: THEME.colors.primary + '18', borderColor: THEME.colors.primary },
  chipText: { ...THEME.typography.labelSm, color: THEME.colors.textSecondary },
  chipTextActive: { color: THEME.colors.primary, fontWeight: typography.labelLg.fontWeight },
  acctRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: THEME.colors.borderLight },
  acctName: { ...THEME.typography.bodySm, color: THEME.colors.textPrimary, fontWeight: typography.labelLg.fontWeight },
  acctCode: { ...THEME.typography.labelSm, color: THEME.colors.textSecondary },
  acctBal: { ...THEME.typography.labelMd, color: THEME.colors.textPrimary, flexShrink: 0, marginLeft: 10 },
  headRow: { gap: 10, flexDirection: 'row', paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: THEME.colors.border },
  headText: { ...THEME.typography.labelSm, color: THEME.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  bodyRow: { gap: 10, flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: THEME.colors.borderLight },
  bodyText: { ...THEME.typography.bodySm, color: THEME.colors.textPrimary },
  refText: { ...THEME.typography.labelSm, color: THEME.colors.textSecondary },
  colDate: { width: 96, flexShrink: 0 },
  tableScroll: { minWidth: '100%' },
  table: { flex: 1, minWidth: '100%' },
  colAcct: { flex: 1, minWidth: 190 },
  colVal: { textAlign: 'right', flexShrink: 0 },
  groupHead: { paddingTop: 14, paddingBottom: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: THEME.colors.border },
  groupHeadText: { ...THEME.typography.bodySm, color: THEME.colors.textPrimary, fontWeight: typography.labelLg.fontWeight },
  groupTotalRow: { gap: 10, flexDirection: 'row', paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: THEME.colors.border },
  groupTotalText: { ...THEME.typography.labelSm, color: THEME.colors.textSecondary, fontWeight: typography.labelLg.fontWeight },
  totalRow: { gap: 10, flexDirection: 'row', paddingVertical: 10, marginTop: 2, borderTopWidth: 2, borderTopColor: THEME.colors.border },
  totalText: { ...THEME.typography.bodySm, color: THEME.colors.textPrimary, fontWeight: typography.labelLg.fontWeight }
});

export default GeneralLedgerScreen;
