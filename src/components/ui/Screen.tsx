import { type ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import {
  Platform,
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
  RefreshControl,
  StatusBar,
  type ImageSourcePropType,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Palette, Spacing } from '@/constants/theme';
import { UiImages } from '@/constants/ui-images';
import { useTabBarHeight } from '@/hooks/use-tab-bar-height';

const NAV_BAR_HEIGHT = Platform.OS === 'ios' ? 44 : 56;

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
  const insets = useSafeAreaInsets();
  /** Tabs use a transparent liquid header — content draws under it. */
  const topInset = tabAware ? insets.top + NAV_BAR_HEIGHT : 0;
  const content = (
    <View
      style={[
        padded && styles.pad,
        topInset > 0 && { paddingTop: topInset + (padded ? Spacing.xs : 0) },
        style,
      ]}>
      {children}
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
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
      </View>

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
                  progressViewOffset={topInset}
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
