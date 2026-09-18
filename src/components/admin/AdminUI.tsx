// ═══════════════════════════════════════════════════════
// FinMatrix — Admin console UI kit
// ═══════════════════════════════════════════════════════
// The four shapes the SuperAdmin console repeats on every screen. Each was
// hand-rolled per screen before this, which is how the console ended up with
// six headers that differed in padding and two stat cards that differed only
// in their animation constants.
//
//   AdminScreenHeader — the console's screen header: white, hairline-ruled,
//                       title + subtitle, optional left and right slots.
//   KpiStatCard       — icon, value, label, optional sub-line and delta.
//                       KpiRow lays them out two-up.
//   DataTableRow      — the roster row: initials avatar, name, meta, and a
//                       trailing value or status pill.
//   StatusPill        — a status word in its canonical colours.
//
// Relationship to components/reports/ReportUI: that kit serves the operator
// app's navy-header screens and this one serves the console's light-header
// screens. They cover similar roles deliberately — a change to one does not
// reach the other, so header and KPI changes need making in both.

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { THEME, statusStyle } from '../../theme';

const { colors, spacing, radius, shadows, typography } = THEME;

// ── Screen header ─────────────────────────────────────
export const AdminScreenHeader: React.FC<{
  title: string;
  subtitle?: string;
  /** Drawer or back control, rendered before the title. */
  left?: React.ReactNode;
  right?: React.ReactNode;
}> = ({ title, subtitle, left, right }) => (
  <View style={s.header}>
    {left}
    <View style={s.headerCenter}>
      <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
      {subtitle ? <Text style={s.headerSub} numberOfLines={1}>{subtitle}</Text> : null}
    </View>
    {right}
  </View>
);

// ── KPI stat card ─────────────────────────────────────
export const KpiStatCard: React.FC<{
  label: string;
  value: number | string;
  icon: keyof typeof Feather.glyphMap;
  subtitle?: string;
  /** Movement since the last period. */
  delta?: { text: string; positive?: boolean };
  /** Defaults to brand teal; pass a semantic colour where the tile means one. */
  accent?: string;
  /** Staggers the entrance so a row of tiles arrives in sequence. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
}> = ({ label, value, icon, subtitle, delta, accent = colors.primary, delay = 0, style }) => {
  // Lazy initial state rather than `useRef(new Animated.Value()).current`:
  // same "created once" behaviour, without reading a ref during render.
  const [scale] = useState(() => new Animated.Value(0.9));
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, tension: 58, friction: 9, delay, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 320, delay, useNativeDriver: true }),
    ]).start();
  }, [delay, opacity, scale]);

  return (
    <Animated.View style={[s.kpiCard, { opacity, transform: [{ scale }] }, style]}>
      <View style={[s.kpiIcon, { backgroundColor: `${accent}18` }]}>
        <Feather name={icon} size={16} color={accent} />
      </View>
      <Text style={s.kpiValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      <Text style={s.kpiLabel} numberOfLines={2}>{label}</Text>
      {subtitle ? <Text style={s.kpiSub} numberOfLines={1}>{subtitle}</Text> : null}
      {delta ? (
        <View style={s.kpiDeltaRow}>
          <Feather
            name={delta.positive ? 'trending-up' : 'trending-down'}
            size={11}
            color={delta.positive ? colors.success : colors.danger}
          />
          <Text style={[s.kpiDelta, { color: delta.positive ? colors.success : colors.danger }]}>
            {delta.text}
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
};

export const KpiRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={s.kpiRow}>{children}</View>
);

// ── Status pill ───────────────────────────────────────
export const StatusPill: React.FC<{ status: string; label?: string }> = ({ status, label }) => {
  const { fg, bg } = statusStyle(status);
  return (
    <View style={[s.pill, { backgroundColor: bg }]}>
      <Text style={[s.pillText, { color: fg }]}>{label ?? status}</Text>
    </View>
  );
};

// ── Roster row ────────────────────────────────────────
export const DataTableRow: React.FC<{
  title: string;
  /** Secondary line under the title. */
  meta?: string;
  /** Two initials in a tinted circle; omit for a row with no avatar. */
  initials?: string;
  /** Right-hand figure. Rendered tabular so a column of them lines up. */
  value?: string;
  status?: string;
  statusLabel?: string;
  onPress?: () => void;
  /** Hides the divider on the last row of a group. */
  last?: boolean;
}> = ({ title, meta, initials, value, status, statusLabel, onPress, last }) => {
  const body = (
    <>
      {initials ? (
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initials.slice(0, 2).toUpperCase()}</Text>
        </View>
      ) : null}
      <View style={s.rowBody}>
        <Text style={s.rowTitle} numberOfLines={1}>{title}</Text>
        {meta ? <Text style={s.rowMeta} numberOfLines={1}>{meta}</Text> : null}
      </View>
      <View style={s.rowTrailing}>
        {value ? <Text style={s.rowValue}>{value}</Text> : null}
        {status ? <StatusPill status={status} label={statusLabel} /> : null}
      </View>
    </>
  );

  return onPress ? (
    <TouchableOpacity
      style={[s.row, last && s.rowLast]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
    >
      {body}
    </TouchableOpacity>
  ) : (
    <View style={[s.row, last && s.rowLast]}>{body}</View>
  );
};

const s = StyleSheet.create({
  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerCenter: { flex: 1 },
  headerTitle: { ...typography.h4, color: colors.textPrimary },
  headerSub: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },

  // ── KPI ──
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiCard: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 150,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.xs,
  },
  kpiIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  // Counts and money both land here, so the digits align down a column.
  kpiValue: { ...typography.h1, color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  kpiLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 3 },
  kpiSub: { ...typography.caption, color: colors.textTertiary, marginTop: 2 },
  kpiDeltaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: spacing.xxs },
  kpiDelta: { ...typography.labelSm, letterSpacing: 0 },

  // ── Status pill ──
  pill: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs / 2,
    borderRadius: radius.xs,
    alignSelf: 'flex-start',
  },
  pillText: { ...typography.labelSm, textTransform: 'capitalize' },

  // ── Roster row ──
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLighter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.labelMd, color: colors.primary },
  rowBody: { flex: 1 },
  rowTitle: { ...typography.labelLg, color: colors.textPrimary },
  rowMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  rowTrailing: { alignItems: 'flex-end', gap: spacing.xxs },
  rowValue: { ...typography.labelLg, color: colors.textPrimary, fontVariant: ['tabular-nums'] },
});
