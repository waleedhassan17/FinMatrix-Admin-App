import { createAppSlice } from '@store/createAppSlice';

export interface DPProfileSliceState {
  showVehicleInfo: boolean;
}

const initialState: DPProfileSliceState = {
  showVehicleInfo: true,
};

export const dpProfileSlice = createAppSlice({
  name: 'dpProfile',
  initialState,
  reducers: create => ({
    toggleShowVehicleInfo: create.reducer(state => {
      state.showVehicleInfo = !state.showVehicleInfo;
    }),
  }),
  selectors: {
    selectShowVehicleInfo: state => state.showVehicleInfo,
  },
});

export const { toggleShowVehicleInfo } = dpProfileSlice.actions;
export const { selectShowVehicleInfo } = dpProfileSlice.selectors;
