// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Route names
// ═══════════════════════════════════════════════════════
// The one place a route name is written down. The tenant app's ROUTES carried
// ~85 entries covering every stack; the console has two screens outside its
// own tab navigator, whose route names are typed by RootStackParamList.
//
// The console's six tabs are NOT listed here. They are declared by
// SuperAdminNavigator and typed by SuperAdminTabParamList, and the dashboard
// navigates to them with string literals cast through `any` — so a rename
// there compiles and crashes. Leave those tab names alone.
export const ROUTES = {
  SIGN_IN: 'SignIn',
  FORGOT_PASSWORD: 'ForgotPassword',
} as const;

export type RouteName = typeof ROUTES[keyof typeof ROUTES];
