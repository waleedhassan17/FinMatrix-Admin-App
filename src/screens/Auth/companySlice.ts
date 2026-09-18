import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { WarehouseAgency } from '@models/agencyModel';
import type { DummyDeliveryPerson } from '@models/deliveryModel';
import { signOut } from './authSlice';

// ─── Types ────────────────────────────────────────────

export interface CompanyMember {
  userId: string;
  role: 'admin' | 'delivery';
  displayName: string;
  email: string;
  phone: string;
  joinedAt: string;
}

export interface CompanyData {
  companyId: string;
  name: string;
  industry: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  taxId: string;
  logo: string | null;
  inviteCode: string;
  agencies: WarehouseAgency[];
  members: CompanyMember[];
  deliveryPersonnel: DummyDeliveryPerson[];
  createdAt: string;
}

export interface CompanyState {
  companies: CompanyData[];
  activeCompanyId: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: CompanyState = {
  companies: [],
  activeCompanyId: null,
  isLoading: false,
  error: null,
};

// NOTE: slice name 'company' is redux-persist-whitelisted — never rename.
const companySlice = createAppSlice({
  name: 'company',
  initialState,
  reducers: create => ({
    createCompany: create.reducer((state, action: PayloadAction<CompanyData>) => {
      state.companies.push(action.payload);
      state.activeCompanyId = action.payload.companyId;
      state.error = null;
    }),
    setActiveCompany: create.reducer((state, action: PayloadAction<string>) => {
      state.activeCompanyId = action.payload;
    }),
    clearCompany: create.reducer(state => {
      state.activeCompanyId = null;
    }),
    addAgency: create.reducer(
      (state, action: PayloadAction<{ companyId: string; agency: WarehouseAgency }>) => {
        const company = state.companies.find(
          c => c.companyId === action.payload.companyId,
        );
        if (company) {
          company.agencies.push(action.payload.agency);
        }
      },
    ),
    removeAgency: create.reducer(
      (state, action: PayloadAction<{ companyId: string; agencyId: string }>) => {
        const company = state.companies.find(
          c => c.companyId === action.payload.companyId,
        );
        if (company) {
          company.agencies = company.agencies.filter(
            a => a.id !== action.payload.agencyId,
          );
        }
      },
    ),
    addMember: create.reducer(
      (state, action: PayloadAction<{ companyId: string; member: CompanyMember }>) => {
        const company = state.companies.find(
          c => c.companyId === action.payload.companyId,
        );
        if (company) {
          company.members.push(action.payload.member);
        }
      },
    ),
    removeMember: create.reducer(
      (state, action: PayloadAction<{ companyId: string; userId: string }>) => {
        const company = state.companies.find(
          c => c.companyId === action.payload.companyId,
        );
        if (company) {
          company.members = company.members.filter(
            m => m.userId !== action.payload.userId,
          );
        }
      },
    ),
    updateMemberRole: create.reducer(
      (
        state,
        action: PayloadAction<{
          companyId: string;
          userId: string;
          role: 'admin' | 'delivery';
        }>,
      ) => {
        const company = state.companies.find(
          c => c.companyId === action.payload.companyId,
        );
        if (company) {
          const member = company.members.find(
            m => m.userId === action.payload.userId,
          );
          if (member) {
            member.role = action.payload.role;
          }
        }
      },
    ),
    addDeliveryPersonnel: create.reducer(
      (
        state,
        action: PayloadAction<{
          companyId: string;
          person: DummyDeliveryPerson;
        }>,
      ) => {
        const company = state.companies.find(
          c => c.companyId === action.payload.companyId,
        );
        if (company) {
          company.deliveryPersonnel.push(action.payload.person);
        }
      },
    ),
    removeDeliveryPersonnel: create.reducer(
      (state, action: PayloadAction<{ companyId: string; userId: string }>) => {
        const company = state.companies.find(
          c => c.companyId === action.payload.companyId,
        );
        if (company) {
          company.deliveryPersonnel = company.deliveryPersonnel.filter(
            p => p.userId !== action.payload.userId,
          );
        }
      },
    ),
    updateDeliveryPersonnel: create.reducer(
      (
        state,
        action: PayloadAction<{
          companyId: string;
          userId: string;
          updates: Partial<DummyDeliveryPerson>;
        }>,
      ) => {
        const company = state.companies.find(
          c => c.companyId === action.payload.companyId,
        );
        if (company) {
          const person = company.deliveryPersonnel.find(
            p => p.userId === action.payload.userId,
          );
          if (person) {
            Object.assign(person, action.payload.updates);
          }
        }
      },
    ),
    // Upsert company from API response (used on login for existing users)
    loadCompany: create.reducer((state, action: PayloadAction<CompanyData>) => {
      const idx = state.companies.findIndex(c => c.companyId === action.payload.companyId);
      if (idx >= 0) {
        state.companies[idx] = action.payload;
      } else {
        state.companies.push(action.payload);
      }
      state.activeCompanyId = action.payload.companyId;
    }),
    setCompanyLoading: create.reducer((state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    }),
    setCompanyError: create.reducer((state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    }),
  }),
  extraReducers: builder => {
    builder.addCase(signOut, () => initialState);
  },
  selectors: {
    selectCompanies: state => state.companies,
    selectActiveCompanyId: state => state.activeCompanyId,
    selectCompanyLoading: state => state.isLoading,
    selectCompanyError: state => state.error,
    // Derive active company
    selectActiveCompany: state =>
      state.companies.find(c => c.companyId === state.activeCompanyId) ?? null,
    selectCompanyByInviteCode: (state, code: string) =>
      state.companies.find(
        c => c.inviteCode.toUpperCase() === code.toUpperCase(),
      ) ?? null,
  },
});

export const {
  createCompany,
  loadCompany,
  setActiveCompany,
  clearCompany,
  addAgency,
  removeAgency,
  addMember,
  removeMember,
  updateMemberRole,
  addDeliveryPersonnel,
  removeDeliveryPersonnel,
  updateDeliveryPersonnel,
  setCompanyLoading,
  setCompanyError,
} = companySlice.actions;

export const {
  selectCompanies,
  selectActiveCompanyId,
  selectCompanyLoading,
  selectCompanyError,
  selectActiveCompany,
  selectCompanyByInviteCode,
} = companySlice.selectors;

export default companySlice.reducer;
