// ═══════════════════════════════════════════════════════
// FinMatrix Admin — the brand mark
// ═══════════════════════════════════════════════════════
// A rounded "m" over a red rule, the FinMatrix logo, in its dark-ground
// treatment: white "m", red rule. Both places this console shows the brand
// (the sign-in header and the splash) are dark, so this is the only variant
// it needs.
//
// It is a PNG (assets/images/brand-mark-light{,@2x,@3x}.png) rather than a
// vector because this app does not ship react-native-svg, and adding a native
// module to draw one logo would cost a native rebuild. The images are rendered
// from the same geometry as the main app's BrandMark.tsx and the launcher icons;
// if the logo changes, regenerate them all together.

import React from 'react';
import { Image } from 'react-native';

// require() is how Metro resolves a static image and picks the @2x/@3x file
// for the screen; this project has no `*.png` module declaration for an import.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const markLight = require('../../../assets/images/brand-mark-light.png');

// The image's own proportions (72 × 62 at @1x): the mark plus a little air, so
// anti-aliased edges are never clipped.
const ASPECT = 72 / 62;

interface BrandMarkProps {
  /** Width in px. The height follows the image's proportions. */
  size?: number;
}

/** Decorative: the name beside it carries the meaning. */
const BrandMark: React.FC<BrandMarkProps> = ({ size = 40 }) => (
  <Image
    source={markLight}
    style={{ width: size, height: size / ASPECT }}
    resizeMode="contain"
    accessible={false}
    importantForAccessibility="no"
  />
);

export default BrandMark;
