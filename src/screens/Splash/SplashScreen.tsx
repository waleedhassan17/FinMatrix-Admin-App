import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Animated,
  Easing
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { THEME } from '../../utils/theme';

// ═══════════════════════════════════════
// Design Tokens (pixel-perfect match)
// ═══════════════════════════════════════
const B = {
  navy: THEME.colors.neutral900,
  emerald: THEME.colors.success,
  w95: 'rgba(255,255,255,0.95)',
  w40: 'rgba(255,255,255,0.40)',
  w20: 'rgba(255,255,255,0.20)',
  w06: 'rgba(255,255,255,0.06)',
  w03: 'rgba(255,255,255,0.03)'
};

// ═══════════════════════════════════════
// Animation Timings (ms)
// ═══════════════════════════════════════
const TM = {
  GLOW: 100,
  LINE: 500,
  WORD: 900,
  TAG: 1300,
  LOAD: 1700,
  BREATHE: 2500,
  EXIT: 3000,
  EXIT_DUR: 600
};

// ═══════════════════════════════════════
// Overlay Component (renders on top of navigator)
// ═══════════════════════════════════════
interface SplashOverlayProps {
  onFinish: () => void;
}

const SplashOverlay: React.FC<SplashOverlayProps> = ({ onFinish }) => {
  // Phase 1: ambient glow + geometry
  const decorOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(1)).current;

  // Phase 2: accent line
  const lineWidth = useRef(new Animated.Value(0)).current;
  const lineOpacity = useRef(new Animated.Value(0)).current;

  // Phase 3: wordmark
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const wordTransY = useRef(new Animated.Value(16)).current;
  const wordScale = useRef(new Animated.Value(0.96)).current;

  // Phase 4: tagline + version
  const tagOpacity = useRef(new Animated.Value(0)).current;
  const tagTransY = useRef(new Animated.Value(10)).current;
  const versionOpacity = useRef(new Animated.Value(0)).current;

  // Phase 5: loader
  const loaderOpacity = useRef(new Animated.Value(0)).current;
  const loaderX = useRef(new Animated.Value(-12)).current;

  // Exit fade
  const exitOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Phase 1: Decorative geometry
    const t1 = setTimeout(() => {
      Animated.timing(decorOpacity, {
        toValue: 1,
        duration: 1600,
        useNativeDriver: true,
      }).start();
    }, TM.GLOW);

    // Phase 2: Accent line expands from center
    const t2 = setTimeout(() => {
      Animated.parallel([
        Animated.spring(lineWidth, {
          toValue: 56,
          friction: 7,
          tension: 60,
          useNativeDriver: false,
        }),
        Animated.timing(lineOpacity, {
          toValue: 1,
          duration: 300,
          // Must match the width spring above (JS driver). Width is not
          // supported by the native animated module, so both animated
          // nodes on the same <Animated.View> must use the JS driver.
          useNativeDriver: false,
        }),
      ]).start();
    }, TM.LINE);

    // Phase 3: Wordmark
    const t3 = setTimeout(() => {
      Animated.parallel([
        Animated.timing(wordOpacity, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(wordTransY, {
          toValue: 0,
          duration: 600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(wordScale, {
          toValue: 1,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }),
      ]).start();
    }, TM.WORD);

    // Phase 4: Tagline + version
    const t4 = setTimeout(() => {
      Animated.parallel([
        Animated.timing(tagOpacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(tagTransY, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(versionOpacity, {
          toValue: 1,
          duration: 800,
          delay: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }, TM.TAG);

    // Phase 5: Loader
    const t5 = setTimeout(() => {
      Animated.timing(loaderOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
      startLoaderLoop();
    }, TM.LOAD);

    // Breathing glow
    const tBreathe = setTimeout(() => startBreathingLoop(), TM.BREATHE);

    // Exit — smooth fade-out reveals the screen underneath
    const tExit = setTimeout(() => {
      Animated.timing(exitOpacity, {
        toValue: 0,
        duration: TM.EXIT_DUR,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) onFinish();
      });
    }, TM.EXIT);

    return () => {
      [t1, t2, t3, t4, t5, tBreathe, tExit].forEach(clearTimeout);
    };
  }, []);

  const startLoaderLoop = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(loaderX, {
          toValue: 12,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(loaderX, {
          toValue: -12,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  };

  const startBreathingLoop = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowScale, {
          toValue: 1.06,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowScale, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  };

  // ═════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════
  return (
    <Animated.View style={[$.root, { opacity: exitOpacity, pointerEvents: 'auto' }]}>
      <StatusBar barStyle="light-content" backgroundColor={B.navy} />

      {/* ── Decorative Geometry ── */}
      <Animated.View style={[$.decorRect, { opacity: decorOpacity, pointerEvents: 'none' }]} />
      <Animated.View
        style={[$.decorCircle, { opacity: Animated.multiply(decorOpacity, new Animated.Value(1)) }, { pointerEvents: 'none' }]}
      />
      <Animated.View
        style={[$.decorSquare, { opacity: Animated.multiply(decorOpacity, new Animated.Value(0.5)) }, { pointerEvents: 'none' }]}
      />
      <Animated.View
        style={[$.decorDot, { opacity: Animated.multiply(decorOpacity, new Animated.Value(0.5)) }, { pointerEvents: 'none' }]}
      />

      {/* ── Center Content ── */}
      <View style={$.content}>
        {/* Accent Line (gradient: transparent → emerald → transparent) */}
        <Animated.View style={[$.accentLineWrap, { width: lineWidth, opacity: lineOpacity }]}>
          <LinearGradient
            colors={['transparent', B.emerald, 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={$.accentLineGradient}
          />
        </Animated.View>

        {/* Wordmark (hero) */}
        <Animated.View
          style={[
            $.wordmarkWrap,
            {
              opacity: wordOpacity,
              transform: [{ translateY: wordTransY }, { scale: wordScale }]
            },
          ]}>
          <Text style={$.wordmark}>
            <Text style={$.wordFin}>Fin</Text>
            <Text style={$.wordMatrix}>Matrix</Text>
          </Text>
        </Animated.View>

        {/* Tagline */}
        <Animated.View
          style={{
            opacity: tagOpacity,
            transform: [{ translateY: tagTransY }],
            marginBottom: 56
          }}>
          <Text style={$.tagline}>Enterprise Accounting Platform</Text>
        </Animated.View>

        {/* Loader */}
        <Animated.View style={[$.loaderWrap, { opacity: loaderOpacity }]}>
          <View style={$.loaderTrack}>
            <Animated.View
              style={[$.loaderFill, { transform: [{ translateX: loaderX }] }]}
            />
          </View>
        </Animated.View>
      </View>

      {/* ── Version ── */}
      <Animated.View style={[$.versionWrap, { opacity: versionOpacity }]}>
        <Text style={$.versionText}>v1.0.0</Text>
      </Animated.View>
    </Animated.View>
  );
};

// ═══════════════════════════════════════
// Styles
// ═══════════════════════════════════════
const $ = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: B.navy,
    zIndex: 999,
    elevation: 999
  },

  // ── Decorative Geometry ──
  decorRect: {
    position: 'absolute',
    top: '8%',
    right: '-6%',
    width: 90,
    height: 90,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: B.w06,
    transform: [{ rotate: '15deg' }]
  },
  decorCircle: {
    position: 'absolute',
    bottom: '12%',
    left: '-4%',
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: B.w06
  },
  decorSquare: {
    position: 'absolute',
    top: '35%',
    left: '8%',
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: B.w03,
    transform: [{ rotate: '-20deg' }]
  },
  decorDot: {
    position: 'absolute',
    bottom: '30%',
    right: '10%',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: B.w03
  },

  // ── Content ──
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },

  // ── Accent Line (real gradient via LinearGradient) ──
  accentLineWrap: {
    height: 3,
    marginBottom: 28,
    overflow: 'hidden',
    borderRadius: 2
  },
  accentLineGradient: {
    flex: 1,
    borderRadius: 2
  },

  // ── Wordmark ──
  wordmarkWrap: {
    marginBottom: 12
  },
  wordmark: {
    ...THEME.typography.displayLg,
    letterSpacing: -1
  },
  wordFin: {
    color: B.emerald
  },
  wordMatrix: {
    color: B.w95
  },

  // ── Tagline ──
  tagline: {
    ...THEME.typography.bodyMd,
    color: B.w40,
    letterSpacing: 0.56
  },

  // ── Loader ──
  loaderWrap: {
    alignItems: 'center'
  },
  loaderTrack: {
    width: 44,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: B.w06,
    overflow: 'hidden'
  },
  loaderFill: {
    width: 20,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: B.emerald
  },

  // ── Version ──
  versionWrap: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    alignItems: 'center'
  },
  versionText: {
    ...THEME.typography.labelSm,
    color: B.w20,
    letterSpacing: 0.66
  },
});

export default SplashOverlay;
