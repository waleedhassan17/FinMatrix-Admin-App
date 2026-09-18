// ═══════════════════════════════════════════════════════
// FinMatrix — BaseNavigator (auth / onboarding / status gates)
// ═══════════════════════════════════════════════════════
// Dumb mapper over the route arrays in navigations-maps/Auth.ts
// (Consultant_Mobile convention). Which top-level navigator mounts —
// this one, the rider app, super-admin, or a company tier — is decided
// by AppContainer.renderNavigator(); this navigator only handles the
// session-gate branches for admins that are not (yet) inside the app:
// sign-in, email verification, approval, renewal, rejection, onboarding.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppSelector } from '../hooks/useReduxHooks';
import type { RootStackParamList } from '../types';
import type { IRoute } from '../navigations-maps/types';
import { THEME } from '../theme';
import {
  ONBOARDING_ROUTE,
  UNAUTHENTICATED_ROUTES,
  EMAIL_VERIFY_ROUTES,
  PENDING_ROUTES,
  RENEW_ROUTES,
  REJECTED_ROUTES,
  DRAFT_COMPANY_ROUTES,
  COMPANY_ONBOARDING_ROUTES
} from '../navigations-maps/Auth';

const Stack = createNativeStackNavigator<RootStackParamList>();

const BaseNavigator: React.FC = () => {
  const { isAuthenticated, hasSeenOnboarding, user } = useAppSelector(
    state => state.auth,
  );
  const hasCompany = Boolean(user?.companyId);

  // ─── Stage 1: company-admin onboarding/approval gates ───
  const companyStatus = user?.companyStatus ?? null;
  const emailVerified = user?.isEmailVerified !== false; // default true (legacy)
  const isPending =
    companyStatus === 'pending_approval' || companyStatus === 'pending';
  const isRejected = companyStatus === 'rejected';
  // Mid-session deactivation (server sets status → inactive) routes the user out.
  const isInactive = companyStatus === 'inactive' || companyStatus === 'suspended';
  // A created-but-not-submitted company resumes at plan selection + submit.
  //
  // Two spellings are accepted on purpose. 'draft' is what a current server
  // sends; 'email_verified' is the raw status an older one sent before the
  // normalizer could express this state. Keeping both means a new app works
  // against either server during rollout.
  const isDraftCompany =
    hasCompany && (companyStatus === 'draft' || companyStatus === 'email_verified');

  // ORDER MATTERS. The draft check must come BEFORE isPending: a server that
  // has not been updated yet reports a draft as 'pending', and a draft that
  // reached this branch would land on "Awaiting approval" — a screen about
  // work the user has not done, with no route back to plan selection.
  const routes: IRoute[] = !isAuthenticated
    ? [...(!hasSeenOnboarding ? [ONBOARDING_ROUTE] : []), ...UNAUTHENTICATED_ROUTES]
    : !emailVerified
      ? EMAIL_VERIFY_ROUTES
      : isDraftCompany
        ? DRAFT_COMPANY_ROUTES
        : isPending
          ? PENDING_ROUTES
          : isInactive
            ? RENEW_ROUTES
            : isRejected
              ? REJECTED_ROUTES
              : COMPANY_ONBOARDING_ROUTES;

  return (
    <Stack.Navigator
      id="BaseNavigator"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: THEME.colors.neutral50 },
        animation: 'none'
      }}>
      {routes.map(route => (
        <Stack.Screen
          key={route.title}
          name={route.title as keyof RootStackParamList}
          component={route.component}
          options={route.options}
          initialParams={route.initialParams as never}
        />
      ))}
    </Stack.Navigator>
  );
};

export default BaseNavigator;
