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
  /** Small count badge (e.g. pending sync). */
  badge?: number;
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
  badge,
}: Props) {
  const content = (
    <View style={styles.row}>
      <View style={[styles.iconWrap, { backgroundColor: `${iconColor}22` }]}>
        <Ionicons name={icon} size={20} color={danger ? Palette.coral : iconColor} />
        {badge && badge > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        ) : null}
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
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Palette.coral,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: Palette.void, fontSize: 9, fontWeight: '800' },
  text: { flex: 1, minWidth: 0 },
  title: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontWeight: '700',
    fontSize: 15,
  },
  sub: { color: Palette.textDim, fontSize: 12, marginTop: 2 },
});
