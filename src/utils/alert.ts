// ═══════════════════════════════════════════════════════
// FinMatrix — web-safe Alert (drop-in for react-native's Alert)
// ═══════════════════════════════════════════════════════
// react-native-web's Alert.alert is a NO-OP: plain alerts show nothing and
// button callbacks never fire, so confirmations silently do nothing on the
// web build (established project rule: user tests on web regularly).
//
// This shim keeps the exact react-native Alert.alert contract:
//   • native  → passthrough to the real Alert
//   • web     → window.alert for message-only dialogs;
//               window.confirm for dialogs with button callbacks —
//               OK runs the primary (last non-cancel) button's onPress,
//               Cancel runs the `style: 'cancel'` button's onPress.
//
// Usage: `import { Alert } from '../utils/alert'` — no call-site changes.

import { Alert as RNAlert, AlertButton, Platform } from 'react-native';

const webAlert = (
  title: string,
  message?: string,
  buttons?: AlertButton[],
): void => {
  const text = [title, message].filter(Boolean).join('\n\n');
  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }
  const cancel = buttons.find(b => b.style === 'cancel');
  const primary = [...buttons].reverse().find(b => b.style !== 'cancel');
  if (window.confirm(text)) {
    primary?.onPress?.();
  } else {
    cancel?.onPress?.();
  }
};

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]): void {
    if (Platform.OS === 'web') {
      webAlert(title, message, buttons);
      return;
    }
    RNAlert.alert(title, message, buttons);
  },

  /** iOS-only in RN; web gets window.prompt. Same call contract. */
  prompt(
    title: string,
    message?: string,
    callbackOrButtons?: ((text: string) => void) | AlertButton[],
    type?: 'default' | 'plain-text' | 'secure-text' | 'login-password',
    defaultValue?: string,
    keyboardType?: string,
  ): void {
    if (Platform.OS === 'web') {
      const text = window.prompt([title, message].filter(Boolean).join('\n\n'), defaultValue ?? '');
      if (text === null) return;
      if (typeof callbackOrButtons === 'function') {
        callbackOrButtons(text);
      } else {
        const primary = callbackOrButtons
          ? [...callbackOrButtons].reverse().find(b => b.style !== 'cancel')
          : undefined;
        (primary?.onPress as ((t?: string) => void) | undefined)?.(text);
      }
      return;
    }
    (RNAlert.prompt as unknown as (...args: unknown[]) => void)(
      title, message, callbackOrButtons, type, defaultValue, keyboardType,
    );
  },
};
