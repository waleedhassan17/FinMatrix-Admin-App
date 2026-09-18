import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, TouchableOpacity } from 'react-native';
import Toast from 'react-native-toast-message';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { THEME } from '../../utils/theme';
import { formatCurrency } from '../../utils/formatters';
import { getReconciliationByIdAPI, deleteReconciliationAPI } from '../../networks/accounting/reconciliationNetwork';
import { reconciliationSingleSerializer } from '../../serializers/reconciliationSerializer';
import type { Reconciliation } from '../../models/reconciliationModel';
import CustomButton from '../../Custom-Components/CustomButton';
import { ReportContainer, ReportHeader, Card, SectionCard, LoadingBlock, ErrorBlock, ACCENT } from '../../components/reports/ReportUI';
import type { MoreStackParamList } from '../../navigators/stacks/MoreStack';

// Design-system tokens (see src/theme/theme.ts).
const { colors, typography } = THEME;

type Nav = NativeStackNavigationProp<MoreStackParamList>;
type Rt = RouteProp<MoreStackParamList, 'BankReconciliationDetail'>;
const rs = (n: number) => formatCurrency(n, 'Rs ');

const BankReconciliationDetailScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { reconciliationId } = route.params;
  const [recon, setRecon] = useState<Reconciliation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [undoing, setUndoing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const raw = await getReconciliationByIdAPI(reconciliationId);
      setRecon(reconciliationSingleSerializer(raw));
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load reconciliation');
    } finally {
      setLoading(false);
    }
  }, [reconciliationId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Real Modal, not Alert.alert — button callbacks in Alert.alert are NO-OPs
  // on react-native-web (project rule for all confirmations).
  const [confirmVisible, setConfirmVisible] = useState(false);

  const doUndo = async () => {
    setConfirmVisible(false);
    setUndoing(true);
    try {
      await deleteReconciliationAPI(reconciliationId);
      Toast.show({ type: 'success', text1: 'Reconciliation undone', text2: 'Cleared entries can be reconciled again.' });
      navigation.goBack();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Could not undo', text2: e?.message ?? 'Undo failed' });
    } finally {
      setUndoing(false);
    }
  };

  if (loading && !recon) return <ReportContainer><ReportHeader title="Reconciliation" onBack={() => navigation.goBack()} /><LoadingBlock label="Loading…" /></ReportContainer>;
  if (error && !recon) return <ReportContainer><ReportHeader title="Reconciliation" onBack={() => navigation.goBack()} /><ErrorBlock message={error} onRetry={load} /></ReportContainer>;
  if (!recon) return <ReportContainer><ReportHeader title="Reconciliation" onBack={() => navigation.goBack()} /></ReportContainer>;

  return (
    <ReportContainer>
      <ReportHeader title={`Statement ${recon.statementDate}`} subtitle={`${recon.clearedCount} cleared`} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Row label="Statement date" value={recon.statementDate} />
          <Row label="Beginning balance" value={rs(recon.beginningBalance)} />
          <Row label="Cleared balance" value={rs(recon.clearedBalance)} />
          <Row label="Statement ending" value={rs(recon.statementEndingBalance)} />
          <Row label="Difference" value={rs(recon.difference)} strong />
        </Card>

        {recon.entries && recon.entries.length > 0 && (
          <SectionCard title="Cleared Entries" icon="check-square">
            {recon.entries.map(e => {
              const isDeposit = e.amount >= 0;
              return (
                <View key={e.id} style={styles.entryRow}>
                  <View style={styles.entryInfo}>
                    <Text style={styles.entryRef} numberOfLines={1}>{e.reference || e.sourceType}</Text>
                    <Text style={styles.entryMeta} numberOfLines={1}>{e.date}{e.memo ? ` · ${e.memo}` : ''}</Text>
                  </View>
                  <Text style={[styles.entryAmt, { color: isDeposit ? ACCENT.green : ACCENT.red }]}>
                    {isDeposit ? '+' : '−'}{rs(Math.abs(e.amount))}
                  </Text>
                </View>
              );
            })}
          </SectionCard>
        )}

        {/* RECONCILIATION REPORT (QuickBooks): outstanding = book items dated
            on/before the statement that this reconciliation did NOT clear —
            they explain the book-vs-bank timing difference. */}
        {recon.outstanding && recon.outstanding.length > 0 && (
          <SectionCard
            title={`Outstanding Items (${recon.outstanding.length})`}
            subtitle={recon.outstandingTotal !== undefined ? `Uncleared total ${rs(recon.outstandingTotal)}` : 'Uncleared as of the statement date'}
            icon="clock"
          >
            {recon.outstanding.map(e => {
              const isDeposit = e.amount >= 0;
              return (
                <View key={e.id} style={styles.entryRow}>
                  <View style={styles.entryInfo}>
                    <Text style={styles.entryRef} numberOfLines={1}>{e.reference || e.sourceType}</Text>
                    <Text style={styles.entryMeta} numberOfLines={1}>{e.date}{e.memo ? ` · ${e.memo}` : ''}</Text>
                  </View>
                  <Text style={[styles.entryAmt, { color: isDeposit ? ACCENT.green : ACCENT.red }]}>
                    {isDeposit ? '+' : '−'}{rs(Math.abs(e.amount))}
                  </Text>
                </View>
              );
            })}
          </SectionCard>
        )}

        {!!recon.notes && <Card><Text style={styles.notes}>{recon.notes}</Text></Card>}

        <CustomButton title="Undo Reconciliation" variant="danger" onPress={() => setConfirmVisible(true)} isLoading={undoing} fullWidth />
        <View style={{ height: 24 }} />
      </ScrollView>

      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Undo reconciliation</Text>
            <Text style={styles.modalBody}>
              This un-marks all cleared entries so they can be reconciled again. The undo is
              recorded in the audit log. Continue?
            </Text>
            <View style={styles.modalRow}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalCancel]} onPress={() => setConfirmVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalDanger]} onPress={doUndo}>
                <Text style={styles.modalDangerText}>Undo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ReportContainer>
  );
};

const Row: React.FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={[styles.rowValue, strong && styles.bold]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  rowLabel: { ...THEME.typography.bodySm, color: THEME.colors.textSecondary },
  rowValue: { ...THEME.typography.bodySm, color: THEME.colors.textPrimary, fontWeight: typography.labelLg.fontWeight },
  bold: { ...THEME.typography.bodyMd, fontWeight: typography.labelLg.fontWeight },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: THEME.colors.borderLight },
  entryInfo: { flex: 1 },
  entryRef: { ...THEME.typography.labelMd,  color: THEME.colors.textPrimary },
  entryMeta: { ...THEME.typography.labelSm, color: THEME.colors.textSecondary, marginTop: 1 },
  entryAmt: { ...THEME.typography.bodySm, fontWeight: typography.labelLg.fontWeight },
  notes: { ...THEME.typography.bodySm, color: THEME.colors.textSecondary },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(9,30,66,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 420, backgroundColor: colors.neutral0, borderRadius: THEME.radius.lg, padding: 20 },
  modalTitle: { ...THEME.typography.h4,  color: THEME.colors.textPrimary },
  modalBody: { ...THEME.typography.bodySm, color: THEME.colors.textSecondary, lineHeight: 19, marginTop: 8 },
  modalRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  modalBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: THEME.radius.md },
  modalCancel: { backgroundColor: colors.background },
  modalCancelText: { ...THEME.typography.labelMd,  color: THEME.colors.textPrimary },
  modalDanger: { backgroundColor: THEME.colors.danger },
  modalDangerText: { ...THEME.typography.labelMd,  color: colors.neutral0 }
});

export default BankReconciliationDetailScreen;
