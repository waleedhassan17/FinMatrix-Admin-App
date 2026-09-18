// ═══════════════════════════════════════════════════════
// FinMatrix — ReportsStack (dumb mapper over navigations-maps/Reports)
// ═══════════════════════════════════════════════════════
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { REPORTS_ROUTES } from '../../navigations-maps/Reports';

export type ReportsStackParamList = {
  ReportsHub: undefined;
  ProfitLoss: undefined;
  BalanceSheet: undefined;
  TrialBalance: undefined;
  CashFlow: undefined;
  GeneralLedger: undefined;
  BudgetList: undefined;
  BudgetForm: undefined;
  BudgetDetail: { budgetId: string };
  ARAging: undefined;
  APAging: undefined;
  InventoryValuation: undefined;
  AnalyticsDashboard: undefined;
  DeliveryDailyReport: undefined;
  DeliveryPerformance: undefined;
};

const Stack = createNativeStackNavigator();

const ReportsStack: React.FC = () => (
  <Stack.Navigator id="ReportsStack" screenOptions={{ headerShown: false }}>
    {REPORTS_ROUTES.map(route => (
      <Stack.Screen
        key={route.title}
        name={route.title}
        component={route.component}
        options={route.options}
      />
    ))}
  </Stack.Navigator>
);

export default ReportsStack;
