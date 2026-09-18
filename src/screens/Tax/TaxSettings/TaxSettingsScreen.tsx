// ═══════════════════════════════════════════════════════
// FinMatrix — Tax Settings Screen
// List of tax rates — add / edit / delete / toggle active
// Enterprise-consistent with Reports / Transactions (ReportUI kit)
// ═══════════════════════════════════════════════════════

import React, { useEffect, useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Switch,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Alert } from '../../../utils/alert';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

import { THEME } from '../../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import {
  fetchTaxRates,
  openAddModal,
  openEditModal,
  closeModal,
  setFormField,
  saveTaxRate,
  toggleActive,
  removeTaxRate,
  selectTaxRates,
  selectTaxSettingsLoading,
  selectTaxSettingsError,
  selectTaxModalVisible,
  selectTaxEditingId,
  selectTaxForm,
  selectTaxIsSaving
} from './taxSettingsSlice';
import type { TaxRate, TaxType } from '../../../types';
import { getStoredCompanyId } from '../../../utils/storageUtils';
import { getCompanyAPI, updateCompanyAPI } from '../../../networks/auth/authNetwork';

// Design-system tokens (see src/theme/theme.ts).
const { colors, typography } = THEME;
import {
  ReportContainer,
  ReportHeader,
  KpiGrid,
  Card,
  Badge,
  LoadingBlock,
  EmptyBlock,
  ACCENT,
  HeaderAction
} from '../../../components/reports/ReportUI';

const TAX_TYPES: TaxType[] = ['GST', 'WHT', 'Income Tax', 'Sales Tax', 'Custom'];

const TYPE_COLOR: Record<TaxType, string> = {
  GST: ACCENT.brand,
  WHT: ACCENT.amber,
  'Income Tax': ACCENT.violet,
  'Sales Tax': ACCENT.teal,
  Custom: THEME.colors.neutral500
};

const TaxSettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const [isPullRefreshing, setIsPullRefreshing] = React.useState(false);
  const handlePullRefresh = React.useCallback(async () => {
    setIsPullRefreshing(true);
    try {
      await dispatch(fetchTaxRates());
    } finally {
      setIsPullRefreshing(false);
    }
  }, [dispatch]);

  const rates = useAppSelector(selectTaxRates);
  const isLoading = useAppSelector(selectTaxSettingsLoading);
  const error = useAppSelector(selectTaxSettingsError);
  const modalVisible = useAppSelector(selectTaxModalVisible);
  const editingId = useAppSelector(selectTaxEditingId);
  const form = useAppSelector(selectTaxForm);
  const isSaving = useAppSelector(selectTaxIsSaving);

  useEffect(() => {
    dispatch(fetchTaxRates());
  }, [dispatch]);

  // GST/Sales-tax registration flag (FinMatrix.md §21). When on, input tax on
  // bills is reclaimed to Sales Tax Recoverable (1300) and the liability report
  // shows net tax = output − input. Loaded/saved directly against the company.
  const [companyId, setCompanyId] = useState('');
  const [taxRegistered, setTaxRegistered] = useState(false);
  const [regSaving, setRegSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cid = await getStoredCompanyId();
        if (!cid || !alive) return;
        setCompanyId(cid);
        const c = await getCompanyAPI(cid);
        if (alive) setTaxRegistered(!!c?.salesTaxRegistered);
      } catch {
        /* leave default (unregistered) */
      }
    })();
    return () => { alive = false; };
  }, []);

  const handleToggleRegistered = useCallback(
    async (value: boolean) => {
      if (!companyId || regSaving) return;
      setTaxRegistered(value); // optimistic
      setRegSaving(true);
      try {
        await updateCompanyAPI(companyId, { salesTaxRegistered: value });
      } catch (e: any) {
        setTaxRegistered(!value); // revert on failure
        Alert.alert('Update failed', e?.message ?? 'Could not update tax registration.');
      } finally {
        setRegSaving(false);
      }
    },
    [companyId, regSaving],
  );

  const activeCount = useMemo(() => rates.filter(r => r.isActive).length, [rates]);

  const handleDelete = useCallback(
    (rate: TaxRate) => {
      Alert.alert('Delete Tax Rate', `Delete "${rate.name}"? This cannot be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => dispatch(removeTaxRate(rate.id)) },
      ]);
    },
    [dispatch],
  );

  const handleSave = useCallback(() => {
    if (!form.name.trim()) {
      Alert.alert('Validation', 'Tax name is required.');
      return;
    }
    const rateNum = parseFloat(form.rate);
    if (isNaN(rateNum) || rateNum < 0 || rateNum > 100) {
      Alert.alert('Validation', 'Rate must be a number between 0 and 100.');
      return;
    }
    dispatch(saveTaxRate());
  }, [dispatch, form]);

  const renderItem = useCallback(
    ({ item }: { item: TaxRate }) => {
      const color = TYPE_COLOR[item.taxType] ?? TYPE_COLOR.Custom;
      return (
        <Card style={styles.card} padded={false}>
          <View style={styles.cardInner}>
            <View style={[styles.iconCircle, { backgroundColor: `${color}14` }]}>
              <Feather name="percent" size={18} color={color} />
            </View>
            <View style={styles.cardInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.rateName} numberOfLines={1}>{item.name}</Text>
                <Text style={[styles.rateValue, { color }]}>{item.rate}%</Text>
              </View>
              {!!item.description && (
                <Text style={styles.rateDesc} numberOfLines={1}>{item.description}</Text>
              )}
              <View style={styles.badgeRow}>
                <Badge label={item.taxType} color={color} dot={false} />
                {!item.isActive && <Badge label="Inactive" color={THEME.colors.textTertiary} dot={false} />}
              </View>
            </View>
          </View>

          <View style={styles.cardActions}>
            <Switch
              value={item.isActive}
              onValueChange={() => {
                dispatch(toggleActive(item.id));
              }}
              trackColor={{ false: THEME.colors.neutral200, true: THEME.colors.primary + '60' }}
              thumbColor={item.isActive ? THEME.colors.primary : THEME.colors.textDisabled}
              ios_backgroundColor={THEME.colors.neutral200}
            />
            <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={() => dispatch(openEditModal(item))}>
              <Feather name="edit-2" size={15} color={THEME.colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: THEME.colors.dangerLight }]}
              activeOpacity={0.7}
              onPress={() => handleDelete(item)}
            >
              <Feather name="trash-2" size={15} color={THEME.colors.danger} />
            </TouchableOpacity>
          </View>
        </Card>
      );
    },
    [dispatch, handleDelete],
  );

  return (
    <ReportContainer>
      <ReportHeader
        title="Tax Settings"
        subtitle="Manage tax rates"
        onBack={() => navigation.goBack()}
        backLabel="More"
        right={
          <HeaderAction label="New" onPress={() => dispatch(openAddModal())} />
        }
      />

      {isLoading && rates.length === 0 ? (
        <LoadingBlock label="Loading tax rates…" />
      ) : (
        <FlatList
          refreshControl={
            <RefreshControl
              refreshing={isPullRefreshing}
              onRefresh={handlePullRefresh}
              tintColor={THEME.colors.primary}
            />
          }
          data={rates}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <KpiGrid
                items={[
                  { label: 'Total Rates', value: String(rates.length), accent: ACCENT.brand, icon: 'percent' },
                  { label: 'Active', value: String(activeCount), accent: ACCENT.green, icon: 'check-circle' },
                ]}
              />

              <Card style={styles.regCard}>
                <View style={styles.regRow}>
                  <View style={styles.regTextWrap}>
                    <Text style={styles.regTitle}>GST / Sales-tax registered</Text>
                    <Text style={styles.regSub}>
                      Reclaim input tax on bills to a recoverable asset. Liability = output tax − input tax.
                    </Text>
                  </View>
                  <Switch
                    value={taxRegistered}
                    onValueChange={handleToggleRegistered}
                    disabled={regSaving || !companyId}
                    trackColor={{ false: THEME.colors.neutral200, true: THEME.colors.primary + '60' }}
                    thumbColor={taxRegistered ? THEME.colors.primary : THEME.colors.textDisabled}
                    ios_backgroundColor={THEME.colors.neutral200}
                  />
                </View>
              </Card>

              {!!error && (
                <View style={styles.errorBanner}>
                  <Feather name="alert-circle" size={14} color={THEME.colors.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={{ paddingTop: THEME.spacing.lg }}>
              <EmptyBlock icon="percent" title="No tax rates" hint="Tap Add to create your first tax rate." />
            </View>
          }
        />
      )}

      {/* ── Add / Edit Modal ── */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => dispatch(closeModal())}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => dispatch(closeModal())} />
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{editingId ? 'Edit Tax Rate' : 'New Tax Rate'}</Text>

              <Text style={styles.fieldLabel}>Name *</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. GST 17%"
                placeholderTextColor={THEME.colors.textTertiary}
                value={form.name}
                onChangeText={v => dispatch(setFormField({ name: v }))}
              />

              <Text style={styles.fieldLabel}>Rate (%) *</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. 17"
                placeholderTextColor={THEME.colors.textTertiary}
                keyboardType="decimal-pad"
                value={form.rate}
                onChangeText={v => dispatch(setFormField({ rate: v }))}
              />

              <Text style={styles.fieldLabel}>Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeRow}>
                {TAX_TYPES.map(t => {
                  const selected = form.taxType === t;
                  const c = TYPE_COLOR[t];
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[
                        styles.typeChip,
                        selected
                          ? { backgroundColor: `${c}14`, borderColor: c }
                          : { backgroundColor: THEME.colors.neutral50, borderColor: THEME.colors.border },
                      ]}
                      onPress={() => dispatch(setFormField({ taxType: t }))}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.typeChipText, { color: selected ? c : THEME.colors.textSecondary }]}>{t}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldInputMulti]}
                placeholder="Brief description of when this tax applies"
                placeholderTextColor={THEME.colors.textTertiary}
                value={form.description}
                onChangeText={v => dispatch(setFormField({ description: v }))}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <View style={styles.activeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabelInline}>Active</Text>
                  <Text style={styles.activeHint}>Inactive rates won't appear in transaction forms</Text>
                </View>
                <Switch
                  value={form.isActive}
                  onValueChange={v => {
                    dispatch(setFormField({ isActive: v }));
                  }}
                  trackColor={{ false: THEME.colors.neutral200, true: THEME.colors.primary + '60' }}
                  thumbColor={form.isActive ? THEME.colors.primary : THEME.colors.textDisabled}
                  ios_backgroundColor={THEME.colors.neutral200}
                />
              </View>

              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => dispatch(closeModal())} activeOpacity={0.7}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, isSaving && { opacity: 0.7 }]}
                  onPress={handleSave}
                  activeOpacity={0.8}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator color={colors.neutral0} size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>{editingId ? 'Update' : 'Add Rate'}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ReportContainer>
  );
};

const styles = StyleSheet.create({

  listContent: { padding: THEME.spacing.md, gap: 10, paddingBottom: THEME.spacing.xxxl },
  listHeader: { gap: THEME.spacing.sm + 2, marginBottom: THEME.spacing.xs },
  regCard: { paddingVertical: 12, paddingHorizontal: 14 },
  regRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  regTextWrap: { flex: 1 },
  regTitle: { ...THEME.typography.labelLg,  color: THEME.colors.textPrimary },
  regSub: { ...THEME.typography.labelSm, color: THEME.colors.textSecondary, marginTop: 3, lineHeight: 16 },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.dangerLight,
    borderRadius: THEME.radius.md,
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: 10,
  },
  errorText: { flex: 1, ...THEME.typography.bodySm, color: THEME.colors.danger },

  // Card
  card: { marginBottom: 0 },
  cardInner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, paddingBottom: 10 },
  iconCircle: { width: 40, height: 40, borderRadius: THEME.radius.md, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rateName: { ...THEME.typography.h5, color: THEME.colors.textPrimary, flex: 1 },
  rateValue: { ...THEME.typography.h5, fontWeight: typography.labelLg.fontWeight },
  rateDesc: { ...THEME.typography.caption, color: THEME.colors.textSecondary, marginTop: 2 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },

  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: THEME.colors.borderLight,
    marginTop: 2,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: THEME.colors.overlay },
  modalSheet: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: THEME.radius.xxl,
    borderTopRightRadius: THEME.radius.xxl,
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: 12,
    paddingBottom: 32,
    maxHeight: '90%',
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: THEME.colors.neutral200, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { ...THEME.typography.h3, color: THEME.colors.textPrimary, marginBottom: THEME.spacing.sm },
  fieldLabel: { ...THEME.typography.labelMd, color: THEME.colors.textSecondary, marginBottom: 6, marginTop: THEME.spacing.sm },
  fieldLabelInline: { ...THEME.typography.labelMd, color: THEME.colors.textPrimary },
  fieldInput: {
    backgroundColor: THEME.colors.neutral50,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    ...THEME.typography.bodyMd,
    color: THEME.colors.textPrimary,
  },
  fieldInputMulti: { minHeight: 80 },
  typeRow: { flexDirection: 'row', marginBottom: 4 },
  typeChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: THEME.radius.full, borderWidth: 1.5, marginRight: 8 },
  typeChipText: { ...THEME.typography.labelMd },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: THEME.spacing.md,
    backgroundColor: THEME.colors.neutral50,
    borderRadius: THEME.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  activeHint: { ...THEME.typography.caption, color: THEME.colors.textTertiary, marginTop: 2 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: THEME.spacing.lg },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: THEME.radius.md,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { ...THEME.typography.h5, color: THEME.colors.textSecondary },
  saveBtn: { flex: 2, height: 46, borderRadius: THEME.radius.md, backgroundColor: THEME.colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { ...THEME.typography.h5, color: colors.neutral0 }
});

export default TaxSettingsScreen;
