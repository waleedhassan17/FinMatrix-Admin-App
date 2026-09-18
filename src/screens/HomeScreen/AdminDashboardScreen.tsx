// ═══════════════════════════════════════════════════════
// FinMatrix — Company Admin Dashboard Screen v5
// Accounting-grade UI · clean surfaces · ink figures
// Benchmarked against QuickBooks / Sage 50 dashboards
// ═══════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StatusBar,
  Animated,
  Easing
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAppSelector, useAppDispatch } from '../../hooks/useReduxHooks';
import { selectUser, selectFeatures } from '../Auth/authSlice';
import { selectActiveCompany, loadCompany } from '../Auth/companySlice';
import { getCompanyAPI, updateCompanyAPI } from '../../networks/auth/authNetwork';
import {
  selectDashboardStats,
  selectRecentTransactions,
  selectDeliveryOverview,
  selectDashboardAlerts,
  selectIsRefreshing,
  selectDashboardStatus,
  selectRawDashboardData,
  selectDashboardSetup,
  selectRevenueTrend,
  refreshDashboard,
  loadDashboard
} from './adminDashboardSlice';
import SetupChecklist, { SETUP_STEPS, type SetupStep } from './SetupChecklist';
import type { DashboardStackParamList } from '../../navigators/stacks/DashboardStack';
import type {
  DashboardStat,
  RecentTransaction,
  DashboardAlert,
  DeliveryOverviewData
} from '../../models/dashboardModel';
import { isFeatureVisible } from '../../utils/featureGates';
import { ReportContainer } from '../../components/reports/ReportUI';
import { C, FONT, TINT, card } from './dashboardTheme';
import RevenueTrendCard, { WINDOW_MONTHS } from './RevenueTrendCard';
import { THEME, HEADER_RADIUS } from '../../theme';

// Design-system tokens (see src/theme/theme.ts).
const { colors } = THEME;

type Nav = NativeStackNavigationProp<DashboardStackParamList>;

/** How many recent transactions the dashboard shows. The rest are behind
 *  "View all", which is the whole point of that action. */
const RECENT_TX_LIMIT = 4;

const todayLabel = (): string =>
  new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

// 'YYYY-MM-DD' → 'as of Aug 15'. Parsed field by field on purpose: `new
// Date('2026-08-15')` is read as UTC midnight and slips a day behind in
// western time zones.
const asOfLabel = (iso?: string): string | undefined => {
  if (!iso) return undefined;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return `as of ${new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
};

// ── Skeleton pulse ────────────────────────────────────
// Per-instance animated value (a module-level singleton would let one
// unmounting skeleton stop the pulse for every other one).
const usePulse = () => {
  // Lazy state initialiser rather than a ref: it allocates the value once
  // (a ref re-runs `new Animated.Value()` on every render just to throw it
  // away) and keeps render free of ref reads.
  const [v] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 760, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.5, duration: 760, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return v;
};

// ═════════════════════════════════════════════════════
// SCREEN
// ═════════════════════════════════════════════════════
const AdminDashboardScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<Nav>();

  const user = useAppSelector(selectUser);
  const company = useAppSelector(selectActiveCompany);
  const stats = useAppSelector(selectDashboardStats);
  const transactions = useAppSelector(selectRecentTransactions);
  const delivery = useAppSelector(selectDeliveryOverview);
  // Three-tier model: the SAME dashboard adapts per type — small business /
  // large org see the financial cards only; warehouse sees everything; legacy
  // (no flags, no type) = all on. Warehouse operations are hard-gated by
  // company type on top of the flags (see featureGates.ts).
  const features = useAppSelector(selectFeatures);
  const showDelivery = isFeatureVisible('delivery', features, user?.companyType);
  const showInventory = isFeatureVisible('inventory', features, user?.companyType);
  const alerts = useAppSelector(selectDashboardAlerts);
  const isRefreshing = useAppSelector(selectIsRefreshing);
  const status = useAppSelector(selectDashboardStatus);
  const rawData = useAppSelector(selectRawDashboardData);
  const setup = useAppSelector(selectDashboardSetup);
  const revenueTrend = useAppSelector(selectRevenueTrend);

  // Dismiss/finish the first-run checklist (FinMatrixGuide §5.7). Marks the
  // company setupCompleted; the checklist then hides but every flow it links to
  // stays reachable from its section.
  // Read the id out first: closing over `company` itself would widen the
  // dependency to the whole object and defeat the memo.
  const companyId = company?.companyId;
  const dismissSetup = useCallback(async () => {
    if (companyId) {
      try {
        await updateCompanyAPI(companyId, { setupCompleted: true });
      } catch {
        /* non-blocking — still refresh to reflect any server state */
      }
    }
    dispatch(refreshDashboard());
  }, [companyId, dispatch]);

  // Only offer steps whose screen this tier actually registers — the
  // small-business and large-org navigators ship no InventoryStack.
  const setupSteps = useMemo(
    () => SETUP_STEPS.filter(s => isFeatureVisible(s.feature, features, user?.companyType)),
    [features, user?.companyType],
  );

  // Push within DashboardStack, where every checklist destination is also
  // registered. Two bugs came from not doing this: dispatching the bare screen
  // name when it lived only in a sibling tab stack was silently dropped
  // ("not handled by any navigator"), and routing into that sibling stack
  // instead landed the form on top of the other tab's history, so back went to
  // Chart of Accounts rather than the dashboard.
  const goToSetupStep = useCallback(
    (step: SetupStep) => {
      navigation.navigate(step.screen);
    },
    [navigation],
  );

  useEffect(() => {
    dispatch(loadDashboard());
  }, [dispatch]);

  // Refetch whenever the dashboard regains focus.
  //
  // DashboardStack keeps this screen mounted, so the mount effect above fires
  // exactly once per session. Anything completed from the setup checklist —
  // opening balances, a customer, a vendor, a tax rate — used to leave the
  // card showing stale progress until a manual pull-to-refresh or an app
  // reload, because goBack() re-reveals the mounted screen without remounting
  // it. refreshDashboard rather than loadDashboard so returning does not flash
  // the skeleton over content that is already on screen.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      dispatch(refreshDashboard());
    }, [dispatch]),
  );

  useEffect(() => {
    if (!company && user?.companyId) {
      getCompanyAPI(user.companyId)
        .then(api => {
          if (api?.id) {
            dispatch(
              loadCompany({
                companyId: api.id,
                name: api.name ?? 'My Company',
                industry: api.industry ?? '',
                address: typeof api.address === 'string' ? api.address : api.address?.street ?? '',
                city: api.address?.city ?? '',
                state: api.address?.state ?? '',
                zipCode: api.address?.postalCode ?? '',
                country: api.address?.country ?? '',
                phone: api.phone ?? '',
                email: api.email ?? '',
                website: api.website ?? '',
                taxId: api.taxId ?? '',
                logo: api.logo ?? null,
                inviteCode: api.inviteCode ?? '',
                agencies: [],
                members: [],
                deliveryPersonnel: [],
                createdAt: api.createdAt ?? new Date().toISOString(),
              }),
            );
          }
        })
        .catch(() => {});
    }
  }, [user?.companyId, company, dispatch]);

  const onRefresh = useCallback(() => {
    dispatch(refreshDashboard());
  }, [dispatch]);

  const isInitialLoading = status === 'loading' && stats.length === 0;
  const companyLabel = company?.name ?? 'FinMatrix';

  // formatted stat lookup by id (formatting stays in the slice)
  const statById = useMemo(
    () => Object.fromEntries(stats.map(st => [st.id, st])) as Record<string, DashboardStat | undefined>,
    [stats],
  );

  const completedPct =
    delivery.total > 0 ? Math.round((delivery.delivered / delivery.total) * 100) : 0;

  // The header pill used to read "Books up to date" unconditionally — a green
  // claim about the books that was rendered even with a red alert banner
  // directly beneath it saying otherwise. It now reports what the dashboard
  // already knows. Same selector the banners use, so the two cannot disagree.
  const openAlerts = alerts.length;
  const booksClear = openAlerts === 0;

  // Four, not the eight the slice holds. This was the longest block on the
  // dashboard and pushed Revenue and everything under it off-screen. Capped
  // here rather than in the serializer: how much of the feed the dashboard
  // chooses to show is a presentation decision, and the data stays whole for
  // anything else reading it. It also gives "View all" something to be for.
  const recentTransactions = useMemo(
    () => transactions.slice(0, RECENT_TX_LIMIT),
    [transactions],
  );

  // A row links to its own document. `kind` comes from the API through the
  // serializer; anything this build cannot open returns undefined and the row
  // renders inert rather than routing on a guess.
  //
  // Opened on THIS stack, not by jumping into TransactionsStack. Jumping left
  // the document on the Transactions tab, so tapping that tab afterwards
  // reopened it instead of showing the hub — the same thing the Revenue link
  // was doing to the Reports tab.
  const openTransaction = useCallback(
    (tx: RecentTransaction) => {
      if (tx.kind === 'invoice') {
        return () => navigation.navigate('InvoiceDetail', { invoiceId: tx.id });
      }
      if (tx.kind === 'bill') {
        return () => navigation.navigate('BillDetail', { billId: tx.id });
      }
      return undefined;
    },
    [navigation],
  );

  return (
    <ReportContainer>
      <StatusBar barStyle="light-content" backgroundColor={C.navy[0]} />

      {/* ── Header ───────────────────────────────────── */}
      <LinearGradient colors={C.navy} style={s.header}>

        <View style={s.headerTopRow}>
          <View style={s.headerLeft}>
            <View style={s.headerTextBlock}>
              <Text style={s.companyName} numberOfLines={1}>{companyLabel}</Text>
            </View>
          </View>
          {/* Global search lives here rather than in the action grid. It is not
              a "create something" action, and the owner's More hub has no
              Search row — so with the grid trimmed to four documents this is
              the only way in. */}
          <TouchableOpacity
            style={s.headerIconBtn}
            onPress={() => navigation.navigate('GlobalSearch')}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Search"
          >
            <Feather name="search" size={19} color={colors.neutral0} />
          </TouchableOpacity>
        </View>

        <View style={s.headerMetaRow}>
          <View style={[s.statusPill, !booksClear && s.statusPillWarn]}>
            <View style={[s.statusDot, !booksClear && s.statusDotWarn]} />
            <Text style={[s.statusPillText, !booksClear && s.statusPillTextWarn]}>
              {booksClear
                ? 'Books up to date'
                : `${openAlerts} ${openAlerts === 1 ? 'item needs' : 'items need'} attention`}
            </Text>
          </View>
          <View style={s.datePill}>
            <Feather name="calendar" size={11} color="rgba(255,255,255,0.82)" />
            <Text style={s.datePillText}>{todayLabel()}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* ── Body ─────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: C.canvas }}
        contentContainerStyle={s.body}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={C.brand} />}
      >
        {isInitialLoading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {alerts.length > 0 && (
              <View style={s.alertsWrap}>
                {alerts.map(a => <AlertBanner key={a.id} alert={a} />)}
              </View>
            )}

            {/* ── Guided first-run setup checklist (§5.7) ─ */}
            {setup && !setup.completed && setupSteps.length > 0 && (
              <SetupChecklist
                setup={setup}
                steps={setupSteps}
                onNavigate={goToSetupStep}
                onDismiss={dismissSetup}
              />
            )}

            {/* Section order is deliberate and runs money → operations →
                do something → history: what is owed and owing, then the two
                things a warehouse day actually turns on (deliveries, stock),
                then the documents you would raise about them, and only then
                the trend and the log. Revenue sits below the fold on purpose —
                it is a review figure, not something acted on. */}

            {/* ── Receivables / Payables ─────────────── */}
            <Section title="Financials" caption={asOfLabel(rawData?.period?.endDate)}>
              <View style={s.statRow}>
                <StatCard
                  icon="arrow-down-left"
                  tint={C.info}
                  tintBg={TINT.info}
                  value={statById.ar?.value ?? 'Rs 0'}
                  label="Receivables"
                  sub="Due from customers"
                  onPress={() => (navigation as NativeStackNavigationProp<Record<string, object>>).navigate('TransactionsStack', { screen: 'InvoiceList', initial: false })}
                />
                <StatCard
                  icon="arrow-up-right"
                  tint={C.warn}
                  tintBg={TINT.warn}
                  value={statById.ap?.value ?? 'Rs 0'}
                  label="Payables"
                  sub="Owed to suppliers"
                  onPress={() => (navigation as NativeStackNavigationProp<Record<string, object>>).navigate('TransactionsStack', { screen: 'BillList', initial: false })}
                />
              </View>
            </Section>

            {/* ── Deliveries (warehouse tier only) ─────
                The card summarises deliveries — pending, in transit,
                delivered, assigned — so "View all" opens the delivery monitor,
                which shows every one of them under that same breakdown. It
                used to open the team roster, which is people. The roster is
                still one tap away under More. */}
            {showDelivery && (
              <Section title="Deliveries" action="View all" onAction={() => navigation.navigate('DeliveryMonitor')}>
                <DeliveryProgressCard delivery={delivery} completedPct={completedPct} />
              </Section>
            )}

            {/* ── Inventory (inventory-enabled tiers) ── */}
            {showInventory && (
              <Section
                title="Inventory"
                action="View all"
                onAction={() => (navigation as NativeStackNavigationProp<Record<string, object>>).navigate('InventoryStack', { screen: 'InventoryList' })}
              >
                <InventoryCard count={rawData?.inventoryItems ?? 0} onPress={() => (navigation as NativeStackNavigationProp<Record<string, object>>).navigate('InventoryStack', { screen: 'InventoryList' })} />
              </Section>
            )}

            {/* ── Quick actions ──────────────────────────
                Four documents, in the order the two cycles run: sell
                (invoice, sales order) then buy (purchase order, bill). Every
                tile opens a blank form — this grid creates, it does not
                navigate. Inventory, Deliveries and Agencies used to sit here
                as well, but each already has its own card or a More row, so
                they were shortcuts to places one tap away. */}
            <Section title="Quick actions">
              <View style={s.actionsGrid}>
                <View style={s.actionsRow}>
                  <ActionTile icon="file-text" label="New invoice" onPress={() => navigation.navigate('InvoiceForm')} />
                  <ActionTile icon="clipboard" label="New sales order" onPress={() => navigation.navigate('SalesOrderForm')} />
                </View>
                <View style={s.actionsRow}>
                  <ActionTile icon="shopping-cart" label="New purchase order" onPress={() => navigation.navigate('POForm')} />
                  <ActionTile icon="file-plus" label="New bill" onPress={() => navigation.navigate('BillForm')} />
                </View>
              </View>
            </Section>

            {/* ── Revenue trend (live analytics series) ─
                The window is fixed, so the caption states it. It used to count
                the points the API returned, which read "Last 1 months" for a
                company in its first month. */}
            <Section
              title="Revenue"
              caption={revenueTrend && revenueTrend.length > 0 ? `Last ${WINDOW_MONTHS} months` : undefined}
              action="View all"
              onAction={() => navigation.navigate('AnalyticsDashboard')}
            >
              <RevenueTrendCard points={revenueTrend} />
            </Section>

            {/* ── Recent transactions ────────────────── */}
            {/* "View all" goes to the Transactions hub, not InvoiceList. This
                card mixes invoices and bills, so a link to the invoice list
                could not contain half of what it sits under. The hub lists
                both, along with the other document types. */}
            <Section
              title="Recent transactions"
              action={transactions.length > 0 ? 'View all' : undefined}
              onAction={() => (navigation as NativeStackNavigationProp<Record<string, object>>).navigate('TransactionsStack', { screen: 'TransactionsHub' })}
            >
              {transactions.length > 0 ? (
                <View style={s.txCard}>
                  {recentTransactions.map((tx, i) => (
                    <TransactionRow
                      key={tx.id}
                      tx={tx}
                      isLast={i === recentTransactions.length - 1}
                      onPress={openTransaction(tx)}
                    />
                  ))}
                </View>
              ) : (
                <TouchableOpacity style={s.emptyCard} activeOpacity={0.85} onPress={() => navigation.navigate('InvoiceForm')}>
                  <Feather name="inbox" size={22} color={C.ink3} style={s.emptyIcon} />
                  <Text style={s.emptyTitle}>No activity yet</Text>
                  <Text style={s.emptySub}>Create your first invoice or bill to start tracking transactions here.</Text>
                  <View style={s.emptyCta}>
                    <Feather name="plus" size={13} color={C.brand} />
                    <Text style={s.emptyCtaText}>New invoice</Text>
                  </View>
                </TouchableOpacity>
              )}
            </Section>

            <View style={{ height: 28 }} />
          </>
        )}
      </ScrollView>
    </ReportContainer>
  );
};

// ═════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═════════════════════════════════════════════════════

interface SectionProps {
  title: string;
  caption?: string;
  action?: string;
  onAction?: () => void;
}

const SectionHeader: React.FC<SectionProps> = ({ title, caption, action, onAction }) => (
  <View style={s.sectionHeader}>
    <View style={s.sectionTitleWrap}>
      <Text style={s.sectionTitle}>{title}</Text>
      {caption && <Text style={s.sectionCaption}>{caption}</Text>}
    </View>
    {action && (
      <TouchableOpacity onPress={onAction} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={s.sectionAction}>{action}</Text>
      </TouchableOpacity>
    )}
  </View>
);

/**
 * A heading and the content it labels, as one block.
 *
 * Every section used to be loose siblings of the ScrollView — a header, then a
 * card, sometimes wrapped in a fragment — held apart by one `gap` with the
 * header pulling itself back up by a negative margin. That spaced a heading
 * from its own card almost exactly as far as from the section above it, so the
 * screen read as one continuous stream, and any reorder meant moving two or
 * three nodes and hoping the spacing followed.
 *
 * Binding them means the gap inside a section (10) can be tighter than the gap
 * between sections (22) — proximity is what makes a heading look like it
 * belongs to what is under it — and a reorder moves one block.
 */
const Section: React.FC<SectionProps & { children: React.ReactNode }> = ({ children, ...header }) => (
  <View style={s.section}>
    <SectionHeader {...header} />
    {children}
  </View>
);

// ── AR / AP stat card ─────────────────────────────────
const StatCard: React.FC<{
  icon: string;
  /** The glyph colour. `tintBg` is its matching chip surface (see TINT). */
  tint: string;
  tintBg: string;
  value: string;
  label: string;
  sub: string;
  onPress?: () => void;
}> = ({ icon, tint, tintBg, value, label, sub, onPress }) => (
  <TouchableOpacity style={s.statCard} activeOpacity={0.8} onPress={onPress}>
    <View style={s.statTopRow}>
      <View style={[s.statIcon, { backgroundColor: tintBg }]}>
        <Feather name={icon as keyof typeof Feather.glyphMap} size={15} color={tint} />
      </View>
      <Feather name="chevron-right" size={16} color={C.ink3} />
    </View>
    <Text style={s.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{value}</Text>
    <Text style={s.statLabel}>{label}</Text>
    <Text style={s.statSub}>{sub}</Text>
  </TouchableOpacity>
);

// ── Delivery progress card ────────────────────────────
const DeliveryProgressCard: React.FC<{ delivery: DeliveryOverviewData; completedPct: number }> = ({
  delivery, completedPct
}) => {
  const waiting = delivery.pending + delivery.assigned;
  const hasData = delivery.total > 0;
  return (
    <View style={s.card}>
      <View style={s.deliveryHeader}>
        <View>
          <Text style={s.deliveryPct}>{completedPct}%</Text>
          <Text style={s.mutedSm}>Completion rate</Text>
        </View>
        <View style={s.totalPill}>
          <Feather name="truck" size={12} color={C.slate} />
          <Text style={s.totalPillText}>{delivery.total} total</Text>
        </View>
      </View>

      <View style={s.segTrack}>
        {hasData ? (
          <>
            {delivery.delivered > 0 && <View style={{ flex: delivery.delivered, backgroundColor: C.pos }} />}
            {delivery.inTransit > 0 && <View style={{ flex: delivery.inTransit, backgroundColor: C.indigo }} />}
            {waiting > 0 && <View style={{ flex: waiting, backgroundColor: C.warn }} />}
          </>
        ) : (
          <View style={{ flex: 1, backgroundColor: C.lineSoft }} />
        )}
      </View>

      <View style={s.chipsRow}>
        {[
          { label: 'Pending', value: delivery.pending, color: C.warn },
          { label: 'In transit', value: delivery.inTransit, color: C.indigo },
          { label: 'Delivered', value: delivery.delivered, color: C.pos },
          { label: 'Assigned', value: delivery.assigned, color: C.info },
        ].map(chip => (
          <View key={chip.label} style={s.chip}>
            <Text style={s.chipVal}>{chip.value}</Text>
            <View style={s.chipLabelRow}>
              <View style={[s.chipDot, { backgroundColor: chip.color }]} />
              <Text style={s.chipLabel}>{chip.label}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

// ── Action tile ───────────────────────────────────────
// No colour prop, and no chip behind the glyph. The six tiles each carried a
// different hue — brand, blue, teal, indigo, amber, slate — which made a
// rainbow out of things that rank the same. Replacing that with one tinted
// square just traded a rainbow for a row of grey boxes: the card already has a
// surface and a border, so a second filled shape inside it is one frame too
// many. The icon sits on the card. Colour is kept where it carries a fact
// (delivery status, money in vs out, alert severity).
const ActionTile: React.FC<{ icon: string; label: string; onPress: () => void }> = ({
  icon, label, onPress
}) => (
  <TouchableOpacity
    style={s.actionTile}
    onPress={onPress}
    activeOpacity={0.75}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <Feather name={icon as keyof typeof Feather.glyphMap} size={22} color={C.brand} />
    <Text style={s.actionLabel} numberOfLines={2}>{label}</Text>
  </TouchableOpacity>
);

// ── Inventory card ────────────────────────────────────
// The badge shows only in the case worth acting on. It used to read "Tracked"
// whenever the count was above zero — a green badge next to a number, saying
// what the number already said.
const InventoryCard: React.FC<{ count: number; onPress?: () => void }> = ({ count, onPress }) => (
  <TouchableOpacity style={s.invCard} onPress={onPress} activeOpacity={0.8}>
    <Feather name="package" size={22} color={C.brand} />
    <View style={{ flex: 1 }}>
      <Text style={s.invCount}>{count}</Text>
      <Text style={s.mutedSm}>Items in stock</Text>
    </View>
    {count === 0 && (
      <View style={s.invBadge}>
        <Text style={s.invBadgeText}>Empty</Text>
      </View>
    )}
    <Feather name="chevron-right" size={18} color={C.ink3} />
  </TouchableOpacity>
);

// ── Transaction row ───────────────────────────────────
// The label comes from `kind`, not from the arrow direction. `onPress` is
// omitted for a document type this build cannot open, and the row then renders
// as plain text rather than as a link to nowhere.
const TransactionRow: React.FC<{
  tx: RecentTransaction;
  isLast: boolean;
  onPress?: () => void;
}> = ({ tx, isLast, onPress }) => {
  const isIncome = tx.type === 'income';
  const tone = isIncome ? C.pos : C.neg;
  const label = tx.kind === 'invoice' ? 'Invoice' : tx.kind === 'bill' ? 'Bill' : '';

  return (
    <TouchableOpacity
      style={[s.txRow, !isLast && s.txDivider]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.6}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `${tx.description}, ${tx.amount}` : undefined}
    >
      <View style={[s.txIcon, { backgroundColor: isIncome ? TINT.pos : TINT.neg }]}>
        <Feather name={isIncome ? 'arrow-down-left' : 'arrow-up-right'} size={14} color={tone} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.txDesc} numberOfLines={1}>{tx.description}</Text>
        <Text style={s.txDate}>{tx.date}</Text>
      </View>
      <View style={s.txRight}>
        <Text style={[s.txAmount, { color: tone }]}>{isIncome ? '+' : '−'} {tx.amount}</Text>
        {!!label && <Text style={s.txType}>{label}</Text>}
      </View>
      {onPress && <Feather name="chevron-right" size={16} color={C.ink3} />}
    </TouchableOpacity>
  );
};

// ── Alert banner ──────────────────────────────────────
const AlertBanner: React.FC<{ alert: DashboardAlert }> = ({ alert }) => {
  const cfg = {
    red: { tint: C.neg, bg: TINT.neg, icon: 'alert-circle' },
    amber: { tint: C.warn, bg: TINT.warn, icon: 'alert-triangle' },
    blue: { tint: C.info, bg: TINT.info, icon: 'info' }
  }[alert.severity];
  return (
    <View style={[s.alertBanner, { backgroundColor: cfg.bg, borderLeftColor: cfg.tint }]}>
      <Feather name={cfg.icon as keyof typeof Feather.glyphMap} size={14} color={cfg.tint} />
      <Text style={[s.alertText, { color: C.ink }]}>{alert.message}</Text>
    </View>
  );
};

// ── Skeleton ──────────────────────────────────────────
const Skel: React.FC<{ w: number | string; h: number; r?: number; style?: Record<string, string | number> }> = ({ w, h, r = 8, style }) => {
  const opacity = usePulse();
  const animatedStyle: Record<string, string | number | Animated.Value> = { height: h, borderRadius: r, backgroundColor: THEME.colors.border, opacity };
  if (typeof w === 'number') {
    animatedStyle.width = w;
  } else if (typeof w === 'string') {
    animatedStyle.width = w;
  }
  return <Animated.View style={[animatedStyle, style]} />;
};

/**
 * The first three sections, drawn at the sizes the real ones occupy.
 *
 * It mirrors the running order deliberately: a placeholder that settles into a
 * different arrangement than it drew is worse than none, because the content
 * appears to jump. So this tracks the order above — stats, the delivery card,
 * the four-tile grid — and stops there rather than guessing at what is below
 * the fold.
 */
const DashboardSkeleton: React.FC = () => (
  <View style={{ gap: 22 }}>
    <View style={s.section}>
      <View style={s.sectionHeader}><Skel w={130} h={15} r={5} /></View>
      <View style={s.statRow}>
        {[0, 1].map(i => (
          <View key={i} style={[s.statCard, { gap: 8 }]}>
            <Skel w={34} h={34} r={11} />
            <Skel w={'70%'} h={20} r={6} style={{ marginTop: 6 }} />
            <Skel w={'55%'} h={10} r={4} />
          </View>
        ))}
      </View>
    </View>

    <View style={s.section}>
      <View style={s.sectionHeader}><Skel w={96} h={15} r={5} /></View>
      {/* Same surface as the delivery card, and the same three blocks: the
          completion figure, the segmented track, the four status chips. */}
      <View style={[s.card, { gap: 12 }]}>
        <Skel w={'42%'} h={28} r={7} />
        <Skel w={'100%'} h={9} r={5} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[0, 1, 2, 3].map(i => (
            <View key={i} style={{ flex: 1 }}><Skel w={'100%'} h={46} r={12} /></View>
          ))}
        </View>
      </View>
    </View>

    <View style={s.section}>
      <View style={s.sectionHeader}><Skel w={100} h={15} r={5} /></View>
      <View style={s.actionsGrid}>
        {[0, 1].map(row => (
          <View key={row} style={s.actionsRow}>
            {[0, 1].map(i => (
              <View key={i} style={s.actionTile}>
                <Skel w={22} h={22} r={5} />
                <Skel w={'70%'} h={10} r={4} style={{ marginTop: 6 }} />
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  </View>
);

// ═════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════
const s = StyleSheet.create({
  // Header
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 22,
    borderBottomLeftRadius: HEADER_RADIUS,
    borderBottomRightRadius: HEADER_RADIUS,
    overflow: 'hidden',
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 11 },
  headerTextBlock: { flex: 1 },
  // h2, the same role ReportHeader gives its title, so the dashboard heading
  // matches Transactions / Reports / Inventory / More. It was h3 — 19px against
  // their 22 — which made the one screen without a back arrow also the one with
  // a smaller title. The letterSpacing override is dropped with it: h2 carries
  // its own (-0.3), and repeating a different value here is what let the two
  // drift apart.
  companyName: { ...THEME.typography.h2, color: colors.neutral0, fontFamily: FONT },
  // 38px square: the 44pt minimum target is met by the hitSlop, so the visible
  // button can stay small enough not to compete with the company name.
  headerIconBtn: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  headerMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(16,185,129,0.14)',
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.28)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
  },
  // Amber when something is open. Written as rgba rather than a token because
  // these sit on the navy header, where a solid tint would read as a block of
  // colour rather than a wash — the same reason the date pill is a white alpha.
  statusPillWarn: {
    backgroundColor: 'rgba(245,158,11,0.16)',
    borderColor: 'rgba(245,158,11,0.32)',
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: THEME.colors.success },
  statusDotWarn: { backgroundColor: THEME.colors.warning },
  statusPillText: { ...THEME.typography.overline, color: colors.successLight, fontFamily: FONT },
  statusPillTextWarn: { color: colors.warningLight },
  datePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
  },
  datePillText: { ...THEME.typography.overline, color: 'rgba(255,255,255,0.88)', fontFamily: FONT },

  // Body
  // 22 between sections against 10 inside one (see `section`). The two numbers
  // are what separate the blocks; when they were 16 and 10 the whole screen
  // read as a single list.
  body: { paddingTop: 16, paddingBottom: 28, gap: 22 },
  alertsWrap: { paddingHorizontal: 16, gap: 8 },

  // Section
  section: { gap: 10 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  sectionTitleWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  sectionTitle: { ...THEME.typography.labelLg, color: C.ink, letterSpacing: -0.2, fontFamily: FONT },
  sectionCaption: { ...THEME.typography.caption, color: C.ink3, fontFamily: FONT },
  sectionAction: { ...THEME.typography.labelSm, color: C.brand, fontFamily: FONT },

  // Generic card
  card: { ...card, marginHorizontal: 16, padding: 16 },

  // AR / AP grid
  statRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16 },
  statCard: { ...card, flex: 1, padding: 14 },
  statTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  statIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  statValue: { ...THEME.typography.h2, color: C.ink, fontFamily: FONT, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  statLabel: { ...THEME.typography.labelSm, color: C.ink2, fontFamily: FONT, marginTop: 3 },
  statSub: { ...THEME.typography.caption, color: C.ink3, fontFamily: FONT, marginTop: 1 },

  // Delivery
  deliveryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  deliveryPct: { ...THEME.typography.displayMd, color: C.ink, fontFamily: FONT, lineHeight: 34, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  mutedSm: { ...THEME.typography.caption, color: C.ink3, fontFamily: FONT, marginTop: 2 },
  totalPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.canvas, borderWidth: 1, borderColor: C.line, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  totalPillText: { ...THEME.typography.labelSm, color: C.ink2, fontFamily: FONT, fontVariant: ['tabular-nums'] },
  segTrack: { height: 9, flexDirection: 'row', backgroundColor: C.lineSoft, borderRadius: 5, overflow: 'hidden', gap: 2, marginBottom: 14 },
  chipsRow: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, alignItems: 'center', backgroundColor: C.canvas, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingVertical: 8 },
  chipVal: { ...THEME.typography.h3, color: C.ink, fontFamily: FONT, lineHeight: 21, fontVariant: ['tabular-nums'] },
  chipLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipLabel: { ...THEME.typography.overline, color: C.ink2, fontFamily: FONT },

  // Quick actions — a 2 × 2 grid, as two explicit rows of two.
  //
  // Not a wrapping row with a percentage basis. That was the first attempt and
  // it laid all four out side by side: a percentage flex-basis needs a
  // definite main-size on the parent to resolve against, and nested inside the
  // ScrollView's content container it does not get one — so it fell back to
  // auto and nothing ever wrapped. Two rows of `flex: 1` is the same shape
  // `statRow` above already uses for the AR/AP pair, needs no percentage, and
  // cannot wrap wrongly because there is nothing to wrap.
  actionsGrid: { paddingHorizontal: 16, gap: 12 },
  actionsRow: { flexDirection: 'row', gap: 12 },
  actionTile: { ...card, flex: 1, paddingVertical: 18, paddingHorizontal: 12, alignItems: 'center', gap: 10 },
  // minHeight is two lines of overline (2 × 14), so "New invoice" on one line
  // and "New purchase order" on two still make tiles of equal height.
  actionLabel: { ...THEME.typography.overline, color: C.ink, textAlign: 'center', fontFamily: FONT, minHeight: 28 },

  // Inventory
  invCard: { ...card, marginHorizontal: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  invCount: { ...THEME.typography.displaySm, color: C.ink, fontFamily: FONT, lineHeight: 28, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  invBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: TINT.warn },
  invBadgeText: { ...THEME.typography.overline, fontFamily: FONT, color: C.warn },

  // Transactions
  txCard: { ...card, marginHorizontal: 16, padding: 0, overflow: 'hidden' },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  txDivider: { borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  txIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  txDesc: { ...THEME.typography.labelMd, color: C.ink, fontFamily: FONT },
  txDate: { ...THEME.typography.caption, color: C.ink3, marginTop: 2, fontFamily: FONT },
  txRight: { alignItems: 'flex-end', gap: 3 },
  txAmount: { ...THEME.typography.labelMd, fontFamily: FONT, fontVariant: ['tabular-nums'] },
  txType: { ...THEME.typography.overline, color: C.ink3, fontFamily: FONT },

  // Empty
  emptyCard: { ...card, marginHorizontal: 16, paddingVertical: 26, paddingHorizontal: 16, alignItems: 'center', gap: 6, borderStyle: 'dashed', borderColor: C.line },
  emptyIcon: { marginBottom: 4 },
  emptyTitle: { ...THEME.typography.h5, color: C.ink, fontFamily: FONT },
  emptySub: { ...THEME.typography.caption, color: C.ink3, textAlign: 'center', fontFamily: FONT, lineHeight: 17 },
  emptyCta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9, backgroundColor: TINT.brand },
  emptyCtaText: { ...THEME.typography.labelSm, color: C.brand, fontFamily: FONT },

  // Alerts
  alertBanner: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 11, borderRadius: 10, borderLeftWidth: 3 },
  alertText: { ...THEME.typography.caption, flex: 1, fontFamily: FONT }
});

export default AdminDashboardScreen;