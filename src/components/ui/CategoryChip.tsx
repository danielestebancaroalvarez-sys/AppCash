import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { categoryIonicon } from '@/constants/category-icons';
import { Palette, Radii } from '@/constants/theme';
import type { Category } from '@/types/models';

type ChipProps = {
  name: string;
  color?: string;
  icon?: string;
  selected?: boolean;
  onPress?: () => void;
};

/** Single category pill with colour + icon — use everywhere categories are listed. */
export function CategoryChip({
  name,
  color = Palette.cyan,
  icon = 'cube',
  selected = false,
  onPress,
}: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.chip,
        selected && {
          backgroundColor: `${color}28`,
          borderColor: color,
        },
      ]}>
      <View style={[styles.icon, { backgroundColor: `${color}33` }]}>
        <Ionicons name={categoryIonicon(icon)} size={16} color={color} />
      </View>
      <Text style={[styles.label, selected && { color: Palette.text, fontWeight: '700' }]}>
        {name}
      </Text>
    </Pressable>
  );
}

type RowProps = {
  categories: Category[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Optional leading “All” chip */
  allOption?: { id: string; label: string };
};

/** Horizontal scroll of category chips. */
export function CategoryChipRow({ categories, selectedId, onSelect, allOption }: RowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}>
      {allOption ? (
        <CategoryChip
          name={allOption.label}
          color={Palette.cyan}
          icon="pricetag"
          selected={selectedId === allOption.id}
          onPress={() => onSelect(allOption.id)}
        />
      ) : null}
      {categories.map((c) => (
        <CategoryChip
          key={c.id}
          name={c.name}
          color={c.color || Palette.cyan}
          icon={c.icon}
          selected={selectedId === c.id}
          onPress={() => onSelect(c.id)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Palette.glassFillStrong,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.glassStroke,
  },
  icon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: Palette.text, fontSize: 12, fontWeight: '600' },
});
