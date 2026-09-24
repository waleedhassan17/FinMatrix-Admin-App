// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Build-time feature flags
// ═══════════════════════════════════════════════════════

/**
 * BILLING-DISABLED BUILD.
 *
 * FinMatrix is not selling plans right now: a new company is activated by an
 * administrator, not by a payment. The owner-facing web, the Android app and
 * the backend each carry this same flag; the console follows them, so its tabs
 * are Dashboard, Companies and Settings, and the Payments, Analytics and Plans
 * screens are unregistered rather than deleted.
 *
 * To restore billing:
 *   1. set BILLING_DISABLED_BUILD = false in all FIVE repos (web, app,
 *      backend, admin web, admin app)
 *   2. nothing else here — every hidden screen is still in the codebase
 */
export const BILLING_DISABLED_BUILD = true;
