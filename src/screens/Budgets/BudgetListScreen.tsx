import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { THEME } from '../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { fetchBudgets, selectBudgetState } from './budgetSlice';
import { formatCurrency } from '../../utils/formatters';
import type { ReportsStackParamList } from '../../navigators/stacks/ReportsStack';
import { ReportContainer, ReportHeader, HeaderAction, Badge, EmptyBlock, LoadingBlock, ErrorBlock, ACCENT } from '../../components/reports/ReportUI';

// Design-system tokens (see src/theme/theme.ts).
const { typography } = THEME;

type Nav = NativeStackNavigationProp<ReportsStackParamList>;
const rs = (n: number) => formatCurrency(n, 'Rs ');
const STATUS_COLOR: Record<string, string> = { draft: THEME.colors.textSecondary, active: ACCENT.green, archived: ACCENT.amber };

const BudgetListScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectBudgetState);
  const load = useCallback(() => { dispatch(fetchBudgets()); }, [dispatch]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ReportContainer>
      <ReportHeader title="Budgets" subtitle="Plan & track by fiscal year" onBack={() => navigation.goBack()}
        right={<HeaderAction label="New" onPress={() => navigation.navigate('BudgetForm' as any)} />} />
      <ScrollView contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={state.isLoading} onRefresh={load} tintColor={THEME.colors.primary} />}>
        {state.isLoading && state.budgets.length === 0 && <LoadingBlock label="Loading budgets…" />}
        {!!state.error && <ErrorBlock message={state.error} onRetry={load} />}
        {!state.isLoading && state.budgets.length === 0 && !state.error && (
          <EmptyBlock icon="pie-chart" title="No budgets yet" hint="Tap + to create a fiscal-year budget." />
        )}
        {state.budgets.map(b => (
          <TouchableOpacity key={b.id} style={styles.card} activeOpacity={0.7}
            onPress={() => navigation.navigate('BudgetDetail' as any, { budgetId: b.id })}>
            <View style={styles.cardTop}>
              <Text style={styles.cardNumber}>{b.name}</Text>
              <Badge label={b.status} color={STATUS_COLOR[b.status] ?? THEME.colors.textSecondary} dot />
            </View>
            <View style={styles.cardBottom}>
              <Text style={styles.cardDate}>FY {b.fiscalYear}</Text>
              <Text style={styles.cardTotal}>{rs(b.totalBudget)}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </ReportContainer>
  );
};

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10 },
  card: { backgroundColor: THEME.colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: THEME.colors.border },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardNumber: { ...THEME.typography.labelLg, color: THEME.colors.textPrimary, flex: 1 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  cardDate: { ...THEME.typography.labelSm, color: THEME.colors.textSecondary },
  cardTotal: { ...THEME.typography.bodyMd, color: THEME.colors.textPrimary, fontWeight: typography.labelLg.fontWeight }
});

export default BudgetListScreen;
