// ═══════════════════════════════════════════════════════
// FinMatrix — Auth design tokens
// ═══════════════════════════════════════════════════════
// Implements the approved auth/onboarding design:
//
//   ┌─────────────────────────────┐
//   │ NAVY HEADER                 │  wordmark · status pill · back chip
//   │  Title                      │  title + subtitle
//   │  ▬▬ ▬▬ ──   Step 1 of 3     │  segmented progress + step label
//   ╰─────────────────────────────╯  rounded bottom corners
//   │ light body                  │  white cards on a soft grey canvas
//   ├─────────────────────────────┤
//   │  [ Primary action    → ]    │  sticky footer bar
//   │      Secondary link         │
//   └─────────────────────────────┘
//
// The header is the anchor and always sits flush to the top. The footer is
// pinned so the primary action is reachable without scrolling on long forms.

import { THEME } from '../../theme';

export const AUTH = {
  // The auth flow has its own colour world (see below) but shares the app's
  // typeface. Redefining Platform.select() here meant a brand font would have
  // had to be set in two places and would silently have missed this flow.
  font: THEME.typography.fontFamily,

  // ── Header ──
  // ONE flat dark navy across every auth screen. No gradient, no decorative
  // bloom — a single colour is what makes the flow read as one product, and
  // the header's job is to frame the title, not to be looked at.
  header: {
    bg: '#111D28',
    title: '#FFFFFF',
    subtitle: 'rgba(255,255,255,0.60)',
    pillBg: 'rgba(255,255,255,0.10)',
    pillText: 'rgba(255,255,255,0.88)',
    chipBg: 'rgba(255,255,255,0.10)',
    radius: 26,
  },

  // ── Body (light) ──
  canvas: '#F4F6F8',
  surface: '#FFFFFF',
  sunken: '#F1F4F7',

  ink: {
    900: '#0F172A', // headings
    700: '#334155', // body
    500: '#64748B', // secondary
    400: '#94A3B8', // placeholder / muted
  },

  // Same hairline as THEME.colors.border — kept as a literal because this file
  // defines the auth palette and must not import the app theme. These two were
  // '#E5E9EF' and '#E4E9EF': indistinguishable, and both too light to see.
  line: '#D3DAE3',
  // One step darker again, because `line` moved down to what this used to be.
  // Left equal, a filled OTP box and a radio ring would have become
  // indistinguishable from an empty one — the emphasis these carry IS the
  // difference between the two tokens.
  lineStrong: '#C1CAD5',

  // ── Brand ──
  // The UI accent on LIGHT grounds — the sign-in button, links, checkmarks.
  // Navy, matching THEME.colors.primary, because the app behind this flow is
  // navy: a green Sign In button handing off to a navy dashboard read as two
  // different products.
  brand: '#1F4E79',
  brandDark: '#163A5C',
  mint: '#EAF0F6',
  mintBorder: '#C7D8E8',

  // The accent on the DARK header — the "Fin" wordmark, the portal pill's dot,
  // the progress segments. Deliberately left green: it is the WORDMARK, not a
  // control, and navy on a #111D28 header would be invisible. If the logo
  // should move to the navy family too, this is the one line to change.
  brandDot: '#10B981',

  // ── Status tints ──
  status: {
    success: { fg: '#065F46', bg: '#E7F7F0', border: '#BCE6D2', accent: '#0E9F6E' },
    info: { fg: '#0F5132', bg: '#E7F7F0', border: '#BCE6D2', accent: '#0E9F6E' },
    warning: { fg: '#92400E', bg: '#FEF3C7', border: '#FDE68A', accent: '#F59E0B' },
    error: { fg: '#991B1B', bg: '#FEF2F2', border: '#FECACA', accent: '#DC2626' },
  },

  /** 4px grid. */
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },

  radius: { sm: 8, md: 10, lg: 12, xl: 16, pill: 999 },

  /** One height for inputs; the primary button is taller for thumb reach. */
  control: { height: 52, radius: 12 },
  button: { height: 54, radius: 12 },

  /** Icon tile beside a section or heading. */
  tile: { size: 48, radius: 14 },

  maxWidth: 440,

  cardShadow: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  /** The sticky footer lifts off the content it covers. */
  footerShadow: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 12,
  },
} as const;

export type AuthTone = 'success' | 'info' | 'warning' | 'error';

/** Back-compat alias for screens still importing the old name. */
export const AUTH_DS = AUTH;
