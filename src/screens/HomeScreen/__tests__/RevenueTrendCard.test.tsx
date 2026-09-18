// Feather reaches for expo-font → expo-modules-core, which has no native side
// under Jest. The card uses it only as a leaf, so a host-component stub is
// enough and keeps this suite dependency-free.
jest.mock('@expo/vector-icons', () => ({ Feather: 'Feather' }));

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import RevenueTrendCard, {
  buildRevenueWindow,
  WINDOW_MONTHS,
} from '../RevenueTrendCard';
import type { TrendPoint } from '../../../models/analyticsDashboardModel';

/**
 * These RENDER the card rather than type-check it. A `ReferenceError` from a
 * variable left behind in a refactor — which is exactly what reached the dev
 * server as "lastIdx is not defined" — fails here instead of in the app.
 */

const render = (points: TrendPoint[] | null) => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<RevenueTrendCard points={points} />);
  });
  return tree;
};

/**
 * Every value the card drew, as text. Numbers count: "Total · {n} mo" renders
 * its count as a numeric child, so a string-only filter silently drops it.
 */
const drawnText = (tree: renderer.ReactTestRenderer): string =>
  tree.root
    .findAll(() => true)
    .flatMap(n => {
      const c = n.props?.children;
      return Array.isArray(c) ? c : [c];
    })
    .filter(c => typeof c === 'string' || typeof c === 'number')
    .map(String)
    .join(' ')
    // Children arrive split around their interpolations ('Total · ', 2, ' mo'),
    // so joining doubles the spaces. Collapse them or every assertion has to
    // know how the JSX happens to be broken up.
    .replace(/\s+/g, ' ');

/**
 * The bar columns. findAll walks composite AND host nodes, so a Touchable
 * shows up several times over with the same props — dedupe on the label, which
 * is unique per month.
 */
const columns = (tree: renderer.ReactTestRenderer) => {
  const byLabel = new Map<string, renderer.ReactTestInstance>();
  for (const n of tree.root.findAll(
    n =>
      typeof n.props?.accessibilityLabel === 'string' &&
      typeof n.props?.accessibilityState?.disabled === 'boolean',
  )) {
    if (!byLabel.has(n.props.accessibilityLabel)) byLabel.set(n.props.accessibilityLabel, n);
  }
  return [...byLabel.values()];
};

const ONE_MONTH: TrendPoint[] = [{ label: 'Aug 26', value: 23000 }];

describe('RevenueTrendCard — renders for every shape the API can return', () => {
  const shapes: [string, TrendPoint[] | null][] = [
    ['null (analytics request failed)', null],
    ['empty array (no revenue yet)', []],
    ['one month — the reported case', ONE_MONTH],
    ['one month at zero', [{ label: 'Aug 26', value: 0 }]],
    ['two months', [{ label: 'Jul 26', value: 10 }, { label: 'Aug 26', value: 23 }]],
    ['a full window', [
      { label: 'Apr 26', value: 1 }, { label: 'May 26', value: 2 },
      { label: 'Jun 26', value: 3 }, { label: 'Jul 26', value: 4 },
      { label: 'Aug 26', value: 5 },
    ]],
    ['a gap in the middle', [{ label: 'May 26', value: 2 }, { label: 'Aug 26', value: 7 }]],
    ['a series ending before the current month', [{ label: 'Jun 26', value: 9 }]],
    ['a label carrying no year', [{ label: 'Aug', value: 23 }]],
    ['every month zero', [{ label: 'Jul 26', value: 0 }, { label: 'Aug 26', value: 0 }]],
    ['a negative month', [{ label: 'Aug 26', value: -500 }]],
    ['a point older than the window', [{ label: 'Jan 26', value: 5 }]],
  ];

  it.each(shapes)('%s', (_name, points) => {
    expect(() => render(points)).not.toThrow();
  });
});

describe('RevenueTrendCard — the chart is the calendar, not the data', () => {
  it('always draws a full window of columns, even for one month', () => {
    expect(columns(render(ONE_MONTH))).toHaveLength(WINDOW_MONTHS);
    // …and for a company whose first month is still at zero.
    expect(columns(render([{ label: 'Aug 26', value: 0 }]))).toHaveLength(WINDOW_MONTHS);
  });

  it('shows the empty state rather than an axis when there is nothing at all', () => {
    // No revenue ever, and a failed request, are told apart in words — neither
    // draws a chart of five empty months.
    expect(columns(render([]))).toHaveLength(0);
    expect(drawnText(render([]))).toContain('No revenue yet');
    expect(columns(render(null))).toHaveLength(0);
    expect(drawnText(render(null))).toContain('Revenue history unavailable');
  });

  it('puts the only month in ITS slot and leaves the rest as empty stubs', () => {
    const cols = columns(render(ONE_MONTH));
    // Disabled === no data. Four quiet months, and the one that earned.
    expect(cols.filter(c => c.props.accessibilityState.disabled)).toHaveLength(WINDOW_MONTHS - 1);

    // Found by LABEL, not by index. The window is the five months ending
    // today, so where 'Aug 26' sits depends on when the suite runs: it was the
    // rightmost slot through August 2026 and moved along on 1 September, which
    // is what used to break this test every month. The component was right the
    // whole time — a series that ends before the current month is the normal
    // case, since this month has usually earned nothing yet.
    const earned = cols.filter(c => !c.props.accessibilityState.disabled);
    expect(earned).toHaveLength(1);
    expect(earned[0].props.accessibilityLabel).toContain('Aug');
  });

  it('labels every slot, including the months with nothing in them', () => {
    const drawn = drawnText(render(ONE_MONTH));
    for (const slot of buildRevenueWindow(ONE_MONTH)) {
      expect(drawn).toContain(slot.short);
    }
  });

  it('an empty month is inert rather than a tap that does nothing', () => {
    const cols = columns(render(ONE_MONTH));
    expect(cols[0].props.disabled).toBe(true);
    expect(() => act(() => { cols[0].props.onPress?.(); })).not.toThrow();
  });
});

describe('RevenueTrendCard — the footer says something true', () => {
  it('a single month explains itself instead of repeating the headline', () => {
    const drawn = drawnText(render(ONE_MONTH));
    expect(drawn).toContain('First month of revenue');
    expect(drawn).not.toContain('Average / month');
  });

  it('two months earn a real average and total', () => {
    const drawn = drawnText(render([
      { label: 'Jul 26', value: 10 }, { label: 'Aug 26', value: 30 },
    ]));
    expect(drawn).toContain('Average / month');
    expect(drawn).toContain('Total');
    expect(drawn).not.toContain('First month of revenue');
  });

  it('counts months that earned, not the width of the window', () => {
    // Two months of data inside a five-slot window must read "2 mo", or the
    // average would be divided by the empty slots too.
    expect(drawnText(render([
      { label: 'Jul 26', value: 10 }, { label: 'Aug 26', value: 30 },
    ]))).toContain('2 mo');
  });
});

describe('buildRevenueWindow — placement', () => {
  const shape = (points: TrendPoint[], now = new Date(2026, 7, 15)) => {
    // Freeze "today" so the window is deterministic.
    const RealDate = Date;
    // @ts-expect-error — narrow stub, restored immediately below.
    global.Date = class extends RealDate {
      constructor(...args: never[]) {
        super(...(args.length ? args : [now.getTime()]) as []);
      }
      static now() { return now.getTime(); }
    };
    try {
      return buildRevenueWindow(points)
        .map(s => `${s.short}${s.point ? `=${s.point.value}` : '·'}`)
        .join(' ');
    } finally {
      global.Date = RealDate;
    }
  };

  it('anchors the newest month on the right', () => {
    expect(shape([{ label: 'Aug 26', value: 23 }])).toBe('Apr· May· Jun· Jul· Aug=23');
  });

  it('keeps the gap on the right when the series ends early', () => {
    expect(shape([{ label: 'Jun 26', value: 9 }])).toBe('Apr· May· Jun=9 Jul· Aug·');
  });

  it('preserves a hole in the middle', () => {
    expect(shape([{ label: 'May 26', value: 2 }, { label: 'Aug 26', value: 7 }]))
      .toBe('Apr· May=2 Jun· Jul· Aug=7');
  });

  it('rejects a same-month point from the wrong year', () => {
    expect(shape([{ label: 'Aug 25', value: 99 }])).toBe('Apr· May· Jun· Jul· Aug·');
  });

  it('spans a year boundary', () => {
    expect(shape(
      [{ label: 'Dec 25', value: 4 }, { label: 'Jan 26', value: 6 }],
      new Date(2026, 0, 10),
    )).toBe('Sep· Oct· Nov· Dec=4 Jan=6');
  });
});
