import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { GlassPanel, PrimaryButton, SectionTitle } from '@/components/ui/Primitives';
import { CategoryPalette, Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useFinanceStore } from '@/stores/finance-store';
import { createId } from '@/lib/id';
import { nowIso } from '@/lib/dates';
import { upsertCategory } from '@/lib/db';
import { queueMutation } from '@/lib/sync/engine';
import type { CategoryType } from '@/types/models';

export default function CategoriesScreen() {
  const categories = useFinanceStore((s) => s.categories);
  const refresh = useFinanceStore((s) => s.refresh);
  const [name, setName] = useState('');
  const [type, setType] = useState<CategoryType>('expense');

  const create = async () => {
    if (!name.trim()) return;
    const cat = {
      id: createId(),
      name: name.trim(),
      type,
      icon: 'tag',
      color: CategoryPalette[categories.length % CategoryPalette.length],
      is_system: false,
      updated_at: nowIso(),
    };
    await upsertCategory(cat);
    await queueMutation('categories', cat);
    setName('');
    await refresh();
    Alert.alert('Created', `${cat.name} added`);
  };

  return (
    <Screen>
      <SectionTitle title="Create category" subtitle='Example: Gym, Side hustle…' />
      <GlassPanel style={{ gap: Spacing.sm, marginBottom: Spacing.md }}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Category name"
          placeholderTextColor={Palette.textDim}
          style={styles.input}
        />
        <View style={styles.row}>
          {(['expense', 'income', 'savings'] as CategoryType[]).map((t) => (
            <Text key={t} onPress={() => setType(t)} style={[styles.chip, type === t && styles.chipOn]}>
              {t}
            </Text>
          ))}
        </View>
        <PrimaryButton label="Add category" onPress={create} />
      </GlassPanel>

      {categories.map((c) => (
        <GlassPanel key={c.id} style={styles.item}>
          <View style={[styles.swatch, { backgroundColor: c.color }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{c.name}</Text>
            <Text style={styles.meta}>{c.type}{c.is_system ? ' · system' : ''}</Text>
          </View>
        </GlassPanel>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: Palette.stroke,
    borderRadius: Radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Palette.text,
    backgroundColor: Palette.panelElevated,
  },
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    color: Palette.textMuted,
    backgroundColor: Palette.panelElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.pill,
    overflow: 'hidden',
    textTransform: 'capitalize',
  },
  chipOn: { color: Palette.void, backgroundColor: Palette.cyan },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing.sm },
  swatch: { width: 16, height: 16, borderRadius: 8 },
  name: { color: Palette.text, fontFamily: Fonts.display, fontWeight: '700' },
  meta: { color: Palette.textDim, fontSize: 12 },
});
