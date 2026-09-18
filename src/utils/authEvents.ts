// ═══════════════════════════════════════════════════════
// FinMatrix — Auth Events (session-expired bridge)
// ═══════════════════════════════════════════════════════
// The axios client (networks/network/apiHelpers.ts) cannot import the Redux
// store — the store imports slices, slices import networks, networks import
// the client, so the cycle would break module init. When the 401-refresh
// flow exhausts its options it calls emitSessionExpired(); AppContainer
// registers a handler that dispatches signOut() so the UI actually returns
// to the sign-in screen instead of sitting on dead screens whose every
// request 401s until the next cold start.

type SessionExpiredHandler = () => void;

let handler: SessionExpiredHandler | null = null;

export const setSessionExpiredHandler = (h: SessionExpiredHandler | null) => {
  handler = h;
};

export const emitSessionExpired = () => {
  if (isIntentionalSignOut()) return;
  handler?.();
};

// ─── Intentional sign-out ────────────────────────────────────────────────
// Signing out revokes the access AND refresh tokens on the server. A request
// still in flight on the old token then 401s, its refresh fails, and the user
// who tapped "Sign out" would be told their "session expired". For a short
// window after an intentional sign-out such 401s are neither refreshed nor
// announced. Bounded, so a genuinely expired session later is still reported;
// a successful sign-in ends it at once.

const INTENTIONAL_SIGN_OUT_WINDOW_MS = 10_000;
let intentionalSignOutAt = 0;

export const markIntentionalSignOut = () => {
  intentionalSignOutAt = Date.now();
};

export const clearIntentionalSignOut = () => {
  intentionalSignOutAt = 0;
};

export const isIntentionalSignOut = (): boolean =>
  intentionalSignOutAt > 0 && Date.now() - intentionalSignOutAt < INTENTIONAL_SIGN_OUT_WINDOW_MS;

// ─── Company-status-stale (403 COMPANY_NOT_ACTIVE) ───────────────────────
// Fired when a business request is rejected because the company is no longer
// active — e.g. the subscription lapsed mid-session (server enforces expiry
// live) or a super admin deactivated the account. The registered handler
// re-fetches /auth/me so Redux picks up the fresh companyStatus and the
// navigator routes to the matching gate (RenewSubscription for inactive)
// without waiting for an app restart.

type CompanyStatusStaleHandler = () => void;

let statusStaleHandler: CompanyStatusStaleHandler | null = null;

export const setCompanyStatusStaleHandler = (
  h: CompanyStatusStaleHandler | null,
) => {
  statusStaleHandler = h;
};

export const emitCompanyStatusStale = () => {
  statusStaleHandler?.();
};

// ─── Rider seat locked (403 RIDER_SEAT_LOCKED) ───────────────────────────
// Fired when a rider's request is refused because the company's plan no longer
// covers their seat (the owner downgraded, or the plan was changed while they
// were signed in). There is nothing a rider can do in the app until a seat is
// given back, so the handler signs them out and shows the server's message.

type RiderSeatLockedHandler = (message: string) => void;

let riderSeatLockedHandler: RiderSeatLockedHandler | null = null;

export const setRiderSeatLockedHandler = (h: RiderSeatLockedHandler | null) => {
  riderSeatLockedHandler = h;
};

export const emitRiderSeatLocked = (message: string) => {
  riderSeatLockedHandler?.(message);
};
