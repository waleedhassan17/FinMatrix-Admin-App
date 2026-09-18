import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

import { THEME } from '../../../utils/theme';
import { useAppSelector } from '../../../hooks/useReduxHooks';
import { selectVisibleReportCategories } from './reportsHubSlice';
import type { ReportsStackParamList } from '../../../navigators/stacks/ReportsStack';
import {
  ReportContainer,
  ReportHeader,
  SectionCard,
  Badge,
  EmptyBlock
} from '../../../components/reports/ReportUI';

type ReportsNav = NativeStackNavigationProp<ReportsStackParamList>;

const CATEGORY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  financial: 'bar-chart-2',
  ar: 'arrow-down-left',
  inventory: 'package',
  sales: 'trending-up',
  delivery: 'truck'
};

const getCatIcon = (key: string): keyof typeof Feather.glyphMap => CATEGORY_ICONS[key] ?? 'file-text';

const ReportsHubScreen: React.FC = () => {
  const navigation = useNavigation<ReportsNav>();
  const categories = useAppSelector(selectVisibleReportCategories);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories
      .map(c => ({
        ...c,
        items: c.items.filter(i => i.title.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)),
      }))
      .filter(c => c.items.length > 0);
  }, [categories, search]);

  const handlePress = useCallback(
    (item: { title: string; target: string }) => navigation.navigate(item.target as any),
    [navigation],
  );

  return (
    <ReportContainer>
      {/* No header actions: the download and filter icons that used to sit here
          had no onPress at all — they were decoration that looked like
          function. A control that does nothing is worse than no control. */}
      <ReportHeader
        title="Reports"
        subtitle="Financial & operations reporting"
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Search */}
        <View style={styles.searchWrap}>
          <Feather name="search" size={16} color={THEME.colors.textTertiary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search reports…"
            placeholderTextColor={THEME.colors.textTertiary}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x-circle" size={16} color={THEME.colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {filtered.length === 0 && (
          <View style={styles.emptyWrap}>
            <EmptyBlock icon="search" title={`No reports match "${search}"`} />
          </View>
        )}

        {filtered.map(category => (
          <SectionCard
            key={category.key}
            title={category.title}
            subtitle={`${category.items.length} report${category.items.length !== 1 ? 's' : ''}`}
            icon={getCatIcon(category.key)}
            style={styles.catCard}
          >
            <View style={styles.itemList}>
              {category.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.key}
                  activeOpacity={0.6}
                  style={[styles.itemRow, idx < category.items.length - 1 && styles.itemRowBordered]}
                  onPress={() => handlePress(item)}
                >
                  <View style={styles.itemAccent} />
                  <View style={styles.itemContent}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={styles.itemSub}>View report</Text>
                  </View>
                  <Badge label="Ready" />
                  <Feather name="chevron-right" size={18} color={THEME.colors.textTertiary} style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              ))}
            </View>
          </SectionCard>
        ))}

        <View style={{ height: 24 }} />
      </ScrollView>
    </ReportContainer>
  );
};

const styles = StyleSheet.create({
  content: { padding: THEME.spacing.md, gap: THEME.spacing.sm + 2, paddingBottom: THEME.spacing.xl },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.colors.border,
    paddingHorizontal: 12,
    height: 44,
    ...THEME.shadows.xs,
  },
  searchInput: { flex: 1, ...THEME.typography.bodyMd, color: THEME.colors.textPrimary, paddingVertical: 0 },

  emptyWrap: { paddingTop: 40 },
  catCard: { marginTop: 0 },

  itemList: { marginHorizontal: -THEME.spacing.md, marginVertical: -THEME.spacing.md },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingRight: THEME.spacing.md },
  itemRowBordered: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: THEME.colors.borderLight },
  itemAccent: { width: 3, alignSelf: 'stretch', backgroundColor: THEME.colors.primary, opacity: 0.85 },
  itemContent: { flex: 1, paddingVertical: 13, paddingLeft: 13 },
  itemTitle: { ...THEME.typography.labelLg,  color: THEME.colors.textPrimary },
  itemSub: { ...THEME.typography.caption, color: THEME.colors.textTertiary, marginTop: 1 }
});

export default ReportsHubScreen;
