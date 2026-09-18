// ═══════════════════════════════════════════════════════
// FinMatrix — Stock Adjustment Screen
// ═══════════════════════════════════════════════════════
// An adjustment is an accounting document, not a quantity tweak: it moves
// stock AND posts a journal entry. The form is built around showing that
// entry before the user commits to it.

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity
} from 'react-native';
import { Alert } from '../../../utils/alert';
import Toast from 'react-native-toast-message';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { THEME } from '../../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import {
  selectInventoryItems,
  adjustStock
} from '../InventoryList/inventoryListSlice';
import CustomInput from '../../../Custom-Components/CustomInput';
import { ReportHeader, HEADER_NAVY } from '../../../components/reports/ReportUI';
import CustomDropdown from '../../../Custom-Components/CustomDropdown';
import CustomButton from '../../../Custom-Components/CustomButton';
import { useCapability } from '../../../hooks/useCapability';
import {
  ADJUSTMENT_REASONS,
  previewAdjustmentPosting,
  reasonHint,
  type AdjustmentReason
} from '../../../models/adjustmentModel';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import type { InventoryStackParamList } from '../../../navigators/stacks/InventoryStack';

// Design-system tokens (see src/theme/theme.ts).
const { colors, radius, shadows, spacing, typography } = THEME;

type AdjRoute = RouteProp<InventoryStackParamList, 'Adjustment'>;
type Nav = NativeStackNavigationProp<InventoryStackParamList>;

/**
 * How the user expresses the change. The API only takes an absolute target
 * quantity, but "3 broke" is the way people actually think about damage —
 * making them work out 47 − 3 themselves is where mistakes come from. Add and
 * Remove also keep the input unsigned, so the numeric keypad is enough (it has
 * no minus key on iOS).
 */
type AdjustMode = 'set' | 'add' | 'remove';

const MODES: { key: AdjustMode; label: string }[] = [
  { key: 'set', label: 'Set to' },
  { key: 'add', label: 'Add' },
  { key: 'remove', label: 'Remove' },
];

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════
const AdjustmentScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<AdjRoute>();
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectInventoryItems);

  const preselectedId = route.params?.itemId;
  const activeItems = useMemo(
    () => items.filter(i => i.isActive).map(i => ({ label: `${i.name} (${i.sku})`, value: i.itemId })),
    [items],
  );

  // ── Form state ──────────────────────────────────
  const [selectedItemId, setSelectedItemId] = useState(preselectedId ?? '');
  const [mode, setMode] = useState<AdjustMode>('set');
  const [qtyInput, setQtyInput] = useState('');
  const [reason, setReason] = useState<AdjustmentReason | ''>('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  // Errors stay hidden until the first save attempt, so the form does not
  // scold the user about fields they have not reached yet.
  const [submitted, setSubmitted] = useState(false);

  const selectedItem = items.find(i => i.itemId === selectedItemId);
  const currentQty = selectedItem?.quantityOnHand ?? 0;
  const unitCost = selectedItem?.unitCost ?? 0;

  // parseFloat, not parseInt: quantity_on_hand is numeric(18,4), so truncating
  // to an integer here would silently adjust to the wrong number.
  const entered = parseFloat(qtyInput);
  const hasEntry = qtyInput.trim() !== '' && !isNaN(entered);

  // The API takes the absolute target and derives the variance itself, so
  // newQty is what gets sent whichever way the user expressed it.
  const { newQty, variance } = useMemo(() => {
    if (!hasEntry) return { newQty: currentQty, variance: 0 };
    switch (mode) {
      case 'add': return { newQty: currentQty + entered, variance: entered };
      case 'remove': return { newQty: currentQty - entered, variance: -entered };
      default: return { newQty: entered, variance: entered - currentQty };
    }
  }, [mode, entered, hasEntry, currentQty]);

  const posting = useMemo(
    () => previewAdjustmentPosting(variance, unitCost, reason),
    [variance, unitCost, reason],
  );

  // ── Validation ──────────────────────────────────
  const errors = useMemo(() => {
    const e: { item?: string; qty?: string; reason?: string } = {};
    if (!selectedItemId) e.item = 'Select the item being adjusted';

    if (qtyInput.trim() === '') {
      e.qty = mode === 'set' ? 'Enter the new quantity' : 'Enter a quantity';
    } else if (isNaN(entered)) {
      e.qty = 'Enter a number';
    } else if (entered < 0) {
      e.qty = 'Enter a positive number — use Remove to reduce stock';
    } else if (newQty < 0) {
      e.qty = `Only ${currentQty} on hand — you cannot remove ${entered}`;
    } else if (variance === 0) {
      e.qty = 'That is the quantity already on hand — nothing to adjust';
    }

    if (!reason) e.reason = 'Pick a reason so the entry can be explained later';
    return e;
  }, [selectedItemId, qtyInput, entered, newQty, variance, currentQty, reason, mode]);

  const isValid = Object.keys(errors).length === 0;

  // ── Save ────────────────────────────────────────
  // Adjustments are gated: an owner posts immediately, staff file a request
  // the owner approves. Same endpoint either way — this only decides what the
  // screen SAYS, so it can never disagree with what actually happened.
  const adjustCap = useCapability('inventory.adjust');

  const postAdjustment = useCallback(async () => {
    setIsSaving(true);
    try {
      const result = await dispatch(
        adjustStock({
          itemId: selectedItemId,
          newQty,
          reason: reason as AdjustmentReason,
          notes: notes.trim() || undefined
        }),
      ).unwrap();

      // The response envelope nests everything under `data`, so the adjustment
      // is at data.adjustment — reading result.adjustment straight off the top
      // always came back undefined.
      const payload = result?.data ?? result;
      const adjustment = payload?.adjustment ?? result?.adjustment;

      // Staff get a pending request back rather than a posted adjustment. Say
      // so plainly: nothing has moved yet, and claiming otherwise would have
      // them walk away believing the stock was corrected.
      if (payload?.pending) {
        Toast.show({
          type: 'success',
          text1: 'Sent to the owner for approval',
          text2: `${selectedItem!.name} stays at ${currentQty} until they approve.`,
        });
        navigation.goBack();
        return;
      }

      Toast.show({
        type: 'success',
        // Only claim an entry was posted when one actually was. A zero-value
        // adjustment moves stock and nothing else; the user already agreed to
        // that in the confirmation, so this just keeps the wording honest.
        text1: adjustment?.journalEntryId ? 'Adjustment posted' : 'Stock adjusted',
        text2: `${selectedItem!.name}: ${currentQty} → ${newQty} (${variance > 0 ? '+' : ''}${variance})`
      });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Adjustment failed', e?.message || 'The adjustment could not be saved.');
    } finally {
      setIsSaving(false);
    }
  }, [
    dispatch, selectedItemId, newQty, reason, notes,
    selectedItem, currentQty, variance, navigation,
  ]);

  const handleSave = useCallback(() => {
    setSubmitted(true);
    if (!isValid) return;

    // A zero-cost item moves stock with no journal entry at all. That is a
    // silent hole in the ledger, so it needs a decision rather than a toast
    // after the fact.
    if (posting.postsNothing) {
      Alert.alert(
        'No journal entry will post',
        `${selectedItem!.name} has no unit cost, so this adjustment has no value to record. ` +
          (adjustCap.needsApproval
            // Nothing moves for staff until the owner approves, so promising
            // that "the quantity will move" would be wrong for them.
            ? 'If the owner approves it, the quantity will move but the Inventory account will not change.'
            : 'The quantity will move but the Inventory account will not change.') +
          '\n\nGive the item a unit cost first if you want the books to follow the stock.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: adjustCap.needsApproval ? 'Send Anyway' : 'Adjust Anyway',
            style: 'destructive',
            onPress: postAdjustment,
          },
        ],
      );
      return;
    }

    postAdjustment();
  }, [isValid, posting, selectedItem, postAdjustment, adjustCap.needsApproval]);

  // ── Item / mode changes reset the entry ─────────
  const handleItemChange = useCallback((id: string) => {
    setSelectedItemId(id);
    setQtyInput('');
    setSubmitted(false);
  }, []);

  const handleModeChange = useCallback((next: AdjustMode) => {
    setMode(next);
    setQtyInput('');
  }, []);

  const qtyLabel =
    mode === 'set' ? 'New quantity on hand *'
      : mode === 'add' ? 'Quantity to add *'
        : 'Quantity to remove *';

  // ═════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: HEADER_NAVY[0] }]} edges={['top']}>
      <ReportHeader
        title={'Stock Adjustment'}
        subtitle="Moves stock and posts the matching journal entry"
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Item ── */}
          <CustomDropdown
            label="Item *"
            options={activeItems}
            value={selectedItemId}
            onChange={handleItemChange}
            placeholder="Select an item…"
            error={submitted ? errors.item : undefined}
            searchable
          />

          {/* ── What we are working from ── */}
          {selectedItem && (
            <View style={styles.contextCard}>
              <View style={styles.contextCol}>
                <Text style={styles.contextValue}>{currentQty}</Text>
                <Text style={styles.contextLabel}>On hand</Text>
              </View>
              <View style={styles.contextDivider} />
              <View style={styles.contextCol}>
                <Text style={styles.contextValue}>{formatCurrency(unitCost)}</Text>
                <Text style={styles.contextLabel}>Unit cost</Text>
              </View>
              <View style={styles.contextDivider} />
              <View style={styles.contextCol}>
                <Text style={styles.contextValue}>{formatCurrency(currentQty * unitCost)}</Text>
                <Text style={styles.contextLabel}>Stock value</Text>
              </View>
            </View>
          )}

          {/* ── How to express the change ── */}
          <Text style={styles.fieldLabel}>Adjustment</Text>
          <View style={styles.segmented}>
            {MODES.map(m => (
              <TouchableOpacity
                key={m.key}
                style={[styles.segment, mode === m.key && styles.segmentActive]}
                activeOpacity={0.7}
                onPress={() => handleModeChange(m.key)}
              >
                <Text style={[styles.segmentText, mode === m.key && styles.segmentTextActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <CustomInput
            label={qtyLabel}
            value={qtyInput}
            onChangeText={setQtyInput}
            placeholder={mode === 'set' ? 'e.g. 44' : 'e.g. 3'}
            keyboardType="numeric"
            error={submitted ? errors.qty : undefined}
          />

          {/* ── What that works out to ── */}
          {selectedItem && hasEntry && variance !== 0 && newQty >= 0 && (
            <View style={styles.resultRow}>
              <Text style={styles.resultQty}>{currentQty}</Text>
              <Feather name="arrow-right" size={16} color={colors.textTertiary} />
              <Text style={styles.resultQty}>{newQty}</Text>
              <View style={{ flex: 1 }} />
              <Text
                style={[
                  styles.resultDelta,
                  { color: variance > 0 ? colors.success : colors.danger },
                ]}
              >
                {variance > 0 ? '+' : ''}{variance}
              </Text>
            </View>
          )}

          {/* ── Reason ── */}
          <CustomDropdown
            label="Reason *"
            options={ADJUSTMENT_REASONS.map(r => ({ label: r.label, value: r.value }))}
            value={reason}
            // The dropdown is typed for plain strings, but every option value
            // here comes from ADJUSTMENT_REASONS, so it is always a valid code.
            onChange={v => setReason(v as AdjustmentReason)}
            placeholder="Select reason…"
            error={submitted ? errors.reason : undefined}
          />
          {!!reason && <Text style={styles.hint}>{reasonHint(reason)}</Text>}

          {/* ── Notes ── */}
          <CustomInput
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="What happened? This is stored with the entry."
            multiline
          />

          {/* ── The entry that will post ── */}
          {selectedItem && hasEntry && variance !== 0 && newQty >= 0 && (
            posting.postsNothing ? (
              <View style={styles.warnCard}>
                <View style={styles.warnHead}>
                  <Feather name="alert-triangle" size={16} color={colors.warning} />
                  <Text style={styles.warnTitle}>No journal entry will post</Text>
                </View>
                <Text style={styles.warnBody}>
                  {selectedItem.name} has no unit cost, so this adjustment has no value to
                  record. The quantity moves but the Inventory account stays where it is —
                  the books will no longer match the shelf.
                </Text>
              </View>
            ) : (
              <View style={styles.jeCard}>
                <View style={styles.jeHead}>
                  <Text style={styles.jeTitle}>Journal entry</Text>
                  <Text style={styles.jeValue}>{formatCurrency(posting.value)}</Text>
                </View>

                {posting.lines.map(line => (
                  <View key={line.side} style={styles.jeRow}>
                    <Text style={styles.jeSide}>{line.side === 'debit' ? 'Dr' : 'Cr'}</Text>
                    <Text style={styles.jeAcctNo}>{line.accountNumber}</Text>
                    <Text style={styles.jeAcctName} numberOfLines={1}>{line.accountName}</Text>
                    <Text style={styles.jeAmount}>{formatCurrency(line.amount)}</Text>
                  </View>
                ))}

                <Text style={styles.jeFoot}>
                  Valued at the weighted-average cost of {formatCurrency(unitCost)}/unit.
                  {'\n'}Posted as of {formatDate(new Date())} — the server stamps the date.
                </Text>
              </View>
            )
          )}

          <View style={{ height: spacing.md }} />
        </ScrollView>

        {/* ── Actions ──
            Pinned, not trailing the scroll: the journal-entry preview makes
            this form long enough that a commit button at the very bottom is
            easy to miss. Each button is wrapped in a flex column — CustomButton's
            fullWidth is width:100%, so two of them directly in a row push the
            second one off the screen. */}
        <View style={styles.footer}>
          <View style={styles.footerCancel}>
            <CustomButton
              title="Cancel"
              onPress={() => navigation.goBack()}
              variant="secondary"
              size="md"
              fullWidth
            />
          </View>
          <View style={styles.footerPrimary}>
            <CustomButton
              title={adjustCap.submitLabel('Post Adjustment')}
              onPress={handleSave}
              variant="primary"
              size="md"
              fullWidth
              isLoading={isSaving}
              disabled={isSaving}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ═══════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  scroll: { flex: 1 },
  scrollContent: { padding: spacing.xl },

  fieldLabel: {
    ...typography.labelMd,
    color: colors.textSecondary,
    marginBottom: spacing.xxs,
  },
  hint: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
    lineHeight: 17,
  },

  // ── Item context ──────────────────────────────────
  contextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    ...shadows.xs,
  },
  contextCol: { flex: 1, alignItems: 'center' },
  contextDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: colors.border },
  contextValue: {
    ...typography.h4,
    color: colors.textPrimary,
  },
  contextLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },

  // ── Mode selector ─────────────────────────────────
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: 3,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    borderRadius: radius.sm - 2,
  },
  segmentActive: { backgroundColor: colors.actionGreen },
  segmentText: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  segmentTextActive: { color: colors.surface, fontWeight: typography.labelLg.fontWeight },

  // ── Result strip ──────────────────────────────────
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs + 4,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    ...shadows.xs,
  },
  resultQty: {
    ...typography.h4,
    color: colors.textPrimary,
  },
  resultDelta: { ...typography.h3 },

  // ── Journal entry preview ─────────────────────────
  jeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.actionGreen + '25',
  },
  jeHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  jeTitle: {
    ...typography.labelSm,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  jeValue: {
    ...typography.labelLg,
    color: colors.textPrimary,
  },
  jeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xxs + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  jeSide: {
    ...typography.labelSm,
    width: 24,
    color: colors.textSecondary,
  },
  jeAcctNo: {
    ...typography.labelSm,
    width: 42,
    color: colors.textTertiary,
  },
  jeAcctName: {
    ...typography.caption,
    flex: 1,
    color: colors.textPrimary,
  },
  jeAmount: {
    ...typography.labelSm,
    color: colors.textPrimary,
    textAlign: 'right',
  },
  jeFoot: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xs,
    lineHeight: 16,
  },

  // ── Zero-cost warning ─────────────────────────────
  warnCard: {
    backgroundColor: colors.warning + '10',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning + '40',
  },
  warnHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, marginBottom: spacing.xxs },
  warnTitle: {
    ...typography.labelMd,
    color: colors.textPrimary,
  },
  warnBody: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  // ── Pinned action bar ─────────────────────────────
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs + 2,
    paddingBottom: spacing.xs + 2,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  // The commit action carries more weight than the escape hatch, which the
  // header's back arrow already duplicates.
  footerCancel: { flex: 1 },
  footerPrimary: { flex: 1.7 }
});

export default AdjustmentScreen;
