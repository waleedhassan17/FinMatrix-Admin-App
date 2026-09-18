// ═══════════════════════════════════════════════════════
// FinMatrix — Company Management Screen (Super Admin)
// ═══════════════════════════════════════════════════════

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Alert } from '../../../utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { THEME, statusStyle } from '../../../theme';
import { AdminScreenHeader } from '../../../components/admin/AdminUI';

// Design-system tokens (see src/theme/theme.ts).
const { colors, radius, shadows, spacing, typography } = THEME;
import {
  loadCompanies,
  updateCompanyStatusLocal,
  setCompaniesFilter,
  selectCompanies,
  selectCompaniesTotal,
  selectCompaniesStatus,
  selectCompaniesFilter,
  selectCompaniesError,
  type CompanyListItem,
} from '../superAdminSlice';

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Rejected', value: 'rejected' },
];

const REJECT_REASONS = [
  'Incomplete documentation',
  'Invalid business information',
  'Duplicate registration',
  'Policy violation',
  'Suspicious activity',
];

// ── Filter Chip ───────────────────────────────────────
const FilterChip: React.FC<{
  label: string;
  active: boolean;
  onPress: () => void;
  count?: number;
}> = ({ label, active, onPress, count }) => (
  <TouchableOpacity
    style={[S.chip, active && S.chipActive]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text style={[S.chipText, active && S.chipTextActive]}>{label}</Text>
    {count !== undefined && count > 0 && (
      <View style={[S.chipBadge, active && S.chipBadgeActive]}>
        <Text style={[S.chipBadgeText, active && S.chipBadgeTextActive]}>{count}</Text>
      </View>
    )}
  </TouchableOpacity>
);

// ── Review Modal ──────────────────────────────────────
const ReviewModal: React.FC<{
  visible: boolean;
  company: CompanyListItem | null;
  onClose: () => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onDeactivate: () => void;
  onReactivate: () => void;
}> = ({ visible, company, onClose, onApprove, onReject, onDeactivate, onReactivate }) => {
  const [tab, setTab] = useState<'info' | 'action'>('info');
  const [action, setAction] = useState<'approve' | 'reject' | 'deactivate' | 'reactivate' | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      setTab('info');
      setAction(null);
      setReason('');
      setSubmitting(false);
      Animated.spring(scaleAnim, { toValue: 1, tension: 70, friction: 10, useNativeDriver: true }).start();
    } else {
      scaleAnim.setValue(0.9);
    }
  }, [visible]);

  if (!company) return null;

  const cfg = statusStyle(company.status);
  // Normalize status onto the canonical model to pick the available actions.
  const norm =
    company.status === 'approved' || company.status === 'active' || !company.status
      ? 'active'
      : company.status === 'suspended' || company.status === 'inactive'
        ? 'inactive'
        : company.status === 'rejected'
          ? 'rejected'
          : 'pending';

  const handleSubmit = async () => {
    if (action === 'reject' && !reason.trim()) {
      Alert.alert('Required', 'Please provide a rejection reason');
      return;
    }
    setSubmitting(true);
    if (action === 'approve') onApprove();
    else if (action === 'reject') onReject(reason.trim());
    else if (action === 'deactivate') onDeactivate();
    else if (action === 'reactivate') onReactivate();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={S.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={[S.modal, { transform: [{ scale: scaleAnim }] }]}>
          {/* Modal Header */}
          <LinearGradient colors={[colors.primary, colors.primaryDark]} style={S.modalHeader}>
            <View style={S.modalAvatar}>
              <Text style={S.modalAvatarText}>{company.name.slice(0, 2).toUpperCase()}</Text>
            </View>
            <View style={S.modalHeaderInfo}>
              <Text style={S.modalCompanyName} numberOfLines={1}>{company.name}</Text>
              <Text style={S.modalIndustry}>{company.industry ?? 'General'}</Text>
            </View>
            <View style={[S.modalStatusBadge, { backgroundColor: cfg.bg }]}>
              <Text style={[S.modalStatusText, { color: cfg.fg }]}>{company.status}</Text>
            </View>
          </LinearGradient>

          {/* Tabs */}
          <View style={S.modalTabs}>
            {(['info', 'action'] as const).map(t => (
              <TouchableOpacity
                key={t}
                style={[S.modalTab, tab === t && S.modalTabActive]}
                onPress={() => setTab(t)}
              >
                <Text style={[S.modalTabText, tab === t && S.modalTabTextActive]}>
                  {t === 'info' ? 'Company Info' : 'Take Action'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {tab === 'info' ? (
            <ScrollView style={S.modalContent} showsVerticalScrollIndicator={false}>
              <InfoRow icon="mail" label="Email" value={company.email ?? 'N/A'} />
              <InfoRow icon="phone" label="Phone" value={company.phone ?? 'N/A'} />
              <InfoRow icon="users" label="Members" value={String(company.memberCount)} />
              <InfoRow icon="credit-card" label="Current Plan" value={company.planName ?? 'No Plan'} />
              <InfoRow
                icon="calendar"
                label="Registered"
                value={new Date(company.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric', month: 'short', day: 'numeric',
                })}
              />
              {company.rejectionReason && (
                <View style={S.rejectionBox}>
                  <Text style={S.rejectionLabel}>Rejection Reason</Text>
                  <Text style={S.rejectionText}>{company.rejectionReason}</Text>
                </View>
              )}
            </ScrollView>
          ) : (
            <ScrollView style={S.modalContent} showsVerticalScrollIndicator={false}>
              <Text style={S.actionPrompt}>Select an action for this company:</Text>

              {/* Approve — for pending or previously-rejected companies. */}
              {(norm === 'pending' || norm === 'rejected') && (
                <TouchableOpacity
                  style={[S.actionOption, action === 'approve' && S.actionOptionActive]}
                  onPress={() => setAction('approve')}
                >
                  <View style={[S.actionOptionIcon, { backgroundColor: colors.successLighter }]}>
                    <Feather name="check-circle" size={20} color={THEME.colors.success} />
                  </View>
                  <View style={S.actionOptionInfo}>
                    <Text style={S.actionOptionTitle}>{norm === 'rejected' ? 'Re-approve Company' : 'Approve Company'}</Text>
                    <Text style={S.actionOptionDesc}>Grant full access; the owner can log in immediately</Text>
                  </View>
                  {action === 'approve' && <Feather name="check" size={18} color={THEME.colors.secondary} />}
                </TouchableOpacity>
              )}

              {/* Reject — for pending companies. */}
              {norm === 'pending' && (
                <TouchableOpacity
                  style={[S.actionOption, action === 'reject' && S.actionOptionActive]}
                  onPress={() => setAction('reject')}
                >
                  <View style={[S.actionOptionIcon, { backgroundColor: colors.dangerLighter }]}>
                    <Feather name="x-circle" size={20} color={THEME.colors.danger} />
                  </View>
                  <View style={S.actionOptionInfo}>
                    <Text style={S.actionOptionTitle}>Reject Application</Text>
                    <Text style={S.actionOptionDesc}>Deny access with a reason</Text>
                  </View>
                  {action === 'reject' && <Feather name="check" size={18} color={THEME.colors.secondary} />}
                </TouchableOpacity>
              )}

              {/* Deactivate — for active companies (blocks logins immediately). */}
              {norm === 'active' && (
                <TouchableOpacity
                  style={[S.actionOption, action === 'deactivate' && S.actionOptionActive]}
                  onPress={() => setAction('deactivate')}
                >
                  <View style={[S.actionOptionIcon, { backgroundColor: colors.warningLighter }]}>
                    <Feather name="pause-circle" size={20} color={THEME.colors.warning} />
                  </View>
                  <View style={S.actionOptionInfo}>
                    <Text style={S.actionOptionTitle}>Deactivate Company</Text>
                    <Text style={S.actionOptionDesc}>Revoke access; users are blocked at login</Text>
                  </View>
                  {action === 'deactivate' && <Feather name="check" size={18} color={THEME.colors.secondary} />}
                </TouchableOpacity>
              )}

              {/* Reactivate — for inactive companies. */}
              {norm === 'inactive' && (
                <TouchableOpacity
                  style={[S.actionOption, action === 'reactivate' && S.actionOptionActive]}
                  onPress={() => setAction('reactivate')}
                >
                  <View style={[S.actionOptionIcon, { backgroundColor: colors.successLighter }]}>
                    <Feather name="play-circle" size={20} color={THEME.colors.success} />
                  </View>
                  <View style={S.actionOptionInfo}>
                    <Text style={S.actionOptionTitle}>Reactivate Company</Text>
                    <Text style={S.actionOptionDesc}>Restore access; users can log in again</Text>
                  </View>
                  {action === 'reactivate' && <Feather name="check" size={18} color={THEME.colors.secondary} />}
                </TouchableOpacity>
              )}

              {action === 'reject' && (
                <View style={S.reasonSection}>
                  <Text style={S.reasonLabel}>Rejection Reason *</Text>
                  <View style={S.quickReasons}>
                    {REJECT_REASONS.map(r => (
                      <TouchableOpacity
                        key={r}
                        style={[S.quickReason, reason === r && S.quickReasonActive]}
                        onPress={() => setReason(r)}
                      >
                        <Text style={[S.quickReasonText, reason === r && S.quickReasonTextActive]}>
                          {r}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    style={S.reasonInput}
                    value={reason}
                    onChangeText={setReason}
                    placeholder="Or type a custom reason..."
                    multiline
                    numberOfLines={3}
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
              )}
            </ScrollView>
          )}

          {/* Modal Footer */}
          <View style={S.modalFooter}>
            <TouchableOpacity style={S.cancelBtn} onPress={onClose}>
              <Text style={S.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            {tab === 'action' && action && (
              <TouchableOpacity
                style={[S.submitBtn, action === 'approve' || action === 'reactivate' ? S.submitApprove : S.submitReject]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={colors.neutral0} />
                ) : (
                  <Text style={S.submitBtnText}>
                    {action === 'approve'
                      ? 'Approve'
                      : action === 'reject'
                        ? 'Reject'
                        : action === 'deactivate'
                          ? 'Deactivate'
                          : 'Reactivate'}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const InfoRow: React.FC<{ icon: string; label: string; value: string }> = ({
  icon, label, value,
}) => (
  <View style={S.infoRow}>
    <View style={S.infoIcon}>
      <Feather name={icon as any} size={15} color={colors.primary} />
    </View>
    <Text style={S.infoLabel}>{label}</Text>
    <Text style={S.infoValue} numberOfLines={1}>{value}</Text>
  </View>
);

// ── Company Card ──────────────────────────────────────
const CompanyCard: React.FC<{
  company: CompanyListItem;
  onPress: () => void;
}> = ({ company, onPress }) => {
  const cfg = statusStyle(company.status);
  return (
    <TouchableOpacity style={S.companyCard} onPress={onPress} activeOpacity={0.75}>
      <View style={S.companyAvatar}>
        <Text style={S.companyAvatarText}>{company.name.slice(0, 2).toUpperCase()}</Text>
      </View>
      <View style={S.companyInfo}>
        <Text style={S.companyName} numberOfLines={1}>{company.name}</Text>
        <Text style={S.companyMeta}>
          {company.industry ?? 'General'} · {company.memberCount} member{company.memberCount !== 1 ? 's' : ''}
        </Text>
        {company.planName && (
          <Text style={S.companyPlan}>{company.planName}</Text>
        )}
      </View>
      <View style={S.companyRight}>
        <View style={[S.statusBadge, { backgroundColor: cfg.bg, borderColor: cfg.fg }]}>
          <Text style={[S.statusText, { color: cfg.fg }]}>{company.status}</Text>
        </View>
        <Feather name="chevron-right" size={16} color={colors.textTertiary} style={{ marginTop: spacing.xxs }} />
      </View>
    </TouchableOpacity>
  );
};

// ═══════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════
const CompanyManagementScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<any>();

  const companies = useAppSelector(selectCompanies);
  const total = useAppSelector(selectCompaniesTotal);
  const status = useAppSelector(selectCompaniesStatus);
  const filter = useAppSelector(selectCompaniesFilter);
  const error = useAppSelector(selectCompaniesError);

  const [selectedCompany, setSelectedCompany] = useState<CompanyListItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    const initialFilter = route.params?.filter;
    if (initialFilter) {
      dispatch(setCompaniesFilter(initialFilter));
    }
    dispatch(loadCompanies({ page: 1, filter: initialFilter ?? filter }));
  }, []);

  const onFilterChange = useCallback(
    (val: string) => {
      dispatch(setCompaniesFilter(val));
      dispatch(loadCompanies({ page: 1, filter: val }));
    },
    [dispatch],
  );

  const openModal = useCallback((company: CompanyListItem) => {
    setSelectedCompany(company);
    setModalVisible(true);
  }, []);

  const handleApprove = useCallback(async () => {
    if (!selectedCompany) return;
    await dispatch(
      updateCompanyStatusLocal({ id: selectedCompany.id, status: 'active' }),
    );
    setModalVisible(false);
    Alert.alert('Approved', `${selectedCompany.name} has been approved.`);
  }, [dispatch, selectedCompany]);

  const handleReject = useCallback(
    async (reason: string) => {
      if (!selectedCompany) return;
      await dispatch(
        updateCompanyStatusLocal({
          id: selectedCompany.id,
          status: 'rejected',
          rejectionReason: reason,
        }),
      );
      setModalVisible(false);
      Alert.alert('Rejected', `${selectedCompany.name} has been rejected.`);
    },
    [dispatch, selectedCompany],
  );

  const handleDeactivate = useCallback(async () => {
    if (!selectedCompany) return;
    await dispatch(
      updateCompanyStatusLocal({ id: selectedCompany.id, status: 'inactive' }),
    );
    setModalVisible(false);
    Alert.alert('Deactivated', `${selectedCompany.name} has been deactivated. Its users are now blocked.`);
  }, [dispatch, selectedCompany]);

  const handleReactivate = useCallback(async () => {
    if (!selectedCompany) return;
    await dispatch(
      updateCompanyStatusLocal({ id: selectedCompany.id, status: 'active' }),
    );
    setModalVisible(false);
    Alert.alert('Reactivated', `${selectedCompany.name} is active again.`);
  }, [dispatch, selectedCompany]);

  const loadMore = useCallback(() => {
    if (status === 'loading') return;
    const currentPage = Math.ceil(companies.length / 20);
    if (companies.length < total) {
      dispatch(loadCompanies({ page: currentPage + 1, filter }));
    }
  }, [dispatch, companies.length, total, status, filter]);

  const onRefresh = useCallback(() => {
    dispatch(loadCompanies({ page: 1, filter }));
  }, [dispatch, filter]);

  const isLoading = status === 'loading' && companies.length === 0;

  return (
    <SafeAreaView style={S.container} edges={['top']}>
      {/* Header */}
      <AdminScreenHeader
        title="Companies"
        subtitle={`${total} total registered`}
        left={
          <TouchableOpacity onPress={() => navigation.goBack()} style={S.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        }
        right={
          <TouchableOpacity
            onPress={onRefresh}
            style={S.refreshBtn}
            disabled={status === 'loading'}
          >
            <Feather name="refresh-cw" size={18} color={colors.primary} />
          </TouchableOpacity>
        }
      />

      {/* Filter Chips */}
      <View style={S.filtersRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.filtersContent}>
          {FILTERS.map(f => (
            <FilterChip
              key={f.value}
              label={f.label}
              active={filter === f.value}
              onPress={() => onFilterChange(f.value)}
            />
          ))}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={S.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={S.loadingText}>Loading companies...</Text>
        </View>
      ) : error ? (
        <View style={S.centered}>
          <Feather name="alert-circle" size={32} color={THEME.colors.danger} />
          <Text style={S.errorText}>{error}</Text>
          <TouchableOpacity style={S.retryBtn} onPress={onRefresh}>
            <Text style={S.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={companies}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <CompanyCard company={item} onPress={() => openModal(item)} />
          )}
          contentContainerStyle={S.listContent}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={S.empty}>
              <Feather name="briefcase" size={40} color={colors.textTertiary} />
              <Text style={S.emptyText}>No companies found</Text>
            </View>
          }
          ListFooterComponent={
            status === 'loading' && companies.length > 0 ? (
              <ActivityIndicator color={colors.primary} style={{ padding: spacing.md }} />
            ) : null
          }
        />
      )}

      <ReviewModal
        visible={modalVisible}
        company={selectedCompany}
        onClose={() => setModalVisible(false)}
        onApprove={handleApprove}
        onReject={handleReject}
        onDeactivate={handleDeactivate}
        onReactivate={handleReactivate}
      />
    </SafeAreaView>
  );
};

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backBtn: { padding: spacing.xxs },
  refreshBtn: { padding: 6 },

  filtersRow: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  filtersContent: { paddingHorizontal: spacing.md, paddingVertical: 10, gap: spacing.xs },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xxs,
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, backgroundColor: colors.neutral100,
    borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.labelSm, color: colors.textSecondary },
  chipTextActive: { color: colors.neutral0 },
  chipBadge: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.border,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxs,
  },
  chipBadgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  chipBadgeText: { ...typography.overline, color: colors.textSecondary },
  chipBadgeTextActive: { color: colors.neutral0 },

  listContent: { padding: spacing.md, gap: 10, paddingBottom: 30 },
  companyCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: 14, gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: colors.neutral900, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  companyAvatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: colors.primaryLighter,
    alignItems: 'center', justifyContent: 'center',
  },
  companyAvatarText: { ...typography.h4, color: colors.primary },
  companyInfo: { flex: 1 },
  companyName: { ...typography.h5, color: colors.textPrimary },
  companyMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  companyPlan: {
    ...typography.overline, color: colors.primary, 
    marginTop: 3, backgroundColor: colors.primaryLighter,
    alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.xs,
  },
  companyRight: { alignItems: 'flex-end', gap: spacing.xxs },
  statusBadge: {
    paddingHorizontal: spacing.xs, paddingVertical: 3,
    borderRadius: radius.md, borderWidth: 1,
  },
  statusText: { ...typography.overline, textTransform: 'capitalize' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loadingText: { ...typography.bodySm, color: colors.textSecondary },
  errorText: { ...typography.bodySm, color: colors.danger, textAlign: 'center', paddingHorizontal: spacing.lg },
  retryBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, backgroundColor: colors.primary, borderRadius: radius.sm },
  retryText: { color: colors.neutral0, ...typography.labelMd },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { ...typography.bodySm, color: colors.textSecondary },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '90%', overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.md, gap: spacing.sm,
  },
  modalAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  modalAvatarText: { ...typography.h4, color: colors.neutral0 },
  modalHeaderInfo: { flex: 1 },
  modalCompanyName: { ...typography.h4, color: colors.neutral0 },
  modalIndustry: { ...typography.caption, color: 'rgba(255,255,255,0.75)' },
  modalStatusBadge: { paddingHorizontal: spacing.xs, paddingVertical: spacing.xxs, borderRadius: radius.md },
  modalStatusText: { ...typography.overline, textTransform: 'capitalize' },
  modalTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTab: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center' },
  modalTabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  modalTabText: { ...typography.labelMd, color: colors.textSecondary },
  modalTabTextActive: { color: colors.primary },
  modalContent: { maxHeight: 340, padding: spacing.md },
  modalFooter: {
    flexDirection: 'row', padding: spacing.md, gap: 10,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  cancelBtn: {
    flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md,
    backgroundColor: colors.neutral100, alignItems: 'center',
  },
  cancelBtnText: { ...typography.h5, color: colors.textSecondary },
  submitBtn: { flex: 2, paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: 'center' },
  submitApprove: { backgroundColor: colors.success },
  submitReject: { backgroundColor: colors.danger },
  submitBtnText: { ...typography.h5, color: colors.neutral0 },

  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.neutral100,
  },
  infoIcon: {
    width: 32, height: 32, borderRadius: radius.sm,
    backgroundColor: colors.primaryLighter, alignItems: 'center', justifyContent: 'center',
  },
  infoLabel: { width: 80, ...typography.caption, color: colors.textSecondary },
  infoValue: { flex: 1, ...typography.bodySm, color: colors.textPrimary, fontWeight: typography.labelLg.fontWeight },
  rejectionBox: {
    marginTop: spacing.sm, padding: spacing.sm,
    backgroundColor: colors.dangerLighter, borderRadius: radius.sm, borderLeftWidth: 3, borderLeftColor: colors.danger,
  },
  rejectionLabel: { ...typography.overline, color: colors.danger, marginBottom: spacing.xxs },
  rejectionText: { ...typography.caption, color: colors.danger },

  actionPrompt: { ...typography.bodySm, color: colors.textSecondary, marginBottom: spacing.sm },
  actionOption: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.xs, backgroundColor: colors.neutral25,
  },
  actionOptionActive: {
    borderColor: colors.primary, backgroundColor: colors.primaryLighter,
  },
  actionOptionIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  actionOptionInfo: { flex: 1 },
  actionOptionTitle: { ...typography.labelMd, color: colors.textPrimary },
  actionOptionDesc: { ...typography.overline, color: colors.textSecondary, marginTop: 2 },

  reasonSection: { marginTop: spacing.xs },
  reasonLabel: { ...typography.caption, color: colors.textPrimary, marginBottom: spacing.xs },
  quickReasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  quickReason: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.xl, backgroundColor: colors.neutral100,
    borderWidth: 1, borderColor: colors.border,
  },
  quickReasonActive: { backgroundColor: colors.primaryLighter, borderColor: colors.primary },
  quickReasonText: { ...typography.caption, color: colors.textSecondary },
  quickReasonTextActive: { color: colors.primary, fontWeight: typography.labelLg.fontWeight },
  reasonInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.sm, ...typography.bodySm, color: colors.textPrimary,
    textAlignVertical: 'top', minHeight: 80, backgroundColor: colors.neutral25,
  },
});

export default CompanyManagementScreen;
