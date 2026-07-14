import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassTokens, Palette } from '@/constants/theme';
import { screenBlurTargetRef } from '@/components/ui/Screen';

/** Translucent glass tab bar background. */
export function GlassTabBarBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <BlurView
        intensity={GlassTokens.blurIntensityChrome}
        tint="dark"
        style={StyleSheet.absoluteFill}
        {...(Platform.OS === 'android'
          ? {
              blurMethod: 'dimezisBlurViewSdk31Plus' as const,
              blurTarget: screenBlurTargetRef,
            }
          : null)}
      />
      <View style={styles.tint} />
    </View>
  );
}

const styles = StyleSheet.create({
  tint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Palette.glassFillStrong,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.glassStroke,
  },
});
