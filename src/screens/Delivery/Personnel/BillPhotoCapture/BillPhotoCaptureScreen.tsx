import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Alert } from '../../../../utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DPDeliveriesStackParamList } from '../../../../navigators/stacks/DPDeliveriesStack';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { selectDeliveries, selectDeliveryPersonnel } from '../../Admin/AssignDeliveries/deliverySlice';
import { selectInventoryApprovalRequests } from '../../Admin/InventoryApproval/inventoryApprovalSlice';
import { selectUser } from '../../../Auth/authSlice';
import {
  resetBillPhotoState,
  setBillPhoto,
  clearBillPhoto,
  setSignedBy,
  setNote,
  setPaidStatus,
  setAmountCollected,
  setReturnedQty,
  submitBillPhoto,
  selectBillPhotoUri,
  selectBillPhotoSource,
  selectBillPhotoSignedBy,
  selectBillPhotoNote,
  selectBillPhotoPaidStatus,
  selectBillPhotoAmountCollected,
  selectBillPhotoReturnedQtys,
  selectBillPhotoIsSubmitting
} from './dpBillPhotoCaptureSlice';
import { THEME } from '../../../../utils/theme';
import { formatCurrency } from '../../../../utils/formatters';
import { doorAmounts, partialAmountError } from '../../../../utils/deliveryCollection';
import { DP_BRAND } from '../../../../utils/deliveryTheme';

type Props = NativeStackScreenProps<DPDeliveriesStackParamList, 'BillPhotoCapture'>;

const BillPhotoCaptureScreen: React.FC<Props> = ({ navigation, route }) => {
  const { deliveryId } = route.params;
  const dispatch = useAppDispatch();

  const deliveries = useAppSelector(selectDeliveries);
  const personnel = useAppSelector(selectDeliveryPersonnel);
  const approvalRequests = useAppSelector(selectInventoryApprovalRequests);
  const user = useAppSelector(selectUser);
  const photoUri = useAppSelector(selectBillPhotoUri);
  const photoSource = useAppSelector(selectBillPhotoSource);
  const signedBy = useAppSelector(selectBillPhotoSignedBy);
  const note = useAppSelector(selectBillPhotoNote);
  const paidStatus = useAppSelector(selectBillPhotoPaidStatus);
  const amountCollectedText = useAppSelector(selectBillPhotoAmountCollected);
  const returnedQtys = useAppSelector(selectBillPhotoReturnedQtys);
  const isSubmitting = useAppSelector(selectBillPhotoIsSubmitting);

  const delivery = useMemo(
    () => deliveries.find(d => d.id === deliveryId),
    [deliveries, deliveryId],
  );
  const dp = useMemo(
    () => personnel.find(p => p.userId === delivery?.assignedTo),
    [personnel, delivery],
  );

  const alreadySubmitted = useMemo(
    () => approvalRequests.some(r => r.deliveryId === deliveryId),
    [approvalRequests, deliveryId],
  );

  // A delivery can't be both "loading" and missing its showSuccess state:
  // hooks must run in the same order on every render, so this lives above
  // the early return below.
  const [showSuccess, setShowSuccess] = useState(false);

  // Per-line delivered/returned split. The rider enters what came BACK; what
  // was delivered is the remainder. Every line used to be hard-coded to
  // "fully delivered, nothing returned", so a customer taking 8 of 10 could
  // not be recorded at all and the admin queue's Returned column was always 0.
  const lines = useMemo(() => {
    return (delivery?.items ?? []).map(item => {
      const dispatched = item.quantity ?? item.orderedQty ?? 0;
      const raw = returnedQtys[item.itemId] ?? '';
      const parsed = raw.trim() === '' ? 0 : Number(raw);
      const valid = Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 0 && parsed <= dispatched;
      const returned = valid ? parsed : 0;
      return {
        itemId: item.itemId,
        itemName: item.itemName,
        dispatched,
        raw,
        valid,
        returnedQty: returned,
        deliveredQty: dispatched - returned,
      };
    });
  }, [delivery?.items, returnedQtys]);

  const invalidLine = lines.find(l => !l.valid);

  /**
   * What is left to collect for the goods the customer is keeping, after any
   * advance. Recomputed as returns are typed, because a returned unit is not
   * paid for. When nothing is due — prepaid in full, or a short delivery the
   * advance still covers — the rider is not asked about payment at all.
   */
  const door = doorAmounts(
    lines.map(l => {
      const item = delivery?.items?.find(i => i.itemId === l.itemId);
      return { deliveredQty: l.deliveredQty, unitPrice: item?.unitPrice ?? 0, taxRate: item?.taxRate ?? 0 };
    }),
    { advanceAmount: delivery?.advanceAmount, prepaid: delivery?.prepaid },
  );
  const hasAdvance = door.advanceApplied > 0;

  /**
   * The payment status this submission will carry.
   *
   * With nothing due there is no choice on screen, so `paidStatus` stays null.
   * Everything that asks "do we have an answer yet?" — the submit guard, the
   * button's disabled state, the payload — must read THIS, not the raw state,
   * or the button stays greyed out on a form the rider has completed.
   */
  const effectivePaidStatus = door.nothingDue ? 'paid' : paidStatus;
  const partialError =
    effectivePaidStatus === 'partial' ? partialAmountError(amountCollectedText, door.amountDue) : undefined;
  const totalReturned = lines.reduce((sum, l) => sum + l.returnedQty, 0);
  const totalDispatched = lines.reduce((sum, l) => sum + l.dispatched, 0);
  // Nothing accepted at all. The admin should REJECT this rather than approve
  // it — rejection is the path that posts the full reversal and marks the
  // delivery 'returned'. Approving a zero-delivery request invoices nothing
  // but still resolves the delivery as 'delivered', which reads wrong.
  const isFullReturn = totalDispatched > 0 && totalReturned === totalDispatched;

  useEffect(() => {
    dispatch(resetBillPhotoState());
    if (delivery?.customerName) dispatch(setSignedBy(delivery.customerName));
  }, [dispatch, delivery?.customerName]);

  if (!delivery) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={DP_BRAND.primary} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={20} color={DP_BRAND.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Bill Photo</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <Feather name="inbox" size={28} color={THEME.colors.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>Delivery Not Found</Text>
          <Text style={styles.emptySubtitle}>This delivery may have been removed.</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={() => navigation.goBack()}>
            <Text style={styles.emptyButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const ensurePermissions = async (kind: 'camera' | 'gallery'): Promise<boolean> => {
    if (kind === 'camera') {
      const cam = await ImagePicker.requestCameraPermissionsAsync();
      if (!cam.granted) {
        Alert.alert(
          'Camera permission required',
          'Please enable camera access in Settings to capture the signed bill.',
        );
        return false;
      }
      return true;
    }
    const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!lib.granted) {
      Alert.alert(
        'Photo library permission required',
        'Please enable photo library access to choose an image.',
      );
      return false;
    }
    return true;
  };

  const handleTakePhoto = async () => {
    if (!(await ensurePermissions('camera'))) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [3, 4]
    });
    if (!result.canceled && result.assets[0]?.uri) {
      dispatch(setBillPhoto({ uri: result.assets[0].uri, source: 'camera' }));
    }
  };

  const handlePickFromGallery = async () => {
    if (!(await ensurePermissions('gallery'))) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [3, 4]
    });
    if (!result.canceled && result.assets[0]?.uri) {
      dispatch(setBillPhoto({ uri: result.assets[0].uri, source: 'gallery' }));
    }
  };

  const handleSubmit = async () => {
    if (alreadySubmitted) {
      Alert.alert(
        'Already submitted',
        'A bill photo for this delivery has already been sent for admin review.',
      );
      return;
    }
    if (!photoUri) {
      Alert.alert('Photo required', 'Capture or pick a photo of the signed bill.');
      return;
    }
    if (!signedBy.trim()) {
      Alert.alert('Customer name required', 'Enter the name printed on the signed bill.');
      return;
    }
    // With nothing due the question is never asked, so there is nothing to
    // require: the submission carries 'paid', and the server agrees.
    if (!effectivePaidStatus) {
      Alert.alert(
        'Payment status required',
        `Select whether the customer PAID the ${formatCurrency(door.amountDue)}, paid PART of it, or has NOT PAID.`,
      );
      return;
    }
    if (partialError) {
      Alert.alert('Check the amount received', partialError);
      return;
    }
    if (!delivery.assignedTo) {
      Alert.alert('Unassigned delivery', 'This delivery has no assigned personnel.');
      return;
    }
    if (invalidLine) {
      Alert.alert(
        'Check returned quantity',
        `${invalidLine.itemName}: enter a whole number between 0 and ${invalidLine.dispatched}.`,
      );
      return;
    }

    const personnelName = dp?.displayName ?? user?.displayName ?? 'Delivery Personnel';
    const routeLabel = `${delivery.zone} · ${new Date(delivery.scheduledDate).toLocaleDateString()}`;

    try {
      const action = await dispatch(
        submitBillPhoto({
          deliveryId: delivery.id,
          deliveryReference: delivery.referenceNo,
          personnelId: delivery.assignedTo,
          personnelName,
          routeLabel,
          photoUri,
          source: photoSource ?? 'camera',
          signedBy: signedBy.trim(),
          paidStatus: effectivePaidStatus,
          amountCollected:
            effectivePaidStatus === 'partial' ? amountCollectedText.replace(/[,\s]/g, '') : undefined,
          note: note.trim() || undefined,
          // deliveredQty is the field with ledger effect: on approval the
          // backend derives returned as (dispatched - delivered), invoices
          // only the delivered part and restocks the rest. returnedQty is
          // sent alongside so the admin queue shows the rider's own numbers,
          // and the server rejects the pair if they exceed what was dispatched.
          changes: lines.map(line => ({
            itemId: line.itemId,
            itemName: line.itemName,
            beforeQty: line.dispatched,
            deliveredQty: line.deliveredQty,
            returnedQty: line.returnedQty,
          }))
        }),
      );

      if (submitBillPhoto.rejected.match(action)) {
        Alert.alert('Upload failed', action.error?.message ?? 'Could not submit the bill photo.');
        return;
      }

      setShowSuccess(true);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Could not submit the bill photo.');
    }
  };

  const itemsCount = delivery.items?.length ?? 0;

  if (showSuccess) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={DP_BRAND.primary} />
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Bill Photo</Text>
            <Text style={styles.headerSubtitle}>{delivery.referenceNo}</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
        <View style={successStyles.wrapper}>
          <View style={successStyles.card}>
            <View style={successStyles.iconCircle}>
              <Feather name="check-circle" size={48} color={THEME.colors.success} />
            </View>
            <Text style={successStyles.title}>Sent for Admin Review</Text>
            <Text style={successStyles.subtitle}>
              Your bill photo for {delivery.referenceNo} has been submitted successfully.
              The admin will review and approve the inventory changes.
            </Text>
            <View style={successStyles.infoRow}>
              <Feather name="package" size={16} color={THEME.colors.textSecondary} />
              <Text style={successStyles.infoText}>
                {itemsCount} item{itemsCount === 1 ? '' : 's'} sent for review
                {totalReturned > 0 ? ` · ${totalReturned} unit${totalReturned === 1 ? '' : 's'} returned` : ''}
              </Text>
            </View>
            <View style={successStyles.infoRow}>
              <Feather name="clock" size={16} color={THEME.colors.warning} />
              <Text style={successStyles.infoText}>
                Pending admin approval — actual inventory will update once confirmed
              </Text>
            </View>
            <TouchableOpacity
              style={successStyles.continueBtn}
              onPress={() => navigation.navigate('CustomerConfirm', { deliveryId: delivery.id })}
              activeOpacity={0.9}
            >
              <Feather name="arrow-right" size={18} color={THEME.colors.textInverse} />
              <Text style={successStyles.continueBtnText}>Continue to Customer Confirmation</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={successStyles.backBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}
            >
              <Text style={successStyles.backBtnText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={DP_BRAND.primary} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={20} color={DP_BRAND.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Bill Photo</Text>
          <Text style={styles.headerSubtitle}>{delivery.referenceNo}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.customerCard}>
            <View style={styles.customerIconWrap}>
              <Feather name="file-text" size={20} color={THEME.colors.warning} />
            </View>
            <View style={styles.customerInfo}>
              <Text style={styles.customerLabel}>SIGNED BILL FROM</Text>
              <Text style={styles.customerName}>{delivery.customerName}</Text>
              <Text style={styles.customerSub}>{itemsCount} item{itemsCount === 1 ? '' : 's'} · {delivery.zone}</Text>
            </View>
          </View>

          <View style={styles.instructionCard}>
            <Feather name="info" size={16} color={THEME.colors.info} />
            <Text style={styles.instructionText}>
              Ask the customer to sign the printed bill. Capture a clear photo of the
              full signed bill — the admin will review it before stock is updated.
            </Text>
          </View>

          {photoUri ? (
            <View style={styles.previewCard}>
              <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="cover" />
              <View style={styles.previewActions}>
                <TouchableOpacity
                  style={styles.secondaryAction}
                  onPress={() => dispatch(clearBillPhoto())}
                  disabled={isSubmitting}
                >
                  <Feather name="trash-2" size={16} color={THEME.colors.danger} />
                  <Text style={[styles.secondaryActionText, { color: THEME.colors.danger }]}>
                    Remove
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryAction}
                  onPress={handleTakePhoto}
                  disabled={isSubmitting}
                >
                  <Feather name="refresh-ccw" size={16} color={DP_BRAND.primary} />
                  <Text style={[styles.secondaryActionText, { color: DP_BRAND.primary }]}>
                    Retake
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.captureCard}>
              <View style={styles.cameraIconWrap}>
                <Feather name="camera" size={32} color={DP_BRAND.primary} />
              </View>
              <Text style={styles.captureTitle}>Capture signed bill</Text>
              <Text style={styles.captureHint}>
                Use the camera for the freshest proof, or pick from your gallery.
              </Text>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleTakePhoto}
                activeOpacity={0.9}
              >
                <Feather name="camera" size={18} color={THEME.colors.textInverse} />
                <Text style={styles.primaryBtnText}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={handlePickFromGallery}
                activeOpacity={0.9}
              >
                <Feather name="image" size={18} color={DP_BRAND.primary} />
                <Text style={styles.secondaryBtnText}>Choose from Gallery</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Customer name on bill</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Muhammad Arif"
              placeholderTextColor={THEME.colors.textTertiary}
              value={signedBy}
              onChangeText={t => dispatch(setSignedBy(t))}
              editable={!isSubmitting}
            />
          </View>

          {/* Nothing left to pay (prepaid, or covered by the advance): tell the
              rider not to collect, rather than ask a question whose answer
              could only be wrong. Otherwise: how much to collect, and what
              the customer actually paid. */}
          {door.nothingDue ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Payment</Text>
              <View style={paidStyles.prepaidPanel}>
                <View style={paidStyles.prepaidIcon}>
                  <Feather name="check-circle" size={20} color={THEME.colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={paidStyles.prepaidTitle}>Already paid</Text>
                  <Text style={paidStyles.prepaidBody}>
                    {delivery.prepaid
                      ? 'This is a pre-paid order — the customer paid before dispatch.'
                      : `The customer paid ${formatCurrency(door.advanceApplied)} in advance, which covers what they are keeping.`}{' '}
                    Do not collect any cash. Just get the bill signed and photographed as usual.
                  </Text>
                </View>
              </View>
            </View>
          ) : (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Payment collected?</Text>
            <View style={paidStyles.duePanel}>
              <Text style={paidStyles.dueLabel}>AMOUNT TO COLLECT</Text>
              <Text style={paidStyles.dueAmount}>{formatCurrency(door.amountDue)}</Text>
              {hasAdvance && (
                <Text style={paidStyles.dueSub}>
                  {formatCurrency(door.gross)} for the goods kept, less {formatCurrency(door.advanceApplied)} paid in advance
                </Text>
              )}
            </View>
            <View style={paidStyles.row}>
              {([
                { key: 'paid', label: 'PAID', hint: 'All of it', icon: 'check-circle', on: paidStyles.optionPaid, tone: THEME.colors.success },
                { key: 'partial', label: 'PARTIAL', hint: 'Some of it', icon: 'pie-chart', on: paidStyles.optionPartial, tone: THEME.colors.info },
                { key: 'unpaid', label: 'NOT PAID', hint: 'On account', icon: 'clock', on: paidStyles.optionUnpaid, tone: THEME.colors.warning },
              ] as const).map(opt => {
                const selected = paidStatus === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[paidStyles.option, selected && opt.on]}
                    onPress={() => dispatch(setPaidStatus(opt.key))}
                    disabled={isSubmitting}
                    activeOpacity={0.85}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Feather name={opt.icon} size={18} color={selected ? THEME.colors.textInverse : opt.tone} />
                    <Text style={[paidStyles.optionText, { color: selected ? THEME.colors.textInverse : opt.tone }]}>
                      {opt.label}
                    </Text>
                    <Text style={[paidStyles.optionHint, selected && { color: THEME.colors.textInverse }]}>
                      {opt.hint}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {paidStatus === 'partial' && (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.fieldLabel}>Amount received</Text>
                <TextInput
                  style={[styles.input, !!partialError && amountCollectedText !== '' && styles.qtyInputError]}
                  value={amountCollectedText}
                  onChangeText={t => dispatch(setAmountCollected(t.replace(/[^0-9.]/g, '')))}
                  placeholder={`Less than ${formatCurrency(door.amountDue)}`}
                  placeholderTextColor={THEME.colors.textTertiary}
                  keyboardType="decimal-pad"
                  editable={!isSubmitting}
                  maxLength={14}
                />
                {!!partialError && amountCollectedText !== '' ? (
                  <Text style={styles.qtyError}>{partialError}</Text>
                ) : (
                  (() => {
                    const received = Number(amountCollectedText) || 0;
                    const left = Math.max(door.amountDue - received, 0);
                    return received > 0 ? (
                      <Text style={paidStyles.note}>
                        {formatCurrency(left)} stays on the customer’s account.
                      </Text>
                    ) : null;
                  })()
                )}
              </View>
            )}
            <Text style={paidStyles.note}>
              This choice posts nothing to the books. Accounting happens only when the
              admin approves: the cash you collected is recorded, and anything unpaid
              stays on the customer’s account.
            </Text>
          </View>
          )}

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Delivered quantities</Text>
            <Text style={styles.fieldHint}>
              Enter how many units the customer sent back. Leave blank if they took
              everything.
            </Text>
            {lines.map(line => (
              <View key={line.itemId} style={styles.qtyRow}>
                <View style={styles.qtyInfo}>
                  <Text style={styles.qtyName} numberOfLines={1}>{line.itemName}</Text>
                  <Text style={styles.qtySub}>
                    {line.dispatched} dispatched · delivering {line.deliveredQty}
                  </Text>
                </View>
                <TextInput
                  style={[styles.qtyInput, !line.valid && styles.qtyInputError]}
                  value={line.raw}
                  onChangeText={t =>
                    dispatch(setReturnedQty({ itemId: line.itemId, qty: t.replace(/[^0-9]/g, '') }))
                  }
                  placeholder="0"
                  placeholderTextColor={THEME.colors.textTertiary}
                  keyboardType="number-pad"
                  editable={!isSubmitting}
                  maxLength={6}
                />
              </View>
            ))}
            {invalidLine && (
              <Text style={styles.qtyError}>
                {invalidLine.itemName}: enter 0–{invalidLine.dispatched}.
              </Text>
            )}
            {isFullReturn && (
              <View style={styles.warnBanner}>
                <Feather name="alert-circle" size={16} color={THEME.colors.warning} />
                <Text style={styles.warnBannerText}>
                  Nothing was accepted. The admin should reject this so the whole
                  delivery is returned to stock.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Note for admin (optional)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Anything the admin should know — damage, disputes, access problems."
              placeholderTextColor={THEME.colors.textTertiary}
              value={note}
              onChangeText={t => dispatch(setNote(t))}
              multiline
              editable={!isSubmitting}
            />
          </View>

          {alreadySubmitted && (
            <View style={styles.warnBanner}>
              <Feather name="alert-circle" size={16} color={THEME.colors.warning} />
              <Text style={styles.warnBannerText}>
                A bill photo for this delivery is already pending admin review.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.submitBtn,
              (!photoUri || !effectivePaidStatus || !!partialError || isSubmitting || alreadySubmitted || !!invalidLine) &&
                styles.submitBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!photoUri || !effectivePaidStatus || !!partialError || isSubmitting || alreadySubmitted || !!invalidLine}
            activeOpacity={0.9}
          >
            {isSubmitting ? (
              <ActivityIndicator color={THEME.colors.textInverse} />
            ) : (
              <>
                <Feather name="send" size={18} color={THEME.colors.textInverse} />
                <Text style={styles.submitBtnText}>Send to Admin for Review</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.footnote}>
            Inventory will be updated once the admin approves this request.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DP_BRAND.primary },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: DP_BRAND.primary,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DP_BRAND.headerOverlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { alignItems: 'center' },
  headerTitle: { ...THEME.typography.h3, color: DP_BRAND.white },
  headerSubtitle: { ...THEME.typography.caption, color: DP_BRAND.headerTextSecondary, marginTop: 2 },
  headerSpacer: { width: 40 },

  content: { flex: 1, backgroundColor: THEME.colors.background },
  contentInner: { padding: 20, paddingBottom: 40 },

  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    padding: 16,
    marginBottom: 12,
    ...THEME.shadows.sm,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
  },
  customerIconWrap: {
    width: 52,
    height: 52,
    borderRadius: THEME.radius.lg,
    backgroundColor: THEME.colors.warningLight ?? THEME.colors.warningLighter,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  customerInfo: { flex: 1 },
  customerLabel: {
    ...THEME.typography.overline,
    color: THEME.colors.textTertiary,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  customerName: { ...THEME.typography.h3, color: THEME.colors.textPrimary },
  customerSub: { ...THEME.typography.caption, color: THEME.colors.textSecondary, marginTop: 2 },

  instructionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: THEME.colors.infoLight,
    borderRadius: THEME.radius.lg,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  instructionText: {
    flex: 1,
    ...THEME.typography.bodySm,
    color: THEME.colors.info,
    lineHeight: 19,
  },

  captureCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: THEME.colors.border,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  cameraIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: THEME.colors.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  captureTitle: { ...THEME.typography.h4, color: THEME.colors.textPrimary, marginBottom: 4 },
  captureHint: {
    ...THEME.typography.bodySm,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: DP_BRAND.primary,
    borderRadius: THEME.radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignSelf: 'stretch',
    marginBottom: 10,
    ...THEME.shadows.md,
  },
  primaryBtnText: { ...THEME.typography.h4, color: THEME.colors.textInverse },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: DP_BRAND.primary,
    borderRadius: THEME.radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignSelf: 'stretch',
  },
  secondaryBtnText: { ...THEME.typography.h4, color: DP_BRAND.primary },

  previewCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    marginBottom: 16,
    ...THEME.shadows.sm,
  },
  preview: { width: '100%', aspectRatio: 3 / 4, backgroundColor: THEME.colors.neutral100 },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.borderLight,
    backgroundColor: THEME.colors.neutral50,
  },
  secondaryAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  secondaryActionText: { ...THEME.typography.labelLg },

  fieldGroup: { marginBottom: 14 },
  fieldLabel: {
    ...THEME.typography.labelSm,
    color: THEME.colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: THEME.colors.textPrimary,
    ...THEME.typography.bodyMd,
  },
  inputMultiline: { minHeight: 84, textAlignVertical: 'top' },

  fieldHint: {
    ...THEME.typography.bodySm,
    color: THEME.colors.textTertiary,
    marginBottom: 10,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  qtyInfo: { flex: 1 },
  qtyName: {
    ...THEME.typography.bodyMd,
    color: THEME.colors.textPrimary,
  },
  qtySub: {
    ...THEME.typography.bodySm,
    color: THEME.colors.textTertiary,
    marginTop: 2,
  },
  qtyInput: {
    width: 72,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlign: 'center',
    color: THEME.colors.textPrimary,
    ...THEME.typography.bodyMd,
  },
  qtyInputError: { borderColor: THEME.colors.danger },
  qtyError: {
    ...THEME.typography.bodySm,
    color: THEME.colors.danger,
    marginBottom: 6,
  },

  warnBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.warningLight ?? THEME.colors.warningLighter,
    borderRadius: THEME.radius.lg,
    padding: 12,
    marginBottom: 12,
  },
  warnBannerText: {
    flex: 1,
    ...THEME.typography.bodySm,
    color: THEME.colors.warning,
  },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.success,
    borderRadius: THEME.radius.lg,
    paddingVertical: 16,
    marginTop: 4,
    ...THEME.shadows.md,
  },
  submitBtnDisabled: { backgroundColor: THEME.colors.neutral300, shadowOpacity: 0, elevation: 0 },
  submitBtnText: { ...THEME.typography.h4, color: THEME.colors.textInverse },
  footnote: {
    ...THEME.typography.caption,
    color: THEME.colors.textTertiary,
    textAlign: 'center',
    marginTop: 12,
  },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: THEME.colors.background,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: THEME.colors.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: { ...THEME.typography.h2, color: THEME.colors.textPrimary, marginBottom: 8 },
  emptySubtitle: {
    ...THEME.typography.bodyMd,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: DP_BRAND.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: THEME.radius.lg,
    ...THEME.shadows.sm,
  },
  emptyButtonText: { ...THEME.typography.labelLg, color: THEME.colors.textInverse }
});

const paidStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10
  },
  option: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 8
  },
  optionPaid: {
    backgroundColor: THEME.colors.success,
    borderColor: THEME.colors.success
  },
  optionUnpaid: {
    backgroundColor: THEME.colors.warning,
    borderColor: THEME.colors.warning
  },
  optionPartial: {
    backgroundColor: THEME.colors.info,
    borderColor: THEME.colors.info
  },
  duePanel: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.lg,
    padding: 14,
    marginBottom: 10
  },
  dueLabel: {
    ...THEME.typography.caption,
    color: THEME.colors.textSecondary,
    letterSpacing: 0.5
  },
  dueAmount: {
    ...THEME.typography.h3,
    color: THEME.colors.textPrimary,
    marginTop: 2
  },
  dueSub: {
    ...THEME.typography.caption,
    color: THEME.colors.textSecondary,
    marginTop: 2
  },
  optionText: {
    ...THEME.typography.labelLg,
    letterSpacing: 0.5,
    marginTop: 4
  },
  optionHint: {
    ...THEME.typography.caption,
    color: THEME.colors.textSecondary
  },
  note: {
    ...THEME.typography.caption,
    color: THEME.colors.textTertiary,
    marginTop: 8,
    lineHeight: 16
  },
  prepaidPanel: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: `${THEME.colors.success}0F`,
    borderWidth: 1.5,
    borderColor: `${THEME.colors.success}55`,
    borderRadius: THEME.radius.lg,
    padding: 14
  },
  prepaidIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surface
  },
  prepaidTitle: {
    ...THEME.typography.labelLg,
    letterSpacing: 0.3,
    color: THEME.colors.success
  },
  prepaidBody: {
    ...THEME.typography.caption,
    color: THEME.colors.textSecondary,
    marginTop: 3,
    lineHeight: 17
  },
});

const successStyles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    ...THEME.shadows.md,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: THEME.colors.successLight ?? THEME.colors.primaryLighter,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    ...THEME.typography.h2,
    color: THEME.colors.success,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    ...THEME.typography.bodyMd,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 21,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.neutral50,
    borderRadius: THEME.radius.lg,
    padding: 12,
    marginBottom: 8,
    alignSelf: 'stretch',
  },
  infoText: {
    flex: 1,
    ...THEME.typography.bodySm,
    color: THEME.colors.textSecondary,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: DP_BRAND.primary,
    borderRadius: THEME.radius.lg,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignSelf: 'stretch',
    marginTop: 16,
    ...THEME.shadows.md,
  },
  continueBtnText: {
    ...THEME.typography.h4,
    color: THEME.colors.textInverse,
  },
  backBtn: {
    paddingVertical: 12,
    marginTop: 8,
  },
  backBtnText: {
    ...THEME.typography.labelLg,
    color: THEME.colors.textTertiary,
  }
});

export default BillPhotoCaptureScreen;
