// ═══════════════════════════════════════════════════════
// FinMatrix — Reports & Hub UI Kit
// Shared, enterprise-grade presentational primitives so every
// report / hub / dashboard surface is visually consistent.
// All tokens come from utils/theme (THEME) — single source of truth.
// ═══════════════════════════════════════════════════════

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Modal,
  ViewStyle,
  StyleProp,
  TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { THEME } from '../../utils/theme';
import { HEADER_NAVY, HEADER_RADIUS } from '../../theme';
import { useAppSelector } from '../../hooks/useReduxHooks';
import { selectActiveCompany } from '../../screens/Auth/companySlice';
import { DEFAULT_COMPANY } from '../../utils/invoicePdf';
import { parenNegative } from './reportFormat';

// Re-exported so every screen has one import site for the reports kit.
export { parenNegative, asOfLabel, rangeLabel, classifyAccount, reconcile } from './reportFormat';
export type { AccountGroup } from './reportFormat';

const T = THEME;

// Re-exported so the reports kit stays one import site; the value itself is a
// token and lives in theme.ts.
export { HEADER_NAVY } from '../../theme';

// Curated accent palette for KPI tiles / chart series — used everywhere
// so a "blue metric" looks the same on every screen.
export const ACCENT = {
  brand: T.colors.primary, // emerald — primary brand
  blue: T.colors.info,
  violet: T.colors.secondary,
  amber: T.colors.warning,
  red: T.colors.danger,
  green: T.colors.success,
  teal: T.colors.primary,
};

export const CHART_SERIES = [
  ACCENT.brand,
  ACCENT.blue,
  ACCENT.violet,
  ACCENT.amber,
  ACCENT.teal,
  ACCENT.red,
];

// ── Screen container ──────────────────────────────────
export const ReportContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <SafeAreaView style={[S.container, { backgroundColor: HEADER_NAVY[0] }]} edges={['top']}>
    <View style={S.container}>
      {children}
    </View>
  </SafeAreaView>
);

// ── Unified header ────────────────────────────────────
// `onBack` → renders the back row (used by detail screens).
// Omit `onBack` for tab-root screens (Reports/Transactions hubs).
// Canonical app-wide back button — a plain `arrow-left` (no box), matching the
// Transactions screens. White on the navy header; `dark` for light surfaces.
export const BackButton: React.FC<{ onPress: () => void; dark?: boolean }> = ({ onPress, dark }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.7}
    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    style={S.backBtn}
  >
    <Feather name="arrow-left" size={24} color={dark ? T.colors.textPrimary : T.colors.neutral0} />
  </TouchableOpacity>
);

export const ReportHeader: React.FC<{
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  right?: React.ReactNode;
}> = ({ title, subtitle, onBack, right }) => (
  <LinearGradient colors={HEADER_NAVY} style={S.header}>
    <StatusBar barStyle="light-content" backgroundColor={HEADER_NAVY[0]} />
    <View style={S.headerRow}>
      {onBack ? <BackButton onPress={onBack} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={S.headerTitle}>{title}</Text>
        {subtitle ? <Text style={S.headerSub}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={S.headerRight}>{right}</View> : null}
    </View>
  </LinearGradient>
);

// Circular icon action used in headers (translucent white on the navy header).
export const HeaderIconButton: React.FC<{ icon: keyof typeof Feather.glyphMap; onPress?: () => void }> = ({
  icon,
  onPress,
}) => (
  <TouchableOpacity style={S.headerBtn} activeOpacity={0.7} onPress={onPress}>
    <Feather name={icon} size={16} color={T.colors.neutral0} />
  </TouchableOpacity>
);

/**
 * THE header create action (ux polish pass): one professional labeled pill —
 * brand-green, plus icon + label — replacing the mix of bare "+" icon
 * buttons, ad-hoc "Add" pills, and "+ New"/"+ Add" buttons that previously
 * varied screen by screen. Spec shared with the in-form AddButton
 * (THEME.form.addPill) so every create affordance in the app is identical.
 */
export const HeaderAction: React.FC<{
  label: string;
  onPress: () => void;
  icon?: keyof typeof Feather.glyphMap;
  disabled?: boolean;
}> = ({ label, onPress, icon = 'plus', disabled }) => (
  <TouchableOpacity
    style={[S.headerAction, disabled && { opacity: 0.5 }]}
    activeOpacity={0.8}
    onPress={onPress}
    disabled={disabled}
  >
    <Feather name={icon} size={THEME.form.addPill.iconSize} color={T.colors.neutral0} />
    <Text style={S.headerActionText}>{label}</Text>
  </TouchableOpacity>
);

/**
 * Width for a financial-table amount column, sized to the LONGEST formatted
 * amount it must display — the professional ledger rule: figures are always
 * shown complete, at full size, never scaled down or clipped. Pair with a
 * horizontal ScrollView around the table so narrow screens pan instead of
 * squeezing the numbers. Heuristic: ~7.3px per character at the bodySm table
 * type size, plus a small buffer; clamped so empty tables keep sane columns.
 */
export const amountColWidth = (formatted: Array<string | null | undefined>): number => {
  const longest = formatted.reduce<number>((m, s) => Math.max(m, (s ?? '').length), 0);
  return Math.min(190, Math.max(88, Math.round(longest * 7.3) + 8));
};

// ── Card surfaces ─────────────────────────────────────
export const Card: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }> = ({
  children,
  style,
  padded = true,
}) => <View style={[S.card, padded && S.cardPad, style]}>{children}</View>;

export const SectionCard: React.FC<{
  title: string;
  subtitle?: string;
  icon?: keyof typeof Feather.glyphMap;
  right?: React.ReactNode;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}> = ({ title, subtitle, icon, right, children, style }) => (
  <View style={[S.card, style]}>
    <View style={S.sectionHead}>
      {icon ? (
        <View style={S.sectionIcon}>
          <Feather name={icon} size={15} color={T.colors.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={S.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={S.sectionSub}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
    <View style={S.sectionDivider} />
    <View style={S.sectionBody}>{children}</View>
  </View>
);

// ── KPI tiles ─────────────────────────────────────────
export type KpiItem = {
  label: string;
  value: string;
  accent?: string;
  icon?: keyof typeof Feather.glyphMap;
  delta?: { text: string; positive?: boolean };
};

export const KpiTile: React.FC<KpiItem & { style?: StyleProp<ViewStyle> }> = ({
  label,
  value,
  accent = ACCENT.brand,
  icon,
  delta,
  style,
}) => (
  <View style={[S.kpiTile, style]}>
    <View style={[S.kpiAccent, { backgroundColor: accent }]} />
    <View style={S.kpiBody}>
      {icon ? (
        <View style={[S.kpiIcon, { backgroundColor: `${accent}14` }]}>
          <Feather name={icon} size={14} color={accent} />
        </View>
      ) : null}
      <Text style={S.kpiValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      <Text style={S.kpiLabel} numberOfLines={2}>
        {label}
      </Text>
      {delta ? (
        <View style={S.kpiDeltaRow}>
          <Feather
            name={delta.positive ? 'trending-up' : 'trending-down'}
            size={11}
            color={delta.positive ? ACCENT.green : ACCENT.red}
          />
          <Text style={[S.kpiDelta, { color: delta.positive ? ACCENT.green : ACCENT.red }]}>
            {delta.text}
          </Text>
        </View>
      ) : null}
    </View>
  </View>
);

// Responsive grid of KPI tiles (2-up by default).
export const KpiGrid: React.FC<{ items: KpiItem[] }> = ({ items }) => (
  <View style={S.kpiGrid}>
    {items.map((it, i) => (
      <KpiTile key={`${it.label}-${i}`} {...it} />
    ))}
  </View>
);

// ── Summary label/value line ──────────────────────────
export const SummaryLine: React.FC<{
  label: string;
  value: string;
  strong?: boolean;
  highlight?: boolean;
  valueColor?: string;
}> = ({ label, value, strong, highlight, valueColor }) => (
  <View style={[S.summaryLine, highlight && S.summaryHighlight]}>
    <Text style={[S.summaryLabel, strong && S.bold, highlight && S.bold]}>{label}</Text>
    <Text
      style={[
        S.summaryValue,
        strong && S.bold,
        highlight && S.bold,
        valueColor ? { color: valueColor } : null,
      ]}
    >
      {value}
    </Text>
  </View>
);

export const Divider: React.FC<{ style?: StyleProp<ViewStyle> }> = ({ style }) => (
  <View style={[S.hr, style]} />
);

// ── Data table primitives ─────────────────────────────
export const tableStyles = {
  head: {
    flexDirection: 'row' as const,
    backgroundColor: T.colors.neutral50,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.colors.border,
  },
  row: {
    flexDirection: 'row' as const,
    paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.colors.borderLight,
  },
  rowAlt: { backgroundColor: T.colors.neutral25 },
  totalRow: {
    flexDirection: 'row' as const,
    paddingVertical: 12,
    backgroundColor: T.colors.primaryLight,
    borderTopWidth: 1,
    borderTopColor: T.colors.border,
  },
};

export const TCell: React.FC<{
  children: React.ReactNode;
  width?: number;
  flex?: number;
  head?: boolean;
  strong?: boolean;
  align?: 'left' | 'center' | 'right';
  color?: string;
}> = ({ children, width, flex, head, strong, align = 'left', color }) => (
  <Text
    numberOfLines={1}
    style={[
      S.cell,
      width != null ? { width } : null,
      flex != null ? { flex } : null,
      { textAlign: align },
      head && S.cellHead,
      strong && S.bold,
      color ? { color } : null,
    ]}
  >
    {children}
  </Text>
);

// ── Status / progress ─────────────────────────────────
export const Badge: React.FC<{ label: string; color?: string; dot?: boolean }> = ({
  label,
  color = T.colors.primary,
  dot = true,
}) => (
  <View style={[S.badge, { backgroundColor: `${color}14`, borderColor: `${color}33` }]}>
    {dot ? <View style={[S.badgeDot, { backgroundColor: color }]} /> : null}
    <Text style={[S.badgeText, { color }]}>{label}</Text>
  </View>
);

export const ProgressBar: React.FC<{ pct: number; color?: string }> = ({ pct, color = T.colors.primary }) => (
  <View style={S.progressBg}>
    <View style={[S.progressFill, { width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: color }]} />
  </View>
);

// ── Segmented control (period pickers) ────────────────
export const Segmented: React.FC<{
  options: string[];
  activeIndex: number;
  onChange: (i: number) => void;
}> = ({ options, activeIndex, onChange }) => (
  <View style={S.segment}>
    {options.map((opt, i) => {
      const active = i === activeIndex;
      return (
        <TouchableOpacity
          key={opt}
          style={[S.segmentBtn, active && S.segmentBtnActive]}
          activeOpacity={0.8}
          onPress={() => onChange(i)}
        >
          <Text style={[S.segmentText, active && S.segmentTextActive]}>{opt}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

// ── Date field (custom calendar — web · iOS · Android) ────────────
// Tapping the field opens an in-app calendar built purely from RN primitives,
// so it works everywhere INCLUDING react-native-web (the native datetimepicker
// has no web implementation). Values are exchanged as `YYYY-MM-DD` strings
// (same contract as before) so callers are unchanged. `onChangeText` keeps the
// legacy name; `onChange` is an alias. By default no future date is selectable
// (`maximumDate` = today) so reports always run up to the current date.
const ISO = 'YYYY-MM-DD';
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const toIsoD = (d: dayjs.Dayjs): string => d.format(ISO);
const parseIsoD = (v?: string): dayjs.Dayjs => {
  const d = v ? dayjs(v, ISO) : dayjs();
  return d.isValid() ? d : dayjs();
};

export const DateField: React.FC<{
  label?: string;
  value: string;
  onChangeText?: (t: string) => void;
  onChange?: (t: string) => void;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  style?: StyleProp<ViewStyle>;
}> = ({ label, value, onChangeText, onChange, placeholder = 'Select date', minimumDate, maximumDate, style }) => {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<dayjs.Dayjs>(() => parseIsoD(value).startOf('month'));

  const min = minimumDate ? dayjs(minimumDate).startOf('day') : null;
  const max = (maximumDate ? dayjs(maximumDate) : dayjs()).startOf('day'); // default: today
  const today = dayjs().startOf('day');

  const commit = (t: string) => {
    onChangeText?.(t);
    onChange?.(t);
  };
  const selected = value && dayjs(value, ISO).isValid() ? dayjs(value, ISO).startOf('day') : null;
  const display = selected ? selected.format('DD MMM YYYY') : '';

  const isDisabled = (d: dayjs.Dayjs) =>
    !!((min && d.isBefore(min, 'day')) || (max && d.isAfter(max, 'day')));

  const openPicker = () => {
    setViewMonth((selected ?? parseIsoD(value)).startOf('month'));
    setOpen(true);
  };
  const pick = (d: dayjs.Dayjs) => {
    if (isDisabled(d)) return;
    commit(toIsoD(d));
    setOpen(false);
  };

  // Build the day grid: leading blanks before the 1st, then each day, padded
  // to whole weeks.
  const firstWeekday = viewMonth.day(); // 0 = Sunday
  const daysInMonth = viewMonth.daysInMonth();
  const cells: (dayjs.Dayjs | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(viewMonth.date(d));
  while (cells.length % 7 !== 0) cells.push(null);

  const prevDisabled = !!(min && viewMonth.isSame(min, 'month'));
  const nextDisabled = !!(max && viewMonth.isSame(max, 'month'));
  const todayDisabled = isDisabled(today);

  return (
    <View style={[{ flex: 1 }, style]}>
      {label ? <Text style={S.fieldLabel}>{label}</Text> : null}
      <TouchableOpacity style={S.fieldWrap} activeOpacity={0.7} onPress={openPicker}>
        <Feather name="calendar" size={15} color={T.colors.primary} style={{ marginRight: 8 }} />
        <Text style={[S.fieldInput, !display && { color: T.colors.textTertiary }]} numberOfLines={1}>
          {display || placeholder}
        </Text>
        <Feather name="chevron-down" size={16} color={T.colors.textTertiary} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={S.calBackdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={S.calCard}>
            <LinearGradient colors={HEADER_NAVY} style={S.calHeader}>
              <TouchableOpacity
                style={[S.calNav, prevDisabled && S.calNavDisabled]}
                disabled={prevDisabled}
                onPress={() => setViewMonth(viewMonth.subtract(1, 'month'))}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="chevron-left" size={20} color={prevDisabled ? 'rgba(255,255,255,0.3)' : T.colors.neutral0} />
              </TouchableOpacity>
              <Text style={S.calMonth}>{viewMonth.format('MMMM YYYY')}</Text>
              <TouchableOpacity
                style={[S.calNav, nextDisabled && S.calNavDisabled]}
                disabled={nextDisabled}
                onPress={() => setViewMonth(viewMonth.add(1, 'month'))}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="chevron-right" size={20} color={nextDisabled ? 'rgba(255,255,255,0.3)' : T.colors.neutral0} />
              </TouchableOpacity>
            </LinearGradient>

            <View style={S.calBody}>
              <View style={S.calWeekRow}>
                {WEEKDAYS.map((w) => (
                  <Text key={w} style={S.calWeekday}>{w}</Text>
                ))}
              </View>
              <View style={S.calGrid}>
                {cells.map((d, i) => {
                  if (!d) return <View key={`blank-${i}`} style={S.calCell} />;
                  const isSel = !!(selected && d.isSame(selected, 'day'));
                  const isToday = d.isSame(today, 'day');
                  const disabled = isDisabled(d);
                  return (
                    <TouchableOpacity
                      key={toIsoD(d)}
                      style={S.calCell}
                      activeOpacity={0.7}
                      disabled={disabled}
                      onPress={() => pick(d)}
                    >
                      <View style={[S.calDay, isSel && S.calDaySel, !isSel && isToday && S.calDayToday]}>
                        <Text
                          style={[
                            S.calDayText,
                            isSel && S.calDayTextSel,
                            disabled && S.calDayTextDisabled,
                          ]}
                        >
                          {d.date()}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={S.calFooter}>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={S.calCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={todayDisabled} onPress={() => pick(today)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={[S.calToday, todayDisabled && { color: T.colors.textTertiary }]}>Today</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// ── Loading / error / empty states ────────────────────
export const LoadingBlock: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <View style={S.stateBlock}>
    <ActivityIndicator size="large" color={T.colors.primary} />
    <Text style={S.stateText}>{label}</Text>
  </View>
);

export const ErrorBlock: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <View style={S.stateBlock}>
    <View style={[S.stateIcon, { backgroundColor: T.colors.dangerLight }]}>
      <Feather name="alert-triangle" size={20} color={T.colors.danger} />
    </View>
    <Text style={S.stateText}>{message}</Text>
    {onRetry ? (
      <TouchableOpacity style={S.retryBtn} onPress={onRetry} activeOpacity={0.8}>
        <Feather name="refresh-cw" size={13} color={T.colors.primary} />
        <Text style={S.retryText}>Retry</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

// `actionLabel`/`onAction` render a centred call-to-action, for the genuine
// first-run zero-state where the empty block is the user's primary route
// forward. Optional — existing callers are unaffected.
export const EmptyBlock: React.FC<{
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ icon = 'inbox', title, hint, actionLabel, onAction }) => (
  <View style={S.stateBlock}>
    <View style={[S.stateIcon, { backgroundColor: T.colors.neutral100 }]}>
      <Feather name={icon} size={20} color={T.colors.textTertiary} />
    </View>
    <Text style={S.stateText}>{title}</Text>
    {hint ? <Text style={S.stateHint}>{hint}</Text> : null}
    {actionLabel && onAction ? (
      <TouchableOpacity style={S.stateAction} onPress={onAction} activeOpacity={0.8}>
        <Feather name="plus" size={THEME.form.addPill.iconSize} color={T.colors.neutral0} />
        <Text style={S.stateActionText}>{actionLabel}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

// ═══════════════════════════════════════════════════════
// Statement primitives — QuickBooks-style formal statements
// ═══════════════════════════════════════════════════════
// These build the statement BODY that sits beneath the navy ReportHeader and
// the KPI tiles. They are presentation only: every figure passed in comes
// straight from the API response, and nothing here recomputes an amount.

/**
 * The name a statement is headed with — the signed-in company, falling back to
 * the invoice/PDF placeholder if none is loaded yet. Read-only.
 */
export const useStatementCompany = (): string => {
  const company = useAppSelector(selectActiveCompany);
  return company?.name?.trim() || DEFAULT_COMPANY.name;
};

/**
 * The block every formal statement opens with: who, what, over what period,
 * and on what basis.
 */
export const ReportTitleBlock: React.FC<{
  company: string;
  report: string;
  periodLabel: string;
  basis?: 'Accrual' | 'Cash';
}> = ({ company, report, periodLabel, basis = 'Accrual' }) => (
  <Card>
    <View style={S.titleBlock}>
      <Text style={S.titleCompany}>{company}</Text>
      <Text style={S.titleReport}>{report}</Text>
      <Text style={S.titlePeriod}>{periodLabel}</Text>
      <Text style={S.titleBasis}>{basis} basis</Text>
    </View>
  </Card>
);

/**
 * One line of a statement. `depth` indents the label so sub-accounts sit under
 * their group; `isTotal` rules off above the amount; `isGrand` is the heavier
 * treatment for TOTAL ASSETS / NET INCOME and the like.
 */
export const StatementRow: React.FC<{
  label: string;
  amount?: number;
  depth?: number;
  bold?: boolean;
  italic?: boolean;
  isTotal?: boolean;
  isGrand?: boolean;
  /** Optional second column, used by the P&L prior-period compare. */
  prior?: number;
  showPrior?: boolean;
  currency?: string;
}> = ({
  label,
  amount,
  depth = 0,
  bold,
  italic,
  isTotal,
  isGrand,
  prior,
  showPrior,
  currency = 'Rs ',
}) => {
  const emphasise = bold || isGrand;
  return (
    <View style={[S.stRow, isTotal && S.stRowTotal, isGrand && S.stRowGrand]}>
      <Text
        style={[
          S.stLabel,
          { paddingLeft: depth * 16 },
          emphasise && S.stEmphasis,
          italic && S.stItalic,
        ]}
        numberOfLines={2}>
        {label}
      </Text>
      <Text style={[S.stAmount, emphasise && S.stEmphasis]}>
        {amount === undefined ? '' : parenNegative(amount, currency)}
      </Text>
      {showPrior ? (
        <Text style={[S.stAmount, emphasise && S.stEmphasis]}>
          {prior === undefined ? '—' : parenNegative(prior, currency)}
        </Text>
      ) : null}
    </View>
  );
};

// Standard scroll content padding for report bodies.
export const reportContentStyle: ViewStyle = {
  padding: T.spacing.md,
  gap: T.spacing.sm + 2,
  paddingBottom: T.spacing.xxxl,
};

// ── Styles ────────────────────────────────────────────
const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.colors.background },

  // Header — navy gradient hero (matches the company dashboard)
  header: {
    paddingHorizontal: T.spacing.md,
    paddingTop: T.spacing.sm + 2,
    paddingBottom: T.spacing.md + 2,
    // Same corner as the auth header (AUTH.header.radius).
    borderBottomLeftRadius: HEADER_RADIUS,
    borderBottomRightRadius: HEADER_RADIUS,
    overflow: 'hidden',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: { marginRight: 4, padding: 2 },
  headerTitle: { ...T.typography.h2, color: T.colors.neutral0 },
  headerSub: { ...T.typography.bodySm, color: 'rgba(255,255,255,0.62)', marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: T.radius.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: THEME.form.addPill.background,
    paddingHorizontal: THEME.form.addPill.paddingHorizontal,
    paddingVertical: THEME.form.addPill.paddingVertical,
    borderRadius: THEME.form.addPill.radius,
  },
  headerActionText: {
    fontFamily: THEME.typography.fontFamily,
    fontSize: THEME.form.addPill.fontSize,
    fontWeight: THEME.form.addPill.fontWeight,
    color: T.colors.neutral0,
  },

  // Card
  card: {
    backgroundColor: T.colors.surface,
    borderRadius: T.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.colors.border,
    overflow: 'hidden',
    ...T.shadows.xs,
  },
  cardPad: { padding: T.spacing.md },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: T.spacing.md,
    paddingTop: T.spacing.md,
    paddingBottom: T.spacing.sm,
    gap: 10,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: T.radius.md,
    backgroundColor: T.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { ...T.typography.h4, color: T.colors.textPrimary },
  sectionSub: { ...T.typography.caption, color: T.colors.textTertiary, marginTop: 1 },
  sectionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: T.colors.borderLight },
  sectionBody: { padding: T.spacing.md },

  // KPI
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: T.spacing.xs + 2 },
  kpiTile: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 150,
    backgroundColor: T.colors.surface,
    borderRadius: T.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.colors.border,
    flexDirection: 'row',
    overflow: 'hidden',
    ...T.shadows.xs,
  },
  kpiAccent: { width: 4 },
  kpiBody: { flex: 1, padding: T.spacing.sm + 2 },
  kpiIcon: {
    width: 28,
    height: 28,
    borderRadius: T.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  kpiValue: { ...T.typography.h3, color: T.colors.textPrimary },
  kpiLabel: { ...T.typography.caption, color: T.colors.textSecondary, marginTop: 2 },
  kpiDeltaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 6 },
  kpiDelta: { ...T.typography.labelSm, letterSpacing: 0 },

  // Summary line
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
  },
  summaryHighlight: {
    backgroundColor: T.colors.primaryLight,
    marginHorizontal: -T.spacing.md,
    paddingHorizontal: T.spacing.md,
    borderRadius: 0,
    marginTop: 4,
  },
  summaryLabel: { ...T.typography.bodyMd, color: T.colors.textPrimary, flex: 1, marginRight: 12 },
  summaryValue: { ...T.typography.bodyMd, color: T.colors.textPrimary },
  bold: { fontWeight: T.typography.h3.fontWeight },
  hr: { height: StyleSheet.hairlineWidth, backgroundColor: T.colors.border, marginVertical: T.spacing.xs },

  // Table
  cell: {
    paddingHorizontal: T.spacing.sm,
    ...T.typography.bodySm,
    color: T.colors.textPrimary,
  },
  cellHead: {
    ...T.typography.labelMd,
    color: T.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // Badge
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: T.radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 5,
    alignSelf: 'flex-start',
  },
  badgeDot: { width: 5, height: 5, borderRadius: 2.5 },
  badgeText: { ...T.typography.labelSm, letterSpacing: 0.2 },

  // Statement primitives
  titleBlock: { alignItems: 'center', gap: 2 },
  titleCompany: { ...T.typography.h4, color: T.colors.textPrimary, textAlign: 'center' },
  titleReport: { ...T.typography.h5, color: T.colors.textPrimary, textAlign: 'center' },
  titlePeriod: { ...T.typography.bodySm, color: T.colors.textSecondary, textAlign: 'center' },
  titleBasis: {
    ...T.typography.caption,
    color: T.colors.textTertiary,
    textAlign: 'center',
    marginTop: 1,
  },

  stRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6, gap: T.spacing.sm },
  stRowTotal: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.colors.border,
    marginTop: 2,
    paddingTop: 8,
  },
  stRowGrand: {
    borderTopWidth: 2,
    borderTopColor: T.colors.textPrimary,
    marginTop: 4,
    paddingTop: 9,
  },
  stLabel: { ...T.typography.bodySm, color: T.colors.textPrimary, flex: 1 },
  stAmount: { ...T.typography.bodySm, color: T.colors.textPrimary, width: 118, textAlign: 'right' },
  stEmphasis: { fontWeight: T.typography.h1.fontWeight },
  stItalic: { fontStyle: 'italic', color: T.colors.textSecondary },

  // Progress
  progressBg: { height: 8, backgroundColor: T.colors.neutral100, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },

  // Segmented
  segment: {
    flexDirection: 'row',
    backgroundColor: T.colors.neutral100,
    borderRadius: T.radius.md,
    padding: 3,
    gap: 3,
  },
  segmentBtn: { flex: 1, paddingVertical: 7, borderRadius: T.radius.sm, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: T.colors.surface, ...T.shadows.xs },
  segmentText: { ...T.typography.labelMd, color: T.colors.textSecondary },
  segmentTextActive: { color: T.colors.primary },

  // Date field
  fieldLabel: { ...T.typography.labelMd, color: T.colors.textSecondary, marginBottom: 6 },
  fieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.colors.neutral50,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.colors.border,
    borderRadius: T.radius.md,
    paddingHorizontal: 12,
    height: 42,
  },
  fieldInput: { flex: 1, ...T.typography.bodyMd, color: T.colors.textPrimary, paddingVertical: 0 },

  // Calendar picker (custom, cross-platform)
  calBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: T.spacing.lg,
    backgroundColor: 'rgba(14,23,38,0.55)',
  },
  calCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: T.colors.surface,
    borderRadius: T.radius.lg,
    overflow: 'hidden',
    ...T.shadows.lg,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: T.spacing.md,
    paddingVertical: T.spacing.md,
  },
  calNav: {
    width: 34,
    height: 34,
    borderRadius: T.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  calNavDisabled: { backgroundColor: 'rgba(255,255,255,0.04)' },
  calMonth: { ...T.typography.h4, color: T.colors.neutral0 },
  calBody: { paddingHorizontal: T.spacing.sm, paddingTop: T.spacing.sm },
  calWeekRow: { flexDirection: 'row', paddingBottom: 6 },
  calWeekday: {
    flex: 1,
    textAlign: 'center',
    ...T.typography.labelSm,
    color: T.colors.textTertiary,
    textTransform: 'uppercase',
  },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  calDay: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDaySel: { backgroundColor: T.colors.primary },
  calDayToday: { borderWidth: 1, borderColor: T.colors.primary },
  calDayText: { ...T.typography.bodyMd, color: T.colors.textPrimary },
  calDayTextSel: { color: T.colors.neutral0, fontWeight: T.typography.h3.fontWeight },
  calDayTextDisabled: { color: T.colors.textTertiary, opacity: 0.4 },
  calFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: T.spacing.md,
    paddingVertical: T.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.colors.borderLight,
  },
  calCancel: { ...T.typography.labelLg, color: T.colors.textTertiary },
  calToday: { ...T.typography.labelLg, color: T.colors.primary, fontWeight: T.typography.h3.fontWeight },

  // States
  stateBlock: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 10 },
  stateIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  stateText: { ...T.typography.bodyMd, color: T.colors.textSecondary, textAlign: 'center' },
  stateHint: { ...T.typography.caption, color: T.colors.textTertiary, textAlign: 'center' },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: T.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.colors.primary + '44',
    backgroundColor: T.colors.primaryLight,
  },
  retryText: { ...T.typography.labelMd, color: T.colors.primary },
  // Same spec as the header create pill, so the two create affordances match.
  stateAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: T.spacing.xxs,
    backgroundColor: THEME.form.addPill.background,
    paddingHorizontal: THEME.form.addPill.paddingHorizontal,
    paddingVertical: THEME.form.addPill.paddingVertical,
    borderRadius: THEME.form.addPill.radius,
  },
  stateActionText: {
    fontFamily: THEME.typography.fontFamily,
    fontSize: THEME.form.addPill.fontSize,
    fontWeight: THEME.form.addPill.fontWeight,
    color: T.colors.neutral0,
  },
});
