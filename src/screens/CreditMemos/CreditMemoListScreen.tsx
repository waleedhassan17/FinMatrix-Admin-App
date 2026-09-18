import React, { useCallback, useMemo } from 'react';
import { StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { THEME } from '../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { fetchCreditMemos, selectCreditMemoState, setCreditMemoStatusFilter, type CreditMemoStatusFilter } from './creditMemoSlice';
import { formatCurrency } from '../../utils/formatters';
import type { TransactionsStackParamList } from '../../navigators/stacks/TransactionsStack';
import { ReportContainer, ReportHeader, HeaderAction, EmptyBlock, LoadingBlock, ErrorBlock } from '../../components/reports/ReportUI';
import { TxnCard, titleCase } from '../../components/transactions/TxnListUI';
import { FilterTabs, type TabItem } from '../../components/shared/Tabs';
import { txnStatusColor } from '../../components/transactions/txnStatus';

type Nav = NativeStackNavigationProp<TransactionsStackParamList>;
const rs = (n: number) => formatCurrency(n, 'Rs ');


const CreditMemoListScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectCreditMemoState);

  const load = useCallback(() => { dispatch(fetchCreditMemos({})); }, [dispatch]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: state.creditMemos.length, open: 0, applied: 0, closed: 0, refunded: 0, void: 0 };
    state.creditMemos.forEach(m => { c[m.status] = (c[m.status] ?? 0) + 1; });
    return c;
  }, [state.creditMemos]);

  const TABS: TabItem<CreditMemoStatusFilter>[] = [
    { label: 'All', value: 'all', count: counts.all },
    { label: 'Open', value: 'open', count: counts.open },
    { label: 'Applied', value: 'applied', count: counts.applied },
    { label: 'Closed', value: 'closed', count: counts.closed },
    { label: 'Refunded', value: 'refunded', count: counts.refunded },
    { label: 'Void', value: 'void', count: counts.void },
  ];

  const filtered = useMemo(() => {
    if (state.statusFilter === 'all') return state.creditMemos;
    return state.creditMemos.filter(m => m.status === state.statusFilter);
  }, [state.creditMemos, state.statusFilter]);

  return (
    <ReportContainer>
      <ReportHeader
        title="Credit Memos"
        subtitle="Customer credits & returns"
        onBack={() => navigation.goBack()}
        right={<HeaderAction label="New" onPress={() => navigation.navigate('CreditMemoForm', {})} />}
      />

      <FilterTabs tabs={TABS} active={state.statusFilter} onChange={v => dispatch(setCreditMemoStatusFilter(v))} />

      <ScrollView style={styles.list} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={state.isLoading} onRefresh={load} tintColor={THEME.colors.primary} />}>
        {state.isLoading && state.creditMemos.length === 0 && <LoadingBlock label="Loading…" />}
        {!!state.error && <ErrorBlock message={state.error} onRetry={load} />}
        {!state.isLoading && state.creditMemos.length === 0 && !state.error && (
          <EmptyBlock icon="rotate-ccw" title="No credit memos" hint="Tap + to issue a customer credit." />
        )}
        {state.creditMemos.length > 0 && filtered.length === 0 && !state.error && (
          <EmptyBlock icon="search" title="No credit memos found" hint="Try a different tab." />
        )}
        {filtered.map(c => (
          <TxnCard
            key={c.id}
            number={c.creditMemoNumber}
            subtitle={c.customerName || 'Customer'}
            statusLabel={titleCase(c.status)}
            statusColor={txnStatusColor(c.status)}
            metaLeft={`Date: ${c.date}`}
            primaryLabel="Total"
            primaryValue={rs(c.total)}
            secondaryLabel="Available"
            secondaryValue={rs(c.balance)}
            secondaryColor={c.balance > 0 ? THEME.colors.success : undefined}
            onPress={() => navigation.navigate('CreditMemoDetail', { creditMemoId: c.id })}
          />
        ))}
      </ScrollView>
    </ReportContainer>
  );
};

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { padding: 16, paddingTop: 4, gap: 10, flexGrow: 1 },
});

export default CreditMemoListScreen;
