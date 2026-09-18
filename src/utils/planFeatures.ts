// ═══════════════════════════════════════════════════════
// FinMatrix — Plan feature lines
// ═══════════════════════════════════════════════════════
// The server once listed "Everything in Large Organization" on every warehouse
// plan — a tier no longer sold or shown — so a plan card told the reader it
// includes something they could not see. The server copy now stands on its own;
// this keeps a card honest if an older server, or a cached response, still
// sends the old line. The website applies the same rule in src/models/plan.ts.

const ACCOUNTING_FEATURE = 'Complete accounting: invoices, bills, payments, tax & reports';
const PEOPLE_FEATURE = 'Payroll, budgets, bank reconciliation & team roles';

/** What an inherited tier stood for, in the words the server now uses. */
const INHERITED_FEATURES: Record<string, string[]> = {
  'small business': [ACCOUNTING_FEATURE],
  'large organization': [ACCOUNTING_FEATURE, PEOPLE_FEATURE],
};

/**
 * A plan's feature list with no line pointing at another plan: an "Everything
 * in <tier>" line becomes what that tier included, or is dropped when the tier
 * is unknown. Order is kept and duplicates removed; anything else passes
 * through unchanged.
 */
export const resolvePlanFeatures = (features: readonly unknown[] | null | undefined): string[] => {
  const out: string[] = [];
  for (const feature of features ?? []) {
    if (typeof feature !== 'string' || feature.trim().length === 0) continue;
    const inherited = /^everything in (.+?)\.?$/i.exec(feature.trim());
    const lines = inherited
      ? INHERITED_FEATURES[inherited[1].trim().toLowerCase()] ?? []
      : [feature];
    for (const line of lines) if (!out.includes(line)) out.push(line);
  }
  return out;
};
