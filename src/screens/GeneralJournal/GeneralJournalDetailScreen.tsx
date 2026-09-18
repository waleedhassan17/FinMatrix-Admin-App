import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput
} from 'react-native';
import { Alert } from '../../utils/alert';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { THEME } from '../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import {
  fetchJournalEntry, selectJournalEntryState, postJournalEntry, voidJournalEntry
} from './journalEntrySlice';
import { formatCurrency } from '../../utils/formatters';
import CustomButton from '../../Custom-Components/CustomButton';
import { ReportContainer, ReportHeader, Card, SectionCard, Badge, LoadingBlock, ErrorBlock } from '../../components/reports/ReportUI';
import { txnStatusColor } from '../../components/transactions/txnStatus';
import type { TransactionsStackParamList } from '../../navigators/stacks/TransactionsStack';

type Nav = NativeStackNavigationProp<TransactionsStackParamList>;
type Rt = RouteProp<TransactionsStackParamList, 'JournalEntryDetail'>;
const rs = (n: number) => formatCurrency(n, 'Rs ');

const GeneralJournalDetailScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { entryId } = route.params;
  const dispatch = useAppDispatch();
  const { current: e, isLoading, error } = useAppSelector(selectJournalEntryState);
  const [busy, setBusy] = useState(false);
  const [showVoid, setShowVoid] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  useFocusEffect(useCallback(() => { dispatch(fetchJournalEntry(entryId)); }, [dispatch, entryId]));

  const doPost = async () => {
    setBusy(true);
    const r: any = await dispatch(postJournalEntry(entryId));
    setBusy(false);
    if (r.meta.requestStatus !== 'fulfilled') {
      Alert.alert('Post failed', r.error?.message ?? 'Could not post entry');
    }
  };

  const doVoid = async () => {
    if (!voidReason.trim()) { Alert.alert('Reason required', 'Please enter a reason for voiding.'); return; }
    setBusy(true);
    const r: any = await dispatch(voidJournalEntry({ id: entryId, reason: voidReason.trim() }));
    setBusy(false);
    if (r.meta.requestStatus === 'fulfilled') { setShowVoid(false); setVoidReason(''); }
    else Alert.alert('Void failed', r.error?.message ?? 'Could not void entry');
  };

  if (isLoading && !e) return <ReportContainer><ReportHeader title="Journal Entry" onBack={() => navigation.goBack()} /><LoadingBlock label="Loading…" /></ReportContainer>;
  if (error && !e) return <ReportContainer><ReportHeader title="Journal Entry" onBack={() => navigation.goBack()} /><ErrorBlock message={error} onRetry={() => dispatch(fetchJournalEntry(entryId))} /></ReportContainer>;
  if (!e) return <ReportContainer><ReportHeader title="Journal Entry" onBack={() => navigation.goBack()} /></ReportContainer>;

  const balanced = Math.abs(e.totalDebits - e.totalCredits) < 0.01;

  return (
    <ReportContainer>
      <ReportHeader title={e.reference} subtitle={e.date} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <View style={styles.headRow}>
            <Badge label={e.status} color={txnStatusColor(e.status)} dot />
            <Text style={styles.total}>{rs(e.totalDebits)}</Text>
          </View>
          <Info label="Date" value={e.date} />
          {!!e.memo && <Info label="Memo" value={e.memo} />}
          {!!e.postedAt && <Info label="Posted" value={new Date(e.postedAt).toLocaleString()} />}
          {!!e.voidReason && <Info label="Void reason" value={e.voidReason} />}
          <Info label="Balanced" value={balanced ? 'Yes' : 'No'} strong />
        </Card>

        <SectionCard title="Lines" icon="list">
          <View style={styles.lineHead}>
            <Text style={[styles.colAcct, styles.headText]}>Account</Text>
            <Text style={[styles.colVal, styles.headText]}>Debit</Text>
            <Text style={[styles.colVal, styles.headText]}>Credit</Text>
          </View>
          {e.lines.map((l, i) => (
            <View key={l.id ?? i} style={styles.lineRow}>
              <View style={styles.colAcct}>
                <Text style={styles.lineDesc}>{l.accountNumber} {l.accountName}</Text>
                {!!l.description && <Text style={styles.lineMeta}>{l.description}</Text>}
              </View>
              <Text style={[styles.colVal, styles.lineVal]}>{l.debit ? rs(l.debit) : '—'}</Text>
              <Text style={[styles.colVal, styles.lineVal]}>{l.credit ? rs(l.credit) : '—'}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={[styles.colAcct, styles.totalText]}>Total</Text>
            <Text style={[styles.colVal, styles.totalText]}>{rs(e.totalDebits)}</Text>
            <Text style={[styles.colVal, styles.totalText]}>{rs(e.totalCredits)}</Text>
          </View>
        </SectionCard>

        {showVoid && (
          <SectionCard title="Void Entry" icon="x-octagon">
            <TextInput
              style={styles.reasonInput}
              value={voidReason}
              onChangeText={setVoidReason}
              placeholder="Reason for voiding…"
              placeholderTextColor={THEME.colors.textTertiary}
              multiline
            />
            <Text style={styles.voidHint}>
              {e.status === 'posted'
                ? 'A reversing entry will be posted to keep the ledger balanced.'
                : 'This draft will be marked void.'}
            </Text>
          </SectionCard>
        )}

        <View style={styles.actions}>
          {e.status === 'draft' && !showVoid && (
            <CustomButton title="Post to Ledger" variant="primary" onPress={doPost} isLoading={busy} fullWidth />
          )}
          {(e.status === 'draft' || e.status === 'posted') && !showVoid && (
            <CustomButton title="Void" variant="danger" onPress={() => setShowVoid(true)} fullWidth />
          )}
          {showVoid && (
            <>
              <CustomButton title="Confirm Void" variant="danger" onPress={doVoid} isLoading={busy} fullWidth />
              <CustomButton title="Cancel" variant="secondary" onPress={() => { setShowVoid(false); setVoidReason(''); }} fullWidth />
            </>
          )}
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>
    </ReportContainer>
  );
};

const Info: React.FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => (
  <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={[styles.infoValue, strong && styles.bold]}>{value}</Text></View>
);

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  total: { ...THEME.typography.h4, color: THEME.colors.textPrimary },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  infoLabel: { ...THEME.typography.bodySm, color: THEME.colors.textSecondary },
  infoValue: { ...THEME.typography.labelMd, color: THEME.colors.textPrimary, flexShrink: 1, textAlign: 'right', marginLeft: 12 },
  bold: { ...THEME.typography.labelLg },
  lineHead: { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: THEME.colors.border },
  headText: { ...THEME.typography.labelSm, color: THEME.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  lineRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: THEME.colors.borderLight },
  colAcct: { flex: 1.6 },
  colVal: { flex: 1, textAlign: 'right' },
  lineDesc: { ...THEME.typography.labelMd, color: THEME.colors.textPrimary },
  lineMeta: { ...THEME.typography.labelSm, color: THEME.colors.textSecondary },
  lineVal: { ...THEME.typography.bodySm, color: THEME.colors.textPrimary },
  totalRow: { flexDirection: 'row', paddingVertical: 10, marginTop: 2, borderTopWidth: 2, borderTopColor: THEME.colors.border },
  totalText: { ...THEME.typography.labelMd, color: THEME.colors.textPrimary },
  reasonInput: { borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 8, padding: 10, minHeight: 60, textAlignVertical: 'top', ...THEME.typography.bodyMd, color: THEME.colors.textPrimary },
  voidHint: { ...THEME.typography.labelSm, color: THEME.colors.textSecondary, marginTop: 8 },
  actions: { gap: 10 }
});

export default GeneralJournalDetailScreen;
