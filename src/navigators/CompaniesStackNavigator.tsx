// ═══════════════════════════════════════════════════════
// FinMatrix — Companies stack (Super Admin)
// ═══════════════════════════════════════════════════════
// The Companies tab became a stack so a reviewer can open one company and come
// back. Until now the tab was a single screen and the review modal showed only
// the fields that already fit in a list row -- getCompanyDetailAPI existed and
// nothing called it.
//
// Nesting a stack inside a tab changes how params are delivered: navigate to
// the TAB and the params land on the navigator, not on the screen. Anything
// pointing here has to say which screen it means:
//
//   navigate('Companies', { screen: 'CompanyList', params: { filter } })
//
// The bare `navigate('Companies', { filter })` form silently does nothing, and
// the dashboard used to reach these tabs through `as any` casts that would have
// hidden exactly that. SuperAdminTabParamList is typed against this file now,
// so the compiler catches it instead.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import CompanyManagementScreen from '../screens/SuperAdmin/CompanyManagement/CompanyManagementScreen';
import CompanyDetailScreen from '../screens/SuperAdmin/CompanyManagement/CompanyDetailScreen';

export type CompaniesStackParamList = {
  CompanyList: { filter?: string } | undefined;
  CompanyDetail: { id: string; name?: string };
};

const Stack = createNativeStackNavigator<CompaniesStackParamList>();

const CompaniesStackNavigator: React.FC = () => (
  <Stack.Navigator id="CompaniesStack" screenOptions={{ headerShown: false }}>
    <Stack.Screen name="CompanyList" component={CompanyManagementScreen} />
    <Stack.Screen name="CompanyDetail" component={CompanyDetailScreen} />
  </Stack.Navigator>
);

export default CompaniesStackNavigator;
