import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { THEME } from '../../utils/theme';
import { formatCurrency } from '../../utils/formatters';
import {
  getUnreconciledAPI,
  createReconciliationAPI,
  markClearedAPI
} from '../../networks/accounting/reconciliationNetwork';
import { unreconciledSerializer } from '../../serializers/reconciliationSerializer';
import type { UnreconciledEntry } from '../../models/reconciliationModel';
import CustomInput from '../../Custom-Components/CustomInput';
import CustomButton from '../../Custom-Components/CustomButton';
import { ReportContainer, ReportHeader, Card, SectionCard, DateField, KpiGrid, LoadingBlock, EmptyBlock, ACCENT } from '../../components/reports/ReportUI';
import type { MoreStackParamList } from '../../navigators/stacks/MoreStack';
import { toIsoDate } from '../../models/reportModel';

// Design-system tokens (see src/theme/theme.ts).
const { typography } = THEME;

type Nav = NativeStackNavigationProp<MoreStackParamList>;
type Rt = RouteProp<MoreStackParamList, 'BankReconciliation'>;

const rs = (n: number) => formatCurrency(n, 'Rs ');
const today = () => toIsoDate(new Date());
// Money tolerance mirrors the backend (0.0001) with a little slack for display rounding.
const isBalanced = (n: number) => Math.abs(n) < 0.005;
// Save-and-resume: statement header draft is per-device; the cleared TICKS
// are persisted server-side on the GL rows (PATCH /reconciliations/mark).
const draftKey = (accountId: string) => `@finmatrix/bankrec-draft/${accountId}`;

const BankReconciliationScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { accountId, accountName } = route.params;

  const [statementDate, setStatementDate] = useState(today());
  const [statementBalance, setStatementBalance] = useState('');
  const [beginningBalance, setBeginningBalance] = useState(0);
  const [beginningMismatch, setBeginningMismatch] = useState<number | null>(null);
  const [lastStatementDate, setLastStatementDate] = useState<string | null>(null);
  const [entries, setEntries] = useState<UnreconciledEntry[]>([]);
  const [cleared, setCleared] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Statement header draft (restore on mount, save on change) ──
  useEffect(() => {
    AsyncStorage.getItem(draftKey(accountId))
      .then(raw => {
        if (!raw) return;
        const draft = JSON.parse(raw);
        if (draft?.statementDate) setStatementDate(draft.statementDate);
        if (draft?.statementBalance) setStatementBalance(String(draft.statementBalance));
      })
      .catch((): void => undefined);
  }, [accountId]);
  useEffect(() => {
    AsyncStorage.setItem(
      draftKey(accountId),
      JSON.stringify({ statementDate, statementBalance }),
    ).catch((): void => undefined);
  }, [accountId, statementDate, statementBalance]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const raw = await getUnreconciledAPI(accountId, statementDate || undefined);
      const data = unreconciledSerializer(raw);
      setBeginningBalance(data.beginningBalance);
      setBeginningMismatch(data.beginningMismatch);
      setLastStatementDate(data.lastStatementDate);
      setEntries(data.entries);
      // Save-and-resume: server-side ticks from a previous session.
      setCleared(new Set(data.entries.filter(e => e.cleared).map(e => e.id)));
      setLoaded(true);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Failed to load', text2: e?.message ?? 'Could not load entries' });
    } finally {
      setLoading(false);
    }
  };

  // ── Persist ticks (debounced batch) so exiting mid-reconciliation keeps them ──
  const pendingMarks = useRef<Map<string, boolean>>(new Map());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushMarks = useCallback(() => {
    const marks = Array.from(pendingMarks.current, ([entryId, c]) => ({ entryId, cleared: c }));
    if (marks.length === 0) return;
    pendingMarks.current = new Map();
    markClearedAPI(accountId, marks).catch(() => {
      // Best-effort: ticks remain correct locally; a reload re-syncs.
    });
  }, [accountId]);
  useEffect(() => () => {
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushMarks(); // flush on unmount — leaving the screen must lose nothing
  }, [flushMarks]);

  const toggle = (id: string) =>
    setCleared(prev => {
      const next = new Set(prev);
      const nowCleared = !next.has(id);
      if (nowCleared) next.add(id); else next.delete(id);
      pendingMarks.current.set(id, nowCleared);
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(flushMarks, 800);
      return next;
    });

  // ── QuickBooks layout: payments/withdrawals vs deposits, with cleared totals ──
  const { payments, deposits } = useMemo(() => ({
    payments: entries.filter(e => e.amount < 0),
    deposits: entries.filter(e => e.amount >= 0)
  }), [entries]);
  const sectionStats = useCallback((list: UnreconciledEntry[]) => {
    const ticked = list.filter(e => cleared.has(e.id));
    return {
      count: ticked.length,
      total: ticked.reduce((s, e) => s + e.amount, 0),
    };
  }, [cleared]);
  const payStats = useMemo(() => sectionStats(payments), [sectionStats, payments]);
  const depStats = useMemo(() => sectionStats(deposits), [sectionStats, deposits]);

  const { clearedBalance, difference } = useMemo(() => {
    const net = entries.reduce((sum, e) => (cleared.has(e.id) ? sum + e.amount : sum), 0);
    const bal = beginningBalance + net;
    const stmt = parseFloat(statementBalance);
    return { clearedBalance: bal, difference: (isNaN(stmt) ? 0 : stmt) - bal };
  }, [entries, cleared, beginningBalance, statementBalance]);

  const canFinish = loaded && statementBalance.trim() !== '' && !isNaN(parseFloat(statementBalance)) && isBalanced(difference);

  const finish = async () => {
    if (!canFinish) return;
    setSaving(true);
    try {
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushMarks();
      await createReconciliationAPI({
        accountId,
        statementDate,
        statementEndingBalance: parseFloat(statementBalance).toFixed(2),
        clearedEntryIds: Array.from(cleared),
      });
      await AsyncStorage.removeItem(draftKey(accountId)).catch((): void => undefined);
      // Toast + direct navigation — Alert.alert button callbacks are dead on
      // react-native-web (project rule: never gate navigation on them).
      Toast.show({ type: 'success', text1: 'Reconciled', text2: 'Cleared entries are marked and locked.' });
      navigation.goBack();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Could not finish', text2: e?.message ?? 'Reconciliation failed' });
    } finally {
      setSaving(false);
    }
  };

  const renderEntry = (e: UnreconciledEntry) => {
    const on = cleared.has(e.id);
    const isDeposit = e.amount >= 0;
    return (
      <TouchableOpacity key={e.id} style={styles.entryRow} activeOpacity={0.7} onPress={() => toggle(e.id)}>
        <Feather name={on ? 'check-square' : 'square'} size={20} color={on ? ACCENT.teal : THEME.colors.textSecondary} />
        <View style={styles.entryInfo}>
          <Text style={styles.entryRef} numberOfLines={1}>{e.reference || e.sourceType}</Text>
          <Text style={styles.entryMeta} numberOfLines={1}>{e.date}{e.memo ? ` · ${e.memo}` : ''}</Text>
        </View>
        <Text style={[styles.entryAmt, { color: isDeposit ? ACCENT.green : ACCENT.red }]}>
          {isDeposit ? '+' : '−'}{rs(Math.abs(e.amount))}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <ReportContainer>
      <ReportHeader title="Reconcile" subtitle={accountName} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <DateField label="Statement Date" value={statementDate} onChangeText={setStatementDate} />
          <CustomInput
            label="Statement Ending Balance"
            value={statementBalance}
            onChangeText={setStatementBalance}
            keyboardType="numeric"
            placeholder="e.g. 15250.00"
          />
          <CustomButton
            title={loaded ? 'Reload Entries' : 'Load Entries'}
            variant="secondary"
            onPress={loadEntries}
            isLoading={loading}
            fullWidth
          />
        </Card>

        {loaded && beginningMismatch !== null && (
          <View style={[styles.banner, styles.bannerDanger]}>
            <Feather name="alert-octagon" size={16} color={THEME.colors.danger} />
            <Text style={[styles.bannerText, { color: THEME.colors.danger }]}>
              Beginning balance is off by <Text style={{ fontWeight: typography.labelLg.fontWeight }}>{rs(beginningMismatch)}</Text> versus the last
              reconciliation{lastStatementDate ? ` (${lastStatementDate})` : ''}. A reconciled transaction was changed outside
              the app — resolve this before reconciling further.
            </Text>
          </View>
        )}

        {loaded && (
          <KpiGrid
            items={[
              { label: 'Beginning', value: rs(beginningBalance), accent: ACCENT.blue, icon: 'flag' },
              { label: 'Cleared Balance', value: rs(clearedBalance), accent: ACCENT.teal, icon: 'check-square' },
              { label: 'Statement', value: statementBalance ? rs(parseFloat(statementBalance) || 0) : '—', accent: ACCENT.violet, icon: 'file-text' },
              {
                label: 'Difference',
                value: rs(difference),
                accent: isBalanced(difference) ? ACCENT.green : ACCENT.red,
                icon: isBalanced(difference) ? 'check-circle' : 'alert-circle',
              },
            ]}
          />
        )}

        {loading && !loaded && <LoadingBlock label="Loading entries…" />}

        {loaded && entries.length === 0 && (
          <Card><EmptyBlock icon="inbox" title="Nothing to reconcile" hint="No unreconciled entries on or before this date." /></Card>
        )}

        {loaded && payments.length > 0 && (
          <SectionCard
            title={`Payments & Withdrawals (${payStats.count}/${payments.length} cleared)`}
            subtitle={`Cleared total ${rs(Math.abs(payStats.total))}`}
            icon="arrow-up-right"
          >
            {payments.map(renderEntry)}
          </SectionCard>
        )}

        {loaded && deposits.length > 0 && (
          <SectionCard
            title={`Deposits (${depStats.count}/${deposits.length} cleared)`}
            subtitle={`Cleared total ${rs(depStats.total)}`}
            icon="arrow-down-left"
          >
            {deposits.map(renderEntry)}
          </SectionCard>
        )}

        {loaded && (
          <>
            {!isBalanced(difference) && (
              <View style={styles.banner}>
                <Feather name="alert-triangle" size={16} color={THEME.colors.warning} />
                <Text style={styles.bannerText}>
                  Out of balance by <Text style={{ fontWeight: typography.labelLg.fontWeight }}>{rs(difference)}</Text>. Tick the entries that appear on
                  your statement until the difference is 0. If the statement has an item your books lack (bank fee, interest),
                  add it as a normal transaction first — reconciliation never posts entries.
                </Text>
              </View>
            )}
            <CustomButton title="Finish Reconciliation" onPress={finish} isLoading={saving} disabled={!canFinish} fullWidth />
          </>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </ReportContainer>
  );
};

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: THEME.colors.borderLight },
  entryInfo: { flex: 1 },
  entryRef: { ...THEME.typography.labelMd,  color: THEME.colors.textPrimary },
  entryMeta: { ...THEME.typography.labelSm, color: THEME.colors.textSecondary, marginTop: 1 },
  entryAmt: { ...THEME.typography.bodySm, fontWeight: typography.labelLg.fontWeight },
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: THEME.colors.warningLight, borderRadius: THEME.radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: THEME.colors.warning + '40', paddingHorizontal: 12, paddingVertical: 11 },
  bannerDanger: { backgroundColor: THEME.colors.dangerLight, borderColor: THEME.colors.danger + '40' },
  bannerText: { flex: 1, ...THEME.typography.bodySm, color: THEME.colors.warningHover, lineHeight: 18 }
});

export default BankReconciliationScreen;
