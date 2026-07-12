import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { GlassPanel, PrimaryButton, SectionTitle } from '@/components/ui/Primitives';
import { Fonts, Palette, Spacing } from '@/constants/theme';
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
        return (
          <GlassPanel key={item.id} style={styles.row}>
            <Pressable style={{ flex: 1 }} onPress={() => router.push({ pathname: '/fixed/edit' as never, params: { id: item.id } })}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.direction === 'in' ? 'Income' : 'Expense'} · {item.period} ·{' '}
                {item.auto_debit ? 'Auto debit' : `Manual · notify ${item.notify_days_before}d`}
              </Text>
              <Text style={styles.meta}>
                {user?.name} · {cat?.name} · next {item.next_due}
              </Text>
            </Pressable>
            <View style={{ alignItems: 'flex-end', gap: 8 }}>
              <Text style={[styles.amt, { color: item.direction === 'in' ? Palette.teal : Palette.coral }]}>
                {formatAud(item.amount_aud)}
              </Text>
              <Text
                style={styles.delete}
                onPress={() =>
                  Alert.alert('Delete?', item.name, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => remove(item.id) },
                  ])
                }>
                Delete
              </Text>
            </View>
          </GlassPanel>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginBottom: Spacing.sm, gap: 10 },
  name: { color: Palette.text, fontFamily: Fonts.display, fontWeight: '700', fontSize: 16 },
  meta: { color: Palette.textDim, fontSize: 12, marginTop: 3 },
  amt: { fontWeight: '800' },
  delete: { color: Palette.coral, fontSize: 12 },
});
