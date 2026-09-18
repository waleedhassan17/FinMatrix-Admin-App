import dayjs from 'dayjs';
import React, { useEffect } from 'react';
import { View, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { THEME } from '../../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { fetchInventoryValuationReport, selectInventoryValuationState } from './inventoryValuationSlice';
import { formatCurrency } from '../../../utils/formatters';
import type { ReportsStackParamList } from '../../../navigators/stacks/ReportsStack';
import {
  ReportContainer,
  ReportHeader,
  SectionCard,
  KpiGrid,
  SummaryLine,
  Divider,
  TCell,
  tableStyles,
  LoadingBlock,
  ErrorBlock,
  EmptyBlock,
  Card,
  ACCENT,
  reportContentStyle,
  ReportTitleBlock,
  useStatementCompany,
  asOfLabel
} from '../../../components/reports/ReportUI';

type ReportsNav = NativeStackNavigationProp<ReportsStackParamList>;

const rs = (n: number) => formatCurrency(n, 'Rs ');

const InventoryValuationScreen: React.FC = () => {
  const navigation = useNavigation<ReportsNav>();
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectInventoryValuationState);
  const company = useStatementCompany();

  useEffect(() => {
    dispatch(fetchInventoryValuationReport());
  }, [dispatch]);

  const report = state.report;
  const rows = report?.rows ?? [];
  const categories = report?.byCategory ?? [];

  return (
    <ReportContainer>
      <ReportHeader title="Inventory Valuation" subtitle="Stock on hand" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={reportContentStyle} showsVerticalScrollIndicator={false}>
        {state.isLoading && <LoadingBlock label="Valuing inventory…" />}
        {!!state.error && (
          <ErrorBlock message={state.error} onRetry={() => dispatch(fetchInventoryValuationReport())} />
        )}

        {report && !state.isLoading && (
          <>
            <KpiGrid
              items={[
                { label: 'Total Value', value: rs(report.totalValue ?? 0), accent: ACCENT.brand, icon: 'dollar-sign' },
                { label: 'Items', value: String(rows.length), accent: ACCENT.blue, icon: 'box' },
                { label: 'Categories', value: String(categories.length), accent: ACCENT.violet, icon: 'grid' },
              ]}
            />

            {/* The endpoint values stock as it stands now — there is no date filter. */}
            <ReportTitleBlock
              company={company}
              report="Inventory Valuation Summary"
              periodLabel={asOfLabel(dayjs().format('YYYY-MM-DD'))}
            />

            {categories.length > 0 && (
              <SectionCard title="Value by Category" icon="layers">
                {categories.map(cat => (
                  <SummaryLine key={cat.category} label={cat.category} value={rs(cat.totalValue)} />
                ))}
                <Divider />
                <SummaryLine label="Total Inventory Value" value={rs(report.totalValue ?? 0)} strong highlight valueColor={THEME.colors.primaryHover} />
              </SectionCard>
            )}

            {rows.length === 0 ? (
              <Card>
                <EmptyBlock icon="box" title="No inventory items" hint="Add items to see valuation." />
              </Card>
            ) : (
              <SectionCard title="Items" icon="package">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View>
                    <View style={tableStyles.head}>
                      <TCell width={200} head>Item</TCell>
                      <TCell width={120} head>SKU</TCell>
                      <TCell width={70} head align="right">Qty</TCell>
                      <TCell width={110} head align="right">Avg Cost</TCell>
                      <TCell width={130} head align="right">Asset Value</TCell>
                    </View>
                    {rows.map((row, i) => (
                      <View key={row.itemId} style={[tableStyles.row, i % 2 === 1 && tableStyles.rowAlt]}>
                        <TCell width={200}>{row.itemName}</TCell>
                        <TCell width={120} color={THEME.colors.textTertiary}>{row.sku}</TCell>
                        <TCell width={70} align="right">{String(row.qty)}</TCell>
                        <TCell width={110} align="right">{rs(row.cost)}</TCell>
                        <TCell width={130} align="right" strong>{rs(row.value)}</TCell>
                      </View>
                    ))}
                    {/* The server's own totalValue — the rows above are not re-summed. */}
                    <View style={tableStyles.totalRow}>
                      <TCell width={200} strong>TOTAL</TCell>
                      <TCell width={120}>{''}</TCell>
                      <TCell width={70} align="right">{''}</TCell>
                      <TCell width={110} align="right">{''}</TCell>
                      <TCell width={130} align="right" strong>{rs(report.totalValue ?? 0)}</TCell>
                    </View>
                  </View>
                </ScrollView>
              </SectionCard>
            )}
          </>
        )}
      </ScrollView>
    </ReportContainer>
  );
};

export default InventoryValuationScreen;
