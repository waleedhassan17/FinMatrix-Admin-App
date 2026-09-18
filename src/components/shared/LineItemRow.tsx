// ═══════════════════════════════════════════════════════
// FinMatrix — Reusable Line Item Row Component
// Used in Invoice / Credit Memo / Estimate / Sales Order forms.
// Auto-calculates line amount = qty × unitPrice.
// ═══════════════════════════════════════════════════════

import React, { useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { THEME } from '../../theme';
import { formatCurrency } from '../../utils/formatters';
import TaxField, { FIELD_HEIGHT } from '../form/TaxField';

// Design-system tokens (see src/theme/theme.ts).
const { colors, spacing, radius } = THEME;

export interface LineItemRowProps {
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
  lineAmount: number;
  onDescriptionChange: (v: string) => void;
  onQuantityChange: (v: string) => void;
  onUnitPriceChange: (v: string) => void;
  onTaxRateChange: (v: string) => void;
  onDelete: () => void;
  canDelete: boolean;
  index: number;
  /**
   * Rendered inside the card, under the "Item N" header.
   *
   * The invoice form has an inventory picker per line. It used to sit beside
   * this component rather than in it, so the control that chooses what the
   * line IS floated on the bare canvas above the card holding everything else
   * about that line.
   */
  topSlot?: React.ReactNode;
}

const LineItemRow: React.FC<LineItemRowProps> = ({
  description,
  quantity,
  unitPrice,
  taxRate,
  lineAmount,
  onDescriptionChange,
  onQuantityChange,
  onUnitPriceChange,
  onTaxRateChange,
  onDelete,
  canDelete,
  index,
  topSlot,
}) => {
  const sanitizeNumeric = useCallback(
    (v: string, cb: (s: string) => void) => {
      cb(v.replace(/[^0-9.]/g, ''));
    },
    [],
  );

  // Ledger rule: the complete number must always be visible at full size.
  // Static minimums aren't enough for big figures, so each column GROWS
  // with its own value (~9px per digit at bodyMd + field padding) and the
  // row pans horizontally when the grown columns exceed the screen width.
  //
  // The floors are sized against the NARROWEST container this row lives in,
  // which is the sales-order form: 360 screen − 32 page − 32 SectionCard body
  // − 20 this card's padding = 276dp. The old floors (84 / 132 / 96 plus two
  // 8px gaps = 328) blew past that by 52dp, so the row silently scrolled and
  // the tax column's right border sat off-screen — it read as a field with one
  // side missing. 58 + 80 + 74 + 16 = 228 fits there and still fits a 320dp
  // screen. Columns are flex:1, so on any wider card they expand to fill it
  // and nothing looks narrower than before.
  const qtyWidth = Math.max(58, quantity.length * 9 + 30);
  const rateWidth = Math.max(80, unitPrice.length * 9 + 30);

  return (
    <View style={styles.container}>
      {/* Row header */}
      <View style={styles.headerRow}>
        <Text style={styles.lineLabel}>Item {index + 1}</Text>
        {canDelete && (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel={`Remove item ${index + 1}`}
          >
            <Feather name="x" size={14} color={colors.danger} />
          </TouchableOpacity>
        )}
      </View>

      {topSlot}

      {/* Description */}
      <TextInput
        style={styles.descInput}
        value={description}
        onChangeText={onDescriptionChange}
        placeholder="Item description"
        placeholderTextColor={colors.textTertiary}
      />

      {/* Qty + Rate + Tax row — all three columns share identical
          label typography and field height for visual consistency.
          Ledger rule applied to inputs too: columns keep a usable minimum
          width and the row PANS horizontally on narrow screens instead of
          squeezing the fields into each other. On wide screens the columns
          grow to fill the card and nothing changes visually. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.numericScroll}
      >
        <View style={styles.numericRow}>
          <View style={[styles.numericField, { minWidth: qtyWidth }]}>
            <Text style={styles.fieldLabel}>Qty</Text>
            <TextInput
              style={styles.numericInput}
              value={quantity}
              onChangeText={v => sanitizeNumeric(v, onQuantityChange)}
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={[styles.numericField, { minWidth: rateWidth }]}>
            <Text style={styles.fieldLabel}>Rate</Text>
            <TextInput
              style={styles.numericInput}
              value={unitPrice}
              onChangeText={v => sanitizeNumeric(v, onUnitPriceChange)}
              placeholder="0.00"
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={[styles.numericField, styles.colTax]}>
            <TaxField value={taxRate} onChange={onTaxRateChange} />
          </View>
        </View>
      </ScrollView>

      {/* Calculated amount */}
      <View style={styles.amountRow}>
        <Text style={styles.amountLabel}>Line Total</Text>
        <Text style={styles.amountValue}>{formatCurrency(lineAmount, 'Rs ')}</Text>
      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.xs + 2,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxs,
  },
  lineLabel: {
    ...THEME.typography.labelMd,
    color: colors.textSecondary,
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.danger + '14',
    justifyContent: 'center',
    alignItems: 'center',
  },
  descInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    ...THEME.typography.bodyMd,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  numericScroll: { minWidth: '100%' },
  numericRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexGrow: 1,
  },
  numericField: { flex: 1 },
  colTax: { minWidth: 74 },
  fieldLabel: {
    ...THEME.typography.labelSm,
    color: colors.textSecondary,
    marginBottom: spacing.xxs,
  },
  // FIELD_HEIGHT, not vertical padding: the tax control beside these is a View
  // wrapping a Text, and Android does not measure that the same as a TextInput
  // given identical padding. Pinning both to one number is what actually puts
  // the three columns on a shared baseline.
  numericInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    height: FIELD_HEIGHT,
    paddingHorizontal: spacing.xs,
    paddingVertical: 0,
    ...THEME.typography.bodyMd,
    color: colors.textPrimary,
    textAlign: 'right',
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  amountLabel: {
    ...THEME.typography.labelMd,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  // The figure never shrinks or clips — the label gives way instead.
  amountValue: {
    ...THEME.typography.h4,
    fontVariant: ['tabular-nums'],
    color: colors.actionGreen,
    flexShrink: 0,
    marginLeft: spacing.xs,
  },

});

export default React.memo(LineItemRow);
