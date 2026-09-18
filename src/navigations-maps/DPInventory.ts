// ═══════════════════════════════════════════════════════
// FinMatrix — DPInventory navigation map
// ═══════════════════════════════════════════════════════
// Route list for DPInventoryStack (Consultant_Mobile convention): the
// navigator maps over this array — screens register here only.

import type { IRoute } from './types';
import DPInventoryScreen from '../screens/Delivery/Personnel/DPInventory/DPInventoryScreen';
import DPShadowInventoryScreen from '../screens/Delivery/Personnel/DPShadowInventory/DPShadowInventoryScreen';

export const DPInventoryRouteNames = {
  DPInventory: 'DPInventory',
  DPShadowInventory: 'DPShadowInventory',
} as const;

export type DPInventoryRouteName = typeof DPInventoryRouteNames[keyof typeof DPInventoryRouteNames];

export const DP_INVENTORY_ROUTES: IRoute[] = [
  { title: DPInventoryRouteNames.DPInventory, component: DPInventoryScreen },
  { title: DPInventoryRouteNames.DPShadowInventory, component: DPShadowInventoryScreen },
];
