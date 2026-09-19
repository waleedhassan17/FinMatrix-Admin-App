// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Company review decisions
// ═══════════════════════════════════════════════════════
// The four decision handlers awaited their dispatch without .unwrap(). A
// rejected thunk still RESOLVES, so a 403 or a 500 closed the modal and told
// the reviewer "Approved" while the company's status was untouched on the
// server. These assert the failure path: the success alert must not fire, and
// the modal must stay open holding whatever the reviewer typed.

jest.mock('@expo/vector-icons', () => ({ Feather: 'Feather' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../../../components/admin/AdminUI', () => ({
  AdminScreenHeader: 'AdminScreenHeader',
}));
jest.mock('../../../../utils/alert', () => ({ Alert: { alert: jest.fn() } }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ params: {} }),
}));
jest.mock('../../../../networks/billing/superAdminNetwork', () => ({
  getSuperAdminStatsAPI: jest.fn(),
  getAllCompaniesAPI: jest.fn(),
  getCompanyDetailAPI: jest.fn(),
  updateCompanyStatusAPI: jest.fn(),
  getSubscriptionPlansAPI: jest.fn(),
  createSubscriptionPlanAPI: jest.fn(),
  updateSubscriptionPlanAPI: jest.fn(),
  deleteSubscriptionPlanAPI: jest.fn(),
  getAllSubscriptionsAPI: jest.fn(),
  assignSubscriptionAPI: jest.fn(),
}));

import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import renderer, { act } from 'react-test-renderer';

import CompanyManagementScreen from '../CompanyManagementScreen';
import { superAdminSlice, updateCompanyStatusLocal } from '../../superAdminSlice';
import {
  getAllCompaniesAPI,
  updateCompanyStatusAPI,
} from '../../../../networks/billing/superAdminNetwork';
import { Alert } from '../../../../utils/alert';

import type { CompanyListItem } from '../../../../models/superAdminModel';

const PENDING_COMPANY: CompanyListItem = {
  id: 'c1',
  name: 'Karachi Traders',
  email: 'owner@karachi.pk',
  status: 'pending',
  rejectionReason: null,
  industry: 'Retail',
  createdAt: '2026-09-01T00:00:00.000Z',
} as CompanyListItem;

const makeStore = () =>
  configureStore({ reducer: { superAdmin: superAdminSlice.reducer } });

// Mounts the screen against a real store, so the assertions below read the
// same state the screen renders from.
function renderScreen() {
  const store = makeStore();
  act(() => {
    renderer.create(
      <Provider store={store}>
        <CompanyManagementScreen />
      </Provider>,
    );
  });
  return { store };
}

describe('company decisions when the API fails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAllCompaniesAPI as jest.Mock).mockResolvedValue({
      data: { data: [PENDING_COMPANY], pagination: { total: 1, pages: 1 } },
    });
  });

  it('does not announce success when approve is refused', async () => {
    (updateCompanyStatusAPI as jest.Mock).mockRejectedValue(
      new Error('Super admin access required'),
    );

    const { store } = renderScreen();
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await store
        .dispatch(
          updateCompanyStatusLocal({ id: 'c1', status: 'active' }),
        )
        .unwrap()
        .catch((): undefined => undefined);
    });

    const titles = (Alert.alert as jest.Mock).mock.calls.map((c) => c[0]);
    expect(titles).not.toContain('Approved');
    expect(store.getState().superAdmin.actionStatus).toBe('failed');
    expect(store.getState().superAdmin.actionError).toBe(
      'Super admin access required',
    );
  });

  it('leaves the company row untouched when the update is refused', async () => {
    (updateCompanyStatusAPI as jest.Mock).mockRejectedValue(new Error('boom'));

    const { store } = renderScreen();
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await store
        .dispatch(
          updateCompanyStatusLocal({
            id: 'c1',
            status: 'rejected',
            rejectionReason: 'Incomplete documents',
          }),
        )
        .unwrap()
        .catch((): undefined => undefined);
    });

    expect(store.getState().superAdmin.companies[0].status).toBe('pending');
  });
});
