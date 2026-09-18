// ═══════════════════════════════════════════════════════
// FinMatrix — Payment Recorded (receipt)
// ═══════════════════════════════════════════════════════
// Replaces the blocking "Payment Recorded" alert that used to fire on the Pay
// Bills screen. An alert can only say a number; a payment posts a journal
// entry against real accounts, and the user deserves to see WHAT was applied
// to WHICH bill and what each bill still owes.
//
// Reached via navigation.replace, so Back cannot return to a filled-in Pay
// Bills form and post the same payment twice.

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

import { THEME } from '../../../utils/theme';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import CustomButton from '../../../Custom-Components/CustomButton';
import { ReportContainer } from '../../../components/reports/ReportUI';
import type { TransactionsStackParamList } from '../../../navigators/stacks/TransactionsStack';

type Nav = NativeStackNavigationProp<TransactionsStackParamList>;
type ScreenRoute = RouteProp<TransactionsStackParamList, 'PaymentSuccess'>;

const { colors, radius, shadows, spacing } = THEME;

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash',
  cheque: 'Cheque',
  bank_transfer: 'Bank Transfer',
  card: 'Card',
  online: 'Online',
};

const PaymentSuccessScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<ScreenRoute>();
  const { amount, creditApplied = 0, vendorName, accountName, paymentDate, reference, method, billId, lines } = params;

  const settled = lines.filter(l => l.remaining <= 0.005).length;

  return (
    <ReportContainer>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.tick}>
            <Feather name="check" size={30} color={THEME.colors.neutral0} />
          </View>
          <Text style={styles.amount}>{formatCurrency(amount + creditApplied, 'Rs ')}</Text>
          <Text style={styles.heroSub}>settled with {vendorName}</Text>
          {creditApplied > 0 && (
            <Text style={styles.creditSplit}>
              {formatCurrency(amount, 'Rs ')} cash · {formatCurrency(creditApplied, 'Rs ')} vendor credit
            </Text>
          )}
        </View>

        {/* The journal entry in plain words — the user should never have to
            open the ledger to know what their action did. */}
        <View style={styles.card}>
          <Row label="Paid from" value={accountName || '—'} />
          <Row label="Date" value={formatDate(paymentDate)} />
          <Row label="Method" value={METHOD_LABEL[method] ?? method} />
          <Row label="Reference" value={reference || '—'} />
          {/* Only a cash payment carries one. A settlement funded entirely
              from vendor credit posts nothing and needs no proof. */}
          {amount > 0 && <Row label="Proof" value="Attached" />}
          <View style={styles.divider} />
          <Text style={styles.postedNote}>
            {amount > 0
              ? `Posted as a debit to Accounts Payable and a credit to ${accountName || 'the payment account'}.`
              : 'Settled entirely from vendor credit — no cash left your accounts, and no new journal entry was needed.'}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>APPLIED TO</Text>
        <View style={styles.card}>
          {lines.map((l, i) => (
            <View key={`${l.billNumber}-${i}`} style={[styles.billRow, i > 0 && styles.billRowBordered]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.billNumber}>{l.billNumber}</Text>
                <Text style={styles.billRemaining}>
                  {l.remaining <= 0.005
                    ? 'Fully paid'
                    : `${formatCurrency(l.remaining, 'Rs ')} still due`}
                </Text>
              </View>
              <Text style={styles.billApplied}>{formatCurrency(l.applied, 'Rs ')}</Text>
            </View>
          ))}
          {settled > 0 && (
            <Text style={styles.settledNote}>
              {settled} bill{settled === 1 ? '' : 's'} fully settled.
            </Text>
          )}
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      <View style={styles.actions}>
        <View style={styles.actionSecondary}>
          <CustomButton
            title="Pay another"
            onPress={() => navigation.replace('PayBills')}
            variant="secondary"
            size="sm"
            fullWidth
          />
        </View>
        <View style={styles.actionPrimary}>
          {/* Back to where the task started: the bill if they came from one,
              otherwise the bills list. Never a dead end.

              popTo, not replace. The user almost always arrives here from that
              bill's own detail screen, so replace() built a SECOND BillDetail
              on top of the first — Back then landed on a stale copy of the
              same bill instead of the purchase order behind it. popTo unwinds
              to the one already in the stack (refreshing its params), and adds
              it if they paid from somewhere else.

              This still cannot return to a filled-in Pay Bills form and post
              the payment twice: PayBills was replaced by this screen, so it is
              no longer in the stack to pop back to. */}
          <CustomButton
            title={billId ? 'View bill' : 'Done'}
            onPress={() =>
              billId
                ? navigation.popTo('BillDetail', { billId })
                : navigation.popTo('BillList')
            }
            variant="primary"
            size="sm"
            fullWidth
          />
        </View>
      </View>
    </ReportContainer>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
  </View>
);

export default PaymentSuccessScreen;

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  hero: { alignItems: 'center', paddingVertical: spacing.xxl },
  tick: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.success,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  amount: { ...THEME.typography.h1, color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  creditSplit: { ...THEME.typography.caption, color: colors.textSecondary, marginTop: 4 },
  heroSub: { ...THEME.typography.bodyMd, color: colors.textSecondary, marginTop: 2 },

  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.xs,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowLabel: { ...THEME.typography.bodySm, color: colors.textSecondary },
  rowValue: { ...THEME.typography.labelMd, color: colors.textPrimary },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  postedNote: { ...THEME.typography.caption, color: colors.textSecondary, lineHeight: 17 },

  sectionTitle: { ...THEME.form.sectionTitle, marginBottom: spacing.xs },
  billRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  billRowBordered: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  billNumber: { ...THEME.typography.labelLg, color: colors.textPrimary },
  billRemaining: { ...THEME.typography.caption, color: colors.textSecondary, marginTop: 1 },
  billApplied: { ...THEME.typography.labelLg, color: colors.success, fontVariant: ['tabular-nums'] },
  settledNote: { ...THEME.typography.caption, color: colors.textSecondary, marginTop: spacing.xs },

  actions: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: THEME.colors.surface,
  },
  actionSecondary: { flex: 1 },
  actionPrimary: { flex: 1.4 },
});
