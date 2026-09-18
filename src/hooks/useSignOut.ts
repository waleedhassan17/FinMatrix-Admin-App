// ═══════════════════════════════════════════════════════
// FinMatrix — useSignOut (the ONLY sign-out implementation)
// ═══════════════════════════════════════════════════════
// One sign-out flow for all three roles (super admin, company admin,
// delivery personnel) and for the auth gate screens:
//
//   confirm dialog
//     → dispatch(signOut())  — synchronous. Wipes the ENTIRE Redux store
//       (see appReducer in store/store.ts, which keeps only `auth` and
//       `appContainer`), so AppContainer.renderNavigator() swaps to the keyed
//       unauthenticated stack on the SAME frame and back-navigation cannot
//       re-enter the app.
//     → void authSignOut()   — fire-and-forget. Clears the AsyncStorage
//       tokens and best-effort POSTs /auth/signout to revoke the session
//       server-side. Deliberately NOT awaited: the UI must not wait on the
//       network, and an offline or hung request must not delay sign-out.
//
// This ordering is the fix for the sign-out spinner that never resolved —
// the old flow awaited the network call before touching Redux, so a slow or
// offline request froze the user on a loading state.
//
// Idempotent and offline-safe: `inFlight` blocks a second tap, authSignOut
// no-ops when there is no stored token, and local state is cleared regardless
// of the network result.

import { useCallback, useRef, useState } from 'react';
import { useAppDispatch } from './useReduxHooks';
import { signOut } from '../screens/Auth/authSlice';
import { authSignOut } from '../networks/auth/authNetwork';
import { markIntentionalSignOut } from '../utils/authEvents';
import { Alert } from '../utils/alert';

const CONFIRM_TITLE = 'Sign Out';
const CONFIRM_MESSAGE = 'Are you sure you want to sign out?';

export function useSignOut() {
  const dispatch = useAppDispatch();
  const [signingOut, setSigningOut] = useState(false);
  // Ref (not just state) so two taps in the same frame can't both pass.
  const inFlight = useRef(false);

  const signOutNow = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSigningOut(true);

    // Best-effort, non-blocking: token clearing + server revocation happen in
    // the background. authSignOut() never throws.
    // First: requests still in flight on the old token must not be refreshed
    // or reported as an expired session (see utils/authEvents).
    markIntentionalSignOut();
    void authSignOut();

    // Synchronous — this is what swaps the navigator to sign-in.
    dispatch(signOut());

    // The signed-out screens unmount immediately; releasing the guard keeps
    // the hook reusable if a caller stays mounted (e.g. RenewSubscription).
    inFlight.current = false;
    setSigningOut(false);
  }, [dispatch]);

  const confirmSignOut = useCallback(() => {
    if (inFlight.current) return;
    // The shared shim renders a real dialog on native and window.confirm on
    // web (RN-web's Alert has no buttons).
    Alert.alert(CONFIRM_TITLE, CONFIRM_MESSAGE, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOutNow },
    ]);
  }, [signOutNow]);

  return { signingOut, confirmSignOut, signOutNow };
}
