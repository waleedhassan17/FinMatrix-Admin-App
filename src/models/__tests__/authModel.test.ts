// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Password rules
// ═══════════════════════════════════════════════════════
// ForgotPasswordScreen used to carry its own pattern:
//
//   /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8}$/
//
// `.{8}` with a `$` anchor matches EXACTLY eight characters, so a perfectly
// good twelve-character password was refused -- under a message that said
// "8+ chars". The rule now lives beside getPasswordStrength, which had the
// floor right all along. The nine-character case below is the one that failed.

import {
  getPasswordStrength,
  isValidPassword,
  PASSWORD_MIN_LENGTH,
} from '../authModel';

describe('isValidPassword', () => {
  it('accepts a password at exactly the minimum length', () => {
    expect(isValidPassword('Abcdef1g')).toBe(true);
  });

  it('accepts a password longer than the minimum', () => {
    // The regression. Nine characters, all three classes present.
    expect(isValidPassword('Abcdef1gh')).toBe(true);
    expect(isValidPassword('Abcdefgh1jklmnop')).toBe(true);
  });

  it('rejects a password shorter than the minimum', () => {
    expect(isValidPassword('Abcde1f')).toBe(false);
  });

  it('rejects a password missing a character class', () => {
    expect(isValidPassword('abcdefg1')).toBe(false); // no uppercase
    expect(isValidPassword('ABCDEFG1')).toBe(false); // no lowercase
    expect(isValidPassword('Abcdefgh')).toBe(false); // no digit
  });

  it('rejects an empty password', () => {
    expect(isValidPassword('')).toBe(false);
  });

  it('agrees with getPasswordStrength on the length floor', () => {
    // These two disagreed for as long as they lived in separate files, which is
    // how a wrong rule sat next to a right one without anyone noticing.
    const tooShort = 'Abc1def';
    const longEnough = 'Abc1defg';

    expect(tooShort.length).toBe(PASSWORD_MIN_LENGTH - 1);
    expect(isValidPassword(tooShort)).toBe(false);
    expect(getPasswordStrength(tooShort)).toBe('weak');

    expect(isValidPassword(longEnough)).toBe(true);
    expect(getPasswordStrength(longEnough)).not.toBe('weak');
  });
});
