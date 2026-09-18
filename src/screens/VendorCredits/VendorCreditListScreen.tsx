import React, { useCallback, useMemo } from 'react';
import { StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { THEME } from '../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { fetchVendorCredits, selectVendorCreditState, setVendorCreditStatusFilter, type VendorCreditStatusFilter } from './vendorCreditSlice';
import { formatCurrency } from '../../utils/formatters';
import type { TransactionsStackParamList } from '../../navigators/stacks/TransactionsStack';
import { ReportContainer, ReportHeader, HeaderAction, EmptyBlock, LoadingBlock, ErrorBlock } from '../../components/reports/ReportUI';
import { TxnCard, titleCase } from '../../components/transactions/TxnListUI';
import { FilterTabs, type TabItem } from '../../components/shared/Tabs';
import { txnStatusColor } from '../../components/transactions/txnStatus';

type Nav = NativeStackNavigationProp<TransactionsStackParamList>;
const rs = (n: number) => formatCurrency(n, 'Rs ');


const VendorCreditListScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectVendorCreditState);

  const load = useCallback(() => { dispatch(fetchVendorCredits({})); }, [dispatch]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: state.vendorCredits.length, open: 0, applied: 0, closed: 0, void: 0 };
    state.vendorCredits.forEach(v => { c[v.status] = (c[v.status] ?? 0) + 1; });
    return c;
  }, [state.vendorCredits]);

  const TABS: TabItem<VendorCreditStatusFilter>[] = [
    { label: 'All', value: 'all', count: counts.all },
    { label: 'Open', value: 'open', count: counts.open },
    { label: 'Applied', value: 'applied', count: counts.applied },
    { label: 'Closed', value: 'closed', count: counts.closed },
    { label: 'Void', value: 'void', count: counts.void },
  ];

  const filtered = useMemo(() => {
    if (state.statusFilter === 'all') return state.vendorCredits;
    return state.vendorCredits.filter(v => v.status === state.statusFilter);
  }, [state.vendorCredits, state.statusFilter]);

  return (
    <ReportContainer>
      <ReportHeader
        title="Vendor Credits"
        subtitle="Returns & overcharges"
        onBack={() => navigation.goBack()}
        right={<HeaderAction label="New" onPress={() => navigation.navigate('VendorCreditForm', {})} />}
      />

      <FilterTabs tabs={TABS} active={state.statusFilter} onChange={v => dispatch(setVendorCreditStatusFilter(v))} />

      <ScrollView style={styles.list} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={state.isLoading} onRefresh={load} tintColor={THEME.colors.primary} />}>
        {state.isLoading && state.vendorCredits.length === 0 && <LoadingBlock label="Loading…" />}
        {!!state.error && <ErrorBlock message={state.error} onRetry={load} />}
        {!state.isLoading && state.vendorCredits.length === 0 && !state.error && (
          <EmptyBlock icon="corner-up-left" title="No vendor credits" hint="Tap + to record a credit from a vendor." />
        )}
        {state.vendorCredits.length > 0 && filtered.length === 0 && !state.error && (
          <EmptyBlock icon="search" title="No vendor credits found" hint="Try a different tab." />
        )}
        {filtered.map(v => (
          <TxnCard
            key={v.id}
            number={v.vendorCreditNumber}
            subtitle={v.vendorName || 'Vendor'}
            statusLabel={titleCase(v.status)}
            statusColor={txnStatusColor(v.status)}
            metaLeft={`Date: ${v.date}`}
            primaryLabel="Total"
            primaryValue={rs(v.total)}
            secondaryLabel="Available"
            secondaryValue={rs(v.balance)}
            secondaryColor={v.balance > 0 ? THEME.colors.success : undefined}
            onPress={() => navigation.navigate('VendorCreditDetail', { vendorCreditId: v.id })}
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

export default VendorCreditListScreen;
