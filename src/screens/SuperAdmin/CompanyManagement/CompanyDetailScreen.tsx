// ═══════════════════════════════════════════════════════
// FinMatrix — One company (Super Admin)
// ═══════════════════════════════════════════════════════
// GET /super-admin/companies/:id has been live all along, and
// getCompanyDetailAPI was already written -- nothing called it. The review
// modal showed only the fields that already fit in a list row, so a reviewer
// approved a name and a date.
//
// The endpoint returns the company entity plus its members and its
// subscription history, and it is a pushed screen rather than a modal because
// there is now more here than a modal should hold.

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Switch,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Alert } from '../../../utils/alert';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { THEME, statusStyle } from '../../../theme';
import {
  AdminScreenHeader,
  AdminErrorState,
  StatusPill,
} from '../../../components/admin/AdminUI';
import type { CompaniesStackParamList } from '../../../navigators/CompaniesStackNavigator';
import {
  loadCompanyDetail,
  setCompanyFeatureOverride,
  updateCompanyStatusLocal,
  selectCompanyDetail,
  selectCompanyDetailStatus,
  selectCompanyDetailError,
  selectActionStatus,
} from '../superAdminSlice';
import type { CompanyType } from '../../../models/superAdminModel';

const REJECT_REASONS = [
  'Incomplete documentation',
  'Invalid business information',
  'Duplicate registration',
  'Policy violation',
  'Suspicious activity',
];

const { colors, radius, spacing, typography } = THEME;

type Props = NativeStackScreenProps<CompaniesStackParamList, 'CompanyDetail'>;

const COMPANY_TYPES: { value: CompanyType; label: string }[] = [
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'small_business', label: 'Small business' },
  { value: 'large_org', label: 'Large organisation' },
];

const fmtDate = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ── A label/value row ─────────────────────────────────
const Row: React.FC<{ label: string; value: string; emphasis?: boolean }> = ({
  label,
  value,
  emphasis,
}) => (
  <View style={S.row}>
    <Text style={S.rowLabel}>{label}</Text>
    <Text style={[S.rowValue, emphasis && S.rowValueEmphasis]} numberOfLines={2}>
      {value}
    </Text>
  </View>
);

// ── Feature override sheet ────────────────────────────
/**
 * allFeaturesUnlocked bypasses the server's FeatureGuard before any plan logic,
 * so a company carrying it sees everything regardless of what it pays for.
 * That is why this confirms, and why the copy names the effect rather than the
 * field.
 */
const FeatureOverrideSheet: React.FC<{
  visible: boolean;
  onClose: () => void;
  initial: {
    companyType: CompanyType | null;
    inventoryEnabled: boolean | null;
    allFeaturesUnlocked: boolean | null;
  };
  onSave: (input: {
    companyType?: CompanyType;
    inventoryEnabled?: boolean;
    allFeaturesUnlocked?: boolean;
  }) => Promise<void>;
}> = ({ visible, onClose, initial, onSave }) => {
  const [type, setType] = useState<CompanyType | null>(initial.companyType);
  const [inventory, setInventory] = useState(!!initial.inventoryEnabled);
  const [unlocked, setUnlocked] = useState(!!initial.allFeaturesUnlocked);
  const [saving, setSaving] = useState(false);

  // Re-seed on open, so a cancelled edit is not staged for the next open.
  useEffect(() => {
    if (!visible) return;
    setType(initial.companyType);
    setInventory(!!initial.inventoryEnabled);
    setUnlocked(!!initial.allFeaturesUnlocked);
    setSaving(false);
  }, [visible, initial]);

  const changed =
    type !== initial.companyType ||
    inventory !== !!initial.inventoryEnabled ||
    unlocked !== !!initial.allFeaturesUnlocked;

  const submit = async () => {
    // Only what changed: the server applies exactly the fields it receives, so
    // resending the rest would clobber anything altered elsewhere meanwhile.
    const input: Parameters<typeof onSave>[0] = {};
    if (type && type !== initial.companyType) input.companyType = type;
    if (inventory !== !!initial.inventoryEnabled) input.inventoryEnabled = inventory;
    if (unlocked !== !!initial.allFeaturesUnlocked) {
      input.allFeaturesUnlocked = unlocked;
    }
    setSaving(true);
    try {
      await onSave(input);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={S.sheetOverlay}>
        <View style={S.sheet}>
          <Text style={S.sheetTitle}>Feature access</Text>
          <Text style={S.sheetBody}>
            These override what this company&apos;s plan would otherwise allow.
          </Text>

          <Text style={S.sheetLabel}>Company type</Text>
          <View style={S.typeRow}>
            {COMPANY_TYPES.map(t => (
              <TouchableOpacity
                key={t.value}
                onPress={() => setType(t.value)}
                style={[S.typeChip, type === t.value && S.typeChipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: type === t.value }}
              >
                <Text style={[S.typeChipText, type === t.value && S.typeChipTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={S.switchRow}>
            <View style={S.switchText}>
              <Text style={S.switchTitle}>Inventory enabled</Text>
              <Text style={S.switchBody}>Stock, adjustments and transfers.</Text>
            </View>
            <Switch value={inventory} onValueChange={setInventory} />
          </View>

          <View style={S.switchRow}>
            <View style={S.switchText}>
              <Text style={S.switchTitle}>Bypass every feature gate</Text>
              <Text style={S.switchDanger}>
                Sees every feature regardless of the plan it pays for. For
                support and migrations, not as an upgrade.
              </Text>
            </View>
            <Switch value={unlocked} onValueChange={setUnlocked} />
          </View>

          <View style={S.sheetActions}>
            <TouchableOpacity onPress={onClose} style={S.sheetCancel}>
              <Text style={S.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={submit}
              disabled={!changed || saving}
              style={[S.sheetSave, (!changed || saving) && S.sheetSaveDisabled]}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.neutral0} />
              ) : (
                <Text style={S.sheetSaveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ── Screen ────────────────────────────────────────────
const CompanyDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { id } = route.params;
  const dispatch = useAppDispatch();

  const company = useAppSelector(selectCompanyDetail);
  const status = useAppSelector(selectCompanyDetailStatus);
  const error = useAppSelector(selectCompanyDetailError);
  const actionStatus = useAppSelector(selectActionStatus);

  const [refreshing, setRefreshing] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  const load = useCallback(() => dispatch(loadCompanyDetail(id)), [dispatch, id]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const decide = useCallback(
    async (next: string, title: string, body: string, rejectionReason?: string) => {
      try {
        await dispatch(
          updateCompanyStatusLocal({ id, status: next, rejectionReason }),
        ).unwrap();
        await load();
        Alert.alert(title, body);
      } catch (e) {
        Alert.alert(
          'Could not update the company',
          e instanceof Error && e.message ? e.message : 'Please try again.',
        );
      }
    },
    [dispatch, id, load],
  );

  const saveOverride = useCallback(
    async (input: Parameters<typeof setCompanyFeatureOverride>[0]['input']) => {
      try {
        await dispatch(setCompanyFeatureOverride({ id, input })).unwrap();
        setOverrideOpen(false);
        Alert.alert('Updated', 'Feature access has been changed.');
      } catch (e) {
        Alert.alert(
          'Could not update feature access',
          e instanceof Error && e.message ? e.message : 'Please try again.',
        );
      }
    },
    [dispatch, id],
  );

  // The server accepts 'suspended' but stores 'inactive'; both read as
  // inactive here so the badge and the available actions agree.
  const norm =
    !company || company.status === 'approved' || company.status === 'active' || !company.status
      ? 'active'
      : company.status === 'suspended' || company.status === 'inactive'
        ? 'inactive'
        : company.status === 'rejected'
          ? 'rejected'
          : 'pending';

  const isLoading = status === 'loading' && !company;

  return (
    <SafeAreaView style={S.container} edges={['top']}>
      <AdminScreenHeader
        title={company?.name ?? route.params.name ?? 'Company'}
        subtitle={company?.industry ?? 'Company record'}
        left={
          // A pushed screen, so this one genuinely has something to pop.
          <TouchableOpacity onPress={() => navigation.goBack()} style={S.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        }
      />

      {isLoading ? (
        <View style={S.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !company ? (
        <AdminErrorState
          title="Could not load this company"
          message={error || 'It may have been removed.'}
          onRetry={load}
        />
      ) : (
        <ScrollView
          contentContainerStyle={S.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          <View style={S.statusRow}>
            <StatusPill status={norm} />
            {company.isTrial ? (
              <View style={[S.trialPill, { backgroundColor: statusStyle('pending').bg }]}>
                <Text style={[S.trialPillText, { color: statusStyle('pending').fg }]}>
                  {company.trialConvertedAt ? 'Converted from trial' : 'On free trial'}
                </Text>
              </View>
            ) : null}
          </View>

          {company.rejectionReason ? (
            <View style={S.rejectionBox}>
              <Text style={S.rejectionLabel}>Rejection reason</Text>
              <Text style={S.rejectionText}>{company.rejectionReason}</Text>
            </View>
          ) : null}

          <View style={S.card}>
            <Text style={S.cardTitle}>Account</Text>
            <Row label="Email" value={company.email ?? '—'} />
            <Row label="Phone" value={company.phone ?? '—'} />
            <Row label="Type" value={company.companyType ?? 'Unset'} />
            <Row label="Plan" value={company.subscriptionPlan ?? 'No plan'} emphasis />
            <Row label="Subscription" value={company.subscriptionStatus ?? '—'} />
            <Row label="Expires" value={fmtDate(company.subscriptionExpiryDate)} />
            <Row label="Registered" value={fmtDate(company.createdAt)} />
            {company.trialStartedAt ? (
              <Row label="Trial started" value={fmtDate(company.trialStartedAt)} />
            ) : null}
            <Row label="Inventory" value={company.inventoryEnabled ? 'Enabled' : 'Disabled'} />
            {/* Only worth a row when it is on: a permanent "No" teaches the
                reader to skip the row. */}
            {company.allFeaturesUnlocked ? (
              <Row label="Feature gates" value="Bypassed" emphasis />
            ) : null}
          </View>

          <TouchableOpacity
            style={S.overrideBtn}
            onPress={() => setOverrideOpen(true)}
            accessibilityRole="button"
          >
            <Feather name="sliders" size={16} color={colors.primary} />
            <Text style={S.overrideBtnText}>Feature access</Text>
          </TouchableOpacity>

          <View style={S.card}>
            <Text style={S.cardTitle}>Members ({company.members.length})</Text>
            {company.members.length === 0 ? (
              <Text style={S.muted}>Nobody has joined this company yet.</Text>
            ) : (
              company.members.map(m => (
                <View key={m.id} style={S.memberRow}>
                  <View style={S.memberInfo}>
                    <Text style={S.memberName} numberOfLines={1}>
                      {m.displayName ?? m.email ?? 'Unnamed member'}
                    </Text>
                    <Text style={S.memberMeta} numberOfLines={1}>
                      {m.email ?? '—'}
                    </Text>
                  </View>
                  <StatusPill status={m.role} />
                </View>
              ))
            )}
          </View>

          <View style={S.card}>
            <Text style={S.cardTitle}>Subscription history</Text>
            {company.subscriptions.length === 0 ? (
              <Text style={S.muted}>No subscription has been assigned.</Text>
            ) : (
              company.subscriptions.map(sub => (
                <View key={sub.id} style={S.memberRow}>
                  <View style={S.memberInfo}>
                    <Text style={S.memberName}>{sub.plan?.name ?? sub.planId}</Text>
                    <Text style={S.memberMeta}>
                      {fmtDate(sub.startDate)} — {fmtDate(sub.endDate)}
                    </Text>
                  </View>
                  <StatusPill status={sub.status} />
                </View>
              ))
            )}
          </View>

          <View style={S.actions}>
            {norm === 'pending' ? (
              <>
                <TouchableOpacity
                  style={[S.actionBtn, S.actionDanger]}
                  disabled={actionStatus === 'loading'}
                  onPress={() => {
                    setReason('');
                    setRejectOpen(true);
                  }}
                >
                  <Text style={S.actionDangerText}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[S.actionBtn, S.actionPrimary]}
                  disabled={actionStatus === 'loading'}
                  onPress={() => decide('active', 'Approved', `${company.name} has been approved.`)}
                >
                  <Text style={S.actionPrimaryText}>Approve</Text>
                </TouchableOpacity>
              </>
            ) : norm === 'active' ? (
              <TouchableOpacity
                style={[S.actionBtn, S.actionDanger]}
                disabled={actionStatus === 'loading'}
                onPress={() =>
                  decide('inactive', 'Suspended', `${company.name} is blocked from signing in.`)
                }
              >
                <Text style={S.actionDangerText}>Suspend</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[S.actionBtn, S.actionPrimary]}
                disabled={actionStatus === 'loading'}
                onPress={() => decide('active', 'Reactivated', `${company.name} is active again.`)}
              >
                <Text style={S.actionPrimaryText}>Reactivate</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}

      {/* The server returns 400 when a rejection carries no reason, and the
          reason reaches the owner verbatim -- so this is a real input rather
          than a confirm. */}
      <Modal
        visible={rejectOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectOpen(false)}
      >
        <View style={S.sheetOverlay}>
          <View style={S.sheet}>
            <Text style={S.sheetTitle}>Reject this company?</Text>
            <Text style={S.sheetBody}>
              This reason reaches the owner, so write it for them.
            </Text>
            <View style={S.typeRow}>
              {REJECT_REASONS.map(r => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setReason(r)}
                  style={[S.typeChip, reason === r && S.typeChipActive]}
                >
                  <Text style={[S.typeChipText, reason === r && S.typeChipTextActive]}>
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Pick one above, or write the reason"
              placeholderTextColor={colors.textTertiary}
              multiline
              style={S.reasonInput}
            />
            <View style={S.sheetActions}>
              <TouchableOpacity onPress={() => setRejectOpen(false)} style={S.sheetCancel}>
                <Text style={S.sheetCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={reason.trim().length < 3 || actionStatus === 'loading'}
                style={[
                  S.sheetSave,
                  S.sheetSaveDanger,
                  (reason.trim().length < 3 || actionStatus === 'loading') && S.sheetSaveDisabled,
                ]}
                onPress={async () => {
                  setRejectOpen(false);
                  await decide(
                    'rejected',
                    'Rejected',
                    `${company?.name ?? 'The company'} has been rejected.`,
                    reason.trim(),
                  );
                }}
              >
                <Text style={S.sheetSaveText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {company ? (
        <FeatureOverrideSheet
          visible={overrideOpen}
          onClose={() => setOverrideOpen(false)}
          initial={{
            companyType: company.companyType,
            inventoryEnabled: company.inventoryEnabled,
            allFeaturesUnlocked: company.allFeaturesUnlocked,
          }}
          onSave={saveOverride}
        />
      ) : null}
    </SafeAreaView>
  );
};

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backBtn: { padding: spacing.xxs },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  trialPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
  },
  trialPillText: { ...typography.labelSm },

  rejectionBox: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerLighter,
    gap: spacing.xxs,
  },
  rejectionLabel: { ...typography.labelSm, color: colors.danger },
  rejectionText: { ...typography.bodySm, color: colors.textPrimary },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { ...typography.h4, color: colors.textPrimary, marginBottom: spacing.xxs },
  muted: { ...typography.bodySm, color: colors.textTertiary },

  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowLabel: { ...typography.bodySm, color: colors.textSecondary },
  rowValue: { ...typography.bodySm, color: colors.textPrimary, flexShrink: 1, textAlign: 'right' },
  rowValueEmphasis: { ...typography.labelMd, color: colors.textPrimary },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  memberInfo: { flex: 1, minWidth: 0 },
  memberName: { ...typography.labelMd, color: colors.textPrimary },
  memberMeta: { ...typography.bodySm, color: colors.textSecondary },

  overrideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  overrideBtnText: { ...typography.labelMd, color: colors.primary },

  actions: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  actionPrimary: { backgroundColor: colors.primary },
  actionPrimaryText: { ...typography.labelMd, color: colors.neutral0 },
  actionDanger: { backgroundColor: colors.dangerLighter },
  actionDangerText: { ...typography.labelMd, color: colors.danger },

  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sheetTitle: { ...typography.h3, color: colors.textPrimary },
  sheetBody: { ...typography.bodySm, color: colors.textSecondary },
  sheetLabel: { ...typography.labelMd, color: colors.textPrimary, marginTop: spacing.xs },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  typeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.neutral100,
  },
  typeChipActive: { backgroundColor: colors.primary },
  typeChipText: { ...typography.labelSm, color: colors.textSecondary },
  typeChipTextActive: { color: colors.neutral0 },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  switchText: { flex: 1, gap: spacing.xxs },
  switchTitle: { ...typography.labelMd, color: colors.textPrimary },
  switchBody: { ...typography.bodySm, color: colors.textSecondary },
  switchDanger: { ...typography.bodySm, color: colors.danger },

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
  sheetSaveDanger: { backgroundColor: colors.danger },
  reasonInput: {
    ...typography.bodySm,
    color: colors.textPrimary,
    minHeight: 72,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    textAlignVertical: 'top',
  },
  sheetSaveText: { ...typography.labelMd, color: colors.neutral0 },
});

export default CompanyDetailScreen;
