import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { GlassPanel, PrimaryButton, SectionTitle } from '@/components/ui/Primitives';
import { useAppDialog } from '@/components/ui/useAppDialog';
import { UserName } from '@/components/ui/UserAvatar';
import { categoryIonicon } from '@/constants/category-icons';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useFinanceStore } from '@/stores/finance-store';
import { formatAud } from '@/lib/money';
import { deleteFixedItem } from '@/lib/db';
import { queueMutation } from '@/lib/sync/engine';

export default function FixedListScreen() {
  const router = useRouter();
  const fixedItems = useFinanceStore((s) => s.fixedItems);
  const users = useFinanceStore((s) => s.users);
  const categories = useFinanceStore((s) => s.categories);
  const refresh = useFinanceStore((s) => s.refresh);
  const { confirm, Dialog } = useAppDialog();

  const remove = async (id: string) => {
    await deleteFixedItem(id);
    await queueMutation('fixed_items', { id, deleted: true });
    await refresh();
  };

  return (
    <Screen>
      <PrimaryButton label="Add fixed item" onPress={() => router.push('/fixed/edit' as never)} />
      <SectionTitle title="Active fixed items" subtitle="Auto-debit vs manual + reminders" />
      {fixedItems.map((item) => {
        const user = users.find((u) => u.id === item.user_id);
        const cat = categories.find((c) => c.id === item.category_id);
        const color = cat?.color || (item.direction === 'in' ? Palette.teal : Palette.coral);
        return (
          <GlassPanel key={item.id} style={styles.row}>
            <View style={[styles.catIcon, { backgroundColor: `${color}28` }]}>
              <Ionicons name={categoryIonicon(cat?.icon ?? 'cube')} size={18} color={color} />
            </View>
            <Pressable
              style={{ flex: 1 }}
              onPress={() =>
                router.push({ pathname: '/fixed/edit' as never, params: { id: item.id } })
              }>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.direction === 'in' ? 'Income' : 'Expense'} · {item.period} ·{' '}
                {item.auto_debit ? 'Auto debit' : `Manual · notify ${item.notify_days_before}d`}
              </Text>
              <View style={styles.metaRow}>
                <UserName user={user} size={16} textStyle={styles.meta} />
                <Text style={[styles.meta, { color }]}>
                  · {cat?.name ?? '—'} · next {item.next_due}
                </Text>
              </View>
            </Pressable>
            <View style={{ alignItems: 'flex-end', gap: 8 }}>
              <Text
                style={[
                  styles.amt,
                  { color: item.direction === 'in' ? Palette.teal : Palette.coral },
                ]}>
                {formatAud(item.amount_aud)}
              </Text>
              <Text
                style={styles.delete}
                onPress={() =>
                  confirm(`Delete ${item.name}?`, 'This fixed item will be removed.', () =>
                    remove(item.id), { confirmLabel: 'Delete', tone: 'danger' })
                }>
                Delete
              </Text>
            </View>
          </GlassPanel>
        );
      })}
      {Dialog}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginBottom: Spacing.sm, gap: 10, alignItems: 'center' },
  catIcon: {
    width: 40,
    height: 40,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: Palette.text, fontFamily: Fonts.display, fontWeight: '700', fontSize: 16 },
  meta: { color: Palette.textDim, fontSize: 12 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 3,
  },
  amt: { fontWeight: '800' },
  delete: { color: Palette.coral, fontSize: 12 },
});
