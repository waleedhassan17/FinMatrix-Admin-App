import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

import { THEME } from '../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { fetchEstimates, selectEstimateState, setEstimateStatusFilter, type EstimateStatusFilter } from './estimateSlice';
import { formatCurrency } from '../../utils/formatters';
import type { TransactionsStackParamList } from '../../navigators/stacks/TransactionsStack';
import { ReportContainer, ReportHeader, HeaderAction, EmptyBlock, LoadingBlock, ErrorBlock } from '../../components/reports/ReportUI';
import { TxnCard, titleCase } from '../../components/transactions/TxnListUI';
import { FilterTabs, type TabItem } from '../../components/shared/Tabs';
import { txnStatusColor } from '../../components/transactions/txnStatus';

type Nav = NativeStackNavigationProp<TransactionsStackParamList>;
const rs = (n: number) => formatCurrency(n, 'Rs ');


const EstimateListScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectEstimateState);
  const [q, setQ] = useState('');

  // Load ALL estimates once so tab counts are accurate and switching tabs is
  // instant client-side — no refetch flicker that shifts layout.
  const load = useCallback(() => { dispatch(fetchEstimates({})); }, [dispatch]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: state.estimates.length, draft: 0, sent: 0, accepted: 0, converted: 0, declined: 0 };
    state.estimates.forEach(e => { c[e.status] = (c[e.status] ?? 0) + 1; });
    return c;
  }, [state.estimates]);

  const TABS: TabItem<EstimateStatusFilter>[] = [
    { label: 'All', value: 'all', count: counts.all },
    { label: 'Draft', value: 'draft', count: counts.draft },
    { label: 'Sent', value: 'sent', count: counts.sent },
    { label: 'Accepted', value: 'accepted', count: counts.accepted },
    { label: 'Converted', value: 'converted', count: counts.converted },
    { label: 'Declined', value: 'declined', count: counts.declined },
  ];

  const filtered = useMemo(() => {
    let list = state.estimates;
    if (state.statusFilter !== 'all') list = list.filter(e => e.status === state.statusFilter);
    const term = q.trim().toLowerCase();
    if (term) {
      list = list.filter(
        e => e.estimateNumber.toLowerCase().includes(term) || (e.customerName || '').toLowerCase().includes(term),
      );
    }
    return list;
  }, [state.estimates, state.statusFilter, q]);

  return (
    <ReportContainer>
      <ReportHeader
        title="Estimates"
        subtitle="Quotes & proposals"
        onBack={() => navigation.goBack()}
        right={<HeaderAction label="New" onPress={() => navigation.navigate('EstimateForm', {})} />}
      />
      <View style={styles.searchWrap}>
        <Feather name="search" size={16} color={THEME.colors.textSecondary} />
        <TextInput
          style={styles.search}
          placeholder="Search estimates…"
          placeholderTextColor={THEME.colors.textSecondary}
          value={q}
          onChangeText={setQ}
          returnKeyType="search"
        />
        {q.length > 0 && <TouchableOpacity onPress={() => setQ('')}><Feather name="x" size={16} color={THEME.colors.textSecondary} /></TouchableOpacity>}
      </View>

      <FilterTabs tabs={TABS} active={state.statusFilter} onChange={v => dispatch(setEstimateStatusFilter(v))} />

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={state.isLoading} onRefresh={load} tintColor={THEME.colors.primary} />}
      >
        {state.isLoading && state.estimates.length === 0 && <LoadingBlock label="Loading estimates…" />}
        {!!state.error && <ErrorBlock message={state.error} onRetry={load} />}
        {!state.isLoading && state.estimates.length === 0 && !state.error && (
          <EmptyBlock icon="file-text" title="No estimates yet" hint="Tap + to create your first quote." />
        )}
        {state.estimates.length > 0 && filtered.length === 0 && !state.error && (
          <EmptyBlock icon="search" title="No estimates found" hint="Try a different tab or search." />
        )}
        {filtered.map(e => (
          <TxnCard
            key={e.id}
            number={e.estimateNumber}
            subtitle={e.customerName || 'Customer'}
            statusLabel={titleCase(e.status)}
            statusColor={txnStatusColor(e.status)}
            metaLeft={`Date: ${e.estimateDate}`}
            metaRight={e.expiryDate ? `Valid till: ${e.expiryDate}` : undefined}
            primaryLabel="Total"
            primaryValue={rs(e.total)}
            onPress={() => navigation.navigate('EstimateDetail', { estimateId: e.id })}
          />
        ))}
      </ScrollView>
    </ReportContainer>
  );
};

const styles = StyleSheet.create({
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 8, paddingHorizontal: 12, height: 42, backgroundColor: THEME.colors.surface, borderRadius: 10, borderWidth: 1, borderColor: THEME.colors.border },
  search: { flex: 1, ...THEME.typography.bodyMd, color: THEME.colors.textPrimary },
  list: { flex: 1 },
  content: { padding: 16, paddingTop: 4, gap: 10, flexGrow: 1 },
});

export default EstimateListScreen;
