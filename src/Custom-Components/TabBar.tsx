import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
} from 'react-native';
import { colors, spacing } from '../theme';
import { THEME } from '../utils/theme';

interface Tab {
  key: string;
  label: string;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

const TabBar: React.FC<TabBarProps> = ({ tabs, activeTab, onTabChange }) => {
  const underlineAnim = useRef(new Animated.Value(0)).current;
  const activeIndex = tabs.findIndex(t => t.key === activeTab);

  useEffect(() => {
    Animated.spring(underlineAnim, {
      toValue: activeIndex >= 0 ? activeIndex : 0,
      useNativeDriver: true,
      friction: 8,
      tension: 60,
    }).start();
  }, [activeIndex, underlineAnim]);

  const tabWidth = 100; // Approximate width; adjust as needed

  const translateX = underlineAnim.interpolate({
    inputRange: tabs.map((_, i) => i),
    outputRange: tabs.map((_, i) => i * tabWidth),
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {tabs.map(tab => {
          const isActive = tab.key === activeTab;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, { width: tabWidth }]}
              onPress={() => onTabChange(tab.key)}
              activeOpacity={0.7}>
              <Text
                style={[
                  styles.tabText,
                  isActive && styles.activeTabText,
                ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
        <Animated.View
          style={[
            styles.underline,
            {
              width: tabWidth,
              transform: [{ translateX }],
            },
          ]}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scrollContent: {
    position: 'relative',
  },
  tab: {
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    ...THEME.typography.bodyMd,
    color: colors.textSecondary,
  },
  activeTabText: {
    ...THEME.typography.labelLg,
    color: colors.primary,
  },
  underline: {
    position: 'absolute',
    bottom: 0,
    height: 3,
    backgroundColor: colors.primary,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
});

export default TabBar;
