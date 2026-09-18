// ═══════════════════════════════════════════════════════
// FinMatrix — Revenue trend card
// ═══════════════════════════════════════════════════════
// Live monthly revenue from the analytics report. Bars are plain views rather
// than a chart library so the card sits on exactly the same surface, radius
// and ink scale as every other card on the dashboard. Tapping a month
// promotes it into the headline figure.
//
// Lifted out of AdminDashboardScreen (which was over a thousand lines) so it
// can be rendered on its own in a test — importing the whole screen pulled in
// expo-font, react-redux and immer, none of which transform under this repo's
// jest preset.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';

import type { TrendPoint } from '../../models/analyticsDashboardModel';
import { C, FONT, card, compactRs } from './dashboardTheme';
import { THEME } from '../../theme';

// Design-system tokens (see src/theme/theme.ts).
const { typography } = THEME;

// Plotting height of the revenue chart (bars only — labels sit below it).
export const BAR_AREA = 92;
/** How many calendar months the chart draws, newest on the right. Fixed, so
 *  bar width never depends on how much history the company happens to have. */
export const WINDOW_MONTHS = 5;

// Trend labels arrive as 'Aug 26'; the headline spells the month out.
const MONTH_NAMES: Record<string, string> = {
  jan: 'January', feb: 'February', mar: 'March', apr: 'April',
  may: 'May', jun: 'June', jul: 'July', aug: 'August',
  sep: 'September', oct: 'October', nov: 'November', dec: 'December'
};
const monthKey = (label: string): string => label.trim().slice(0, 3).toLowerCase();
const fullMonth = (label: string): string => MONTH_NAMES[monthKey(label)] ?? label;
const isCurrentMonth = (label: string): boolean =>
  monthKey(label) === monthKey(new Date().toLocaleDateString('en-US', { month: 'short' }));
/** The month after `label`, spelled out. Falls back to a neutral phrase if the
 *  label is not one we recognise, so the copy never reads "undefined". */
const MONTH_ORDER = Object.keys(MONTH_NAMES);
const nextMonthLabel = (label: string): string => {
  const i = MONTH_ORDER.indexOf(monthKey(label));
  return i === -1 ? 'next month' : MONTH_NAMES[MONTH_ORDER[(i + 1) % 12]];
};

/** Two-digit year out of a label like 'Aug 26' or 'Aug 2026'; null when the
 *  label carries no year at all. */
const yearKey = (label: string): string | null => {
  const m = label.match(/\b(\d{4})\b|\b(\d{2})\b/);
  if (!m) return null;
  return (m[1] ?? m[2]).slice(-2);
};

export type RevenueSlot = {
  key: string;
  /** 'Aug 26' — spoken by the accessibility label. */
  label: string;
  /** 'Aug' — drawn under the bar. */
  short: string;
  point?: TrendPoint;
};

/**
 * The last WINDOW_MONTHS calendar months, oldest first, each carrying its
 * revenue point if the API sent one.
 *
 * Matching is by month, with the year only checked when the label carries
 * one: a window this short cannot contain the same month twice, so the month
 * alone identifies a slot, and labels that arrive without a year still land.
 */
export const buildRevenueWindow = (points: TrendPoint[]): RevenueSlot[] => {
  const now = new Date();
  return Array.from({ length: WINDOW_MONTHS }, (_, n) => {
    const i = WINDOW_MONTHS - 1 - n;
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const short = d.toLocaleDateString('en-US', { month: 'short' });
    const yy = String(d.getFullYear() % 100).padStart(2, '0');
    const mk = monthKey(short);
    return {
      key: `${mk}-${yy}`,
      label: `${short} ${yy}`,
      short,
      point: points.find(p => {
        if (monthKey(p.label) !== mk) return false;
        const py = yearKey(p.label);
        return py === null || py === yy;
      })
    };
  });
};

export const RevenueTrendCard: React.FC<{ points: TrendPoint[] | null }> = ({ points }) => {
  const [picked, setPicked] = useState<number | null>(null);

  // A fixed trailing window, not "however many months the API happened to
  // return". The API only sends months that HAVE revenue, so a company in its
  // first month got a one-item series — one bar stretched edge to edge, at
  // full height because it was its own maximum, which read as a solid block
  // rather than a chart. Drawing the calendar instead keeps every bar the same
  // width from day one: a month with no revenue is a stub on the axis, and the
  // window slides as time passes.
  const slots = useMemo(() => buildRevenueWindow(points ?? []), [points]);
  const newestWithData = useMemo(() => {
    for (let i = slots.length - 1; i >= 0; i--) if (slots[i].point) return i;
    return slots.length - 1;
  }, [slots]);

  // A picked month is dropped as soon as it stops holding data in a refreshed
  // series, so the card always falls back to the newest month that has any.
  const idx =
    picked !== null && picked >= 0 && picked < slots.length && slots[picked].point
      ? picked
      : newestWithData;

  const { max, total, monthsWithData } = useMemo(
    () =>
      slots.reduce(
        (acc, sl) =>
          sl.point
            ? {
                max: Math.max(acc.max, sl.point.value),
                total: acc.total + sl.point.value,
                monthsWithData: acc.monthsWithData + 1
              }
            : acc,
        { max: 0, total: 0, monthsWithData: 0 },
      ),
    [slots],
  );

  if (!points || points.length === 0) {
    const unavailable = !points;
    return (
      <View style={s.revCard}>
        <View style={s.revEmpty}>
          <View style={[s.revEmptyIcon, { backgroundColor: (unavailable ? C.ink3 : C.brand) + '12' }]}>
            <Feather name={unavailable ? 'cloud-off' : 'bar-chart-2'} size={19} color={unavailable ? C.ink3 : C.brand} />
          </View>
          <Text style={s.revEmptyTitle}>{unavailable ? 'Revenue history unavailable' : 'No revenue yet'}</Text>
          <Text style={s.revEmptySub}>
            {unavailable
              ? 'We could not load the monthly series. Pull down to refresh.'
              : 'Monthly revenue appears here once you start issuing invoices.'}
          </Text>
        </View>
      </View>
    );
  }

  const selectedSlot = slots[idx];
  const selected = selectedSlot.point ?? { label: selectedSlot.label, value: 0 };
  // The calendar month before the selected one. An empty slot carries no
  // point, so the guard below suppresses the comparison rather than treating
  // "no revenue recorded" as a hard zero to divide by.
  const prev = idx > 0 ? slots[idx - 1].point : undefined;
  const avg = monthsWithData > 0 ? total / monthsWithData : 0;

  // Month over month against the preceding bar. Suppressed when there is no
  // prior month, or when it was zero (a percentage off zero is meaningless).
  // A move that rounds to 0% reads as flat — neither a green win nor a loss.
  const momPct = prev && prev.value > 0 ? ((selected.value - prev.value) / prev.value) * 100 : null;
  const flat = momPct !== null && Math.abs(momPct) < 0.5;
  const up = (momPct ?? 0) >= 0;
  const momTone = flat ? C.ink2 : up ? C.pos : C.neg;
  const momIcon = flat ? 'minus' : up ? 'trending-up' : 'trending-down';
  const momText =
    momPct === null ? '' : Math.abs(momPct) >= 1000 ? '999+%' : `${Math.abs(momPct).toFixed(0)}%`;

  return (
    <View style={s.revCard}>
      <View style={s.revTopRow}>
        <View style={s.revHeadBlock}>
          <Text style={s.revValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {compactRs(selected.value)}
          </Text>
          <Text style={s.revCaption} numberOfLines={1}>
            {fullMonth(selected.label)}
            {/* The window always ends at the current month, so that is the
                only slot whose figure is still accruing. */}
            {isCurrentMonth(selected.label) && idx === slots.length - 1 ? ' · month to date' : ''}
          </Text>
        </View>

        {momPct !== null && (
          <View
            accessible
            style={[s.revDelta, { backgroundColor: momTone + '12' }]}
            accessibilityLabel={`${flat ? 'Flat at' : up ? 'Up' : 'Down'} ${momText} versus ${prev?.label}`}
          >
            <Feather name={momIcon} size={12} color={momTone} />
            <Text style={[s.revDeltaText, { color: momTone }]}>
              {flat ? '' : up ? '+' : '−'}{momText}
            </Text>
          </View>
        )}
      </View>

      <View style={s.revChart}>
        {slots.map((sl, i) => {
          const on = i === idx;
          // Every month keeps a visible stub so a month with no revenue still
          // reads as a month rather than a gap in the axis.
          const value = sl.point?.value ?? 0;
          const h = sl.point && max > 0
            ? Math.max(3, Math.round((Math.max(value, 0) / max) * BAR_AREA))
            : 3;
          const tint = !sl.point ? C.line : on ? C.brand : C.bar;
          return (
            <TouchableOpacity
              key={sl.key}
              style={s.revCol}
              activeOpacity={sl.point ? 0.75 : 1}
              // An empty month has nothing to promote into the headline, so it
              // is inert rather than a tap that appears to do nothing.
              disabled={!sl.point}
              onPress={() => setPicked(i)}
              accessibilityRole="button"
              accessibilityState={{ selected: on, disabled: !sl.point }}
              accessibilityLabel={
                sl.point ? `${sl.label}: ${compactRs(value)}` : `${sl.label}: no revenue`
              }
            >
              <View style={[s.revBar, { height: h, backgroundColor: tint }]} />
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={s.revBaseline} />

      <View style={s.revLabelRow}>
        {slots.map((sl, i) => (
          <Text
            key={`${sl.key}-label`}
            style={[s.revLabel, !sl.point && s.revLabelOff, i === idx && s.revLabelOn]}
            numberOfLines={1}
          >
            {sl.short}
          </Text>
        ))}
      </View>

      {/* With one month, "Average / month" and "Total · 1 mo" are both just the
          headline figure again — the same number three times on one card, and
          an average over a single part-finished month means nothing anyway.
          Say what is actually true instead: the comparison starts next month. */}
      {monthsWithData === 1 ? (
        <View style={s.revFooter}>
          <Text style={s.revFootNote}>
            First month of revenue. Month-on-month comparison appears once{' '}
            {nextMonthLabel(selected.label)} has figures.
          </Text>
        </View>
      ) : (
        <View style={s.revFooter}>
          <View style={s.revFootItem}>
            <Text style={s.revFootCaption}>Average / month</Text>
            <Text style={s.revFootValue}>{compactRs(avg)}</Text>
          </View>
          <View style={s.revFootDivider} />
          <View style={s.revFootItem}>
            {/* Counts the months that actually earned, not the width of the
                window — averaging Rs 23K over five slots when four of them
                predate the company would understate every month. */}
            <Text style={s.revFootCaption}>Total · {monthsWithData} mo</Text>
            <Text style={s.revFootValue}>{compactRs(total)}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  revCard: { ...card, marginHorizontal: 16, padding: 16 },
  revTopRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  revHeadBlock: { flex: 1 },
  revValue: {
    ...THEME.typography.displayMd,
    color: C.ink, fontFamily: FONT,
    letterSpacing: -0.9, lineHeight: 37, fontVariant: ['tabular-nums'],
  },
  revCaption: { ...THEME.typography.caption, color: C.ink3, fontFamily: FONT, marginTop: 3 },
  revDelta: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, marginBottom: 2,
  },
  revDeltaText: { ...THEME.typography.labelSm, fontFamily: FONT, fontVariant: ['tabular-nums'] },
  // Always WINDOW_MONTHS columns at flex:1, so a bar is the same width whether
  // the company has one month of history or five, and the newest sits hard
  // against the right edge where the calendar puts it.
  revChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: BAR_AREA, marginTop: 18 },
  revCol: { flex: 1, height: BAR_AREA, justifyContent: 'flex-end' },
  revBar: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  revBaseline: { height: 1, backgroundColor: C.line },
  // Mirrors revChart exactly — same flex and gap — or the month labels drift
  // out from under their bars.
  revLabelRow: { flexDirection: 'row', gap: 10, marginTop: 7 },
  revLabel: { ...THEME.typography.overline, flex: 1, textAlign: 'center', color: C.ink3, fontFamily: FONT },
  revLabelOn: { color: C.ink, fontWeight: typography.labelLg.fontWeight },
  /** A month the company earned nothing in — present on the axis, but quiet. */
  revLabelOff: { color: C.ink3, opacity: 0.45, fontWeight: typography.labelLg.fontWeight },
  revFooter: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 14, paddingTop: 13, borderTopWidth: 1, borderTopColor: C.lineSoft,
  },
  revFootItem: { flex: 1 },
  revFootDivider: { width: 1, height: 26, backgroundColor: C.line, marginHorizontal: 12 },
  revFootCaption: { ...THEME.typography.caption, color: C.ink3, fontFamily: FONT },
  revFootNote: { ...THEME.typography.caption, flex: 1, color: C.ink3, fontFamily: FONT, lineHeight: 16 },
  revFootValue: { ...THEME.typography.h5, color: C.ink, fontFamily: FONT, marginTop: 2, fontVariant: ['tabular-nums'] },
  revEmpty: { alignItems: 'center', paddingVertical: 16, gap: 5 },
  revEmptyIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  revEmptyTitle: { ...THEME.typography.labelMd, color: C.ink, fontFamily: FONT },
  revEmptySub: { ...THEME.typography.caption, color: C.ink3, textAlign: 'center', lineHeight: 17, fontFamily: FONT }
});

export default RevenueTrendCard;
