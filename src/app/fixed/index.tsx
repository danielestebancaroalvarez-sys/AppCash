import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { GlassPanel, PrimaryButton, SectionTitle } from '@/components/ui/Primitives';
import { EmptyState } from '@/components/ui/EmptyState';
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
    <Screen tabAware={false}>
      <PrimaryButton label="Add fixed item" onPress={() => router.push('/fixed/edit' as never)} />
      <SectionTitle title="Active fixed items" subtitle="Auto-debit vs manual + reminders" />
      {fixedItems.length === 0 ? (
        <GlassPanel>
          <EmptyState
            icon="calendar-outline"
            title="No fixed items yet"
            body="Add rent, salary, or recurring bills. They stay on this phone — not on the purchase sheet."
            actionLabel="Add fixed item"
            onAction={() => router.push('/fixed/edit' as never)}
          />
        </GlassPanel>
      ) : (
        fixedItems.map((item) => {
          const user = users.find((u) => u.id === item.user_id);
          const cat = categories.find((c) => c.id === item.category_id);
          const color = cat?.color || (item.direction === 'in' ? Palette.teal : Palette.coral);
          const tone = item.direction === 'in' ? Palette.teal : Palette.coral;
          return (
            <GlassPanel key={item.id} style={styles.card}>
              <Pressable
                style={styles.cardMain}
                onPress={() =>
                  router.push({ pathname: '/fixed/edit' as never, params: { id: item.id } })
                }>
                <View style={[styles.catIcon, { backgroundColor: `${color}28` }]}>
                  <Ionicons name={categoryIonicon(cat?.icon ?? 'cube')} size={18} color={color} />
                </View>
                <View style={styles.body}>
                  <View style={styles.titleRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[styles.amt, { color: tone }]}>{formatAud(item.amount_aud)}</Text>
                  </View>
                  <Text style={styles.meta} numberOfLines={1}>
                    {item.direction === 'in' ? 'Income' : 'Expense'} · {item.period} ·{' '}
                    {item.auto_debit ? 'Auto debit' : `Manual · notify ${item.notify_days_before}d`}
                  </Text>
                  <View style={styles.metaRow}>
                    <UserName user={user} size={16} textStyle={styles.meta} />
                    <Text style={styles.meta} numberOfLines={1}>
                      · {cat?.name ?? '—'} · next {item.next_due}
                    </Text>
                  </View>
                </View>
              </Pressable>
              <Pressable
                hitSlop={8}
                style={styles.deleteBtn}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${item.name}`}
                onPress={() =>
                  confirm(`Delete ${item.name}?`, 'This fixed item will be removed.', () =>
                    remove(item.id), { confirmLabel: 'Delete', tone: 'danger' })
                }>
                <Ionicons name="trash-outline" size={18} color={Palette.coral} />
              </Pressable>
            </GlassPanel>
          );
        })
      )}
      {Dialog}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.sm,
  },
  cardMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  catIcon: {
    width: 40,
    height: 40,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    flex: 1,
    color: Palette.text,
    fontFamily: Fonts.display,
    fontWeight: '700',
    fontSize: 16,
  },
  meta: { color: Palette.textMuted, fontSize: 12 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  amt: { fontWeight: '800', fontSize: 15 },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
