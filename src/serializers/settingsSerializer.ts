// ═══════════════════════════════════════════════════════
// FinMatrix — Settings Serializer
// ═══════════════════════════════════════════════════════
// Defensive envelope unwrapping for /settings and the company list
// (extracted verbatim from settingsNetwork's alias helpers).

import type { CompanySwitcherItem } from '../models/settingsModel';

/** GET /settings → the preferences object, wherever the envelope put it. */
export const preferencesResponseSerializer = (res: any): any =>
  res?.data?.preferences ?? res?.data ?? res;

/** GET /auth/me → the user's company memberships. */
export const companiesResponseSerializer = (res: any): CompanySwitcherItem[] =>
  res?.data?.companies ?? [];
