// ═══════════════════════════════════════════════════════
// FinMatrix Admin — NotAuthorizedScreen
// ═══════════════════════════════════════════════════════
// The dead end for an authenticated account that is not a platform admin.
//
// Sign-in already refuses non-console roles, so this is only reachable by a
// session that was persisted before that gate existed (or restored from a
// tenant build sharing a storage origin). It exists because the obvious
// alternative is a trap: falling back to the unauthenticated stack would put
// such a user on sign-in, let them authenticate successfully, and bounce them
// straight back — a loop with no exit. Saying what happened and offering the
// sign-out button is the only way out.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useSignOut } from '../../hooks/useSignOut';
import { THEME } from '../../theme';

const { colors, typography, spacing, radius } = THEME;

export const NotAuthorizedScreen: React.FC = () => {
  const { signOutNow, signingOut } = useSignOut();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Feather name="lock" size={28} color={colors.danger} />
        </View>
        <Text style={styles.title}>Console access only</Text>
        <Text style={styles.message}>
          This app is the FinMatrix platform console. Your account does not have
          platform administrator access — please sign in to the FinMatrix app
          instead.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={signOutNow}
          disabled={signingOut}
          accessibilityRole="button">
          <Text style={styles.buttonLabel}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.neutral50 },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerLighter,
    marginBottom: spacing.lg,
  },
  title: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.xs },
  message: {
    ...typography.bodyMd,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  button: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.actionGreen,
  },
  buttonLabel: { ...typography.labelLg, color: colors.neutral0 },
});

export default NotAuthorizedScreen;
