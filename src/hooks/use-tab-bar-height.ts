import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_CONTENT_HEIGHT = 56;

/** Tab bar height including Android/iOS system gesture/nav inset. */
export function useTabBarHeight() {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 10);
  return {
    bottomInset: bottom,
    tabBarHeight: TAB_CONTENT_HEIGHT + bottom,
    contentPadding: TAB_CONTENT_HEIGHT + bottom + 16,
  };
}
