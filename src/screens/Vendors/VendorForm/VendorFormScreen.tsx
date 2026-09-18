// ═══════════════════════════════════════════════════════
// FinMatrix — Vendor Form Screen (Create / Edit)
// ═══════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { THEME } from '../../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import {
  selectVendorFormState,
  setField,
  setErrors,
  resetVendorForm,
  saveVendor,
  fetchVendorForEdit
} from './vendorFormSlice';
import { fetchVendors, upsertVendor } from '../VendorList/vendorListSlice';
import { selectAccounts, fetchAccounts } from '../../ChartOfAccounts/COAList/coaListSlice';
import CustomInput from '../../../Custom-Components/CustomInput';
import { ReportHeader, HEADER_NAVY } from '../../../components/reports/ReportUI';
import CustomDropdown from '../../../Custom-Components/CustomDropdown';
import CustomButton from '../../../Custom-Components/CustomButton';
import { validateVendor, PAYMENT_TERMS_OPTIONS } from '../../../models/vendorModel';
import type { MoreStackParamList } from '../../../navigators/stacks/MoreStack';

// Design-system tokens (see src/theme/theme.ts).
const { colors, radius, shadows, spacing, typography } = THEME;

type Nav = NativeStackNavigationProp<MoreStackParamList>;
type FormRoute = RouteProp<MoreStackParamList, 'VendorForm'>;

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════
const VendorFormScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<FormRoute>();
  const dispatch = useAppDispatch();

  const editingId = route.params?.vendorId;
  const isEditing = !!editingId;
  const form = useAppSelector(selectVendorFormState);
  const accounts = useAppSelector(selectAccounts);
  const hydratedRef = React.useRef(false);

  // ── Expense account options ─────────────────────
  const expenseAccountOptions = useMemo(
    () =>
      accounts
        .filter(a => a.type === 'expense' && a.isActive)
        .map(a => ({ label: `${a.code} – ${a.name}`, value: a.id })),
    [accounts],
  );

  // ── Load COA accounts + vendor for edit on mount ─
  // Hydrate ONCE per mount via the dedicated fetch thunk so
  // deep-links work and subsequent list refetches don't
  // overwrite the user's in-progress edits.
  useEffect(() => {
    dispatch(fetchAccounts());

    if (hydratedRef.current) return;
    hydratedRef.current = true;

    if (isEditing && editingId) {
      dispatch(fetchVendorForEdit(editingId));
    }

    return () => { dispatch(resetVendorForm()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, editingId, dispatch]);

  // ── Field update helper ─────────────────────────
  const updateField = useCallback(
    (key: string, value: any) => dispatch(setField({ key: key as any, value })),
    [dispatch],
  );

  // ── Save with validation ────────────────────────
  const handleSave = useCallback(async () => {
    const validationErrors = validateVendor({
      name: form.name,
      contactPerson: form.contactPerson,
      email: form.email,
      phone: form.phone,
      address: form.address,
      city: form.city,
      state: form.state,
      zipCode: form.zipCode,
      country: form.country,
      paymentTerms: form.paymentTerms,
      taxId: form.taxId,
      defaultExpenseAccountId: form.defaultExpenseAccountId,
      notes: form.notes
    });

    if (Object.keys(validationErrors).length > 0) {
      dispatch(setErrors(validationErrors));
      Toast.show({ type: 'error', text1: 'Validation Error', text2: Object.values(validationErrors)[0] });
      return;
    }

    try {
      const result: any = await dispatch(saveVendor());
      if (result.error) throw new Error(result.error.message);
      const saved = result.payload;
      if (saved) dispatch(upsertVendor(saved));
      await dispatch(fetchVendors());

      Toast.show({
          type: 'success',
          text1: isEditing ? 'Vendor Updated' : 'Vendor Created',
          text2: `${form.name} has been ${isEditing ? 'updated' : 'created'} successfully. Now available for Bills & POs.`
        });
        navigation.goBack();
    } catch (e: any) {
      // The network layer extracts the server's message; surface it.
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: e?.message || 'Failed to save vendor. Please try again.',
      });
    }
  }, [form, isEditing, dispatch, navigation]);

  // ═════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: HEADER_NAVY[0] }]} edges={['top']}>
      <ReportHeader
        title={isEditing ? 'Edit Vendor' : 'Add Vendor'}
        subtitle="Supplier profile"
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* ── Section: Company Info ────────────────── */}
          <Text style={styles.sectionTitle}>Company Information</Text>
          <View style={styles.sectionCard}>
            <CustomInput
              label="Company Name *"
              value={form.name}
              onChangeText={v => updateField('name', v)}
              placeholder="Vendor company name"
              error={form.errors.name}
            />
            <CustomInput
              label="Contact Person"
              value={form.contactPerson}
              onChangeText={v => updateField('contactPerson', v)}
              placeholder="Primary contact name"
            />
            <CustomInput
              label="Email *"
              value={form.email}
              onChangeText={v => updateField('email', v)}
              placeholder="email@example.com"
              keyboardType="email-address"
              error={form.errors.email}
            />
            <CustomInput
              label="Phone"
              value={form.phone}
              onChangeText={v => updateField('phone', v)}
              placeholder="+92-300-1234567"
              keyboardType="phone-pad"
              error={form.errors.phone}
            />
          </View>

          {/* ── Section: Address ─────────────────────── */}
          <Text style={styles.sectionTitle}>Address</Text>
          <View style={styles.sectionCard}>
            <CustomInput
              label="Street Address"
              value={form.address}
              onChangeText={v => updateField('address', v)}
              placeholder="Street address"
            />
            <CustomInput
              label="City"
              value={form.city}
              onChangeText={v => updateField('city', v)}
              placeholder="City"
            />
            <CustomInput
              label="State / Province"
              value={form.state}
              onChangeText={v => updateField('state', v)}
              placeholder="Province"
            />
            <View style={styles.rowFields}>
              <View style={{ flex: 1, marginRight: spacing.xs }}>
                <CustomInput
                  label="Zip Code"
                  value={form.zipCode}
                  onChangeText={v => updateField('zipCode', v)}
                  placeholder="00000"
                  keyboardType="number-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <CustomInput
                  label="Country"
                  value={form.country}
                  onChangeText={v => updateField('country', v)}
                  placeholder="Pakistan"
                />
              </View>
            </View>
          </View>

          {/* ── Section: Terms & Accounting ──────────── */}
          <Text style={styles.sectionTitle}>Terms & Accounting</Text>
          <View style={styles.sectionCard}>
            <CustomDropdown
              label="Payment Terms *"
              options={PAYMENT_TERMS_OPTIONS}
              value={form.paymentTerms}
              onChange={v => updateField('paymentTerms', v)}
              placeholder="Select payment terms…"
              error={form.errors.paymentTerms}
            />
            <CustomInput
              label="Tax ID (NTN)"
              value={form.taxId}
              onChangeText={v => updateField('taxId', v)}
              placeholder="NTN-XXXXXXX-X"
            />
            <CustomDropdown
              label="Default Expense Account"
              options={expenseAccountOptions}
              value={form.defaultExpenseAccountId}
              onChange={v => updateField('defaultExpenseAccountId', v)}
              placeholder="Select expense account…"
              searchable
            />
          </View>

          {/* ── Section: Notes ───────────────────────── */}
          <Text style={styles.sectionTitle}>Notes</Text>
          <View style={styles.sectionCard}>
            <CustomInput
              label="Notes"
              value={form.notes}
              onChangeText={v => updateField('notes', v)}
              placeholder="Additional notes about this vendor…"
              multiline
            />
          </View>

          <View style={{ height: spacing.xxl * 2 }} />
        </ScrollView>

        {/* ── Sticky Action Bar ────────────────────── */}
        <View style={styles.actionBar}>
          <View style={styles.actionSecondary}>
            <CustomButton
              title="Cancel"
              onPress={() => navigation.goBack()}
              variant="secondary"
              size="sm"
              fullWidth
            />
          </View>
          <View style={styles.actionPrimary}>
            <CustomButton
              title={isEditing ? 'Update Vendor' : 'Save Vendor'}
              onPress={handleSave}
              variant="primary"
              size="sm"
              fullWidth
              isLoading={form.isSaving}
              disabled={form.isSaving}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ═══════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backIcon: { ...typography.h1, color: colors.secondary, fontWeight: typography.labelLg.fontWeight },
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xl },

  sectionTitle: {
    ...THEME.typography.h4,
    
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.xxs,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.xs,
  },

  rowFields: { flexDirection: 'row' },

  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs,
    ...shadows.xs,
  },
  actionSecondary: { flex: 1 },
  actionPrimary: { flex: 1.4 }
});

export default VendorFormScreen;
