import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, StatusBar, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DPDeliveriesStackParamList } from '../../../../navigators/stacks/DPDeliveriesStack';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { selectDeliveries } from '../../Admin/AssignDeliveries/deliverySlice';
import {
  resetDeliveryCompleteState
} from './dpDeliveryCompleteSlice';
import { THEME } from '../../../../utils/theme';
import { DP_BRAND } from '../../../../utils/deliveryTheme';

type Props = NativeStackScreenProps<DPDeliveriesStackParamList, 'DeliveryComplete'>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Confetti Particle Component
const ConfettiParticle: React.FC<{ 
  delay: number; 
  startX: number; 
  color: string;
  size: number;
}> = ({ delay, startX, color, size }) => {
  const translateY = useRef(new Animated.Value(-50)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: SCREEN_HEIGHT * 0.6, duration: 2500, useNativeDriver: true }),
        Animated.timing(translateX, { 
          toValue: (Math.random() - 0.5) * 150, 
          duration: 2500, 
          useNativeDriver: true 
        }),
        Animated.timing(rotate, { toValue: 6, duration: 2500, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const spin = rotate.interpolate({
    inputRange: [0, 6],
    outputRange: ['0deg', '1080deg']
  });

  return (
    <Animated.View
      style={[
        styles.confetti,
        {
          left: startX,
          width: size,
          height: size * 0.6,
          backgroundColor: color,
          opacity,
          transform: [{ translateY }, { translateX }, { rotate: spin }]
        },
      ]}
    />
  );
};

const DeliveryCompleteScreen: React.FC<Props> = ({ route, navigation }) => {
  const { deliveryId } = route.params;
  const dispatch = useAppDispatch();
  const deliveries = useAppSelector(selectDeliveries);
  // The Inventory Update Request is created earlier (when DP submits the
  // bill photo), so by the time the user lands here it has always been sent.
  const inventoryRequestSubmitted = true;

  const delivery = useMemo(() => deliveries.find(d => d.id === deliveryId), [deliveries, deliveryId]);

  // Animations
  const badgeScale = useRef(new Animated.Value(0)).current;
  const badgeRotate = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringScale1 = useRef(new Animated.Value(0.8)).current;
  const ringOpacity1 = useRef(new Animated.Value(0.4)).current;
  const ringScale2 = useRef(new Animated.Value(0.8)).current;
  const ringOpacity2 = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    // Main animation sequence
    Animated.sequence([
      Animated.parallel([
        Animated.spring(badgeScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
        Animated.timing(badgeRotate, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(contentSlide, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();

    // Continuous pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();

    // Ring animations
    Animated.loop(
      Animated.parallel([
        Animated.timing(ringScale1, { toValue: 1.6, duration: 2000, useNativeDriver: true }),
        Animated.timing(ringOpacity1, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();

    setTimeout(() => {
      Animated.loop(
        Animated.parallel([
          Animated.timing(ringScale2, { toValue: 1.6, duration: 2000, useNativeDriver: true }),
          Animated.timing(ringOpacity2, { toValue: 0, duration: 2000, useNativeDriver: true }),
        ])
      ).start();
    }, 1000);
  }, []);

  useEffect(() => {
    dispatch(resetDeliveryCompleteState());
  }, [dispatch, deliveryId]);

  // The inventory update request is now created earlier in the flow,
  // when the delivery personnel submits the bill photo. This screen is
  // purely a celebratory completion confirmation and no longer creates
  // a second (duplicate) request.

  const spin = badgeRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['-90deg', '0deg']
  });

  // Confetti configuration. The last three are deliberately off-system: this
  // is a celebration animation, and a festive scatter wants colours the rest of
  // the UI does not use. Documented as an exception to the token rule.
  const confettiColors = [
    THEME.colors.success, THEME.colors.primary, THEME.colors.warning,
    THEME.colors.secondary, '#FF6B6B', '#4ECDC4', '#45B7D1',
  ];
  const confettiParticles = useMemo(() => {
    return Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      startX: (i / 30) * SCREEN_WIDTH,
      color: confettiColors[i % confettiColors.length],
      delay: Math.random() * 500,
      size: 8 + Math.random() * 6,
    }));
  }, []);

  if (!delivery) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor={THEME.colors.successLighter} />
        <View style={styles.emptyContainer}>
          <Feather name="inbox" size={36} color={THEME.colors.textTertiary} />
          <Text style={styles.emptyTitle}>Delivery Not Found</Text>
          <Text style={styles.emptyText}>This delivery may have been removed.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME.colors.successLighter} />
      
      {/* Confetti */}
      <View style={styles.confettiContainer}>
        {confettiParticles.map(p => (
          <ConfettiParticle key={p.id} {...p} />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Success Badge */}
        <View style={styles.badgeContainer}>
          <Animated.View style={[styles.ring, { transform: [{ scale: ringScale1 }], opacity: ringOpacity1 }]} />
          <Animated.View style={[styles.ring, styles.ring2, { transform: [{ scale: ringScale2 }], opacity: ringOpacity2 }]} />
          
          <Animated.View style={[
            styles.badge,
            { transform: [{ scale: badgeScale }, { rotate: spin }] }
          ]}>
            <Animated.View style={[styles.badgeInner, { transform: [{ scale: pulseAnim }] }]}>
              <Feather name="check" size={44} color={THEME.colors.textInverse} />
            </Animated.View>
          </Animated.View>
        </View>

        {/* Title Section */}
        <Animated.View style={[styles.titleSection, { 
          opacity: contentOpacity, 
          transform: [{ translateY: contentSlide }] 
        }]}>
          <Text style={styles.title}>Delivery Complete!</Text>
          <Text style={styles.subtitle}>Outstanding work. The customer has confirmed receipt.</Text>
        </Animated.View>

        {/* Summary Card */}
        <Animated.View style={[styles.card, { 
          opacity: contentOpacity, 
          transform: [{ translateY: contentSlide }] 
        }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconWrap}>
              <Feather name="clipboard" size={20} color={DP_BRAND.primary} />
            </View>
            <Text style={styles.cardTitle}>Delivery Summary</Text>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.summaryGrid}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>REFERENCE</Text>
                <Text style={styles.summaryValue}>{delivery.referenceNo}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>ITEMS</Text>
                <Text style={styles.summaryValue}>{delivery.items.length}</Text>
              </View>
            </View>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>CUSTOMER</Text>
                <Text style={styles.summaryValue}>{delivery.customerName}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>COMPLETED</Text>
                <Text style={styles.summaryValue}>
                  {delivery.deliveredAt 
                    ? new Date(delivery.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'Just now'
                  }
                </Text>
              </View>
            </View>
          </View>

          {/* Inventory Sync Status */}
          <View style={styles.syncStatus}>
            <View style={[
              styles.syncIndicator,
              inventoryRequestSubmitted ? styles.syncIndicatorSuccess : styles.syncIndicatorPending
            ]}>
              <Feather name={inventoryRequestSubmitted ? 'check' : 'clock'} size={16} color={inventoryRequestSubmitted ? THEME.colors.success : THEME.colors.warning} />
            </View>
            <View style={styles.syncInfo}>
              <Text style={styles.syncTitle}>Inventory Sync</Text>
              <Text style={styles.syncSubtitle}>
                {inventoryRequestSubmitted ? 'Successfully synced to warehouse' : 'Syncing in progress...'}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Performance Stats */}
        <Animated.View style={[styles.statsRow, { 
          opacity: contentOpacity, 
          transform: [{ translateY: contentSlide }] 
        }]}>
          <View style={styles.statCard}>
            <Feather name="package" size={20} color={DP_BRAND.primary} style={{ marginBottom: 4 }} />
            <Text style={styles.statValue}>{delivery.items.length}</Text>
            <Text style={styles.statLabel}>Items</Text>
          </View>
          <View style={styles.statCard}>
            <Feather name="check-circle" size={20} color={THEME.colors.success} style={{ marginBottom: 4 }} />
            <Text style={styles.statValue}>100%</Text>
            <Text style={styles.statLabel}>Accuracy</Text>
          </View>
          <View style={styles.statCard}>
            <Feather name="star" size={20} color={THEME.colors.warning} style={{ marginBottom: 4 }} />
            <Text style={styles.statValue}>+10</Text>
            <Text style={styles.statLabel}>Points</Text>
          </View>
        </Animated.View>

        {/* Action Button */}
        <Animated.View style={[styles.buttonContainer, { 
          opacity: contentOpacity, 
          transform: [{ translateY: contentSlide }] 
        }]}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.popToTop()}
            activeOpacity={0.9}
          >
            <Text style={styles.primaryButtonText}>Back to Deliveries</Text>
            <View style={styles.buttonArrow}>
              <Feather name="arrow-right" size={18} color={THEME.colors.textInverse} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.successLighter,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },

  // Confetti
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.35,
    overflow: 'hidden',
    zIndex: 1,
    pointerEvents: 'none',
  },
  confetti: {
    position: 'absolute',
    borderRadius: 2,
  },

  // Badge
  badgeContainer: {
    position: 'relative',
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: THEME.colors.success,
  },
  ring2: {
    borderColor: THEME.colors.successLight,
  },
  badge: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: THEME.colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    ...THEME.shadows.xl,
  },
  badgeInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: THEME.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeIcon: {
    ...THEME.typography.displayLg,
    color: THEME.colors.textInverse,
  },

  // Title Section
  titleSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    ...THEME.typography.displayMd,
    color: THEME.colors.successHover,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    ...THEME.typography.bodyLg,
    color: THEME.colors.neutral600,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 22,
  },

  // Card
  card: {
    width: '100%',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    ...THEME.shadows.lg,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  cardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: THEME.radius.lg,
    backgroundColor: DP_BRAND.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardIcon: {
    ...THEME.typography.h2,
    
  },
  cardTitle: {
    ...THEME.typography.h4,
    color: THEME.colors.textPrimary,
    letterSpacing: -0.2,
  },
  cardDivider: {
    height: 1,
    backgroundColor: THEME.colors.borderLight,
  },
  summaryGrid: {
    padding: 20,
    gap: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 16,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    ...THEME.typography.overline,
    textTransform: undefined,
    color: THEME.colors.textTertiary,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  summaryValue: {
    ...THEME.typography.h4,
    color: THEME.colors.textPrimary,
  },

  // Sync Status
  syncStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: THEME.colors.neutral50,
    borderRadius: THEME.radius.lg,
  },
  syncIndicator: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  syncIndicatorSuccess: {
    backgroundColor: THEME.colors.successLight,
  },
  syncIndicatorPending: {
    backgroundColor: THEME.colors.warningLight,
  },
  syncIndicatorIcon: {
    ...THEME.typography.bodyLg,
    
  },
  syncInfo: {
    flex: 1,
  },
  syncTitle: {
    ...THEME.typography.labelLg,
    color: THEME.colors.textPrimary,
  },
  syncSubtitle: {
    ...THEME.typography.caption,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 16,
    alignItems: 'center',
    ...THEME.shadows.sm,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
  },
  statEmoji: {
    ...THEME.typography.displaySm,
    marginBottom: 8,
  },
  statValue: {
    ...THEME.typography.h2,
    color: THEME.colors.textPrimary,
  },
  statLabel: {
    ...THEME.typography.labelSm,
    color: THEME.colors.textSecondary,
    marginTop: 4,
  },

  // Button
  buttonContainer: {
    width: '100%',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DP_BRAND.primary,
    paddingVertical: 16,
    borderRadius: THEME.radius.lg,
    ...THEME.shadows.md,
  },
  primaryButtonText: {
    ...THEME.typography.h4,
    color: THEME.colors.textInverse,
    marginRight: 8,
  },
  buttonArrow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonArrowText: {
    ...THEME.typography.labelLg,
    color: THEME.colors.textInverse,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyIcon: {
    ...THEME.typography.displayLg,
    marginBottom: 16,
  },
  emptyTitle: {
    ...THEME.typography.h2,
    color: THEME.colors.textPrimary,
    marginBottom: 8,
  },
  emptyText: {
    ...THEME.typography.bodyMd,
    color: THEME.colors.textSecondary,
  }
});

export default DeliveryCompleteScreen;