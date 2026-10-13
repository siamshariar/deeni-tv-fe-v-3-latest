import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors } from '@/lib/theme';

/**
 * Rounded top corners over a video box WITHOUT clipping the WebView (plan
 * D-32; Safe Kids: a rounded clip turns the video black on HiSilicon TV
 * boxes). Two corner pieces in the page colour are drawn on top, plus the
 * web's white/10 frame border.
 */
export function CornerMasks({ radius, color = '#111114', border = true }: { radius: number; color?: string; border?: boolean }) {
  const r = Math.max(0, Math.round(radius));
  if (r === 0) return null;
  return (
    <>
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width: r, height: r }}>
        <Svg width={r} height={r}>
          <Path d={`M0 0 L${r} 0 A${r} ${r} 0 0 0 0 ${r} Z`} fill={color} />
        </Svg>
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, width: r, height: r }}>
        <Svg width={r} height={r}>
          <Path d={`M0 0 L${r} 0 L${r} ${r} A${r} ${r} 0 0 0 0 0 Z`} fill={color} />
        </Svg>
      </View>
      {border ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderTopLeftRadius: r,
            borderTopRightRadius: r,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: colors.border10,
          }}
        />
      ) : null}
    </>
  );
}
