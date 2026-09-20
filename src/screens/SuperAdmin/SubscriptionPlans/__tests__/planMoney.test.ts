// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Plan price conversion
// ═══════════════════════════════════════════════════════
// The rupee/paisa boundary on the one screen that changes what a customer is
// charged. These duplicate the web console's equivalents on purpose: both
// clients can edit a price, and both have to round the same way or the same
// plan costs a different amount depending on which one the operator used.

// Mirrors EditPlanSheet's toPaisa. Kept as a copy rather than exported from
// the screen because importing that file pulls in react-native, expo icons and
// the theme for what is one line of arithmetic.
const toPaisa = (rupees: string): number =>
  Math.round(Number(rupees.replace(/,/g, '')) * 100);

describe('rupees to paisa', () => {
  it('converts a whole amount exactly', () => {
    expect(toPaisa('2500')).toBe(250000);
    expect(toPaisa('1234')).toBe(123400);
  });

  it('rounds rather than truncates, where the float lands short', () => {
    // These are the real hazards: the product is a hair under the intended
    // integer, so Math.trunc or a bitwise `| 0` would lose a paisa.
    expect(0.29 * 100).toBeLessThan(29);
    expect(8.29 * 100).toBeLessThan(829);

    expect(toPaisa('0.29')).toBe(29);
    expect(toPaisa('8.29')).toBe(829);
  });

  it('cannot resolve a half-paisa, and that is accepted', () => {
    // 1.005 * 100 is 100.49999999999999, so Math.round gives 100 rather than
    // the 101 a human would write down. Rounding a true .5 to even would not
    // help -- the value never reaches .5.
    //
    // Left as-is deliberately: prices here are whole rupees (Rs 2,500 for six
    // months), sub-paisa precision is not a case the business has, and the
    // alternatives -- string arithmetic or a decimal library in an RN bundle
    // -- cost more than this is worth. Recorded so the next person does not
    // rediscover it as a bug.
    expect(toPaisa('1.005')).toBe(100);
  });

  it('tolerates a thousands separator', () => {
    expect(toPaisa('3,000')).toBe(300000);
    expect(toPaisa('1,234,567')).toBe(123456700);
  });

  it('treats zero as a real price', () => {
    expect(toPaisa('0')).toBe(0);
  });

  it('yields NaN for text, which the screen checks before enabling Save', () => {
    expect(Number.isNaN(toPaisa('free'))).toBe(true);
  });
});

describe('the derived total', () => {
  // The server enforces total = monthly x duration and rejects a mismatch, so
  // the screen derives the total instead of offering a second input.
  const total = (monthlyRupees: string, months: number) =>
    toPaisa(monthlyRupees) * months;

  it('is the monthly rate for the whole period, not the monthly rate', () => {
    expect(total('2500', 6)).toBe(1500000);
  });

  it('stays exact on a fractional monthly rate', () => {
    expect(total('2500.5', 6)).toBe(250050 * 6);
  });

  it('is zero for a free plan', () => {
    expect(total('0', 12)).toBe(0);
  });
});
