import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { Fonts, Palette } from '@/constants/theme';

type Props = {
  size?: number;
  showWordmark?: boolean;
};

/** AppCash brand mark — ledger slash + ascending cash arc. */
export function AppCashLogo({ size = 88, showWordmark = false }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.mark, { width: size, height: size, borderRadius: size * 0.22 }]}>
        <Svg width={size} height={size} viewBox="0 0 108 108">
          <Defs>
            <LinearGradient id="acBg" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#0D1526" />
              <Stop offset="1" stopColor="#121C31" />
            </LinearGradient>
            <LinearGradient id="acAccent" x1="0" y1="1" x2="1" y2="0">
              <Stop offset="0" stopColor="#2EE6A6" />
              <Stop offset="1" stopColor="#3DE7FF" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="108" height="108" rx="24" fill="url(#acBg)" />
          <Circle cx="78" cy="30" r="18" fill="url(#acAccent)" opacity={0.18} />
          <Path
            d="M28 72 V36 H44 C54 36 60 42 60 50 C60 58 54 64 44 64 H36"
            stroke="url(#acAccent)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path
            d="M36 64 L74 28"
            stroke="url(#acAccent)"
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M66 74 H82 M74 66 V82"
            stroke="#3DE7FF"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </Svg>
      </View>
      {showWordmark ? <Text style={styles.wordmark}>AppCash</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 14 },
  mark: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(61,231,255,0.28)',
  },
  wordmark: {
    color: Palette.cyan,
    fontFamily: Fonts.display,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
});
