import { createAppSlice } from '@store/createAppSlice';
import type { AnalyticsDashboardData } from '../../../models/analyticsDashboardModel';
import { getAnalyticsDashboardAPI } from '../../../networks/dashboards/analyticsDashboardNetwork';
import { analyticsDashboardSerializer } from '../../../serializers/analyticsDashboardSerializer';

interface AnalyticsDashboardState {
  data: AnalyticsDashboardData | null;
  isLoading: boolean;
  error: string;
}

const initialState: AnalyticsDashboardState = {
  data: null,
  isLoading: false,
  error: '',
};

export const analyticsDashboardSlice = createAppSlice({
  name: 'analyticsDashboard',
  initialState,
  reducers: create => ({
    fetchAnalyticsDashboard: create.asyncThunk(async () => analyticsDashboardSerializer(await getAnalyticsDashboardAPI()), {
      pending: state => {
        state.isLoading = true;
        state.error = '';
      },
      fulfilled: (state, action) => {
        state.isLoading = false;
        state.data = action.payload;
      },
      rejected: (state, action) => {
        state.isLoading = false;
        state.error = action.error?.message ?? 'Failed to load analytics dashboard';
      },
    }),
  }),
  selectors: {
    selectAnalyticsDashboardState: state => state,
  },
});

export const { fetchAnalyticsDashboard } = analyticsDashboardSlice.actions;
export const selectAnalyticsDashboardState = (rootState: { analyticsDashboard?: AnalyticsDashboardState }) =>
  rootState.analyticsDashboard ?? initialState;
