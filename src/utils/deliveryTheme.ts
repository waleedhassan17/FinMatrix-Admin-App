// ═══════════════════════════════════════════════════════
// FinMatrix — Delivery Brand Tokens (DP_BRAND)
// ═══════════════════════════════════════════════════════
// The delivery experience is anchored by a single confident brand hue
// (deep teal-green) used for navigation, headers and delivery identity.
// Semantic state colours (success / warning / danger / info) live in
// `theme.ts` so the brand colour never competes with status meaning.
//
// Design intent:
//   • One brand hue, used with restraint → reads as a system, not a theme.
//   • Header overlays are alpha-on-brand so they adapt to the gradient.
//   • Tints (soft / border) are desaturated for an enterprise, non-"candy" feel.

export const DP_BRAND = {
  // Core brand ramp
  primary: '#0F766E', // teal-700 — primary brand / headers / CTAs
  primaryDark: '#0B544E', // gradient end / status bar / pressed
  primarySoft: '#E9F4F2', // tinted surface behind brand icons
  primaryBorder: '#CDE7E2', // hairline border for brand-tinted surfaces

  white: '#FFFFFF',

  // On-gradient text + overlays (alpha so they ride any header gradient)
  headerTextSecondary: 'rgba(255, 255, 255, 0.78)',
  headerOverlay: 'rgba(255, 255, 255, 0.12)', // icon buttons on header
  headerOverlaySolid: 'rgba(255, 255, 255, 0.18)', // pills / badges on header
  headerOverlayBorder: 'rgba(255, 255, 255, 0.24)', // hairline on overlay pills
} as const;

export type DPBrand = typeof DP_BRAND;
