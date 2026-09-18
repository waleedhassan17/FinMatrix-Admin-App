// ═══════════════════════════════════════════════════════
// FinMatrix — cross-tab hops must carry `initial: false`
// ═══════════════════════════════════════════════════════
// navigate('TransactionsStack', { screen: 'POForm' }) builds the target
// navigator's state from the nested params, and that state holds ONLY the
// screen asked for — the stack's own initial route is never placed underneath
// (@react-navigation/core, getStateFromParams). So on a stack the user has not
// visited yet, back has nothing to pop, falls through to the tab navigator,
// and lands on its first tab — the Dashboard — while stranding the screen on
// the tab it was pushed to, which then reopens it instead of its hub.
//
// `initial: false` makes the navigator build its real initial state first, and
// the nested params still ride along on the navigate it dispatches.
//
// This test reads source text, which no other suite here does. That is
// deliberate: the invariant has to bind hops that do not exist yet, and an
// import-based test can only assert about the call sites written today. The
// bug it guards shipped once already.

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const SRC = join(__dirname, '..', '..');

/** Hops whose target already IS that stack's initial route, where the flag
 *  would be a no-op. Initial route = the first entry of each navigations-map:
 *  TransactionsHub, InventoryList, StaffMoreHub, MoreHub, ReportsHub. */
const EXEMPT: { file: string; screen: string }[] = [
  // Dashboard's inventory card and its empty-state action.
  { file: 'HomeScreen/AdminDashboardScreen.tsx', screen: 'InventoryList' },
  // Dashboard's "recent transactions" section action.
  { file: 'HomeScreen/AdminDashboardScreen.tsx', screen: 'TransactionsHub' },
];

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return entry === '__tests__' ? [] : walk(full);
    }
    return /\.tsx?$/.test(full) ? [full] : [];
  });

/** Every `navigate(...)` whose first argument names a tab stack, plus the
 *  dynamic global-search hop. Returns the call text up to its closing paren. */
const findHops = (source: string) => {
  const hops: { target: string; screen: string; text: string }[] = [];
  const call = /\.?navigate\(\s*(?:'(\w*Stack)'|"(\w*Stack)"|(item\.stack))/g;

  let match: RegExpExecArray | null;
  while ((match = call.exec(source)) !== null) {
    const target = match[1] ?? match[2] ?? match[3];
    // Walk to the matching close paren so multi-line calls are captured whole.
    let depth = 0;
    let end = match.index;
    for (let i = source.indexOf('(', match.index); i < source.length; i++) {
      if (source[i] === '(') depth++;
      else if (source[i] === ')') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    const text = source.slice(match.index, end + 1);
    // Only nested hops matter — `navigate('SomeStack')` with no screen lands on
    // the stack's own initial route and needs nothing.
    if (!/\bscreen\s*:/.test(text)) continue;
    const screenMatch = /\bscreen\s*:\s*'([\w.]+)'|\bscreen\s*:\s*(item\.routeName)/.exec(text);
    hops.push({ target, screen: screenMatch?.[1] ?? screenMatch?.[2] ?? '(dynamic)', text });
  }
  return hops;
};

const screensDir = join(SRC, 'screens');
const allHops = walk(screensDir).flatMap(file => {
  const rel = file.slice(screensDir.length + 1);
  return findHops(readFileSync(file, 'utf8')).map(hop => ({ ...hop, file: rel }));
});

const isExempt = (hop: { file: string; screen: string }) =>
  EXEMPT.some(e => e.file === hop.file && e.screen === hop.screen);

describe('cross-tab navigation', () => {
  it('finds the hops it is meant to be guarding', () => {
    // A regex that silently matches nothing would make every assertion below
    // vacuously true.
    expect(allHops.length).toBeGreaterThanOrEqual(10);
  });

  it.each(allHops.filter(h => !isExempt(h)).map(h => [`${h.file} → ${h.target}/${h.screen}`, h]))(
    '%s carries initial: false',
    (_label, hop) => {
      const h = hop as { text: string; file: string; target: string; screen: string };
      if (!/initial\s*:\s*false/.test(h.text)) {
        throw new Error(
          `${h.file} navigates to ${h.target}/${h.screen} without \`initial: false\`.\n` +
            `On a stack the user has not opened yet this leaves back going to the Dashboard ` +
            `and strands ${h.screen} on the ${h.target} tab.\n` +
            `Add \`initial: false\` alongside \`screen\` and \`params\`, or — if ${h.screen} is ` +
            `that stack's initial route — add it to EXEMPT in this file with a note.`,
        );
      }
    },
  );

  it('keeps the exemption list short and deliberate', () => {
    // Each exemption is a hop nobody is checking. Growing this list should be
    // a conscious act, not a way to silence the test above.
    expect(EXEMPT).toHaveLength(2);
    for (const exempt of EXEMPT) {
      expect(allHops.some(h => h.file === exempt.file && h.screen === exempt.screen)).toBe(true);
    }
  });
});
