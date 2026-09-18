import { doorAmounts, partialAmountError } from '../deliveryCollection';

const crates = (deliveredQty: number) => [{ deliveredQty, unitPrice: 150, taxRate: 10 }];

describe('doorAmounts', () => {
  it('collects the whole sale when nothing was paid in advance', () => {
    expect(doorAmounts(crates(2), { advanceAmount: 0, prepaid: false })).toEqual({
      gross: 330,
      advanceApplied: 0,
      amountDue: 330,
      nothingDue: false,
    });
  });

  it('collects only what a part advance leaves', () => {
    const a = doorAmounts(crates(2), { advanceAmount: 100, prepaid: false });
    expect(a.amountDue).toBe(230);
    expect(a.nothingDue).toBe(false);
  });

  it('collects nothing on a prepaid delivery', () => {
    expect(doorAmounts(crates(2), { advanceAmount: 330, prepaid: true }).nothingDue).toBe(true);
  });

  it('treats an older prepaid delivery with no recorded amount as fully paid', () => {
    expect(doorAmounts(crates(3), { advanceAmount: 0, prepaid: true })).toMatchObject({
      advanceApplied: 495,
      amountDue: 0,
      nothingDue: true,
    });
  });

  it('collects nothing when returns bring the sale under the advance', () => {
    // 495 paid for 3; the customer keeps 2 (330).
    expect(doorAmounts(crates(2), { advanceAmount: 495, prepaid: true })).toMatchObject({
      advanceApplied: 330,
      amountDue: 0,
      nothingDue: true,
    });
  });

  it('works in paisa, not floating point', () => {
    const a = doorAmounts([{ deliveredQty: 3, unitPrice: 0.1, taxRate: 0 }], { advanceAmount: 0.2 });
    expect(a.amountDue).toBe(0.1);
  });
});

describe('partialAmountError', () => {
  it('needs an amount above zero and no more than is due', () => {
    expect(partialAmountError('', 230)).toBeTruthy();
    expect(partialAmountError('abc', 230)).toBeTruthy();
    expect(partialAmountError('0', 230)).toMatch(/NOT PAID/);
    expect(partialAmountError('230.01', 230)).toBeTruthy();
    expect(partialAmountError('100', 230)).toBeUndefined();
    expect(partialAmountError('1,00', 230)).toBeUndefined();
    expect(partialAmountError('230', 230)).toBeUndefined();
  });
});
