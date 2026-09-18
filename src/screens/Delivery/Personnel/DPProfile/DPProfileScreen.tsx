import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppSelector } from '../../../../hooks/useReduxHooks';
import { useSignOut } from '../../../../hooks/useSignOut';
import { selectDeliveries } from '../../Admin/AssignDeliveries/deliverySlice';
import type { DPProfileStackParamList } from '../../../../navigators/stacks/DPProfileStack';
import NotificationIcon from '../../../../components/shared/NotificationIcon';
import { THEME } from '../../../../utils/theme';
import { DP_BRAND } from '../../../../utils/deliveryTheme';

type Props = NativeStackScreenProps<DPProfileStackParamList, 'DPProfile'>;

const DPProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { signingOut, confirmSignOut } = useSignOut();
  const user = useAppSelector(state => state.auth.user);
  const deliveries = useAppSelector(selectDeliveries);

  const userId = user?.uid ?? 'dp_002';
  const myDeliveries = deliveries.filter(d => d.assignedTo === userId);
  const delivered = myDeliveries.filter(d => d.status === 'delivered').length;
  const totalDeliveries = myDeliveries.length;
  const onTimeRate = delivered > 0 ? Math.min(98, Math.round((delivered / Math.max(1, totalDeliveries)) * 100)) : 0;
  const thisMonth = myDeliveries.filter(d => d.scheduledDate.startsWith('2026-03')).length;
  const rating = delivered > 0 ? 4.8 : 4.5;

  const displayName = user?.displayName ?? 'Delivery Personnel';
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const [profileImage, setProfileImage] = useState<string | null>(user?.photoURL ?? null);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setProfileImage(result.assets[0].uri);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={DP_BRAND.primary} />

      {/* Header with Gradient */}
      <LinearGradient
        colors={[DP_BRAND.primaryDark, DP_BRAND.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Profile</Text>
          <TouchableOpacity style={styles.headerIcon} activeOpacity={0.7}>
            <NotificationIcon size={20} color={THEME.colors.neutral0} />
          </TouchableOpacity>
        </View>

        {/* Profile Section inside gradient */}
        <View style={styles.profileHeaderSection}>
          <TouchableOpacity style={styles.avatarRing} onPress={pickImage} activeOpacity={0.8}>
            <View style={styles.avatar}>
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{initials}</Text>
              )}
            </View>
            <View style={styles.cameraOverlay}>
              <Feather name="camera" size={14} color={DP_BRAND.primary} />
            </View>
          </TouchableOpacity>

          <View style={styles.profileMeta}>
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.userEmail}>{user?.email ?? 'delivery@finmatrix.pk'}</Text>
            <View style={styles.roleBadge}>
              <Feather name="truck" size={10} color={THEME.colors.neutral0} />
              <Text style={styles.roleText}>Delivery Personnel</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Info Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account Information</Text>

          <View style={styles.infoList}>
            <View style={styles.infoRow}>
              <View style={styles.infoRowLeft}>
                <View style={[styles.infoRowIcon, { backgroundColor: THEME.colors.actionGreenLighter }]}>
                  <Feather name="smartphone" size={16} color={THEME.colors.success} />
                </View>
                <View>
                  <Text style={styles.infoLabel}>Phone Number</Text>
                  <Text style={styles.infoValue}>{user?.phoneNumber || '+92-301-1112233'}</Text>
                </View>
              </View>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoRowLeft}>
                <View style={[styles.infoRowIcon, { backgroundColor: THEME.colors.infoLight }]}>
                  <Feather name="at-sign" size={16} color={THEME.colors.info} />
                </View>
                <View>
                  <Text style={styles.infoLabel}>Username</Text>
                  <Text style={styles.infoValue}>{user?.username || 'FM2024.saim'}</Text>
                </View>
              </View>
            </View>
            <View style={[styles.infoRow, styles.infoRowLast]}>
              <View style={styles.infoRowLeft}>
                <View style={[styles.infoRowIcon, { backgroundColor: DP_BRAND.primarySoft }]}>
                  <Feather name="shield" size={16} color={DP_BRAND.primary} />
                </View>
                <View>
                  <Text style={styles.infoLabel}>Role</Text>
                  <Text style={[styles.infoValue, { color: THEME.colors.success }]}>Delivery</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Performance Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconWrap, { backgroundColor: THEME.colors.warningLight }]}>
              <Feather name="award" size={18} color={THEME.colors.warning} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Performance Metrics</Text>
              <Text style={styles.cardSubtitle}>Your delivery statistics</Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <View style={[styles.metricIconWrap, { backgroundColor: DP_BRAND.primarySoft }]}>
                <Feather name="package" size={18} color={DP_BRAND.primary} />
              </View>
              <Text style={styles.metricValue}>{totalDeliveries}</Text>
              <Text style={styles.metricLabel}>Total Deliveries</Text>
            </View>
            <View style={styles.metricItem}>
              <View style={[styles.metricIconWrap, { backgroundColor: THEME.colors.successLight }]}>
                <Feather name="clock" size={18} color={THEME.colors.success} />
              </View>
              <Text style={styles.metricValue}>{onTimeRate}%</Text>
              <Text style={styles.metricLabel}>On-Time Rate</Text>
            </View>
            <View style={styles.metricItem}>
              <View style={[styles.metricIconWrap, { backgroundColor: THEME.colors.warningLight }]}>
                <Feather name="star" size={18} color={THEME.colors.warning} />
              </View>
              <Text style={styles.metricValue}>{rating.toFixed(1)}</Text>
              <Text style={styles.metricLabel}>Rating</Text>
            </View>
            <View style={styles.metricItem}>
              <View style={[styles.metricIconWrap, { backgroundColor: THEME.colors.secondaryLight }]}>
                <Feather name="calendar" size={18} color={THEME.colors.secondary} />
              </View>
              <Text style={styles.metricValue}>{thisMonth}</Text>
              <Text style={styles.metricLabel}>This Month</Text>
            </View>
          </View>
        </View>

        {/* Menu Card */}
        <View style={styles.menuCard}>
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate('DPHistory')}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconWrap, { backgroundColor: DP_BRAND.primarySoft }]}>
                <Feather name="file-text" size={16} color={DP_BRAND.primary} />
              </View>
              <View>
                <Text style={styles.menuLabel}>Delivery History</Text>
                <Text style={styles.menuHint}>View all past deliveries</Text>
              </View>
            </View>
            <View style={styles.menuArrow}>
              <Feather name="chevron-right" size={16} color={THEME.colors.textTertiary} />
            </View>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate('DPSettings')}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconWrap, { backgroundColor: THEME.colors.neutral100 }]}>
                <Feather name="settings" size={16} color={THEME.colors.neutral600} />
              </View>
              <View>
                <Text style={styles.menuLabel}>Settings</Text>
                <Text style={styles.menuHint}>Notifications & preferences</Text>
              </View>
            </View>
            <View style={styles.menuArrow}>
              <Feather name="chevron-right" size={16} color={THEME.colors.textTertiary} />
            </View>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity 
            style={styles.menuItem}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconWrap, { backgroundColor: THEME.colors.infoLight }]}>
                <Feather name="help-circle" size={16} color={THEME.colors.info} />
              </View>
              <View>
                <Text style={styles.menuLabel}>Help & Support</Text>
                <Text style={styles.menuHint}>Get help with the app</Text>
              </View>
            </View>
            <View style={styles.menuArrow}>
              <Feather name="chevron-right" size={16} color={THEME.colors.textTertiary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          style={[styles.signOutButton, signingOut && { opacity: 0.5 }]}
          onPress={confirmSignOut}
          disabled={signingOut}
          activeOpacity={0.7}
        >
          <Feather name="log-out" size={16} color={THEME.colors.danger} />
          <Text style={styles.signOutText}>{signingOut ? 'Signing Out…' : 'Sign Out'}</Text>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>FinMatrix Delivery</Text>
          <Text style={styles.footerVersion}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },

  // Gradient Header
  headerGradient: {
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    ...THEME.typography.h3,
    color: THEME.colors.neutral0,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Profile Header Section
  profileHeaderSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 16,
  },
  avatarRing: {
    position: 'relative',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: THEME.colors.neutral0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarText: {
    ...THEME.typography.h1,
    color: DP_BRAND.primary,
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.colors.neutral0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: DP_BRAND.primary,
    ...THEME.shadows.sm,
  },
  profileMeta: {
    flex: 1,
  },
  userName: {
    ...THEME.typography.h3,
    color: THEME.colors.neutral0,
    marginBottom: 2,
  },
  userEmail: {
    ...THEME.typography.bodySm,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.full,
    gap: 4,
  },
  roleText: {
    ...THEME.typography.labelSm,
    color: THEME.colors.neutral0,
  },

  scrollView: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // Section Title
  sectionTitle: {
    ...THEME.typography.h4,
    color: THEME.colors.textPrimary,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
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

  // Info List
  infoList: {
    padding: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  infoRowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    ...THEME.typography.labelSm,
    color: THEME.colors.textTertiary,
    marginBottom: 2,
  },
  infoValue: {
    ...THEME.typography.labelLg,
    color: THEME.colors.textPrimary,
  },

  // Card Header (for performance)
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  cardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: THEME.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
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

  // Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
  },
  metricItem: {
    width: '50%',
    padding: 12,
    alignItems: 'center',
  },
  metricIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  metricValue: {
    ...THEME.typography.h2,
    color: THEME.colors.textPrimary,
  },
  metricLabel: {
    ...THEME.typography.labelSm,
    color: THEME.colors.textSecondary,
    marginTop: 4,
  },

  // Menu Card
  menuCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    marginBottom: 16,
    ...THEME.shadows.sm,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: THEME.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuLabel: {
    ...THEME.typography.labelLg,
    color: THEME.colors.textPrimary,
  },
  menuHint: {
    ...THEME.typography.caption,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: THEME.colors.borderLight,
    marginLeft: 70,
  },
  menuArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.colors.neutral50,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Sign Out
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    borderRadius: THEME.radius.lg,
    paddingVertical: 14,
    marginBottom: 16,
    gap: 8,
  },
  signOutText: {
    ...THEME.typography.h4,
    color: THEME.colors.danger,
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  footerText: {
    ...THEME.typography.labelSm,
    color: THEME.colors.textTertiary,
  },
  footerVersion: {
    ...THEME.typography.caption,
    color: THEME.colors.textDisabled,
    marginTop: 2,
  }
});

export default DPProfileScreen;
