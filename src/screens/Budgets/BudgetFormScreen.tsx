import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

import { THEME } from '../../utils/theme';
import { getAccountsAPI } from '../../networks/accounting/coaNetwork';
import { createBudgetAPI, getBudgetPrefillAPI } from '../../networks/payroll/budgetNetwork';
import { evenMonthlySpread, isBudgetableAccount } from '../../utils/budgetMath';
import { formatCurrency } from '../../utils/formatters';
import CustomDropdown from '../../Custom-Components/CustomDropdown';
import CustomInput from '../../Custom-Components/CustomInput';
import CustomButton from '../../Custom-Components/CustomButton';
import { AddButton } from '../../components/form/FormUI';
import { ReportContainer, ReportHeader, Card, SectionCard } from '../../components/reports/ReportUI';
import type { ReportsStackParamList } from '../../navigators/stacks/ReportsStack';

type Nav = NativeStackNavigationProp<ReportsStackParamList>;
interface LineDraft {
  accountId: string;
  annual: string;
  /** Monthly seasonality from prior-year actuals (prefill); even split when absent. */
  months?: number[];
}
const rs = (n: number) => formatCurrency(n, 'Rs ');

const BudgetFormScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const [accounts, setAccounts] = useState<{ label: string; value: string }[]>([]);
  const [name, setName] = useState('');
  const [fiscalYear, setFiscalYear] = useState(String(new Date().getFullYear()));
  const [lines, setLines] = useState<LineDraft[]>([{ accountId: '', annual: '0' }]);
  const [saving, setSaving] = useState(false);
  const [prefilling, setPrefilling] = useState(false);

  // QuickBooks "create budget from previous year's data": pulls per-account
  // monthly ACTUALS from the ledger and uses them as the starting lines
  // (keeping each month's real seasonality, not an even split).
  const prefill = async () => {
    const fy = (parseInt(fiscalYear, 10) || new Date().getFullYear()) - 1;
    setPrefilling(true);
    try {
      const data = await getBudgetPrefillAPI(fy);
      const rows: any[] = data?.lines ?? [];
      if (rows.length === 0) {
        Toast.show({ type: 'error', text1: 'Nothing to pre-fill', text2: `No revenue or expense activity found in ${fy}.` });
        return;
      }
      setLines(rows.map(r => ({
        accountId: r.accountId,
        annual: String(r.annualTotal ?? 0),
        months: r.monthlyAmounts
      })));
      if (!name.trim()) setName(`FY${fiscalYear} Operating Budget`);
      Toast.show({ type: 'success', text1: 'Pre-filled', text2: `${rows.length} account line${rows.length === 1 ? '' : 's'} loaded from ${fy} actuals. Adjust the amounts, then create.` });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Pre-fill failed', text2: e?.message ?? 'Could not load prior-year actuals' });
    } finally {
      setPrefilling(false);
    }
  };

  useEffect(() => {
    getAccountsAPI({ limit: 200 } as any).then((res: any) => {
      const arr = res?.data?.accounts ?? res?.data?.data ?? res?.data ?? [];
      // Revenue and expense accounts only — what the prefill returns and what
      // Budget vs Actual can read meaningfully. A balance-sheet account has no
      // "spent this year" to compare against.
      setAccounts(
        (Array.isArray(arr) ? arr : [])
          .filter((a: any) => isBudgetableAccount(String(a.type ?? '')))
          .map((a: any) => ({ label: `${a.accountNumber} ${a.name}`, value: a.id })),
      );
    }).catch(() => {});
  }, []);

  const total = useMemo(() => lines.reduce((s, l) => s + (parseFloat(l.annual) || 0), 0), [lines]);
  const updateLine = (i: number, patch: Partial<LineDraft>) => setLines(prev => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const save = async () => {
    if (!name.trim()) { Toast.show({ type: 'error', text1: 'Missing name', text2: 'Enter a budget name.' }); return; }
    const valid = lines.filter(l => l.accountId && parseFloat(l.annual) > 0);
    if (valid.length === 0) { Toast.show({ type: 'error', text1: 'No lines', text2: 'Add at least one account with an annual amount.' }); return; }
    setSaving(true);
    try {
      await createBudgetAPI({
        name, fiscalYear: parseInt(fiscalYear, 10) || new Date().getFullYear(), status: 'active',
        lines: valid.map(l => {
          if (l.months && l.months.length === 12) {
            return { accountId: l.accountId, monthlyAmounts: l.months };
          }
          // Whole paise with the remainder in December, so the months add back
          // to the annual amount — rounding each month separately lost paise.
          return { accountId: l.accountId, monthlyAmounts: evenMonthlySpread(parseFloat(l.annual) || 0) };
        }),
      });
      navigation.goBack();
    } catch (e: any) { Toast.show({ type: 'error', text1: 'Save failed', text2: e?.message ?? 'Could not save budget' }); }
    finally { setSaving(false); }
  };

  return (
    <ReportContainer>
      <ReportHeader title="New Budget" subtitle="Annual amounts split evenly by month" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <CustomInput label="Budget Name" value={name} onChangeText={setName} placeholder="FY2026 Operating Budget" />
          <CustomInput label="Fiscal Year" value={fiscalYear} onChangeText={setFiscalYear} keyboardType="numeric" />
          <CustomButton
            title={`Pre-fill from ${(parseInt(fiscalYear, 10) || new Date().getFullYear()) - 1} actuals`}
            variant="secondary"
            onPress={prefill}
            isLoading={prefilling}
            fullWidth
          />
        </Card>

        <SectionCard title="Budget Lines" icon="list">
          {lines.map((l, i) => (
            <View key={i} style={styles.lineRow}>
              <View style={styles.lineMain}>
                <CustomDropdown label={`Account ${i + 1}`} placeholder="Select account" options={accounts} value={l.accountId} onChange={v => updateLine(i, { accountId: v })} />
                <CustomInput label="Annual Amount" value={l.annual} onChangeText={v => updateLine(i, { annual: v, months: undefined })} keyboardType="numeric" />
              </View>
              {lines.length > 1 && (
                <TouchableOpacity onPress={() => setLines(prev => prev.filter((_, idx) => idx !== i))} style={styles.del}>
                  <Feather name="trash-2" size={16} color={THEME.colors.danger} />
                </TouchableOpacity>
              )}
            </View>
          ))}
          <AddButton label="Add Account" onPress={() => setLines(prev => [...prev, { accountId: '', annual: '0' }])} />
        </SectionCard>

        <Card>
          <View style={styles.totalRow}><Text style={styles.bold}>Total Budget</Text><Text style={styles.bold}>{rs(total)}</Text></View>
        </Card>

        <CustomButton title="Create Budget" onPress={save} isLoading={saving} fullWidth />
        <View style={{ height: 24 }} />
      </ScrollView>
    </ReportContainer>
  );
};

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  lineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: THEME.colors.borderLight },
  lineMain: { flex: 1 },
  del: { paddingTop: 28, paddingHorizontal: 4 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  bold: { ...THEME.typography.labelLg,  color: THEME.colors.textPrimary }
});

export default BudgetFormScreen;
