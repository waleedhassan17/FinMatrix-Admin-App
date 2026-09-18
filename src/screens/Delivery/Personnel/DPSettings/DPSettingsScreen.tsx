import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  ActivityIndicator
} from 'react-native';
import { Alert } from '../../../../utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DPProfileStackParamList } from '../../../../navigators/stacks/DPProfileStack';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useSignOut } from '../../../../hooks/useSignOut';
import { selectDPSettings, setPushNotifications, setSmsNotifications, setEmailNotifications } from './dpSettingsSlice';
import { selectUser } from '../../../Auth/authSlice';
import { authForgotPassword } from '../../../../networks/auth/authNetwork';
import NotificationIcon from '../../../../components/shared/NotificationIcon';
import { THEME } from '../../../../utils/theme';
import { DP_BRAND } from '../../../../utils/deliveryTheme';

type Props = NativeStackScreenProps<DPProfileStackParamList, 'DPSettings'>;

// Plain alerts need a web fallback (Alert.alert is a no-op on react-native-web).
const notifyDP = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    (globalThis as any).alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

const DPSettingsScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const settings = useAppSelector(selectDPSettings);
  const user = useAppSelector(selectUser);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const { signingOut, confirmSignOut } = useSignOut();

  const handleChangePassword = async () => {
    if (!user?.email) {
      notifyDP('No email', 'No email on file for this account.');
      return;
    }
    if (isSendingReset) return;
    setIsSendingReset(true);
    try {
      await authForgotPassword({ forgotPasswordInfo: { email: user.email } });
      notifyDP(
        'Reset code sent',
        `A password reset code was sent to ${user.email}. Sign out and use "Forgot password" on the sign-in screen to set a new password.`,
      );
    } catch (e: any) {
      notifyDP('Could not send code', e?.message || 'Please try again.');
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={DP_BRAND.primary} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={20} color={DP_BRAND.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>Manage your preferences</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Notifications Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconWrap, { backgroundColor: THEME.colors.warningLight }]}>
              <NotificationIcon size={20} color={THEME.colors.warning} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Notifications</Text>
              <Text style={styles.cardSubtitle}>Manage how you receive alerts</Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.settingsList}>
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIconWrap, { backgroundColor: DP_BRAND.primarySoft }]}>
                  <Feather name="smartphone" size={18} color={DP_BRAND.primary} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Push Notifications</Text>
                  <Text style={styles.settingHint}>Receive instant alerts on your device</Text>
                </View>
              </View>
              <Switch
                value={settings.pushNotifications}
                onValueChange={v => { dispatch(setPushNotifications(v)); }}
                trackColor={{ false: THEME.colors.neutral200, true: DP_BRAND.primarySoft }}
                thumbColor={settings.pushNotifications ? DP_BRAND.primary : THEME.colors.neutral50}
              />
            </View>

            <View style={styles.settingDivider} />

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIconWrap, { backgroundColor: THEME.colors.successLight }]}>
                  <Feather name="message-square" size={18} color={THEME.colors.success} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>SMS Notifications</Text>
                  <Text style={styles.settingHint}>Get text messages for updates</Text>
                </View>
              </View>
              <Switch
                value={settings.smsNotifications}
                onValueChange={v => { dispatch(setSmsNotifications(v)); }}
                trackColor={{ false: THEME.colors.neutral200, true: THEME.colors.successLight }}
                thumbColor={settings.smsNotifications ? THEME.colors.success : THEME.colors.neutral50}
              />
            </View>

            <View style={styles.settingDivider} />

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIconWrap, { backgroundColor: THEME.colors.warningLight }]}>
                  <Feather name="mail" size={18} color={THEME.colors.warning} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Email Notifications</Text>
                  <Text style={styles.settingHint}>Receive daily summaries via email</Text>
                </View>
              </View>
              <Switch
                value={settings.emailNotifications}
                onValueChange={v => { dispatch(setEmailNotifications(v)); }}
                trackColor={{ false: THEME.colors.neutral200, true: THEME.colors.warningLight }}
                thumbColor={settings.emailNotifications ? THEME.colors.warning : THEME.colors.neutral50}
              />
            </View>
          </View>
        </View>

        {/* Account Security Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconWrap, { backgroundColor: THEME.colors.secondaryLight }]}>
              <Feather name="lock" size={20} color={THEME.colors.secondary} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Account & Security</Text>
              <Text style={styles.cardSubtitle}>Manage account settings</Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.actionsList}>
            <TouchableOpacity 
              style={[styles.actionItem, isSendingReset && { opacity: 0.5 }]}
              onPress={handleChangePassword}
              disabled={isSendingReset}
              activeOpacity={0.7}
            >
              <View style={styles.actionLeft}>
                <View style={[styles.actionIconWrap, { backgroundColor: THEME.colors.infoLight }]}>
                  <Feather name="key" size={16} color={THEME.colors.info} />
                </View>
                <Text style={styles.actionLabel}>{isSendingReset ? 'Sending reset code…' : 'Change Password'}</Text>
              </View>
              <View style={styles.actionArrow}>
                <Feather name="chevron-right" size={14} color={THEME.colors.textTertiary} />
              </View>
            </TouchableOpacity>

            <View style={styles.actionDivider} />

            <TouchableOpacity
              style={[styles.actionItem, signingOut && { opacity: 0.5 }]}
              onPress={confirmSignOut}
              disabled={signingOut}
              activeOpacity={0.7}
            >
              <View style={styles.actionLeft}>
                <View style={[styles.actionIconWrap, { backgroundColor: THEME.colors.dangerLight }]}>
                  <Feather name="log-out" size={16} color={THEME.colors.danger} />
                </View>
                <Text style={[styles.actionLabel, { color: THEME.colors.danger }]}>
                  {signingOut ? 'Signing Out…' : 'Sign Out'}
                </Text>
              </View>
              {signingOut ? (
                <ActivityIndicator size="small" color={THEME.colors.danger} />
              ) : (
                <View style={styles.actionArrow}>
                  <Feather name="chevron-right" size={14} color={THEME.colors.textTertiary} />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Support Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconWrap, { backgroundColor: THEME.colors.infoLight }]}>
              <Feather name="life-buoy" size={20} color={THEME.colors.info} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Support & Info</Text>
              <Text style={styles.cardSubtitle}>Get help and learn more</Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.actionsList}>
            <TouchableOpacity 
              style={styles.actionItem}
              onPress={() => {
                Linking.openURL('mailto:support@finmatrix.pk?subject=FinMatrix%20Delivery%20Support').catch(() =>
                  notifyDP('Help Center', 'Contact support@finmatrix.pk for assistance.'),
                );
              }}
              activeOpacity={0.7}
            >
              <View style={styles.actionLeft}>
                <View style={[styles.actionIconWrap, { backgroundColor: THEME.colors.warningLight }]}>
                  <Feather name="help-circle" size={16} color={THEME.colors.warning} />
                </View>
                <Text style={styles.actionLabel}>Help Center</Text>
              </View>
              <View style={styles.actionArrow}>
                <Feather name="chevron-right" size={14} color={THEME.colors.textTertiary} />
              </View>
            </TouchableOpacity>

            <View style={styles.actionDivider} />

            <TouchableOpacity 
              style={styles.actionItem}
              onPress={() => {
                Linking.openURL('https://github.com/waleedhassan17/FinMatrix#readme').catch(() =>
                  notifyDP('Privacy Policy', 'Visit the FinMatrix documentation for the privacy policy.'),
                );
              }}
              activeOpacity={0.7}
            >
              <View style={styles.actionLeft}>
                <View style={[styles.actionIconWrap, { backgroundColor: THEME.colors.neutral100 }]}>
                  <Feather name="file-text" size={16} color={THEME.colors.neutral600} />
                </View>
                <Text style={styles.actionLabel}>Privacy Policy</Text>
              </View>
              <View style={styles.actionArrow}>
                <Feather name="chevron-right" size={14} color={THEME.colors.textTertiary} />
              </View>
            </TouchableOpacity>

            <View style={styles.actionDivider} />

            <TouchableOpacity 
              style={styles.actionItem}
              onPress={() => notifyDP('About FinMatrix', 'FinMatrix Delivery v1.0\n\nBuilt for delivery excellence.')}
              activeOpacity={0.7}
            >
              <View style={styles.actionLeft}>
                <View style={[styles.actionIconWrap, { backgroundColor: DP_BRAND.primarySoft }]}>
                  <Feather name="info" size={16} color={DP_BRAND.primary} />
                </View>
                <Text style={styles.actionLabel}>About App</Text>
              </View>
              <View style={styles.versionBadge}>
                <Text style={styles.versionBadgeText}>v1.0</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* App Info Footer */}
        <View style={styles.appInfo}>
          <View style={styles.appInfoLogo}>
            <Text style={styles.appInfoLogoText}>FM</Text>
          </View>
          <Text style={styles.appInfoName}>FinMatrix Delivery</Text>
          <Text style={styles.appInfoVersion}>Version 1.0.0 (Build 2026.03)</Text>
          <Text style={styles.appInfoCopyright}>© 2026 FinMatrix. All rights reserved.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DP_BRAND.primary,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: DP_BRAND.primary,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DP_BRAND.headerOverlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    ...THEME.typography.h2,
    color: THEME.colors.neutral700,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    ...THEME.typography.h3,
    color: DP_BRAND.white,
  },
  headerSubtitle: {
    ...THEME.typography.caption,
    color: DP_BRAND.headerTextSecondary,
    marginTop: 2,
  },
  headerSpacer: {
    width: 40,
  },

  scrollView: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    backgroundColor: THEME.colors.background,
  },

  // Card
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    marginBottom: 16,
    ...THEME.shadows.sm,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: THEME.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardIcon: {
    ...THEME.typography.h2,
    
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    ...THEME.typography.h4,
    color: THEME.colors.textPrimary,
  },
  cardSubtitle: {
    ...THEME.typography.caption,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  cardDivider: {
    height: 1,
    backgroundColor: THEME.colors.borderLight,
  },

  // Settings List
  settingsList: {
    padding: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  settingIconWrap: {
    width: 40,
    height: 40,
    borderRadius: THEME.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  settingIcon: {
    ...THEME.typography.h3,
    
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    ...THEME.typography.labelLg,
    color: THEME.colors.textPrimary,
  },
  settingHint: {
    ...THEME.typography.caption,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  settingDivider: {
    height: 1,
    backgroundColor: THEME.colors.borderLight,
    marginVertical: 12,
    marginLeft: 54,
  },

  // Actions List
  actionsList: {
    padding: 12,
  },
  actionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: THEME.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  actionIcon: {
    ...THEME.typography.h3,
    
  },
  actionLabel: {
    ...THEME.typography.labelLg,
    color: THEME.colors.textPrimary,
  },
  actionDivider: {
    height: 1,
    backgroundColor: THEME.colors.borderLight,
    marginLeft: 54,
  },
  actionArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.colors.neutral50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionArrowText: {
    ...THEME.typography.bodyMd,
    color: THEME.colors.textTertiary,
  },
  statusBadge: {
    backgroundColor: THEME.colors.neutral100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.full,
  },
  statusBadgeText: {
    ...THEME.typography.labelSm,
    color: THEME.colors.textSecondary,
  },
  versionBadge: {
    backgroundColor: DP_BRAND.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.full,
  },
  versionBadgeText: {
    ...THEME.typography.labelSm,
    color: DP_BRAND.primary,
  },

  // App Info Footer
  appInfo: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 8,
  },
  appInfoLogo: {
    width: 48,
    height: 48,
    borderRadius: THEME.radius.lg,
    backgroundColor: DP_BRAND.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    ...THEME.shadows.sm,
  },
  appInfoLogoText: {
    ...THEME.typography.h3,
    color: THEME.colors.textInverse,
  },
  appInfoName: {
    ...THEME.typography.labelLg,
    color: THEME.colors.textSecondary,
  },
  appInfoVersion: {
    ...THEME.typography.caption,
    color: THEME.colors.textTertiary,
    marginTop: 4,
  },
  appInfoCopyright: {
    ...THEME.typography.caption,
    color: THEME.colors.textDisabled,
    marginTop: 8,
  }
});

export default DPSettingsScreen;