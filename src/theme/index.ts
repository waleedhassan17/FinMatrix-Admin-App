/**
 * FinMatrix theme — single canonical module.
 * - THEME / STATUS_CONFIG / PRIORITY_CONFIG (the design system) live in
 *   ./theme.ts and are re-exported here.
 * - The legacy tokens below (colors, spacing, borderRadius, radius, shadows)
 *   predate THEME and are still consumed by older screens; prefer THEME for
 *   new work. Note their names collide with THEME's at different VALUES —
 *   legacy spacing.lg is 24 where THEME's is 20 — so migrate by value, never
 *   by swapping the import.
 * - The legacy `typography` scale has been removed; THEME.typography is the
 *   only type scale and the only place a font family is defined.
 */

export * from './theme';

// LEGACY palette. Still imported by ~20 files, CustomButton among them, which
// is why the accent has to move here too — changing only theme.ts would have
// left every primary button green.
//
// Prefer THEME.colors (./theme) in new code; these values are kept in step
// with it deliberately, not independently.
export const colors = {
  primary: '#1F4E79',
  primaryLight: '#EAF0F6',
  secondary: '#6554C0',
  secondaryLight: '#EAE6FF',
  success: '#00875A',
  successLight: '#E3FCEF',
  warning: '#FF991F',
  warningLight: '#FFFAE6',
  danger: '#DE350B',
  dangerLight: '#FFEBE6',
  info: '#0065FF',
  infoLight: '#E6F0FF',
  background: '#F4F5F7',
  backgroundAlt: '#FAFBFC',
  cardBg: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#FAFBFC',
  textPrimary: '#172B4D',
  textSecondary: '#5E6C84',
  textTertiary: '#8993A4',
  textLight: '#8993A4',
  textDisabled: '#B3BAC5',
  border: '#D3DAE3', // in step with THEME.colors.border
  borderLight: '#EBECF0',
  white: '#FFFFFF',
  overlay: 'rgba(9, 30, 66, 0.54)',
};

// The legacy `typography` scale that used to sit here is gone. Nothing
// imported it, and it was the second of three places that defined a typeface —
// which made "change the brand font in one line" untrue. THEME.typography in
// ./theme.ts is now the only type scale and the only font-family definition.

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const borderRadius = { sm: 8, md: 12, lg: 16 };
// Stage 1 screens use `radius` (incl. a `full` pill value).
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, full: 9999 };

export const shadows = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  small: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  large: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
};
