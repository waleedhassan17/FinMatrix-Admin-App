import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { THEME } from '../../utils/theme';
import {
  APPROVAL_TYPE_EFFECTS,
  APPROVAL_TYPE_LABELS,
  type ApprovalRequest,
} from '../../models/approvalModel';

const { colors, radius, spacing, typography } = THEME;

const STATUS_STYLE: Record<
  string,
  { bg: string; fg: string; label: string; icon: keyof typeof Feather.glyphMap }
> = {
  pending: { bg: colors.warningLighter, fg: colors.warning, label: 'Awaiting owner', icon: 'clock' },
  // A decision that was interrupted mid-post. The work MAY already have gone
  // through, so this must not read as an ordinary pending row — showing it as
  // "Awaiting" invited the owner to tap Approve again on something that might
  // already be done.
  approving: { bg: colors.dangerLighter, fg: colors.danger, label: 'Interrupted', icon: 'alert-triangle' },
  approved: { bg: colors.successLighter, fg: colors.success, label: 'Approved', icon: 'check-circle' },
  rejected: { bg: colors.dangerLighter, fg: colors.danger, label: 'Rejected', icon: 'x-circle' },
  cancelled: { bg: colors.neutral100, fg: colors.textSecondary, label: 'Withdrawn', icon: 'slash' },
};

const formatDate = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

/**
 * One request, rendered the same way in the owner's inbox and in a staff
 * member's "My requests" — the difference between the two screens is which
 * actions they hang underneath, not how a request looks.
 */
export const ApprovalRequestCard: React.FC<{
  request: ApprovalRequest;
  /** Rendered under the body: approve/reject for the owner, cancel for staff. */
  actions?: React.ReactNode;
  onPress?: () => void;
}> = ({ request, actions, onPress }) => {
  const status = STATUS_STYLE[request.status] ?? STATUS_STYLE.pending;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.header}>
        <Text style={styles.type}>{APPROVAL_TYPE_LABELS[request.type] ?? request.type}</Text>
        <View style={[styles.pill, { backgroundColor: status.bg }]}>
          <Feather name={status.icon} size={12} color={status.fg} />
          <Text style={[styles.pillText, { color: status.fg }]}>{status.label}</Text>
        </View>
      </View>

      <Text style={styles.summary}>{request.summary}</Text>
      <Text style={styles.effect}>{APPROVAL_TYPE_EFFECTS[request.type] ?? ''}</Text>

      {/* The reason a staff member gave — required for a delivery undo, since
          the owner is being asked to reverse recognised revenue. */}
      {!!request.reason && (
        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>Reason given</Text>
          <Text style={styles.reasonText}>{request.reason}</Text>
        </View>
      )}

      {request.status === 'approving' && (
        <View style={[styles.reasonBox, styles.errorBox]}>
          <Text style={[styles.reasonLabel, { color: colors.danger }]}>
            Interrupted while posting
          </Text>
          <Text style={styles.reasonText}>
            This may already have posted. Check the ledger for the entry before
            deciding it again.
          </Text>
        </View>
      )}

      {/* Why a previous approval attempt failed — a closed period, no stock.
          Kept on the row so it does not vanish with the toast. */}
      {!!request.lastError && (
        <View style={[styles.reasonBox, styles.errorBox]}>
          <Text style={[styles.reasonLabel, { color: colors.danger }]}>
            Last attempt failed
          </Text>
          <Text style={styles.reasonText}>{request.lastError}</Text>
        </View>
      )}

      {!!request.reviewerComment && (
        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>
            {request.status === 'rejected' ? 'Why it was rejected' : 'Note from the owner'}
          </Text>
          <Text style={styles.reasonText}>{request.reviewerComment}</Text>
        </View>
      )}

      <Text style={styles.meta}>
        Requested {formatDate(request.createdAt)}
        {request.reviewedAt ? ` · decided ${formatDate(request.reviewedAt)}` : ''}
      </Text>

      {!!actions && <View style={styles.actions}>{actions}</View>}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral0,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  type: { ...typography.labelMd, color: colors.textPrimary, flexShrink: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  pillText: { ...typography.labelSm },
  summary: { ...typography.bodyMd, color: colors.textPrimary, marginBottom: 2 },
  effect: { ...typography.bodySm, color: colors.textSecondary },
  reasonBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.neutral50,
  },
  errorBox: { backgroundColor: colors.dangerLighter },
  reasonLabel: { ...typography.labelSm, color: colors.textSecondary, marginBottom: 2 },
  reasonText: { ...typography.bodySm, color: colors.textPrimary },
  meta: { ...typography.bodySm, color: colors.textTertiary, marginTop: spacing.sm },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});

export default ApprovalRequestCard;
