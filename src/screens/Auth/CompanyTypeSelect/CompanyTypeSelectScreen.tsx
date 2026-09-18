// ═══════════════════════════════════════════════════════
// FinMatrix — Choose your business type (onboarding step 2)
// ═══════════════════════════════════════════════════════
// WAREHOUSE-ONLY BUILD: this screen is currently bypassed — CompanySetup
// goes straight to CreateCompany with companyType 'warehouse'. It stays in
// the repo and in the route map so deep links still resolve, and so the
// three-tier model can be restored by un-commenting the two cards below
// plus flipping WAREHOUSE_ONLY_BUILD in utils/featureGates.ts.

import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../types';
import {
  AuthLayout,
  AuthHeader,
  AuthFooterBar,
  AuthOptionCard
} from '../../../components/auth/AuthUI';

type Props = NativeStackScreenProps<RootStackParamList, 'CompanyTypeSelect'>;

type CompanyTypeKey = 'small_business' | 'large_org' | 'warehouse';

interface TypeCard {
  key: CompanyTypeKey;
  title: string;
  tagline: string;
  icon: 'briefcase' | 'layers' | 'package';
  badge?: string;
  features: string[];
}

// Feature summaries follow THE MODEL (FinMatrix_Tier_Feature_Guide) so the
// user knows exactly what each type unlocks before choosing.
const TYPE_CARDS: TypeCard[] = [
  // ══ WAREHOUSE-ONLY BUILD ═══════════════════════════════════════════════
  // Small Business and Large Organization are commented out while the
  // product ships warehouse-only.
  //
  // {
  //   key: 'small_business',
  //   title: 'Small Business',
  //   tagline: 'Complete accounting, nothing you don’t need',
  //   icon: 'briefcase',
  //   badge: 'Popular',
  //   features: [
  //     'Invoices, bills, payments & estimates',
  //     'Customers, vendors & chart of accounts',
  //     'Tax tracking built in',
  //     'P&L, Balance Sheet & aging reports',
  //   ],
  // },
  // {
  //   key: 'large_org',
  //   title: 'Large Organization',
  //   tagline: 'Accounting plus people, budgets & control',
  //   icon: 'layers',
  //   features: [
  //     'Everything in Small Business',
  //     'Payroll, employees & payslips',
  //     'Budgets vs actual & team roles',
  //     'Audit log & period close',
  //   ],
  // },
  {
    key: 'warehouse',
    title: 'Warehouse',
    tagline: 'Full inventory & delivery operations',
    icon: 'package',
    features: [
      'Complete accounting: invoices, bills, payments & estimates',
      'Payroll, budgets, audit log & period close',
      'Full inventory with average costing',
      'Purchase orders, 3-way match (GRNI) & deliveries',
    ]
  },
];

const CompanyTypeSelectScreen: React.FC<Props> = ({ navigation }) => {
  const [selected, setSelected] = useState<CompanyTypeKey | null>(
    // With a single type on offer there is nothing to decide — preselect it
    // rather than making the user tap a lone radio to enable Continue.
    TYPE_CARDS.length === 1 ? TYPE_CARDS[0].key : null,
  );

  const handleContinue = () => {
    if (!selected) return;
    navigation.navigate('CreateCompany', { companyType: selected });
  };

  return (
    <AuthLayout
      header={
        <AuthHeader
          pill="Workspace Setup"
          title="Choose your business type"
          subtitle="This decides which tools your team sees. You’ll pick a plan for it next."
          onBack={() => navigation.goBack()}
          step={{ current: 2, total: 5 }}
        />
      }
      footer={
        <AuthFooterBar
          primary={{
            label: selected ? 'Continue' : 'Select a type to continue',
            onPress: handleContinue,
            disabled: !selected,
          }}
        />
      }>
      {TYPE_CARDS.map(card => (
        <AuthOptionCard
          key={card.key}
          icon={card.icon}
          title={card.title}
          tagline={card.tagline}
          badge={card.badge}
          features={card.features}
          selected={selected === card.key}
          onPress={() => setSelected(card.key)}
        />
      ))}
    </AuthLayout>
  );
};

export default CompanyTypeSelectScreen;
