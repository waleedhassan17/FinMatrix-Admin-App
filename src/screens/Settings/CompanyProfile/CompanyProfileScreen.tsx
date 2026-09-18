// ═══════════════════════════════════════════════════════
// FinMatrix — Company Profile
// ═══════════════════════════════════════════════════════
// The business identity screen. Everything here prints on the documents the
// company sends out — invoices, statements, payslips — so the screen leads
// with that promise, saves onto the real company record
// (PATCH /companies/:id), and refreshes the store so the very next share
// uses the new details.

import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { THEME } from '../../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import {
  selectCompanyProfileForm, selectCompanyProfileSaving,
  setField, loadCompanyData, saveProfile
} from './companyProfileSlice';
import { selectActiveCompany, loadCompany } from '../../Auth/companySlice';
import { selectUser } from '../../Auth/authSlice';
import { getCompanyAPI } from '../../../networks/auth/authNetwork';
import CustomInput from '../../../Custom-Components/CustomInput';
import { ReportHeader, HeaderAction, HEADER_NAVY } from '../../../components/reports/ReportUI';
import type { MoreStackParamList } from '../../../navigators/stacks/MoreStack';

// Design-system tokens (see src/theme/theme.ts).
const { colors, radius, shadows, spacing, typography } = THEME;

type Nav = NativeStackNavigationProp<MoreStackParamList>;

const P = {
  brand: colors.actionGreen,
  brandLight: colors.actionGreenLighter,
  pageBg: colors.neutral50,
  card: colors.neutral0,
  text: colors.neutral800,
  sub: colors.neutral400,
  divider: colors.neutral200,
  sectionLabel: colors.neutral500
};

const FISCAL_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const CompanyProfileScreen: React.FC = () => {
  const nav = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const form = useAppSelector(selectCompanyProfileForm);
  const saving = useAppSelector(selectCompanyProfileSaving);
  const company = useAppSelector(selectActiveCompany);
  const user = useAppSelector(selectUser);

  // Hydrate the form from the store; if the store has no company yet (deep
  // navigation before the dashboard fetched it), pull it from the API so the
  // profile never opens blank.
  useEffect(() => {
    if (company) {
      dispatch(loadCompanyData({
        name: company.name,
        address: company.address,
        city: company.city,
        state: company.state,
        zipCode: company.zipCode,
        country: company.country,
        phone: company.phone,
        email: company.email,
        website: company.website,
        taxId: company.taxId,
        industry: company.industry,
      }));
    }
    if (!user?.companyId) return;
    // The API is read even when the store has the company: the fiscal year
    // (fiscalYearStartMonth) is on the company record, and the store copy does
    // not carry it — so the control opened on a default and saving nothing.
    getCompanyAPI(user.companyId)
      .then(api => {
        if (!api?.id) return;
        const month = Number(api.fiscalYearStartMonth);
        dispatch(loadCompanyData({
          ...(company
            ? {}
            : {
                name: api.name ?? '',
                industry: api.industry ?? '',
                address: typeof api.address === 'string' ? api.address : api.address?.street ?? '',
                city: api.address?.city ?? '',
                state: api.address?.state ?? '',
                zipCode: api.address?.postalCode ?? '',
                country: api.address?.country ?? '',
                phone: api.phone ?? '',
                email: api.email ?? '',
                website: api.website ?? '',
                taxId: api.taxId ?? '',
              }),
          ...(month >= 1 && month <= 12 ? { fiscalYearStart: FISCAL_MONTHS[month - 1] } : {}),
        }));
      })
      .catch((): void => undefined);
  }, [dispatch, company, user?.companyId]);

  const update = useCallback(
    (key: keyof typeof form) => (value: string) => {
      dispatch(setField({ key, value }));
    },
    [dispatch],
  );

  const handleSave = useCallback(() => {
    if (!form.name.trim()) {
      Toast.show({ type: 'error', text1: 'Company name required', text2: 'Enter your company name before saving.' });
      return;
    }
    dispatch(saveProfile())
      .unwrap()
      .then(() => {
        // Refresh the store copy so the NEXT invoice/statement share prints
        // the new identity without needing an app restart.
        if (company) {
          dispatch(loadCompany({ ...company, ...form }));
        }
        Toast.show({ type: 'success', text1: 'Profile saved', text2: 'Your documents now use the updated company details.' });
        nav.goBack();
      })
      .catch((e: any) => {
        Toast.show({ type: 'error', text1: 'Could not save', text2: e?.message ?? 'Please try again.' });
      });
  }, [dispatch, form, company, nav]);

  const cycleFiscal = useCallback(() => {
    const idx = FISCAL_MONTHS.indexOf(form.fiscalYearStart);
    dispatch(setField({ key: 'fiscalYearStart', value: FISCAL_MONTHS[(idx + 1) % 12] }));
  }, [dispatch, form.fiscalYearStart]);

  const initials = (form.name || 'C')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: HEADER_NAVY[0] }]} edges={['top']}>
      <ReportHeader
        title="Company Profile"
        subtitle="Shown on invoices, statements & payslips"
        onBack={() => nav.goBack()}
        right={<HeaderAction label={saving ? 'Saving…' : 'Save'} icon="check" onPress={handleSave} disabled={saving} />}
      />

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: P.pageBg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Identity card: live preview of the document letterhead */}
          <View style={s.identityCard}>
            <View style={s.identityAvatar}>
              <Text style={s.identityInitials}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.identityName} numberOfLines={1}>{form.name || 'Your Company'}</Text>
              <Text style={s.identityMeta} numberOfLines={2}>
                {[form.address, [form.city, form.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ')
                  || 'Add your address and contact details below'}
              </Text>
              {(form.phone || form.email) ? (
                <Text style={s.identityMeta} numberOfLines={1}>
                  {[form.phone, form.email].filter(Boolean).join('  ·  ')}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={s.hintRow}>
            <Feather name="file-text" size={13} color={P.sectionLabel} />
            <Text style={s.hintText}>
              This letterhead appears on every invoice, statement and payslip you download or share.
            </Text>
          </View>

          {/* Basic Info */}
          <Text style={s.sectionLabel}>BASIC INFORMATION</Text>
          <View style={s.card}>
            <CustomInput label="Company Name *" value={form.name} onChangeText={update('name')} placeholder="Enter company name" />
            <CustomInput label="Industry" value={form.industry} onChangeText={update('industry')} placeholder="e.g. Trading, Manufacturing" />
            <CustomInput label="Tax ID / NTN" value={form.taxId} onChangeText={update('taxId')} placeholder="Enter tax ID" />
          </View>

          {/* Contact */}
          <Text style={s.sectionLabel}>CONTACT</Text>
          <View style={s.card}>
            <CustomInput label="Phone" value={form.phone} onChangeText={update('phone')} placeholder="+92-XXX-XXXXXXX" keyboardType="phone-pad" />
            <CustomInput label="Email" value={form.email} onChangeText={update('email')} placeholder="company@email.com" keyboardType="email-address" autoCapitalize="none" />
            <CustomInput label="Website" value={form.website} onChangeText={update('website')} placeholder="https://example.com" autoCapitalize="none" />
          </View>

          {/* Address */}
          <Text style={s.sectionLabel}>ADDRESS</Text>
          <View style={s.card}>
            <CustomInput label="Address" value={form.address} onChangeText={update('address')} placeholder="Street address" />
            <View style={s.twoCol}>
              <View style={s.col}>
                <CustomInput label="City" value={form.city} onChangeText={update('city')} placeholder="City" />
              </View>
              <View style={s.col}>
                <CustomInput label="State / Province" value={form.state} onChangeText={update('state')} placeholder="State" />
              </View>
            </View>
            <View style={s.twoCol}>
              <View style={s.col}>
                <CustomInput label="Zip Code" value={form.zipCode} onChangeText={update('zipCode')} placeholder="Zip" keyboardType="number-pad" />
              </View>
              <View style={s.col}>
                <CustomInput label="Country" value={form.country} onChangeText={update('country')} placeholder="Country" />
              </View>
            </View>
          </View>

          {/* Fiscal Year */}
          <Text style={s.sectionLabel}>FISCAL YEAR</Text>
          <View style={s.card}>
            <TouchableOpacity style={s.fiscalRow} activeOpacity={0.55} onPress={cycleFiscal}>
              <Feather name="calendar" size={18} color={P.brand} style={{ marginRight: 12 }} />
              <Text style={[s.fieldLabel, { flex: 1 }]}>Start Month</Text>
              <Text style={s.fiscalVal}>{form.fiscalYearStart}</Text>
              <Feather name="repeat" size={14} color={P.sub} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default CompanyProfileScreen;

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: P.pageBg },
  scroll: { padding: spacing.md },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: P.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  identityAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: P.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.successLight,
  },
  identityInitials: {
    ...typography.h3,
    color: P.brand,
  },
  identityName: {
    ...typography.h4,
    color: P.text,
  },
  identityMeta: {
    ...typography.caption,
    color: P.sub,
    marginTop: 2,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xxs,
    marginLeft: spacing.xxs,
  },
  hintText: {
    ...typography.caption,
    flex: 1,
    color: P.sectionLabel,
  },
  sectionLabel: {
    ...typography.labelSm,
    color: P.sectionLabel,
    letterSpacing: 0.8,
    marginTop: spacing.xl,
    marginBottom: spacing.xxs,
    marginLeft: spacing.xxs,
  },
  card: {
    backgroundColor: P.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  twoCol: { flexDirection: 'row', gap: spacing.xs },
  col: { flex: 1 },
  fiscalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  fieldLabel: {
    ...typography.bodyMd,
    color: P.text,
  },
  fiscalVal: {
    ...typography.h5,
    color: P.brand,
  }
});
