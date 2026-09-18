// ═══════════════════════════════════════════════════════
// FinMatrix — Tax Payment Screen
// Record a tax payment: select rate, amount, date, reference
// Enterprise-consistent with Reports / Transactions (ReportUI kit)
// ═══════════════════════════════════════════════════════

import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Alert } from '../../../utils/alert';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

import { THEME } from '../../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import {
  loadTaxPaymentDeps,
  setFormField,
  resetForm,
  initForTaxRate,
  submitTaxPayment,
  selectTaxPaymentForm,
  selectTaxPaymentRates,
  selectTaxPaymentLoading,
  selectTaxPaymentSaving,
  selectTaxPaymentError,
  selectTaxPaymentSaved
} from './taxPaymentSlice';
import type { MoreStackParamList } from '../../../navigators/stacks/MoreStack';
import type { TaxRate } from '../../../types';

// Design-system tokens (see src/theme/theme.ts).
const { colors } = THEME;
import {
  ReportContainer,
  ReportHeader,
  Card,
  SectionCard,
  SummaryLine,
  LoadingBlock,
  DateField
} from '../../../components/reports/ReportUI';

type Nav = NativeStackNavigationProp<MoreStackParamList>;
type Route = RouteProp<MoreStackParamList, 'TaxPayment'>;

const FieldLabel: React.FC<{ label: string; required?: boolean }> = ({ label, required }) => (
  <Text style={styles.fieldLabel}>
    {label}
    {required && <Text style={{ color: THEME.colors.danger }}> *</Text>}
  </Text>
);

function SelectStrip<T extends { id: string }>({
  items,
  selectedId,
  onSelect,
  label,
  sublabel
}: {
  items: T[];
  selectedId: string;
  onSelect: (id: string) => void;
  label: (item: T) => string;
  sublabel?: (item: T) => string;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stripScroll}>
      {items.map(item => {
        const selected = item.id === selectedId;
        return (
          <TouchableOpacity
            key={item.id}
            style={[styles.stripChip, selected && styles.stripChipSelected]}
            onPress={() => onSelect(item.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.stripChipText, selected && styles.stripChipTextSelected]}>{label(item)}</Text>
            {sublabel && (
              <Text style={[styles.stripChipSub, selected && { color: THEME.colors.primary }]}>{sublabel(item)}</Text>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const TaxPaymentScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const dispatch = useAppDispatch();

  const form = useAppSelector(selectTaxPaymentForm);
  const rates = useAppSelector(selectTaxPaymentRates);
  const isLoading = useAppSelector(selectTaxPaymentLoading);
  const isSaving = useAppSelector(selectTaxPaymentSaving);
  const error = useAppSelector(selectTaxPaymentError);
  const saved = useAppSelector(selectTaxPaymentSaved);

  const preselectedRateId = (route.params as { taxRateId?: string } | undefined)?.taxRateId;

  useEffect(() => {
    dispatch(resetForm());
    dispatch(loadTaxPaymentDeps()).then(() => {
      if (preselectedRateId) dispatch(initForTaxRate(preselectedRateId));
    });
  }, [dispatch, preselectedRateId]);

  useEffect(() => {
    if (saved) {
      Alert.alert('Payment Recorded', 'The tax payment has been recorded successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  }, [saved, navigation]);

  const handleSubmit = useCallback(() => {
    if (!form.taxRateId) {
      Alert.alert('Validation', 'Please select a tax rate.');
      return;
    }
    const amount = parseFloat(form.amount);
    if (!form.amount || isNaN(amount) || amount <= 0) {
      Alert.alert('Validation', 'Please enter a valid payment amount greater than 0.');
      return;
    }
    if (!form.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Validation', 'Date must be in YYYY-MM-DD format.');
      return;
    }
    dispatch(submitTaxPayment());
  }, [dispatch, form]);

  const selectedRate = rates.find(r => r.id === form.taxRateId);

  if (isLoading) {
    return (
      <ReportContainer>
        <ReportHeader title="Record Tax Payment" subtitle="Submit to tax authority" onBack={() => navigation.goBack()} backLabel="Back" />
        <LoadingBlock label="Loading options…" />
      </ReportContainer>
    );
  }

  return (
    <ReportContainer>
      <ReportHeader title="Record Tax Payment" subtitle="Submit to tax authority" onBack={() => navigation.goBack()} backLabel="Back" />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {!!error && (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={14} color={THEME.colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Card>
            <FieldLabel label="Tax Rate" required />
            <SelectStrip<TaxRate>
              items={rates}
              selectedId={form.taxRateId}
              onSelect={id => dispatch(setFormField({ taxRateId: id }))}
              label={r => r.name}
              sublabel={r => `${r.rate}% · ${r.taxType}`}
            />
            {selectedRate?.description ? (
              <View style={styles.selectedInfo}>
                <Feather name="info" size={12} color={THEME.colors.primary} />
                <Text style={styles.selectedInfoText}>{selectedRate.description}</Text>
              </View>
            ) : null}

            <View style={styles.divider} />

            {/* One bordered container with the currency inside it, the same
                shape as the Reference field below. It used to be two boxes
                glued together -- a tinted prefix with a GREEN border (a
                leftover from the old brand) butted against a grey-bordered
                input, with the radii zeroed to hide the seam. Two borders that
                do not match cannot be hidden that way, which is what made it
                look unfinished. */}
            <FieldLabel label="Amount" required />
            <View style={styles.amountField}>
              <Text style={styles.currencyText}>Rs</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor={THEME.colors.textTertiary}
                keyboardType="decimal-pad"
                value={form.amount}
                onChangeText={v => dispatch(setFormField({ amount: v }))}
              />
            </View>

            <View style={styles.divider} />

            {/* FieldLabel, not DateField's own label prop: FieldLabel draws
                the required asterisk in danger red, while a label passed as
                "Payment Date *" renders the asterisk in the ordinary label
                colour -- so this one field's marker did not match the two
                above it. */}
            <FieldLabel label="Payment Date" required />
            <DateField
              value={form.date}
              onChangeText={v => dispatch(setFormField({ date: v }))}
            />

            <View style={styles.divider} />

            <FieldLabel label="Reference / Challan No." />
            <View style={styles.inputWithIcon}>
              <Feather name="hash" size={15} color={THEME.colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={[styles.fieldInput, styles.inputWithIconField]}
                placeholder="e.g. FBR-Q1-2026-001"
                placeholderTextColor={THEME.colors.textTertiary}
                value={form.reference}
                onChangeText={v => dispatch(setFormField({ reference: v }))}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>

            <View style={styles.divider} />

            <FieldLabel label="Notes" />
            <TextInput
              style={[styles.fieldInput, styles.notesInput]}
              placeholder="Optional notes about this payment"
              placeholderTextColor={THEME.colors.textTertiary}
              value={form.notes}
              onChangeText={v => dispatch(setFormField({ notes: v }))}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </Card>

          {form.taxRateId && form.amount && parseFloat(form.amount) > 0 && (
            <SectionCard title="Payment Summary" icon="check-circle">
              <SummaryLine label="Tax Rate" value={selectedRate?.name ?? '—'} />
              <SummaryLine
                label="Amount"
                value={`Rs ${parseFloat(form.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                strong
                valueColor={THEME.colors.primary}
              />
              <SummaryLine label="Date" value={form.date} />
              {form.reference ? <SummaryLine label="Reference" value={form.reference} /> : null}
            </SectionCard>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitBtn, isSaving && { opacity: 0.7 }]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.neutral0} size="small" />
            ) : (
              <>
                <Feather name="check" size={18} color={colors.neutral0} />
                <Text style={styles.submitBtnText}>Record Payment</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ReportContainer>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { padding: THEME.spacing.md, gap: THEME.spacing.sm + 2, paddingBottom: 20 },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.dangerLight,
    borderRadius: THEME.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.colors.danger + '40',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: { flex: 1, ...THEME.typography.bodySm, color: THEME.colors.danger },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: THEME.colors.borderLight, marginVertical: THEME.spacing.md },

  fieldLabel: { ...THEME.typography.labelMd, color: THEME.colors.textSecondary, marginBottom: 8 },

  stripScroll: { marginBottom: 4 },
  stripChip: {
    backgroundColor: THEME.colors.neutral50,
    borderRadius: THEME.radius.md,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    alignItems: 'center',
  },
  stripChipSelected: { backgroundColor: THEME.colors.primaryLight, borderColor: THEME.colors.primary },
  stripChipText: { ...THEME.typography.labelMd,  color: THEME.colors.textSecondary },
  stripChipTextSelected: { color: THEME.colors.primary },
  stripChipSub: { ...THEME.typography.overline, color: THEME.colors.textTertiary, marginTop: 2 },

  selectedInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: THEME.colors.primaryLight,
    borderRadius: THEME.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 8,
  },
  selectedInfoText: { flex: 1, ...THEME.typography.labelSm, color: THEME.colors.primaryHover, letterSpacing: 0 },

  fieldInput: {
    backgroundColor: THEME.colors.neutral50,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    ...THEME.typography.bodyMd,
    color: THEME.colors.textPrimary,
  },
  // The amount is what this screen is for, so it is the one field drawn at
  // figure size: h3, tabular so digits line up as they are typed.
  amountField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.neutral50,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 12,
  },
  currencyText: { ...THEME.typography.labelLg, color: THEME.colors.textSecondary },
  amountInput: {
    flex: 1,
    paddingVertical: 11,
    ...THEME.typography.h3,
    color: THEME.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.neutral50,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
  },
  inputIcon: { paddingLeft: 12 },
  inputWithIconField: { flex: 1, borderWidth: 0, backgroundColor: 'transparent', borderRadius: 0 },
  notesInput: { minHeight: 78 },

  footer: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: THEME.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: THEME.colors.border,
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: 14,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: THEME.radius.md,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { ...THEME.typography.h5, color: THEME.colors.textSecondary },
  submitBtn: {
    flex: 2,
    height: 48,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitBtnText: { ...THEME.typography.h5, color: colors.neutral0 }
});

export default TaxPaymentScreen;
