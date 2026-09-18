// ═══════════════════════════════════════════════════════
// FinMatrix — Shared transaction-list card
//   • TxnCard  — left-status-bordered card: number + subtitle + status
//                badge, an optional meta row, and a Total / secondary row.
// The filter tabs that used to live here are now the app-wide FilterTabs,
// in components/shared/Tabs.tsx.
// ═══════════════════════════════════════════════════════

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { THEME as T } from '../../theme';

const { colors, spacing, radius, shadows, typography } = T;

// Capitalises a raw status key for display (e.g. "partially_received" → "Partially received").
export const titleCase = (s: string): string =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : s;

// ── Card ──────────────────────────────────────────────
export type TxnCardProps = {
  number: string;
  subtitle?: string;
  statusLabel: string;
  statusColor: string;
  metaLeft?: string;
  metaRight?: string;
  primaryLabel: string;
  primaryValue: string;
  secondaryLabel?: string;
  secondaryValue?: string;
  secondaryColor?: string;
  onPress: () => void;
};

export const TxnCard: React.FC<TxnCardProps> = ({
  number,
  subtitle,
  statusLabel,
  statusColor,
  metaLeft,
  metaRight,
  primaryLabel,
  primaryValue,
  secondaryLabel,
  secondaryValue,
  secondaryColor,
  onPress,
}) => (
  <TouchableOpacity
    style={[s.card, { borderLeftWidth: 4, borderLeftColor: statusColor }]}
    activeOpacity={0.6}
    onPress={onPress}
  >
    <View style={s.cardTop}>
      <View style={{ flex: 1, marginRight: spacing.xs }}>
        <Text style={s.cardNumber}>{number}</Text>
        {subtitle ? <Text style={s.cardSub} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <View style={[s.badge, { backgroundColor: statusColor + '18' }]}>
        <Text style={[s.badgeText, { color: statusColor }]}>{statusLabel}</Text>
      </View>
    </View>

    {metaLeft || metaRight ? (
      <View style={s.cardDates}>
        <Text style={s.dateText}>{metaLeft ?? ''}</Text>
        {metaRight ? <Text style={s.dateText}>{metaRight}</Text> : null}
      </View>
    ) : null}

    <View style={s.cardBottom}>
      <View>
        <Text style={s.amtLabel}>{primaryLabel}</Text>
        <Text style={s.amtValue}>{primaryValue}</Text>
      </View>
      {secondaryValue != null ? (
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.amtLabel}>{secondaryLabel}</Text>
          <Text style={[s.amtValue, secondaryColor ? { color: secondaryColor } : null]}>{secondaryValue}</Text>
        </View>
      ) : null}
    </View>
  </TouchableOpacity>
);

const s = StyleSheet.create({
  // Card — matches ReportUI's Card surface (radius, border, elevation).
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.xs,
    ...shadows.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xs },
  cardNumber: { ...typography.labelLg, color: colors.textPrimary },
  cardSub: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2 },
  badge: { paddingHorizontal: spacing.xs, paddingVertical: spacing.xxs, borderRadius: radius.xs },
  // labelSm is the canonical badge-text role (see ReportUI's Badge).
  badgeText: { ...typography.labelSm, letterSpacing: 0.2 },
  cardDates: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  dateText: { ...typography.caption, color: colors.textTertiary },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xs,
  },
  amtLabel: { ...typography.caption, color: colors.textTertiary },
  // Tabular figures so amounts align digit-for-digit down the list.
  amtValue: { ...typography.labelLg, color: colors.textPrimary, fontVariant: ['tabular-nums'] },
});
