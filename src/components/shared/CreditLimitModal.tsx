// ═══════════════════════════════════════════════════════
// FinMatrix — Over the credit limit
// ═══════════════════════════════════════════════════════
// Shown when the server refuses a sale with CREDIT_LIMIT_EXCEEDED. The way
// forward: take an advance of at least the excess, or — the owner only — let
// it through with a reason, which the server records in the audit log.

import React, { useState } from 'react';
import { View, Text, Modal, TextInput, ScrollView, StyleSheet } from 'react-native';

import { THEME } from '../../utils/theme';
import CustomButton from '../../Custom-Components/CustomButton';
import { formatCurrency } from '../../utils/formatters';
import { useIsOwner } from '../../hooks/useCapability';
import { MIN_OVERRIDE_REASON, type CreditAssessment } from '../../models/creditModel';

const { colors, radius, spacing, typography } = THEME;
const rs = (n: number) => formatCurrency(n, 'Rs ');

interface Props {
  assessment: CreditAssessment | null;
  busy?: boolean;
  onClose: () => void;
  /** Retry the refused action with the owner's reason. */
  onOverride: (reason: string) => void;
  /** Open Receive Payment for the advance. */
  onRecordAdvance: (a: CreditAssessment) => void;
}

const CreditLimitModal: React.FC<Props> = ({ assessment: a, busy, onClose, onOverride, onRecordAdvance }) => {
  const isOwner = useIsOwner();
  const [reason, setReason] = useState('');

  const close = () => {
    setReason('');
    onClose();
  };

  const rows: Array<[string, string]> = a
    ? [
        ['Unpaid invoices', rs(a.openInvoices)],
        ...(a.inTransit > 0 ? [['Out for delivery on credit', rs(a.inTransit)] as [string, string]] : []),
        ...(a.shippedNotInvoiced > 0 ? [['Shipped, not yet invoiced', rs(a.shippedNotInvoiced)] as [string, string]] : []),
        ...(a.advances > 0 ? [['Less advances paid', `− ${rs(a.advances)}`] as [string, string]] : []),
        ...(a.credits > 0 ? [['Less open credit memos', `− ${rs(a.credits)}`] as [string, string]] : []),
        ['This sale', rs(a.thisAmount)],
        ['Would owe', rs(a.exposure)],
        ['Credit limit', rs(a.limit)],
        ['Over by', rs(a.excess)],
      ]
    : [];

  return (
    <Modal visible={!!a} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Over the credit limit</Text>
            {a && (
              <Text style={styles.body}>
                {a.customerName || 'This customer'} would owe {rs(a.exposure)} against a limit of {rs(a.limit)}.
                Take an advance of at least {rs(a.requiredAdvance)} first
                {isOwner ? ', or let it through with a reason.' : ', or ask the owner to approve it.'}
              </Text>
            )}
            <View style={styles.table}>
              {rows.map(([label, value], i) => (
                <View key={label} style={[styles.row, i >= rows.length - 3 && styles.rowStrong]}>
                  <Text style={styles.label}>{label}</Text>
                  <Text style={styles.value}>{value}</Text>
                </View>
              ))}
            </View>

            {isOwner && (
              <>
                <Text style={styles.label}>Why may this go past the limit?</Text>
                <TextInput
                  style={styles.input}
                  value={reason}
                  onChangeText={setReason}
                  placeholder="e.g. cheque received, clearing Friday"
                  placeholderTextColor={colors.textTertiary}
                  multiline
                />
              </>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <CustomButton title="Cancel" onPress={close} variant="secondary" size="sm" fullWidth />
            {a && (
              <CustomButton
                title={`Record advance ${rs(a.requiredAdvance)}`}
                onPress={() => {
                  setReason('');
                  onRecordAdvance(a);
                }}
                variant={isOwner ? 'secondary' : 'primary'}
                size="sm"
                fullWidth
              />
            )}
            {isOwner && (
              <CustomButton
                title="Override and continue"
                onPress={() => {
                  const r = reason.trim();
                  setReason('');
                  onOverride(r);
                }}
                variant="primary"
                size="sm"
                fullWidth
                isLoading={busy}
                disabled={busy || reason.trim().length < MIN_OVERRIDE_REASON}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, maxHeight: '90%' },
  title: { ...typography.h4, color: colors.textPrimary, marginBottom: spacing.xs },
  body: { ...typography.bodySm, color: colors.textSecondary, marginBottom: spacing.sm },
  table: { marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xxs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowStrong: { backgroundColor: colors.background },
  label: { ...typography.bodySm, color: colors.textSecondary },
  value: { ...typography.labelMd, color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  input: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.xs,
    marginTop: spacing.xxs,
    textAlignVertical: 'top',
    ...typography.bodyMd,
    color: colors.textPrimary,
  },
  actions: { gap: spacing.xs, marginTop: spacing.sm },
});

export default CreditLimitModal;
