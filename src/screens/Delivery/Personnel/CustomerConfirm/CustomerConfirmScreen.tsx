import React, { useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Animated,
  ScrollView,
  Dimensions,
  StatusBar
} from 'react-native';
import { Alert } from '../../../../utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { THEME } from '../../../../utils/theme';
import { formatCurrency } from '../../../../utils/formatters';
import { DP_BRAND } from '../../../../utils/deliveryTheme';
import { Feather } from '@expo/vector-icons';
import type { DPDeliveriesStackParamList } from '../../../../navigators/stacks/DPDeliveriesStack';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { selectDeliveries } from '../../Admin/AssignDeliveries/deliverySlice';
import {
  selectIssueModalVisible,
  selectIssueText,
  setIssueModalVisible,
  setIssueText,
  resetCustomerConfirmState,
  confirmReceipt,
  reportIssue
} from './dpCustomerConfirmSlice';
import AppLogo from '../../../../Custom-Components/AppLogo';

type Props = NativeStackScreenProps<DPDeliveriesStackParamList, 'CustomerConfirm'>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const COMPANY_NAME = 'FinMatrix';

// Icon Components for Professional Look
const CheckIcon = ({ size = 32, color = THEME.colors.neutral0 }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <Feather name="check" size={size * 0.7} color={color} />
  </View>
);

const DocumentIcon = () => (
  <View style={styles.iconContainer}>
    <View style={styles.iconDoc}>
      <View style={styles.iconDocLine} />
      <View style={[styles.iconDocLine, { width: 12 }]} />
      <View style={[styles.iconDocLine, { width: 8 }]} />
    </View>
  </View>
);

const SignatureIcon = () => (
  <View style={[styles.iconContainer, { backgroundColor: THEME.colors.warningLight }]}>
    <Feather name="edit-3" size={18} color={THEME.colors.warning} />
  </View>
);

const AlertIcon = () => (
  <View style={[styles.iconContainer, { backgroundColor: THEME.colors.dangerLight }]}>
    <Text style={[THEME.typography.h3, { color: THEME.colors.danger }]}>!</Text>
  </View>
);

const CustomerConfirmScreen: React.FC<Props> = ({ route, navigation }) => {
  const { deliveryId } = route.params;
  const dispatch = useAppDispatch();
  const deliveries = useAppSelector(selectDeliveries);
  const issueModalVisible = useAppSelector(selectIssueModalVisible);
  const issueText = useAppSelector(selectIssueText);

  const delivery = useMemo(() => deliveries.find(d => d.id === deliveryId), [deliveries, deliveryId]);

  // Animations
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslate = useRef(new Animated.Value(40)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringScale = useRef(new Animated.Value(0.8)).current;
  const ringOpacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    // Success badge animation
    Animated.sequence([
      Animated.parallel([
        Animated.spring(successScale, {
          toValue: 1,
          friction: 5,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(successOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(contentTranslate, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();

    // Ring animation
    Animated.loop(
      Animated.parallel([
        Animated.timing(ringScale, { toValue: 1.4, duration: 2000, useNativeDriver: true }),
        Animated.timing(ringOpacity, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  if (!delivery) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor={THEME.colors.background} />
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <Feather name="inbox" size={28} color={THEME.colors.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>Delivery Not Found</Text>
          <Text style={styles.emptySubtitle}>This delivery may have been removed or updated.</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={() => navigation.goBack()}>
            <Text style={styles.emptyButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleConfirm = async () => {
    try {
      // Await the backend confirmation; only advance once it actually persists
      // the "delivered" status (previously this navigated regardless, so a
      // failed confirmation silently left the delivery in its old status).
      await dispatch(confirmReceipt({ deliveryId, verifiedBy: delivery.customerName })).unwrap();
      dispatch(resetCustomerConfirmState());
      navigation.replace('DeliveryComplete', { deliveryId });
    } catch (e: any) {
      Alert.alert('Could not complete delivery', e?.message || 'Please try again.');
    }
  };

  const handleIssue = async () => {
    if (!issueText.trim()) {
      Alert.alert('Required Field', 'Please describe the issue before submitting.');
      return;
    }
    // This call used to be fired and forgotten, and it 400'd every time — the
    // customer was told their concern was recorded when nothing was.
    try {
      await dispatch(reportIssue({ deliveryId, note: issueText.trim() })).unwrap();
      Alert.alert(
        'Issue Reported',
        'Your concern has been recorded. Our support team will review it shortly.',
        [{ text: 'OK' }],
      );
    } catch (e: any) {
      Alert.alert('Could not report', e?.message ?? 'The issue was not submitted. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME.colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <AppLogo size="sm" />
          <View style={styles.headerBadge}>
            <View style={styles.headerBadgeDot} />
            <Text style={styles.headerBadgeText}>Delivery Confirmation</Text>
          </View>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Success Badge */}
        <View style={styles.successSection}>
          <View style={styles.successBadgeContainer}>
            <Animated.View style={[styles.successRing, { 
              transform: [{ scale: ringScale }],
              opacity: ringOpacity 
            }]} />
            <Animated.View style={[styles.successBadge, { 
              transform: [{ scale: successScale }],
              opacity: successOpacity 
            }]}>
              <Animated.View style={[styles.successInner, { transform: [{ scale: pulseAnim }] }]}>
                <CheckIcon size={44} />
              </Animated.View>
            </Animated.View>
          </View>

          <Animated.View style={[styles.titleSection, { 
            opacity: contentOpacity,
            transform: [{ translateY: contentTranslate }]
          }]}>
            <Text style={styles.successTitle}>Delivery Arrived</Text>
            <Text style={styles.successSubtitle}>
              Hello <Text style={styles.customerHighlight}>{delivery.customerName}</Text>,
            </Text>
            <Text style={styles.successDescription}>
              Please review and confirm your delivery from {COMPANY_NAME}
            </Text>
          </Animated.View>
        </View>

        {/* Delivery Details Card */}
        <Animated.View style={[styles.card, { 
          opacity: contentOpacity,
          transform: [{ translateY: contentTranslate }]
        }]}>
          <View style={styles.cardHeader}>
            <DocumentIcon />
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Delivery Details</Text>
              <Text style={styles.cardSubtitle}>Order information</Text>
            </View>
            <View style={styles.statusChip}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>{delivery.status.replace('_', ' ')}</Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.detailsGrid}>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>REFERENCE NO.</Text>
                <Text style={styles.detailValue}>{delivery.referenceNo}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>ITEMS</Text>
                <Text style={styles.detailValue}>{delivery.items.length} item{delivery.items.length !== 1 ? 's' : ''}</Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <View style={[styles.detailItem, { flex: 1 }]}>
                <Text style={styles.detailLabel}>DELIVERY ADDRESS</Text>
                <Text style={styles.detailValue}>{delivery.address ?? delivery.zone}</Text>
              </View>
            </View>
          </View>

          {/* Items Preview */}
          <View style={styles.itemsPreview}>
            <Text style={styles.itemsPreviewTitle}>Package Contents</Text>
            <View style={styles.itemsList}>
              {delivery.items.slice(0, 3).map((item, idx) => (
                <View key={item.itemId} style={styles.itemRow}>
                  <View style={styles.itemBullet}>
                    <Text style={styles.itemBulletText}>{idx + 1}</Text>
                  </View>
                  <Text style={styles.itemName}>{item.itemName}</Text>
                  <Text style={styles.itemQty}>×{item.quantity}</Text>
                </View>
              ))}
              {delivery.items.length > 3 && (
                <Text style={styles.moreItems}>+{delivery.items.length - 3} more items</Text>
              )}
            </View>
          </View>
        </Animated.View>

        {/* Pre-paid notice — sits directly above the signature card because
            this is the moment the rider faces the customer with the bill, and
            the one moment they might otherwise ask for money on an order that
            is already settled. */}
        {delivery.prepaid ? (
          // Deliberately not animated like the cards around it: this is the
          // one instruction that must not arrive late, and a plain View keeps
          // it out of the file's read-refs-during-render animation pattern.
          <View style={styles.prepaidBanner}>
            <Feather name="check-circle" size={18} color={THEME.colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.prepaidBannerTitle}>Pre-paid order</Text>
              <Text style={styles.prepaidBannerBody}>
                Already settled — do not collect cash.
              </Text>
            </View>
          </View>
        ) : (delivery.advanceAmount ?? 0) > 0 ? (
          // Part paid before dispatch: the rider collects only the balance,
          // and asking for the full order would charge the customer twice.
          <View style={styles.prepaidBanner}>
            <Feather name="info" size={18} color={THEME.colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.prepaidBannerTitle}>
                {formatCurrency(delivery.advanceAmount ?? 0)} paid in advance
              </Text>
              <Text style={styles.prepaidBannerBody}>
                Collect only the balance — the bill photo step shows the exact amount.
              </Text>
            </View>
          </View>
        ) : null}

        {/* Signature Card */}
        <Animated.View style={[styles.card, {
          opacity: contentOpacity,
          transform: [{ translateY: contentTranslate }]
        }]}>
          <View style={styles.cardHeader}>
            <SignatureIcon />
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Signature Verification</Text>
              <Text style={styles.cardSubtitle}>Proof of delivery</Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.signatureBox}>
            {delivery.signatureBase64 ? (
              <View style={styles.signatureVerified}>
                <View style={styles.signatureCheckWrap}>
                  <CheckIcon size={20} color={THEME.colors.success} />
                </View>
                <View>
                  <Text style={styles.signatureVerifiedTitle}>Signature Captured</Text>
                  <Text style={styles.signatureVerifiedSub}>Digital signature on file</Text>
                </View>
              </View>
            ) : (
              <View style={styles.signaturePending}>
                <View style={styles.signaturePendingIcon}>
                  <Text style={styles.signaturePendingIconText}>—</Text>
                </View>
                <Text style={styles.signaturePendingText}>No signature on file</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View style={[styles.actionsSection, { 
          opacity: contentOpacity,
          transform: [{ translateY: contentTranslate }]
        }]}>
          <TouchableOpacity 
            style={styles.confirmButton}
            onPress={handleConfirm}
            activeOpacity={0.9}
          >
            <View style={styles.confirmButtonInner}>
              <View style={styles.confirmIconWrap}>
                <CheckIcon size={20} />
              </View>
              <Text style={styles.confirmButtonText}>Confirm Receipt of All Items</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.issueButton}
            onPress={() => dispatch(setIssueModalVisible(true))}
            activeOpacity={0.7}
          >
            <Feather name="alert-triangle" size={18} color={THEME.colors.danger} />
            <Text style={styles.issueButtonText}>Report an Issue</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By confirming, you acknowledge receipt of all items listed above.
          </Text>
        </View>
      </ScrollView>

      {/* Issue Modal */}
      <Modal 
        visible={issueModalVisible} 
        transparent 
        animationType="fade"
        onRequestClose={() => dispatch(setIssueModalVisible(false))}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <AlertIcon />
                <View style={styles.modalHeaderText}>
                  <Text style={styles.modalTitle}>Report an Issue</Text>
                  <Text style={styles.modalSubtitle}>Describe what went wrong</Text>
                </View>
                <TouchableOpacity 
                  style={styles.modalCloseBtn}
                  onPress={() => dispatch(setIssueModalVisible(false))}
                >
                  <Feather name="x" size={18} color={THEME.colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalDivider} />

              {/* Modal Body */}
              <View style={styles.modalBody}>
                <Text style={styles.inputLabel}>Issue Description</Text>
                <View style={styles.textInputContainer}>
                  <TextInput
                    style={styles.textInput}
                    value={issueText}
                    onChangeText={text => dispatch(setIssueText(text))}
                    placeholder="Please describe the issue in detail..."
                    placeholderTextColor={THEME.colors.neutral400}
                    multiline
                    textAlignVertical="top"
                    maxLength={500}
                  />
                </View>
                <View style={styles.inputFooter}>
                  <Text style={styles.inputHint}>Be as specific as possible</Text>
                  <Text style={styles.charCount}>{issueText.length}/500</Text>
                </View>
              </View>

              {/* Modal Actions */}
              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={styles.modalCancelBtn}
                  onPress={() => dispatch(setIssueModalVisible(false))}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalSubmitBtn, !issueText.trim() && styles.modalSubmitBtnDisabled]}
                  onPress={handleIssue}
                  disabled={!issueText.trim()}
                >
                  <Text style={styles.modalSubmitBtnText}>Submit Report</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background
  },

  // Header
  header: {
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.neutral200,
    ...THEME.shadows.sm
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.successLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.full
  },
  headerBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.success,
    marginRight: 8
  },
  headerBadgeText: {
    ...THEME.typography.labelSm,
    color: THEME.colors.success,
    letterSpacing: 0.2
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40
  },

  // Success Section
  successSection: {
    alignItems: 'center',
    paddingVertical: 32
  },
  successBadgeContainer: {
    position: 'relative',
    marginBottom: 24
  },
  successRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: THEME.colors.success,
    top: -10,
    left: -10
  },
  successBadge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: THEME.colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    ...THEME.shadows.lg
  },
  successInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: THEME.colors.success,
    alignItems: 'center',
    justifyContent: 'center'
  },
  titleSection: {
    alignItems: 'center'
  },
  successTitle: {
    ...THEME.typography.displayMd,
    color: THEME.colors.neutral900,
    marginBottom: 8,
    letterSpacing: -0.5
  },
  successSubtitle: {
    ...THEME.typography.bodyLg,
    color: THEME.colors.neutral600,
    marginBottom: 4
  },
  customerHighlight: {
    fontWeight: THEME.typography.labelMd.fontWeight,
    color: THEME.colors.neutral900
  },
  successDescription: {
    ...THEME.typography.bodyMd,
    color: THEME.colors.neutral500,
    textAlign: 'center',
    maxWidth: 280
  },

  // Cards
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    marginBottom: 16,
    ...THEME.shadows.md,
    borderWidth: 1,
    borderColor: THEME.colors.neutral100
  },
  prepaidBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: `${THEME.colors.success}12`,
    borderWidth: 1,
    borderColor: `${THEME.colors.success}55`,
    borderRadius: THEME.radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16
  },
  prepaidBannerTitle: {
    ...THEME.typography.labelLg,
    color: THEME.colors.success
  },
  prepaidBannerBody: {
    ...THEME.typography.caption,
    color: THEME.colors.textSecondary,
    marginTop: 1
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: THEME.radius.lg,
    backgroundColor: DP_BRAND.primarySoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconDoc: {
    width: 20,
    height: 24,
    backgroundColor: DP_BRAND.primary,
    borderRadius: 3,
    padding: 4,
    justifyContent: 'center',
    gap: 3
  },
  iconDocLine: {
    height: 2,
    width: 10,
    backgroundColor: THEME.colors.surface,
    borderRadius: 1
  },
  cardHeaderText: {
    flex: 1,
    marginLeft: 14
  },
  cardTitle: {
    ...THEME.typography.h4,
    color: THEME.colors.neutral900,
    letterSpacing: -0.2
  },
  cardSubtitle: {
    ...THEME.typography.bodySm,
    color: THEME.colors.neutral500,
    marginTop: 2
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.successLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.radius.full
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.success,
    marginRight: 6
  },
  statusText: {
    ...THEME.typography.labelSm,
    color: THEME.colors.success,
    textTransform: 'capitalize'
  },
  cardDivider: {
    height: 1,
    backgroundColor: THEME.colors.neutral100
  },

  // Details Grid
  detailsGrid: {
    padding: 20,
    gap: 16
  },
  detailRow: {
    flexDirection: 'row',
    gap: 16
  },
  detailItem: {
    flex: 1
  },
  detailLabel: {
    ...THEME.typography.overline,
    textTransform: undefined,
    color: THEME.colors.neutral400,
    letterSpacing: 0.8,
    marginBottom: 6
  },
  detailValue: {
    ...THEME.typography.h4,
    color: THEME.colors.neutral900,
    lineHeight: 20
  },

  // Items Preview
  itemsPreview: {
    backgroundColor: THEME.colors.neutral50,
    padding: 16,
    margin: 16,
    marginTop: 0,
    borderRadius: THEME.radius.lg
  },
  itemsPreviewTitle: {
    ...THEME.typography.labelMd,
    color: THEME.colors.neutral500,
    letterSpacing: 0.3,
    marginBottom: 12
  },
  itemsList: {
    gap: 10
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  itemBullet: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: DP_BRAND.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  itemBulletText: {
    ...THEME.typography.overline,
    textTransform: undefined,
    color: THEME.colors.surface
  },
  itemName: {
    flex: 1,
    ...THEME.typography.bodyMd,
    color: THEME.colors.neutral800
  },
  itemQty: {
    ...THEME.typography.labelLg,
    color: THEME.colors.neutral600
  },
  moreItems: {
    ...THEME.typography.bodySm,
    color: DP_BRAND.primary,
    marginTop: 4,
    marginLeft: 32
  },

  // Signature Box
  signatureBox: {
    padding: 20
  },
  signatureVerified: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.successLight,
    padding: 16,
    borderRadius: THEME.radius.lg
  },
  signatureCheckWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14
  },
  signatureVerifiedTitle: {
    ...THEME.typography.labelLg,
    color: THEME.colors.successHover
  },
  signatureVerifiedSub: {
    ...THEME.typography.caption,
    color: THEME.colors.success,
    marginTop: 2
  },
  signaturePending: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: THEME.colors.neutral50,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.neutral200,
    borderStyle: 'dashed'
  },
  signaturePendingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.neutral200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  signaturePendingIconText: {
    ...THEME.typography.h2,
    color: THEME.colors.neutral400
  },
  signaturePendingText: {
    ...THEME.typography.bodySm,
    color: THEME.colors.neutral500
  },

  // Actions Section
  actionsSection: {
    paddingTop: 8,
    gap: 12
  },
  confirmButton: {
    borderRadius: THEME.radius.lg,
    overflow: 'hidden',
    ...THEME.shadows.lg
  },
  confirmButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.success,
    paddingVertical: 18,
    paddingHorizontal: 24
  },
  confirmIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  confirmButtonText: {
    ...THEME.typography.h4,
    color: THEME.colors.surface,
    letterSpacing: 0.2
  },
  issueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: THEME.radius.lg,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.neutral200
  },
  issueButtonIcon: {
    ...THEME.typography.bodyLg,
    marginRight: 8
  },
  issueButtonText: {
    ...THEME.typography.labelLg,
    color: THEME.colors.danger
  },

  // Footer
  footer: {
    paddingVertical: 24,
    alignItems: 'center'
  },
  footerText: {
    ...THEME.typography.caption,
    color: THEME.colors.neutral400,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: THEME.colors.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24
  },
  emptyIcon: {
    ...THEME.typography.displayLg
  },
  emptyTitle: {
    ...THEME.typography.h2,
    color: THEME.colors.neutral900,
    marginBottom: 8
  },
  emptySubtitle: {
    ...THEME.typography.bodyMd,
    color: THEME.colors.neutral500,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20
  },
  emptyButton: {
    backgroundColor: DP_BRAND.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: THEME.radius.lg,
    ...THEME.shadows.md
  },
  emptyButtonText: {
    ...THEME.typography.labelLg,
    color: THEME.colors.surface
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: THEME.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400
  },
  modalContent: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    ...THEME.shadows.xl
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20
  },
  modalHeaderText: {
    flex: 1,
    marginLeft: 14
  },
  modalTitle: {
    ...THEME.typography.h3,
    color: THEME.colors.neutral900
  },
  modalSubtitle: {
    ...THEME.typography.bodySm,
    color: THEME.colors.neutral500,
    marginTop: 2
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.neutral100,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalCloseBtnText: {
    ...THEME.typography.bodyLg,
    color: THEME.colors.neutral600
  },
  modalDivider: {
    height: 1,
    backgroundColor: THEME.colors.neutral100
  },
  modalBody: {
    padding: 20
  },
  inputLabel: {
    ...THEME.typography.labelMd,
    color: THEME.colors.neutral600,
    letterSpacing: 0.3,
    marginBottom: 10
  },
  textInputContainer: {
    borderWidth: 1,
    borderColor: THEME.colors.neutral200,
    borderRadius: THEME.radius.lg,
    backgroundColor: THEME.colors.neutral50
  },
  textInput: {
    ...THEME.typography.bodyLg,
    minHeight: 120,
    padding: 16,
    color: THEME.colors.neutral900,
    lineHeight: 22
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10
  },
  inputHint: {
    ...THEME.typography.caption,
    color: THEME.colors.neutral400
  },
  charCount: {
    ...THEME.typography.labelSm,
    color: THEME.colors.neutral400
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 0,
    gap: 12
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: THEME.radius.lg,
    backgroundColor: THEME.colors.neutral100,
    alignItems: 'center'
  },
  modalCancelBtnText: {
    ...THEME.typography.labelLg,
    color: THEME.colors.neutral700
  },
  modalSubmitBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: THEME.radius.lg,
    backgroundColor: THEME.colors.danger,
    alignItems: 'center'
  },
  modalSubmitBtnDisabled: {
    backgroundColor: THEME.colors.neutral300
  },
  modalSubmitBtnText: {
    ...THEME.typography.labelLg,
    color: THEME.colors.surface
  },
});

export default CustomerConfirmScreen;
