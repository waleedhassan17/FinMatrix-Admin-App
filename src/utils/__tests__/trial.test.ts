import { daysUntil, isLapsedTrial, trialDaysLeft, waitingLabel } from '../trial';
import type { SubscriptionSummary } from '../../types';

const NOW = new Date('2026-09-15T12:00:00.000Z');
const plus = (days: number) => new Date(NOW.getTime() + days * 86_400_000).toISOString();

const sub = (over: Partial<SubscriptionSummary> = {}): SubscriptionSummary => ({
  plan: 'warehouse_trial',
  planLabel: 'Free trial — 30 days',
  expiryDate: plus(30),
  paymentStatus: 'none',
  isTrial: true,
  trialStartedAt: NOW.toISOString(),
  trialConvertedAt: null,
  ...over,
});

describe('daysUntil', () => {
  it('rounds a partial day up, like the server', () => {
    expect(daysUntil(plus(0.2), NOW)).toBe(1);
    expect(daysUntil(plus(30), NOW)).toBe(30);
  });
  it('is 0 once passed and null when unknown', () => {
    expect(daysUntil(plus(-1), NOW)).toBe(0);
    expect(daysUntil(null, NOW)).toBeNull();
    expect(daysUntil('not a date', NOW)).toBeNull();
  });
});

describe('trialDaysLeft', () => {
  it('counts down a running trial', () => {
    expect(trialDaysLeft(sub(), NOW)).toBe(30);
    expect(trialDaysLeft(sub({ expiryDate: plus(4.5) }), NOW)).toBe(5);
  });
  it('shows nothing once converted to paid', () => {
    expect(trialDaysLeft(sub({ trialConvertedAt: NOW.toISOString() }), NOW)).toBeNull();
  });
  it('shows nothing for a company that never trialed or is only pending', () => {
    expect(trialDaysLeft(sub({ isTrial: false, expiryDate: null }), NOW)).toBeNull();
    expect(trialDaysLeft(null, NOW)).toBeNull();
  });
  it('shows nothing after the trial ended', () => {
    expect(trialDaysLeft(sub({ expiryDate: plus(-0.1) }), NOW)).toBeNull();
  });
});

describe('isLapsedTrial', () => {
  it('is true only for an unconverted trial', () => {
    expect(isLapsedTrial({ isTrial: true, trialConvertedAt: null })).toBe(true);
    expect(isLapsedTrial({ isTrial: true, trialConvertedAt: NOW.toISOString() })).toBe(false);
    expect(isLapsedTrial({ isTrial: false })).toBe(false);
    expect(isLapsedTrial(null)).toBe(false);
  });
});

describe('waitingLabel', () => {
  it('reads naturally at every scale', () => {
    expect(waitingLabel(0.3)).toBe('18 min');
    expect(waitingLabel(5.9)).toBe('5 h');
    expect(waitingLabel(24)).toBe('1 d');
    expect(waitingLabel(28.5)).toBe('1 d 4 h');
  });
});
