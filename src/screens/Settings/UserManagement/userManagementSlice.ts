import { createAppSlice } from '@store/createAppSlice';
import type { PayloadAction } from '@reduxjs/toolkit';
import {
  changeCompanyUserRole,
  createCompanyUser,
  generatePassword,
  listCompanyUsers,
  resetCompanyUserPassword,
  revealCompanyUserCredential,
  setCompanyUserActive,
  type CompanyUser,
  type IssuedCredentials,
} from '../../../networks/settings/settingsNetwork';

/**
 * Team management for the owner.
 *
 * Staff are created with a username and a password the owner chooses and hands
 * over in person — there is no invite email, which is why this slice holds an
 * add-user FORM rather than the invite-modal state it used to.
 *
 * `issued` is the one-time reveal after creating or resetting an account: the
 * password is shown so the owner can pass it on, and it lives only here in
 * memory. It is never persisted to the store's disk cache — see the
 * `issued`/`revealed` reset on close.
 */
interface UserManagementState {
  users: CompanyUser[];
  isLoading: boolean;
  error: string | null;

  // Add-user form
  formOpen: boolean;
  formName: string;
  formUsername: string;
  formPassword: string;
  formRole: 'admin' | 'staff';
  isSaving: boolean;

  /** Credentials to read out, after a create or a reset. */
  issued: (IssuedCredentials & { name?: string }) | null;
  /** A stored credential the owner asked to see again. */
  revealed: { userId: string; username: string | null; password: string | null } | null;
  busyUserId: string | null;
}

const initialState: UserManagementState = {
  users: [],
  isLoading: false,
  error: null,
  formOpen: false,
  formName: '',
  formUsername: '',
  formPassword: '',
  formRole: 'staff',
  isSaving: false,
  issued: null,
  revealed: null,
  busyUserId: null,
};

export const userManagementSlice = createAppSlice({
  name: 'userManagement',
  initialState,
  reducers: create => ({
    openAddUser: create.reducer(state => {
      state.formOpen = true;
      state.formName = '';
      state.formUsername = '';
      // Pre-filled so the common path is one tap: the owner rarely wants to
      // invent a password, and a generated one is stronger than a typed one.
      state.formPassword = generatePassword();
      state.formRole = 'staff';
      state.error = null;
    }),
    closeAddUser: create.reducer(state => {
      state.formOpen = false;
      state.formPassword = '';
    }),
    setFormName: create.reducer((state, action: PayloadAction<string>) => {
      state.formName = action.payload;
    }),
    setFormUsername: create.reducer((state, action: PayloadAction<string>) => {
      // Usernames are lower-case and cannot contain '@' — that character is
      // what the server uses to tell a username from an email at sign-in.
      state.formUsername = action.payload.toLowerCase().replace(/[^a-z0-9._-]/g, '');
    }),
    setFormPassword: create.reducer((state, action: PayloadAction<string>) => {
      state.formPassword = action.payload;
    }),
    setFormRole: create.reducer((state, action: PayloadAction<'admin' | 'staff'>) => {
      state.formRole = action.payload;
    }),
    regeneratePassword: create.reducer(state => {
      state.formPassword = generatePassword();
    }),
    dismissIssued: create.reducer(state => {
      state.issued = null;
    }),
    dismissRevealed: create.reducer(state => {
      state.revealed = null;
    }),
    clearUserMgmtError: create.reducer(state => {
      state.error = null;
    }),

    fetchUsers: create.asyncThunk(async () => listCompanyUsers(), {
      pending: state => {
        state.isLoading = true;
        state.error = null;
      },
      fulfilled: (state, action) => {
        state.isLoading = false;
        state.users = action.payload;
      },
      rejected: (state, action) => {
        state.isLoading = false;
        state.error = action.error?.message ?? 'Could not load your team';
      },
    }),

    addUser: create.asyncThunk(
      async (_: void, { getState }) => {
        const { userManagement: s } = getState() as {
          userManagement: UserManagementState;
        };
        return createCompanyUser({
          name: s.formName.trim(),
          username: s.formUsername.trim(),
          password: s.formPassword,
          role: s.formRole,
        });
      },
      {
        pending: state => {
          state.isSaving = true;
          state.error = null;
        },
        fulfilled: (state, action) => {
          state.isSaving = false;
          state.formOpen = false;
          const { credentials, ...user } = action.payload;
          state.users.push(user as CompanyUser);
          // Shown once, for the owner to write down or read out.
          state.issued = { ...credentials, name: user.name };
          state.formPassword = '';
        },
        rejected: (state, action) => {
          state.isSaving = false;
          state.error = action.error?.message ?? 'Could not add the user';
        },
      },
    ),

    changeUserRole: create.asyncThunk(
      async (params: { userId: string; role: 'admin' | 'staff' }) =>
        changeCompanyUserRole(params.userId, params.role),
      {
        pending: (state, action) => {
          state.busyUserId = action.meta.arg.userId;
        },
        fulfilled: (state, action) => {
          state.busyUserId = null;
          const i = state.users.findIndex(u => u.id === action.payload.id);
          if (i !== -1) state.users[i] = action.payload;
        },
        rejected: (state, action) => {
          state.busyUserId = null;
          // The server refuses to demote the last owner; surface its reason.
          state.error = action.error?.message ?? 'Could not change the role';
        },
      },
    ),

    setUserActive: create.asyncThunk(
      async (params: { userId: string; isActive: boolean }) =>
        setCompanyUserActive(params.userId, params.isActive),
      {
        pending: (state, action) => {
          state.busyUserId = action.meta.arg.userId;
        },
        fulfilled: (state, action) => {
          state.busyUserId = null;
          const i = state.users.findIndex(u => u.id === action.payload.id);
          if (i !== -1) state.users[i] = action.payload;
        },
        rejected: (state, action) => {
          state.busyUserId = null;
          state.error = action.error?.message ?? 'Could not update the account';
        },
      },
    ),

    resetUserPassword: create.asyncThunk(
      async (params: { userId: string; name: string }) => ({
        ...(await resetCompanyUserPassword(params.userId)),
        name: params.name,
      }),
      {
        pending: (state, action) => {
          state.busyUserId = action.meta.arg.userId;
        },
        fulfilled: (state, action) => {
          state.busyUserId = null;
          state.issued = {
            username: action.payload.username ?? '',
            password: action.payload.password,
            name: action.payload.name,
          };
          const i = state.users.findIndex(u => u.id === action.payload.userId);
          if (i !== -1) state.users[i].hasStoredCredential = true;
        },
        rejected: (state, action) => {
          state.busyUserId = null;
          state.error = action.error?.message ?? 'Could not reset the password';
        },
      },
    ),

    revealCredential: create.asyncThunk(
      async (userId: string) => revealCompanyUserCredential(userId),
      {
        pending: (state, action) => {
          state.busyUserId = action.meta.arg;
        },
        fulfilled: (state, action) => {
          state.busyUserId = null;
          state.revealed = action.payload;
        },
        rejected: (state, action) => {
          state.busyUserId = null;
          state.error = action.error?.message ?? 'Could not read the credentials';
        },
      },
    ),
  }),

  selectors: {
    selectUsers: state => state.users,
    selectUserMgmtLoading: state => state.isLoading,
    selectUserMgmtError: state => state.error,
    selectFormOpen: state => state.formOpen,
    selectFormName: state => state.formName,
    selectFormUsername: state => state.formUsername,
    selectFormPassword: state => state.formPassword,
    selectFormRole: state => state.formRole,
    selectIsSaving: state => state.isSaving,
    selectIssuedCredentials: state => state.issued,
    selectRevealedCredential: state => state.revealed,
    selectBusyUserId: state => state.busyUserId,
  },
});

export const {
  openAddUser,
  closeAddUser,
  setFormName,
  setFormUsername,
  setFormPassword,
  setFormRole,
  regeneratePassword,
  dismissIssued,
  dismissRevealed,
  clearUserMgmtError,
  fetchUsers,
  addUser,
  changeUserRole,
  setUserActive,
  resetUserPassword,
  revealCredential,
} = userManagementSlice.actions;

export const {
  selectUsers,
  selectUserMgmtLoading,
  selectUserMgmtError,
  selectFormOpen,
  selectFormName,
  selectFormUsername,
  selectFormPassword,
  selectFormRole,
  selectIsSaving,
  selectIssuedCredentials,
  selectRevealedCredential,
  selectBusyUserId,
} = userManagementSlice.selectors;
