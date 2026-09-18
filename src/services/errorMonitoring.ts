// ═══════════════════════════════════════════════════════
// FinMatrix — Client Error Monitoring
// ═══════════════════════════════════════════════════════
// Captures unhandled JS errors and promise rejections and reports them to
// the API (POST /monitoring/client-errors), which logs them server-side and
// forwards to Sentry when SENTRY_DSN is configured there. Routing reports
// through our own API keeps this dependency-free (works in Expo Go, dev
// builds and web alike — no native Sentry module required) while still
// giving every crash a user, screen and platform context.
//
// Errors are also always passed through to the default handler so dev
// red-boxes and console output keep working.

import { Platform } from 'react-native';
import { api } from '../networks/network/apiHelpers';

let installed = false;
let currentScreen = 'unknown';

// Simple de-dupe so a render-loop crash doesn't flood the API.
const recentlySent = new Map<string, number>();
const DEDUPE_WINDOW_MS = 60_000;
const MAX_REPORTS_PER_MINUTE = 10;
let windowStart = Date.now();
let windowCount = 0;

/** Screens call this (via navigation listener) so reports carry context. */
export function setCurrentScreen(name: string): void {
  currentScreen = name || 'unknown';
}

async function report(kind: 'error' | 'unhandled_rejection', error: unknown): Promise<void> {
  try {
    const err = error instanceof Error ? error : new Error(String(error ?? 'Unknown error'));
    const fingerprint = `${kind}:${err.message}`.slice(0, 300);

    const now = Date.now();
    if (now - windowStart > DEDUPE_WINDOW_MS) {
      windowStart = now;
      windowCount = 0;
      recentlySent.clear();
    }
    if (windowCount >= MAX_REPORTS_PER_MINUTE) return;
    if (recentlySent.has(fingerprint)) return;
    recentlySent.set(fingerprint, now);
    windowCount += 1;

    await api.post('/monitoring/client-errors', {
      message: err.message.slice(0, 2000),
      stack: err.stack?.slice(0, 8000),
      screen: currentScreen,
      platform: (Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web'),
      kind,
    });
  } catch {
    // Reporting must never crash the app or recurse.
  }
}

/** Install global handlers. Call once from the app entry point. */
export function installErrorMonitoring(): void {
  if (installed) return;
  installed = true;

  // Unhandled JS exceptions (native platforms).
  const errorUtils = (globalThis as any).ErrorUtils;
  if (errorUtils?.setGlobalHandler) {
    const defaultHandler = errorUtils.getGlobalHandler?.();
    errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
      void report('error', error);
      defaultHandler?.(error, isFatal);
    });
  }

  // Unhandled promise rejections.
  if (Platform.OS === 'web' && typeof globalThis.addEventListener === 'function') {
    globalThis.addEventListener('unhandledrejection', (event: any) => {
      void report('unhandled_rejection', event?.reason);
    });
    globalThis.addEventListener('error', (event: any) => {
      void report('error', event?.error ?? event?.message);
    });
  } else {
    // Hermes exposes rejection tracking through the promise polyfill.
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const tracking = require('promise/setimmediate/rejection-tracking');
      tracking.enable({
        allRejections: true,
        onUnhandled: (_id: number, rejection: unknown) => {
          void report('unhandled_rejection', rejection);
        },
      });
    } catch {
      // Rejection tracking unavailable on this runtime — exceptions above
      // still get reported.
    }
  }
}
