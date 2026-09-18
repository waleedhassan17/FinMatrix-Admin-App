// ═══════════════════════════════════════════════════════
// FinMatrix — Tax Liability Screen
// Date range → table: Tax | Collected | Paid | Net
// "Record Payment" CTA → TaxPayment screen
// Enterprise-consistent with Reports / Transactions (ReportUI kit)
// ═══════════════════════════════════════════════════════

import React, { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

import { THEME } from '../../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import {
  fetchTaxLiability,
  setRange,
  selectTaxLiabilityRows,
  selectTaxLiabilityTotals,
  selectTaxLiabilityRange,
  selectTaxLiabilityLoading,
  selectTaxLiabilityError
} from './taxLiabilitySlice';
import type { MoreStackParamList } from '../../../navigators/stacks/MoreStack';
import type { TaxLiabilityRow } from '../../../types';

// Design-system tokens (see src/theme/theme.ts).
const { colors, typography } = THEME;
import {
  ReportContainer,
  ReportHeader,
  Card,
  SectionCard,
  KpiGrid,
  DateField,
  TCell,
  tableStyles,
  LoadingBlock,
  ErrorBlock,
  EmptyBlock,
  ACCENT
} from '../../../components/reports/ReportUI';

type Nav = NativeStackNavigationProp<MoreStackParamList>;

const fmt = (n: number) =>
  (n < 0 ? '-' : '') + 'Rs ' + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 });

const TaxLiabilityScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();

  const rows = useAppSelector(selectTaxLiabilityRows);
  const totals = useAppSelector(selectTaxLiabilityTotals);
  const range = useAppSelector(selectTaxLiabilityRange);
  const isLoading = useAppSelector(selectTaxLiabilityLoading);
  const error = useAppSelector(selectTaxLiabilityError);

  useEffect(() => {
    dispatch(fetchTaxLiability({ from: range.from, to: range.to }));
  }, [dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCalculate = useCallback(() => {
    dispatch(fetchTaxLiability({ from: range.from, to: range.to }));
  }, [dispatch, range]);

  const handleRecordPayment = useCallback(() => {
    navigation.navigate('TaxPayment', undefined);
  }, [navigation]);

  const netColor = (n: number) => (n > 0 ? THEME.colors.danger : n < 0 ? THEME.colors.success : THEME.colors.textSecondary);

  return (
    <ReportContainer>
      <ReportHeader title="Tax Liability" subtitle="Collected vs paid" onBack={() => navigation.goBack()} backLabel="More" />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Date range */}
        <Card>
          <View style={styles.rangeRow}>
            {/* Blank means the full history through today — see the note on
                initialState.range. The placeholders say so, otherwise an empty
                date field reads as something the user forgot to fill in. */}
            <DateField
              label="From"
              value={range.from}
              placeholder="All time"
              onChangeText={v => dispatch(setRange({ from: v, to: range.to }))}
            />
            <DateField
              label="To"
              value={range.to}
              placeholder="Today"
              onChangeText={v => dispatch(setRange({ from: range.from, to: v }))}
            />
          </View>
          <TouchableOpacity style={styles.calcBtn} onPress={handleCalculate} activeOpacity={0.85}>
            <Feather name="refresh-cw" size={14} color={colors.neutral0} />
            <Text style={styles.calcBtnText}>Calculate</Text>
          </TouchableOpacity>
        </Card>

        {isLoading && <LoadingBlock label="Computing liability…" />}
        {!!error && !isLoading && <ErrorBlock message={error} onRetry={handleCalculate} />}

        {!isLoading && rows.length > 0 && (
          <>
            <KpiGrid
              items={[
                { label: 'Collected', value: fmt(totals.collected), accent: ACCENT.brand, icon: 'arrow-down-left' },
                { label: 'Paid', value: fmt(totals.paid), accent: ACCENT.green, icon: 'check-circle' },
                {
                  label: 'Net Due',
                  value: fmt(totals.net),
                  accent: totals.net > 0 ? ACCENT.red : ACCENT.green,
                  icon: totals.net > 0 ? 'alert-circle' : 'check',
                },
              ]}
            />

            <SectionCard title="By Tax" icon="percent">
              <View style={tableStyles.head}>
                <TCell flex={2} head>Tax</TCell>
                <TCell flex={1.3} head align="right">Collected</TCell>
                <TCell flex={1.3} head align="right">Paid</TCell>
                <TCell flex={1.3} head align="right">Net</TCell>
              </View>
              {rows.map((row: TaxLiabilityRow, idx: number) => (
                <View key={row.taxRateId} style={[tableStyles.row, idx % 2 === 1 && tableStyles.rowAlt]}>
                  <View style={{ flex: 2, paddingHorizontal: THEME.spacing.sm }}>
                    <Text style={styles.tdName} numberOfLines={1}>{row.taxName}</Text>
                    <Text style={styles.tdSub}>{row.taxType} · {row.rate}%</Text>
                  </View>
                  <TCell flex={1.3} align="right" color={THEME.colors.primary}>{fmt(row.collected)}</TCell>
                  <TCell flex={1.3} align="right" color={ACCENT.green}>{fmt(row.paid)}</TCell>
                  <TCell flex={1.3} align="right" strong color={netColor(row.net)}>{fmt(row.net)}</TCell>
                </View>
              ))}
              <View style={tableStyles.totalRow}>
                <TCell flex={2} strong>Totals</TCell>
                <TCell flex={1.3} align="right" strong color={THEME.colors.primary}>{fmt(totals.collected)}</TCell>
                <TCell flex={1.3} align="right" strong color={ACCENT.green}>{fmt(totals.paid)}</TCell>
                <TCell flex={1.3} align="right" strong color={netColor(totals.net)}>{fmt(totals.net)}</TCell>
              </View>
            </SectionCard>

            {totals.net > 0 ? (
              <View style={styles.dueBanner}>
                <Feather name="alert-triangle" size={16} color={THEME.colors.warning} />
                <Text style={styles.dueText}>
                  Outstanding tax liability of <Text style={{ fontWeight: typography.labelLg.fontWeight }}>{fmt(totals.net)}</Text>. Consider recording a payment.
                </Text>
              </View>
            ) : (
              <View style={[styles.dueBanner, styles.dueBannerOk]}>
                <Feather name="check-circle" size={16} color={THEME.colors.success} />
                <Text style={[styles.dueText, { color: THEME.colors.success }]}>All tax liabilities are fully paid for this period.</Text>
              </View>
            )}
          </>
        )}

        {!isLoading && rows.length === 0 && !error && (
          <Card>
            <EmptyBlock icon="file-text" title="No data" hint="Set a date range and tap Calculate." />
          </Card>
        )}
      </ScrollView>

      {/* Record Payment CTA */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.recordBtn} onPress={handleRecordPayment} activeOpacity={0.85}>
          <Feather name="credit-card" size={18} color={colors.neutral0} />
          <Text style={styles.recordBtnText}>Record Tax Payment</Text>
        </TouchableOpacity>
      </View>
    </ReportContainer>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { padding: THEME.spacing.md, gap: THEME.spacing.sm + 2, paddingBottom: 110 },

  rangeRow: { flexDirection: 'row', gap: THEME.spacing.sm },
  calcBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.radius.md,
    paddingVertical: 11,
    marginTop: THEME.spacing.sm + 2,
  },
  calcBtnText: { ...THEME.typography.labelLg, color: colors.neutral0 },

  tdName: { ...THEME.typography.labelMd,  color: THEME.colors.textPrimary },
  tdSub: { ...THEME.typography.labelSm, color: THEME.colors.textTertiary, marginTop: 1, letterSpacing: 0 },

  dueBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: THEME.colors.warningLight,
    borderRadius: THEME.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.colors.warning + '40',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  dueBannerOk: { backgroundColor: THEME.colors.successLight, borderColor: THEME.colors.success + '40' },
  dueText: { flex: 1, ...THEME.typography.bodySm, color: THEME.colors.warningHover, lineHeight: 18 },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: THEME.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: THEME.colors.border,
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: 14,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
  },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.radius.lg,
    height: 50,
  },
  recordBtnText: { ...THEME.typography.h5, color: colors.neutral0 }
});

export default TaxLiabilityScreen;
