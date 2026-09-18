// Native-only leaves stubbed as host components, as the other render suites do.
jest.mock('@expo/vector-icons', () => ({ Feather: 'Feather' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
// The header pulls the Redux store; the queue under test does not need it.
jest.mock('../../../../components/admin/AdminUI', () => ({ AdminScreenHeader: 'AdminScreenHeader' }));
jest.mock('../../../../components/reports/ReportUI', () => ({ HEADER_NAVY: ['#000', '#111'] }));
jest.mock('../../../../utils/alert', () => ({ Alert: { alert: jest.fn() } }));
// useFocusEffect needs a navigator; under test, "focused" means "mounted".
jest.mock('@react-navigation/native', () => {
  const React = jest.requireActual('react');
  return { useFocusEffect: (cb: () => void) => React.useEffect(cb, [cb]) };
});
jest.mock('../../../../networks/billing/billingNetwork', () => ({
  listPaymentSubmissionsAPI: jest.fn(),
  approvePaymentSubmissionAPI: jest.fn(),
  rejectPaymentSubmissionAPI: jest.fn(),
  downloadSubmissionScreenshot: jest.fn(),
}));

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import PaymentSubmissionsScreen from '../PaymentSubmissionsScreen';
import {
  listPaymentSubmissionsAPI,
  rejectPaymentSubmissionAPI,
} from '../../../../networks/billing/billingNetwork';
import type { PaymentSubmissionView } from '../../../../models/billingModel';

/**
 * A free-trial request has NO amount and NO screenshot. Rendering it like a
 * payment — "Rs 0", a dead screenshot link, "records Rs 0 in platform revenue"
 * — is the most likely regression of the whole feature, so these render the
 * queue with a trial and a payment side by side.
 */

const TRIAL: PaymentSubmissionView = {
  id: 't1',
  companyId: 'c1',
  companyName: 'Trial Traders',
  companyEmail: 'office@trial.pk',
  plan: 'warehouse_trial',
  planLabel: 'Free trial — 30 days',
  kind: 'TRIAL',
  status: 'submitted',
  amountMinorUnits: 0,
  amountLabel: 'Rs 0',
  currency: 'PKR',
  hasScreenshot: false,
  rejectionReason: null,
  reviewedAt: null,
  createdAt: '2026-09-15T00:00:00.000Z',
  requesterName: 'Ayesha Khan',
  requesterEmail: 'ayesha@trial.pk',
  requesterPhone: '+923001234567',
  ageHours: 21.5,
};

const PAYMENT: PaymentSubmissionView = {
  ...TRIAL,
  id: 'p1',
  companyName: 'Paying Co',
  plan: 'warehouse_starter_6mo',
  planLabel: 'Warehouse Starter — 6 months',
  kind: 'NEW',
  amountMinorUnits: 1800000,
  amountLabel: 'Rs 18,000',
  hasScreenshot: true,
  requesterName: undefined,
  requesterEmail: undefined,
  requesterPhone: undefined,
  ageHours: 2,
};

const textOf = (tree: renderer.ReactTestRenderer): string =>
  tree.root
    .findAll(() => true)
    .flatMap(n => {
      const c = n.props?.children;
      return Array.isArray(c) ? c : [c];
    })
    .filter(c => typeof c === 'string' || typeof c === 'number')
    .map(String)
    .join(' | ');

/** Every pressable whose own label is EXACTLY `label` ("Approve", not "Approved"). */
const pressables = (tree: renderer.ReactTestRenderer, label: string) =>
  tree.root
    .findAll(n => typeof n.props?.onPress === 'function')
    .filter(n => {
      const texts = new Set(
        textOf({ root: n } as unknown as renderer.ReactTestRenderer)
          .split(' | ')
          .map(t => t.trim())
          .filter(Boolean),
      );
      return texts.size === 1 && texts.has(label);
    });

/** Press the LAST match — the one in an open modal sits after the list row. */
const pressText = async (tree: renderer.ReactTestRenderer, label: string) => {
  const matches = pressables(tree, label);
  const target = matches[matches.length - 1];
  if (!target) throw new Error(`No pressable labelled "${label}"`);
  await act(async () => {
    await target.props.onPress();
  });
};

const mount = async (rows: PaymentSubmissionView[]) => {
  (listPaymentSubmissionsAPI as jest.Mock).mockResolvedValue(rows);
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<PaymentSubmissionsScreen />);
  });
  return tree;
};

describe('PaymentSubmissionsScreen — free-trial rows', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows who asked and how long they waited, not an amount or a screenshot', async () => {
    const tree = await mount([TRIAL]);
    const text = textOf(tree);

    expect(text).toContain('Ayesha Khan');
    expect(text).toContain('ayesha@trial.pk');
    expect(text).toContain('+923001234567');
    expect(text).toContain('Free trial · 30 days');
    expect(text).toMatch(/Waiting/);
    // Past the 20-hour mark the row says what was promised.
    expect(text).toContain('promised within 24 h');

    expect(text).not.toContain('Rs 0');
    expect(text).not.toContain('Amount');
    expect(text).not.toContain('View transfer screenshot');
  });

  it('still renders a payment row as a payment', async () => {
    const tree = await mount([PAYMENT]);
    const text = textOf(tree);
    expect(text).toContain('Rs 18,000');
    expect(text).toContain('View transfer screenshot');
  });

  it('asks the trial queue oldest-first', async () => {
    const tree = await mount([TRIAL]);
    await pressText(tree, 'Trials');
    expect(listPaymentSubmissionsAPI).toHaveBeenLastCalledWith('submitted', {
      kind: 'TRIAL',
      order: 'asc',
    });
  });

  it('approval copy for a trial promises no revenue', async () => {
    const tree = await mount([TRIAL]);
    await pressText(tree, 'Approve');
    const text = textOf(tree);
    expect(text).toContain('Start free trial');
    expect(text).toContain('No revenue is recorded');
    expect(text).not.toContain('in platform revenue');
  });

  it('plain Reject releases the claim', async () => {
    (rejectPaymentSubmissionAPI as jest.Mock).mockResolvedValue({});
    const tree = await mount([TRIAL]);
    await pressText(tree, 'Reject');

    const input = tree.root.find(n => typeof n.props?.onChangeText === 'function');
    act(() => input.props.onChangeText('Business could not be confirmed'));
    // The modal's primary reject action (the last "Reject" on screen).
    await pressText(tree, 'Reject');

    expect(rejectPaymentSubmissionAPI).toHaveBeenCalledWith(
      't1',
      'Business could not be confirmed',
      false,
    );
  });

  it('Reject & block asks for confirmation before blocking', async () => {
    (rejectPaymentSubmissionAPI as jest.Mock).mockResolvedValue({});
    const tree = await mount([TRIAL]);
    await pressText(tree, 'Reject');
    const input = tree.root.find(n => typeof n.props?.onChangeText === 'function');
    act(() => input.props.onChangeText('Duplicate business'));

    await pressText(tree, 'Reject & block future trials');
    // Nothing sent yet — the irreversible variant is confirmed first.
    expect(rejectPaymentSubmissionAPI).not.toHaveBeenCalled();
    expect(textOf(tree)).toContain('Block future trials?');

    await pressText(tree, 'Reject & block');
    expect(rejectPaymentSubmissionAPI).toHaveBeenCalledWith('t1', 'Duplicate business', true);
  });
});
