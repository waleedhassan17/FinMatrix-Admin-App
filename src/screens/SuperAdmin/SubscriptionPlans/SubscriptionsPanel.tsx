// ═══════════════════════════════════════════════════════
// FinMatrix — Manual subscriptions (Super Admin)
// ═══════════════════════════════════════════════════════
// GET and POST /super-admin/subscriptions.
//
// READ-ONLY, and that is not a simplification -- assignment cannot currently
// be done correctly. There are two disjoint plan universes on the server:
//
//   plan-config.ts      the tiers, priced in PKR, ids like
//                       'warehouse_starter_6mo'. What the catalogue lists,
//                       what a customer is charged, what the limits come from.
//
//   subscription_plans  a UUID-keyed table seeded with Free / Starter /
//                       Professional / Enterprise at $0 / $29 / $290 -- an
//                       earlier design, wrong currency, read by nothing
//                       customer-facing.
//
// POST /super-admin/subscriptions resolves planId against the TABLE. A
// catalogue id fails outright; a table id assigns a company to a dollar plan
// FinMatrix does not sell. And the row it writes is decoupled from
// companies.subscription_plan, which is what actually gates access.
//
// The list is real -- those rows exist -- so it stays.

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { THEME } from '../../../theme';
import {
  AdminEmptyState,
  AdminErrorState,
  StatusPill,
} from '../../../components/admin/AdminUI';
import {
  loadSubscriptions,
  selectSubscriptions,
  selectSubsTotal,
  selectSubsStatus,
  selectSubsError,
} from '../superAdminSlice';

const { colors, radius, spacing, typography } = THEME;

const fmtDate = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const SubscriptionsPanel: React.FC = () => {
  const dispatch = useAppDispatch();

  const subscriptions = useAppSelector(selectSubscriptions);
  const total = useAppSelector(selectSubsTotal);
  const status = useAppSelector(selectSubsStatus);
  const error = useAppSelector(selectSubsError);

  const [refreshing, setRefreshing] = useState(false);

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
          Read-only. These record what was assigned historically, but point at
          a different plan table from the catalogue and from what billing
          charges. A company's real plan is on its company record.
        </Text>
      </View>

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

    </View>
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
