import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Palette, Spacing } from '@/constants/theme';
import { useTabBarHeight } from '@/hooks/use-tab-bar-height';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  style?: ViewStyle;
  padded?: boolean;
  /** Extra bottom padding beyond tab bar (modals / stack screens can set false). */
  tabAware?: boolean;
};

export function Screen({
  children,
  scroll = true,
  onRefresh,
  refreshing = false,
  style,
  padded = true,
  tabAware = true,
}: Props) {
  const { contentPadding } = useTabBarHeight();
  const content = <View style={[padded && styles.pad, style]}>{children}</View>;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[Palette.void, '#0A1222', Palette.deep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.orbA} />
      <View style={styles.orbB} />
      <SafeAreaView style={styles.safe} edges={['top']}>
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
  pad: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  orbA: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(61, 231, 255, 0.08)',
    top: -40,
    right: -60,
  },
  orbB: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(46, 230, 166, 0.06)',
    bottom: 80,
    left: -90,
  },
});
