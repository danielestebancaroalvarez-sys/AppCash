import { Platform, StyleSheet } from 'react-native';

export const Palette = {
  void: '#070B14',
  deep: '#0D1526',
  panel: '#121C31',
  panelElevated: '#1A2742',
  stroke: 'rgba(120, 180, 255, 0.18)',
  cyan: '#3DE7FF',
  teal: '#2EE6A6',
  mint: '#7CFFCB',
  amber: '#FFC857',
  coral: '#FF6B7A',
  violet: '#8B7CFF',
  text: '#F4F7FF',
  textMuted: '#8B9BB8',
  textDim: '#6B7C96',
  white: '#FFFFFF',
  overlay: 'rgba(7, 11, 20, 0.72)',
  /** Liquid-glass — translucent but still readable over atmospheric bg. */
  glassFill: 'rgba(18, 28, 49, 0.55)',
  glassFillStrong: 'rgba(14, 22, 40, 0.7)',
  glassStroke: 'rgba(255, 255, 255, 0.14)',
  glassHighlight: 'rgba(255, 255, 255, 0.1)',
  glassSheen: 'rgba(61, 231, 255, 0.05)',
} as const;

export const GlassTokens = {
  blurIntensity: 48,
  borderWidth: StyleSheet.hairlineWidth,
} as const;

export const FinanceColors = {
  income: Palette.teal,
  expense: Palette.coral,
  savings: Palette.cyan,
  fixed: Palette.violet,
  variable: Palette.amber,
  netPositive: Palette.mint,
  netNegative: Palette.coral,
} as const;

export const CategoryPalette = [
  '#3DE7FF',
  '#2EE6A6',
  '#FFC857',
  '#FF6B7A',
  '#8B7CFF',
  '#5B8CFF',
  '#FF9F6B',
  '#6BFFD8',
] as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const Radii = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const Fonts = {
  display: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium', default: 'System' })!,
  body: Platform.select({ ios: 'Avenir', android: 'sans-serif', default: 'System' })!,
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' })!,
} as const;

export const Shadows = {
  glow: {
    shadowColor: Palette.cyan,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
} as const;

export const BottomTabInset = Platform.select({ ios: 88, android: 72 }) ?? 72;
