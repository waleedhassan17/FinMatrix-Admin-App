import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { THEME } from '../../utils/theme';
import { Alert } from '../../utils/alert';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { ReportContainer, ReportHeader } from '../../components/reports/ReportUI';
import EmptyState from '../../components/shared/EmptyState';
import ApprovalRequestCard from './ApprovalRequestCard';
import {
  cancelApproval,
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

const { colors, radius, spacing, typography } = THEME;

const FILTERS: Array<{ key: ApprovalFilter; label: string }> = [
  { key: 'pending', label: 'Awaiting' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

/**
 * "My requests" — what a staff member has asked the owner to approve.
 *
 * Reads the same /approvals endpoint the owner's inbox does; the server scopes
 * it, returning only this user's requests. Nothing here can approve anything:
 * the only action a requester has over their own request is withdrawing it
 * while it is still pending.
 */
const MyRequestsScreen: React.FC = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const requests = useAppSelector(selectApprovals);
  const filter = useAppSelector(selectApprovalFilter);
  const loading = useAppSelector(selectApprovalsLoading);
  const decidingId = useAppSelector(selectDecidingId);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    (f?: ApprovalFilter) => dispatch(fetchApprovals(f)),
    [dispatch],
  );

  /**
   * See what you actually submitted. Read-only in both directions: this screen
   * cannot approve anything, and the form it opens shows no decision buttons
   * for a role without approvals.decide.
   *
   * My requests sits in the staff More tab and the forms in the Transactions
   * tab, so the hop goes through the parent tab navigator with `initial: false`
   * — otherwise that stack initialises holding only the form and back falls
   * through to the Dashboard.
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

  // Refetch on focus: a request approved by the owner while this screen sat in
  // the background would otherwise still read "awaiting".
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

  const onFilter = (key: ApprovalFilter) => {
    dispatch(setApprovalFilter(key));
    load(key);
  };

  const confirmCancel = (id: string, summary: string) => {
    Alert.alert('Withdraw this request?', summary, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: () => dispatch(cancelApproval(id)),
      },
    ]);
  };

  return (
    <ReportContainer>
      <ReportHeader
        title="My requests"
        subtitle="Things you have asked the owner to approve"
        onBack={() => navigation.goBack()}
      />

      <View style={styles.filterRow}>
        {FILTERS.map(f => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterPill, active && styles.filterPillActive]}
              onPress={() => onFilter(f.key)}
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
              icon="inbox"
              title="Nothing waiting"
              message={
                filter === 'pending'
                  ? 'Anything you send to the owner for approval shows up here.'
                  : 'No requests match this filter.'
              }
            />
          )
        }
        renderItem={({ item }) => (
          <ApprovalRequestCard
            request={item}
            // Only the types with a form to reopen are tappable; the rest must
            // not look it.
            onPress={
              APPROVAL_REVIEW_SCREEN[item.type] ? () => openRequest(item) : undefined
            }
            actions={
              isPendingApproval(item) ? (
                <TouchableOpacity
                  style={styles.withdraw}
                  onPress={() => confirmCancel(item.id, item.summary)}
                  disabled={decidingId === item.id}
                  activeOpacity={0.7}
                >
                  <Feather name="x" size={14} color={colors.textSecondary} />
                  <Text style={styles.withdrawText}>
                    {decidingId === item.id ? 'Withdrawing…' : 'Withdraw'}
                  </Text>
                </TouchableOpacity>
              ) : null
            }
          />
        )}
      />
    </ReportContainer>
  );
};

const styles = StyleSheet.create({
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
  withdraw: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  withdrawText: { ...typography.labelSm, color: colors.textSecondary },
});

export default MyRequestsScreen;
