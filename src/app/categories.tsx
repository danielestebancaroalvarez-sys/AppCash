import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Enter a category name, e.g. Gym.');
      return;
    }
    setBusy(true);
    try {
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
      Alert.alert('Created', `${cat.name} (${cat.type}) added`);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not create category');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen tabAware={false}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SectionTitle title="Create category" subtitle="Example: Gym, Side hustle, Coffee…" />
        <GlassPanel style={{ gap: Spacing.sm, marginBottom: Spacing.md }}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Category name"
            placeholderTextColor={Palette.textDim}
            style={styles.input}
            autoFocus
          />
          <Text style={styles.label}>Type</Text>
          <View style={styles.row}>
            {(['expense', 'income', 'savings'] as CategoryType[]).map((t) => (
              <Pressable
                key={t}
                onPress={() => setType(t)}
                style={[styles.chip, type === t && styles.chipOn]}>
                <Text style={[styles.chipText, type === t && styles.chipTextOn]}>{t}</Text>
              </Pressable>
            ))}
          </View>
          <PrimaryButton
            label={busy ? 'Saving…' : 'Add category'}
            onPress={create}
            disabled={busy}
          />
        </GlassPanel>

        <SectionTitle title={`${categories.length} categories`} />
        {categories.length === 0 ? (
          <GlassPanel>
            <Text style={styles.meta}>No categories yet. Create your first one above.</Text>
          </GlassPanel>
        ) : (
          categories.map((c) => (
            <GlassPanel key={c.id} style={styles.item}>
              <View style={[styles.swatch, { backgroundColor: c.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{c.name}</Text>
                <Text style={styles.meta}>
                  {c.type}
                  {c.is_system ? ' · system' : ''}
                </Text>
              </View>
            </GlassPanel>
          ))
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: Palette.textMuted, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: Palette.stroke,
    borderRadius: Radii.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: Palette.text,
    backgroundColor: Palette.panelElevated,
    fontSize: 16,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radii.pill,
    backgroundColor: Palette.panelElevated,
    borderWidth: 1,
    borderColor: Palette.stroke,
  },
  chipOn: { backgroundColor: Palette.cyan, borderColor: Palette.cyan },
  chipText: { color: Palette.textMuted, textTransform: 'capitalize', fontWeight: '600' },
  chipTextOn: { color: Palette.void },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing.sm },
  swatch: { width: 16, height: 16, borderRadius: 8 },
  name: { color: Palette.text, fontFamily: Fonts.display, fontWeight: '700' },
  meta: { color: Palette.textDim, fontSize: 12 },
});
