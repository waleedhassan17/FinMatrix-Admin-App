// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Auth navigation map
// ═══════════════════════════════════════════════════════
// The platform console has exactly one unauthenticated flow: sign in, and
// recover the password. Console accounts are provisioned server-side, so there
// is no self sign-up, no company onboarding, and none of the approval /
// renewal / rejection gates the tenant app routes through here — a platform
// admin has no company to gate on.
//
// Route names must never change — the deep link (finmatrixadmin://) and every
// navigate() string depend on them.

import type { IRoute } from './types';

import SignInScreen from '../screens/Auth/SignIn/SignInScreen';
import ForgotPasswordScreen from '../screens/Auth/ForgotPassword/ForgotPasswordScreen';

export const AuthRouteNames = {
  SignIn: 'SignIn',
  ForgotPassword: 'ForgotPassword',
} as const;

export type AuthRouteName = typeof AuthRouteNames[keyof typeof AuthRouteNames];

/** ── Unauthenticated flow ── */
export const UNAUTHENTICATED_ROUTES: IRoute[] = [
  {
    title: AuthRouteNames.SignIn,
    component: SignInScreen,
    options: { animation: 'none' },
  },
  { title: AuthRouteNames.ForgotPassword, component: ForgotPasswordScreen },
];
