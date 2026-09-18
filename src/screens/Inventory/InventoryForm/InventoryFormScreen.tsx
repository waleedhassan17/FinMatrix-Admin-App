// ═══════════════════════════════════════════════════════
// FinMatrix — Inventory Add / Edit Form Screen
// ═══════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Modal,
  FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { THEME } from '../../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import {
  selectInventoryItems,
  createInventoryItem,
  editInventoryItem
} from '../InventoryList/inventoryListSlice';
import {
  selectInventoryFormData,
  selectInventoryFormErrors,
  selectInventoryIsSaving,
  setFormField,
  setFormData,
  setFormErrors,
  setIsSaving,
  resetInventoryForm
} from './inventoryFormSlice';
import CustomInput from '../../../Custom-Components/CustomInput';
import { ReportHeader, HEADER_NAVY } from '../../../components/reports/ReportUI';
import CustomDropdown from '../../../Custom-Components/CustomDropdown';
import CustomButton from '../../../Custom-Components/CustomButton';
import {
  validateInventoryItem,
  generateNextSKU,
  CATEGORY_OPTIONS,
  UOM_OPTIONS,
  COST_METHOD_OPTIONS
} from '../../../models/inventoryModel';
import {
  formDataToInventoryCreatePayload,
  formDataToInventoryUpdatePayload
} from '../../../serializers/inventorySerializer';
import { selectAgencies, fetchAgencies } from '../../Agency/AgencyList/agencyListSlice';
import { isFeatureEnabled } from '../../../utils/featureGates';
import type { InventoryStackParamList } from '../../../navigators/stacks/InventoryStack';

// Design-system tokens (see src/theme/theme.ts).
const { colors, radius, shadows, spacing, typography } = THEME;

type FormRoute = RouteProp<InventoryStackParamList, 'InventoryForm'>;
type Nav = NativeStackNavigationProp<InventoryStackParamList>;

// ── Section collapse state ──────────────────────────
type SectionKey = 'basic' | 'pricing' | 'stock' | 'tracking' | 'location';

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════
const InventoryFormScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<FormRoute>();
  const dispatch = useAppDispatch();

  const items = useAppSelector(selectInventoryItems);
  const form = useAppSelector(selectInventoryFormData);
  const errors = useAppSelector(selectInventoryFormErrors);
  const isSaving = useAppSelector(selectInventoryIsSaving);
  const agencies = useAppSelector(selectAgencies);
  const agenciesEnabled = isFeatureEnabled('agencies');

  const editingId = route.params?.itemId;
  const existing = editingId ? items.find(i => i.itemId === editingId) : undefined;
  const isEdit = !!existing;
  // Cost is locked exactly when the server would refuse the change: stock on hand.
  const costLocked = isEdit && (existing?.quantityOnHand ?? 0) > 0;

  const [collapsed, setCollapsed] = useState<Record<SectionKey, boolean>>({
    basic: false,
    pricing: false,
    stock: false,
    tracking: true,
    location: false
  });

  const [showAgencyPrompt, setShowAgencyPrompt] = useState(false);

  const toggleSection = (key: SectionKey) =>
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  // ── Fetch agencies for the source dropdown ────────
  // Guarded so the withdrawn feature costs no request: this was the only
  // agencies call outside the Agency screens themselves.
  useEffect(() => {
    if (!agenciesEnabled) return;
    if (agencies.length === 0) dispatch(fetchAgencies());
  }, [dispatch, agencies.length, agenciesEnabled]);

  // ── Prompt agency selection for new items ─────────
  useEffect(() => {
    if (!agenciesEnabled) return;
    if (!isEdit && agencies.length > 0 && !form.sourceAgencyId) {
      setShowAgencyPrompt(true);
    }
  // Only on mount for new items
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, agencies.length, agenciesEnabled]);

  // ── Pre-fill for edit mode / reset for add ────────
  useEffect(() => {
    if (existing) {
      dispatch(setFormData({
        name: existing.name,
        sku: existing.sku,
        description: existing.description,
        category: existing.category,
        unitOfMeasure: existing.unitOfMeasure,
        costMethod: existing.costMethod,
        unitCost: existing.unitCost.toString(),
        sellingPrice: existing.sellingPrice.toString(),
        quantityOnHand: existing.quantityOnHand.toString(),
        reorderPoint: existing.reorderPoint.toString(),
        reorderQuantity: existing.reorderQuantity.toString(),
        minStock: existing.minStock.toString(),
        maxStock: existing.maxStock.toString(),
        barcodeData: existing.barcodeData,
        sourceAgencyId: existing.sourceAgencyId ?? '',
      }));
    } else {
      dispatch(resetInventoryForm());
    }
    return () => { dispatch(resetInventoryForm()); };
  }, [existing, dispatch]);

  // ── Auto-generate SKU ─────────────────────────────
  const handleAutoGenerateSKU = useCallback(() => {
    if (!form.category) {
      Toast.show({ type: 'error', text1: 'Select Category', text2: 'Please select a category first to auto-generate SKU.' });
      return;
    }
    const existingSKUs = items.filter(i => i.itemId !== editingId).map(i => i.sku);
    const sku = generateNextSKU(existingSKUs, form.category);
    dispatch(setFormField({ key: 'sku', value: sku }));
  }, [form.category, items, editingId, dispatch]);

  // ── Markup auto-calc ──────────────────────────────
  const markupPercent = useMemo(() => {
    const cost = parseFloat(form.unitCost);
    const price = parseFloat(form.sellingPrice);
    if (!cost || !price || cost <= 0) return '—';
    return (((price - cost) / cost) * 100).toFixed(1) + '%';
  }, [form.unitCost, form.sellingPrice]);

  // ── Derived ───────────────────────────────────────
  const existingSKUs = useMemo(
    () => items.filter(i => i.itemId !== editingId).map(i => i.sku),
    [items, editingId],
  );

  const agencyOptions = useMemo(() => [
    { label: 'No Specific Warehouse', value: '' },
    ...agencies.map(a => ({ label: a.name, value: a.id })),
  ], [agencies]);

  // ── Handlers ──────────────────────────────────────
  const updateField = useCallback(
    (key: string, value: string | boolean) => {
      dispatch(setFormField({ key: key as any, value }));
    },
    [dispatch],
  );

  const handleSave = useCallback(async () => {
    const validationErrors = validateInventoryItem(form, existingSKUs, editingId);
    if (Object.keys(validationErrors).length > 0) {
      dispatch(setFormErrors(validationErrors));
      // The sections collapse, so an inline-only error can sit off-screen and
      // make Save look like it did nothing.
      Toast.show({ type: 'error', text1: 'Validation Error', text2: Object.values(validationErrors)[0] });
      return;
    }

    dispatch(setIsSaving(true));

    try {
      if (isEdit && editingId) {
        await dispatch(
          editInventoryItem({
            itemId: editingId,
            data: formDataToInventoryUpdatePayload(form, { costLocked })
          }),
        ).unwrap();
        Toast.show({ type: 'success', text1: 'Success', text2: 'Item updated successfully.' });
      } else {
        await dispatch(createInventoryItem(formDataToInventoryCreatePayload(form))).unwrap();
        Toast.show({ type: 'success', text1: 'Success', text2: 'Item created successfully.' });
      }
      navigation.goBack();
    } catch (e: any) {
      // Surface what the API actually said — the network layer already turns
      // its validation array into readable text.
      Toast.show({ type: 'error', text1: 'Error', text2: e?.message || 'Failed to save item. Please try again.' });
    } finally {
      dispatch(setIsSaving(false));
    }
  }, [form, existingSKUs, editingId, isEdit, costLocked, dispatch, navigation]);

  // ── Section renderer ──────────────────────────────
  const renderSectionHeader = (key: SectionKey, title: string) => (
    <TouchableOpacity
      style={styles.sectionHeader}
      activeOpacity={0.7}
      onPress={() => toggleSection(key)}
    >
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionChevron}>{collapsed[key] ? '▸' : '▾'}</Text>
    </TouchableOpacity>
  );

  // ═════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: HEADER_NAVY[0] }]} edges={['top']}>
      <ReportHeader
        title={isEdit ? 'Edit Item' : 'Add Item'}
        subtitle="Inventory item"
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={[styles.flex, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.form}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Basic Info Section ── */}
          {renderSectionHeader('basic', '📦  Basic Info')}
          {!collapsed.basic && (
            <View style={styles.sectionBody}>
              <CustomInput
                label="Item Name *"
                value={form.name}
                onChangeText={val => updateField('name', val)}
                placeholder="e.g. Wireless Keyboard"
                error={errors.name}
              />
              <CustomDropdown
                label="Category *"
                options={CATEGORY_OPTIONS}
                value={form.category}
                onChange={val => updateField('category', val)}
                placeholder="Select category..."
                error={errors.category}
              />
              <View style={styles.skuRow}>
                <View style={styles.skuInput}>
                  <CustomInput
                    label="SKU *"
                    value={form.sku}
                    onChangeText={val => updateField('sku', val)}
                    placeholder="e.g. ELC-KBD-001"
                    error={errors.sku}
                  />
                </View>
                <TouchableOpacity style={styles.autoGenBtn} onPress={handleAutoGenerateSKU}>
                  <Text style={styles.autoGenText}>Auto</Text>
                </TouchableOpacity>
              </View>
              <CustomInput
                label="Description"
                value={form.description}
                onChangeText={val => updateField('description', val)}
                placeholder="Brief description..."
                multiline
              />
              <CustomDropdown
                label="Unit of Measure"
                options={UOM_OPTIONS}
                value={form.unitOfMeasure}
                onChange={val => updateField('unitOfMeasure', val)}
                placeholder="Select UOM..."
              />
            </View>
          )}

          {/* ── Pricing Section ── */}
          {renderSectionHeader('pricing', '💰  Pricing')}
          {!collapsed.pricing && (
            <View style={styles.sectionBody}>
              {/*
                Cost method is weighted average and cannot be changed — the API
                has no field for it on update, so the old dropdown was silently
                discarded on every edit.
              */}
              {isEdit ? (
                <View style={styles.readOnlyRow}>
                  <Text style={styles.readOnlyLabel}>Cost Method</Text>
                  <Text style={styles.readOnlyValue}>Weighted average</Text>
                </View>
              ) : (
                <CustomDropdown
                  label="Cost Method"
                  options={COST_METHOD_OPTIONS}
                  value={form.costMethod}
                  onChange={val => updateField('costMethod', val)}
                  placeholder="Select cost method..."
                />
              )}
              {/*
                Unit cost is the weighted average of what was actually paid — an
                output of the receipt history, not an input. Editing it while
                stock is on hand would move Inventory Valuation (qty x cost)
                without moving GL 1200, and the next receipt would overwrite the
                typed figure anyway. The server refuses it with UNIT_COST_LOCKED;
                showing it read-only is how the user finds that out before saving.
              */}
              {costLocked ? (
                <View style={styles.readOnlyRow}>
                  <Text style={styles.readOnlyLabel}>Unit Cost</Text>
                  <Text style={styles.readOnlyValue}>{form.unitCost || '0'}</Text>
                </View>
              ) : (
                <CustomInput
                  label="Unit Cost *"
                  value={form.unitCost}
                  onChangeText={val => updateField('unitCost', val)}
                  placeholder="0.00"
                  keyboardType="numeric"
                  error={errors.unitCost}
                />
              )}
              {costLocked ? (
                <Text style={styles.fieldHelp}>
                  Receive stock at the new price and the average re-computes itself. To fix a
                  count rather than a price, use Stock Adjustment.
                </Text>
              ) : null}
              <CustomInput
                label="Selling Price *"
                value={form.sellingPrice}
                onChangeText={val => updateField('sellingPrice', val)}
                placeholder="0.00"
                keyboardType="numeric"
                error={errors.sellingPrice}
              />
              <View style={styles.markupRow}>
                <Text style={styles.markupLabel}>Markup %</Text>
                <Text style={styles.markupValue}>{markupPercent}</Text>
              </View>
            </View>
          )}

          {/* ── Stock Section ── */}
          {renderSectionHeader('stock', '📊  Stock')}
          {!collapsed.stock && (
            <View style={styles.sectionBody}>
              {/*
                Quantity is NOT editable here, and never was — the API has no
                such field on create or update, so the old input was silently
                discarded: you typed 100, got "created successfully", and the
                item had 0. Stock only moves through paths that post a journal
                entry: a Purchase Order receipt, an Opening Stock entry for
                day-one stock, or a Stock Adjustment to correct a count.
              */}
              {isEdit ? (
                <View style={styles.readOnlyRow}>
                  <Text style={styles.readOnlyLabel}>Quantity on Hand</Text>
                  <Text style={styles.readOnlyValue}>{form.quantityOnHand || '0'}</Text>
                </View>
              ) : null}
              <Text style={styles.fieldHelp}>
                {isEdit
                  ? 'Use Stock Adjustment on the item to correct this quantity — it posts the matching journal entry.'
                  : 'New items start at zero. Add stock with a Purchase Order, or record what you already own with Opening Stock.'}
              </Text>
              <CustomInput
                label="Reorder Point"
                value={form.reorderPoint}
                onChangeText={val => updateField('reorderPoint', val)}
                placeholder="0"
                keyboardType="numeric"
              />
              <CustomInput
                label="Reorder Quantity"
                value={form.reorderQuantity}
                onChangeText={val => updateField('reorderQuantity', val)}
                placeholder="0"
                keyboardType="numeric"
              />
              <View style={styles.rowFields}>
                <View style={styles.halfField}>
                  <CustomInput
                    label="Min Stock"
                    value={form.minStock}
                    onChangeText={val => updateField('minStock', val)}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.halfField}>
                  <CustomInput
                    label="Max Stock"
                    value={form.maxStock}
                    onChangeText={val => updateField('maxStock', val)}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>
          )}

          {/* ── Tracking Section ──
              Serial Tracking and Lot Tracking toggles used to sit above the
              barcode. Nothing in the product ever read the flags back — there
              is no serial or lot capture at receipt or delivery — so they only
              persisted a promise the app does not keep. The columns are
              untouched; this is a UI removal. */}
          {renderSectionHeader('tracking', '🏷️  Tracking')}
          {!collapsed.tracking && (
            <View style={styles.sectionBody}>
              <CustomInput
                label="Barcode"
                value={form.barcodeData}
                onChangeText={val => updateField('barcodeData', val)}
                placeholder="Scan or enter barcode..."
              />
            </View>
          )}

          {/* ── Warehouse Section ──
              Was "Warehouse & Status" and also carried an Active switch. That
              switch is gone, not hidden: it was a second, UNGUARDED way to
              deactivate an item. PATCH /inventory/items/:id takes isActive and
              Object.assign's it straight onto the row, so flipping it off here
              deactivated an item that still held stock — stranding its value in
              GL 1200 — while the Deactivate button on the item detail screen
              refuses exactly that. Activating and deactivating belong there,
              where the on-hand guard lives and where reactivation already is.

              An item that already carries a sourceAgencyId keeps it: the form
              still holds the value and still sends it, so hiding the picker
              never clears an existing association. A new item leaves it empty
              and the serializer omits empty optional fields. */}
          {agenciesEnabled && (
            <>
              {renderSectionHeader('location', '📍  Warehouse')}
              {!collapsed.location && (
                <View style={styles.sectionBody}>
                  <CustomDropdown
                    label="Warehouse / Agency"
                    options={agencyOptions}
                    value={form.sourceAgencyId}
                    onChange={val => updateField('sourceAgencyId', val)}
                    placeholder="Select warehouse (optional)..."
                  />
                </View>
              )}
            </>
          )}

          {/* ── Save ── */}
          <View style={styles.btnRow}>
            <CustomButton
              title={isEdit ? 'Update Item' : 'Create Item'}
              onPress={handleSave}
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isSaving}
            />
          </View>

          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Agency Selection Prompt ── */}
      <Modal
        visible={agenciesEnabled && showAgencyPrompt}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAgencyPrompt(false)}
      >
        <View style={styles.promptOverlay}>
          <View style={styles.promptSheet}>
            <Text style={styles.promptTitle}>Select Warehouse / Agency</Text>
            <Text style={styles.promptSubtitle}>
              Which warehouse does this inventory item belong to?
            </Text>
            <FlatList
              data={agencyOptions}
              keyExtractor={o => o.value}
              style={{ maxHeight: 280 }}
              renderItem={({ item: opt }) => (
                <TouchableOpacity
                  style={[
                    styles.promptOption,
                    form.sourceAgencyId === opt.value && styles.promptOptionSelected,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    updateField('sourceAgencyId', opt.value);
                    setShowAgencyPrompt(false);
                  }}
                >
                  <Text style={[
                    styles.promptOptionText,
                    form.sourceAgencyId === opt.value && styles.promptOptionTextSelected,
                  ]}>
                    {opt.label}
                  </Text>
                  {opt.value !== '' && (
                    <Text style={styles.promptOptionBadge}>Warehouse</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ═══════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },

  // Stock is shown, never typed — it only moves through a posting path.
  readOnlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xxs,
  },
  readOnlyLabel: { ...typography.bodySm, color: colors.textSecondary },
  readOnlyValue: { ...typography.bodyLg, color: colors.textPrimary, fontWeight: typography.labelLg.fontWeight },
  fieldHelp: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 17,
    marginBottom: spacing.xs,
  },
  form: {
    padding: spacing.xl,
  },

  // ── Sections ──────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 4,
    borderRadius: radius.sm,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    ...typography.labelLg,
    color: colors.textPrimary,
  },
  sectionChevron: {
    ...typography.bodySm,
    color: colors.textTertiary,
  },
  sectionBody: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    marginBottom: spacing.xxs,
  },

  // ── SKU row ───────────────────────────────────────
  skuRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  skuInput: { flex: 1 },
  autoGenBtn: {
    backgroundColor: colors.secondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 4,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  autoGenText: {
    ...typography.labelMd,
    color: colors.surface,
  },

  // ── Markup ────────────────────────────────────────
  markupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    marginTop: spacing.xxs,
  },
  markupLabel: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  markupValue: {
    ...typography.labelLg,
    color: colors.success,
  },

  // ── Row fields ────────────────────────────────────
  rowFields: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  halfField: { flex: 1 },

  // ── Save button ───────────────────────────────────
  btnRow: {
    marginTop: spacing.md,
  },

  // ── Agency Prompt Modal ───────────────────────────
  promptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  promptSheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
  },
  promptTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  promptSubtitle: {
    ...typography.bodySm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  promptOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xxs + 2,
    backgroundColor: colors.surface,
  },
  promptOptionSelected: {
    borderColor: colors.actionGreen,
    backgroundColor: colors.actionGreen + '0A',
  },
  promptOptionText: {
    ...typography.h5,
    color: colors.textPrimary,
    flex: 1,
  },
  promptOptionTextSelected: {
    color: colors.actionGreen,
  },
  promptOptionBadge: {
    ...typography.overline,
    color: colors.secondary,
    backgroundColor: colors.secondary + '18',
    paddingHorizontal: spacing.xxs + 2,
    paddingVertical: 2,
    borderRadius: 6,
  }
});

export default InventoryFormScreen;
