import type { Middleware } from '@reduxjs/toolkit';

/**
 * First Update (v1.0) scope: the in-app Notification Centre is deferred to the
 * Second Update. This middleware previously translated delivery/approval
 * actions into notification-centre entries; in v1 riders and admins read
 * delivery status directly through the delivery endpoints, so it is now a
 * pass-through. The hook is kept so the centre can be re-wired in v2 without
 * touching store configuration.
 */
export const realtimeMiddleware: Middleware = () => next => action => next(action);
