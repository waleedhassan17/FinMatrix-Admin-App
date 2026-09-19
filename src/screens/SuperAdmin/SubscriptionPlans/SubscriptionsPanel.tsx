// ═══════════════════════════════════════════════════════
// FinMatrix — Manual subscriptions (Super Admin)
// ═══════════════════════════════════════════════════════
// GET and POST /super-admin/subscriptions.
//
// The network functions, the thunks and the slice state for this all existed
// already and were unreachable -- nothing in the app ever dispatched
// loadSubscriptions or assignPlan. This is the screen they were written for.
//
// It sits as a tab beside the plan catalogue rather than as a seventh tab:
// "what we sell" and "who we put on what" are the same question asked twice.
//
// The caveat in the banner is load-bearing. This endpoint writes the legacy
// company_subscriptions table, which is DECOUPLED from the
// companies.subscription_plan columns the server actually gates access on.
// Assigning here does not activate anyone.

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Alert } from '../../../utils/alert';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { THEME } from '../../../theme';
import {
  AdminEmptyState,
  AdminErrorState,
  StatusPill,
} from '../../../components/admin/AdminUI';
import {
  loadSubscriptions,
  assignPlan,
  loadCompanies,
  selectSubscriptions,
  selectSubsTotal,
  selectSubsStatus,
  selectSubsError,
  selectCompanies,
  selectActionStatus,
  type SubscriptionPlan,
} from '../superAdminSlice';

const { colors, radius, spacing, typography } = THEME;

const fmtDate = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const SubscriptionsPanel: React.FC<{ plans: SubscriptionPlan[] }> = ({ plans }) => {
  const dispatch = useAppDispatch();

  const subscriptions = useAppSelector(selectSubscriptions);
  const total = useAppSelector(selectSubsTotal);
  const status = useAppSelector(selectSubsStatus);
  const error = useAppSelector(selectSubsError);
  const actionStatus = useAppSelector(selectActionStatus);

  const [refreshing, setRefreshing] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  useEffect(() => {
    dispatch(loadSubscriptions({ page: 1 }));
  }, [dispatch]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await dispatch(loadSubscriptions({ page: 1 }));
    } finally {
      setRefreshing(false);
    }
  }, [dispatch]);

  const isLoading = status === 'loading' && subscriptions.length === 0;

  if (isLoading) {
    return (
      <View style={S.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (status === 'failed' && subscriptions.length === 0) {
    return (
      <AdminErrorState
        title="Could not load subscriptions"
        message={error || 'Please try again.'}
        onRetry={() => dispatch(loadSubscriptions({ page: 1 }))}
      />
    );
  }

  return (
    <View style={S.wrap}>
      <View style={S.notice}>
        <Feather name="alert-triangle" size={16} color={colors.warning} />
        <Text style={S.noticeText}>
          Assigning here records a subscription, but does not by itself activate
          the company or extend its access — those follow the payment flow.
        </Text>
      </View>

      <TouchableOpacity
        style={S.assignBtn}
        onPress={() => setAssignOpen(true)}
        accessibilityRole="button"
      >
        <Feather name="plus" size={16} color={colors.neutral0} />
        <Text style={S.assignBtnText}>Assign a plan</Text>
      </TouchableOpacity>

      <FlatList
        data={subscriptions}
        keyExtractor={item => item.id}
        contentContainerStyle={S.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        renderItem={({ item }) => (
          <View style={S.row}>
            <View style={S.rowInfo}>
              <Text style={S.rowTitle} numberOfLines={1}>
                {item.companyName ?? item.companyId}
              </Text>
              <Text style={S.rowMeta} numberOfLines={1}>
                {item.plan?.name ?? item.planId}
              </Text>
              <Text style={S.rowDates}>
                {fmtDate(item.startDate)} — {fmtDate(item.endDate)}
              </Text>
            </View>
            <StatusPill status={item.status} />
          </View>
        )}
        ListEmptyComponent={
          <AdminEmptyState
            icon="credit-card"
            title="No manual subscriptions"
            message="Nothing has been assigned by hand."
          />
        }
        ListFooterComponent={
          subscriptions.length > 0 ? (
            <Text style={S.footerCount}>
              Showing {subscriptions.length} of {total}
            </Text>
          ) : null
        }
      />

      <AssignSheet
        visible={assignOpen}
        plans={plans}
        busy={actionStatus === 'loading'}
        onClose={() => setAssignOpen(false)}
        onAssign={async input => {
          try {
            await dispatch(assignPlan(input)).unwrap();
            setAssignOpen(false);
            Alert.alert('Assigned', 'The subscription has been recorded.');
          } catch (e) {
            Alert.alert(
              'Could not assign the subscription',
              e instanceof Error && e.message ? e.message : 'Please try again.',
            );
          }
        }}
      />
    </View>
  );
};

// ── Assign sheet ──────────────────────────────────────
const AssignSheet: React.FC<{
  visible: boolean;
  plans: SubscriptionPlan[];
  busy: boolean;
  onClose: () => void;
  onAssign: (input: {
    companyId: string;
    planId: string;
    startDate: string;
    notes?: string;
  }) => Promise<void>;
}> = ({ visible, plans, busy, onClose, onAssign }) => {
  const dispatch = useAppDispatch();
  const companies = useAppSelector(selectCompanies);

  const [companyId, setCompanyId] = useState('');
  const [planId, setPlanId] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!visible) return;
    setCompanyId('');
    setPlanId('');
    setNotes('');
    // There is no company search endpoint, so this is the first page rather
    // than a lookup -- enough for the correction-shaped work this is for.
    if (companies.length === 0) dispatch(loadCompanies({ page: 1 }));
  }, [visible, dispatch, companies.length]);

  const ready = !!companyId && !!planId;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={S.sheetOverlay}>
        <View style={S.sheet}>
          <Text style={S.sheetTitle}>Assign a plan</Text>

          <Text style={S.sheetLabel}>Company</Text>
          <ScrollView style={S.picker} nestedScrollEnabled>
            {companies.map(c => (
              <TouchableOpacity
                key={c.id}
                onPress={() => setCompanyId(c.id)}
                style={[S.pickRow, companyId === c.id && S.pickRowActive]}
              >
                <Text style={S.pickText} numberOfLines={1}>{c.name}</Text>
                {companyId === c.id ? (
                  <Feather name="check" size={16} color={colors.primary} />
                ) : null}
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={S.sheetLabel}>Plan</Text>
          <ScrollView style={S.picker} nestedScrollEnabled>
            {plans.map(p => (
              <TouchableOpacity
                key={p.id}
                onPress={() => setPlanId(p.id)}
                style={[S.pickRow, planId === p.id && S.pickRowActive]}
              >
                <Text style={S.pickText} numberOfLines={1}>{p.name}</Text>
                {planId === p.id ? (
                  <Feather name="check" size={16} color={colors.primary} />
                ) : null}
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Why this was assigned by hand (optional)"
            placeholderTextColor={colors.textTertiary}
            style={S.notesInput}
            multiline
          />

          <View style={S.sheetActions}>
            <TouchableOpacity onPress={onClose} style={S.sheetCancel}>
              <Text style={S.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={!ready || busy}
              style={[S.sheetSave, (!ready || busy) && S.sheetSaveDisabled]}
              onPress={() =>
                onAssign({
                  companyId,
                  planId,
                  startDate: new Date().toISOString(),
                  ...(notes.trim() ? { notes: notes.trim() } : {}),
                })
              }
            >
              {busy ? (
                <ActivityIndicator size="small" color={colors.neutral0} />
              ) : (
                <Text style={S.sheetSaveText}>Assign</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const S = StyleSheet.create({
  wrap: { flex: 1, gap: spacing.sm },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl },

  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warningLighter,
  },
  noticeText: { ...typography.bodySm, color: colors.textSecondary, flex: 1 },

  assignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  assignBtnText: { ...typography.labelMd, color: colors.neutral0 },

  list: { gap: spacing.xs, paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowInfo: { flex: 1, minWidth: 0 },
  rowTitle: { ...typography.labelMd, color: colors.textPrimary },
  rowMeta: { ...typography.bodySm, color: colors.textSecondary },
  rowDates: { ...typography.labelSm, color: colors.textTertiary },
  footerCount: {
    ...typography.labelSm,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },

  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  sheetTitle: { ...typography.h3, color: colors.textPrimary },
  sheetLabel: { ...typography.labelMd, color: colors.textPrimary, marginTop: spacing.xs },
  picker: {
    maxHeight: 132,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pickRowActive: { backgroundColor: colors.neutral100 },
  pickText: { ...typography.bodySm, color: colors.textPrimary, flex: 1 },
  notesInput: {
    ...typography.bodySm,
    color: colors.textPrimary,
    minHeight: 56,
    padding: spacing.sm,
    marginTop: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    textAlignVertical: 'top',
  },
  sheetActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  sheetCancel: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm },
  sheetCancelText: { ...typography.labelMd, color: colors.textSecondary },
  sheetSave: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  sheetSaveDisabled: { opacity: 0.5 },
  sheetSaveText: { ...typography.labelMd, color: colors.neutral0 },
});

export default SubscriptionsPanel;
