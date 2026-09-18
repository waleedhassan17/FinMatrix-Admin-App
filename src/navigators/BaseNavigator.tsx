// ═══════════════════════════════════════════════════════
// FinMatrix Admin — BaseNavigator (unauthenticated stack)
// ═══════════════════════════════════════════════════════
// Dumb mapper over UNAUTHENTICATED_ROUTES in navigations-maps/Auth.ts
// (Consultant_Mobile convention). Which top-level navigator mounts — this one
// or the console — is decided by AppContainer.renderNavigator().
//
// The tenant app picks one of seven route arrays here based on email
// verification and company status, in an order that matters. The console reads
// no state at all: a platform admin has no company, so there are no gates
// between signing in and being inside the app.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { THEME } from '../theme';
import { UNAUTHENTICATED_ROUTES } from '../navigations-maps/Auth';

const Stack = createNativeStackNavigator<RootStackParamList>();

const BaseNavigator: React.FC = () => (
  <Stack.Navigator
    id="BaseNavigator"
    screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: THEME.colors.neutral50 },
      animation: 'none',
    }}>
    {UNAUTHENTICATED_ROUTES.map(route => (
      <Stack.Screen
        key={route.title}
        name={route.title as keyof RootStackParamList}
        component={route.component}
        options={route.options}
        initialParams={route.initialParams as never}
      />
    ))}
  </Stack.Navigator>
);

export default BaseNavigator;
