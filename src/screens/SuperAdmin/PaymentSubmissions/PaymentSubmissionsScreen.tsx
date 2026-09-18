// ═══════════════════════════════════════════════════════
// FinMatrix — Super-Admin Payment Submission Review (phase2.md)
// Verify manual bank-transfer payments across signup / renewal / upgrade.
// Each row is labelled NEW / RENEWAL / UPGRADE with plan, amount, screenshot,
// and Approve / Reject(reason) actions. Approval activates the plan+account.
//
// FREE TRIAL requests ride the same queue (kind TRIAL). A trial row has NO
// amount and NO screenshot — rendering one as "Rs 0" with a screenshot link
// would be both wrong and alarming — so it shows who asked and how long they
// have waited instead: the owner was promised activation within 24 hours.
// ═══════════════════════════════════════════════════════

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  TextInput,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { Alert } from '../../../utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { HEADER_NAVY } from '../../../components/reports/ReportUI';
import { THEME, statusStyle } from '../../../theme';
import { AdminScreenHeader } from '../../../components/admin/AdminUI';

// Design-system tokens (see src/theme/theme.ts).
const { colors, radius, shadows, spacing, typography } = THEME;
import {
  listPaymentSubmissionsAPI,
  approvePaymentSubmissionAPI,
  rejectPaymentSubmissionAPI,
  downloadSubmissionScreenshot,
  type PaymentSubmissionView,
  type SubmissionStatus,
} from '../../../networks/billing/billingNetwork';
import type { SubmissionKindFilter } from '../../../models/billingModel';
import { TRIAL_REVIEW_WARN_HOURS, waitingLabel } from '../../../utils/trial';

const KIND_COLORS: Record<string, string> = {
  NEW: colors.info,
  RENEWAL: colors.success,
  UPGRADE: colors.secondary,
  TRIAL: colors.warning,
};

type KindKey = 'all' | 'payments' | 'trials';
const KIND_FILTERS: { key: KindKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'payments', label: 'Payments' },
  { key: 'trials', label: 'Trials' },
];
const KIND_PARAM: Record<KindKey, SubmissionKindFilter | undefined> = {
  all: undefined,
  payments: 'PAYMENT',
  trials: 'TRIAL',
};

const isTrial = (s: PaymentSubmissionView | null | undefined) => s?.kind === 'TRIAL';

// RN's Alert is a no-op on react-native-web — fall back to window.alert there
// so errors are never silently swallowed. Confirmations use real <Modal>s.
const notify = (title: string, message?: string) => {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
};

type FilterKey = SubmissionStatus | 'all';
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'submitted', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

const PaymentSubmissionsScreen: React.FC = () => {
  const [filter, setFilter] = useState<FilterKey>('submitted');
  const [kindFilter, setKindFilter] = useState<KindKey>('all');
  const [rows, setRows] = useState<PaymentSubmissionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [shotOpen, setShotOpen] = useState(false);
  const [shotUri, setShotUri] = useState<string | null>(null);
  const [shotLoading, setShotLoading] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<PaymentSubmissionView | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approveTarget, setApproveTarget] = useState<PaymentSubmissionView | null>(null);
  // The irreversible variant of a trial rejection asks twice.
  const [blockConfirm, setBlockConfirm] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await listPaymentSubmissionsAPI(filter === 'all' ? undefined : filter, {
        kind: KIND_PARAM[kindFilter],
        // The trial queue reads oldest-first: whoever has waited longest for
        // their promised 24 hours comes first.
        order: kindFilter === 'trials' ? 'asc' : 'desc',
      });
      setRows(data);
    } catch (e: any) {
      notify('Could not load submissions', e?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, kindFilter]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  const openScreenshot = async (id: string) => {
    setShotOpen(true);
    setShotUri(null);
    setShotLoading(true);
    try {
      setShotUri(await downloadSubmissionScreenshot(id, 'admin'));
    } catch (e: any) {
      setShotOpen(false);
      notify('Screenshot unavailable', e?.message ?? 'Please try again.');
    } finally {
      setShotLoading(false);
    }
  };
  const closeShot = () => {
    setShotOpen(false);
    setShotUri(null);
  };

  const confirmApprove = async () => {
    if (!approveTarget) return;
    const sub = approveTarget;
    setBusyId(sub.id);
    try {
      await approvePaymentSubmissionAPI(sub.id);
      setApproveTarget(null);
      await load();
    } catch (e: any) {
      notify('Approve failed', e?.message ?? 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const closeReject = () => {
    setRejectTarget(null);
    setBlockConfirm(false);
  };

  const submitReject = async (blockFutureTrials = false) => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      setBlockConfirm(false);
      notify('Reason required', 'Please provide a reason for rejection.');
      return;
    }
    setBusyId(rejectTarget.id);
    try {
      await rejectPaymentSubmissionAPI(rejectTarget.id, rejectReason.trim(), blockFutureTrials);
      setRejectTarget(null);
      setRejectReason('');
      setBlockConfirm(false);
      await load();
    } catch (e: any) {
      notify('Reject failed', e?.message ?? 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SafeAreaView style={[S.safe, { backgroundColor: HEADER_NAVY[0] }]} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={HEADER_NAVY[0]} />
      <View style={S.body}>
        <AdminScreenHeader
          title="Payment Verification"
          subtitle="Review manual bank-transfer submissions"
        />

        <View style={[S.filterRow, S.kindRow]}>
          {KIND_FILTERS.map((f) => {
            const active = kindFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[S.filterChip, active && S.filterChipActive]}
                onPress={() => setKindFilter(f.key)}
              >
                <Text style={[S.filterText, active && S.filterTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={S.filterRow}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[S.filterChip, active && S.filterChipActive]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[S.filterText, active && S.filterTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <View style={S.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={S.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  load();
                }}
              />
            }
          >
            {rows.length === 0 ? (
              <View style={S.empty}>
                <Feather name="inbox" size={40} color={colors.textDisabled} />
                <Text style={S.emptyText}>
                  No {filter === 'all' ? '' : filter}{' '}
                  {kindFilter === 'trials' ? 'trial requests' : 'submissions'}
                </Text>
              </View>
            ) : (
              rows.map((sub) => (
                <View key={sub.id} style={S.card}>
                  <View style={S.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={S.company} numberOfLines={1}>
                        {sub.companyName ?? 'Company'}
                      </Text>
                      <Text style={S.companyEmail} numberOfLines={1}>
                        {sub.companyEmail ?? ''}
                      </Text>
                    </View>
                    <View style={[S.kindBadge, { backgroundColor: (KIND_COLORS[sub.kind] ?? colors.textSecondary) + '18' }]}>
                      <Text style={[S.kindText, { color: KIND_COLORS[sub.kind] ?? colors.textSecondary }]}>
                        {sub.kind}
                      </Text>
                    </View>
                  </View>

                  {isTrial(sub) ? (
                    <>
                      <View style={S.metaRow}>
                        <Meta label="Requested" value="Free trial · 30 days" />
                        <Meta label="Status" value={sub.status} />
                      </View>
                      <View style={S.requester}>
                        <RequesterLine icon="user" value={sub.requesterName} />
                        <RequesterLine icon="mail" value={sub.requesterEmail} />
                        <RequesterLine icon="phone" value={sub.requesterPhone} />
                      </View>
                      {sub.status === 'submitted' && typeof sub.ageHours === 'number' ? (
                        <View
                          style={[
                            S.waitPill,
                            sub.ageHours >= TRIAL_REVIEW_WARN_HOURS ? S.waitPillLate : null,
                          ]}
                        >
                          <Feather
                            name="clock"
                            size={13}
                            color={sub.ageHours >= TRIAL_REVIEW_WARN_HOURS ? colors.danger : colors.warning}
                          />
                          <Text
                            style={[
                              S.waitText,
                              sub.ageHours >= TRIAL_REVIEW_WARN_HOURS ? S.waitTextLate : null,
                            ]}
                          >
                            Waiting {waitingLabel(sub.ageHours)}
                            {sub.ageHours >= TRIAL_REVIEW_WARN_HOURS ? ' · promised within 24 h' : ''}
                          </Text>
                        </View>
                      ) : (
                        <Text style={S.date}>{new Date(sub.createdAt).toLocaleString()}</Text>
                      )}
                    </>
                  ) : (
                    <>
                      <View style={S.metaRow}>
                        <Meta label="Plan" value={sub.planLabel} />
                        <Meta label="Amount" value={sub.amountLabel} />
                        <Meta label="Status" value={sub.status} />
                      </View>
                      <Text style={S.date}>{new Date(sub.createdAt).toLocaleString()}</Text>
                    </>
                  )}

                  {!isTrial(sub) && sub.hasScreenshot && (
                    <TouchableOpacity style={S.viewShot} onPress={() => openScreenshot(sub.id)}>
                      <Feather name="image" size={15} color={colors.primary} />
                      <Text style={S.viewShotText}>View transfer screenshot</Text>
                    </TouchableOpacity>
                  )}

                  {sub.status === 'rejected' && sub.rejectionReason && (
                    <Text style={S.rejReason}>Rejected: {sub.rejectionReason}</Text>
                  )}

                  {sub.status === 'submitted' && (
                    <View style={S.actions}>
                      <TouchableOpacity
                        style={[S.btn, S.rejectBtn]}
                        disabled={busyId === sub.id}
                        onPress={() => {
                          setRejectReason('');
                          setRejectTarget(sub);
                        }}
                      >
                        <Text style={S.rejectBtnText}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[S.btn, S.approveBtn]}
                        disabled={busyId === sub.id}
                        onPress={() => setApproveTarget(sub)}
                      >
                        {busyId === sub.id ? (
                          <ActivityIndicator size="small" color={colors.neutral0} />
                        ) : (
                          <Text style={S.approveBtnText}>Approve</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}
            <View style={{ height: 30 }} />
          </ScrollView>
        )}
      </View>

      {/* Screenshot viewer */}
      <Modal visible={shotOpen} transparent animationType="fade" onRequestClose={closeShot}>
        <View style={S.shotBackdrop}>
          <TouchableOpacity style={S.shotClose} onPress={closeShot}>
            <Feather name="x" size={26} color={colors.neutral0} />
          </TouchableOpacity>
          {shotLoading ? (
            <ActivityIndicator size="large" color={colors.neutral0} />
          ) : shotUri ? (
            <Image source={{ uri: shotUri }} style={S.shotImage} resizeMode="contain" />
          ) : null}
        </View>
      </Modal>

      {/* Approve confirmation — a real Modal, NOT Alert.alert (no-op on web) */}
      <Modal
        visible={!!approveTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setApproveTarget(null)}
      >
        <View style={S.modalBackdrop}>
          <View style={S.modalCard}>
            <Text style={S.modalTitle}>
              {isTrial(approveTarget) ? 'Start free trial' : 'Approve payment'}
            </Text>
            <Text style={S.modalSub}>
              {isTrial(approveTarget)
                ? `Start a 30-day free trial for ${approveTarget?.companyName ?? 'this company'}? ` +
                  'They get full access with one delivery rider, starting now. No revenue is recorded.'
                : `Activate the ${approveTarget?.planLabel} plan for ` +
                  `${approveTarget?.companyName ?? 'this company'}? This restores full access and ` +
                  `records ${approveTarget?.amountLabel} in platform revenue.`}
            </Text>
            <View style={S.modalActions}>
              <TouchableOpacity
                style={[S.btn, S.rejectBtn]}
                disabled={busyId === approveTarget?.id}
                onPress={() => setApproveTarget(null)}
              >
                <Text style={S.rejectBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[S.btn, S.approveBtn]}
                disabled={busyId === approveTarget?.id}
                onPress={confirmApprove}
              >
                {busyId === approveTarget?.id ? (
                  <ActivityIndicator size="small" color={colors.neutral0} />
                ) : (
                  <Text style={S.approveBtnText}>Approve</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reject reason */}
      <Modal visible={!!rejectTarget} transparent animationType="fade" onRequestClose={closeReject}>
        <View style={S.modalBackdrop}>
          <View style={S.modalCard}>
            {isTrial(rejectTarget) && blockConfirm ? (
              // Second step for the irreversible variant — a real Modal body,
              // not Alert.alert, which does nothing on web.
              <>
                <Text style={S.modalTitle}>Block future trials?</Text>
                <Text style={S.modalSub}>
                  {rejectTarget?.requesterEmail ?? 'This email'} and{' '}
                  {rejectTarget?.requesterPhone ?? 'this phone number'} will never be able to start a
                  free trial again. This cannot be undone from the app. They can still subscribe to a
                  paid plan.
                </Text>
                <View style={S.modalActions}>
                  <TouchableOpacity
                    style={[S.btn, S.rejectBtn]}
                    disabled={busyId === rejectTarget?.id}
                    onPress={() => setBlockConfirm(false)}
                  >
                    <Text style={S.rejectBtnText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[S.btn, S.approveBtn, { backgroundColor: colors.danger }]}
                    disabled={busyId === rejectTarget?.id}
                    onPress={() => submitReject(true)}
                  >
                    {busyId === rejectTarget?.id ? (
                      <ActivityIndicator size="small" color={colors.neutral0} />
                    ) : (
                      <Text style={S.approveBtnText}>Reject & block</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={S.modalTitle}>
                  {isTrial(rejectTarget) ? 'Reject trial request' : 'Reject payment'}
                </Text>
                <Text style={S.modalSub}>
                  {isTrial(rejectTarget)
                    ? `Tell ${rejectTarget?.companyName ?? 'the company'} why the trial wasn't activated. ` +
                      'They can still subscribe to a paid plan.'
                    : `Tell ${rejectTarget?.companyName ?? 'the company'} why the payment couldn't be verified.`}
                </Text>
                <TextInput
                  style={S.modalInput}
                  placeholder={
                    isTrial(rejectTarget)
                      ? 'e.g. Business details could not be confirmed'
                      : 'e.g. Screenshot unclear / amount mismatch'
                  }
                  placeholderTextColor={THEME.colors.textTertiary}
                  value={rejectReason}
                  onChangeText={setRejectReason}
                  multiline
                />
                <View style={S.modalActions}>
                  <TouchableOpacity style={[S.btn, S.rejectBtn]} onPress={closeReject}>
                    <Text style={S.rejectBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[S.btn, S.approveBtn, { backgroundColor: colors.danger }]}
                    disabled={busyId === rejectTarget?.id}
                    onPress={() => submitReject(false)}
                  >
                    {busyId === rejectTarget?.id ? (
                      <ActivityIndicator size="small" color={colors.neutral0} />
                    ) : (
                      <Text style={S.approveBtnText}>
                        {isTrial(rejectTarget) ? 'Reject' : 'Confirm reject'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
                {isTrial(rejectTarget) && (
                  <TouchableOpacity
                    style={S.blockLink}
                    disabled={busyId === rejectTarget?.id}
                    onPress={() => {
                      if (!rejectReason.trim()) {
                        notify('Reason required', 'Please provide a reason for rejection.');
                        return;
                      }
                      setBlockConfirm(true);
                    }}
                  >
                    <Feather name="slash" size={14} color={colors.danger} />
                    <Text style={S.blockLinkText}>Reject & block future trials</Text>
                  </TouchableOpacity>
                )}
                {isTrial(rejectTarget) && (
                  <Text style={S.modalHint}>
                    Reject frees their email and phone to request again. Block refuses them for good.
                  </Text>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const RequesterLine: React.FC<{ icon: 'user' | 'mail' | 'phone'; value?: string }> = ({
  icon,
  value,
}) => (
  <View style={S.requesterLine}>
    <Feather name={icon} size={13} color={colors.textTertiary} />
    <Text style={S.requesterText} numberOfLines={1}>
      {value || '—'}
    </Text>
  </View>
);

const Meta: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={S.meta}>
    <Text style={S.metaLabel}>{label}</Text>
    <Text style={S.metaValue}>{value}</Text>
  </View>
);

const S = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  filterRow: { flexDirection: 'row', gap: spacing.xs, padding: spacing.sm },
  kindRow: { paddingBottom: 0 },
  filterChip: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.xs, borderRadius: radius.md,
    backgroundColor: colors.neutral0, borderWidth: 1, borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { ...typography.labelSm, color: colors.textSecondary },
  filterTextActive: { color: colors.neutral0 },

  scroll: { paddingHorizontal: spacing.sm, paddingTop: spacing.xxs },
  empty: { alignItems: 'center', paddingTop: 60, gap: spacing.sm },
  emptyText: { ...typography.bodySm, color: colors.textTertiary, textTransform: 'capitalize' },

  card: {
    backgroundColor: colors.neutral0, borderRadius: 14, padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.neutral100,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  company: { ...typography.h4, color: colors.textPrimary },
  companyEmail: { ...typography.labelSm, color: colors.textTertiary, marginTop: 2 },
  kindBadge: { paddingHorizontal: 10, paddingVertical: spacing.xxs, borderRadius: radius.sm },
  kindText: { ...typography.labelSm },

  metaRow: { flexDirection: 'row', marginTop: 14, gap: 10 },
  meta: { flex: 1 },
  metaLabel: { ...typography.overline, color: colors.textTertiary, letterSpacing: 0.5 },
  metaValue: { ...typography.bodySm, color: colors.textPrimary, marginTop: 2, textTransform: 'capitalize' },
  date: { ...typography.overline, color: colors.textTertiary, marginTop: 10 },

  viewShot: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  viewShotText: { ...typography.bodySm, color: colors.primary },
  rejReason: { ...typography.labelSm, color: colors.danger, marginTop: 10 },

  requester: { marginTop: 10, gap: 4 },
  requesterLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  requesterText: { ...typography.bodySm, color: colors.textSecondary, flex: 1 },
  waitPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 10,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm,
    backgroundColor: colors.warningLighter,
  },
  waitPillLate: { backgroundColor: colors.dangerLighter },
  waitText: { ...typography.labelSm, color: colors.warning },
  waitTextLate: { color: colors.danger },

  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: { flex: 1, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  approveBtn: { backgroundColor: colors.success },
  approveBtnText: { color: colors.neutral0,  ...typography.bodySm },
  rejectBtn: { backgroundColor: colors.neutral0, borderWidth: 1, borderColor: colors.border },
  rejectBtnText: { ...typography.labelMd, color: colors.textSecondary },

  shotBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  shotClose: { position: 'absolute', top: 50, right: 20, zIndex: 2, padding: spacing.xs },
  shotImage: { width: '92%', height: '80%' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(9,30,66,0.6)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  modalCard: { width: '100%', backgroundColor: colors.neutral0, borderRadius: radius.xl, padding: spacing.lg },
  modalTitle: { ...typography.h3, color: colors.textPrimary },
  modalSub: { ...typography.bodySm, color: colors.textSecondary, marginTop: 6, lineHeight: 19 },
  modalInput: {
    marginTop: 14, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.sm, minHeight: 80, textAlignVertical: 'top', color: colors.textPrimary,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: spacing.md },
  blockLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: spacing.sm, paddingVertical: spacing.xs,
  },
  blockLinkText: { ...typography.labelMd, color: colors.danger },
  modalHint: { ...typography.labelSm, color: colors.textTertiary, textAlign: 'center', marginTop: 4 },
});

export default PaymentSubmissionsScreen;
