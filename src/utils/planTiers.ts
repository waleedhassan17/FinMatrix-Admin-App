// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Which tiers are sold
// ═══════════════════════════════════════════════════════
// These two survive from utils/featureGates.ts, which was otherwise dead in
// this app: isWarehouseTier, isFeatureEnabled, isFeatureVisible,
// WAREHOUSE_ONLY_FEATURES and DISABLED_FEATURES all described what a TENANT
// session may see, and a platform operator has no tenant session -- the
// server's CompanyGuard closes every feature-gated endpoint to a super admin.
//
// This is a live product decision rather than leftovers, which is why it is
// kept rather than deleted with the rest.

/**
 * Only warehouse plans are sold.
 *
 * Existing small_business and large_org companies are deliberately left alone
 * -- the server's FEATURE_MAP still resolves their tier, so they keep renewing
 * -- but those tiers are not offered to anyone new, and the console's plan
 * catalogue hides them.
 *
 * Drop this to false to list every tier again.
 */
export const WAREHOUSE_ONLY_BUILD = true;

/** The company type every new registration is created as while the flag is on. */
export const DEFAULT_COMPANY_TYPE = 'warehouse' as const;
