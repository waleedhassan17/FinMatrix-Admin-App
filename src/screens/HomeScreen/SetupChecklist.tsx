// ═══════════════════════════════════════════════════════
// FinMatrix — Guided first-run setup checklist (FinMatrixGuide §5.7)
// Surfaces existing flows in accounting order. The headline CTA is
// "Add Opening Balances" → the General Journal opening-entry flow.
// No new accounting logic — pure navigation/onboarding wrapper.
// ═══════════════════════════════════════════════════════

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { THEME } from '../../utils/theme';
import type { SetupStatus } from './adminDashboardSlice';

// Design-system tokens (see src/theme/theme.ts).
const { colors } = THEME;

const FONT = THEME.typography.fontFamily;

export interface SetupStep {
  key: keyof SetupStatus['steps'];
  label: string;
  hint: string;
  icon: keyof typeof Feather.glyphMap;
  /**
   * Screen name within DashboardStack.
   *
   * These screens live primarily in the Transactions / More / Inventory tab
   * stacks, but the checklist is an onboarding flow launched from the
   * dashboard, so each is ALSO registered in DashboardStack and pushed there.
   * That keeps the flow self-contained: the back arrow returns to the
   * dashboard instead of surfacing inside another tab's history.
   *
   * Named rather than `string`: the dashboard stack now also carries screens
   * that REQUIRE params (an invoice detail needs an invoiceId), and
   * `navigate(someString as keyof ParamList)` cannot be sound once that is
   * true — it would compile while sending a screen no id at all. Listing the
   * destinations keeps the cast unnecessary and makes an unregistered one a
   * compile error rather than a tap that does nothing.
   */
  screen:
    | 'OpeningBalance'
    | 'COAList'
    | 'InventoryForm'
    | 'CustomerForm'
    | 'VendorForm';
  // | 'TaxSettings'   ← SHELVED, restore with the step below
  optional?: boolean;
  /** Tier gate, checked with isFeatureVisible before the row renders. */
  feature?: string;
}

// Accounting order — each item routes to the EXISTING screen/flow.
export const SETUP_STEPS: SetupStep[] = [
  {
    key: 'openingBalance',
    label: 'Add Opening Balances',
    hint: 'Tell us what your business already has — we guide you',
    icon: 'edit-3',
    screen: 'OpeningBalance'
  },
  {
    key: 'chartOfAccounts',
    label: 'Review Chart of Accounts',
    hint: 'Check the seeded accounts and add any you need',
    icon: 'book-open',
    screen: 'COAList'
  },
  {
    key: 'inventory',
    label: 'Add Inventory items',
    hint: 'Optional — skip if you are a service business',
    icon: 'package',
    // Warehouse-only: a service business has no stock to add, and the
    // small-business / large-org tiers ship no inventory screens at all.
    screen: 'InventoryForm',
    optional: true,
    feature: 'inventory'
  },
  {
    key: 'customers',
    label: 'Add Customers',
    hint: 'So you can raise invoices',
    icon: 'users',
    screen: 'CustomerForm'
  },
  {
    key: 'vendors',
    label: 'Add Vendors',
    hint: 'So you can record bills',
    icon: 'truck',
    screen: 'VendorForm'
  },
  // SHELVED (Tax Management). Uncomment together with 'TaxSettings' in the
  // screen union above and the route registrations in navigations-maps —
  // a step whose destination is not registered is a tap that does nothing.
  // {
  //   key: 'taxRates',
  //   label: 'Set Tax rates',
  //   hint: 'Configure the sales tax you charge',
  //   icon: 'percent',
  //   screen: 'TaxSettings'
  // },
];

interface Props {
  setup: SetupStatus;
  onNavigate: (step: SetupStep) => void;
  onDismiss: () => void;
  /** Defaults to every step; the dashboard passes a tier-filtered list. */
  steps?: SetupStep[];
}

const C = {
  surface: THEME.colors.neutral0,
  line: THEME.colors.border,
  ink: THEME.colors.neutral900,
  ink2: THEME.colors.neutral600,
  ink3: colors.textTertiary,
  brand: THEME.colors.actionGreenDark,
  brandSoft: THEME.colors.primaryLighter,
  done: THEME.colors.success
};

const SetupChecklist: React.FC<Props> = ({
  setup,
  onNavigate,
  onDismiss,
  steps = SETUP_STEPS
}) => {
  // Progress counts only the steps actually shown, so a tier without
  // inventory does not sit permanently at "5 of 6 done".
  const doneCount = steps.filter(s => setup.steps[s.key]).length;
  const total = steps.length;

  return (
    <View style={st.card}>
      <View style={st.header}>
        <View style={st.headerIcon}>
          <Feather name="check-circle" size={18} color={C.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.title}>Finish setting up your books</Text>
          <Text style={st.sub}>
            {doneCount} of {total} done · tap an item to continue
          </Text>
        </View>
        <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={st.dismiss}>Dismiss</Text>
        </TouchableOpacity>
      </View>

      <View style={st.track}>
        <View
          style={[
            st.trackFill,
            { width: `${total === 0 ? 0 : (doneCount / total) * 100}%` },
          ]}
        />
      </View>

      {steps.map(step => {
        const done = setup.steps[step.key];
        return (
          <TouchableOpacity
            key={step.key}
            style={st.row}
            activeOpacity={0.7}
            onPress={() => onNavigate(step)}
          >
            <View style={[st.check, done && st.checkDone]}>
              {done ? (
                <Feather name="check" size={14} color={colors.neutral0} />
              ) : (
                <Feather name={step.icon} size={14} color={C.ink3} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[st.rowLabel, done && st.rowLabelDone]}>
                {step.label}
                {step.optional ? '  ·  optional' : ''}
              </Text>
              <Text style={st.rowHint}>{done ? 'Done' : step.hint}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={C.ink3} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const st = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
    marginBottom: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  title: { ...THEME.typography.labelLg, color: C.ink, fontFamily: FONT },
  sub: { ...THEME.typography.caption, color: C.ink2, fontFamily: FONT, marginTop: 2 },
  dismiss: { ...THEME.typography.labelMd, color: C.ink3, fontFamily: FONT },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.neutral100,
    overflow: 'hidden',
    marginBottom: 12,
  },
  trackFill: { height: 6, borderRadius: 3, backgroundColor: C.brand },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.neutral100,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkDone: { backgroundColor: C.done, borderColor: C.done },
  rowLabel: { ...THEME.typography.h5, color: C.ink, fontFamily: FONT },
  rowLabelDone: { color: C.ink2 },
  rowHint: { ...THEME.typography.caption, color: C.ink3, fontFamily: FONT, marginTop: 1 }
});

export default SetupChecklist;
