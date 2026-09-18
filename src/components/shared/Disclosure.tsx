// ═══════════════════════════════════════════════════════
// FinMatrix — Disclosure (collapsible section)
// ═══════════════════════════════════════════════════════
// Progressive disclosure primitive: keeps long-form guidance available
// without letting it dominate the screen. Used by the opening-balance flow
// for its intro, worked example and help sections.

import React, { useCallback, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { THEME } from '../../utils/theme';

// Required for LayoutAnimation on old-architecture Android.
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Feather.glyphMap;
  /** Open on first render. Collapsed by default — that is the point. */
  defaultOpen?: boolean;
  /** Tint for the icon chip; defaults to the brand colour. */
  tint?: string;
  children: React.ReactNode;
}

const Disclosure: React.FC<Props> = ({
  title,
  subtitle,
  icon = 'help-circle',
  defaultOpen = false,
  tint = THEME.colors.primary,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(o => !o);
  }, []);

  return (
    <View style={s.card}>
      <TouchableOpacity
        style={s.head}
        onPress={toggle}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
      >
        <View style={[s.icon, { backgroundColor: `${tint}14` }]}>
          <Feather name={icon} size={15} color={tint} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{title}</Text>
          {subtitle ? <Text style={s.sub}>{subtitle}</Text> : null}
        </View>
        <Feather
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={THEME.colors.textTertiary}
        />
      </TouchableOpacity>
      {open ? <View style={s.body}>{children}</View> : null}
    </View>
  );
};

const s = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    overflow: 'hidden',
  },
  head: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...THEME.typography.bodyMd,
    fontWeight: THEME.typography.labelMd.fontWeight,
    color: THEME.colors.textPrimary,
  },
  sub: {
    ...THEME.typography.caption,
    color: THEME.colors.textSecondary,
    marginTop: 1,
  },
  body: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
});

export default Disclosure;
