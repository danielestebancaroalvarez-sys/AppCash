import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Palette } from '@/constants/theme';

type ChromeEdge = 'header' | 'tabBar';

/**
 * Liquid-crystal chrome for nav header + tab bar (cyan-tinted, not flat gray).
 * Avoids BlurView + blurTarget — that ref belongs to Screen and crashes when
 * navigating Login → Tabs (target unmounted / not yet mounted).
 */
function GlassChromeBackground({ edge }: { edge: ChromeEdge }) {
  const isHeader = edge === 'header';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={
          isHeader
            ? [
                'rgba(7, 14, 28, 0.55)',
                'rgba(10, 24, 48, 0.42)',
                'rgba(61, 231, 255, 0.12)',
                'rgba(61, 231, 255, 0.04)',
              ]
            : [
                'rgba(61, 231, 255, 0.1)',
                'rgba(10, 24, 48, 0.45)',
                'rgba(7, 14, 28, 0.62)',
              ]
        }
        locations={isHeader ? [0, 0.45, 0.82, 1] : [0, 0.35, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.16)', 'transparent', 'rgba(61,231,255,0.08)']}
        locations={[0, 0.4, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={isHeader ? styles.headerAccent : styles.tabBarAccent} />
    </View>
  );
}

export function GlassTabBarBackground() {
  return <GlassChromeBackground edge="tabBar" />;
}

export function GlassHeaderBackground() {
  return <GlassChromeBackground edge="header" />;
}

const styles = StyleSheet.create({
  headerAccent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 1.5,
    backgroundColor: 'rgba(61, 231, 255, 0.45)',
  },
  tabBarAccent: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 1.5,
    backgroundColor: 'rgba(61, 231, 255, 0.4)',
    borderTopColor: Palette.glassStroke,
  },
});
