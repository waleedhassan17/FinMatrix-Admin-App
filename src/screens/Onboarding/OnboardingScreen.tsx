import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StatusBar,
  TouchableOpacity,
  Animated
} from 'react-native';
import { THEME } from '../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { setCurrentPage, selectCurrentPage } from './onboardingSlice';
import { setOnboardingSeen } from '../Auth/authSlice';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';

// Design-system tokens (see src/theme/theme.ts).
const { colors, radius, shadows, spacing, typography } = THEME;

const { width } = Dimensions.get('window');

// ═══════════════════════════════════════
// Design Tokens
// ═══════════════════════════════════════
const B = {
  navy: colors.neutral900,
  w95: 'rgba(255,255,255,0.95)',
  w70: 'rgba(255,255,255,0.70)',
  w50: 'rgba(255,255,255,0.50)',
  w30: 'rgba(255,255,255,0.30)',
  w12: 'rgba(255,255,255,0.12)',
  w08: 'rgba(255,255,255,0.08)',
  w06: 'rgba(255,255,255,0.06)',
  w04: 'rgba(255,255,255,0.04)',
  w03: 'rgba(255,255,255,0.03)',
  emerald: colors.success,
  teal: THEME.colors.primaryHover,
  sky: THEME.colors.info,
  amber: colors.warning
};

// ═══════════════════════════════════════
// Slide Data
// ═══════════════════════════════════════
interface SlideData {
  id: string;
  tag: string;
  title: string;
  titleAccent: string;
  subtitle: string;
  accent: string;
  cardTitle: string;
  cardBadge: string;
  badge1: { value: string; label: string };
  badge2: { value: string; label: string };
  cardType: 'dashboard' | 'inventory' | 'delivery' | 'report';
}

const slides: SlideData[] = [
  {
    id: '1',
    tag: 'Enterprise Platform',
    title: 'Financial clarity,',
    titleAccent: 'delivered.',
    subtitle:
      'Enterprise accounting meets modern delivery management — all in one platform.',
    accent: B.emerald,
    cardTitle: 'Dashboard',
    cardBadge: 'Live',
    badge1: { value: '142', label: 'Active users' },
    badge2: { value: '99.9%', label: 'Uptime' },
    cardType: 'dashboard'
  },
  {
    id: '2',
    tag: 'Real-Time Sync',
    title: 'Inventory tracked',
    titleAccent: 'in real-time.',
    subtitle:
      'Cloud-synced stock across your team. Track levels, movements, and valuations instantly.',
    accent: B.teal,
    cardTitle: 'Inventory Status',
    cardBadge: 'Synced',
    badge1: { value: '24.6K', label: 'Total items' },
    badge2: { value: '3', label: 'Warehouses' },
    cardType: 'inventory'
  },
  {
    id: '3',
    tag: 'Smart Logistics',
    title: 'Deliveries managed,',
    titleAccent: 'start to finish.',
    subtitle:
      'Assign routes, capture signatures, and verify deliveries — all automated.',
    accent: B.sky,
    cardTitle: 'Active Deliveries',
    cardBadge: 'Live',
    badge1: { value: '24', label: 'Active today' },
    badge2: { value: '96%', label: 'On-time rate' },
    cardType: 'delivery'
  },
  {
    id: '4',
    tag: 'Powerful Insights',
    title: 'Reports that drive',
    titleAccent: 'better decisions.',
    subtitle:
      'Financial statements, P&L, balance sheets, and analytics at your fingertips.',
    accent: B.amber,
    cardTitle: 'Financial Report',
    cardBadge: 'Q4 2025',
    badge1: { value: '17%', label: 'Growth YoY' },
    badge2: { value: '12', label: 'Report types' },
    cardType: 'report'
  },
];

// ═══════════════════════════════════════
// Card Inner Content — Dashboard
// ═══════════════════════════════════════
const DashboardContent: React.FC<{ accent: string }> = ({ accent }) => (
  <>
    <View style={cS.metricRow}>
      {[
        { v: 'Rs 2.4M', l: 'Revenue', c: B.emerald },
        { v: '847', l: 'Orders', c: B.teal },
        { v: '96.2%', l: 'On-time', c: B.sky },
      ].map((m, i) => (
        <View key={i} style={cS.metricCell}>
          <Text style={[cS.metricValue, { color: m.c }]}>{m.v}</Text>
          <Text style={cS.metricLabel}>{m.l}</Text>
        </View>
      ))}
    </View>
    <View style={cS.barsRow}>
      {[12, 20, 16, 26, 22, 30, 24, 18, 28, 20, 26, 32].map((h, i) => (
        <View
          key={i}
          style={[
            cS.bar,
            {
              height: h,
              backgroundColor:
                i === 11 ? accent : accent + (i % 2 === 0 ? '30' : '18'),
            },
          ]}
        />
      ))}
    </View>
  </>
);

// ═══════════════════════════════════════
// Card Inner Content — Inventory
// ═══════════════════════════════════════
const INV_ROWS = [
  { name: 'Raw Materials', qty: '12,450 units', status: 'In Stock', c: B.emerald },
  { name: 'Finished Goods', qty: '3,280 units', status: 'Low Stock', c: B.amber },
  { name: 'Packaging', qty: '8,910 units', status: 'In Stock', c: B.emerald },
];

const InventoryContent: React.FC = () => (
  <>
    {INV_ROWS.map((item, i) => (
      <View
        key={i}
        style={[cS.listRow, i > 0 && { borderTopWidth: 1, borderTopColor: B.w06 }]}>
        <View>
          <Text style={cS.listTitle}>{item.name}</Text>
          <Text style={cS.listSub}>{item.qty}</Text>
        </View>
        <View style={[cS.chip, { backgroundColor: item.c + '15' }]}>
          <Text style={[cS.chipText, { color: item.c }]}>{item.status}</Text>
        </View>
      </View>
    ))}
  </>
);

// ═══════════════════════════════════════
// Card Inner Content — Delivery
// ═══════════════════════════════════════
const DEL_ROWS = [
  { id: 'DEL-847', to: 'Ahmed Markets', status: 'In Transit', icon: '\u2192', c: B.sky },
  { id: 'DEL-848', to: 'Super Mart Gulberg', status: 'Delivered', icon: '\u2713', c: B.emerald },
  { id: 'DEL-849', to: 'Al-Fatah Store', status: 'Pending', icon: '\u25CB', c: B.amber },
];

const DeliveryContent: React.FC = () => (
  <>
    {DEL_ROWS.map((d, i) => (
      <View
        key={i}
        style={[cS.delRow, i > 0 && { borderTopWidth: 1, borderTopColor: B.w06 }]}>
        <View style={[cS.delIcon, { backgroundColor: d.c + '15' }]}>
          <Text style={[cS.delIconText, { color: d.c }]}>{d.icon}</Text>
        </View>
        <View style={cS.delInfo}>
          <Text style={cS.delName} numberOfLines={1}>{d.to}</Text>
          <Text style={cS.delId}>{d.id}</Text>
        </View>
        <Text style={[cS.delStatus, { color: d.c }]}>{d.status}</Text>
      </View>
    ))}
  </>
);

// ═══════════════════════════════════════
// Card Inner Content — Report
// ═══════════════════════════════════════
const ReportContent: React.FC<{ accent: string }> = ({ accent }) => (
  <>
    <View style={cS.metricRow}>
      {[
        { v: 'Rs 8.2M', l: 'Revenue', c: B.emerald },
        { v: 'Rs 1.4M', l: 'Net Profit', c: B.amber },
      ].map((m, i) => (
        <View key={i} style={cS.metricCell}>
          <Text style={[cS.metricValue, { color: m.c }]}>{m.v}</Text>
          <Text style={cS.metricLabel}>{m.l}</Text>
        </View>
      ))}
    </View>
    <View style={cS.barsRow}>
      {[16, 22, 18, 28, 24, 32, 28, 36, 30, 38, 34, 42].map((h, i) => (
        <View
          key={i}
          style={[
            cS.bar,
            {
              height: h,
              backgroundColor:
                i >= 10 ? accent : accent + (i % 2 === 0 ? '28' : '14'),
            },
          ]}
        />
      ))}
    </View>
    <View style={cS.monthRow}>
      {['Jan', 'Mar', 'Jun', 'Sep', 'Dec'].map(m => (
        <Text key={m} style={cS.monthLabel}>{m}</Text>
      ))}
    </View>
  </>
);

// ── Card content registry ──
const CARD_MAP: Record<string, React.FC<{ accent: string }>> = {
  dashboard: DashboardContent,
  inventory: () => <InventoryContent />,
  delivery: () => <DeliveryContent />,
  report: ReportContent
};

// ═══════════════════════════════════════
// Main Component
// ═══════════════════════════════════════
type Nav = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;

const OnboardingScreen: React.FC<{ navigation: Nav }> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const activeIndex = useAppSelector(selectCurrentPage);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const isLast = activeIndex === slides.length - 1;
  const current = slides[activeIndex] ?? slides[0];

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / width);
      if (idx !== activeIndex) dispatch(setCurrentPage(idx));
    },
    [dispatch, activeIndex],
  );

  const skip = () => {
    dispatch(setOnboardingSeen());
  };

  const next = () => {
    if (isLast) return skip();
    flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
  };

  const renderSlide = ({ item }: { item: SlideData }) => {
    const CardBody = CARD_MAP[item.cardType];
    const isDashboard = item.cardType === 'dashboard';

    return (
      <View style={ms.slide}>
        {/* Radial glow layers */}
        <View style={[ms.glowOuter, { backgroundColor: item.accent + '0A' }]} />
        <View style={[ms.glowInner, { backgroundColor: item.accent + '06' }]} />

        {/* Decorative geometry */}
        <View style={ms.decorRect} />
        <View style={ms.decorCircle} />

        <View style={ms.slideContent}>
          {/* ════════════════════════════════
              GLASS CARD — Product Preview
             ════════════════════════════════ */}
          <View style={ms.cardWrapper}>
            <View style={ms.glassCard}>
              {/* Card header */}
              <View style={ms.cardHeader}>
                {isDashboard ? (
                  <View style={ms.cardHeaderLeft}>
                    <View style={[ms.cardLogo, { backgroundColor: item.accent + '18' }]}>
                      <Text style={[ms.cardLogoText, { color: item.accent }]}>F</Text>
                    </View>
                    <View>
                      <Text style={ms.cardTitle}>{item.cardTitle}</Text>
                      <Text style={ms.cardTitleSub}>Today's overview</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={ms.cardTitle}>{item.cardTitle}</Text>
                )}
                <View style={[ms.cardBadge, { backgroundColor: item.accent + '18' }]}>
                  <Text style={[ms.cardBadgeText, { color: item.accent }]}>{item.cardBadge}</Text>
                </View>
              </View>

              {/* Card body */}
              <CardBody accent={item.accent} />
            </View>

            {/* Floating badges */}
            <View style={[ms.fBadge, ms.fBadge1, { borderColor: item.accent + '15' }]}>
              <Text style={[ms.fBadgeVal, { color: item.accent }]}>{item.badge1.value}</Text>
              <Text style={ms.fBadgeLbl}>{item.badge1.label}</Text>
            </View>
            <View style={[ms.fBadge, ms.fBadge2, { borderColor: item.accent + '15' }]}>
              <Text style={[ms.fBadgeVal, { color: item.accent }]}>{item.badge2.value}</Text>
              <Text style={ms.fBadgeLbl}>{item.badge2.label}</Text>
            </View>
          </View>

          {/* Tag pill */}
          <View style={[ms.tag, { backgroundColor: item.accent + '15', borderColor: item.accent + '12' }]}>
            <View style={[ms.tagDot, { backgroundColor: item.accent }]} />
            <Text style={[ms.tagText, { color: item.accent }]}>{item.tag}</Text>
          </View>

          {/* Title */}
          <Text style={ms.title}>
            {item.title}{'\n'}
            <Text style={{ color: item.accent }}>{item.titleAccent}</Text>
          </Text>
          <Text style={ms.subtitle}>{item.subtitle}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={ms.container}>
      <StatusBar barStyle="light-content" backgroundColor={B.navy} />

      {/* Top skip button removed — bottom "Skip for now" is the single skip affordance */}

      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false, listener: handleScroll },
        )}
        scrollEventThrottle={16}
        bounces={false}
        snapToInterval={width}
        decelerationRate="fast"
      />

      {/* Bottom */}
      <View style={ms.bottom}>
        <View style={ms.dotsRow}>
          {slides.map((_, i) => {
            const r = [(i - 1) * width, i * width, (i + 1) * width];
            return (
              <Animated.View
                key={i}
                style={[
                  ms.dot,
                  {
                    width: scrollX.interpolate({ inputRange: r, outputRange: [5, 28, 5], extrapolate: 'clamp' }),
                    opacity: scrollX.interpolate({ inputRange: r, outputRange: [0.2, 1, 0.2], extrapolate: 'clamp' }),
                    backgroundColor: current.accent
                  },
                ]}
              />
            );
          })}
        </View>

        <TouchableOpacity
          style={[ms.cta, { backgroundColor: current.accent }]}
          onPress={next}
          activeOpacity={0.85}>
          <Text style={ms.ctaText}>{isLast ? 'Get Started' : 'Continue'}</Text>
        </TouchableOpacity>

        <View style={ms.skipBelowReserved}>
          {activeIndex === 0 && (
            <TouchableOpacity onPress={skip} style={ms.skipBelow} hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}>
              <Text style={ms.skipBelowText}>Skip for now</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

// ═══════════════════════════════════════
// Card Content Styles
// ═══════════════════════════════════════
const cS = StyleSheet.create({
  metricRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  metricCell: { flex: 1, backgroundColor: B.w03, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center' },
  metricValue: { ...typography.labelSm },
  metricLabel: { ...typography.overline, color: B.w50, marginTop: 2 },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 34 },
  bar: { flex: 1, borderRadius: 2 },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9 },
  listTitle: { ...typography.labelSm, color: B.w70 },
  listSub: { ...typography.overline, color: B.w50, marginTop: 2 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  chipText: { ...typography.overline },
  delRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 10 },
  delIcon: { width: 26, height: 26, borderRadius: 7, justifyContent: 'center', alignItems: 'center' },
  delIconText: { ...typography.caption, fontWeight: typography.labelLg.fontWeight },
  delInfo: { flex: 1 },
  delName: { ...typography.labelSm, color: B.w70 },
  delId: { ...typography.overline, color: B.w50, marginTop: 1 },
  delStatus: { ...typography.overline },
  monthRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  monthLabel: { ...typography.overline, color: B.w30 }
});

// ═══════════════════════════════════════
// Main Styles
// ═══════════════════════════════════════
const ms = StyleSheet.create({
  container: { flex: 1, backgroundColor: B.navy },

  skipBtn: {
    position: 'absolute', top: 56, right: 20, zIndex: 10,
    paddingVertical: 7, paddingHorizontal: 16, borderRadius: 8,
    backgroundColor: B.w06, borderWidth: 1, borderColor: B.w06
  },
  skipBtnText: { ...typography.bodySm, color: B.w30 },

  slide: { width, flex: 1, backgroundColor: B.navy },
  slideContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },

  // Glow
  glowOuter: { position: 'absolute', top: '12%', left: '10%', width: width * 0.8, height: width * 0.8, borderRadius: width * 0.4 },
  glowInner: { position: 'absolute', top: '18%', left: '20%', width: width * 0.6, height: width * 0.6, borderRadius: width * 0.3 },

  // Decor
  decorRect: { position: 'absolute', top: '10%', right: '-5%', width: 80, height: 80, borderRadius: 22, borderWidth: 1, borderColor: B.w06, transform: [{ rotate: '15deg' }] },
  decorCircle: { position: 'absolute', bottom: '24%', left: '-4%', width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: B.w06 },

  // Glass Card
  cardWrapper: { width: '100%', maxWidth: 280, marginBottom: 32 },
  glassCard: { backgroundColor: B.w04, borderWidth: 1, borderColor: B.w08, borderRadius: 18, padding: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardLogo: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  cardLogoText: { ...typography.overline, letterSpacing: 0.5 },
  cardTitle: { ...typography.overline, color: B.w95 },
  cardTitleSub: { ...typography.overline, color: B.w50, marginTop: 1 },
  cardBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  cardBadgeText: { ...typography.overline },

  // Floating Badges
  fBadge: { position: 'absolute', backgroundColor: 'rgba(11,17,32,0.88)', borderWidth: 1, borderRadius: 12, paddingVertical: 7, paddingHorizontal: 11 },
  fBadge1: { top: -10, right: -8 },
  fBadge2: { bottom: -6, left: -6 },
  fBadgeVal: { ...typography.labelLg, lineHeight: 18 },
  fBadgeLbl: { ...typography.overline, color: B.w50, marginTop: 1 },

  // Tag
  tag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, borderWidth: 1, marginBottom: 20, gap: 7 },
  tagDot: { width: 5, height: 5, borderRadius: 3 },
  tagText: { ...typography.overline, textTransform: 'uppercase', letterSpacing: 1.2 },

  // Title
  title: { ...typography.h1, color: B.w95, textAlign: 'center', lineHeight: 36, marginBottom: 12, letterSpacing: -0.5 },
  subtitle: { ...typography.bodySm, color: B.w50, textAlign: 'center', lineHeight: 22, maxWidth: 300 },

  // Bottom
  bottom: { paddingHorizontal: 28, paddingBottom: 42, alignItems: 'center', backgroundColor: B.navy },
  dotsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 7 },
  dot: { height: 5, borderRadius: 3 },
  cta: { width: '100%', height: 54, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  ctaText: { ...typography.h4, color: colors.neutral0, letterSpacing: 0.2 },
  skipBelowReserved: { height: 40, justifyContent: 'center', alignItems: 'center' },
  skipBelow: { paddingVertical: 6 },
  skipBelowText: { ...typography.bodySm, color: B.w30 },
});

export default OnboardingScreen;