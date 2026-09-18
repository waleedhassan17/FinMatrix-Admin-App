import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { THEME } from '../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { ReportContainer, ReportHeader } from '../../components/reports/ReportUI';
import EmptyState from '../../components/shared/EmptyState';
import ApprovalRequestCard from './ApprovalRequestCard';
import RejectReasonModal from './RejectReasonModal';
import {
  decideApproval,
  fetchApprovals,
  selectApprovalFilter,
  selectApprovals,
  selectApprovalsLoading,
  selectDecidingId,
  setApprovalFilter,
} from './approvalsSlice';
import type { ApprovalFilter } from '../../networks/approvals/approvalsNetwork';
import {
  APPROVAL_REVIEW_SCREEN,
  isPendingApproval,
  type ApprovalRequest,
} from '../../models/approvalModel';
import type { MoreStackParamList } from '../../navigators/stacks/MoreStack';

const { colors, radius, spacing, typography } = THEME;

type Nav = NativeStackNavigationProp<MoreStackParamList>;
type Tab = 'requests' | 'deliveries';

const FILTERS: Array<{ key: ApprovalFilter; label: string }> = [
  { key: 'pending', label: 'Awaiting you' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

/**
 * The owner's approvals inbox.
 *
 * Two tabs, because staff raise two different kinds of thing:
 *   Staff requests — the eight gated actions, decided here.
 *   Deliveries     — rider completions, which STAFF can also sign off, so that
 *                    screen is shared and lives in both navigators.
 *
 * Approving is the only place a pending request turns into real accounting, so
 * every row states what approving will do before the owner taps it.
 */
const StaffApprovalsScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<Nav>();
  const requests = useAppSelector(selectApprovals);
  const filter = useAppSelector(selectApprovalFilter);
  const loading = useAppSelector(selectApprovalsLoading);
  const decidingId = useAppSelector(selectDecidingId);

  const [tab, setTab] = useState<Tab>('requests');
  const [refreshing, setRefreshing] = useState(false);
  const [rejecting, setRejecting] = useState<ApprovalRequest | null>(null);

  const load = useCallback(
    (f?: ApprovalFilter) => dispatch(fetchApprovals(f)),
    [dispatch],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  /**
   * Open the request in the form it was filed from, so the decision is made on
   * the vendor, the dates and the line items rather than on the summary line.
   *
   * This screen sits in the owner's More tab and the forms live in the
   * Transactions tab, so the hop goes through the parent tab navigator.
   * `initial: false` puts TransactionsHub underneath — without it that stack
   * initialises holding only the form, and back falls through to the Dashboard.
   */
  const openRequest = useCallback(
    (request: ApprovalRequest) => {
      const tabs = (navigation.getParent() ?? navigation) as unknown as {
        navigate: (name: string, params?: Record<string, unknown>) => void;
      };
      tabs.navigate('TransactionsStack', {
        screen: APPROVAL_REVIEW_SCREEN[request.type]!,
        params: { fromApprovalRequestId: request.id },
        initial: false,
      });
    },
    [navigation],
  );

  const submitRejection = (comment: string) => {
    if (!rejecting) return;
    dispatch(
      decideApproval({
        id: rejecting.id,
        decision: 'reject',
        comment: comment.trim(),
      }),
    );
    setRejecting(null);
  };

  return (
    <ReportContainer>
      <ReportHeader
        title="Staff approvals"
        subtitle="Requests waiting on your decision"
        onBack={() => navigation.goBack()}
      />

      <View style={styles.tabRow}>
        {(
          [
            { key: 'requests' as Tab, label: 'Staff requests' },
            { key: 'deliveries' as Tab, label: 'Deliveries' },
          ]
        ).map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'deliveries' ? (
        // The delivery approvals screen is shared with staff, so rather than
        // duplicating it here the tab hands off to it.
        <View style={styles.handoff}>
          <EmptyState
            icon="truck"
            title="Delivery completions"
            message="Rider completions are reviewed on the delivery approvals screen. Staff can sign these off too."
            actionLabel="Open delivery approvals"
            onAction={() => navigation.navigate('InventoryApproval')}
          />
        </View>
      ) : (
        <>
          <View style={styles.filterRow}>
            {FILTERS.map(f => {
              const active = filter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.filterPill, active && styles.filterPillActive]}
                  onPress={() => {
                    dispatch(setApprovalFilter(f.key));
                    load(f.key);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <FlatList
            data={requests}
            keyExtractor={r => r.id}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={
              loading ? null : (
                <EmptyState
                  icon="check-circle"
                  title="Nothing to review"
                  message="When your staff send something for approval, it appears here."
                />
              )
            }
            renderItem={({ item }) => (
              <ApprovalRequestCard
                request={item}
                // Only the types with a form to open are tappable. Passing
                // onPress unconditionally would make every card look tappable
                // and do nothing.
                onPress={
                  APPROVAL_REVIEW_SCREEN[item.type] ? () => openRequest(item) : undefined
                }
                actions={
                  isPendingApproval(item) ? (
                    <>
                      <TouchableOpacity
                        style={[styles.action, styles.approve]}
                        disabled={decidingId === item.id}
                        onPress={() =>
                          dispatch(
                            decideApproval({ id: item.id, decision: 'approve' }),
                          )
                        }
                        activeOpacity={0.8}
                      >
                        <Feather name="check" size={14} color={colors.neutral0} />
                        <Text style={styles.approveText}>
                          {decidingId === item.id ? 'Approving…' : 'Approve'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.action, styles.reject]}
                        disabled={decidingId === item.id}
                        onPress={() => setRejecting(item)}
                        activeOpacity={0.8}
                      >
                        <Feather name="x" size={14} color={colors.danger} />
                        <Text style={styles.rejectText}>Reject</Text>
                      </TouchableOpacity>
                    </>
                  ) : null
                }
              />
            )}
          />
        </>
      )}

      {/* A rejection must say why: the requester is told, and it is the only
          thing they have to go on when deciding what to do instead. */}
      <RejectReasonModal
        visible={!!rejecting}
        summary={rejecting?.summary}
        onCancel={() => setRejecting(null)}
        onSubmit={submitRejection}
      />
    </ReportContainer>
  );
};

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.neutral100,
  },
  tabActive: { backgroundColor: colors.actionGreenLighter },
  tabText: { ...typography.labelMd, color: colors.textSecondary },
  tabTextActive: { color: colors.actionGreen },
  handoff: { flex: 1, backgroundColor: colors.background },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  filterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.neutral100,
  },
  filterPillActive: { backgroundColor: colors.actionGreenLighter },
  filterText: { ...typography.labelSm, color: colors.textSecondary },
  filterTextActive: { color: colors.actionGreen },
  list: {
    padding: spacing.md,
    paddingTop: 0,
    backgroundColor: colors.background,
    flexGrow: 1,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  approve: { backgroundColor: colors.actionGreen },
  approveText: { ...typography.labelSm, color: colors.neutral0 },
  reject: { borderWidth: 1, borderColor: colors.danger },
  rejectText: { ...typography.labelSm, color: colors.danger },
});

export default StaffApprovalsScreen;
