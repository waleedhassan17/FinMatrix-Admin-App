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
  RefreshControl,
} from 'react-native';
import { Alert } from '../../../utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompaniesStackParamList } from '../../../navigators/CompaniesStackNavigator';

import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { THEME, statusStyle } from '../../../theme';
import { BILLING_DISABLED_BUILD } from '../../../utils/featureFlags';
import { companyStage, companyStatusLabel } from '../../../utils/companyStatus';
import {
  AdminScreenHeader,
  AdminEmptyState,
  AdminErrorState,
  FilterChip,
} from '../../../components/admin/AdminUI';

// Design-system tokens (see src/theme/theme.ts).
const { colors, radius, shadows, spacing, typography } = THEME;
import {
  loadCompanies,
  loadPlatformStats,
  updateCompanyStatusLocal,
  setCompaniesFilter,
  setCompaniesTrial,
  setCompaniesSearch,
  selectCompanies,
  selectCompaniesTotal,
  selectCompaniesStatus,
  selectCompaniesFilter,
  selectCompaniesTrial,
  selectCompaniesSearch,
  selectCompaniesError,
  selectPlatformStats,
  type CompanyListItem,
} from '../superAdminSlice';

// Labelled for the decision, not the database value — the same words as the
// admin web console.
const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Awaiting approval', value: 'pending' },
  { label: 'Active', value: 'active' },
  { label: 'Deactivated', value: 'inactive' },
  { label: 'Rejected', value: 'rejected' },
];

/** Long enough that typing a name is one request, not one per letter. */
const SEARCH_DEBOUNCE_MS = 350;

// The server takes ?isTrial=true|false and ignores anything else; `all` means
// send no param, matching how the status filter treats 'all'.
const TRIAL_FILTERS: { label: string; value: boolean | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'On trial', value: true },
  { label: 'Never on trial', value: false },
];

const REJECT_REASONS = [
  'Incomplete documentation',
  'Invalid business information',
  'Duplicate registration',
  'Policy violation',
  'Suspicious activity',
];


// ── Review Modal ──────────────────────────────────────
const ReviewModal: React.FC<{
  visible: boolean;
  company: CompanyListItem | null;
  onClose: () => void;
  // These settle when the decision has actually been made, so the modal can
  // stop its spinner even when the parent keeps it open after a failure.
  onApprove: () => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  onDeactivate: () => Promise<void>;
  onReactivate: () => Promise<void>;
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
  // A never-submitted company is 'pending' here: it needs the same decision.
  const norm = companyStage(company.status);

  const handleSubmit = async () => {
    if (action === 'reject' && !reason.trim()) {
      Alert.alert('Required', 'Please provide a rejection reason');
      return;
    }
    setSubmitting(true);
    try {
      if (action === 'approve') await onApprove();
      else if (action === 'reject') await onReject(reason.trim());
      else if (action === 'deactivate') await onDeactivate();
      else if (action === 'reactivate') await onReactivate();
    } finally {
      // On success the parent closes the modal and the `visible` effect resets
      // this anyway. On failure the modal stays open, and without this it stayed
      // open on a spinner that never stopped.
      setSubmitting(false);
    }
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
              <Text style={[S.modalStatusText, { color: cfg.fg }]}>
                {companyStatusLabel(company.status)}
              </Text>
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
              {/* The owner first: they are who an administrator calls. */}
              <InfoRow icon="user" label="Owner" value={company.ownerName ?? 'N/A'} />
              <InfoRow
                icon="mail"
                label="Owner email"
                value={company.ownerEmail ?? company.email ?? 'N/A'}
              />
              <InfoRow
                icon="phone"
                label="Phone"
                value={company.ownerPhone ?? company.phone ?? 'N/A'}
              />
              <InfoRow icon="users" label="Team" value={String(company.memberCount)} />
              {!BILLING_DISABLED_BUILD && (
                <InfoRow icon="credit-card" label="Current Plan" value={company.planName ?? 'No Plan'} />
              )}
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
                    <Text style={S.actionOptionDesc}>Pause access at once; nothing is deleted</Text>
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
                    <Text style={S.actionOptionTitle}>Activate Company</Text>
                    <Text style={S.actionOptionDesc}>Restore access; the owner and team can sign in again</Text>
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
                          : 'Activate'}
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
  /** Opens the full record. */
  onPress: () => void;
  /** Opens the quick-decision modal, without leaving the queue. */
  onReview: () => void;
}> = ({ company, onPress, onReview }) => {
  const cfg = statusStyle(company.status);
  return (
    <TouchableOpacity style={S.companyCard} onPress={onPress} activeOpacity={0.75}>
      <View style={S.companyAvatar}>
        <Text style={S.companyAvatarText}>{company.name.slice(0, 2).toUpperCase()}</Text>
      </View>
      <View style={S.companyInfo}>
        <Text style={S.companyName} numberOfLines={1}>{company.name}</Text>
        {/* Who to call about it. */}
        <Text style={S.companyMeta} numberOfLines={1}>
          {[company.ownerName, company.ownerEmail ?? company.email].filter(Boolean).join(' · ') ||
            (company.industry ?? 'General')}
        </Text>
        {!BILLING_DISABLED_BUILD && company.planName && (
          <Text style={S.companyPlan}>{company.planName}</Text>
        )}
        {/* The server has always sent isTrial; nothing rendered it, so a trial
            company looked the same as a paying one. */}
        {!BILLING_DISABLED_BUILD && company.isTrial && (
          <Text style={S.companyTrial}>
            {company.trialConvertedAt ? 'Converted from trial' : 'On free trial'}
          </Text>
        )}
      </View>
      <View style={S.companyRight}>
        <View style={[S.statusBadge, { backgroundColor: cfg.bg, borderColor: cfg.fg }]}>
          <Text style={[S.statusText, { color: cfg.fg }]}>
            {companyStatusLabel(company.status)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onReview}
          style={S.reviewBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Review ${company.name}`}
        >
          <Text style={S.reviewBtnText}>Review</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

// ═══════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════
const CompanyManagementScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation =
    useNavigation<NativeStackNavigationProp<CompaniesStackParamList>>();
  const route = useRoute<any>();

  const companies = useAppSelector(selectCompanies);
  const total = useAppSelector(selectCompaniesTotal);
  const status = useAppSelector(selectCompaniesStatus);
  const filter = useAppSelector(selectCompaniesFilter);
  const trial = useAppSelector(selectCompaniesTrial);
  const search = useAppSelector(selectCompaniesSearch);
  const error = useAppSelector(selectCompaniesError);

  // The field updates on every keystroke; the request follows once typing
  // pauses. The store keeps the committed search, so paging and refresh stay
  // within it.
  const [text, setText] = useState(search);
  useEffect(() => {
    const next = text.trim();
    if (next === search) return;
    const t = setTimeout(() => {
      dispatch(setCompaniesSearch(next));
      dispatch(loadCompanies({ page: 1, search: next }));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text, search, dispatch]);
  const stats = useAppSelector(selectPlatformStats);

  // The chips declared a count badge and rendered it, but nothing ever passed
  // a number, so it could not appear. These are platform-wide totals from
  // /super-admin/stats -- not a count of the page currently loaded.
  const filterCounts: Record<string, number | undefined> = {
    all: stats?.companies.total,
    pending: stats?.companies.pending,
    active: stats?.companies.active,
    inactive: stats?.companies.suspended,
    rejected: stats?.companies.rejected,
  };

  const [selectedCompany, setSelectedCompany] = useState<CompanyListItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    const initialFilter = route.params?.filter;
    if (initialFilter) {
      dispatch(setCompaniesFilter(initialFilter));
    }
    dispatch(loadCompanies({ page: 1, filter: initialFilter ?? filter }));
    // The chip badges read platform-wide counts, which this screen does not
    // otherwise fetch. Cheap, and it keeps the badges honest when the screen
    // is opened directly rather than through the dashboard.
    dispatch(loadPlatformStats());
  }, []);

  const onFilterChange = useCallback(
    (val: string) => {
      dispatch(setCompaniesFilter(val));
      dispatch(loadCompanies({ page: 1, filter: val }));
    },
    [dispatch],
  );

  const onTrialChange = useCallback(
    (val: boolean | undefined) => {
      dispatch(setCompaniesTrial(val));
      dispatch(loadCompanies({ page: 1, isTrial: val }));
    },
    [dispatch],
  );

  const openModal = useCallback((company: CompanyListItem) => {
    setSelectedCompany(company);
    setModalVisible(true);
  }, []);

  // One decision path for all four buttons. They differed only in a status
  // string and two strings of copy, and each awaited the dispatch WITHOUT
  // .unwrap() before announcing success -- a rejected thunk still resolves, so
  // a 403 or a 500 told the reviewer "Approved" while nothing had changed on
  // the server. .unwrap() is what makes the failure reachable; the modal stays
  // open on failure so the reason the reviewer typed is not thrown away.
  const decide = useCallback(
    async (
      status: string,
      title: string,
      body: string,
      rejectionReason?: string,
    ) => {
      if (!selectedCompany) return;
      try {
        await dispatch(
          updateCompanyStatusLocal({
            id: selectedCompany.id,
            status,
            rejectionReason,
          }),
        ).unwrap();
        setModalVisible(false);
        Alert.alert(title, body);
      } catch (e) {
        Alert.alert(
          'Could not update the company',
          e instanceof Error && e.message
            ? e.message
            : 'Please check your connection and try again.',
        );
      }
    },
    [dispatch, selectedCompany],
  );

  const handleApprove = useCallback(
    () =>
      decide('active', 'Approved', `${selectedCompany?.name} has been approved.`),
    [decide, selectedCompany],
  );

  const handleReject = useCallback(
    (reason: string) =>
      decide(
        'rejected',
        'Rejected',
        `${selectedCompany?.name} has been rejected.`,
        reason,
      ),
    [decide, selectedCompany],
  );

  const handleDeactivate = useCallback(
    () =>
      decide(
        'inactive',
        'Deactivated',
        `${selectedCompany?.name} has been deactivated. Its team can no longer sign in, and the owner has been emailed.`,
      ),
    [decide, selectedCompany],
  );

  const handleReactivate = useCallback(
    () =>
      decide(
        'active',
        'Activated',
        `${selectedCompany?.name} is active again. The owner has been emailed.`,
      ),
    [decide, selectedCompany],
  );

  const loadMore = useCallback(() => {
    if (status === 'loading') return;
    const currentPage = Math.ceil(companies.length / 20);
    if (companies.length < total) {
      dispatch(loadCompanies({ page: currentPage + 1, filter }));
    }
  }, [dispatch, companies.length, total, status, filter]);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        dispatch(loadCompanies({ page: 1, filter })),
        dispatch(loadPlatformStats()),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [dispatch, filter]);

  const isLoading = status === 'loading' && companies.length === 0;

  return (
    <SafeAreaView style={S.container} edges={['top']}>
      {/* Header */}
      <AdminScreenHeader
        title="Companies"
        subtitle={`${total} ${search || filter !== 'all' ? 'matching' : 'total registered'}`}
        // No back arrow: this is a bottom-tab root, so goBack() had nothing
        // to pop and the button was a no-op that still looked pressable.
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

      {/* Search: by company, owner or email. */}
      <View style={S.searchWrap}>
        <Feather name="search" size={16} color={colors.textTertiary} />
        <TextInput
          style={S.searchInput}
          value={text}
          onChangeText={setText}
          placeholder="Search company, owner or email"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search companies"
        />
        {text.length > 0 && (
          <TouchableOpacity
            onPress={() => setText('')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Feather name="x" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Chips */}
      <View style={S.filtersRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.filtersContent}>
          {FILTERS.map(f => (
            <FilterChip
              key={f.value}
              label={f.label}
              active={filter === f.value}
              onPress={() => onFilterChange(f.value)}
              count={filterCounts[f.value]}
            />
          ))}
        </ScrollView>
        {/* BILLING-DISABLED BUILD: nothing is sold, so trial history is not a
            way anyone looks for a company. */}
        {!BILLING_DISABLED_BUILD && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.filtersContent}>
            <Text style={S.filterGroupLabel}>Trial</Text>
            {TRIAL_FILTERS.map(f => (
              <FilterChip
                key={String(f.value)}
                label={f.label}
                active={trial === f.value}
                onPress={() => onTrialChange(f.value)}
              />
            ))}
          </ScrollView>
        )}
      </View>

      {isLoading ? (
        <View style={S.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={S.loadingText}>Loading companies...</Text>
        </View>
      ) : error ? (
        <AdminErrorState
          title="Could not load companies"
          message={error}
          onRetry={onRefresh}
        />
      ) : (
        <FlatList
          data={companies}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <CompanyCard
              company={item}
              // Opens the record. The quick-decision modal is still reachable
              // from the row's own action, so a reviewer working a queue does
              // not have to round-trip through the detail screen.
              onPress={() =>
                navigation.navigate('CompanyDetail', {
                  id: item.id,
                  name: item.name,
                })
              }
              onReview={() => openModal(item)}
            />
          )}
          contentContainerStyle={S.listContent}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          // Pull-to-refresh: the header icon was the only way to reload, which
          // is not where anyone reaches for it on a list.
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <AdminEmptyState
              icon="briefcase"
              title="No companies found"
              message={
                search
                  ? `No company matches “${search}”.`
                  : 'Nothing matches this filter yet.'
              }
            />
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

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  searchInput: {
    ...typography.bodyMd,
    flex: 1,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  filtersRow: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  filterGroupLabel: { ...typography.labelSm, color: colors.textTertiary, alignSelf: 'center' },
  filtersContent: { paddingHorizontal: spacing.md, paddingVertical: 10, gap: spacing.xs },
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
  companyTrial: { ...typography.labelSm, color: colors.warning },
  reviewBtn: { marginTop: spacing.xxs, paddingHorizontal: spacing.xs, paddingVertical: spacing.xxs },
  reviewBtnText: { ...typography.labelSm, color: colors.primary },
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
