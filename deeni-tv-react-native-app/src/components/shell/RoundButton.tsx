import type { LucideIcon } from 'lucide-react-native';
import { forwardRef } from 'react';
import { Platform, type View } from 'react-native';

import { Focusable } from '@/components/common/Focusable';
import { ControlRing } from '@/components/common/Rings';
import { colors } from '@/lib/theme';

interface Props {
  icon: LucideIcon;
  label: string;
  size: number;
  iconSize: number;
  onPress: () => void;
  disabled?: boolean;
  hasTVPreferredFocus?: boolean;
  onFocus?: () => void;
  /** False while something covers the button (no D-pad focus, no touch). */
  focusable?: boolean;
}

/**
 * The web's round control-bar button: white/10 fill, white/20 border; gold
 * focus ring on TV. Touch targets are at least 44 pt (plan D-27) while the
 * visual size stays the web's 28 / 36 px.
 */
export const RoundButton = forwardRef<View, Props>(function RoundButton(
  { icon: Icon, label, size, iconSize, onPress, disabled, hasTVPreferredFocus, onFocus, focusable = true },
  ref,
) {
  const slop = Platform.isTV ? 0 : Math.max(0, (44 - size) / 2);
  return (
    <Focusable
      ref={ref}
      onPress={disabled ? undefined : onPress}
      onFocus={onFocus}
      focusable={focusable}
      hasTVPreferredFocus={focusable && hasTVPreferredFocus}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={slop}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.fill10,
      }}
      // Border and focus ring are drawn by ControlRing (antialiased SVG).
      focusStyle={{ backgroundColor: colors.fill20 }}
    >
      {({ focused }) => (
        <>
          <ControlRing width={size} height={size} focused={focused} />
          <Icon size={iconSize} color="rgba(255,255,255,0.9)" />
        </>
      )}
    </Focusable>
  );
});
