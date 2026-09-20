// ═══════════════════════════════════════════════════════
// FinMatrix — Edit a plan (Super Admin)
// ═══════════════════════════════════════════════════════
// PATCH /super-admin/plans/:key.
//
// The only screen in the console where an admin action changes what a customer
// is charged, which sets the tone: amounts are typed in rupees but held and
// sent in paisa, the total is derived rather than typed so it cannot disagree
// with the monthly rate, and the sheet states the resulting charge in words
// before it will let you save.

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Alert } from '../../../utils/alert';
import { THEME } from '../../../theme';
import type { SubscriptionPlan, UpdatePlanInput } from '../../../models/superAdminModel';
import { updatePlanAPI, resetPlanAPI } from '../../../networks/billing/superAdminNetwork';

const { colors, radius, spacing, typography } = THEME;

/**
 * Rupees in the field, paisa on the wire.
 *
 * Math.round is the point: 2500.1 typed into a rupee field is 250010 paisa,
 * and the float multiplication gives 250009.99999999997. Truncating that
 * charges a customer a paisa less than the screen showed them.
 */
const toPaisa = (rupees: string): number =>
  Math.round(Number(rupees.replace(/,/g, '')) * 100);

const fmt = (paisa: number, currency = 'PKR'): string =>
  `${currency === 'PKR' ? 'Rs' : currency} ${Math.round(paisa / 100).toLocaleString('en-US')}`;

const EditPlanSheet: React.FC<{
  visible: boolean;
  plan: SubscriptionPlan;
  onClose: () => void;
  onSaved: () => void;
}> = ({ visible, plan, onClose, onSaved }) => {
  const [label, setLabel] = useState(plan.name);
  const [monthly, setMonthly] = useState(
    plan.monthlyMinorUnits ? String(plan.monthlyMinorUnits / 100) : '',
  );
  const [riders, setRiders] = useState(String(plan.deliveryPersonnelLimit ?? 0));
  const [offered, setOffered] = useState(plan.isOffered !== false);
  const [saving, setSaving] = useState(false);

  const months = plan.durationMonths ?? 0;
  const monthlyPaisa = monthly.trim() === '' ? NaN : toPaisa(monthly);
  const monthlyValid = Number.isFinite(monthlyPaisa) && monthlyPaisa >= 0;
  // Derived, never typed. The server enforces total = monthly × duration, so a
  // second field for it could only produce a rejection.
  const totalPaisa = monthlyValid ? monthlyPaisa * months : NaN;

  const ridersNum = riders.trim() === '' ? NaN : Number(riders);
  const ridersValid = Number.isInteger(ridersNum) && ridersNum >= 0;

  const priceChanged = monthlyValid && monthlyPaisa !== plan.monthlyMinorUnits;
  const changed =
    priceChanged ||
    (!!label.trim() && label.trim() !== plan.name) ||
    (ridersValid && ridersNum !== (plan.deliveryPersonnelLimit ?? 0)) ||
    offered !== (plan.isOffered !== false);

  const submit = async () => {
    // Only what changed: the server applies exactly what it receives, so
    // restating an untouched price would overwrite an edit made elsewhere.
    const input: UpdatePlanInput = {};
    if (label.trim() && label.trim() !== plan.name) input.label = label.trim();
    if (priceChanged) {
      input.monthlyMinorUnits = monthlyPaisa;
      input.priceMinorUnits = totalPaisa;
    }
    if (ridersValid && ridersNum !== (plan.deliveryPersonnelLimit ?? 0)) {
      input.deliveryPersonnelLimit = ridersNum;
    }
    if (offered !== (plan.isOffered !== false)) input.isOffered = offered;

    setSaving(true);
    try {
      await updatePlanAPI(plan.id, input);
      onSaved();
      onClose();
      Alert.alert(
        'Plan updated',
        `New customers are now quoted ${fmt(totalPaisa, plan.currency)}.`,
      );
    } catch (e) {
      Alert.alert(
        'Could not update the plan',
        e instanceof Error && e.message ? e.message : 'Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmReset = () => {
    Alert.alert(
      'Reset this plan?',
      `${plan.name} goes back to the price and limits in the server configuration. Companies already on it are unaffected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await resetPlanAPI(plan.id);
              onSaved();
              onClose();
              Alert.alert('Plan reset', `${plan.name} is back to its configured pricing.`);
            } catch (e) {
              Alert.alert(
                'Could not reset the plan',
                e instanceof Error && e.message ? e.message : 'Please try again.',
              );
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={S.overlay}>
        <View style={S.sheet}>
          <Text style={S.title}>Edit {plan.name}</Text>
          <Text style={S.body}>
            Changes apply to new customers immediately. Nobody is re-billed.
          </Text>

          <ScrollView style={S.scroll} nestedScrollEnabled>
            <Text style={S.label}>Display name</Text>
            <TextInput value={label} onChangeText={setLabel} style={S.input} />

            <Text style={S.label}>Monthly price ({plan.currency ?? 'PKR'})</Text>
            <TextInput
              value={monthly}
              onChangeText={setMonthly}
              keyboardType="decimal-pad"
              style={[S.input, monthly.trim() !== '' && !monthlyValid && S.inputError]}
            />
            {monthly.trim() !== '' && !monthlyValid ? (
              <Text style={S.errorText}>Enter a number of rupees, 0 or more.</Text>
            ) : null}

            {/* The derived total, stated plainly. This is what is actually
                charged; the monthly rate is only how it is quoted. */}
            {monthlyValid && months > 0 ? (
              <View style={S.totalBox}>
                <Text style={S.totalTitle}>
                  Charged up front: {fmt(totalPaisa, plan.currency)}
                </Text>
                <Text style={S.totalBody}>
                  {fmt(monthlyPaisa, plan.currency)} × {months} months, billed once.
                </Text>
              </View>
            ) : null}

            <Text style={S.label}>Delivery riders included</Text>
            <TextInput
              value={riders}
              onChangeText={setRiders}
              keyboardType="number-pad"
              style={[S.input, riders.trim() !== '' && !ridersValid && S.inputError]}
            />
            <Text style={S.hint}>The only plan limit the platform enforces.</Text>

            <View style={S.switchRow}>
              <View style={S.switchText}>
                <Text style={S.switchTitle}>Sold to new customers</Text>
                <Text style={S.switchBody}>
                  Turn off to retire the plan. Companies already on it keep it,
                  keep renewing and keep their price.
                </Text>
              </View>
              <Switch value={offered} onValueChange={setOffered} />
            </View>

            <View style={S.note}>
              <Feather name="info" size={14} color={colors.info} />
              <Text style={S.noteText}>
                Duration ({months} months), tier and currency are fixed in the
                server configuration — they are part of what existing customers
                were sold.
              </Text>
            </View>

            {plan.isEdited ? (
              <TouchableOpacity onPress={confirmReset} style={S.resetBtn}>
                <Feather name="rotate-ccw" size={14} color={colors.danger} />
                <Text style={S.resetText}>Reset to configured</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>

          <View style={S.actions}>
            <TouchableOpacity onPress={onClose} style={S.cancel}>
              <Text style={S.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={submit}
              disabled={!changed || !monthlyValid || !ridersValid || saving}
              style={[
                S.save,
                (!changed || !monthlyValid || !ridersValid || saving) && S.saveDisabled,
              ]}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.neutral0} />
              ) : (
                <Text style={S.saveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const S = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.xs,
    maxHeight: '88%',
  },
  scroll: { flexGrow: 0 },
  title: { ...typography.h3, color: colors.textPrimary },
  body: { ...typography.bodySm, color: colors.textSecondary },
  label: { ...typography.labelMd, color: colors.textPrimary, marginTop: spacing.sm },
  hint: { ...typography.labelSm, color: colors.textTertiary, marginTop: spacing.xxs },
  errorText: { ...typography.labelSm, color: colors.danger, marginTop: spacing.xxs },
  input: {
    ...typography.bodyMd,
    color: colors.textPrimary,
    padding: spacing.sm,
    marginTop: spacing.xxs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputError: { borderColor: colors.danger },
  totalBox: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.neutral100,
    gap: spacing.xxs,
  },
  totalTitle: { ...typography.labelMd, color: colors.textPrimary },
  totalBody: { ...typography.bodySm, color: colors.textSecondary },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  switchText: { flex: 1, gap: spacing.xxs },
  switchTitle: { ...typography.labelMd, color: colors.textPrimary },
  switchBody: { ...typography.bodySm, color: colors.textSecondary },
  note: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLighter,
  },
  noteText: { ...typography.bodySm, color: colors.textSecondary, flex: 1 },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  resetText: { ...typography.labelMd, color: colors.danger },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  cancel: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm },
  cancelText: { ...typography.labelMd, color: colors.textSecondary },
  save: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  saveDisabled: { opacity: 0.5 },
  saveText: { ...typography.labelMd, color: colors.neutral0 },
});

export default EditPlanSheet;
