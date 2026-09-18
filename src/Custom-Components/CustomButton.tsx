import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';
import { colors, borderRadius } from '../theme';
import { THEME } from '../utils/theme';

type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface CustomButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const CustomButton: React.FC<CustomButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  icon,
  fullWidth = false,
}) => {
  const isDisabled = disabled || isLoading;

  const variantStyles = {
    primary: styles.variant_primary,
    secondary: styles.variant_secondary,
    text: styles.variant_text,
    danger: styles.variant_danger,
  };

  const sizeStyles = {
    sm: styles.size_sm,
    md: styles.size_md,
    lg: styles.size_lg,
  };

  const textVariantStyles = {
    primary: styles.text_primary,
    secondary: styles.text_secondary,
    text: styles.text_text,
    danger: styles.text_danger,
  };

  const textSizeStyles = {
    sm: styles.textSize_sm,
    md: styles.textSize_md,
    lg: styles.textSize_lg,
  };

  const loaderColor =
    variant === 'secondary' || variant === 'text' ? colors.primary : colors.white;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        variantStyles[variant],
        sizeStyles[size],
        fullWidth ? styles.fullWidth : undefined,
        isDisabled ? styles.disabled : undefined,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}>
      {isLoading ? (
        <ActivityIndicator size="small" color={loaderColor} />
      ) : (
        <View style={styles.content}>
          {icon && <View style={styles.iconWrapper}>{icon}</View>}
          <Text
            style={[
              styles.text,
              textVariantStyles[variant],
              textSizeStyles[size],
              isDisabled ? styles.textDisabled : undefined,
            ]}>
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    // Controls sit at 8; 12 is the card radius. A button as round as the card
    // it sits on reads as a pill rather than a control.
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 48,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    marginRight: 8,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },

  // ── Variants ──
  variant_primary: {
    backgroundColor: colors.primary,
  },
  // A neutral outline, not a second accent. Two navy-bordered buttons side by
  // side compete for the same attention; the primary should be the only thing
  // on screen wearing the brand colour.
  variant_secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  variant_text: {
    backgroundColor: 'transparent',
  },
  variant_danger: {
    backgroundColor: colors.danger,
  },

  // ── Sizes ──
  size_sm: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 36,
  },
  size_md: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    minHeight: 48,
  },
  size_lg: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    minHeight: 56,
  },

  // ── Text ──
  text: {
    fontWeight: THEME.typography.labelMd.fontWeight,
    fontFamily: THEME.typography.fontFamily,
  },
  text_primary: {
    color: colors.white,
  },
  text_secondary: {
    color: colors.primary,
  },
  text_text: {
    color: colors.primary,
  },
  text_danger: {
    color: colors.white,
  },
  textSize_sm: {
    fontSize: THEME.typography.bodyMd.fontSize,
  },
  textSize_md: {
    fontSize: THEME.typography.bodyLg.fontSize,
  },
  textSize_lg: {
    fontSize: THEME.typography.h3.fontSize,
  },
  textDisabled: {
    opacity: 0.7,
  },
});

export default CustomButton;
