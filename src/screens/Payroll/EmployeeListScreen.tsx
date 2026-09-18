import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { THEME } from '../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { fetchEmployees, selectPayrollState } from './payrollSlice';
import { formatCurrency } from '../../utils/formatters';
import type { MoreStackParamList } from '../../navigators/stacks/MoreStack';
import { ReportContainer, ReportHeader, HeaderIconButton, HeaderAction, Badge, EmptyBlock, LoadingBlock, ErrorBlock, ACCENT } from '../../components/reports/ReportUI';

// Design-system tokens (see src/theme/theme.ts).
const { typography } = THEME;

type Nav = NativeStackNavigationProp<MoreStackParamList>;
const rs = (n: number) => formatCurrency(n, 'Rs ');

const EmployeeListScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectPayrollState);
  const load = useCallback(() => { dispatch(fetchEmployees()); }, [dispatch]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ReportContainer>
      <ReportHeader title="Employees" subtitle="Staff & payroll setup" onBack={() => navigation.goBack()}
        right={
          <>
            <HeaderIconButton icon="dollar-sign" onPress={() => navigation.navigate('PayrollRunList' as any)} />
            <HeaderAction label="New" onPress={() => navigation.navigate('EmployeeForm' as any)} />
          </>
        } />
      <ScrollView contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={state.isLoading} onRefresh={load} tintColor={THEME.colors.primary} />}>
        {state.isLoading && state.employees.length === 0 && <LoadingBlock label="Loading employees…" />}
        {!!state.error && <ErrorBlock message={state.error} onRetry={load} />}
        {!state.isLoading && state.employees.length === 0 && !state.error && (
          <EmptyBlock icon="users" title="No employees" hint="Tap + to add an employee." />
        )}
        {state.employees.map(e => (
          <TouchableOpacity key={e.id} style={styles.card} activeOpacity={0.7}
            onPress={() => navigation.navigate('EmployeeForm' as any, { employeeId: e.id })}>
            <View style={styles.cardTop}>
              <Text style={styles.cardName}>{e.firstName} {e.lastName}</Text>
              <Badge label={e.status} color={e.status === 'active' ? ACCENT.green : THEME.colors.textSecondary} dot />
            </View>
            <Text style={styles.cardSub}>{e.position || e.department || 'Staff'} · {e.payType}</Text>
            <Text style={styles.cardPay}>{e.payType === 'hourly' ? `${rs(e.hourlyRate)}/hr` : `${rs(e.salary)}/yr`}</Text>
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
  cardName: { ...THEME.typography.bodyMd, color: THEME.colors.textPrimary, fontWeight: typography.labelLg.fontWeight },
  cardSub: { ...THEME.typography.bodySm, color: THEME.colors.textSecondary, marginTop: 3 },
  cardPay: { ...THEME.typography.labelMd, color: THEME.colors.textPrimary, marginTop: 6 }
});

export default EmployeeListScreen;
