// ═══════════════════════════════════════════════════════
// FinMatrix — DPDeliveries navigation map
// ═══════════════════════════════════════════════════════
// Route list for DPDeliveriesStack (Consultant_Mobile convention): the
// navigator maps over this array — screens register here only.

import type { IRoute } from './types';
import DPDeliveryListScreen from '../screens/Delivery/Personnel/DPDeliveryList/DPDeliveryListScreen';
import DPDeliveryDetailScreen from '../screens/Delivery/Personnel/DPDeliveryDetail/DPDeliveryDetailScreen';
import BillPhotoCaptureScreen from '../screens/Delivery/Personnel/BillPhotoCapture/BillPhotoCaptureScreen';
import CustomerConfirmScreen from '../screens/Delivery/Personnel/CustomerConfirm/CustomerConfirmScreen';
import DeliveryCompleteScreen from '../screens/Delivery/Personnel/DeliveryComplete/DeliveryCompleteScreen';

export const DPDeliveriesRouteNames = {
  DPDeliveries: 'DPDeliveries',
  DPDeliveryDetail: 'DPDeliveryDetail',
  BillPhotoCapture: 'BillPhotoCapture',
  CustomerConfirm: 'CustomerConfirm',
  DeliveryComplete: 'DeliveryComplete',
} as const;

export type DPDeliveriesRouteName = typeof DPDeliveriesRouteNames[keyof typeof DPDeliveriesRouteNames];

export const DP_DELIVERIES_ROUTES: IRoute[] = [
  { title: DPDeliveriesRouteNames.DPDeliveries, component: DPDeliveryListScreen },
  { title: DPDeliveriesRouteNames.DPDeliveryDetail, component: DPDeliveryDetailScreen },
  { title: DPDeliveriesRouteNames.BillPhotoCapture, component: BillPhotoCaptureScreen },
  { title: DPDeliveriesRouteNames.CustomerConfirm, component: CustomerConfirmScreen },
  { title: DPDeliveriesRouteNames.DeliveryComplete, component: DeliveryCompleteScreen },
];
