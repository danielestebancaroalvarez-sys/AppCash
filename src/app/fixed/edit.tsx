import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO } from 'date-fns';
import { Screen } from '@/components/ui/Screen';
import { GlassPanel, PrimaryButton } from '@/components/ui/Primitives';
import { useAppDialog } from '@/components/ui/useAppDialog';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useFinanceStore } from '@/stores/finance-store';
import { createId } from '@/lib/id';
import { formatDisplayDate, nextDueFrom, nowIso, todayIsoDate } from '@/lib/dates';
import { parseAmount } from '@/lib/money';
import { upsertFixedItem } from '@/lib/db';
import { queueMutation } from '@/lib/sync/engine';
import { scheduleFixedItemReminders } from '@/lib/notifications/schedule';
import type { Direction, Period } from '@/types/models';

function toDate(iso: string): Date {
  try {
    return parseISO(iso.length === 10 ? `${iso}T12:00:00` : iso);
  } catch {
    return new Date();
  }
}

export default function FixedEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const fixedItems = useFinanceStore((s) => s.fixedItems);
  const users = useFinanceStore((s) => s.users);
  const categories = useFinanceStore((s) => s.categories);
  const activeUserId = useFinanceStore((s) => s.activeUserId);
  const refresh = useFinanceStore((s) => s.refresh);
  const { alert, Dialog } = useAppDialog();

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
  const [nextDue, setNextDue] = useState(
    existing?.next_due || nextDueFrom(existing?.period ?? 'monthly')
  );
  const [showDatePicker, setShowDatePicker] = useState(false);

  const periods: Period[] = ['weekly', 'fortnightly', 'monthly', 'yearly'];

  const filteredCats = useMemo(
    () => categories.filter((c) => (direction === 'in' ? c.type === 'income' : c.type === 'expense')),
    [categories, direction]
  );

  const onPeriodChange = (p: Period) => {
    setPeriod(p);
    // Only auto-suggest next due when creating a new item
    if (!existing) {
      setNextDue(nextDueFrom(p));
    }
  };

  const onDateChange = (_event: unknown, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) setNextDue(format(date, 'yyyy-MM-dd'));
  };

  const save = async () => {
    const value = parseAmount(amount);
    if (!name.trim() || !value || !userId || !categoryId) {
      alert('Missing fields', 'Fill name, amount, who, and category.');
      return;
    }
    if (!nextDue) {
      alert('Missing date', 'Pick the next payment / due date.');
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
      next_due: nextDue,
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
        <TextInput
          value={name}
          onChangeText={setName}
          style={styles.input}
          placeholderTextColor={Palette.textDim}
          placeholder="Rent, Gym…"
        />
        <Text style={styles.label}>Amount AUD</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          style={styles.input}
          placeholderTextColor={Palette.textDim}
        />

        <Text style={styles.label}>Direction</Text>
        <View style={styles.row}>
          {(['in', 'out'] as Direction[]).map((d) => (
            <Pressable key={d} onPress={() => setDirection(d)}>
              <Text style={[styles.chip, direction === d && styles.chipOn]}>
                {d === 'in' ? 'Income' : 'Expense'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Period</Text>
        <View style={styles.row}>
          {periods.map((p) => (
            <Pressable key={p} onPress={() => onPeriodChange(p)}>
              <Text style={[styles.chip, period === p && styles.chipOn]}>{p}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Next due date</Text>
        <Pressable
          onPress={() => setShowDatePicker(true)}
          style={({ pressed }) => [styles.dateBtn, pressed && { opacity: 0.85 }]}>
          <Text style={styles.dateValue}>{formatDisplayDate(nextDue)}</Text>
          <Text style={styles.dateHint}>Tap to change · {nextDue}</Text>
        </Pressable>
        {showDatePicker ? (
          <DateTimePicker
            value={toDate(nextDue || todayIsoDate())}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
            themeVariant="dark"
          />
        ) : null}
        {Platform.OS === 'ios' && showDatePicker ? (
          <PrimaryButton label="Done with date" onPress={() => setShowDatePicker(false)} variant="ghost" />
        ) : null}

        <View style={styles.switchRow}>
          <Text style={styles.label}>Auto debit</Text>
          <Switch value={autoDebit} onValueChange={setAutoDebit} trackColor={{ true: Palette.cyan }} />
        </View>
        {!autoDebit ? (
          <>
            <Text style={styles.label}>Notify days before</Text>
            <TextInput
              value={notifyDays}
              onChangeText={setNotifyDays}
              keyboardType="number-pad"
              style={styles.input}
              placeholderTextColor={Palette.textDim}
            />
          </>
        ) : null}

        <Text style={styles.label}>Person</Text>
        <View style={styles.row}>
          {users.map((u) => {
            const on = userId === u.id;
            return (
              <Pressable
                key={u.id}
                onPress={() => setUserId(u.id)}
                style={[styles.personChip, on && styles.personChipOn]}>
                <UserAvatar user={u} size={22} selected={on} />
                <Text style={[styles.personChipText, on && styles.personChipTextOn]}>{u.name}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Category</Text>
        <View style={styles.row}>
          {filteredCats.map((c) => (
            <Pressable key={c.id} onPress={() => setCategoryId(c.id)}>
              <Text style={[styles.chip, categoryId === c.id && styles.chipOn]}>{c.name}</Text>
            </Pressable>
          ))}
        </View>

        <PrimaryButton label="Save" onPress={save} />
      </GlassPanel>
      {Dialog}
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
  dateBtn: {
    borderWidth: 1,
    borderColor: Palette.stroke,
    borderRadius: Radii.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: Palette.panelElevated,
    gap: 2,
  },
  dateValue: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontWeight: '700',
    fontSize: 16,
  },
  dateHint: { color: Palette.cyan, fontSize: 12 },
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
  personChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Palette.panelElevated,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Palette.stroke,
  },
  personChipOn: { backgroundColor: Palette.cyan, borderColor: Palette.cyan },
  personChipText: { color: Palette.textMuted, fontSize: 12, fontWeight: '600' },
  personChipTextOn: { color: Palette.void },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
