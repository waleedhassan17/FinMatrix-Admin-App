// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Super admin serializers
// ═══════════════════════════════════════════════════════
// These were `unwrapEnvelope(res) as T` -- casts, which check nothing at
// runtime. The dashboard reads stats.companies.pending behind a `stats ?`
// truthiness check that {} passes, so a malformed body was a white screen
// rather than a zeroed one. Nothing here should ever throw.

import {
  platformStatsResponseSerializer,
  companyListResponseSerializer,
  companyStatusResponseSerializer,
  companyDetailResponseSerializer,
  planListResponseSerializer,
  subscriptionListResponseSerializer,
} from '../superAdminSerializer';

const MALFORMED: [label: string, body: unknown][] = [
  ['undefined', undefined],
  ['null', null],
  ['an empty object', {}],
  ['a null envelope', { data: null }],
  ['an empty envelope', { data: {} }],
  ['a string where an object belongs', { data: 'nope' }],
  ['an array where an object belongs', { data: [] }],
];

describe('platformStatsResponseSerializer', () => {
  it.each(MALFORMED)('returns a renderable shape for %s', (_label, input) => {
    const stats = platformStatsResponseSerializer(input);

    // The exact reads SuperAdminDashboardScreen performs without optional
    // chaining. Each of these used to throw.
    expect(stats.companies.pending).toBe(0);
    expect(stats.companies.active).toBe(0);
    expect(stats.subscriptions.totalPlans).toBe(0);
    expect(stats.recentRegistrations.length).toBe(0);
  });

  it('reads a well-formed payload through unchanged', () => {
    const stats = platformStatsResponseSerializer({
      data: {
        companies: { total: 5, pending: 2, active: 3, suspended: 0, rejected: 0, recentWeek: 1 },
        subscriptions: { totalPlans: 6, totalSubscriptions: 3, activeSubscriptions: 3 },
        recentRegistrations: [
          { id: 'c1', name: 'Karachi Traders', industry: 'Retail', email: 'a@b.pk', status: 'pending', createdAt: '2026-09-01' },
        ],
      },
    });

    expect(stats.companies.pending).toBe(2);
    expect(stats.recentRegistrations[0].name).toBe('Karachi Traders');
  });

  it('falls back to `inactive` when the server omits `suspended`', () => {
    // The server sends both names for the same bucket.
    const stats = platformStatsResponseSerializer({
      data: { companies: { inactive: 7 } },
    });

    expect(stats.companies.suspended).toBe(7);
  });

  it('drops a non-numeric count rather than rendering NaN', () => {
    const stats = platformStatsResponseSerializer({
      data: { companies: { pending: '12' } },
    });

    expect(stats.companies.pending).toBe(0);
  });
});

describe('companyListResponseSerializer', () => {
  it.each(MALFORMED)('returns an empty page for %s', (_label, input) => {
    const page = companyListResponseSerializer(input);

    expect(page.data).toEqual([]);
    expect(page.total).toBe(0);
  });

  it('gives every row the fields the list renders', () => {
    // CompanyCard does name.slice(0, 2) and keyExtractor reads item.id.
    const page = companyListResponseSerializer({ data: { data: [{}], pagination: {} } });

    expect(typeof page.data[0].name).toBe('string');
    expect(() => page.data[0].name.slice(0, 2)).not.toThrow();
    expect(typeof page.data[0].id).toBe('string');
    expect(page.data[0].isTrial).toBe(false);
  });

  it('reads the page count from `pages`, not `totalPages`', () => {
    const page = companyListResponseSerializer({
      data: { data: [], pagination: { page: 2, limit: 20, total: 137, pages: 7 } },
    });

    expect(page.pages).toBe(7);
    expect(page.page).toBe(2);
    expect(page.total).toBe(137);
  });

  it('carries the trial fields through', () => {
    const page = companyListResponseSerializer({
      data: {
        data: [{ id: 'c1', name: 'T', isTrial: true, trialStartedAt: '2026-09-01' }],
        pagination: {},
      },
    });

    expect(page.data[0].isTrial).toBe(true);
    expect(page.data[0].trialStartedAt).toBe('2026-09-01');
  });
});

describe('companyStatusResponseSerializer', () => {
  it.each(MALFORMED)('still returns an id field for %s', (_label, input) => {
    // The slice indexes state.companies by this id; undefined made findIndex
    // return -1 and the row silently never updated.
    expect(typeof companyStatusResponseSerializer(input).id).toBe('string');
  });

  it('reads a well-formed result through', () => {
    const result = companyStatusResponseSerializer({
      data: { id: 'c1', name: 'Karachi Traders', status: 'approved', rejectionReason: null },
    });

    expect(result.id).toBe('c1');
    expect(result.status).toBe('approved');
  });
});

describe('companyDetailResponseSerializer', () => {
  it.each(MALFORMED)('returns empty collections for %s', (_label, input) => {
    const detail = companyDetailResponseSerializer(input);

    expect(detail.members).toEqual([]);
    expect(detail.subscriptions).toEqual([]);
  });

  it('rejects a companyType the model does not know', () => {
    const detail = companyDetailResponseSerializer({
      data: { companyType: 'something_else' },
    });

    expect(detail.companyType).toBeNull();
  });

  it('keeps a known companyType', () => {
    expect(
      companyDetailResponseSerializer({ data: { companyType: 'warehouse' } }).companyType,
    ).toBe('warehouse');
  });
});

describe('planListResponseSerializer', () => {
  it.each(MALFORMED)('returns an empty list for %s', (_label, input) => {
    expect(planListResponseSerializer(input)).toEqual([]);
  });

  it('keeps prices as strings so Number() cannot render NaN', () => {
    const plans = planListResponseSerializer({ data: [{ id: 'p1', priceMonthly: null }] });

    expect(plans[0].priceMonthly).toBe('0');
    expect(Number.isNaN(Number(plans[0].priceMonthly))).toBe(false);
  });
});

describe('subscriptionListResponseSerializer', () => {
  it.each(MALFORMED)('returns an empty page for %s', (_label, input) => {
    expect(subscriptionListResponseSerializer(input).data).toEqual([]);
  });

  it('tolerates a subscription with no nested plan', () => {
    const page = subscriptionListResponseSerializer({
      data: { data: [{ id: 's1', companyId: 'c1', planId: 'p1' }], pagination: {} },
    });

    expect(page.data[0].plan).toBeNull();
  });
});
