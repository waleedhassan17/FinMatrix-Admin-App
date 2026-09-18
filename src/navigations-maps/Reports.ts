// ═══════════════════════════════════════════════════════
// FinMatrix — Reports navigation map
// ═══════════════════════════════════════════════════════
// Route list for ReportsStack (Consultant_Mobile convention): the
// navigator maps over this array — screens register here only.

import type { IRoute } from './types';
import ReportsHubScreen from '../screens/Reports/ReportsHub/ReportsHubScreen';
import ProfitLossScreen from '../screens/Reports/ProfitLoss/ProfitLossScreen';
import BalanceSheetScreen from '../screens/Reports/BalanceSheet/BalanceSheetScreen';
import TrialBalanceScreen from '../screens/Reports/TrialBalance/TrialBalanceScreen';
import CashFlowScreen from '../screens/Reports/CashFlow/CashFlowScreen';
import GeneralLedgerScreen from '../screens/Reports/GeneralLedger/GeneralLedgerScreen';
import BudgetListScreen from '../screens/Budgets/BudgetListScreen';
import BudgetFormScreen from '../screens/Budgets/BudgetFormScreen';
import BudgetDetailScreen from '../screens/Budgets/BudgetDetailScreen';
import ARAgingScreen from '../screens/Reports/ARAging/ARAgingScreen';
import APAgingScreen from '../screens/Reports/APAging/APAgingScreen';
import InventoryValuationScreen from '../screens/Reports/InventoryValuation/InventoryValuationScreen';
import AnalyticsDashboardScreen from '../screens/Reports/AnalyticsDashboard/AnalyticsDashboardScreen';
import DeliveryDailyReportScreen from '../screens/Reports/DeliveryDailyReport/DeliveryDailyReportScreen';
import DeliveryPerformanceScreen from '../screens/Reports/DeliveryPerformance/DeliveryPerformanceScreen';

export const ReportsRouteNames = {
  ReportsHub: 'ReportsHub',
  ProfitLoss: 'ProfitLoss',
  BalanceSheet: 'BalanceSheet',
  TrialBalance: 'TrialBalance',
  CashFlow: 'CashFlow',
  GeneralLedger: 'GeneralLedger',
  BudgetList: 'BudgetList',
  BudgetForm: 'BudgetForm',
  BudgetDetail: 'BudgetDetail',
  ARAging: 'ARAging',
  APAging: 'APAging',
  InventoryValuation: 'InventoryValuation',
  AnalyticsDashboard: 'AnalyticsDashboard',
  DeliveryDailyReport: 'DeliveryDailyReport',
  DeliveryPerformance: 'DeliveryPerformance',
} as const;

export type ReportsRouteName = typeof ReportsRouteNames[keyof typeof ReportsRouteNames];

export const REPORTS_ROUTES: IRoute[] = [
  { title: ReportsRouteNames.ReportsHub, component: ReportsHubScreen },
  { title: ReportsRouteNames.ProfitLoss, component: ProfitLossScreen },
  { title: ReportsRouteNames.BalanceSheet, component: BalanceSheetScreen },
  { title: ReportsRouteNames.TrialBalance, component: TrialBalanceScreen },
  { title: ReportsRouteNames.CashFlow, component: CashFlowScreen },
  { title: ReportsRouteNames.GeneralLedger, component: GeneralLedgerScreen },
  { title: ReportsRouteNames.BudgetList, component: BudgetListScreen },
  { title: ReportsRouteNames.BudgetForm, component: BudgetFormScreen },
  { title: ReportsRouteNames.BudgetDetail, component: BudgetDetailScreen },
  { title: ReportsRouteNames.ARAging, component: ARAgingScreen },
  { title: ReportsRouteNames.APAging, component: APAgingScreen },
  { title: ReportsRouteNames.InventoryValuation, component: InventoryValuationScreen },
  { title: ReportsRouteNames.AnalyticsDashboard, component: AnalyticsDashboardScreen },
  { title: ReportsRouteNames.DeliveryDailyReport, component: DeliveryDailyReportScreen },
  { title: ReportsRouteNames.DeliveryPerformance, component: DeliveryPerformanceScreen },
];
