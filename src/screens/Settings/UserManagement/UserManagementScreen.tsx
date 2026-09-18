import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Modal,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { Alert } from '../../../utils/alert';
import { Feather } from '@expo/vector-icons';
import { THEME } from '../../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { selectUser } from '../../Auth/authSlice';
import { ReportContainer, ReportHeader } from '../../../components/reports/ReportUI';
import EmptyState from '../../../components/shared/EmptyState';
import CustomButton from '../../../Custom-Components/CustomButton';
import {
  addUser,
  changeUserRole,
  closeAddUser,
  dismissIssued,
  dismissRevealed,
  fetchUsers,
  openAddUser,
  regeneratePassword,
  resetUserPassword,
  revealCredential,
  selectBusyUserId,
  selectFormName,
  selectFormOpen,
  selectFormPassword,
  selectFormRole,
  selectFormUsername,
  selectIsSaving,
  selectIssuedCredentials,
  selectRevealedCredential,
  selectUserMgmtError,
  selectUserMgmtLoading,
  selectUsers,
  setFormName,
  setFormPassword,
  setFormRole,
  setFormUsername,
  setUserActive,
} from './userManagementSlice';
import type { CompanyUser } from '../../../networks/settings/settingsNetwork';

const { colors, radius, shadows, spacing, typography } = THEME;

const ROLE_STYLE: Record<'admin' | 'staff', { bg: string; fg: string; label: string }> = {
  admin: { bg: colors.infoLight, fg: colors.info, label: 'Owner' },
  staff: { bg: colors.actionGreenLighter, fg: colors.actionGreen, label: 'Staff' },
};

/**
 * The owner's team screen.
 *
 * Staff sign in with a USERNAME and a password the owner sets here and hands
 * over — there is no invite email. That makes the owner the custodian of the
 * credential, so this screen can also show it again ("Show login") and re-issue
 * it ("Reset password") when somebody forgets. Both are audited server-side.
 *
 * Accounts are deactivated, never deleted: the ledger references them.
 */
const UserManagementScreen: React.FC = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector(selectUser);
  const users = useAppSelector(selectUsers);
  const loading = useAppSelector(selectUserMgmtLoading);
  const error = useAppSelector(selectUserMgmtError);
  const busyUserId = useAppSelector(selectBusyUserId);

  const formOpen = useAppSelector(selectFormOpen);
  const name = useAppSelector(selectFormName);
  const username = useAppSelector(selectFormUsername);
  const password = useAppSelector(selectFormPassword);
  const role = useAppSelector(selectFormRole);
  const saving = useAppSelector(selectIsSaving);

  const issued = useAppSelector(selectIssuedCredentials);
  const revealed = useAppSelector(selectRevealedCredential);

  useEffect(() => {
    dispatch(fetchUsers());
  }, [dispatch]);

  useEffect(() => {
    if (error) Alert.alert('Could not do that', error);
  }, [error]);

  const isSelf = useCallback(
    (u: CompanyUser) => currentUser?.uid === u.id,
    [currentUser],
  );

  const copy = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', `${label} copied to the clipboard.`);
  };

  const toggleRole = (u: CompanyUser) => {
    if (isSelf(u)) {
      Alert.alert('Not allowed', 'You cannot change your own role.');
      return;
    }
    const next = u.role === 'admin' ? 'staff' : 'admin';
    Alert.alert(
      next === 'admin' ? 'Make this person an owner?' : 'Make this person staff?',
      next === 'admin'
        ? `${u.name} will be able to approve requests, manage users and close the books.`
        : `${u.name} will no longer approve requests or manage users.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Change role',
          onPress: () => dispatch(changeUserRole({ userId: u.id, role: next })),
        },
      ],
    );
  };

  const toggleActive = (u: CompanyUser) => {
    if (isSelf(u)) {
      Alert.alert('Not allowed', 'You cannot deactivate your own account.');
      return;
    }
    const activating = u.status !== 'active';
    Alert.alert(
      activating ? 'Reactivate this account?' : 'Deactivate this account?',
      activating
        ? `${u.name} will be able to sign in again.`
        : `${u.name} will be signed out and cannot sign in. Their history is kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: activating ? 'Reactivate' : 'Deactivate',
          style: activating ? 'default' : 'destructive',
          onPress: () =>
            dispatch(setUserActive({ userId: u.id, isActive: activating })),
        },
      ],
    );
  };

  const confirmReset = (u: CompanyUser) => {
    Alert.alert(
      'Issue a new password?',
      `${u.name}'s current password stops working immediately. You will see the new one to pass on.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset password',
          onPress: () => dispatch(resetUserPassword({ userId: u.id, name: u.name })),
        },
      ],
    );
  };

  const canSubmit =
    name.trim().length > 0 && username.trim().length >= 3 && password.length >= 8;

  return (
    <ReportContainer>
      <ReportHeader
        title="User management"
        subtitle="Your owners and staff"
        onBack={() => navigation.goBack()}
      />

      <FlatList
        data={users}
        keyExtractor={u => u.id}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={() => dispatch(fetchUsers())}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              icon="users"
              title="Just you so far"
              message="Add a staff member so they can run day-to-day work without your password."
            />
          )
        }
        renderItem={({ item }) => {
          const roleStyle = ROLE_STYLE[item.role];
          const inactive = item.status !== 'active';
          const busy = busyUserId === item.id;
          return (
            <View style={[styles.card, inactive && styles.cardInactive]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIdentity}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  <Text style={styles.cardHandle}>
                    {item.username ? `@${item.username}` : item.email ?? '—'}
                  </Text>
                </View>
                <View style={[styles.rolePill, { backgroundColor: roleStyle.bg }]}>
                  <Text style={[styles.rolePillText, { color: roleStyle.fg }]}>
                    {roleStyle.label}
                  </Text>
                </View>
              </View>

              {inactive && (
                <Text style={styles.inactiveNote}>
                  Deactivated — cannot sign in. History kept.
                </Text>
              )}

              <View style={styles.cardActions}>
                {/* The owner is the custodian of this credential: staff have no
                    self-service reset, so this is how a forgotten login is
                    recovered. Both actions are audited server-side. */}
                {!!item.username && (
                  <TouchableOpacity
                    style={styles.cardAction}
                    disabled={busy}
                    onPress={() => dispatch(revealCredential(item.id))}
                  >
                    <Feather name="eye" size={14} color={colors.textSecondary} />
                    <Text style={styles.cardActionText}>Show login</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.cardAction}
                  disabled={busy}
                  onPress={() => confirmReset(item)}
                >
                  <Feather name="key" size={14} color={colors.textSecondary} />
                  <Text style={styles.cardActionText}>Reset password</Text>
                </TouchableOpacity>
                {!isSelf(item) && (
                  <>
                    <TouchableOpacity
                      style={styles.cardAction}
                      disabled={busy}
                      onPress={() => toggleRole(item)}
                    >
                      <Feather name="repeat" size={14} color={colors.textSecondary} />
                      <Text style={styles.cardActionText}>
                        Make {item.role === 'admin' ? 'staff' : 'owner'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cardAction}
                      disabled={busy}
                      onPress={() => toggleActive(item)}
                    >
                      <Feather
                        name={inactive ? 'user-check' : 'user-x'}
                        size={14}
                        color={inactive ? colors.success : colors.danger}
                      />
                      <Text
                        style={[
                          styles.cardActionText,
                          { color: inactive ? colors.success : colors.danger },
                        ]}
                      >
                        {inactive ? 'Reactivate' : 'Deactivate'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          );
        }}
      />

      <View style={styles.footer}>
        <CustomButton title="Add a user" onPress={() => dispatch(openAddUser())} />
      </View>

      {/* ── Add user ─────────────────────────────────────────────────────── */}
      <Modal
        visible={formOpen}
        transparent
        animationType="slide"
        onRequestClose={() => dispatch(closeAddUser())}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add a user</Text>
            <Text style={styles.modalSubtitle}>
              They sign in with this username and password. Write them down —
              you can show them again later from this screen.
            </Text>

            <Text style={styles.fieldLabel}>Full name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={t => dispatch(setFormName(t))}
              placeholder="Ayesha Khan"
              placeholderTextColor={colors.textTertiary}
            />

            <Text style={styles.fieldLabel}>Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={t => dispatch(setFormUsername(t))}
              placeholder="warehouse.ayesha"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.fieldLabel}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={t => dispatch(setFormPassword(t))}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.regenerate}
                onPress={() => dispatch(regeneratePassword())}
              >
                <Feather name="refresh-cw" size={16} color={colors.actionGreen} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Role</Text>
            <View style={styles.roleRow}>
              {(['staff', 'admin'] as const).map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleOption, role === r && styles.roleOptionActive]}
                  onPress={() => dispatch(setFormRole(r))}
                >
                  <Text
                    style={[
                      styles.roleOptionText,
                      role === r && styles.roleOptionTextActive,
                    ]}
                  >
                    {ROLE_STYLE[r].label}
                  </Text>
                  <Text style={styles.roleOptionHint}>
                    {r === 'staff'
                      ? 'Runs day-to-day work. Money out needs your approval.'
                      : 'Full access, including approving and managing users.'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => dispatch(closeAddUser())}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, !canSubmit && styles.modalConfirmDisabled]}
                disabled={!canSubmit || saving}
                onPress={() => dispatch(addUser())}
              >
                <Text style={styles.modalConfirmText}>
                  {saving ? 'Adding…' : 'Add user'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Credentials to hand over ─────────────────────────────────────── */}
      <Modal
        visible={!!issued || !!revealed}
        transparent
        animationType="fade"
        onRequestClose={() => {
          dispatch(dismissIssued());
          dispatch(dismissRevealed());
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Sign-in details</Text>
            <Text style={styles.modalSubtitle}>
              {issued
                ? `Give these to ${issued.name ?? 'them'}. You can show them again from this screen.`
                : 'Read these out to the account holder.'}
            </Text>

            <CredentialRow
              label="Username"
              value={(issued?.username ?? revealed?.username) || '—'}
              onCopy={copy}
            />
            <CredentialRow
              label="Password"
              value={issued?.password ?? revealed?.password ?? null}
              onCopy={copy}
              fallback="Not stored — use Reset password to issue a new one."
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={() => {
                  dispatch(dismissIssued());
                  dispatch(dismissRevealed());
                }}
              >
                <Text style={styles.modalConfirmText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ReportContainer>
  );
};

const CredentialRow: React.FC<{
  label: string;
  value: string | null;
  fallback?: string;
  onCopy: (text: string, label: string) => void;
}> = ({ label, value, fallback, onCopy }) => (
  <View style={styles.credentialRow}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {value ? (
      <TouchableOpacity
        style={styles.credentialValue}
        onPress={() => onCopy(value, label)}
        activeOpacity={0.7}
      >
        <Text style={styles.credentialText}>{value}</Text>
        <Feather name="copy" size={16} color={colors.actionGreen} />
      </TouchableOpacity>
    ) : (
      <Text style={styles.credentialMissing}>{fallback ?? '—'}</Text>
    )}
  </View>
);

const styles = StyleSheet.create({
  list: { padding: spacing.md, backgroundColor: colors.background, flexGrow: 1 },
  card: {
    backgroundColor: colors.neutral0,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.xs,
  },
  cardInactive: { opacity: 0.6 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  cardIdentity: { flex: 1 },
  cardName: { ...typography.labelMd, color: colors.textPrimary },
  cardHandle: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2 },
  rolePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  rolePillText: { ...typography.labelSm },
  inactiveNote: {
    ...typography.bodySm,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  cardAction: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardActionText: { ...typography.labelSm, color: colors.textSecondary },
  footer: {
    padding: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.neutral0,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  modalTitle: { ...typography.displaySm, color: colors.textPrimary },
  modalSubtitle: {
    ...typography.bodySm,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    ...typography.labelSm,
    color: colors.textSecondary,
    marginBottom: 4,
    marginTop: spacing.sm,
  },
  input: {
    ...typography.bodyMd,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  passwordInput: { flex: 1 },
  regenerate: {
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.actionGreenLighter,
  },
  roleRow: { gap: spacing.sm },
  roleOption: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  roleOptionActive: {
    borderColor: colors.actionGreen,
    backgroundColor: colors.actionGreenLighter,
  },
  roleOptionText: { ...typography.labelMd, color: colors.textPrimary },
  roleOptionTextActive: { color: colors.actionGreen },
  roleOptionHint: {
    ...typography.bodySm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  modalCancel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelText: { ...typography.labelMd, color: colors.textSecondary },
  modalConfirm: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.actionGreen,
  },
  modalConfirmDisabled: { opacity: 0.4 },
  modalConfirmText: { ...typography.labelMd, color: colors.neutral0 },
  credentialRow: { marginBottom: spacing.xs },
  credentialValue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: colors.neutral50,
  },
  credentialText: { ...typography.bodyMd, color: colors.textPrimary },
  credentialMissing: { ...typography.bodySm, color: colors.textSecondary },
});

export default UserManagementScreen;
