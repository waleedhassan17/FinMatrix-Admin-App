// ═══════════════════════════════════════════════════════
// FinMatrix — Apply customer advance
// ═══════════════════════════════════════════════════════
// Money a customer paid that is not yet set against an invoice sits in
// Customer Advances (a liability). This applies it to open invoices —
// Dr Customer Advances / Cr Accounts Receivable, no cash moves.
//
// Without this the only way to settle an invoice the customer had already
// paid for was to record the cash a second time, which is exactly how QA
// ended up with JE-216 and JE-217 for one payment.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { THEME } from '../../utils/theme';
import CustomButton from '../../Custom-Components/CustomButton';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  applyPaymentAdvanceAPI,
  getCustomerAdvancesAPI,
  getOutstandingInvoicesAPI,
} from '../../networks/sales/paymentNetwork';
import {
  customerAdvancesSerializer,
  type CustomerAdvance,
} from '../../serializers/paymentSerializer';

const { colors, radius, spacing, typography } = THEME;

const toNum = (v: unknown) => {
  const n = parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

interface OpenInvoice {
  id: string;
  invoiceNumber: string;
  dueDate: string;
  balance: number;
}

interface Props {
  visible: boolean;
  customerId: string;
  customerName?: string;
  /** Ticked first and filled before the others, e.g. from an invoice screen. */
  invoiceId?: string;
  onClose: () => void;
  /** After a successful apply (or an approval request for staff). */
  onApplied?: (result: { pending: boolean }) => void;
}

const ApplyAdvanceModal: React.FC<Props> = ({
  visible,
  customerId,
  customerName,
  invoiceId,
  onClose,
  onApplied,
}) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // What was loaded, and for which opening. Loading is derived from the key
  // rather than set inside the effect, so a reopened sheet never shows the
  // previous customer's figures.
  const loadKey = visible && customerId ? customerId : '';
  const [loaded, setLoaded] = useState<{
    key: string;
    advances: CustomerAdvance[];
    invoices: OpenInvoice[];
    error: string;
  } | null>(null);
  const [paymentId, setPaymentId] = useState('');
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const current = loaded && loaded.key === loadKey ? loaded : null;
  const loading = !!loadKey && !current;
  const advances = current?.advances ?? [];
  const invoices = current?.invoices ?? [];
  const loadError = current?.error ?? '';
  const selected = advances.find(a => a.paymentId === paymentId);

  /** Oldest due first, the requested invoice ahead of the rest. */
  const fill = useCallback(
    (available: number, rows: OpenInvoice[]) => {
      let left = available;
      const next: Record<string, string> = {};
      const ordered = invoiceId
        ? [...rows.filter(r => r.id === invoiceId), ...rows.filter(r => r.id !== invoiceId)]
        : rows;
      for (const r of ordered) {
        const take = round2(Math.min(r.balance, left));
        if (take > 0) next[r.id] = take.toFixed(2);
        left = round2(left - take);
        // From an invoice screen, settle that invoice only.
        if (invoiceId) break;
      }
      setAmounts(next);
    },
    [invoiceId],
  );

  useEffect(() => {
    if (!loadKey) return;
    let cancelled = false;
    Promise.all([getCustomerAdvancesAPI(loadKey), getOutstandingInvoicesAPI(loadKey)])
      .then(([advRaw, invRaw]) => {
        if (cancelled) return;
        const adv = customerAdvancesSerializer(advRaw);
        const invData = invRaw?.data ?? invRaw;
        const rows: OpenInvoice[] = (Array.isArray(invData) ? invData : [])
          .map((i: any) => ({
            id: i?.id ?? '',
            invoiceNumber: i?.invoiceNumber ?? '',
            dueDate: i?.dueDate ?? '',
            balance: round2(toNum(i?.balance)),
          }))
          .filter((i: OpenInvoice) => i.id && i.balance > 0);
        setLoaded({ key: loadKey, advances: adv, invoices: rows, error: '' });
        const first = adv[0];
        setPaymentId(first?.paymentId ?? '');
        if (first) fill(first.unapplied, rows);
      })
      .catch(e => {
        if (!cancelled) setLoaded({ key: loadKey, advances: [], invoices: [], error: e?.message || 'Could not load advances.' });
      });
    return () => {
      cancelled = true;
    };
  }, [loadKey, fill]);

  const total = useMemo(
    () => round2(Object.values(amounts).reduce((s, v) => s + toNum(v), 0)),
    [amounts],
  );
  const overAdvance = !!selected && total > selected.unapplied + 0.004;
  const overInvoice = invoices.some(i => toNum(amounts[i.id]) > i.balance + 0.004);

  const chooseAdvance = (a: CustomerAdvance) => {
    setPaymentId(a.paymentId);
    fill(a.unapplied, invoices);
  };

  const submit = async () => {
    if (!selected || total <= 0 || overAdvance || overInvoice || saving) return;
    setSaving(true);
    setError('');
    try {
      const applications = Object.entries(amounts)
        .filter(([, v]) => toNum(v) > 0)
        .map(([id, v]) => ({ invoiceId: id, amount: round2(toNum(v)).toFixed(2) }));
      const res = await applyPaymentAdvanceAPI(selected.paymentId, applications);
      const pending = !!(res?.data?.pending ?? res?.pending);
      Toast.show(
        pending
          ? { type: 'success', text1: 'Sent to the owner for approval', text2: 'The invoice stays open until they approve.' }
          : { type: 'success', text1: 'Advance applied', text2: `${formatCurrency(total, 'Rs ')} set against invoices. No new cash recorded.` },
      );
      onApplied?.({ pending });
      // Stale after an apply: the next opening reloads.
      setLoaded(null);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Could not apply the advance.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Apply advance</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Feather name="x" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator style={{ margin: spacing.xl }} color={colors.primary} />
          ) : (
            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              {advances.length === 0 ? (
                <Text style={styles.muted}>
                  {customerName || 'This customer'} holds no unapplied advances.
                </Text>
              ) : (
                <>
                  <Text style={styles.muted}>
                    Settles invoices from money {customerName || 'the customer'} already paid. No new cash is recorded.
                  </Text>

                  <Text style={styles.section}>Advance</Text>
                  {advances.map(a => {
                    const on = a.paymentId === paymentId;
                    return (
                      <TouchableOpacity
                        key={a.paymentId}
                        style={[styles.row, on && styles.rowOn]}
                        onPress={() => chooseAdvance(a)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                      >
                        <Feather name={on ? 'check-circle' : 'circle'} size={16} color={on ? colors.primary : colors.textTertiary} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowTitle}>{a.paymentNumber || 'Receipt'}</Text>
                          <Text style={styles.rowSub}>{a.paymentDate ? formatDate(a.paymentDate) : ''}</Text>
                        </View>
                        <Text style={styles.amount}>{formatCurrency(a.unapplied, 'Rs ')}</Text>
                      </TouchableOpacity>
                    );
                  })}

                  <Text style={styles.section}>Open invoices</Text>
                  {invoices.length === 0 && <Text style={styles.muted}>No open invoices to apply it to.</Text>}
                  {invoices.map(inv => {
                    const over = toNum(amounts[inv.id]) > inv.balance + 0.004;
                    return (
                      <View key={inv.id} style={styles.row}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowTitle}>{inv.invoiceNumber}</Text>
                          <Text style={[styles.rowSub, over && { color: colors.danger }]}>
                            Balance {formatCurrency(inv.balance, 'Rs ')}
                          </Text>
                        </View>
                        <TextInput
                          style={[styles.input, over && { borderColor: colors.danger }]}
                          value={amounts[inv.id] ?? ''}
                          onChangeText={v =>
                            setAmounts(prev => ({ ...prev, [inv.id]: v.replace(/[^0-9.]/g, '') }))
                          }
                          placeholder="0"
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="decimal-pad"
                          accessibilityLabel={`Amount for ${inv.invoiceNumber}`}
                        />
                      </View>
                    );
                  })}

                  <View style={styles.totalRow}>
                    <Text style={styles.rowTitle}>Applying</Text>
                    <Text style={[styles.amount, overAdvance && { color: colors.danger }]}>
                      {formatCurrency(total, 'Rs ')}
                      {selected ? ` of ${formatCurrency(selected.unapplied, 'Rs ')}` : ''}
                    </Text>
                  </View>
                  {overAdvance && <Text style={styles.error}>More than this advance holds.</Text>}
                  {overInvoice && <Text style={styles.error}>An amount is more than the invoice balance.</Text>}
                </>
              )}
              {!!(error || loadError) && <Text style={styles.error}>{error || loadError}</Text>}
            </ScrollView>
          )}

          <View style={styles.footer}>
            <View style={{ flex: 1 }}>
              <CustomButton title="Cancel" onPress={onClose} variant="secondary" size="sm" fullWidth />
            </View>
            <View style={{ flex: 1.4 }}>
              <CustomButton
                title="Apply"
                onPress={submit}
                variant="primary"
                size="sm"
                fullWidth
                isLoading={saving}
                disabled={saving || loading || !selected || total <= 0 || overAdvance || overInvoice}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { ...typography.h4, color: colors.textPrimary },
  body: { padding: spacing.md, gap: spacing.xs },
  muted: { ...typography.bodySm, color: colors.textSecondary },
  section: { ...THEME.form.sectionTitle, marginTop: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowOn: { backgroundColor: colors.primaryTint },
  rowTitle: { ...typography.labelMd, color: colors.textPrimary },
  rowSub: { ...typography.caption, color: colors.textSecondary },
  amount: { ...typography.labelMd, color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  input: {
    width: 110,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    textAlign: 'right',
    ...typography.bodyMd,
    color: colors.textPrimary,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  error: { ...typography.caption, color: colors.danger },
  footer: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});

export default ApplyAdvanceModal;
