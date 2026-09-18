import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, SectionList, ActivityIndicator, StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { THEME, HEADER_NAVY, HEADER_RADIUS } from '../../theme';
import { ReportContainer, BackButton } from '../../components/reports/ReportUI';
import EmptyState from '../../components/shared/EmptyState';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import {
  selectSearchQuery, selectSearchResults, selectIsSearching, selectSearchError, selectRecentSearches,
  setQuery, clearSearch, addRecentSearch, removeRecentSearch, clearRecentSearches,
  performSearch, MIN_QUERY_LENGTH
} from './globalSearchSlice';
import { selectFeatures, selectUser } from '../Auth/authSlice';
import { isFeatureVisible } from '../../utils/featureGates';
import type { SearchResult, SearchModule } from '../../models/auditModel';
import { SEARCH_MODULES } from '../../models/auditModel';

// Design-system tokens (see src/theme/theme.ts).
const { colors, radius, spacing } = THEME;

/**
 * What each module looks like in a result row.
 *
 * This replaces MODULE_COLORS, which lived in `auditModel.ts` and gave every
 * module its own hex — five raw literals in a model file, one of them the
 * emerald the brand moved off. Two things were wrong with it: presentation in
 * a model is out of reach of the design-token gate (it scans screens,
 * components and navigators, not models), and a colour per module is a
 * distinction the layout already makes — every row sits under a heading naming
 * its module, so the dot repeated what the header said.
 *
 * Icons carry the same information without a fifth colour on screen, and reuse
 * the vocabulary already used for these entities on the dashboard tiles and
 * the More hub rows.
 */
const MODULE_ICONS: Record<SearchModule, keyof typeof Feather.glyphMap> = {
  Invoices: 'file-text',
  Bills: 'file-plus',
  'Purchase Orders': 'shopping-cart',
  'Sales Orders': 'clipboard',
  Estimates: 'file',
  Receipts: 'dollar-sign',
  'Credit Memos': 'corner-up-left',
  'Vendor Credits': 'corner-down-right',
  'Journal Entries': 'book',
  Customers: 'users',
  Vendors: 'truck',
  Inventory: 'package',
};

type SearchNav = NavigationProp<Record<string, object | undefined>>;

const GlobalSearchScreen: React.FC = () => {
  const nav = useNavigation<SearchNav>();
  const dispatch = useAppDispatch();
  const query = useAppSelector(selectSearchQuery);
  const results = useAppSelector(selectSearchResults);
  const searching = useAppSelector(selectIsSearching);
  const searchError = useAppSelector(selectSearchError);
  const recentSearches = useAppSelector(selectRecentSearches);
  const features = useAppSelector(selectFeatures);
  const companyType = useAppSelector(selectUser)?.companyType;
  // Three-tier model: only mention — and only show — inventory when the tier
  // can actually open an inventory screen.
  const showInventory = isFeatureVisible('inventory', features, companyType);
  const searchPlaceholder = showInventory
    ? 'Search customers, invoices, inventory…'
    : 'Search customers, invoices, bills…';
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    return () => {
      // Drop a pending debounce with the screen, so a keystroke made on the
      // way out cannot fire a search into an unmounted screen.
      if (debounceRef.current) clearTimeout(debounceRef.current);
      dispatch(clearSearch());
    };
  }, [dispatch]);

  const handleChangeText = useCallback((text: string) => {
    dispatch(setQuery(text));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (text.trim().length >= MIN_QUERY_LENGTH) {
        dispatch(performSearch(text));
      }
    }, 300);
  }, [dispatch]);

  // Results are opened across tab stacks (an invoice lives in
  // TransactionsStack, a customer in MoreStack), so each one carries the
  // stack that owns its detail screen.
  const handleTapResult = useCallback((item: SearchResult) => {
    // Record the query, not the row title: tapping a recent search should
    // reproduce the search the user actually ran.
    const term = query.trim();
    if (term.length >= MIN_QUERY_LENGTH) dispatch(addRecentSearch(term));
    // initial: false so the owning stack builds its real initial state (its
    // hub or list) beneath the result. Without it the stack initialises as
    // [InvoiceDetail] alone, back has nothing to pop and falls through to the
    // tab navigator's 'firstRoute' default — the Dashboard — and the record is
    // left stranded on that tab. Every result type is a detail screen, never a
    // stack's initial route, so the flag is safe for all of them.
    nav.navigate(item.stack, { screen: item.routeName, params: item.routeParams, initial: false });
  }, [dispatch, nav, query]);

  const handleRecentTap = useCallback((term: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    dispatch(setQuery(term));
    dispatch(performSearch(term));
  }, [dispatch]);

  const handleClear = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    dispatch(clearSearch());
    inputRef.current?.focus();
  }, [dispatch]);

  const handleRetry = useCallback(() => {
    if (query.trim().length >= MIN_QUERY_LENGTH) dispatch(performSearch(query));
  }, [dispatch, query]);

  const handleRemoveRecent = useCallback((term: string) => {
    dispatch(removeRecentSearch(term));
  }, [dispatch]);

  const handleClearRecents = useCallback(() => {
    dispatch(clearRecentSearches());
  }, [dispatch]);

  /* Group results by module, in a fixed module order so sections never
     reshuffle between searches. Inventory hits are dropped for tiers that
     cannot open an inventory screen — the server already omits them, this is
     the client-side belt to its braces. */
  const sections = useMemo(() => {
    const visible = (Array.isArray(results) ? results : []).filter(
      r => r.module !== 'Inventory' || showInventory,
    );
    const groups = new Map<SearchModule, SearchResult[]>();
    for (const r of visible) {
      const bucket = groups.get(r.module);
      if (bucket) bucket.push(r);
      else groups.set(r.module, [r]);
    }
    return SEARCH_MODULES.filter(m => groups.has(m)).map(m => ({ title: m, data: groups.get(m) as SearchResult[] }));
  }, [results, showInventory]);

  const hasQuery = query.trim().length >= MIN_QUERY_LENGTH;
  const resultCount = sections.reduce((n, sec) => n + sec.data.length, 0);

  const recentBlock = (
    <View style={s.recentSection}>
      <View style={s.recentHeader}>
        <Text style={s.sectionTitle}>Recent searches</Text>
        {recentSearches.length > 0 && (
          <TouchableOpacity
            onPress={handleClearRecents}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={s.clearAllText}>Clear all</Text>
          </TouchableOpacity>
        )}
      </View>
      {recentSearches.length === 0 ? (
        <Text style={s.recentEmptyText}>
          {query.length > 0
            ? `Keep typing — searches start at ${MIN_QUERY_LENGTH} characters.`
            : 'No recent searches'}
        </Text>
      ) : (
        recentSearches.map((term, i) => (
          <View
            key={term}
            style={[
              s.row,
              i === 0 && s.rowFirst,
              i === recentSearches.length - 1 ? s.rowLast : s.rowDivider,
            ]}
          >
            <TouchableOpacity style={s.recentTap} onPress={() => handleRecentTap(term)}>
              <Feather name="clock" size={16} color={colors.textTertiary} />
              <Text style={s.rowTitle} numberOfLines={1}>{term}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleRemoveRecent(term)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${term} from recent searches`}
            >
              <Feather name="x" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        ))
      )}
    </View>
  );

  return (
    <ReportContainer>
      {/* The app header, built from the shared tokens rather than through
          ReportHeader: that component's shape is a title with an optional
          subtitle, and a search field is not a title. The identity that has to
          match is the gradient, the corner and the back button — all of which
          are the shared ones, and all of which headerTokens.test.ts guards. */}
      <LinearGradient colors={HEADER_NAVY} style={s.header}>
        <StatusBar barStyle="light-content" backgroundColor={HEADER_NAVY[0]} />
        <View style={s.headerRow}>
          <BackButton onPress={() => nav.goBack()} />
          <View style={s.field}>
            <Feather name="search" size={16} color={FIELD_MUTED} />
            <TextInput
              ref={inputRef}
              style={s.input}
              placeholder={searchPlaceholder}
              placeholderTextColor={FIELD_MUTED}
              value={query}
              onChangeText={handleChangeText}
              returnKeyType="search"
              autoCorrect={false}
              selectionColor={colors.neutral0}
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={handleClear}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Feather name="x" size={16} color={FIELD_MUTED} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </LinearGradient>

      {/* A failed search reads differently from an empty one, and a refresh
          keeps the results already on screen rather than blanking. */}
      {hasQuery && searchError && !searching ? (
        <View style={s.stateWrap}>
          <EmptyState
            icon="alert-circle"
            title="Search unavailable"
            message={searchError}
            actionLabel="Try again"
            onAction={handleRetry}
          />
        </View>
      ) : (
        /* One list for both states — results when there is a query, recent
           searches in the header when there is not. Recents used to be a
           plain View above the list, so with the keyboard up the last of the
           eight the slice keeps could not be reached. */
        <SectionList
          sections={hasQuery ? sections : []}
          keyExtractor={item => item.id}
          style={s.list}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={
            hasQuery ? (
              resultCount > 0 ? (
                <Text style={s.resultCount}>
                  {resultCount} {resultCount === 1 ? 'result' : 'results'}
                  {searching ? ' · updating…' : ''}
                </Text>
              ) : null
            ) : (
              recentBlock
            )
          }
          renderSectionHeader={({ section }) => (
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>{section.title}</Text>
              <Text style={s.sectionCount}>{section.data.length}</Text>
            </View>
          )}
          renderItem={({ item, index, section }) => (
            <TouchableOpacity
              style={[
                s.row,
                index === 0 && s.rowFirst,
                index === section.data.length - 1 ? s.rowLast : s.rowDivider,
              ]}
              activeOpacity={0.6}
              onPress={() => handleTapResult(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.module}: ${item.title}. ${item.subtitle}`}
            >
              <Feather name={MODULE_ICONS[item.module]} size={17} color={colors.primary} />
              <View style={s.rowContent}>
                <Text style={s.rowTitle} numberOfLines={1}>{item.title}</Text>
                {!!item.subtitle && <Text style={s.rowSub} numberOfLines={1}>{item.subtitle}</Text>}
              </View>
              <Feather name="chevron-right" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            !hasQuery ? null : searching ? (
              <View style={s.loadingWrap}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : (
              <View style={s.stateWrap}>
                <EmptyState
                  icon="search"
                  title="No results"
                  message={`Nothing matched “${query.trim()}”. Try a name, a number or part of one.`}
                />
              </View>
            )
          }
        />
      )}
    </ReportContainer>
  );
};

export default GlobalSearchScreen;

// The field sits on the navy header, so its glyphs and placeholder are a white
// alpha rather than a text token — the same treatment as the header's icon
// buttons and the dashboard's date pill.
const FIELD_MUTED = 'rgba(255,255,255,0.55)';

const s = StyleSheet.create({
  // Header — same padding, corner and gradient as ReportHeader.
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.md + 2,
    borderBottomLeftRadius: HEADER_RADIUS,
    borderBottomRightRadius: HEADER_RADIUS,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  input: {
    flex: 1,
    ...THEME.typography.bodyMd,
    color: colors.neutral0,
    padding: 0,
  },

  // Body
  list: { flex: 1, backgroundColor: colors.background },
  // flexGrow so the empty state has a full-height box to centre itself in —
  // EmptyState is `flex: 1, justifyContent: 'center'`, which collapses to its
  // own content height inside a content container that only wraps.
  listContent: { padding: spacing.md, paddingBottom: spacing.xxl, flexGrow: 1 },
  resultCount: { ...THEME.typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
  loadingWrap: { paddingVertical: spacing.xl, alignItems: 'center' },
  stateWrap: { flex: 1, backgroundColor: colors.background },

  // Section heading — the shape the dashboard uses: a label and a count, no
  // badge and no colour. The heading names the module; the rows beneath it do
  // not need to repeat that in a second channel.
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  sectionTitle: { ...THEME.typography.labelLg, color: colors.textPrimary, letterSpacing: -0.2 },
  sectionCount: { ...THEME.typography.caption, color: colors.textTertiary, fontVariant: ['tabular-nums'] },

  // Rows, grouped into one card per section.
  //
  // They used to be separate mini-cards with their own shadow and a 6px gap,
  // which made a list of five hits read as five unrelated objects. This is the
  // pattern the dashboard's recent-transactions card and the approval lists
  // already use: one surface, hairline dividers, rounded at the ends only.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    backgroundColor: colors.surface,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  rowFirst: {
    borderTopWidth: 1,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  rowLast: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  // Sits after `row` in the style array, so this bottom colour wins over the
  // all-sides `borderColor` above.
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  rowContent: { flex: 1 },
  rowTitle: { ...THEME.typography.labelMd, color: colors.textPrimary },
  rowSub: { ...THEME.typography.caption, color: colors.textSecondary, marginTop: 2 },

  // Recent searches
  recentSection: { paddingBottom: spacing.xs },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  clearAllText: { ...THEME.typography.labelSm, color: colors.primary },
  recentTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  recentEmptyText: {
    ...THEME.typography.bodyMd,
    color: colors.textSecondary,
    paddingVertical: 10,
  },
});
