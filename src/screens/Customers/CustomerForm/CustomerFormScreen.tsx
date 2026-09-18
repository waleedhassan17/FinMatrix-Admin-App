// ═══════════════════════════════════════════════════════
// FinMatrix — Customer Form Screen (Create / Edit)
// ═══════════════════════════════════════════════════════

import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Switch
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
  selectCustomerFormState,
  setField,
  setErrors,
  setIsSaving,
  toggleSameAsBilling,
  loadCustomerForEdit,
  resetCustomerForm
} from './customerFormSlice';
import {
  selectCustomers,
  fetchCustomers,
  createCustomer,
  editCustomer
} from '../CustomerList/customerListSlice';
import CustomInput from '../../../Custom-Components/CustomInput';
import { ReportHeader, HEADER_NAVY } from '../../../components/reports/ReportUI';
import CustomDropdown from '../../../Custom-Components/CustomDropdown';
import CustomButton from '../../../Custom-Components/CustomButton';
import { validateCustomer, PAYMENT_TERMS_OPTIONS } from '../../../models/customerModel';
import { customerToFormData, formDataToCustomerPayload } from '../../../serializers/customerSerializer';
import type { MoreStackParamList } from '../../../navigators/stacks/MoreStack';

// Design-system tokens (see src/theme/theme.ts).
const { colors, radius, shadows, spacing, typography } = THEME;

type Nav = NativeStackNavigationProp<MoreStackParamList>;
type FormRoute = RouteProp<MoreStackParamList, 'CustomerForm'>;

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════
const CustomerFormScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<FormRoute>();
  const dispatch = useAppDispatch();

  const editingId = route.params?.customerId;
  const isEditing = !!editingId;
  const customers = useAppSelector(selectCustomers);
  const form = useAppSelector(selectCustomerFormState);

  // ── Load for edit on mount ──────────────────────
  useEffect(() => {
    if (isEditing) {
      const customer = customers.find(c => c.id === editingId);
      if (customer) {
        const formData = customerToFormData(customer);
        dispatch(loadCustomerForEdit(formData));
      }
    }
    return () => { dispatch(resetCustomerForm()); };
  }, [isEditing, editingId, customers, dispatch]);

  // ── Field update helper ─────────────────────────
  const updateField = useCallback(
    (key: string, value: any) => dispatch(setField({ key: key as any, value })),
    [dispatch],
  );

  // ── Save with validation ────────────────────────
  const handleSave = useCallback(async () => {
    const validationErrors = validateCustomer({
      name: form.name,
      company: form.company,
      email: form.email,
      phone: form.phone,
      billingStreet: form.billingStreet,
      billingCity: form.billingCity,
      billingState: form.billingState,
      billingZipCode: form.billingZipCode,
      billingCountry: form.billingCountry,
      sameAsBilling: form.sameAsBilling,
      shippingStreet: form.shippingStreet,
      shippingCity: form.shippingCity,
      shippingState: form.shippingState,
      shippingZipCode: form.shippingZipCode,
      shippingCountry: form.shippingCountry,
      creditLimit: form.creditLimit,
      paymentTerms: form.paymentTerms,
      contactPerson: form.contactPerson,
      taxId: form.taxId,
      notes: form.notes
    });

    if (Object.keys(validationErrors).length > 0) {
      dispatch(setErrors(validationErrors));
      Toast.show({ type: 'error', text1: 'Validation Error', text2: Object.values(validationErrors)[0] });
      return;
    }

    dispatch(setIsSaving(true));
    try {
      const payload = formDataToCustomerPayload(
        {
          name: form.name,
          company: form.company,
          email: form.email,
          phone: form.phone,
          billingStreet: form.billingStreet,
          billingCity: form.billingCity,
          billingState: form.billingState,
          billingZipCode: form.billingZipCode,
          billingCountry: form.billingCountry,
          sameAsBilling: form.sameAsBilling,
          shippingStreet: form.shippingStreet,
          shippingCity: form.shippingCity,
          shippingState: form.shippingState,
          shippingZipCode: form.shippingZipCode,
          shippingCountry: form.shippingCountry,
          creditLimit: form.creditLimit,
          paymentTerms: form.paymentTerms,
          contactPerson: form.contactPerson,
          taxId: form.taxId,
          notes: form.notes
        },
      );

      if (isEditing) {
        await dispatch(editCustomer({ id: editingId!, data: payload })).unwrap();
      } else {
        await dispatch(createCustomer(payload)).unwrap();
      }

      await dispatch(fetchCustomers());

      Toast.show({
          type: 'success',
          text1: isEditing ? 'Customer Updated' : 'Customer Created',
          text2: `${form.name} has been ${isEditing ? 'updated' : 'created'} successfully.`
        });
        navigation.goBack();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e?.message || 'Failed to save customer. Please try again.' });
    } finally {
      dispatch(setIsSaving(false));
    }
  }, [form, isEditing, editingId, dispatch, navigation]);

  // ═════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: HEADER_NAVY[0] }]} edges={['top']}>
      <ReportHeader
        title={isEditing ? 'Edit Customer' : 'Add Customer'}
        subtitle="Customer profile"
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* ── Section: Basic Info ──────────────────── */}
          <Text style={styles.sectionTitle}>Basic Information</Text>
          <View style={styles.sectionCard}>
            <CustomInput
              label="Name *"
              value={form.name}
              onChangeText={v => updateField('name', v)}
              placeholder="Customer name"
              error={form.errors.name}
            />
            <CustomInput
              label="Company"
              value={form.company}
              onChangeText={v => updateField('company', v)}
              placeholder="Company name"
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
            <CustomInput
              label="Contact Person"
              value={form.contactPerson}
              onChangeText={v => updateField('contactPerson', v)}
              placeholder="Primary contact name"
            />
            <CustomInput
              label="Tax ID (NTN)"
              value={form.taxId}
              onChangeText={v => updateField('taxId', v)}
              placeholder="NTN-XXXXXXX-X"
            />
          </View>

          {/* ── Section: Billing Address ─────────────── */}
          <Text style={styles.sectionTitle}>Billing Address</Text>
          <View style={styles.sectionCard}>
            <CustomInput
              label="Street *"
              value={form.billingStreet}
              onChangeText={v => updateField('billingStreet', v)}
              placeholder="Street address"
              error={form.errors.billingStreet}
            />
            <CustomInput
              label="City *"
              value={form.billingCity}
              onChangeText={v => updateField('billingCity', v)}
              placeholder="City"
              error={form.errors.billingCity}
            />
            <CustomInput
              label="State / Province"
              value={form.billingState}
              onChangeText={v => updateField('billingState', v)}
              placeholder="Province"
            />
            <View style={styles.rowFields}>
              <View style={{ flex: 1, marginRight: spacing.xs }}>
                <CustomInput
                  label="Zip Code"
                  value={form.billingZipCode}
                  onChangeText={v => updateField('billingZipCode', v)}
                  placeholder="00000"
                  keyboardType="number-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <CustomInput
                  label="Country"
                  value={form.billingCountry}
                  onChangeText={v => updateField('billingCountry', v)}
                  placeholder="Pakistan"
                />
              </View>
            </View>
          </View>

          {/* ── Section: Shipping Address ────────────── */}
          <Text style={styles.sectionTitle}>Shipping Address</Text>
          <View style={styles.sectionCard}>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Same as Billing Address</Text>
              <Switch
                value={form.sameAsBilling}
                onValueChange={(_value: boolean) => { dispatch(toggleSameAsBilling()); }}
                trackColor={{ false: colors.border, true: colors.actionGreen + '60' }}
                thumbColor={form.sameAsBilling ? colors.actionGreen : colors.textTertiary}
              />
            </View>

            {!form.sameAsBilling && (
              <>
                <CustomInput
                  label="Street *"
                  value={form.shippingStreet}
                  onChangeText={v => updateField('shippingStreet', v)}
                  placeholder="Street address"
                  error={form.errors.shippingStreet}
                />
                <CustomInput
                  label="City *"
                  value={form.shippingCity}
                  onChangeText={v => updateField('shippingCity', v)}
                  placeholder="City"
                  error={form.errors.shippingCity}
                />
                <CustomInput
                  label="State / Province"
                  value={form.shippingState}
                  onChangeText={v => updateField('shippingState', v)}
                  placeholder="Province"
                />
                <View style={styles.rowFields}>
                  <View style={{ flex: 1, marginRight: spacing.xs }}>
                    <CustomInput
                      label="Zip Code"
                      value={form.shippingZipCode}
                      onChangeText={v => updateField('shippingZipCode', v)}
                      placeholder="00000"
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <CustomInput
                      label="Country"
                      value={form.shippingCountry}
                      onChangeText={v => updateField('shippingCountry', v)}
                      placeholder="Pakistan"
                    />
                  </View>
                </View>
              </>
            )}
          </View>

          {/* ── Section: Credit & Terms ──────────────── */}
          <Text style={styles.sectionTitle}>Credit & Terms</Text>
          <View style={styles.sectionCard}>
            <CustomInput
              label="Credit Limit (Rs) — 0 means no limit"
              value={form.creditLimit}
              onChangeText={v => updateField('creditLimit', v)}
              placeholder="0.00"
              keyboardType="numeric"
              error={form.errors.creditLimit}
            />
            <CustomDropdown
              label="Payment Terms *"
              options={PAYMENT_TERMS_OPTIONS}
              value={form.paymentTerms}
              onChange={v => updateField('paymentTerms', v)}
              placeholder="Select payment terms…"
              error={form.errors.paymentTerms}
            />
          </View>

          {/* ── Section: Notes ───────────────────────── */}
          <Text style={styles.sectionTitle}>Notes</Text>
          <View style={styles.sectionCard}>
            <CustomInput
              label="Notes"
              value={form.notes}
              onChangeText={v => updateField('notes', v)}
              placeholder="Additional notes about this customer…"
              multiline
            />
          </View>

          {/* ── Action Buttons ───────────────────────── */}
          <View style={styles.btnRow}>
            <View style={{ flex: 1, marginRight: spacing.xs }}>
              <CustomButton
                title="Cancel"
                onPress={() => navigation.goBack()}
                variant="secondary"
                size="lg"
                fullWidth
              />
            </View>
            <View style={{ flex: 1 }}>
              <CustomButton
                title={isEditing ? 'Update' : 'Create'}
                onPress={handleSave}
                variant="primary"
                size="lg"
                fullWidth
                isLoading={form.isSaving}
              />
            </View>
          </View>
        </ScrollView>
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
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxl },

  sectionTitle: {
    ...typography.labelLg,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.xxs,
  },

  rowFields: { flexDirection: 'row' },

  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  toggleLabel: {
    ...typography.bodyMd,
    color: colors.textPrimary,
  },

  btnRow: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    marginBottom: spacing.xxl,
  }
});

export default CustomerFormScreen;
