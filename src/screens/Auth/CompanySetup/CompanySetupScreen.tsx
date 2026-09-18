// ═══════════════════════════════════════════════════════
// FinMatrix — Workspace Setup (onboarding step 1 of 5)
// ═══════════════════════════════════════════════════════
// First screen an email-verified admin sees when they have no company yet.
// "What happens next" is spelled out because registration is a multi-step
// commitment ending in a payment — people abandon flows whose length they
// can't see.

import React, { useEffect } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppSelector } from '../../../hooks/useReduxHooks';
import { selectActiveCompany } from '../companySlice';
import { ROUTES } from '../../../navigations-maps/Base';
import {
  WAREHOUSE_ONLY_BUILD,
  DEFAULT_COMPANY_TYPE
} from '../../../utils/featureGates';
import type { RootStackParamList } from '../../../types';
import {
  AuthLayout,
  AuthHeader,
  AuthFooterBar,
  AuthOptionCard,
  AuthChips,
  AuthSectionLabel,
  AuthSteps
} from '../../../components/auth/AuthUI';

type Props = NativeStackScreenProps<RootStackParamList, 'CompanySetup'>;

const NEXT_STEPS = [
  // WAREHOUSE-ONLY BUILD: the business-type step is skipped, so the list
  // starts at company details. Restore "Pick the business type that matches
  // how you operate" as step 1 when the three-tier model comes back.
  'Enter registration, address and contact details',
  'Choose a billing period and submit payment',
  'We review and approve — usually within one business day',
];

const CompanySetupScreen: React.FC<Props> = ({ navigation }) => {
  const activeCompany = useAppSelector(selectActiveCompany);

  useEffect(() => {
    if (activeCompany) {
      navigation.reset({ index: 0, routes: [{ name: ROUTES.ADMIN_TABS as any }] });
    }
  }, [activeCompany, navigation]);

  const start = () =>
    WAREHOUSE_ONLY_BUILD
      ? navigation.navigate(ROUTES.CREATE_COMPANY as any, {
          companyType: DEFAULT_COMPANY_TYPE
        })
      : navigation.navigate(ROUTES.COMPANY_TYPE_SELECT as any);

  return (
    <AuthLayout
      header={
        <AuthHeader
          pill="Getting Started"
          title="Set up your workspace"
          subtitle="Register your company to start managing finances, inventory, and deliveries."
          step={{ current: 1, total: 4 }}
        />
      }
      footer={
        <AuthFooterBar
          primary={{ label: 'Get Started', onPress: start }}
          note="Your data is encrypted and secure"
        />
      }>
      {/* Presentational only — "Get Started" below is the single action.
          Two tap targets for one outcome makes the user wonder if they do
          different things. */}
      <AuthOptionCard
        icon="briefcase"
        title="Create New Company"
        badge="New"
        tagline="Register your business, set up agencies, and invite your team members"
        selectable={false}
      />

      <AuthChips items={['Agencies', 'Team', 'Inventory']} />

      <AuthSectionLabel>What happens next</AuthSectionLabel>
      <AuthSteps items={NEXT_STEPS} />
    </AuthLayout>
  );
};

export default CompanySetupScreen;
