// ═══════════════════════════════════════════════════════
// FinMatrix — Registration Rejected / Account Deactivated gate
// ═══════════════════════════════════════════════════════
// Sibling of PendingApprovalScreen and deliberately built from the same kit —
// a user moving between these states should see one consistent screen family.

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { setUser, selectSelectedRole } from '../authSlice';
import {
  authMe,
  getCompanyAPI,
  submitCompanyAPI
} from '../../../networks/auth/authNetwork';
import { setStoredCompanyId } from '../../../utils/storageUtils';
import { useSignOut } from '../../../hooks/useSignOut';
import type { UserRole } from '../../../types';
import { THEME } from '../../../theme';
import {
  AuthLayout,
  AuthHeader,
  AuthFooterBar,
  AuthIconTile,
  AuthNotice,
  StatusPill,
  AUTH,
  type AuthTone
} from '../../../components/auth/AuthUI';

const CompanyRejectedScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const fromLogin = !!route.params?.fromLogin;
  const mode: 'rejected' | 'inactive' = route.params?.mode ?? 'rejected';
  const isInactive = mode === 'inactive';
  const user = useAppSelector(s => s.auth.user);
  const selectedRole = useAppSelector(selectSelectedRole);
  const role: UserRole = selectedRole ?? 'admin';
  const companyId = user?.companyId ?? null;
  const { confirmSignOut } = useSignOut();
  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated);

  // As on PendingApproval: in the signed-out stack this screen is only the
  // hand-off from a blocked sign-in. Restored any other way (the web URL after
  // signing out, or a reload), send the user to the start of sign-in.
  useEffect(() => {
    if (isAuthenticated || fromLogin) return;
    const id = setTimeout(() => {
      const names: string[] = navigation.getState?.()?.routeNames ?? [];
      if (names.includes('RoleSelection')) {
        navigation.reset({ index: 0, routes: [{ name: 'RoleSelection' }] });
      }
    }, 0);
    return () => clearTimeout(id);
  }, [isAuthenticated, fromLogin, navigation]);

  const [reason, setReason] = useState<string | null>(route.params?.reason ?? null);
  const [resubmitting, setResubmitting] = useState(false);
  const [notice, setNotice] = useState<{ tone: AuthTone; message: string } | null>(
    null,
  );

  useEffect(() => {
    // With a live session we can fetch the latest reason; from the login
    // gate we only have what was passed in params.
    if (fromLogin || !companyId || isInactive) return;
    let active = true;
    (async () => {
      try {
        const company = await getCompanyAPI(companyId);
        if (active) setReason(company?.rejectionReason ?? null);
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      active = false;
    };
  }, [companyId, fromLogin, isInactive]);

  const handleResubmit = useCallback(async () => {
    if (!companyId) return;
    setResubmitting(true);
    setNotice(null);
    try {
      await submitCompanyAPI(companyId);
      const { data } = await authMe();
      if (data.companyId) await setStoredCompanyId(data.companyId);
      dispatch(setUser(data.user));
      setNotice({ tone: 'success', message: 'Resubmitted for review.' });
    } catch (e: any) {
      setNotice({ tone: 'error', message: e?.message ?? 'Could not resubmit' });
    } finally {
      setResubmitting(false);
    }
  }, [companyId, dispatch]);

  const handleSignOut = useCallback(() => {
    if (fromLogin) {
      navigation.navigate('SignIn', { role });
      return;
    }
    confirmSignOut();
  }, [fromLogin, navigation, role, confirmSignOut]);

  const canResubmit = !isInactive && !fromLogin && !!companyId;

  return (
    <AuthLayout
      header={
        <AuthHeader
          pill={isInactive ? 'Deactivated' : 'Not Approved'}
          title={isInactive ? 'Account deactivated' : 'Registration not approved'}
          subtitle={
            isInactive
              ? 'Access is paused until an administrator restores it.'
              : 'Review the note below, then resubmit when you are ready.'
          }
          onBack={fromLogin ? handleSignOut : undefined}
        />
      }
      footer={
        canResubmit ? (
          <AuthFooterBar
            primary={{
              label: 'Resubmit for review',
              onPress: handleResubmit,
              loading: resubmitting,
              loadingLabel: 'Resubmitting',
            }}
            secondary={{ label: 'Sign out', onPress: handleSignOut }}
          />
        ) : (
          <AuthFooterBar
            primary={{
              label: fromLogin ? 'Back to Sign In' : 'Sign out',
              onPress: handleSignOut,
            }}
          />
        )
      }>
      {notice ? (
        <AuthNotice
          tone={notice.tone}
          message={notice.message}
          onDismiss={() => setNotice(null)}
        />
      ) : null}

      <View style={styles.head}>
        <AuthIconTile
          icon={isInactive ? 'slash' : 'alert-triangle'}
          tone={isInactive ? 'error' : 'warning'}
        />
        <StatusPill
          label={isInactive ? 'Deactivated' : 'Not approved'}
          tone="error"
        />
      </View>

      <Text style={styles.body}>
        {isInactive
          ? 'Your company account has been deactivated. Please contact the FinMatrix administrator to restore access.'
          : "Unfortunately your company registration wasn't approved this time."}
      </Text>

      {reason ? (
        <View style={styles.reason}>
          <Text style={styles.reasonLabel}>Reason</Text>
          <Text style={styles.reasonText}>{reason}</Text>
        </View>
      ) : null}
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AUTH.space.lg,
    marginBottom: AUTH.space.xl,
  },
  body: {
    ...THEME.typography.bodySm,
    fontFamily: AUTH.font,
    lineHeight: 22,
    color: AUTH.ink[500],
    marginBottom: AUTH.space.lg,
  },
  reason: {
    backgroundColor: AUTH.surface,
    borderRadius: AUTH.radius.lg,
    borderWidth: 1,
    borderColor: AUTH.line,
    padding: AUTH.space.lg,
    gap: AUTH.space.sm,
  },
  reasonLabel: {
    ...THEME.typography.overline,
    fontFamily: AUTH.font,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: AUTH.ink[400],
  },
  reasonText: {
    ...THEME.typography.bodySm,
    fontFamily: AUTH.font,
    lineHeight: 21,
    color: AUTH.ink[700],
  }
});

export default CompanyRejectedScreen;
