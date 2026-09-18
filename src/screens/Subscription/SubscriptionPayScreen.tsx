// ═══════════════════════════════════════════════════════
// FinMatrix — Subscription Payment (shared across all three flows)
// Bill → platform bank details → upload transfer screenshot → await approval.
// Reused by Flow 2 (renew on expiry) and Flow 3 (upgrade/change from Settings).
// ═══════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform
} from 'react-native';
import { Alert } from '../../utils/alert';
import { Feather } from '@expo/vector-icons';
import {
  AuthLayout,
  AuthHeader,
  AuthFooterBar,
  AuthIconTile,
  AuthTimeline
} from '../../components/auth/AuthUI';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { selectUser, setUser } from '../Auth/authSlice';
import { authMe, submitCompanyAPI } from '../../networks/auth/authNetwork';
import { THEME } from '../../theme';

// Design-system tokens (see src/theme/theme.ts).
const { colors } = THEME;
import {
  getBankDetailsAPI,
  getCachedBankDetails,
  submitPaymentAPI,
  type BankDetails,
  type PlanKey
} from '../../networks/billing/billingNetwork';

const DS = {
  navy: THEME.colors.neutral900,
  primary: THEME.colors.actionGreen,
  primaryDark: THEME.colors.actionGreenDark,
  bg: THEME.colors.background,
  surface: THEME.colors.neutral0,
  border: THEME.colors.border,
  text: { h: THEME.colors.textPrimary, sub: THEME.colors.textSecondary, muted: THEME.colors.textTertiary, inv: THEME.colors.neutral0 }
};

// RN's Alert is a no-op on react-native-web — fall back to window.alert there
// so validation/errors are never silently swallowed.
const notify = (title: string, message?: string) => {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
};

type Props = NativeStackScreenProps<RootStackParamList, 'SubscriptionPay'>;

const SubscriptionPayScreen: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const plan = (route.params?.plan ?? 'standard') as PlanKey;
  const mode = route.params?.mode ?? 'change';

  // Seeded from the cache the plan picker warmed, so arriving here is
  // instant. Only a cold entry (deep link, back-navigation after a restart)
  // ever sees the spinner.
  const cachedDetails = getCachedBankDetails(plan);
  const [loading, setLoading] = useState(!cachedDetails);
  const [details, setDetails] = useState<BankDetails | null>(cachedDetails);
  const [image, setImage] = useState<{ uri: string; mimeType?: string; fileName?: string } | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const fresh = await getBankDetailsAPI(plan);
        setDetails(fresh);
      } catch (e: any) {
        // A cached copy is already on screen; only shout if we have nothing.
        if (!cachedDetails) {
          notify('Could not load bill', e?.message ?? 'Please try again.');
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  const copy = async (label: string, value: string) => {
    await Clipboard.setStringAsync(value);
    notify('Copied', `${label} copied to clipboard.`);
  };

  const pickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        notify('Permission needed', 'Allow photo access to attach your transfer screenshot.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], // modern API (MediaTypeOptions is deprecated)
        quality: 0.7
      });
      if (!res.canceled && res.assets?.[0]) {
        const a = res.assets[0];
        setImage({ uri: a.uri, mimeType: a.mimeType ?? 'image/jpeg', fileName: a.fileName ?? undefined });
      }
    } catch (e: any) {
      notify('Could not open gallery', e?.message ?? 'Please try again.');
    }
  };

  const handleSubmit = async () => {
    if (!image) {
      notify('Screenshot required', 'Please attach a screenshot of your bank transfer.');
      return;
    }
    setSubmitting(true);
    try {
      await submitPaymentAPI(plan, image);
      // Signup flow (three-tier registration): the payment is in — now submit
      // the company for platform-admin approval. Approval activates the
      // company with this plan's feature set and expiry.
      if (mode === 'signup' && route.params?.companyId) {
        try {
          await submitCompanyAPI(route.params.companyId);
        } catch {
          /* company may already be submitted — approval flow proceeds */
        }
      }
      // Refresh the session so the gate sees the submitted payment. The
      // server reports `pending` once a receipt is awaiting verification, so
      // in signup mode the navigator swaps straight to Awaiting approval and
      // the interstitial "Bill submitted / Done" screen is skipped — it was
      // one extra tap to reach the same place.
      let routed = false;
      try {
        const me = await authMe();
        const nextStatus = me.data.user.companyStatus ?? user?.companyStatus ?? null;
        if (user) {
          dispatch(setUser({ ...user, companyStatus: nextStatus }));
          routed = mode === 'signup' && nextStatus === 'pending';
        }
      } catch {
        /* non-fatal — fall back to the confirmation screen below */
      }
      if (mode === 'signup' && !routed && user) {
        // Server refresh failed; move the gate locally so the user is not
        // stranded on the payment form after a successful submission.
        dispatch(setUser({ ...user, companyStatus: 'pending_approval' }));
        routed = true;
      }
      if (!routed) setSubmitted(true);
    } catch (e: any) {
      notify('Submission failed', e?.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[S.root, S.center]}>
        <ActivityIndicator size="large" color={DS.primary} />
      </View>
    );
  }

  // ── Success / awaiting-verification state ──
  if (submitted) {
    return (
      <AuthLayout
        header={
          <AuthHeader
            pill="Payment Submitted"
            title="Bill submitted successfully"
            subtitle="We will activate your plan as soon as the payment is verified."
          />
        }
        footer={
          <AuthFooterBar
            primary={{
              label: 'Done',
              onPress: () => {
                if (mode === 'signup') {
                  // Route the admin to the awaiting-approval screen;
                  // BaseNavigator keeps them there until approval.
                  if (user) {
                    dispatch(
                      setUser({
                        ...user,
                        companyId: route.params?.companyId ?? user.companyId,
                        companyStatus: 'pending_approval',
                      }),
                    );
                  }
                } else if (mode === 'change') navigation.goBack();
                else navigation.navigate('RenewSubscription' as never);
              },
            }}
            note="Reviews are usually completed within one business day"
          />
        }>
        <AuthIconTile icon="clock" tone="warning" style={{ marginBottom: 20 }} />
        <Text style={S.successSub}>
          Your payment for the {details?.planLabel} plan was submitted. Please wait for admin
          approval — your plan activates automatically once the payment is verified
          {mode === 'renew'
            ? ', then sign in again to restore full access.'
            : mode === 'signup'
              ? ' — you will be able to sign in with full access once approved.'
              : '.'}
        </Text>
        <AuthTimeline
          items={[
            { title: 'Payment receipt uploaded', detail: details?.amountDueLabel ?? '', done: true },
            { title: 'Administrator verification', detail: 'Usually within one business day', done: false },
            { title: 'Plan activated', detail: 'Full access restored automatically', done: false },
          ]}
        />
      </AuthLayout>
    );
  }

  const bank = details?.bankAccount;

  return (
    <AuthLayout
      header={
        <AuthHeader
          pill="Complete Payment"
          title="Complete your payment"
          subtitle={`${mode === 'renew' ? 'Renew' : 'Subscribe to'} the ${details?.planLabel ?? ''} plan`}
          onBack={() => navigation.goBack()}
          step={mode === 'signup' ? { current: 4, total: 4 } : undefined}
        />
      }
      footer={
        <AuthFooterBar
          primary={{
            label: 'Submit for verification',
            onPress: handleSubmit,
            loading: submitting,
            loadingLabel: 'Submitting',
          }}
          note="Activates once an administrator verifies the payment"
        />
      }>
      <>
        {/* Bill */}
        <View style={S.card}>
          <Text style={S.cardLabel}>AMOUNT DUE</Text>
          <Text style={S.amount}>{details?.amountDueLabel}</Text>
          <Text style={S.billMeta}>
            {details?.planLabel} plan
            {details?.durationMonths && details?.monthlyLabel
              ? ` · ${details.monthlyLabel}/month × ${details.durationMonths} months`
              : details?.durationMonths
                ? ` · ${details.durationMonths} months`
                : ''}
          </Text>
        </View>

        {/* Bank details */}
        <View style={S.card}>
          <Text style={S.sectionTitle}>Transfer to this account</Text>
          {bank && (
            <>
              <Row label="Account title" value={bank.accountTitle} onCopy={copy} />
              <Row label="Bank" value={bank.bankName} onCopy={copy} />
              <Row label="Account number" value={bank.accountNumber} onCopy={copy} />
            </>
          )}
          <View style={S.noteBox}>
            <Feather name="info" size={14} color={DS.primary} />
            <Text style={S.noteText}>{bank?.instructions}</Text>
          </View>
        </View>

        {/* Upload screenshot */}
        <View style={S.card}>
          <Text style={S.sectionTitle}>Upload transfer screenshot</Text>
          {image ? (
            <View>
              <Image source={{ uri: image.uri }} style={S.preview} resizeMode="cover" />
              <TouchableOpacity style={S.changeBtn} onPress={pickImage}>
                <Feather name="refresh-cw" size={14} color={DS.primary} />
                <Text style={S.changeBtnText}>Change screenshot</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={S.uploadBox} onPress={pickImage} activeOpacity={0.8}>
              <Feather name="upload-cloud" size={28} color={DS.primary} />
              <Text style={S.uploadText}>Tap to attach your receipt</Text>
              <Text style={S.uploadHint}>JPG / PNG, up to 8 MB</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={S.legal}>
          Your subscription activates once an administrator verifies the payment. Your data is
          never affected by this process.
        </Text>
      </>
    </AuthLayout>
  );
};

const Row: React.FC<{
  label: string;
  value: string;
  onCopy: (label: string, value: string) => void;
}> = ({ label, value, onCopy }) => (
  <View style={S.row}>
    <View style={{ flex: 1 }}>
      <Text style={S.rowLabel}>{label}</Text>
      <Text style={S.rowValue}>{value}</Text>
    </View>
    <TouchableOpacity onPress={() => onCopy(label, value)} style={S.copyBtn}>
      <Feather name="copy" size={16} color={DS.primary} />
    </TouchableOpacity>
  </View>
);

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  header: { backgroundColor: DS.navy, paddingHorizontal: 20, paddingBottom: 20 },
  back: {
    width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)', marginBottom: 14
  },
  headerTitle: { ...THEME.typography.h2, color: colors.neutral0 },
  headerSub: { ...THEME.typography.bodySm, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  scroll: { padding: 16, gap: 14, paddingBottom: 40 },

  card: {
    backgroundColor: DS.surface, borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: DS.border
  },
  cardLabel: { ...THEME.typography.overline, color: DS.text.muted, letterSpacing: 1 },
  amount: { ...THEME.typography.displayLg, color: DS.text.h, marginTop: 6 },
  billMeta: { ...THEME.typography.bodySm, color: DS.text.sub, marginTop: 4 },

  sectionTitle: { ...THEME.typography.labelLg, color: DS.text.h, marginBottom: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: THEME.colors.neutral100
  },
  rowLabel: { ...THEME.typography.caption, color: DS.text.muted },
  rowValue: { ...THEME.typography.labelLg, color: DS.text.h, marginTop: 2 },
  copyBtn: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: colors.actionGreenLighter,
    alignItems: 'center', justifyContent: 'center'
  },
  noteBox: {
    flexDirection: 'row', gap: 8, backgroundColor: colors.actionGreenLighter, borderRadius: 10,
    padding: 12, marginTop: 12
  },
  noteText: { ...THEME.typography.caption, flex: 1, color: DS.text.sub, lineHeight: 18 },

  uploadBox: {
    borderWidth: 1.5, borderColor: colors.successLight, borderStyle: 'dashed', borderRadius: 12,
    paddingVertical: 28, alignItems: 'center', gap: 6, backgroundColor: colors.actionGreenLighter
  },
  uploadText: { ...THEME.typography.h5, color: DS.text.h },
  uploadHint: { ...THEME.typography.caption, color: DS.text.muted },
  preview: { width: '100%', height: 200, borderRadius: 12, backgroundColor: THEME.colors.primaryLighter },
  changeBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingTop: 12 },
  changeBtnText: { ...THEME.typography.labelMd, color: DS.primary },

  cta: {
    height: 54, borderRadius: 14, backgroundColor: DS.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 4
  },
  ctaDisabled: { opacity: 0.5 },
  ctaLabel: { ...THEME.typography.h4, color: colors.neutral0 },
  legal: { ...THEME.typography.caption, color: DS.text.muted, textAlign: 'center', lineHeight: 16, marginTop: 4 },

  doneBtn: {
    flexDirection: 'row', gap: 8, alignSelf: 'stretch', height: 54, borderRadius: 14,
    backgroundColor: DS.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: DS.primaryDark, shadowOpacity: 0.25, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }, elevation: 4
  },
  successIcon: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: colors.actionGreenLighter,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20
  },
  successTitle: { ...THEME.typography.h2, color: DS.text.h, textAlign: 'center' },
  successSub: { ...THEME.typography.bodySm, color: DS.text.sub, textAlign: 'center', lineHeight: 21, marginTop: 10, marginBottom: 28 },
});

export default SubscriptionPayScreen;
