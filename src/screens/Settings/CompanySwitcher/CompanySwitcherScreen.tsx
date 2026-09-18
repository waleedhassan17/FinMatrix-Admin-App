import React, { useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { THEME } from '../../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { selectActiveCompany, setActiveCompany } from '../../Auth/companySlice';
import { selectCompanies, selectSwitcherLoading, loadCompanies } from './companySwitcherSlice';
import type { CompanySwitcherItem } from '../../../networks/settings/settingsNetwork';
import type { MoreStackParamList } from '../../../navigators/stacks/MoreStack';

// Design-system tokens (see src/theme/theme.ts).
const { colors, radius, shadows, spacing, typography } = THEME;

type Nav = NativeStackNavigationProp<MoreStackParamList>;

const P = {
  brand: colors.actionGreen,
  brandLight: colors.actionGreenLighter,
  pageBg: colors.neutral50,
  card: colors.neutral0,
  text: colors.neutral800,
  sub: colors.neutral400,
  divider: colors.neutral200,
  active: colors.actionGreen,
  activeBg: colors.actionGreenLighter
};

const CompanySwitcherScreen: React.FC = () => {
  const nav = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const companies = useAppSelector(selectCompanies);
  const loading = useAppSelector(selectSwitcherLoading);
  const activeCompany = useAppSelector(selectActiveCompany);
  const activeId = activeCompany?.companyId ?? '';

  useEffect(() => { dispatch(loadCompanies()); }, [dispatch]);

  // Switch directly and go back — Alert button callbacks never fire on
  // react-native-web, so no confirmation dialog is used here.
  const handleSwitch = useCallback(
    (id: string) => {
      dispatch(setActiveCompany(id));
      nav.goBack();
    },
    [dispatch, nav],
  );

  const handleLongPress = useCallback(
    () => nav.navigate('CompanyProfile'),
    [nav],
  );

  const renderCompany = ({ item }: { item: CompanySwitcherItem }) => {
    const isActive = item.companyId === activeId;
    return (
      <TouchableOpacity
        style={[s.companyCard, isActive && s.activeCard]}
        activeOpacity={0.6}
        onPress={() => handleSwitch(item.companyId)}
        onLongPress={handleLongPress}
      >
        <View style={s.cardTop}>
          <View style={[s.companyIcon, isActive && { backgroundColor: P.activeBg }]}>
            <Feather name="briefcase" size={20} color={isActive ? P.active : P.brand} />
          </View>
          <View style={s.cardInfo}>
            <Text style={s.companyName}>{item.name}</Text>
            <Text style={s.companyIndustry}>{item.industry}</Text>
          </View>
          {isActive && (
            <View style={s.activeBadge}>
              <Feather name="check-circle" size={14} color={P.active} />
              <Text style={s.activeText}>Active</Text>
            </View>
          )}
        </View>
        <View style={s.cardBottom}>
          <View style={s.chip}>
            <Feather name="user" size={12} color={P.sub} />
            <Text style={s.chipText}>{item.role}</Text>
          </View>
          <View style={s.chip}>
            <Feather name="users" size={12} color={P.sub} />
            <Text style={s.chipText}>{item.memberCount} members</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={22} color={P.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Companies</Text>
        <View style={{ width: 22 }} />
      </View>

      <FlatList
        data={companies}
        keyExtractor={i => i.companyId}
        renderItem={renderCompany}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? (
            <Text style={s.empty}>Loading…</Text>
          ) : (
            <Text style={s.empty}>No companies found</Text>
          )
        }
        ListFooterComponent={
          <Text style={s.footerNote}>
            New companies are registered through sign-up and reviewed by the
            platform team before they appear here.
          </Text>
        }
      />
    </SafeAreaView>
  );
};

export default CompanySwitcherScreen;

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: P.pageBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: P.card,
    borderBottomWidth: 1,
    borderBottomColor: P.divider,
  },
  headerTitle: {
    ...typography.h3,
    color: P.text,
  },
  list: { padding: spacing.md, paddingBottom: spacing.xxl },
  empty: {
    ...typography.bodySm,
    textAlign: 'center',
    marginTop: 60,
    color: P.sub,
  },
  companyCard: {
    backgroundColor: P.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.xs,
    ...shadows.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  activeCard: {
    borderColor: P.active,
    backgroundColor: colors.neutral25,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  companyIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: P.brandLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardInfo: { flex: 1 },
  companyName: {
    ...typography.h4,
    color: P.text,
  },
  companyIndustry: {
    ...typography.bodySm,
    color: P.sub,
    marginTop: 2,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: P.activeBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  activeText: {
    ...typography.labelSm,
    color: P.active,
  },
  cardBottom: {
    flexDirection: 'row',
    marginTop: 12,
    gap: spacing.xs,
    paddingLeft: 56,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: P.pageBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  chipText: {
    ...typography.caption,
    color: P.sub,
  },
  footerNote: {
    ...typography.caption,
    marginTop: spacing.md,
    marginHorizontal: spacing.xs,
    lineHeight: 18,
    color: P.sub,
    textAlign: 'center',
  }
});
