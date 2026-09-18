// ═══════════════════════════════════════════════════════
// FinMatrix — Super Admin Dashboard (MetroMatrix-inspired)
// ═══════════════════════════════════════════════════════

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Animated,
  Dimensions,
  Modal,
  Platform,
  StatusBar,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { selectUser } from '../Auth/authSlice';
import { useSignOut } from '../../hooks/useSignOut';
import { THEME } from '../../theme';
import { AdminScreenHeader, KpiStatCard, DataTableRow } from '../../components/admin/AdminUI';

// Design-system tokens (see src/theme/theme.ts).
const { colors, radius, shadows, spacing, typography } = THEME;
import {
  loadPlatformStats,
  selectPlatformStats,
  selectStatsStatus,
  selectStatsError,
} from './superAdminSlice';

const { width: SCREEN_W } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_W * 0.78;
const STATUS_H = Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0;

// ── Sidebar Drawer ────────────────────────────────────
const SidebarDrawer: React.FC<{
  visible: boolean;
  onClose: () => void;
  navigation: NativeStackNavigationProp<any>;
  userName: string;
  onSignOut: () => void;
}> = ({ visible, onClose, navigation, userName, onSignOut }) => {
  const slideX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideX, {
        toValue: visible ? 0 : -DRAWER_WIDTH,
        tension: 70,
        friction: 12,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: visible ? 1 : 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible]);

  const menuItems = [
    { icon: 'grid', label: 'Dashboard', screen: 'Dashboard' },
    { icon: 'briefcase', label: 'Companies', screen: 'Companies' },
    { icon: 'bar-chart-2', label: 'Revenue Analytics', screen: 'Analytics' },
    { icon: 'credit-card', label: 'Subscription Plans', screen: 'Plans' },
    { icon: 'settings', label: 'Settings', screen: 'Settings' },
  ];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={S.drawerOverlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[S.drawerBackdrop, { opacity: backdropOpacity }]} />
        </TouchableWithoutFeedback>
        <Animated.View
          style={[S.drawer, { transform: [{ translateX: slideX }], paddingTop: STATUS_H + 16 }]}
        >
          <LinearGradient colors={[colors.primary, colors.primaryDark]} style={S.drawerHeader}>
            <View style={S.drawerAvatar}>
              <Text style={S.drawerAvatarText}>
                {userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <Text style={S.drawerName}>{userName}</Text>
            <Text style={S.drawerRole}>Super Admin</Text>
          </LinearGradient>

          <View style={S.drawerMenu}>
            {menuItems.map(item => (
              <TouchableOpacity
                key={item.screen}
                style={S.drawerItem}
                onPress={() => {
                  onClose();
                  setTimeout(() => navigation.navigate(item.screen as any), 150);
                }}
                activeOpacity={0.7}
              >
                <View style={S.drawerItemIcon}>
                  <Feather name={item.icon as any} size={18} color={colors.primary} />
                </View>
                <Text style={S.drawerItemText}>{item.label}</Text>
                <Feather name="chevron-right" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={S.drawerSignOut} onPress={onSignOut} activeOpacity={0.8}>
            <Feather name="log-out" size={18} color={colors.danger} />
            <Text style={S.drawerSignOutText}>Sign Out</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════
const SuperAdminDashboardScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const insets = useSafeAreaInsets();
  const user = useAppSelector(selectUser);
  const stats = useAppSelector(selectPlatformStats);
  const statsStatus = useAppSelector(selectStatsStatus);
  const statsError = useAppSelector(selectStatsError);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    dispatch(loadPlatformStats());
  }, [dispatch]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await dispatch(loadPlatformStats());
    setRefreshing(false);
  }, [dispatch]);

  // Full sign-out (confirm → revoke server-side → clear tokens → reset store);
  // a raw dispatch(signOut()) here left the AsyncStorage tokens behind, so a
  // cold start silently signed the super admin back in.
  const { confirmSignOut } = useSignOut();
  const onSignOut = useCallback(() => {
    setDrawerOpen(false);
    // Let the drawer close before the confirm alert appears.
    setTimeout(confirmSignOut, 150);
  }, [confirmSignOut]);

  const isLoading = statsStatus === 'loading' && !stats;
  const displayName = user?.displayName ?? 'Super Admin';

  return (
    <SafeAreaView style={S.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <AdminScreenHeader
        title="FinMatrix Admin"
        subtitle="Platform Control Panel"
        left={
          <TouchableOpacity onPress={() => setDrawerOpen(true)} style={S.menuBtn} activeOpacity={0.7}>
            <Feather name="menu" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        }
        right={
          <LinearGradient colors={[colors.primary, colors.primaryDark]} style={S.avatarGrad}>
            <Text style={S.avatarText}>
              {displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
            </Text>
          </LinearGradient>
        }
      />

      <ScrollView
        contentContainerStyle={[S.content, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Welcome Banner */}
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={S.welcomeBanner}
        >
          <View style={S.welcomeDecor} />
          <Text style={S.welcomeGreet}>
            {`Good ${new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'},`}
          </Text>
          <Text style={S.welcomeName}>{displayName}</Text>
          <Text style={S.welcomeSub}>
            {stats
              ? `${stats.companies.pending} companies awaiting review`
              : 'Loading platform data...'}
          </Text>
        </LinearGradient>

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={S.loader} />
        ) : statsError ? (
          <View style={S.errorBox}>
            <Feather name="alert-circle" size={20} color={colors.danger} />
            <Text style={S.errorText}>{statsError}</Text>
            <TouchableOpacity onPress={load} style={S.retryBtn}>
              <Text style={S.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : stats ? (
          <>
            {/* Stats Grid */}
            <Text style={S.sectionTitle}>Platform Overview</Text>
            <View style={S.statsGrid}>
              <KpiStatCard
                label="Total Companies"
                value={stats.companies.total}
                icon="briefcase"
                delay={0}
              />
              <KpiStatCard
                label="Pending Review"
                value={stats.companies.pending}
                subtitle="Awaiting approval"
                icon="clock"
                delay={80}
              />
              <KpiStatCard
                label="Active Companies"
                value={stats.companies.active}
                icon="check-circle"
                delay={160}
              />
              <KpiStatCard
                label="Active Subs"
                value={stats.subscriptions.activeSubscriptions}
                subtitle={`of ${stats.subscriptions.totalSubscriptions} total`}
                icon="credit-card"
                delay={240}
              />
            </View>

            {/* Quick Stats Bar */}
            <View style={S.quickStatsBar}>
              <View style={S.quickStatItem}>
                <Text style={[S.quickStatVal, { color: colors.textPrimary }]}>
                  {stats.companies.suspended}
                </Text>
                <Text style={S.quickStatLabel}>Suspended</Text>
              </View>
              <View style={S.qsDivider} />
              <View style={S.quickStatItem}>
                <Text style={[S.quickStatVal, { color: colors.textPrimary }]}>
                  {stats.companies.rejected}
                </Text>
                <Text style={S.quickStatLabel}>Rejected</Text>
              </View>
              <View style={S.qsDivider} />
              <View style={S.quickStatItem}>
                <Text style={[S.quickStatVal, { color: colors.textPrimary }]}>
                  {stats.subscriptions.totalPlans}
                </Text>
                <Text style={S.quickStatLabel}>Plans</Text>
              </View>
              <View style={S.qsDivider} />
              <View style={S.quickStatItem}>
                <Text style={[S.quickStatVal, { color: colors.textPrimary }]}>
                  {stats.companies.recentWeek}
                </Text>
                <Text style={S.quickStatLabel}>This Week</Text>
              </View>
            </View>

            {/* Quick Actions */}
            <Text style={S.sectionTitle}>Quick Actions</Text>
            <View style={S.actionsRow}>
              <TouchableOpacity
                style={S.actionCard}
                onPress={() => navigation.navigate('Companies' as any)}
                activeOpacity={0.75}
              >
                <View style={S.actionSurface}>
                  <View style={S.actionIconWrap}>
                    <Feather name="clock" size={18} color={colors.primary} />
                  </View>
                  <Text style={S.actionLabel}>Review{' '}Companies</Text>
                  {stats.companies.pending > 0 && (
                    <View style={S.actionBadge}>
                      <Text style={S.actionBadgeText}>{stats.companies.pending}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={S.actionCard}
                onPress={() => navigation.navigate('Companies' as any)}
                activeOpacity={0.75}
              >
                <View style={S.actionSurface}>
                  <View style={S.actionIconWrap}>
                    <Feather name="briefcase" size={18} color={colors.primary} />
                  </View>
                  <Text style={S.actionLabel}>All Companies</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={S.actionCard}
                onPress={() => navigation.navigate('Plans' as any)}
                activeOpacity={0.75}
              >
                <View style={S.actionSurface}>
                  <View style={S.actionIconWrap}>
                    <Feather name="credit-card" size={18} color={colors.primary} />
                  </View>
                  <Text style={S.actionLabel}>Manage Plans</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Recent Registrations */}
            {stats.recentRegistrations.length > 0 && (
              <>
                <View style={S.sectionHeader}>
                  <Text style={S.sectionTitle}>Recent Registrations</Text>
                  <TouchableOpacity onPress={() => navigation.navigate('Companies' as any)}>
                    <Text style={S.seeAllText}>See All →</Text>
                  </TouchableOpacity>
                </View>
                <View style={S.card}>
                  {stats.recentRegistrations.map((item, idx) => (
                    <DataTableRow
                      key={item.id}
                      initials={item.name}
                      title={item.name}
                      meta={item.industry ?? 'General'}
                      status={item.status}
                      onPress={() =>
                        navigation.navigate('Companies' as any)
                      }
                      />
                  ))}
                </View>
              </>
            )}
          </>
        ) : null}
      </ScrollView>

      {/* Sidebar */}
      <SidebarDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        navigation={navigation}
        userName={displayName}
        onSignOut={onSignOut}
      />
    </SafeAreaView>
  );
};

// ─── Styles ──────────────────────────────────────────

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  menuBtn: { padding: spacing.xxs },
  avatarGrad: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { ...typography.labelMd, color: colors.neutral0 },

  content: { padding: spacing.md, gap: 14 },
  loader: { marginTop: spacing.xxxl },

  errorBox: {
    alignItems: 'center', gap: spacing.xs, padding: spacing.lg,
    backgroundColor: colors.surface, borderRadius: radius.lg,
  },
  errorText: { ...typography.bodySm, color: colors.danger, textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.xs,
    backgroundColor: colors.primary, borderRadius: radius.sm,
  },
  retryText: { ...typography.labelMd, color: colors.neutral0 },

  welcomeBanner: {
    borderRadius: radius.xl, padding: spacing.lg, overflow: 'hidden', position: 'relative',
  },
  welcomeDecor: {
    position: 'absolute', right: -30, top: -30,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  welcomeGreet: { ...typography.bodySm, color: 'rgba(255,255,255,0.8)' },
  welcomeName: { ...typography.h2, color: colors.neutral0, marginTop: 2 },
  welcomeSub: {
    ...typography.labelSm, color: 'rgba(255,255,255,0.75)', marginTop: 6,
  },

  sectionTitle: { ...typography.labelLg, color: colors.textPrimary },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  seeAllText: { ...typography.labelMd, color: colors.primary },

  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },

  quickStatsBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickStatItem: { flex: 1, alignItems: 'center', gap: 3 },
  quickStatVal: { ...typography.h3, fontVariant: ['tabular-nums'] },
  quickStatLabel: { ...typography.overline, color: colors.textSecondary },
  qsDivider: { width: 1, backgroundColor: colors.border, marginVertical: spacing.xxs },

  actionsRow: { flexDirection: 'row', gap: 10 },
  actionCard: { flex: 1, borderRadius: radius.lg, overflow: 'hidden' },
  actionSurface: {
    backgroundColor: colors.surface,
    padding: 14, minHeight: 90,
    alignItems: 'flex-start', gap: spacing.xs, position: 'relative',
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
  },
  actionIconWrap: {
    width: 32, height: 32, borderRadius: radius.sm,
    backgroundColor: colors.primaryLighter,
    alignItems: 'center', justifyContent: 'center',
  },
  actionLabel: { ...typography.labelSm, color: colors.textPrimary, lineHeight: 16 },
  actionBadge: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: colors.primary, borderRadius: radius.md,
    minWidth: 20, height: 20,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5,
  },
  actionBadgeText: { ...typography.overline, color: colors.neutral0 },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },

  // Drawer
  drawerOverlay: { flex: 1, flexDirection: 'row' },
  drawerBackdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  drawer: {
    width: DRAWER_WIDTH,
    backgroundColor: colors.surface,
    shadowColor: colors.neutral900,
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 16,
  },
  drawerHeader: {
    padding: spacing.lg, paddingBottom: spacing.xl, alignItems: 'center', gap: 6,
  },
  drawerAvatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.xxs,
  },
  drawerAvatarText: { ...typography.h2, color: colors.neutral0 },
  drawerName: { ...typography.h4, color: colors.neutral0 },
  drawerRole: { ...typography.caption, color: 'rgba(255,255,255,0.75)' },
  drawerMenu: { flex: 1, paddingTop: spacing.sm },
  drawerItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: 14, gap: 14,
  },
  drawerItemIcon: {
    width: 38, height: 38, borderRadius: radius.md,
    backgroundColor: colors.primaryLighter,
    alignItems: 'center', justifyContent: 'center',
  },
  drawerItemText: { flex: 1, ...typography.h5, color: colors.textPrimary },
  drawerSignOut: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.lg, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border,
  },
  drawerSignOutText: { ...typography.h5, color: colors.danger },
});

export default SuperAdminDashboardScreen;
