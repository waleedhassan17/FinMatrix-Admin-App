// ═══════════════════════════════════════════════════════
// FinMatrix — Free trial countdown (app chrome)
// ═══════════════════════════════════════════════════════
// A slim strip above the owner's app while a free trial is RUNNING: approved,
// not yet converted to a paid plan, not yet expired. Hidden in every other
// state — a pending request has nothing to count down, and a paid company has
// nothing to be reminded of.
//
// No billing fetch of its own. The countdown reads `user.subscription`, which
// signin and /auth/me already return; days are computed from the expiry date
// at render, and re-computed when the app comes back to the foreground. On
// that foreground it also re-reads /auth/me once (throttled) so an approval
// that happened while the app was closed removes the strip.
//
// It sits ABOVE the navigator, so it consumes the top safe-area inset itself
// and hands the screens below an inset of 0 — otherwise every header would pad
// for a status bar it no longer touches.

import React, { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  SafeAreaInsetsContext,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { THEME } from '../../theme';
import type { SubscriptionSummary } from '../../types';
import { pluralDays, trialDaysLeft } from '../../utils/trial';

const { colors, radius, spacing, typography } = THEME;

/** At most one /auth/me refresh per this many ms of foregrounding. */
const REFRESH_MIN_INTERVAL_MS = 60_000;

interface Props {
  subscription: SubscriptionSummary | null | undefined;
  onSubscribe: () => void;
  /** Re-read the session (dispatches bootstrapSession). */
  onForegroundRefresh: () => void;
  children: React.ReactNode;
}

const TrialBanner: React.FC<Props> = ({
  subscription,
  onSubscribe,
  onForegroundRefresh,
  children,
}) => {
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(() => new Date());
  // Set when the banner first shows (the session was just fetched), not at render.
  const lastRefresh = useRef<number | null>(null);
  const days = trialDaysLeft(subscription, now);
  const visible = days !== null;

  useEffect(() => {
    if (!visible) return undefined;
    if (lastRefresh.current === null) lastRefresh.current = Date.now();
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      setNow(new Date());
      if (Date.now() - (lastRefresh.current ?? 0) > REFRESH_MIN_INTERVAL_MS) {
        lastRefresh.current = Date.now();
        onForegroundRefresh();
      }
    });
    return () => sub.remove();
  }, [visible, onForegroundRefresh]);

  const paymentInReview = subscription?.paymentStatus === 'submitted';
  const urgent = visible && (days as number) <= 7;
  const tone = urgent
    ? { bg: colors.warningLighter, fg: colors.warning }
    : { bg: colors.infoLight, fg: colors.info };

  // The tree keeps the SAME shape whether or not the bar shows. Returning bare
  // children when hidden would change the parents of the navigator, and React
  // would remount it — throwing the owner back to the first tab the moment a
  // trial converts or ends.
  return (
    <View style={S.root}>
      {visible && (
        <View
          style={[S.bar, { backgroundColor: tone.bg, paddingTop: insets.top + spacing.xs }]}
          accessibilityRole="summary"
        >
          <Feather name={paymentInReview ? 'clock' : 'gift'} size={15} color={tone.fg} />
          <Text style={[S.text, { color: tone.fg }]} numberOfLines={2}>
            {paymentInReview
              ? `Payment under review · ${pluralDays(days as number)} of trial left`
              : `${pluralDays(days as number)} left in your free trial`}
          </Text>
          {!paymentInReview && (
            <TouchableOpacity
              style={[S.cta, { backgroundColor: tone.fg }]}
              onPress={onSubscribe}
              accessibilityRole="button"
              accessibilityLabel="Subscribe to a plan"
            >
              <Text style={S.ctaText}>Subscribe</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      <SafeAreaInsetsContext.Provider value={visible ? { ...insets, top: 0 } : insets}>
        <View style={S.body}>{children}</View>
      </SafeAreaInsetsContext.Provider>
    </View>
  );
};

const S = StyleSheet.create({
  root: { flex: 1 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  text: { ...typography.labelMd, flex: 1 },
  cta: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.md,
  },
  ctaText: { ...typography.labelMd, color: colors.neutral0 },
  body: { flex: 1 },
});

export default TrialBanner;
