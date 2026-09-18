// ═══════════════════════════════════════════════════════
// FinMatrix — Tax rate field
// ═══════════════════════════════════════════════════════
// The tax column of every document line: invoices, estimates, sales orders,
// credit memos, purchase orders, bills and vendor credits.
//
// Tax is typed, never picked. The rate is whatever applies — 0, 10, 12.5, 17 —
// and a fixed list of presets could not express most of them. The rule
// (0–100, at most 4 decimals) is models/taxRate.ts, the same as the server's
// @IsTaxRate and the web's models/taxRate.ts.
//
// One component for every form, because the bill form once reached for its own
// control and the row's columns stopped sharing a top and bottom edge.

import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { THEME } from '../../theme';
import { taxRateError } from '../../models/taxRate';

const { colors, spacing, radius } = THEME;

/**
 * The height every line-item field is drawn at.
 *
 * Explicit rather than padding-derived: a TextInput and a View wrapping a Text
 * do not measure the same on Android even with identical padding, so a row
 * built from both drifts by a few pixels. Exported so the inputs beside this
 * field can be pinned to the same number.
 */
export const FIELD_HEIGHT = 40;

interface TaxFieldProps {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}

// Pure, so slices and tests can use it without importing a component.
export { taxRateError };

/** Keeps digits and a single decimal point, with at most 4 decimals. */
const cleanRate = (raw: string) => {
  const digits = raw.replace(/[^0-9.]/g, '');
  const [whole, ...rest] = digits.split('.');
  return rest.length ? `${whole}.${rest.join('').slice(0, 4)}` : whole;
};

const TaxField: React.FC<TaxFieldProps> = ({ value, onChange, label = 'Tax' }) => {
  const error = taxRateError(value);
  return (
    <View>
      <Text style={styles.label}>{label} %</Text>
      <View style={[styles.field, error ? styles.fieldError : null]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={v => onChange(cleanRate(v))}
          placeholder="0"
          placeholderTextColor={colors.textTertiary}
          keyboardType="decimal-pad"
          accessibilityLabel={`${label} percent`}
        />
        <Text style={styles.suffix}>%</Text>
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    ...THEME.typography.labelSm,
    color: colors.textSecondary,
    marginBottom: spacing.xxs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: FIELD_HEIGHT,
    paddingHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  fieldError: { borderColor: colors.danger },
  input: {
    flex: 1,
    height: FIELD_HEIGHT,
    padding: 0,
    ...THEME.typography.bodyMd,
    color: colors.textPrimary,
  },
  suffix: { ...THEME.typography.bodyMd, color: colors.textSecondary },
  errorText: { ...THEME.typography.labelSm, color: colors.danger, marginTop: spacing.xxs },
});

export default TaxField;
