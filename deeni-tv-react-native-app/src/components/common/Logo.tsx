import { Image, PixelRatio, type ImageSourcePropType, type ImageStyle, type StyleProp } from 'react-native';

/** DeeniTV-V-2.png aspect ratio (3033×595), the wordmark the web uses in its bar and covers. */
const ASPECT = 3033 / 595;

/**
 * The wordmark pre-scaled (Lanczos, from the web's 3033×595 original) to the
 * pixel heights it is drawn at. One large image squeezed 5–6× by the GPU
 * looked blurred and jagged on TV; each copy here is at most ~1.15× its
 * on-screen size, so it stays sharp. Pixel height → source.
 */
const SOURCES: [number, ImageSourcePropType][] = [
  [24, require('../../../assets/images/logo/logo-h24.png')],
  [32, require('../../../assets/images/logo/logo-h32.png')],
  [36, require('../../../assets/images/logo/logo-h36.png')],
  [40, require('../../../assets/images/logo/logo-h40.png')],
  [42, require('../../../assets/images/logo/logo-h42.png')],
  [48, require('../../../assets/images/logo/logo-h48.png')],
  [56, require('../../../assets/images/logo/logo-h56.png')],
  [64, require('../../../assets/images/logo/logo-h64.png')],
  [72, require('../../../assets/images/logo/logo-h72.png')],
  [80, require('../../../assets/images/logo/logo-h80.png')],
  [96, require('../../../assets/images/logo/logo-h96.png')],
  [112, require('../../../assets/images/logo/logo-h112.png')],
  [128, require('../../../assets/images/logo/logo-h128.png')],
  [160, require('../../../assets/images/logo/logo-h160.png')],
  [192, require('../../../assets/images/logo/logo-h192.png')],
  [256, require('../../../assets/images/logo/logo-h256.png')],
  [320, require('../../../assets/images/logo/logo-h320.png')],
];

function sourceFor(heightDp: number): ImageSourcePropType {
  const px = PixelRatio.getPixelSizeForLayoutSize(heightDp);
  for (const [h, source] of SOURCES) if (h >= px - 0.5) return source;
  return SOURCES[SOURCES.length - 1][1];
}

export function Logo({ height, style }: { height: number; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      source={sourceFor(height)}
      style={[{ height, width: height * ASPECT }, style]}
      resizeMode="contain"
      // No Fresco downsampling and no fade-in: the copy is already the right size.
      resizeMethod="scale"
      fadeDuration={0}
      accessibilityLabel="Deeni.tv"
    />
  );
}
