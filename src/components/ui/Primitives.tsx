import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  glow?: boolean;
};

export function GlassPanel({ children, style, onPress, glow }: Props) {
  const body = (
    <View style={[styles.panel, glow && styles.glow, style]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']}
        style={StyleSheet.absoluteFill}
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

export function AmountText({
  value,
  tone = 'neutral',
  size = 'md',
}: {
  value: string;
  tone?: 'income' | 'expense' | 'neutral' | 'accent';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const color =
    tone === 'income'
      ? Palette.teal
      : tone === 'expense'
        ? Palette.coral
        : tone === 'accent'
          ? Palette.cyan
          : Palette.text;
  return <Text style={[styles.amount, styles[`size_${size}`], { color }]}>{value}</Text>;
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
}) {
  const bg =
    variant === 'primary' ? Palette.cyan : variant === 'danger' ? Palette.coral : 'transparent';
  const color = variant === 'ghost' ? Palette.cyan : Palette.void;
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, borderColor: Palette.stroke, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === 'ghost' && styles.btnGhost,
      ]}>
      <Text style={[styles.btnText, { color: variant === 'ghost' || variant === 'danger' ? (variant === 'danger' ? Palette.void : color) : color }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: Palette.panel,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Palette.stroke,
    padding: Spacing.md,
    overflow: 'hidden',
  },
  glow: {
    shadowColor: Palette.cyan,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  amount: { fontFamily: Fonts.display, fontWeight: '700' },
  size_sm: { fontSize: 14 },
  size_md: { fontSize: 18 },
  size_lg: { fontSize: 28 },
  size_xl: { fontSize: 36 },
  section: { marginBottom: Spacing.sm, marginTop: Spacing.md },
  sectionTitle: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontSize: 18,
    fontWeight: '700',
  },
  sectionSub: { color: Palette.textMuted, marginTop: 4, fontSize: 13 },
  btn: {
    borderRadius: Radii.pill,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    borderWidth: 1,
  },
  btnGhost: { backgroundColor: 'transparent' },
  btnText: { fontFamily: Fonts.display, fontWeight: '700', fontSize: 15 },
});
