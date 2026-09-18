// ═══════════════════════════════════════════════════════
// FinMatrix — DPProfile navigation map
// ═══════════════════════════════════════════════════════
// Route list for DPProfileStack (Consultant_Mobile convention): the
// navigator maps over this array — screens register here only.

import type { IRoute } from './types';
import DPProfileScreen from '../screens/Delivery/Personnel/DPProfile/DPProfileScreen';
import DPHistoryScreen from '../screens/Delivery/Personnel/DPHistory/DPHistoryScreen';
import DPSettingsScreen from '../screens/Delivery/Personnel/DPSettings/DPSettingsScreen';

export const DPProfileRouteNames = {
  DPProfile: 'DPProfile',
  DPHistory: 'DPHistory',
  DPSettings: 'DPSettings',
} as const;

export type DPProfileRouteName = typeof DPProfileRouteNames[keyof typeof DPProfileRouteNames];

export const DP_PROFILE_ROUTES: IRoute[] = [
  { title: DPProfileRouteNames.DPProfile, component: DPProfileScreen },
  { title: DPProfileRouteNames.DPHistory, component: DPHistoryScreen },
  { title: DPProfileRouteNames.DPSettings, component: DPSettingsScreen },
];
