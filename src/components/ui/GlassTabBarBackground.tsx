import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Palette } from '@/constants/theme';

/**
 * Glass tab bar chrome.
 * Avoids BlurView + blurTarget — that ref belongs to Screen and crashes when
 * navigating Login → Tabs (target unmounted / not yet mounted).
 */
export function GlassTabBarBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.fill} />
      <LinearGradient
        colors={['rgba(255,255,255,0.08)', 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.sheen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Palette.glassFillStrong,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.glassStroke,
  },
  sheen: {
    ...StyleSheet.absoluteFill,
  },
});
