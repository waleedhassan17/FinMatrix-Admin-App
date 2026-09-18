import React, { useCallback, useMemo } from 'react';
import { StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { THEME } from '../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import {
  fetchJournalEntries, selectJournalEntryState, setJournalStatusFilter,
  type JournalEntryStatusFilter
} from './journalEntrySlice';
import { formatCurrency } from '../../utils/formatters';
import type { TransactionsStackParamList } from '../../navigators/stacks/TransactionsStack';
import { ReportContainer, ReportHeader, HeaderAction, EmptyBlock, LoadingBlock, ErrorBlock } from '../../components/reports/ReportUI';
import { TxnCard, titleCase } from '../../components/transactions/TxnListUI';
import { FilterTabs, type TabItem } from '../../components/shared/Tabs';
import { txnStatusColor } from '../../components/transactions/txnStatus';

type Nav = NativeStackNavigationProp<TransactionsStackParamList>;
const rs = (n: number) => formatCurrency(n, 'Rs ');


const GeneralJournalListScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectJournalEntryState);

  const load = useCallback(() => { dispatch(fetchJournalEntries({})); }, [dispatch]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: state.entries.length, draft: 0, posted: 0, void: 0 };
    state.entries.forEach(e => { c[e.status] = (c[e.status] ?? 0) + 1; });
    return c;
  }, [state.entries]);

  const TABS: TabItem<JournalEntryStatusFilter>[] = [
    { label: 'All', value: 'all', count: counts.all },
    { label: 'Draft', value: 'draft', count: counts.draft },
    { label: 'Posted', value: 'posted', count: counts.posted },
    { label: 'Void', value: 'void', count: counts.void },
  ];

  const filtered = useMemo(() => {
    if (state.statusFilter === 'all') return state.entries;
    return state.entries.filter(e => e.status === state.statusFilter);
  }, [state.entries, state.statusFilter]);

  return (
    <ReportContainer>
      <ReportHeader
        title="General Journal"
        subtitle="Manual journal entries"
        onBack={() => navigation.goBack()}
        right={<HeaderAction label="New" onPress={() => navigation.navigate('JournalEntryForm', {})} />}
      />

      <FilterTabs tabs={TABS} active={state.statusFilter} onChange={v => dispatch(setJournalStatusFilter(v))} />

      <ScrollView style={styles.list} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={state.isLoading} onRefresh={load} tintColor={THEME.colors.primary} />}>
        {state.isLoading && state.entries.length === 0 && <LoadingBlock label="Loading…" />}
        {!!state.error && <ErrorBlock message={state.error} onRetry={load} />}
        {!state.isLoading && state.entries.length === 0 && !state.error && (
          <EmptyBlock icon="book-open" title="No journal entries" hint="Tap + to record a manual entry." />
        )}
        {state.entries.length > 0 && filtered.length === 0 && !state.error && (
          <EmptyBlock icon="search" title="No journal entries found" hint="Try a different tab." />
        )}
        {filtered.map(e => (
          <TxnCard
            key={e.id}
            number={e.reference}
            subtitle={e.memo || 'No memo'}
            statusLabel={titleCase(e.status)}
            statusColor={txnStatusColor(e.status)}
            metaLeft={`Date: ${e.date}`}
            primaryLabel="Total"
            primaryValue={rs(e.totalDebits)}
            onPress={() => navigation.navigate('JournalEntryDetail', { entryId: e.id })}
          />
        ))}
      </ScrollView>
    </ReportContainer>
  );
};

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { padding: 16, paddingTop: 4, gap: 10, flexGrow: 1 }
});

export default GeneralJournalListScreen;
