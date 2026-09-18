import React, { useCallback, useMemo } from 'react';
import { StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { THEME } from '../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { fetchSalesOrders, selectSalesOrderState, setSalesOrderStatusFilter, type SalesOrderStatusFilter } from './salesOrderSlice';
import { formatCurrency } from '../../utils/formatters';
import type { TransactionsStackParamList } from '../../navigators/stacks/TransactionsStack';
import { ReportContainer, ReportHeader, HeaderAction, EmptyBlock, LoadingBlock, ErrorBlock } from '../../components/reports/ReportUI';
import { TxnCard, titleCase } from '../../components/transactions/TxnListUI';
import { FilterTabs, type TabItem } from '../../components/shared/Tabs';
import { txnStatusColor } from '../../components/transactions/txnStatus';

type Nav = NativeStackNavigationProp<TransactionsStackParamList>;
const rs = (n: number) => formatCurrency(n, 'Rs ');


const SalesOrderListScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectSalesOrderState);

  const load = useCallback(() => { dispatch(fetchSalesOrders({})); }, [dispatch]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: state.salesOrders.length, open: 0, partial: 0, fulfilled: 0, invoiced: 0, cancelled: 0 };
    state.salesOrders.forEach(o => { c[o.status] = (c[o.status] ?? 0) + 1; });
    return c;
  }, [state.salesOrders]);

  const TABS: TabItem<SalesOrderStatusFilter>[] = [
    { label: 'All', value: 'all', count: counts.all },
    { label: 'Open', value: 'open', count: counts.open },
    { label: 'Partial', value: 'partial', count: counts.partial },
    { label: 'Fulfilled', value: 'fulfilled', count: counts.fulfilled },
    { label: 'Invoiced', value: 'invoiced', count: counts.invoiced },
    { label: 'Cancelled', value: 'cancelled', count: counts.cancelled },
  ];

  const filtered = useMemo(() => {
    if (state.statusFilter === 'all') return state.salesOrders;
    return state.salesOrders.filter(o => o.status === state.statusFilter);
  }, [state.salesOrders, state.statusFilter]);

  return (
    <ReportContainer>
      <ReportHeader
        title="Sales Orders"
        subtitle="Fulfillment & invoicing"
        onBack={() => navigation.goBack()}
        right={<HeaderAction label="New" onPress={() => navigation.navigate('SalesOrderForm', {})} />}
      />

      <FilterTabs tabs={TABS} active={state.statusFilter} onChange={v => dispatch(setSalesOrderStatusFilter(v))} />

      <ScrollView style={styles.list} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={state.isLoading} onRefresh={load} tintColor={THEME.colors.primary} />}>
        {state.isLoading && state.salesOrders.length === 0 && <LoadingBlock label="Loading sales orders…" />}
        {!!state.error && <ErrorBlock message={state.error} onRetry={load} />}
        {!state.isLoading && state.salesOrders.length === 0 && !state.error && (
          <EmptyBlock icon="clipboard" title="No sales orders" hint="Tap + to create one, or convert an accepted estimate." />
        )}
        {state.salesOrders.length > 0 && filtered.length === 0 && !state.error && (
          <EmptyBlock icon="search" title="No sales orders found" hint="Try a different tab." />
        )}
        {filtered.map(o => {
          const fulfilledLines = o.lines.filter(l => l.quantityFulfilled >= l.quantity).length;
          return (
            <TxnCard
              key={o.id}
              number={o.orderNumber}
              subtitle={o.customerName || 'Customer'}
              statusLabel={titleCase(o.status)}
              statusColor={txnStatusColor(o.status)}
              metaLeft={`Order: ${o.orderDate}`}
              metaRight={`${fulfilledLines}/${o.lines.length} lines`}
              primaryLabel="Total"
              primaryValue={rs(o.total)}
              onPress={() => navigation.navigate('SalesOrderDetail', { salesOrderId: o.id })}
            />
          );
        })}
      </ScrollView>
    </ReportContainer>
  );
};

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { padding: 16, paddingTop: 4, gap: 10, flexGrow: 1 },
});

export default SalesOrderListScreen;
