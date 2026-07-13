import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { GlassPanel, PrimaryButton, SectionTitle } from '@/components/ui/Primitives';
import { AppModal } from '@/components/ui/AppModal';
import { useAppDialog } from '@/components/ui/useAppDialog';
import {
  CATEGORY_COLOR_OPTIONS,
  CATEGORY_ICON_OPTIONS,
  categoryIonicon,
} from '@/constants/category-icons';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useFinanceStore } from '@/stores/finance-store';
import { createId } from '@/lib/id';
import { nowIso } from '@/lib/dates';
import { deleteCategory, upsertCategory } from '@/lib/db';
import { queueMutation } from '@/lib/sync/engine';
import type { Category, CategoryType } from '@/types/models';

export default function CategoriesScreen() {
  const categories = useFinanceStore((s) => s.categories);
  const refresh = useFinanceStore((s) => s.refresh);
  const { alert, confirm, Dialog } = useAppDialog();

  const [editing, setEditing] = useState<Category | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<CategoryType>('expense');
  const [icon, setIcon] = useState('tag');
  const [color, setColor] = useState(CATEGORY_COLOR_OPTIONS[0]);
  const [busy, setBusy] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setType('expense');
    setIcon('tag');
    setColor(CATEGORY_COLOR_OPTIONS[categories.length % CATEGORY_COLOR_OPTIONS.length]);
    setFormOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setName(cat.name);
    setType(cat.type);
    setIcon(cat.icon || 'tag');
    setColor(cat.color || CATEGORY_COLOR_OPTIONS[0]);
    setFormOpen(true);
  };

  const save = async () => {
    if (!name.trim()) {
      alert('Name required', 'Enter a category name, e.g. Gym.');
      return;
    }
    setBusy(true);
    try {
      const cat: Category = {
        id: editing?.id ?? createId(),
        name: name.trim(),
        type,
        icon,
        color,
        is_system: editing?.is_system ?? false,
        updated_at: nowIso(),
      };
      await upsertCategory(cat);
      await queueMutation('categories', cat);
      setFormOpen(false);
      await refresh();
    } catch (e) {
      alert('Error', e instanceof Error ? e.message : 'Could not save category');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = (cat: Category) => {
    confirm(
      'Delete category?',
      `“${cat.name}” will be removed. Existing transactions keep their amounts but lose this label.`,
      async () => {
        await deleteCategory(cat.id);
        await queueMutation('categories', { id: cat.id, deleted: true });
        await refresh();
      },
      { confirmLabel: 'Delete', tone: 'danger' }
    );
  };

  return (
    <Screen tabAware={false}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.headerRow}>
          <SectionTitle title={`${categories.length} categories`} subtitle="Tap to edit · long-press icons" />
          <PrimaryButton label="New" onPress={openCreate} />
        </View>

        {categories.length === 0 ? (
          <GlassPanel>
            <Text style={styles.meta}>No categories yet. Create your first one.</Text>
          </GlassPanel>
        ) : (
          categories.map((c) => (
            <GlassPanel key={c.id} style={styles.item}>
              <Pressable onPress={() => openEdit(c)} style={styles.itemMain}>
                <View style={[styles.iconWrap, { backgroundColor: `${c.color}33`, borderColor: c.color }]}>
                  <Ionicons name={categoryIonicon(c.icon)} size={20} color={c.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{c.name}</Text>
                  <Text style={styles.meta}>
                    {c.type}
                    {c.is_system ? ' · default' : ''}
                  </Text>
                </View>
                <View style={[styles.swatch, { backgroundColor: c.color }]} />
              </Pressable>
              <Pressable onPress={() => onDelete(c)} hitSlop={8} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={18} color={Palette.coral} />
              </Pressable>
            </GlassPanel>
          ))
        )}
      </KeyboardAvoidingView>

      <AppModal
        visible={formOpen}
        title={editing ? 'Edit category' : 'New category'}
        confirmLabel={busy ? 'Saving…' : 'Save'}
        cancelLabel="Cancel"
        confirmDisabled={busy}
        onCancel={() => setFormOpen(false)}
        onRequestClose={() => setFormOpen(false)}
        onConfirm={save}>
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
        <Text style={styles.label}>Color</Text>
        <View style={styles.row}>
          {CATEGORY_COLOR_OPTIONS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              style={[
                styles.colorDot,
                { backgroundColor: c },
                color === c && styles.colorDotOn,
              ]}
            />
          ))}
        </View>
        <Text style={styles.label}>Icon</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.iconRow}>
          {CATEGORY_ICON_OPTIONS.map((opt) => (
            <Pressable
              key={opt.id}
              onPress={() => setIcon(opt.id)}
              style={[
                styles.iconPick,
                icon === opt.id && { borderColor: color, backgroundColor: `${color}22` },
              ]}>
              <Ionicons name={opt.ion} size={22} color={icon === opt.id ? color : Palette.textMuted} />
            </Pressable>
          ))}
        </ScrollView>
      </AppModal>

      {Dialog}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  label: { color: Palette.textMuted, fontSize: 12, marginTop: Spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: Palette.stroke,
    borderRadius: Radii.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: Palette.text,
    backgroundColor: Palette.panelElevated,
    fontSize: 16,
    marginTop: 6,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
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
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotOn: { borderColor: Palette.white },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  iconRow: { flexDirection: 'row', gap: 8, marginTop: 8, paddingVertical: 2 },
  iconPick: {
    width: 44,
    height: 44,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Palette.stroke,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.panelElevated,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.sm,
    paddingVertical: 4,
  },
  itemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: { width: 12, height: 12, borderRadius: 6 },
  deleteBtn: { padding: 8 },
  name: { color: Palette.text, fontFamily: Fonts.display, fontWeight: '700' },
  meta: { color: Palette.textDim, fontSize: 12 },
});
