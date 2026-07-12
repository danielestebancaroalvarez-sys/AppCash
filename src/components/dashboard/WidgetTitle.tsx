import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, Palette } from '@/constants/theme';

export function WidgetTitle({
  icon,
  title,
  iconColor = Palette.cyan,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  iconColor?: string;
}) {
  return (
    <View style={styles.row}>
      <View style={[styles.icon, { backgroundColor: `${iconColor}22` }]}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: Palette.text, fontFamily: Fonts.display, fontWeight: '800', fontSize: 15, flexShrink: 1 },
});
