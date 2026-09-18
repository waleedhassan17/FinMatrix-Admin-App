import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar
} from 'react-native';
import { Alert } from '../../../../utils/alert';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HEADER_NAVY } from '../../../../components/reports/ReportUI';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { THEME, PRIORITY_CONFIG } from '../../../../utils/theme';
import type { MoreStackParamList } from '../../../../navigators/stacks/MoreStack';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { selectUnassignedDeliveries, selectDeliveryPersonnel, assignSelectedDeliveries } from '../AssignDeliveries/deliverySlice';
import { selectAssignWorkState, toggleDelivery, setPersonnel, resetAssignWork } from './assignWorkSlice';
import CustomButton from '../../../../Custom-Components/CustomButton';
import { useCreditLimitPrompt } from '../../../../hooks/useCreditLimitPrompt';

// Design-system tokens (see src/theme/theme.ts).
const { colors, radius, shadows, spacing, typography } = THEME;

// Priority colours come from THEME.PRIORITY_CONFIG, the same source the
// driver-facing screens read. The local copies disagreed: `high` was dark
// red on three screens and dark amber on the delivery monitor.
const PRIORITY_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(PRIORITY_CONFIG).map(([k, v]) => [k, v.color]),
);

type Props = NativeStackScreenProps<MoreStackParamList, 'AssignWork'>;

const PRIORITY_RANK: Record<string, number> = { urgent: 4, high: 3, medium: 2, normal: 2, low: 1 };

/** Chooses ONE rider and the deliveries in their zone, using the rule the old
 *  local-only reducer used: highest priority first, rider with the lightest
 *  current load. Assigning is a single server call per rider, so we commit one
 *  rider's batch at a time rather than pretending to allocate everybody. */
const pickAutoAssignment = (
  deliveries: { id: string; zone?: string; priority?: string; status?: string }[],
  personnel: { userId: string; displayName?: string; status?: string; zones?: string[]; currentLoad?: number }[],
  onlyIds: string[],
): { personnelId: string; personnelName: string; deliveryIds: string[] } | null => {
  const pool = deliveries
    .filter(d => d.status === 'unassigned' && (onlyIds.length === 0 || onlyIds.includes(d.id)))
    .sort((a, b) => (PRIORITY_RANK[b.priority ?? ''] ?? 0) - (PRIORITY_RANK[a.priority ?? ''] ?? 0));
  if (pool.length === 0) return null;

  for (const delivery of pool) {
    const rider = personnel
      .filter(p => p.status === 'active' && !!delivery.zone && (p.zones ?? []).includes(delivery.zone))
      .sort((a, b) => (a.currentLoad ?? 0) - (b.currentLoad ?? 0))[0];
    if (!rider) continue;
    return {
      personnelId: rider.userId,
      personnelName: rider.displayName ?? 'the rider',
      deliveryIds: pool.filter(d => d.zone === delivery.zone).map(d => d.id),
    };
  }
  return null;
};

const AssignWorkScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const credit = useCreditLimitPrompt();
  const deliveries = useAppSelector(selectUnassignedDeliveries);
  const [busy, setBusy] = useState(false);
  const personnel = useAppSelector(selectDeliveryPersonnel).filter(p => p.status === 'active');
  const assignState = useAppSelector(selectAssignWorkState);

  const selectedDeliveries = useMemo(
    () => deliveries.filter(d => assignState.selectedDeliveryIds.includes(d.id)),
    [deliveries, assignState.selectedDeliveryIds],
  );

  const selectedPerson = personnel.find(p => p.userId === assignState.selectedPersonnelId);

  const handleAssign = (overrideReason?: string) => {
    if (!assignState.selectedDeliveryIds.length || !assignState.selectedPersonnelId) {
      Alert.alert('Missing selection', 'Select deliveries and one personnel before assigning.');
      return;
    }

    // Assigning dispatches stock (Dr Goods in Transit / Cr Inventory), so the
    // result has to be awaited — the old code fired an "Assigned" alert
    // without waiting, and a 4xx still read as success.
    setBusy(true);
    dispatch(assignSelectedDeliveries({
      deliveryIds: assignState.selectedDeliveryIds,
      personnelId: assignState.selectedPersonnelId,
      overrideReason,
    }))
      .unwrap()
      .then(() => {
        dispatch(resetAssignWork());
        Alert.alert('Assigned', 'Selected deliveries moved to pending and stock committed to the rider.');
      })
      .catch((e: any) => {
        // Past a customer's credit limit: take an advance, or the owner overrides.
        if (credit.prompt(e, reason => handleAssign(reason))) return;
        Alert.alert('Assign failed', e?.message ?? 'Could not assign the selected deliveries.');
      })
      .finally(() => setBusy(false));
  };

  // Auto-assign picks the rider here on the client, then goes through the very
  // same server call as a manual assign. It used to only rewrite Redux and
  // announce success, so the allocation vanished on the next refetch.
  const handleAutoAssign = (overrideReason?: string) => {
    const picked = pickAutoAssignment(deliveries, personnel, assignState.selectedDeliveryIds);
    if (!picked) {
      Alert.alert('Nothing to assign', 'No pending delivery matches an available rider in its zone.');
      return;
    }
    setBusy(true);
    dispatch(assignSelectedDeliveries({ deliveryIds: picked.deliveryIds, personnelId: picked.personnelId, overrideReason }))
      .unwrap()
      .then(() => {
        dispatch(resetAssignWork());
        Alert.alert('Auto-assigned', `${picked.deliveryIds.length} deliver${picked.deliveryIds.length === 1 ? 'y' : 'ies'} assigned to ${picked.personnelName}.`);
      })
      .catch((e: any) => {
        if (credit.prompt(e, reason => handleAutoAssign(reason))) return;
        Alert.alert('Auto-assign failed', e?.message ?? 'Could not assign.');
      })
      .finally(() => setBusy(false));
  };

  return (
    <SafeAreaView style={[styles.container, styles.safeTop]} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={HEADER_NAVY[0]} />
      <View style={styles.body}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={colors.neutral0} />
        </TouchableOpacity>
        <Text style={styles.title}>Assign Work</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Panel 1: Select Deliveries</Text>
          {deliveries.map(d => {
            const selected = assignState.selectedDeliveryIds.includes(d.id);
            return (
              <TouchableOpacity key={d.id} style={styles.row} onPress={() => dispatch(toggleDelivery(d.id))}>
                <View style={[styles.check, selected && styles.checkSelected]}>
                  {selected && <Text style={styles.checkTick}>✓</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{d.referenceNo} • {d.zone}</Text>
                  <Text style={styles.rowSub}>{d.customerName}</Text>
                </View>
                <Text style={[styles.priority, { color: PRIORITY_COLORS[d.priority] }]}>{d.priority.toUpperCase()}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Panel 2: Select Personnel</Text>
          {personnel.map(p => {
            const selected = assignState.selectedPersonnelId === p.userId;
            return (
              <TouchableOpacity key={p.userId} style={styles.row} onPress={() => dispatch(setPersonnel(p.userId))}>
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected && <View style={styles.radioDot} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{p.displayName}</Text>
                  <Text style={styles.rowSub}>{p.currentLoad}/{p.maxLoad} load • {p.zones.join(', ')}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Panel 3: Review & Assign</Text>
          <Text style={styles.summary}>Deliveries selected: {selectedDeliveries.length}</Text>
          <Text style={styles.summary}>Personnel selected: {selectedPerson ? selectedPerson.displayName : 'None'}</Text>
          <View style={{ marginTop: spacing.md }}>
            <CustomButton title="Assign Selected" onPress={() => handleAssign()} fullWidth />
          </View>
          <View style={{ marginTop: spacing.xs }}>
            <CustomButton title="Auto-Assign" onPress={() => handleAutoAssign()} variant="secondary" fullWidth />
          </View>
        </View>
      </ScrollView>
      </View>
      {credit.modal}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  safeTop: { backgroundColor: HEADER_NAVY[0] },
  body: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    backgroundColor: HEADER_NAVY[0],
  },
  back: {
    ...typography.h1,
    color: colors.textPrimary,
    marginTop: -2,
  },
  title: {
    ...typography.h3,
    
    color: colors.neutral0,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  panelTitle: {
    ...typography.labelLg,
    
    marginBottom: spacing.xs,
    color: colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.xs,
  },
  check: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    marginRight: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkSelected: {
    backgroundColor: colors.actionGreen,
    borderColor: colors.actionGreen,
  },
  checkTick: {
    ...typography.h5,
    color: colors.surface,
  },
  radio: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    marginRight: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: colors.actionGreen,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.actionGreen,
  },
  rowTitle: {
    ...typography.h5,
    color: colors.textPrimary,
  },
  rowSub: {
    color: colors.textSecondary,
    ...typography.caption,
    marginTop: 2,
  },
  priority: {
    ...typography.overline,
  },
  summary: {
    color: colors.textSecondary,
    marginBottom: spacing.xxs,
  }
});

export default AssignWorkScreen;
