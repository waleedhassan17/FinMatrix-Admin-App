// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Dashboard
// ═══════════════════════════════════════════════════════
// Answers "what do I need to do?" first, then "where do things stand?".
//
//   1. Awaiting approval — the queue itself, with Approve on each row, so a
//      routine approval is one tap and a confirm. Tapping a company opens it
//      for anything more (reject with a reason, contact the owner).
//   2. Six counts, each opening that slice of the Companies list.
//   3. Who signed up most recently, and who to contact.
//
// It used to open with a greeting banner, four stat cards (one about
// subscriptions), a stats bar counting plans, quick actions to "Manage Plans"
// and a drawer that repeated the tab bar underneath it. While plans are
// switched off none of that describes anything an administrator can act on.

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { THEME } from '../../theme';
import { AdminScreenHeader, DataTableRow } from '../../components/admin/AdminUI';
import { Alert } from '../../utils/alert';
import { companyStatusLabel, isUnsubmitted } from '../../utils/companyStatus';
import { getAllCompaniesAPI } from '../../networks/billing/superAdminNetwork';
import { companyListResponseSerializer } from '../../serializers/superAdminSerializer';
import type { CompanyListItem } from '../../models/superAdminModel';
import {
  loadPlatformStats,
  selectPlatformStats,
  selectStatsError,
  selectStatsStatus,
  updateCompanyStatusLocal,
} from './superAdminSlice';

const { colors, radius, spacing, typography, shadows } = THEME;

/** How many waiting companies the dashboard lists before "View all". */
const QUEUE_PREVIEW = 5;

const fmtDate = (iso: string | null | undefined): string =>
  iso
    ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';

type Queue = {
  items: CompanyListItem[];
  total: number;
  status: 'loading' | 'idle' | 'failed';
  error: string;
};

const SuperAdminDashboardScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const insets = useSafeAreaInsets();
  const stats = useAppSelector(selectPlatformStats);
  const statsStatus = useAppSelector(selectStatsStatus);
  const statsError = useAppSelector(selectStatsError);

  const [queue, setQueue] = useState<Queue>({ items: [], total: 0, status: 'loading', error: '' });
  const [refreshing, setRefreshing] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Its own request rather than the Companies tab's store slice: that slice
  // holds whatever filter and search the reviewer left the list on, and the
  // dashboard must not change them from under the other tab.
  const loadQueue = useCallback(async () => {
    try {
      const res = companyListResponseSerializer(
        await getAllCompaniesAPI(1, QUEUE_PREVIEW, 'pending'),
      );
      setQueue({ items: res.data, total: res.total, status: 'idle', error: '' });
    } catch (e) {
      setQueue(q => ({
        ...q,
        status: 'failed',
        error: e instanceof Error ? e.message : 'Could not load the approval queue.',
      }));
    }
  }, []);

  const load = useCallback(async () => {
    await Promise.all([dispatch(loadPlatformStats()), loadQueue()]);
  }, [dispatch, loadQueue]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const openCompanies = (filter?: string) =>
    navigation.navigate('Companies', {
      screen: 'CompanyList',
      params: filter ? { filter } : undefined,
    });

  const openCompany = (c: { id: string; name: string }) =>
    navigation.navigate('Companies', {
      screen: 'CompanyDetail',
      params: { id: c.id, name: c.name },
    });

  const approve = (c: CompanyListItem) => {
    Alert.alert(
      `Approve ${c.name}?`,
      'The owner can sign in and start using FinMatrix straight away, and we email them to say so.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setApprovingId(c.id);
            try {
              await dispatch(updateCompanyStatusLocal({ id: c.id, status: 'active' })).unwrap();
              await load();
            } catch (e) {
              Alert.alert(
                'Could not approve the company',
                e instanceof Error && e.message
                  ? e.message
                  : 'Please check your connection and try again.',
              );
            } finally {
              setApprovingId(null);
            }
          },
        },
      ],
    );
  };

  const companies = stats?.companies;
  const counts: { label: string; value: number | undefined; filter?: string; tone?: string }[] = [
    { label: 'Companies', value: companies?.total },
    { label: 'Active', value: companies?.active, filter: 'active', tone: colors.success },
    {
      label: 'Awaiting approval',
      value: companies?.pending,
      filter: 'pending',
      tone: companies?.pending ? colors.warning : undefined,
    },
    { label: 'Deactivated', value: companies?.suspended, filter: 'inactive' },
    { label: 'Rejected', value: companies?.rejected, filter: 'rejected' },
    { label: 'New this week', value: companies?.recentWeek },
  ];

  return (
    <SafeAreaView style={S.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <AdminScreenHeader
        title="Dashboard"
        subtitle="Approve companies and see who is active"
        right={
          <TouchableOpacity
            onPress={onRefresh}
            style={S.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Refresh"
          >
            <Feather name="refresh-cw" size={18} color={colors.primary} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={[S.content, { paddingBottom: insets.bottom + spacing.lg }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* 1 ── The queue ─────────────────────────────────────────── */}
        <View style={S.card}>
          <View style={S.cardHead}>
            <View style={S.flex}>
              <Text style={S.cardTitle}>Awaiting approval</Text>
              <Text style={S.cardSub}>
                {queue.status === 'loading'
                  ? 'Loading…'
                  : queue.total > 0
                    ? `${queue.total} ${queue.total === 1 ? 'company is' : 'companies are'} waiting for a decision`
                    : 'Nothing is waiting for a decision'}
              </Text>
            </View>
            {queue.total > QUEUE_PREVIEW && (
              <TouchableOpacity onPress={() => openCompanies('pending')} accessibilityRole="button">
                <Text style={S.link}>View all</Text>
              </TouchableOpacity>
            )}
          </View>

          {queue.status === 'loading' ? (
            <ActivityIndicator color={colors.primary} style={S.loader} />
          ) : queue.status === 'failed' ? (
            <View style={S.inlineState}>
              <Text style={S.errorText}>{queue.error}</Text>
              <TouchableOpacity onPress={loadQueue} accessibilityRole="button">
                <Text style={S.link}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : queue.items.length === 0 ? (
            <View style={S.inlineState}>
              <Feather name="check-circle" size={18} color={colors.success} />
              <Text style={S.muted}>
                All caught up. New registrations appear here the moment they are submitted.
              </Text>
            </View>
          ) : (
            queue.items.map((c, i) => (
              <View key={c.id} style={[S.queueRow, i > 0 && S.divider]}>
                <TouchableOpacity
                  style={S.flex}
                  onPress={() => openCompany(c)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${c.name}`}
                >
                  <View style={S.nameRow}>
                    <Text style={S.queueName} numberOfLines={1}>{c.name}</Text>
                    {isUnsubmitted(c.status) && (
                      <Text style={S.unsubmitted}>Not submitted</Text>
                    )}
                  </View>
                  <Text style={S.queueMeta} numberOfLines={1}>
                    {[c.ownerName, c.ownerEmail ?? c.email].filter(Boolean).join(' · ') || '—'}
                  </Text>
                  <Text style={S.queueDate}>Registered {fmtDate(c.createdAt)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={S.approveBtn}
                  onPress={() => approve(c)}
                  disabled={approvingId === c.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Approve ${c.name}`}
                >
                  {approvingId === c.id ? (
                    <ActivityIndicator size="small" color={colors.neutral0} />
                  ) : (
                    <Text style={S.approveText}>Approve</Text>
                  )}
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* 2 ── Where things stand ────────────────────────────────── */}
        {statsError && !stats ? (
          <View style={S.card}>
            <View style={S.inlineState}>
              <Text style={S.errorText}>{statsError}</Text>
              <TouchableOpacity onPress={() => dispatch(loadPlatformStats())} accessibilityRole="button">
                <Text style={S.link}>Try again</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={S.countGrid}>
            {counts.map(item => (
              <TouchableOpacity
                key={item.label}
                style={S.countCell}
                onPress={() => openCompanies(item.filter)}
                accessibilityRole="button"
                accessibilityLabel={`${item.label}: ${item.value ?? 0}`}
              >
                <Text style={S.countLabel} numberOfLines={1}>{item.label}</Text>
                {statsStatus === 'loading' && !stats ? (
                  <ActivityIndicator size="small" color={colors.primary} style={S.countLoader} />
                ) : (
                  <Text style={[S.countValue, item.tone ? { color: item.tone } : null]}>
                    {(item.value ?? 0).toLocaleString('en-US')}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 3 ── Recent sign-ups ───────────────────────────────────── */}
        {stats && stats.recentRegistrations.length > 0 && (
          <View style={S.card}>
            <View style={S.cardHead}>
              <Text style={[S.cardTitle, S.flex]}>Recent sign-ups</Text>
              <TouchableOpacity onPress={() => openCompanies()} accessibilityRole="button">
                <Text style={S.link}>All companies</Text>
              </TouchableOpacity>
            </View>
            {stats.recentRegistrations.map((r, i) => (
              <DataTableRow
                key={r.id}
                initials={r.name}
                title={r.name}
                meta={
                  [r.ownerName, r.ownerEmail ?? r.email].filter(Boolean).join(' · ') ||
                  (r.industry ?? '—')
                }
                status={r.status}
                statusLabel={companyStatusLabel(r.status)}
                onPress={() => openCompany(r)}
                last={i === stats.recentRegistrations.length - 1}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  flex: { flex: 1, minWidth: 0 },
  iconBtn: { padding: spacing.xxs },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.card,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  cardTitle: { ...typography.labelLg, color: colors.textPrimary },
  cardSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  link: { ...typography.labelMd, color: colors.primary },

  loader: { paddingVertical: spacing.lg },
  inlineState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  muted: { ...typography.bodySm, color: colors.textSecondary, flex: 1 },
  errorText: { ...typography.bodySm, color: colors.danger, flex: 1 },

  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  queueName: { ...typography.labelLg, color: colors.textPrimary, flexShrink: 1 },
  unsubmitted: {
    ...typography.overline,
    color: colors.textSecondary,
    backgroundColor: colors.neutral100,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  queueMeta: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2 },
  queueDate: { ...typography.caption, color: colors.textTertiary, marginTop: 2 },
  approveBtn: {
    minWidth: 84,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveText: { ...typography.labelMd, color: colors.neutral0 },

  countGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  countCell: {
    // Two per row: (100% - one gap) / 2, expressed as a flex basis.
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.card,
  },
  countLabel: { ...typography.caption, color: colors.textSecondary },
  countValue: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: spacing.xxs,
    fontVariant: ['tabular-nums'],
  },
  countLoader: { alignSelf: 'flex-start', marginTop: spacing.xs },
});

export default SuperAdminDashboardScreen;
