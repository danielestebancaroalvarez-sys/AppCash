import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { BlurTargetView } from 'expo-blur';
import {
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
  RefreshControl,
  StatusBar,
  type ImageSourcePropType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Palette, Spacing } from '@/constants/theme';
import { UiImages } from '@/constants/ui-images';
import { useTabBarHeight } from '@/hooks/use-tab-bar-height';

/** Shared across Screens so tab chrome can attach Android blur when mounted. */
export const screenBlurTargetRef: RefObject<View | null> = { current: null };

const BlurTargetContext = createContext<RefObject<View | null>>(screenBlurTargetRef);

export function useScreenBlurTarget() {
  return useContext(BlurTargetContext);
}

type Props = {
  children: ReactNode;
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  style?: ViewStyle;
  padded?: boolean;
  tabAware?: boolean;
  safeTop?: boolean;
  backgroundImage?: ImageSourcePropType | null;
  backdropDim?: number;
};

export function Screen({
  children,
  scroll = true,
  onRefresh,
  refreshing = false,
  style,
  padded = true,
  tabAware = true,
  safeTop = false,
  backgroundImage = UiImages.bgHome,
  backdropDim = 0.62,
}: Props) {
  const { contentPadding } = useTabBarHeight();
  const localRef = useRef<View | null>(null);
  const content = <View style={[padded && styles.pad, style]}>{children}</View>;
  const targetValue = useMemo(() => screenBlurTargetRef, []);

  useEffect(() => {
    screenBlurTargetRef.current = localRef.current;
    return () => {
      if (screenBlurTargetRef.current === localRef.current) {
        screenBlurTargetRef.current = null;
      }
    };
  });

  return (
    <BlurTargetContext.Provider value={targetValue}>
      <View style={styles.root}>
        <StatusBar barStyle="light-content" />
        <BlurTargetView ref={localRef} style={StyleSheet.absoluteFill} pointerEvents="none">
          {backgroundImage ? (
            <Image
              source={backgroundImage}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={200}
            />
          ) : null}
          <LinearGradient
            colors={[
              `rgba(7, 11, 20, ${backdropDim})`,
              `rgba(10, 18, 34, ${Math.min(0.92, backdropDim + 0.15)})`,
              Palette.void,
            ]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.orbA} />
          <View style={styles.orbB} />
        </BlurTargetView>

        <SafeAreaView style={styles.safe} edges={safeTop ? ['top'] : []}>
          {scroll ? (
            <ScrollView
              contentContainerStyle={{
                paddingBottom: tabAware ? contentPadding : Spacing.xl,
              }}
              showsVerticalScrollIndicator={false}
              refreshControl={
                onRefresh ? (
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={Palette.cyan}
                    colors={[Palette.cyan]}
                    progressBackgroundColor={Palette.panelElevated}
                  />
                ) : undefined
              }>
              {content}
            </ScrollView>
          ) : (
            content
          )}
        </SafeAreaView>
      </View>
    </BlurTargetContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.void },
  safe: { flex: 1 },
  pad: { paddingHorizontal: Spacing.md, paddingTop: Spacing.xs },
  orbA: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(61, 231, 255, 0.1)',
    top: -50,
    right: -70,
  },
  orbB: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(46, 230, 166, 0.07)',
    bottom: 60,
    left: -100,
  },
});
