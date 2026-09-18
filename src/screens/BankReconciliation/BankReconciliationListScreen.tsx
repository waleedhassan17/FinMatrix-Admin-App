import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

import { THEME } from '../../utils/theme';
import { formatCurrency } from '../../utils/formatters';
import { getReconcilableAccountsAPI, getReconciliationsAPI } from '../../networks/accounting/reconciliationNetwork';
import { accountsSerializer, reconciliationListSerializer } from '../../serializers/reconciliationSerializer';
import type { ReconcilableAccount, Reconciliation } from '../../models/reconciliationModel';
import type { MoreStackParamList } from '../../navigators/stacks/MoreStack';
import { ReportContainer, ReportHeader, Card, SectionCard, EmptyBlock, LoadingBlock, ErrorBlock, ACCENT } from '../../components/reports/ReportUI';

type Nav = NativeStackNavigationProp<MoreStackParamList>;
const rs = (n: number) => formatCurrency(n, 'Rs ');

const BankReconciliationListScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const [accounts, setAccounts] = useState<ReconcilableAccount[]>([]);
  const [history, setHistory] = useState<Reconciliation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [acctRaw, histRaw] = await Promise.all([
        getReconcilableAccountsAPI(),
        getReconciliationsAPI(),
      ]);
      setAccounts(accountsSerializer(acctRaw));
      setHistory(reconciliationListSerializer(histRaw));
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load reconciliation data');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ReportContainer>
      <ReportHeader title="Bank Reconciliation" subtitle="Match your books to the bank" onBack={() => navigation.goBack()} backLabel="More" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={THEME.colors.primary} />}
      >
        {loading && accounts.length === 0 && <LoadingBlock label="Loading accounts…" />}
        {!!error && <ErrorBlock message={error} onRetry={load} />}

        {!loading && accounts.length === 0 && !error && (
          <EmptyBlock icon="credit-card" title="No cash or bank accounts" hint="Add a Cash or Bank account in the Chart of Accounts to reconcile." />
        )}

        {accounts.length > 0 && (
          <SectionCard title="Accounts" icon="credit-card">
            {accounts.map(a => (
              <TouchableOpacity
                key={a.accountId}
                style={styles.acctRow}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('BankReconciliation', { accountId: a.accountId, accountName: `${a.accountNumber} · ${a.name}` })}
              >
                <View style={styles.acctInfo}>
                  <Text style={styles.acctName}>{a.name}</Text>
                  <Text style={styles.acctMeta}>
                    #{a.accountNumber}
                    {a.lastReconciledDate ? ` · Last reconciled ${a.lastReconciledDate}` : ' · Never reconciled'}
                  </Text>
                </View>
                <View style={styles.acctRight}>
                  <Text style={styles.acctBalance}>{rs(a.bookBalance)}</Text>
                  <Feather name="chevron-right" size={18} color={THEME.colors.textSecondary} />
                </View>
              </TouchableOpacity>
            ))}
          </SectionCard>
        )}

        {history.length > 0 && (
          <SectionCard title="History" icon="check-square">
            {history.map(r => (
              <TouchableOpacity
                key={r.id}
                style={styles.histRow}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('BankReconciliationDetail', { reconciliationId: r.id })}
              >
                <View style={styles.histInfo}>
                  <Text style={styles.histDate}>{r.statementDate}</Text>
                  <Text style={styles.histMeta}>{r.clearedCount} cleared · {r.status}</Text>
                </View>
                <View style={styles.acctRight}>
                  <Text style={styles.histBalance}>{rs(r.statementEndingBalance)}</Text>
                  <Feather name="chevron-right" size={18} color={THEME.colors.textSecondary} />
                </View>
              </TouchableOpacity>
            ))}
          </SectionCard>
        )}

        <Card>
          <Text style={styles.note}>
            Reconciliation is a verification step — ticking entries that appear on your statement does not post any journal entries. Enter corrections as normal transactions.
          </Text>
        </Card>
        <View style={{ height: 24 }} />
      </ScrollView>
    </ReportContainer>
  );
};

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  acctRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: THEME.colors.borderLight },
  acctInfo: { flex: 1, paddingRight: 10 },
  acctName: { ...THEME.typography.labelLg,  color: THEME.colors.textPrimary },
  acctMeta: { ...THEME.typography.labelSm, color: THEME.colors.textSecondary, marginTop: 2 },
  acctRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  acctBalance: { ...THEME.typography.labelLg,  color: ACCENT.teal },
  histRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: THEME.colors.borderLight },
  histInfo: { flex: 1 },
  histDate: { ...THEME.typography.labelLg,  color: THEME.colors.textPrimary },
  histMeta: { ...THEME.typography.labelSm, color: THEME.colors.textSecondary, marginTop: 2 },
  histBalance: { ...THEME.typography.labelLg,  color: THEME.colors.textPrimary },
  note: { ...THEME.typography.bodySm, color: THEME.colors.textSecondary, lineHeight: 18 }
});

export default BankReconciliationListScreen;
