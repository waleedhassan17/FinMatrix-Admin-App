// ═══════════════════════════════════════════════════════
// FinMatrix — FilterTabs
// ═══════════════════════════════════════════════════════
// THE filter tab row for the Transactions stack: a scrolling row of pills,
// one active, each optionally carrying a result count. Every Transactions
// list screen renders this and nothing else, so the row looks and behaves
// identically across all eight.
//
// It lives in components/shared because it is a plain UI control with no
// transaction knowledge — but nothing outside the Transactions stack uses it
// yet, and adopting it elsewhere is a deliberate choice, not a default.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { THEME as T } from '../../theme';

const { colors, spacing, radius, typography } = T;

export type TabItem<V extends string> = {
  label: string;
  value: V;
  /** Result count. Omit for a plain filter with nothing to count. */
  count?: number;
};

const countLabel = (label: string, count?: number): string =>
  count === undefined ? label : `${label}, ${count} ${count === 1 ? 'item' : 'items'}`;

// ── FilterTabs ────────────────────────────────────────
/**
 * Most list screens carry five or six filters, which is far more than fits
 * across a phone — so roughly half the row starts off-screen. Three things
 * follow from that, and this component handles all three so no screen has to:
 *
 *   • The selected tab is scrolled into view. Coming back to a list with a
 *     filter still applied used to show a row of unselected tabs, with the
 *     active one off the right edge and no sign the filter was on.
 *   • The edges fade while there is more row in that direction, so the row
 *     reads as scrollable instead of clipped.
 *   • A tab with nothing behind it is dimmed, so an empty filter is visible
 *     before it is tapped rather than after — but only while some other tab
 *     has results, since dimming every tab on an empty list reads as a broken
 *     row rather than an empty one.
 */
export function FilterTabs<V extends string>({
  tabs,
  active,
  onChange,
  style,
}: {
  tabs: TabItem<V>[];
  active: V;
  onChange: (value: V) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const scrollRef = useRef<ScrollView>(null);
  // Measured per pill so the active one can be centred without guessing widths.
  const spans = useRef<Partial<Record<V, { x: number; width: number }>>>({});
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);
  const [offset, setOffset] = useState(0);

  const measure = useCallback(
    (value: V) => (e: LayoutChangeEvent) => {
      const { x, width } = e.nativeEvent.layout;
      spans.current[value] = { x, width };
    },
    [],
  );

  useEffect(() => {
    const span = spans.current[active];
    if (!span || !viewport) return;
    // Centre it where there is room to; the clamp keeps the first and last
    // tabs flush against their edge instead of floating in from it.
    const max = Math.max(0, content - viewport);
    const centred = span.x + span.width / 2 - viewport / 2;
    scrollRef.current?.scrollTo({
      x: Math.min(Math.max(0, centred), max),
      animated: true,
    });
  }, [active, viewport, content]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setOffset(e.nativeEvent.contentOffset.x);
  }, []);

  // 4px of slack so a fade does not flicker at the very end of a scroll.
  const moreLeft = offset > 4;
  const moreRight = content - viewport - offset > 4;
  const anyResults = tabs.some(t => (t.count ?? 0) > 0);

  return (
    <View style={[s.filterBar, style]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.filterScroll}
        contentContainerStyle={s.filterRow}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onLayout={e => setViewport(e.nativeEvent.layout.width)}
        onContentSizeChange={w => setContent(w)}
      >
        {tabs.map(tab => {
          const isActive = active === tab.value;
          // Muting an empty filter only reads as "nothing here" when there is
          // a populated tab beside it to contrast against. On an empty list
          // every count is zero, and muting all of them makes the whole row
          // look disabled instead.
          const isEmpty = !isActive && anyResults && tab.count === 0;
          // A "0" badge is noise: the label already sits in a row where the
          // populated filters carry numbers, so absence reads as zero.
          const showCount = tab.count !== undefined && tab.count > 0;
          return (
            <Pressable
              key={tab.value}
              onLayout={measure(tab.value)}
              // The pill is deliberately shorter than 44pt so the row reads as
              // a filter strip rather than a button bar; hitSlop restores the
              // touch target without the visual weight.
              hitSlop={{ top: 6, bottom: 6 }}
              style={({ pressed }) => [
                s.pill,
                isActive && s.pillActive,
                isEmpty && s.pillEmpty,
                pressed && !isActive && s.pillPressed,
              ]}
              onPress={() => onChange(tab.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={countLabel(tab.label, tab.count)}
            >
              <Text style={[s.pillText, isActive && s.pillTextActive, isEmpty && s.textEmpty]}>
                {tab.label}
              </Text>
              {showCount ? (
                <View style={[s.badge, isActive && s.badgeActive]}>
                  <Text style={[s.badgeText, isActive && s.badgeTextActive]}>{tab.count}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Scroll affordance — non-interactive, so taps fall through to the tabs. */}
      {moreLeft ? (
        <LinearGradient
          colors={[colors.background, `${colors.background}00`]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[s.fade, s.fadeLeft, { pointerEvents: 'none' }]}
        />
      ) : null}
      {moreRight ? (
        <LinearGradient
          colors={[`${colors.background}00`, colors.background]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[s.fade, s.fadeRight, { pointerEvents: 'none' }]}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  // ── FilterTabs ──
  // Fixed-height bar so the row keeps a constant vertical slot and never
  // shifts between "has results" / "empty filter" list states.
  filterBar: { height: 48, justifyContent: 'center' },
  filterScroll: { flexGrow: 0, flexShrink: 0 },
  filterRow: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
    // The last pill clears the screen edge instead of being sheared by it.
    paddingRight: spacing.xxl,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 2,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // Ink, not brand green. The screen's one green belongs to the "New" button —
  // a green tab beside it made two competing primary marks and read as a
  // second call to action rather than a selection. Slate carries the selection
  // just as clearly and echoes the navy header above it.
  pillActive: {
    backgroundColor: colors.neutral900,
    borderColor: colors.neutral900,
  },
  // A filter with nothing behind it. Muted in the text and border only — the
  // surface stays white so the pill still reads as a control rather than
  // dropping out of the row.
  pillEmpty: { borderColor: colors.borderLight },
  pillPressed: { backgroundColor: colors.neutral100, borderColor: colors.neutral300 },
  pillText: { ...typography.labelMd, color: colors.textSecondary },
  pillTextActive: { color: colors.neutral0 },
  textEmpty: { color: colors.textTertiary },

  // ── Count badge, shown only for a non-zero count ──
  badge: {
    marginLeft: spacing.xxs + 2,
    backgroundColor: colors.neutral100,
    borderRadius: radius.full,
    paddingHorizontal: spacing.xxs + 1,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  // A white wash over slate lands around #2B3542 — white digits on it clear
  // 11:1, where the old translucent chip over green managed roughly 2.4:1.
  badgeActive: { backgroundColor: 'rgba(255, 255, 255, 0.18)' },
  // letterSpacing zeroed for digits (same treatment as ReportUI's kpiDelta).
  badgeText: { ...typography.labelSm, letterSpacing: 0, color: colors.textSecondary },
  badgeTextActive: { color: colors.neutral0 },

  // ── Edge fades, shown only while there is more row that way ──
  fade: { position: 'absolute', top: 0, bottom: 0, width: spacing.lg },
  fadeLeft: { left: 0 },
  fadeRight: { right: 0 },
});
