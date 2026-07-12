import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: ReactNode;
  danger?: boolean;
};

/** Icon + title row used in More / Account menus. */
export function MenuRow({
  icon,
  iconColor = Palette.cyan,
  title,
  subtitle,
  onPress,
  right,
  danger,
}: Props) {
  const content = (
    <View style={styles.row}>
      <View style={[styles.iconWrap, { backgroundColor: `${iconColor}22` }]}>
        <Ionicons name={icon} size={20} color={danger ? Palette.coral : iconColor} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.title, danger && { color: Palette.coral }]}>{title}</Text>
        {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      </View>
      {right ??
        (onPress ? (
          <Ionicons name="chevron-forward" size={18} color={Palette.textDim} />
        ) : null)}
    </View>
  );

  if (!onPress) return <View style={styles.shell}>{content}</View>;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.shell, pressed && { opacity: 0.88 }]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.stroke,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, minWidth: 0 },
  title: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontWeight: '700',
    fontSize: 15,
  },
  sub: { color: Palette.textDim, fontSize: 12, marginTop: 2 },
});
