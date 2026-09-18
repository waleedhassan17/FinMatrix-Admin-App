import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Modal,
  FlatList,
  StatusBar
} from 'react-native';
import { Alert } from '../../../../utils/alert';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { THEME, STATUS_CONFIG, PRIORITY_CONFIG } from '../../../../utils/theme';
import { ReportHeader, HEADER_NAVY, DateField } from '../../../../components/reports/ReportUI';
import type { MoreStackParamList } from '../../../../navigators/stacks/MoreStack';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import {
  setActiveTab,
  setSelectedDate,
  toggleDeliverySelection,
  clearSelectedDeliveries,
  setSelectedPersonnelId,
  selectActiveTab,
  selectSelectedDate,
  selectSelectedDeliveryIds,
  selectSelectedPersonnelId
} from './assignDeliveriesSlice';
import {
  selectDeliveries,
  selectDeliveryPersonnel,
  assignSelectedDeliveries,
  deleteDelivery,
  fetchDeliveries,
  fetchDeliveryPersonnel
} from './deliverySlice';
import { selectPendingApprovalCount } from '../InventoryApproval/inventoryApprovalSlice';
import CustomButton from '../../../../Custom-Components/CustomButton';
import { useCreditLimitPrompt } from '../../../../hooks/useCreditLimitPrompt';

// Design-system tokens (see src/theme/theme.ts).
const { colors, radius, shadows, spacing, typography } = THEME;

type Nav = NativeStackNavigationProp<MoreStackParamList>;

// Priority colours come from THEME.PRIORITY_CONFIG, the same source the
// driver-facing screens read. The local copies disagreed: `high` was dark
// red on three screens and dark amber on the delivery monitor.
const PRIORITY_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(PRIORITY_CONFIG).map(([k, v]) => [k, v.color]),
);

// One colour per status, matching AdminDeliveryDetail so a delivery reads the
// same wherever it appears.
// Delivery status colours come from THEME.STATUS_CONFIG, the same source
// the driver-facing screens read, so a delivery is one colour on both sides.
const STATUS_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.color]),
);

const statusLabel = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const AssignDeliveriesScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const credit = useCreditLimitPrompt();
  const [isPullRefreshing, setIsPullRefreshing] = React.useState(false);
  const handlePullRefresh = React.useCallback(async () => {
    setIsPullRefreshing(true);
    try {
      await Promise.all([
        dispatch(fetchDeliveries()),
        dispatch(fetchDeliveryPersonnel()),
      ]);
    } finally {
      setIsPullRefreshing(false);
    }
  }, [dispatch]);

  const activeTab = useAppSelector(selectActiveTab);
  const selectedDate = useAppSelector(selectSelectedDate);
  const selectedDeliveryIds = useAppSelector(selectSelectedDeliveryIds);
  const selectedPersonnelId = useAppSelector(selectSelectedPersonnelId);

  const deliveries = useAppSelector(selectDeliveries);
  const personnel = useAppSelector(selectDeliveryPersonnel);
  const pendingApprovalCount = useAppSelector(selectPendingApprovalCount);

  const [showPersonnelModal, setShowPersonnelModal] = useState(false);

  useEffect(() => {
    dispatch(fetchDeliveries());
    dispatch(fetchDeliveryPersonnel());
  }, [dispatch]);

  // Refresh deliveries whenever this screen regains focus (e.g. after creating
  // a delivery) so new/updated deliveries appear immediately, ready to assign.
  useFocusEffect(
    useCallback(() => {
      dispatch(fetchDeliveries());
    }, [dispatch]),
  );

  const filteredUnassigned = useMemo(
    () => deliveries.filter(d => d.status === 'unassigned' && (!selectedDate || d.scheduledDate === selectedDate)),
    [deliveries, selectedDate],
  );

  const pendingList = useMemo(
    () => deliveries.filter(d => d.status === 'pending' || d.status === 'in_transit'),
    [deliveries],
  );

  const approvalsList = useMemo(
    () => deliveries.filter(d => d.status === 'failed' || d.status === 'returned'),
    [deliveries],
  );

  /**
   * Personnel id → display name. The Monitor list printed `assignedTo`
   * straight out, which is the rider's user id, so every row carried a raw
   * UUID where a name belongs.
   */
  const riderName = useCallback(
    (personnelId?: string | null) => {
      if (!personnelId) return 'Unassigned';
      return personnel.find(p => p.userId === personnelId)?.displayName ?? 'Assigned';
    },
    [personnel],
  );

  const handleOpenAssignModal = () => {
    if (!selectedDeliveryIds.length) {
      Alert.alert('No deliveries', 'Select at least one unassigned delivery.');
      return;
    }
    setShowPersonnelModal(true);
  };

  /**
   * Discard the selected unassigned deliveries.
   *
   * This list is the only place unassigned deliveries appear — tapping a row
   * here toggles its checkbox rather than opening the detail screen, so the
   * detail screen's Delete action is unreachable for exactly the deliveries
   * that need it. The action belongs next to Assign, on the same selection.
   *
   * Nothing has been posted for an unassigned delivery, so this changes no
   * stock and no reports; the server re-checks and refuses anything that has
   * been dispatched.
   */
  const handleDeleteSelected = () => {
    if (!selectedDeliveryIds.length) return;
    const n = selectedDeliveryIds.length;
    Alert.alert(
      n === 1 ? 'Delete this delivery?' : `Delete ${n} deliveries?`,
      'They were never dispatched, so nothing has been posted for them. Your inventory and reports are unaffected.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const ids = [...selectedDeliveryIds];
            const failures: string[] = [];
            for (const id of ids) {
              try {
                await dispatch(deleteDelivery(id)).unwrap();
              } catch (err: any) {
                failures.push(err?.message || 'Unable to delete.');
              }
            }
            dispatch(clearSelectedDeliveries());
            await dispatch(fetchDeliveries());
            if (failures.length) {
              // Report honestly rather than claiming a clean sweep — but when
              // nothing went through there is one reason to give, and leading
              // with "0 of 1 removed" just buries it.
              const removed = ids.length - failures.length;
              Alert.alert(
                removed === 0 ? 'Could not delete' : 'Some could not be deleted',
                removed === 0
                  ? failures[0]
                  : `${removed} of ${ids.length} removed. ${failures[0]}`,
              );
            }
          },
        },
      ],
    );
  };

  const handlePickPersonnel = async (personnelId: string, personnelName: string, overrideReason?: string) => {
    setShowPersonnelModal(false);
    try {
      const res = await dispatch(
        assignSelectedDeliveries({ deliveryIds: selectedDeliveryIds, personnelId, overrideReason }),
      ).unwrap();

      dispatch(clearSelectedDeliveries());

      // phase1.md Stage 1: the backend created a Sales Order per delivery and
      // moved the stock to Goods in Transit — surface that to the dispatcher.
      const assigned: any[] = res?.apiResult?.data?.deliveries ?? [];
      const ledgers = assigned.map(d => d?.ledger).filter(Boolean);
      const committed = ledgers.filter((l: any) => l.committed);
      const soNumbers = committed.map((l: any) => l.salesOrderNumber).filter(Boolean);
      const gitTotal = committed.reduce(
        (s: number, l: any) => s + Number(l.goodsInTransitCost ?? 0),
        0,
      );
      const accountingLine = committed.length
        ? `\n\nAccounting: ${
            soNumbers.length
              ? `Sales Order${soNumbers.length === 1 ? '' : 's'} ${soNumbers.join(', ')} created (non-posting)`
              : 'sale document created'
          }. Stock moved to Goods in Transit at cost (Rs ${gitTotal.toLocaleString()}). Revenue posts only when you approve the completed delivery.`
        : '';
      Alert.alert(
        'Assigned',
        `${selectedDeliveryIds.length} delivery(ies) assigned to ${personnelName}.${accountingLine}`,
      );
    } catch (err: any) {
      // Dispatching on credit past the customer's limit: advance or override.
      if (credit.prompt(err, reason => { void handlePickPersonnel(personnelId, personnelName, reason); })) return;
      Alert.alert('Assignment failed', err.message || 'Unable to assign deliveries.');
    }
  };

  const tabs: Array<{ key: 'assign' | 'monitor' | 'approvals'; label: string }> = [
    { key: 'assign', label: 'Assign' },
    { key: 'monitor', label: 'Monitor' },
    { key: 'approvals', label: 'Approvals' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: HEADER_NAVY[0] }]} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={HEADER_NAVY[0]} />
      <ReportHeader
        title="Delivery Management"
        subtitle="Assignment workflow"
        onBack={() => navigation.goBack()}
      />

      <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.dateRow}>
        <Text style={styles.dateLabel}>Schedule Date</Text>
        {/* Deliveries can be scheduled for today or a future date. */}
        <DateField
          value={selectedDate}
          onChangeText={text => dispatch(setSelectedDate(text))}
          maximumDate={new Date(2100, 11, 31)}
        />
      </View>

      <View style={styles.tabBar}>
        {tabs.map(tab => {
          const active = tab.key === activeTab;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => dispatch(setActiveTab(tab.key))}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
              {active && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isPullRefreshing}
            onRefresh={handlePullRefresh}
            tintColor={THEME.colors.primary}
          />
        }
      >
        {activeTab === 'assign' && (
          <>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => navigation.navigate('CreateDelivery')}
            >
              <Text style={styles.navButtonText}>New Delivery</Text>
            </TouchableOpacity>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Unassigned Deliveries</Text>
              {filteredUnassigned.map(d => {
                const checked = selectedDeliveryIds.includes(d.id);
                return (
                  <TouchableOpacity
                    key={d.id}
                    style={styles.deliveryRow}
                    onPress={() => dispatch(toggleDeliverySelection(d.id))}
                  >
                    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                      {checked && <Text style={styles.checkboxTick}>✓</Text>}
                    </View>
                    <View style={styles.deliveryInfo}>
                      <Text style={styles.deliveryRef}>{d.referenceNo} • {d.zone}</Text>
                      <Text style={styles.deliveryMeta}>{d.customerName}</Text>
                    </View>
                    <View style={[styles.priorityPill, { backgroundColor: PRIORITY_COLORS[d.priority] + '18' }]}>
                      <Text style={[styles.priorityText, { color: PRIORITY_COLORS[d.priority] }]}>{d.priority.toUpperCase()}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              {!filteredUnassigned.length && (
                // A bare line of grey text read like an error. Say what the
                // state means and what to do next.
                <View style={styles.inlineEmpty}>
                  <View style={styles.inlineEmptyIcon}>
                    <Feather name="check-circle" size={18} color={colors.success} />
                  </View>
                  <Text style={styles.inlineEmptyTitle}>Everything is assigned</Text>
                  <Text style={styles.inlineEmptyHint}>
                    Nothing is waiting for a rider on this date. Create a delivery to add one.
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.actionRow}>
              <CustomButton
                title={`Assign Selected (${selectedDeliveryIds.length})`}
                onPress={handleOpenAssignModal}
                fullWidth
                disabled={!selectedDeliveryIds.length}
              />
              {/* Only shown with a selection: an empty destructive button on a
                  screen whose main job is assigning would be noise. */}
              {selectedDeliveryIds.length > 0 && (
                <TouchableOpacity
                  style={styles.deleteSelectedBtn}
                  onPress={handleDeleteSelected}
                  activeOpacity={0.8}
                >
                  <Feather name="trash-2" size={15} color={colors.danger} />
                  <Text style={styles.deleteSelectedText}>
                    Delete Selected ({selectedDeliveryIds.length})
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate('AssignWork')}>
              <Text style={styles.navButtonText}>Plan by Rider</Text>
            </TouchableOpacity>
          </>
        )}

        {activeTab === 'monitor' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Monitor</Text>
            </View>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => navigation.navigate('DeliveryMonitor')}
            >
              <Text style={styles.navButtonText}>Open Delivery Monitor</Text>
            </TouchableOpacity>
            {pendingList.slice(0, 5).map(d => (
              <TouchableOpacity
                key={d.id}
                style={styles.simpleRow}
                onPress={() => navigation.navigate('AdminDeliveryDetail', { deliveryId: d.id })}
              >
                <View style={styles.simpleRowTop}>
                  <Text style={styles.simpleTitle} numberOfLines={1}>{d.referenceNo}</Text>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: (STATUS_COLORS[d.status] ?? colors.neutral500) + '18' },
                    ]}
                  >
                    <Text style={[styles.statusPillText, { color: STATUS_COLORS[d.status] ?? colors.neutral500 }]}>
                      {statusLabel(d.status)}
                    </Text>
                  </View>
                </View>
                {/* riderName, not assignedTo — that field is the personnel's
                    user id, and printing it put a raw UUID on screen. */}
                <Text style={styles.simpleSub} numberOfLines={1}>
                  {d.customerName || 'Unnamed customer'} · {riderName(d.assignedTo)}
                </Text>
              </TouchableOpacity>
            ))}
            {pendingList.length === 0 && (
              <Text style={styles.emptyText}>No active deliveries.</Text>
            )}
            {pendingList.length > 5 && (
              <Text style={[styles.emptyText, { textAlign: 'center' }]}>+{pendingList.length - 5} more — open Full Monitor</Text>
            )}
          </View>
        )}

        {activeTab === 'approvals' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Approvals</Text>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => navigation.navigate('InventoryApproval')}
            >
              <Text style={styles.navButtonText}>
                Open Inventory Approval Queue {pendingApprovalCount > 0 ? `(${pendingApprovalCount} pending)` : ''} →
              </Text>
            </TouchableOpacity>
            {approvalsList.map(d => (
              <TouchableOpacity
                key={d.id}
                style={styles.simpleRow}
                onPress={() => navigation.navigate('AdminDeliveryDetail', { deliveryId: d.id })}
              >
                <View style={styles.simpleRowTop}>
                  <Text style={styles.simpleTitle} numberOfLines={1}>{d.referenceNo}</Text>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: (STATUS_COLORS[d.status] ?? colors.neutral500) + '18' },
                    ]}
                  >
                    <Text style={[styles.statusPillText, { color: STATUS_COLORS[d.status] ?? colors.neutral500 }]}>
                      {statusLabel(d.status)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.simpleSub} numberOfLines={2}>
                  {d.customerName || 'Unnamed customer'}
                  {d.notes ? ` · ${d.notes}` : ''}
                </Text>
              </TouchableOpacity>
            ))}
            {approvalsList.length === 0 && (
              <Text style={styles.emptyText}>No failed or returned deliveries.</Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Personnel Picker Modal ──────────────────── */}
      <Modal visible={showPersonnelModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Select Delivery Personnel</Text>
            <Text style={styles.modalSubtitle}>
              Assigning {selectedDeliveryIds.length} delivery(ies)
            </Text>

            <FlatList
              // Only riders who can take work. The server refuses a rider who
              // is deactivated, on leave, or paused by the plan's rider limit,
              // so offering them here would end in an error after the tap.
              data={personnel.filter(
                p => p.status !== 'inactive' && p.status !== 'on_leave' && p.status !== 'plan_locked',
              )}
              keyExtractor={p => p.userId}
              style={styles.modalList}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No active delivery personnel found.</Text>
              }
              renderItem={({ item: p }) => {
                const loadPercent = Math.min(100, Math.round((p.currentLoad / Math.max(1, p.maxLoad)) * 100));
                return (
                  <TouchableOpacity
                    style={styles.modalPersonRow}
                    onPress={() => handlePickPersonnel(p.userId, p.displayName)}
                  >
                    <View style={styles.modalPersonAvatar}>
                      <Text style={styles.modalPersonInitials}>
                        {p.displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalPersonName}>{p.displayName}</Text>
                      <Text style={styles.modalPersonMeta}>
                        {p.vehicleType} • {p.currentLoad}/{p.maxLoad} load • {loadPercent}%
                      </Text>
                    </View>
                    <Text style={styles.modalAssignBtn}>Assign</Text>
                  </TouchableOpacity>
                );
              }}
            />

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setShowPersonnelModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      </View>
      {credit.modal}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  title: {
    ...typography.h2,
    
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 2,
    color: colors.textSecondary,
  },
  dateRow: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  dateLabel: {
    ...typography.bodySm,
    marginBottom: spacing.xxs,
    color: colors.textSecondary,
  },
  dateInput: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.xs,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  tabActive: {},
  tabText: {
    ...typography.h5,
    color: colors.textSecondary,
    
  },
  tabTextActive: {
    color: colors.actionGreen,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: spacing.md,
    right: spacing.md,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.actionGreen,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    ...typography.labelLg,
    
    color: colors.textPrimary,
  },

  navButton: {
    backgroundColor: colors.secondary + '12',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.secondary + '35',
    marginTop: spacing.xs,
  },
  navButtonText: {
    ...typography.h5,
    color: colors.secondary,
  },
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    marginRight: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkboxChecked: {
    backgroundColor: colors.actionGreen,
    borderColor: colors.actionGreen,
  },
  checkboxTick: {
    ...typography.h5,
    color: colors.surface,
  },
  deliveryInfo: { flex: 1 },
  deliveryRef: {
    ...typography.h5,
    color: colors.textPrimary,
  },
  deliveryMeta: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  priorityPill: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priorityText: {
    ...typography.overline,
  },
  emptyText: {
    color: colors.textSecondary,
  },
  inlineEmpty: { alignItems: 'center', paddingVertical: spacing.xl, gap: 5 },
  inlineEmptyIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success + '14',
    marginBottom: 2,
  },
  inlineEmptyTitle: {
    ...typography.h5,
    
    color: colors.textPrimary,
  },
  inlineEmptyHint: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: spacing.md,
  },
  personnelRow: { paddingVertical: spacing.xxs, gap: spacing.xs },
  personCard: {
    width: 210,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    backgroundColor: colors.background,
  },
  personCardSelected: {
    borderColor: colors.actionGreen,
    backgroundColor: colors.actionGreen + '10',
  },
  personName: {
    ...typography.h5,
    color: colors.textPrimary,
  },
  personMeta: {
    marginTop: 2,
    color: colors.textSecondary,
    ...typography.caption,
  },
  loadTrack: {
    height: 6,
    borderRadius: 4,
    backgroundColor: colors.border,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  loadFill: {
    height: 6,
    backgroundColor: colors.success,
  },
  zoneText: {
    marginTop: spacing.xs,
    ...typography.caption,
    color: colors.textSecondary,
  },
  actionRow: {
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  deleteSelectedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.danger + '55',
    backgroundColor: colors.danger + '0D',
  },
  deleteSelectedText: {
    ...THEME.typography.labelMd,
    
    color: colors.danger,
  },
  simpleRow: {
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight ?? colors.border,
    gap: 3,
  },
  // Reference on the left, status pill hard right — the two things you scan
  // a monitor list for, on one line instead of run together with a bullet.
  simpleRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  simpleTitle: {
    ...typography.h5,
    color: colors.textPrimary,
    flex: 1,
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 11,
  },
  statusPillText: {
    ...typography.overline,
    
    letterSpacing: 0.2,
  },
  simpleSub: {
    color: colors.textSecondary,
    ...typography.caption,
  },

  // ── Personnel Picker Modal ─────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    maxHeight: '70%',
  },
  modalTitle: {
    ...typography.h3,
    
    color: colors.textPrimary,
  },
  modalSubtitle: {
    ...typography.bodySm,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  modalList: {
    flexGrow: 0,
  },
  modalPersonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalPersonAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.actionGreen + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  modalPersonInitials: {
    ...typography.h5,
    
    color: colors.actionGreen,
  },
  modalPersonName: {
    ...typography.labelLg,
    
    color: colors.textPrimary,
  },
  modalPersonMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalAssignBtn: {
    ...typography.labelMd,
    
    color: colors.actionGreen,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  modalCancelBtn: {
    marginTop: spacing.md,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: 10,
    backgroundColor: colors.background,
  },
  modalCancelText: {
    ...typography.labelLg,
    
    color: colors.textSecondary,
  }
});

export default AssignDeliveriesScreen;
