// ═══════════════════════════════════════════════════════
// FinMatrix — Global Design System (THEME)
// ═══════════════════════════════════════════════════════
// A single source of truth for colour, type, elevation and shape.
// Re-skinning these tokens re-skins every screen that consumes them.
//
// System philosophy (enterprise / production):
//   • A cool slate neutral ramp gives the UI a calm, professional base.
//   • Brand teal is reserved for identity & primary actions (see DP_BRAND).
//   • Semantic colours each ship in three tiers — base / light / lighter —
//     so a coloured icon, its tinted chip, and a faint section background
//     always come from the same family and pass AA contrast on white.
//   • Elevation is soft and layered (low opacity, cool shadow) rather than
//     hard drop shadows, which is what separates "enterprise" from "demo".
//   • Type scale is deliberate: tight tracking on display/headings,
//     comfortable line-height on body, uppercase utility for overlines.

import { Platform, TextStyle, ViewStyle } from 'react-native';

// ───────────────────────────────────────────────
// 1. Raw palette
// ───────────────────────────────────────────────
const palette = {
  // Neutral — cool slate ramp (the backbone of the UI)
  neutral25: '#FCFCFD',
  neutral50: '#F7F9FB',
  neutral100: '#EEF2F6',
  neutral200: '#E2E8F0',
  neutral300: '#CBD5E1',
  neutral400: '#94A3B8',
  neutral500: '#64748B',
  neutral600: '#475569',
  neutral700: '#334155',
  neutral800: '#1E293B',
  neutral900: '#0F172A',

  // Brand teal (mirrors DP_BRAND so generic primary UI stays on-brand)
  teal700: '#0F766E',
  teal600: '#0E8C80',
  tealDark: '#0B544E',
  tealLight: '#C5E4DF',
  tealLighter: '#E9F4F2',

  // Secondary — violet (used for distinct, non-state categories)
  violet600: '#7C3AED',
  violetLight: '#EFE9FD',

  // Navy — the app's action colour. Deep and quiet rather than bright: it
  // paints every primary button, "New"/"Add" pill and form section dot, and it
  // sits in the same family as HEADER_NAVY so a button no longer competes with
  // the header above it.
  navy600: '#1F4E79',
  navy700: '#163A5C',
  navyTint: '#EAF0F6',

  // Emerald — no longer the brand accent, but still the SUCCESS green: a paid
  // invoice, a delivery in transit, a strong password. Kept so meaning stays
  // green while the brand moved to navy.
  emerald600: '#059669',
  emerald700: '#047857',
  emeraldLighter: '#ECFDF5',

  // On-dark accents. The ramps above are tuned for white grounds and go muddy
  // on the near-black summary panel, so its two accents are named separately.
  amber400: '#F59E0B',
  amber300: '#FBBF24',
  emerald400: '#34D399',
  red400: '#F87171',

  // Semantic — success / warning / danger / info
  green600: '#16A34A',
  greenLight: '#D8F3E1',
  greenLighter: '#EFFBF3',

  amber600: '#D97706',
  amberLight: '#FBEAD0',
  amberLighter: '#FDF6EA',

  red600: '#DC2626',
  redLight: '#FBDCDC',
  redLighter: '#FDF0F0',

  blue600: '#2563EB',
  blueLight: '#DCE7FE',
} as const;

// ───────────────────────────────────────────────
// 2. Semantic colour tokens
// ───────────────────────────────────────────────
const colors = {
  // ── ONE action colour ───────────────────────────────────────────────
  // This used to be two. `primary` was brand teal (~150 call sites) and
  // `actionGreen` was a separate emerald (~270), and the comment here said
  // "Both are live in the UI today" — which is why the app looked like two
  // products stitched together: a teal header beside a green button.
  //
  // Both names now resolve to the same navy, so every accent in the app
  // agrees. The old names are kept as aliases rather than renamed across ~420
  // call sites: renaming them in a visual pass would bury the actual change
  // in diff noise. `actionGreen` no longer means green — `success` is what
  // carries that meaning now.
  primary: palette.navy600,
  primaryDark: palette.navy700,
  primaryLight: palette.navyTint,
  primaryLighter: palette.navyTint,
  primaryTint: palette.navyTint,
  actionGreen: palette.navy600,
  actionGreenDark: palette.navy700,
  actionGreenLighter: palette.navyTint,

  // Secondary — a category colour for non-state grouping, never decoration.
  secondary: palette.violet600,
  secondaryLight: palette.violetLight,

  // Success
  success: palette.green600,
  successLight: palette.greenLight,
  successLighter: palette.greenLighter,

  // Warning
  warning: palette.amber600,
  warningLight: palette.amberLight,
  warningLighter: palette.amberLighter,

  // Danger
  danger: palette.red600,
  dangerLight: palette.redLight,
  dangerLighter: palette.redLighter,

  // Info
  info: palette.blue600,
  infoLight: palette.blueLight,

  // Neutrals (exposed for direct use)
  neutral25: palette.neutral25,
  neutral50: palette.neutral50,
  neutral100: palette.neutral100,
  neutral200: palette.neutral200,
  neutral300: palette.neutral300,
  neutral400: palette.neutral400,
  neutral500: palette.neutral500,
  neutral600: palette.neutral600,
  neutral700: palette.neutral700,
  neutral800: palette.neutral800,
  neutral900: palette.neutral900,

  // Surfaces
  background: '#F4F6F9', // app canvas — faint cool tint, not pure white
  surface: '#FFFFFF', // cards / sheets
  surface2: '#F9FAFB', // recessed rows inside a card
  // Standard hairline. Dark enough to actually read as an edge — the previous
  // #E4E9EF sat one shade off borderLight below, so an outline and an internal
  // divider were nearly the same weight and cards relied on shadow alone to
  // separate. AUTH.line (components/auth/authTokens.ts) carries the same value
  // so the sign-in flow and the app agree.
  border: '#D3DAE3',
  borderStrong: '#C1CAD5', // emphasised edge — a selected or filled control
  borderLight: '#EEF2F6', // subtle internal dividers
  overlay: 'rgba(15, 23, 42, 0.55)', // modal scrim

  // Text
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
  textDisabled: '#CBD5E1',
  textInverse: '#FFFFFF',

  // ───────────────────────────────────────────────
  // Backward compatibility tokens (preserved)
  // ───────────────────────────────────────────────
  primaryHover: palette.teal600,
  successHover: '#15803d',
  dangerHover: '#b91c1c',
  warningHover: '#b45309',
  neutral0: '#FFFFFF',
  backgroundAlt: '#FCFCFD',
  surfaceHover: '#FCFCFD',
  borderFocus: palette.teal600,
  textLink: palette.teal700,
  overlayLight: 'rgba(15, 23, 42, 0.15)',
} as const;

// ───────────────────────────────────────────────
// 3. Typography scale
// ───────────────────────────────────────────────
const fontFamily = Platform.select({
  android: 'Roboto',
  default: 'System',
})!;

/**
 * ROLE MAP — which token a given piece of UI takes.
 *
 * This is the reference the consistency passes work from. A style should name
 * a role, never a size and weight: `...typography.labelMd`, not
 * `fontSize: 13, fontWeight: '600'`.
 *
 *   Screen title (navy header)     h2 · colors.neutral0
 *   Screen subtitle                bodySm · white @ 62%
 *   Section header                 form.sectionTitle (11px, uppercase, tracked)
 *   Card / row primary             labelLg · textPrimary
 *   Card / row secondary           bodySm · textSecondary
 *   KPI or stat value              h2 (h3 where space is tight)
 *   KPI or stat label              caption · textSecondary
 *   Money — row                    labelLg, right-aligned, tabular-nums
 *   Money — total                  h4, right-aligned, tabular-nums
 *   Status badge                   labelSm + statusStyle(status)
 *   Table head                     overline · textSecondary
 *   Table cell                     caption · textPrimary
 *   Field label                    labelMd · textSecondary
 *   Input / selected value         bodyMd · textPrimary
 *   Helper, hint, caption          caption · textTertiary
 *   Button label                   labelLg
 *
 * When a hardcoded pair has no exact role, take the nearest: the scale uses
 * 600/700 where hand-written styles often reach for 700/800, so some text
 * renders one weight lighter. That is the intended outcome of adopting it.
 */
const typography = {
  fontFamily,

  displayLg: { fontFamily, fontSize: 36, lineHeight: 44, fontWeight: '800', letterSpacing: -0.5 },
  displayMd: { fontFamily, fontSize: 32, lineHeight: 40, fontWeight: '800', letterSpacing: -0.5 },
  displaySm: { fontFamily, fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.3 },

  h1: { fontFamily, fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.4 },
  h2: { fontFamily, fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.3 },
  h3: { fontFamily, fontSize: 19, lineHeight: 26, fontWeight: '700', letterSpacing: -0.2 },
  h4: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '600', letterSpacing: -0.1 },
  h5: { fontFamily, fontSize: 14, lineHeight: 20, fontWeight: '600', letterSpacing: 0 },

  bodyLg: { fontFamily, fontSize: 16, lineHeight: 24, fontWeight: '400', letterSpacing: 0 },
  bodyMd: { fontFamily, fontSize: 15, lineHeight: 22, fontWeight: '400', letterSpacing: 0 },
  bodySm: { fontFamily, fontSize: 13, lineHeight: 19, fontWeight: '400', letterSpacing: 0 },

  labelLg: { fontFamily, fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: 0 },
  labelMd: { fontFamily, fontSize: 13, lineHeight: 18, fontWeight: '600', letterSpacing: 0.1 },
  labelSm: { fontFamily, fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0.1 },

  caption: { fontFamily, fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0.1 },
  overline: { fontFamily, fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' as const },
} as const satisfies Record<string, TextStyle | string>;

// ───────────────────────────────────────────────
// 4. Shape (radii)
// ───────────────────────────────────────────────
const radius = {
  xs: 6,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 999,
} as const;

// ───────────────────────────────────────────────
// 5. Elevation (soft, layered, cool)
// ───────────────────────────────────────────────
const shadows = {
  /**
   * THE card elevation. One subtle shadow, used everywhere a surface lifts off
   * the canvas — the scale below still exists for older screens, but nothing
   * needs a 28 or 38px blur, and stacking several depths is most of what makes
   * an interface look synthetic.
   */
  card: {
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  xs: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.09,
    shadowRadius: 18,
    elevation: 5,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 9,
  },
  // ───────────────────────────────────────────────
  // Backward compatibility shadow (preserved)
  // ───────────────────────────────────────────────
  xl: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.16,
    shadowRadius: 38,
    elevation: 12,
  },
} as const satisfies Record<string, ViewStyle>;

// ───────────────────────────────────────────────
// Spacing (preserved for backward compatibility)
// ───────────────────────────────────────────────
const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  xxxxl: 48,
} as const;

// ───────────────────────────────────────────────
// 5b. Form-control tokens (ux.md consistency pass)
// ───────────────────────────────────────────────
// THE single source for form-control metrics. Every form primitive
// (CustomInput, CustomDropdown, DateField, FormUI.*) and every inline
// line-editor field reads these — screens must not hardcode control
// heights, radii, or the Add-pill spec.
const form = {
  /** Height of every single-line text input, dropdown trigger, date field. */
  controlHeight: 48,
  /** Corner radius of every form control (matches CustomInput/CustomDropdown). */
  controlRadius: 10,
  /** Height/spec of the green "Add" pill — identical everywhere it appears. */
  addPill: {
    background: colors.actionGreen,
    radius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '700' as const,
    iconSize: 15,
  },
  /** Section header: dot + 11px uppercase letter-spaced title (doc-form style). */
  sectionTitle: {
    fontFamily,
    fontSize: 11,
    fontWeight: '700' as const,
    color: colors.neutral500,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  sectionDot: { size: 8, color: colors.actionGreen },
  /**
   * The dark "summary / totals" panel that closes every transaction form.
   * All five forms drew this panel from their own local palette; the spec
   * lives here so the gradient, the label/value contrast and the two on-dark
   * accents are identical across Invoice, Bill, PO, PayBills and
   * ReceivePayment.
   */
  summaryPanel: {
    gradient: [colors.neutral900, colors.neutral800] as [string, string],
    /** Figures and headings on the panel. */
    text: colors.neutral100,
    /** Row labels — deliberately dimmer than the values beside them. */
    label: 'rgba(238, 242, 246, 0.65)',
    /** Hairline rule between rows. */
    divider: 'rgba(238, 242, 246, 0.14)',
    /** The "gold" accent: panel icon and grand total. */
    accent: palette.amber400,
    /** A credit or discount — money coming back off the total. */
    positive: palette.emerald400,
    /** A figure that needs attention: overdrawn account, unapplied amount. */
    caution: palette.amber300,
    /** A figure that is outright wrong — an overpayment with nowhere to go. */
    negative: palette.red400,
  },
} as const;

// ───────────────────────────────────────────────
// 6. Public theme object
// ───────────────────────────────────────────────
export const THEME = {
  colors,
  typography,
  radius,
  shadows,
  spacing,
  form,
} as const;

export type Theme = typeof THEME;

/**
 * The navy header gradient, shared by every screen that has one: the reports
 * kit, the transactions stack, and the dashboard. It lives here rather than in
 * a component so a module can use the colour without importing the component
 * that happens to render it.
 */
/**
 * THE header colour — one flat dark navy, identical to the auth header
 * (AUTH.header.bg in components/auth/authTokens.ts).
 *
 * This used to be a three-stop gradient ('#0E1726' → '#1C2F4C') that visibly
 * lightened toward the bottom, so an app header and a sign-in header were
 * plainly different surfaces on the same device. The auth palette had already
 * reasoned its way to the answer: "a single colour is what makes the flow read
 * as one product, and the header's job is to frame the title, not to be looked
 * at."
 *
 * Still an array so `LinearGradient colors={HEADER_NAVY}` and the many
 * `HEADER_NAVY[0]` safe-area backgrounds keep working untouched; both stops
 * are the same value, so it paints flat.
 */
export const HEADER_BG = '#111D28';

/**
 * The header's bottom corner. Matches AUTH.header.radius, so a sign-in header
 * and an app header are the same shape as well as the same colour — they were
 * 26 and 22, which reads as sloppy rather than as a choice.
 */
export const HEADER_RADIUS = 26;
export const HEADER_NAVY = [HEADER_BG, HEADER_BG] as const;

// ───────────────────────────────────────────────
// 6b. Status colours — one resolver for the whole app
// ───────────────────────────────────────────────
/**
 * Resolves any status word to a foreground/background pair.
 *
 * Every domain in the app names its states differently — an invoice is `paid`,
 * a company is `active`, a payment is `approved` — but they mean the same six
 * things, and before this they were coloured by whichever palette the screen
 * happened to define. The SuperAdmin console alone carried five copies of an
 * Atlassian status map.
 *
 * Boundary with STATUS_CONFIG below: that map is the delivery domain's own
 * vocabulary and adds a label and an icon this cannot. Its colours are already
 * theme tokens, so the two agree on tone without one having to call the other.
 * Use STATUS_CONFIG where a delivery needs its icon; use this everywhere else.
 */
const STATUS_TIER = {
  // Inert or terminated — no attention wanted.
  neutral: { fg: colors.neutral500, bg: colors.neutral100 },
  // Live, awaiting the other party.
  info: { fg: colors.info, bg: colors.infoLight },
  // In progress, or waiting on someone here.
  warning: { fg: colors.warning, bg: colors.warningLighter },
  // The happy terminal state.
  success: { fg: colors.success, bg: colors.successLighter },
  // Needs attention now.
  danger: { fg: colors.danger, bg: colors.dangerLighter },
  // Moved on into another document or state.
  moved: { fg: colors.secondary, bg: colors.secondaryLight },
} as const;

const STATUS_TIER_OF: Record<string, keyof typeof STATUS_TIER> = {
  // ── neutral ──
  draft: 'neutral', void: 'neutral', cancelled: 'neutral', inactive: 'neutral',
  unassigned: 'neutral', archived: 'neutral', none: 'neutral', on_leave: 'neutral',
  // ── personnel availability ──
  available: 'success', busy: 'warning',
  // ── info ──
  open: 'info', sent: 'info', submitted: 'info', new: 'info',
  // ── warning ──
  partial: 'warning', partially_received: 'warning', refunded: 'warning',
  expired: 'warning', pending: 'warning', pending_approval: 'warning',
  processing: 'warning', trial: 'warning', unpaid: 'warning',
  // A rider the plan no longer covers — paused, data kept, fixable.
  plan_locked: 'warning',
  // ── success ──
  paid: 'success', fully_received: 'success', received: 'success',
  approved: 'success', applied: 'success', fulfilled: 'success',
  accepted: 'success', posted: 'success', active: 'success',
  delivered: 'success', completed: 'success', verified: 'success',
  // ── danger ──
  overdue: 'danger', declined: 'danger', rejected: 'danger', failed: 'danger',
  suspended: 'danger', blocked: 'danger',
  // ── moved on ──
  closed: 'moved', invoiced: 'moved', converted: 'moved', returned: 'moved',
};

export const statusStyle = (status: string): { fg: string; bg: string } =>
  STATUS_TIER[STATUS_TIER_OF[status] ?? 'neutral'];

// ───────────────────────────────────────────────
// 7. Delivery status configuration
// ───────────────────────────────────────────────
export interface StatusStyle {
  label: string;
  color: string;
  bg: string;
  icon: string;
}

export const STATUS_CONFIG: Record<string, StatusStyle> = {
  pending: { label: 'Pending', color: colors.primary, bg: colors.primaryLighter, icon: 'clock' },
  picked_up: { label: 'Picked Up', color: colors.secondary, bg: colors.secondaryLight, icon: 'package' },
  in_transit: { label: 'In Transit', color: colors.warning, bg: colors.warningLight, icon: 'truck' },
  arrived: { label: 'Arrived', color: colors.info, bg: colors.infoLight, icon: 'map-pin' },
  delivered: { label: 'Delivered', color: colors.success, bg: colors.successLight, icon: 'check-circle' },
  failed: { label: 'Failed', color: colors.danger, bg: colors.dangerLight, icon: 'x-circle' },
  cancelled: { label: 'Cancelled', color: colors.neutral500, bg: colors.neutral100, icon: 'slash' },
  returned: { label: 'Returned', color: colors.secondary, bg: colors.secondaryLight, icon: 'corner-up-left' },
  unassigned: { label: 'Unassigned', color: colors.neutral500, bg: colors.neutral100, icon: 'help-circle' },
};

// ───────────────────────────────────────────────
// 8. Priority configuration
// ───────────────────────────────────────────────
export interface PriorityStyle {
  label: string;
  color: string;
  bg: string;
}

export const PRIORITY_CONFIG: Record<string, PriorityStyle> = {
  low: { label: 'Low', color: colors.success, bg: colors.successLight },
  normal: { label: 'Normal', color: colors.success, bg: colors.successLight },
  medium: { label: 'Medium', color: colors.warning, bg: colors.warningLight },
  high: { label: 'High', color: colors.danger, bg: colors.dangerLight },
  urgent: { label: 'Urgent', color: '#FFFFFF', bg: colors.danger },
};

export default THEME;
