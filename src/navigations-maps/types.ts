// ═══════════════════════════════════════════════════════
// FinMatrix — Navigation map types (Consultant_Mobile convention)
// ═══════════════════════════════════════════════════════
// Every navigator is described by a plain array of IRoute entries in
// navigations-maps/<Name>.ts; the navigator itself is a dumb mapper.

import type React from 'react';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

export interface IRoute {
  /** Route name — must never change (deep links + navigate() strings). */
  title: string;
  component: React.ComponentType<any>;
  options?: NativeStackNavigationOptions;
  /** Screens that need initialParams (e.g. renew flow). */
  initialParams?: Record<string, unknown>;
}
