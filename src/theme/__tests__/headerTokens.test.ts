import { HEADER_BG, HEADER_NAVY, HEADER_RADIUS } from '../index';
import { AUTH } from '../../components/auth/authTokens';

/**
 * The header is one surface across the whole product.
 *
 * It has drifted apart twice: first the colour (a flat auth header against a
 * three-stop app gradient), then — after the colour was fixed — a white sheen
 * and a 4px corner difference that still made them look unrelated. Both times
 * the cause was the same: the values lived in two places and nothing compared
 * them.
 *
 * These also assert the tokens are actually exported. They are consumed inside
 * `StyleSheet.create` at module scope, so a missing export is a runtime
 * ReferenceError on first render rather than anything TypeScript would catch.
 */
describe('header tokens', () => {
  it('are exported and usable', () => {
    expect(typeof HEADER_BG).toBe('string');
    expect(typeof HEADER_RADIUS).toBe('number');
    expect(Array.isArray(HEADER_NAVY)).toBe(true);
  });

  it('paint the same colour in the app as in the auth flow', () => {
    expect(HEADER_BG).toBe(AUTH.header.bg);
  });

  it('use the same corner radius as the auth flow', () => {
    expect(HEADER_RADIUS).toBe(AUTH.header.radius);
  });

  it('are flat — every gradient stop is the same colour', () => {
    // Kept as an array so `LinearGradient colors={HEADER_NAVY}` and the many
    // `HEADER_NAVY[0]` safe-area backgrounds keep working unchanged.
    expect(new Set(HEADER_NAVY).size).toBe(1);
    expect(HEADER_NAVY[0]).toBe(HEADER_BG);
  });
});
