// ═══════════════════════════════════════════════════════
// FinMatrix — Form UI kit (ux.md consistency pass)
// ═══════════════════════════════════════════════════════
// THE single import for form primitives. Nothing here invents a new design
// language — each export is the strongest pattern already in the app, given
// one canonical size/style driven by THEME.form (src/theme/theme.ts):
//
//   FormInput / AmountInput  — CustomInput (48px control, radius 10)
//   FormDropdown             — CustomDropdown (same control spec)
//   FormDatePicker           — ReportUI DateField (web-safe calendar)
//   PrimaryButton/SecondaryButton — CustomButton presets (48px, 600 weight)
//   AddButton                — THE green Add pill (was green on Invoice,
//                              violet on Bill/PO, outlined elsewhere)
//   FormSectionHeader        — dot + uppercase 11px title + optional right slot
//
// Presentation-only: these wrap existing components; behavior (onPress,
// value/onChangeText contracts) is identical to what screens already used.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { THEME } from '../../utils/theme';
import CustomInput from '../../Custom-Components/CustomInput';
import CustomButton from '../../Custom-Components/CustomButton';
import CustomDropdown from '../../Custom-Components/CustomDropdown';
import { DateField } from '../reports/ReportUI';

// ── Canonical primitives (re-exports — one true spec each) ──
export const FormInput = CustomInput;
export const FormDropdown = CustomDropdown;
export const FormDatePicker = DateField;

/** Amount/quantity input: FormInput with the numeric keyboard preset. */
export const AmountInput: React.FC<React.ComponentProps<typeof CustomInput>> = (
  props,
) => <CustomInput keyboardType="numeric" {...props} />;

/** Full-width 48px brand-green submit button (spinner + disabled handled). */
export const PrimaryButton: React.FC<{
  title: string;
  onPress: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}> = ({ title, onPress, isLoading, disabled, icon }) => (
  <CustomButton
    title={title}
    onPress={onPress}
    isLoading={isLoading}
    disabled={disabled}
    icon={icon}
    variant="primary"
    fullWidth
  />
);

/** Full-width 48px outlined companion button (Cancel / Save Draft). */
export const SecondaryButton: React.FC<{
  title: string;
  onPress: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}> = ({ title, onPress, isLoading, disabled, icon }) => (
  <CustomButton
    title={title}
    onPress={onPress}
    isLoading={isLoading}
    disabled={disabled}
    icon={icon}
    variant="secondary"
    fullWidth
  />
);

/**
 * THE green Add pill — identical size, colour, and typography everywhere an
 * "add a line/item/row" action appears (THEME.form.addPill).
 */
export const AddButton: React.FC<{
  label: string;
  onPress: () => void;
  disabled?: boolean;
}> = ({ label, onPress, disabled }) => (
  <TouchableOpacity
    style={[styles.addPill, disabled && styles.addPillDisabled]}
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.7}
  >
    <Feather name="plus" size={THEME.form.addPill.iconSize} color={THEME.colors.neutral0} />
    <Text style={styles.addPillText}>{label}</Text>
  </TouchableOpacity>
);

/**
 * Section header used by the document forms (dot + uppercase title), with an
 * optional right-side slot (usually an AddButton).
 */
export const FormSectionHeader: React.FC<{
  title: string;
  dotColor?: string;
  right?: React.ReactNode;
  style?: object;
}> = ({ title, dotColor, right, style }) => (
  <View style={[styles.sectionHeader, style]}>
    <View style={styles.sectionLeft}>
      <View
        style={[
          styles.sectionDot,
          { backgroundColor: dotColor ?? THEME.form.sectionDot.color },
        ]}
      />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    {right}
  </View>
);

const styles = StyleSheet.create({
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: THEME.form.addPill.paddingHorizontal,
    paddingVertical: THEME.form.addPill.paddingVertical,
    backgroundColor: THEME.form.addPill.background,
    borderRadius: THEME.form.addPill.radius,
  },
  addPillDisabled: { opacity: 0.5 },
  addPillText: {
    fontFamily: THEME.typography.fontFamily,
    fontSize: THEME.form.addPill.fontSize,
    fontWeight: THEME.form.addPill.fontWeight,
    color: THEME.colors.neutral0,
  },
  // marginTop as well as marginBottom: the header had space under it but none
  // above, so it sat flush against the card belonging to the section before
  // it. That is invisible on a title alone, but these headers carry an Add
  // pill on the right which is nearly three times the title's height — so the
  // pill came within a couple of pixels of the card above it.
  //
  // The three forms using this carried the same value as scrollContent
  // paddingTop and now start at 0; the first header's own margin supplies it,
  // so the top of each form is unchanged and only the gap between sections
  // grows.
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
  },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionDot: {
    width: THEME.form.sectionDot.size,
    height: THEME.form.sectionDot.size,
    borderRadius: THEME.form.sectionDot.size / 2,
  },
  sectionTitle: { ...THEME.form.sectionTitle },
});
