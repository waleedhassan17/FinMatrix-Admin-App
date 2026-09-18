import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';
import { THEME } from '../utils/theme';

type LogoSize = 'sm' | 'md' | 'lg';

interface AppLogoProps {
  size?: LogoSize;
}

const sizeMap = {
  sm: { circle: 48, initials: 18, title: 16 },
  md: { circle: 80, initials: 30, title: 24 },
  lg: { circle: 120, initials: 44, title: 32 },
};

const AppLogo: React.FC<AppLogoProps> = ({ size = 'md' }) => {
  const dims = sizeMap[size];

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { fontSize: dims.title }]}>
        <Text style={styles.titleFin}>Fin</Text>
        <Text style={styles.titleMatrix}>Matrix</Text>
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  title: {
    fontWeight: THEME.typography.labelMd.fontWeight,
    fontFamily: THEME.typography.fontFamily,
  },
  titleFin: {
    color: colors.success,
  },
  titleMatrix: {
    color: colors.primary,
  },
});

export default AppLogo;
