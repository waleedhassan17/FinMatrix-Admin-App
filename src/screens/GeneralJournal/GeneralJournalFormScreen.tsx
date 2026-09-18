import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useCapability } from '../../hooks/useCapability';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { THEME } from '../../utils/theme';
import { useAppDispatch } from '../../hooks/useReduxHooks';
import { saveJournalEntry } from './journalEntrySlice';
import { getAccountsAPI } from '../../networks/accounting/coaNetwork';
import { coaListSerializer } from '../../serializers/coaSerializer';
import { formatCurrency } from '../../utils/formatters';
import CustomInput from '../../Custom-Components/CustomInput';
import CustomButton from '../../Custom-Components/CustomButton';
import { AddButton } from '../../components/form/FormUI';
import JournalLineRow from '../../components/shared/JournalLineRow';
import { ReportContainer, ReportHeader, Card, SectionCard, DateField } from '../../components/reports/ReportUI';
import type { TransactionsStackParamList } from '../../navigators/stacks/TransactionsStack';
import { toIsoDate } from '../../models/reportModel';

type Nav = NativeStackNavigationProp<TransactionsStackParamList>;
interface LineDraft { accountId: string; description: string; debit: string; credit: string; }
const blankLine = (): LineDraft => ({ accountId: '', description: '', debit: '', credit: '' });
const rs = (n: number) => formatCurrency(n, 'Rs ');

const GeneralJournalFormScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();

  const [date, setDate] = useState(toIsoDate(new Date()));
  const [memo, setMemo] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([blankLine(), blankLine()]);
  const [accountOptions, setAccountOptions] = useState<{ label: string; value: string }[]>([]);
  const [saving, setSaving] = useState(false);
  // Posting a manual journal is gated: staff file a request, the owner posts.
  const journalCap = useCapability('journal.post');

  useEffect(() => {
    (async () => {
      try {
        const res = await getAccountsAPI({ isActive: true });
        const { accounts } = coaListSerializer(res);
        setAccountOptions(
          accounts
            .filter((a: any) => a.isActive)
            .map((a: any) => ({ label: `${a.code} · ${a.name}`, value: a.id })),
        );
      } catch (e: any) {
        Toast.show({ type: 'error', text1: 'Could not load accounts', text2: e?.message ?? 'Please try again.' });
      }
    })();
  }, []);

  const totals = useMemo(() => {
    let debit = 0, credit = 0;
    lines.forEach(l => { debit += parseFloat(l.debit) || 0; credit += parseFloat(l.credit) || 0; });
    return { debit, credit, diff: debit - credit };
  }, [lines]);
  const balanced = Math.abs(totals.diff) < 0.01 && totals.debit > 0;

  const updateLine = (i: number, patch: Partial<LineDraft>) =>
    setLines(prev => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const validLines = () =>
    lines.filter(l => l.accountId && ((parseFloat(l.debit) || 0) > 0 || (parseFloat(l.credit) || 0) > 0));

  const submit = async (status: 'draft' | 'posted') => {
    const valid = validLines();
    if (valid.length < 2) { Toast.show({ type: 'error', text1: 'Not enough lines', text2: 'Add at least 2 lines with an account and an amount.' }); return; }
    if (status === 'posted' && !balanced) { Toast.show({ type: 'error', text1: 'Out of balance', text2: 'Total debits must equal total credits before posting.' }); return; }

    setSaving(true);
    const r: any = await dispatch(saveJournalEntry({
      date,
      memo: memo || undefined,
      status,
      lines: valid.map((l, i) => ({
        accountId: l.accountId,
        description: l.description || undefined,
        debit: (parseFloat(l.debit) || 0).toString(),
        credit: (parseFloat(l.credit) || 0).toString(),
        lineOrder: i,
      }))
    }));
    setSaving(false);
    if (r.meta.requestStatus === 'fulfilled') {
      // Staff get a pending request rather than an entry: a manual journal
      // writes the ledger directly, so the owner approves it first.
      if (r.payload?.data?.pending ?? r.payload?.pending) {
        Toast.show({
          type: 'success',
          text1: 'Sent to the owner for approval',
          text2: 'The entry posts once they approve it.',
        });
      }
      navigation.goBack();
      return;
    }
    Toast.show({ type: 'error', text1: 'Save failed', text2: r.error?.message ?? 'Could not save journal entry' });
  };

  return (
    <ReportContainer>
      <ReportHeader title="New Journal Entry" subtitle="Manual double-entry" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <DateField label="Date" value={date} onChangeText={setDate} />
          <CustomInput label="Memo" value={memo} onChangeText={setMemo} placeholder="Description of this entry" multiline />
        </Card>

        <SectionCard title="Lines" icon="list">
          {lines.map((l, i) => (
            <JournalLineRow
              key={i}
              accountId={l.accountId}
              description={l.description}
              debit={l.debit}
              credit={l.credit}
              accountOptions={accountOptions}
              onAccountChange={v => updateLine(i, { accountId: v })}
              onDescriptionChange={v => updateLine(i, { description: v })}
              onDebitChange={v => updateLine(i, { debit: v })}
              onCreditChange={v => updateLine(i, { credit: v })}
              onDelete={() => setLines(prev => prev.filter((_, idx) => idx !== i))}
              canDelete={lines.length > 2}
            />
          ))}
          <AddButton label="Add Line" onPress={() => setLines(prev => [...prev, blankLine()])} />
        </SectionCard>

        <Card>
          <Row label="Total Debits" value={rs(totals.debit)} />
          <Row label="Total Credits" value={rs(totals.credit)} />
          <Row label={balanced ? 'Balanced' : 'Difference'} value={balanced ? '✓' : rs(Math.abs(totals.diff))} strong accent={balanced ? THEME.colors.success : THEME.colors.danger} />
        </Card>

        <CustomButton title={journalCap.submitLabel('Save & Post')} onPress={() => submit('posted')} isLoading={saving} disabled={!balanced} fullWidth />
        <CustomButton title="Save as Draft" variant="secondary" onPress={() => submit('draft')} isLoading={saving} fullWidth />
        <View style={{ height: 24 }} />
      </ScrollView>
    </ReportContainer>
  );
};

const Row: React.FC<{ label: string; value: string; strong?: boolean; accent?: string }> = ({ label, value, strong, accent }) => (
  <View style={styles.totalRow}>
    <Text style={[styles.totalLabel, strong && styles.bold]}>{label}</Text>
    <Text style={[styles.totalValue, strong && styles.bold, accent ? { color: accent } : null]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  totalLabel: { ...THEME.typography.bodySm, color: THEME.colors.textSecondary },
  totalValue: { ...THEME.typography.labelMd, color: THEME.colors.textPrimary },
  bold: { ...THEME.typography.labelLg, color: THEME.colors.textPrimary }
});

export default GeneralJournalFormScreen;
