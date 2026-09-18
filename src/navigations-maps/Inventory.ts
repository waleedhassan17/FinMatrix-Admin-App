// ═══════════════════════════════════════════════════════
// FinMatrix — Inventory navigation map
// ═══════════════════════════════════════════════════════
// Route list for InventoryStack (Consultant_Mobile convention): the
// navigator maps over this array — screens register here only.

import type { IRoute } from './types';
import InventoryListScreen from '../screens/Inventory/InventoryList/InventoryListScreen';
import InventoryFormScreen from '../screens/Inventory/InventoryForm/InventoryFormScreen';
import InventoryDetailScreen from '../screens/Inventory/InventoryDetail/InventoryDetailScreen';
import AdjustmentScreen from '../screens/Inventory/Adjustment/AdjustmentScreen';

// ── "Create PO" / "Request PO" from an item ──
// POForm's own home is TransactionsStack; it is ALSO registered here, the same
// way DashboardStack registers it for the quick-action tile, and for the same
// reason. navigate('TransactionsStack', { screen: 'POForm' }) initialises that
// tab's stack as [POForm] with no hub underneath, so back had nothing to pop,
// fell through to the tab navigator's 'firstRoute' default and landed on the
// Dashboard — while leaving the form stranded on the Transactions tab, which
// then reopened it instead of the hub.
//
// Raising a PO is a flow launched FROM an item that has to return to it, and
// the closure rule holds: POForm only calls goBack(), plus a replace('PODetail')
// on save that it guards by asking the navigator it is in — and PODetail is
// deliberately not registered here, so an owner's save comes back to the item.
import POFormScreen from '../screens/PurchaseOrders/POForm/POFormScreen';

export const InventoryRouteNames = {
  InventoryList: 'InventoryList',
  InventoryForm: 'InventoryForm',
  InventoryDetail: 'InventoryDetail',
  Adjustment: 'Adjustment',
  POForm: 'POForm',
} as const;

export type InventoryRouteName = typeof InventoryRouteNames[keyof typeof InventoryRouteNames];

export const INVENTORY_ROUTES: IRoute[] = [
  { title: InventoryRouteNames.InventoryList, component: InventoryListScreen },
  { title: InventoryRouteNames.InventoryForm, component: InventoryFormScreen },
  { title: InventoryRouteNames.InventoryDetail, component: InventoryDetailScreen },
  { title: InventoryRouteNames.Adjustment, component: AdjustmentScreen },
  { title: InventoryRouteNames.POForm, component: POFormScreen },
];
