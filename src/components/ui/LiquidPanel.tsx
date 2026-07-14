import { type ReactNode, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import {
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
  GlassView,
} from 'expo-glass-effect';
import { GlassTokens, Palette, Radii, Spacing, Shadows } from '@/constants/theme';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  glow?: boolean;
  /** Use native blur (costlier). Prefer false for widget lists; true for hero cards / chrome. */
  blur?: boolean;
  intensity?: 'soft' | 'strong';
  padded?: boolean;
};

function useReduceTransparency() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceTransparencyEnabled?.().then((v) => {
      if (alive) setReduce(Boolean(v));
    });
    const sub = AccessibilityInfo.addEventListener?.(
      'reduceTransparencyChanged',
      (v: boolean) => setReduce(v)
    );
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return reduce;
}

function canUseIosGlass(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    return Boolean(isLiquidGlassAvailable() && isGlassEffectAPIAvailable());
  } catch {
    return false;
  }
}

/**
 * Cross-platform liquid-glass shell.
 * Children render in the same layout tree as `style` (flexDirection row, etc.) —
 * do not wrap them in an inner View or list cards break.
 */
export function LiquidPanel({
  children,
  style,
  onPress,
  glow,
  blur = false,
  intensity = 'soft',
  padded = true,
}: Props) {
  const reduceTransparency = useReduceTransparency();
  const fill = intensity === 'strong' ? Palette.glassFillStrong : Palette.glassFill;
  const useNativeGlass = !reduceTransparency && canUseIosGlass();
  const useBlur = !reduceTransparency && blur && Platform.OS === 'ios';

  const body = (
    <View
      style={[
        styles.shell,
        padded && styles.padded,
        glow && styles.glow,
        { backgroundColor: useNativeGlass ? 'transparent' : fill },
        style,
      ]}>
      {useNativeGlass ? (
        <GlassView
          style={StyleSheet.absoluteFill}
          glassEffectStyle="regular"
          tintColor={Palette.cyan}
          colorScheme="dark"
          pointerEvents="none"
        />
      ) : useBlur ? (
        <BlurView
          intensity={GlassTokens.blurIntensity}
          tint="dark"
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}

      <LinearGradient
        colors={[Palette.glassHighlight, 'transparent', Palette.glassSheen]}
        locations={[0, 0.35, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.sheen}
        pointerEvents="none"
      />
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}>
        {body}
      </Pressable>
    );
  }
  return body;
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: Radii.lg,
    borderWidth: GlassTokens.borderWidth,
    borderColor: Palette.glassStroke,
    overflow: 'hidden',
  },
  padded: { padding: Spacing.md },
  sheen: {
    ...StyleSheet.absoluteFill,
    borderRadius: Radii.lg,
  },
  glow: {
    ...Shadows.glow,
  },
});
