import { forwardRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, type PressableProps, type StyleProp, type View, type ViewStyle } from 'react-native';

import { colors } from '@/lib/theme';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle> | ((state: { focused: boolean; pressed: boolean }) => StyleProp<ViewStyle>);
  /** Style added while focused on TV (default: the web's gold focus ring). */
  focusStyle?: StyleProp<ViewStyle>;
  children?: ReactNode | ((state: { focused: boolean; pressed: boolean }) => ReactNode);
};

/**
 * A Pressable that shows the web's gold `:focus-visible` ring when it has
 * D-pad focus on TV (WEB-60, WEB-65). On phones it is a plain Pressable with
 * the web's tap feedback (scale 0.95).
 */
export const Focusable = forwardRef<View, Props>(function Focusable(
  { style, focusStyle, children, onFocus, onBlur, hasTVPreferredFocus, ...rest },
  ref,
) {
  const [hasFocus, setFocused] = useState(false);
  // Focus visuals and default focus are a TV thing: on phones `hasTVPreferredFocus`
  // would still pull focus and show a ring nobody asked for.
  const focused = Platform.isTV && hasFocus;
  return (
    <Pressable
      ref={ref}
      {...rest}
      hasTVPreferredFocus={Platform.isTV ? hasTVPreferredFocus : undefined}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={({ pressed }) => [
        typeof style === 'function' ? style({ focused, pressed }) : style,
        focused ? (focusStyle ?? defaultFocus) : null,
        !Platform.isTV && pressed ? { transform: [{ scale: 0.95 }] } : null,
      ]}
    >
      {typeof children === 'function' ? children({ focused, pressed: false }) : children}
    </Pressable>
  );
});

const defaultFocus: ViewStyle = {
  borderColor: colors.gold,
  borderWidth: 2,
};
