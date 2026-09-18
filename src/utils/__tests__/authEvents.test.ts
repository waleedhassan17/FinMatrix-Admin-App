import {
  clearIntentionalSignOut,
  emitSessionExpired,
  isIntentionalSignOut,
  markIntentionalSignOut,
  setSessionExpiredHandler,
} from '../authEvents';

describe('session-expired vs an intentional sign-out', () => {
  afterEach(() => {
    jest.useRealTimers();
    clearIntentionalSignOut();
    setSessionExpiredHandler(null);
  });

  it('reports an expired session normally', () => {
    const handler = jest.fn();
    setSessionExpiredHandler(handler);
    emitSessionExpired();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('stays silent right after the user signs out on purpose', () => {
    const handler = jest.fn();
    setSessionExpiredHandler(handler);
    markIntentionalSignOut();
    expect(isIntentionalSignOut()).toBe(true);
    emitSessionExpired();
    expect(handler).not.toHaveBeenCalled();
  });

  it('reports again once the window has passed', () => {
    jest.useFakeTimers();
    const handler = jest.fn();
    setSessionExpiredHandler(handler);
    markIntentionalSignOut();
    jest.advanceTimersByTime(10_001);
    expect(isIntentionalSignOut()).toBe(false);
    emitSessionExpired();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('a new sign-in ends the window immediately', () => {
    const handler = jest.fn();
    setSessionExpiredHandler(handler);
    markIntentionalSignOut();
    clearIntentionalSignOut();
    emitSessionExpired();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
