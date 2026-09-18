/**
 * Three-tier model UI gating (FinMatrix.md THE MODEL).
 *
 * Feature flags from /auth/me drive which rows/cards/tabs render; legacy
 * sessions (no flags) see everything, matching the server's fully-unlocked
 * fallback. On top of that, warehouse operations are HARD-gated by company
 * type: the small-business and large-org navigators ship no routes for
 * these modules, so their entry points must never render on those tiers —
 * regardless of flags (stale persisted session, all_features_unlocked kill
 * switch) — or tapping them would crash navigation.
 */
// ═══════════════════════════════════════════════════════
// WAREHOUSE-ONLY BUILD
// ═══════════════════════════════════════════════════════
// The product is temporarily shipping as a warehouse-only app. Rather than
// deleting the three-tier code, everything is routed through this one switch
// so the pivot is a single-line revert.
//
// To restore the three-tier model:
//   1. set WAREHOUSE_ONLY_BUILD = false
//   2. grep the codebase for "WAREHOUSE-ONLY" and un-comment the marked
//      blocks (tier navigators in AppContainer, the company-type options in
//      CompanyTypeSelectScreen, the type-picker hop in CompanySetupScreen,
//      and the DTO coercion in the backend's create-company.dto.ts)
//
// Existing small_business / large_org companies are deliberately left alone:
// the server's FEATURE_MAP still resolves their tier, so they keep working.
// Only NEW registrations are forced to warehouse.
export const WAREHOUSE_ONLY_BUILD = true;

/** The company type every new registration is created as while the flag is on. */
export const DEFAULT_COMPANY_TYPE = 'warehouse' as const;

export const WAREHOUSE_ONLY_FEATURES = [
  'delivery',
  'agencies',
  'inventory',
  'purchaseOrders',
  'salesOrders',
];

export const isWarehouseTier = (companyType: string | null | undefined): boolean =>
  // In a warehouse-only build every session is warehouse, including the two
  // legacy tiers — they fall through to the full AdminTabNavigator, which
  // ships every route, so nothing they tap can crash navigation.
  WAREHOUSE_ONLY_BUILD || companyType == null || companyType === 'warehouse';

// ═══════════════════════════════════════════════════════
// FEATURES REMOVED FROM THE PRODUCT
// ═══════════════════════════════════════════════════════
// Withdrawn from the app for launch, but not deleted: the screens, routes,
// slices, models, endpoints and database tables all stay where they are.
//
// 'agencies' — an inventory-catalog concept that overlaps with Vendors and
// carries no accounting meaning. Nothing in the agency path posts a journal
// entry, so hiding it cannot move the ledger.
//
// This is a LOCAL list rather than a server feature flag on purpose. The
// server's map cannot be trusted to hide anything:
//   • isFeatureVisible falls through to `!features || ...`, so a session that
//     arrives with no features map sees everything (legacy sessions do);
//   • the backend's all_features_unlocked kill switch, the FEATURES_DISABLED
//     env, and a null companyType each force EVERY feature true.
// Any of those would put the feature straight back on screen.
//
// To restore a feature: delete its entry here. Nothing else changes.
export const DISABLED_FEATURES: readonly string[] = ['agencies'];

/**
 * False for a feature withdrawn from the product. Use this for the places
 * that are not a gated row/card — route registration, effects, form fields —
 * where there is no session to consult.
 */
export const isFeatureEnabled = (feature: string): boolean =>
  !DISABLED_FEATURES.includes(feature);

/** True when a row/card gated by `feature` should render for this session. */
export const isFeatureVisible = (
  feature: string | undefined,
  features: Record<string, boolean> | null | undefined,
  companyType: string | null | undefined,
): boolean => {
  if (!feature) return true;
  // Ahead of every session-dependent check below, including the fail-open
  // fallthrough on the last line.
  if (!isFeatureEnabled(feature)) return false;
  if (!isWarehouseTier(companyType) && WAREHOUSE_ONLY_FEATURES.includes(feature)) return false;
  return !features || !!features[feature];
};
