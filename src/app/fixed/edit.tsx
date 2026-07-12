import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { GlassPanel, PrimaryButton } from '@/components/ui/Primitives';
import { Palette, Radii, Spacing } from '@/constants/theme';
import { useFinanceStore } from '@/stores/finance-store';
import { createId } from '@/lib/id';
import { nextDueFrom, nowIso } from '@/lib/dates';
import { parseAmount } from '@/lib/money';
import { upsertFixedItem } from '@/lib/db';
import { queueMutation } from '@/lib/sync/engine';
import { scheduleFixedItemReminders } from '@/lib/notifications/schedule';
import type { Direction, Period } from '@/types/models';

export default function FixedEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const fixedItems = useFinanceStore((s) => s.fixedItems);
  const users = useFinanceStore((s) => s.users);
  const categories = useFinanceStore((s) => s.categories);
  const activeUserId = useFinanceStore((s) => s.activeUserId);
  const refresh = useFinanceStore((s) => s.refresh);

  const existing = fixedItems.find((f) => f.id === id);
  const [name, setName] = useState(existing?.name ?? '');
  const [amount, setAmount] = useState(existing ? String(existing.amount_aud) : '');
  const [period, setPeriod] = useState<Period>(existing?.period ?? 'monthly');
  const [direction, setDirection] = useState<Direction>(existing?.direction ?? 'out');
  const [autoDebit, setAutoDebit] = useState(existing?.auto_debit ?? true);
  const [notifyDays, setNotifyDays] = useState(String(existing?.notify_days_before ?? 2));
  const [userId, setUserId] = useState(existing?.user_id ?? activeUserId ?? users[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState(
    existing?.category_id ?? categories.find((c) => c.type === 'expense')?.id ?? ''
  );

  const periods: Period[] = ['weekly', 'fortnightly', 'monthly', 'yearly'];

  const filteredCats = useMemo(
    () => categories.filter((c) => (direction === 'in' ? c.type === 'income' : c.type === 'expense')),
    [categories, direction]
  );

  const save = async () => {
    const value = parseAmount(amount);
    if (!name.trim() || !value || !userId || !categoryId) {
      Alert.alert('Missing fields');
      return;
    }
    const item = {
      id: existing?.id ?? createId(),
      user_id: userId,
      category_id: categoryId,
      name: name.trim(),
      amount_aud: value,
      period,
      direction,
      auto_debit: autoDebit,
      notify_days_before: Number(notifyDays) || 0,
      active: true,
      next_due: existing?.next_due ?? nextDueFrom(period),
      updated_at: nowIso(),
    };
    await upsertFixedItem(item);
    await queueMutation('fixed_items', item);
    if (!autoDebit) await scheduleFixedItemReminders();
    await refresh();
    router.back();
  };

  return (
    <Screen>
      <GlassPanel style={{ gap: Spacing.sm }}>
        <Text style={styles.label}>Name</Text>
        <TextInput value={name} onChangeText={setName} style={styles.input} placeholderTextColor={Palette.textDim} placeholder="Rent, Gym…" />
        <Text style={styles.label}>Amount AUD</Text>
        <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={styles.input} placeholderTextColor={Palette.textDim} />

        <Text style={styles.label}>Direction</Text>
        <View style={styles.row}>
          {(['in', 'out'] as Direction[]).map((d) => (
            <Text key={d} onPress={() => setDirection(d)} style={[styles.chip, direction === d && styles.chipOn]}>
              {d === 'in' ? 'Income' : 'Expense'}
            </Text>
          ))}
        </View>

        <Text style={styles.label}>Period</Text>
        <View style={styles.row}>
          {periods.map((p) => (
            <Text key={p} onPress={() => setPeriod(p)} style={[styles.chip, period === p && styles.chipOn]}>
              {p}
            </Text>
          ))}
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.label}>Auto debit</Text>
          <Switch value={autoDebit} onValueChange={setAutoDebit} trackColor={{ true: Palette.cyan }} />
        </View>
        {!autoDebit ? (
          <>
            <Text style={styles.label}>Notify days before</Text>
            <TextInput value={notifyDays} onChangeText={setNotifyDays} keyboardType="number-pad" style={styles.input} placeholderTextColor={Palette.textDim} />
          </>
        ) : null}

        <Text style={styles.label}>Person</Text>
        <View style={styles.row}>
          {users.map((u) => (
            <Text key={u.id} onPress={() => setUserId(u.id)} style={[styles.chip, userId === u.id && styles.chipOn]}>
              {u.name}
            </Text>
          ))}
        </View>

        <Text style={styles.label}>Category</Text>
        <View style={styles.row}>
          {filteredCats.map((c) => (
            <Text key={c.id} onPress={() => setCategoryId(c.id)} style={[styles.chip, categoryId === c.id && styles.chipOn]}>
              {c.name}
            </Text>
          ))}
        </View>

        <PrimaryButton label="Save" onPress={save} />
      </GlassPanel>
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
    paddingVertical: 10,
    color: Palette.text,
    backgroundColor: Palette.panelElevated,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
