import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { GlassPanel, PrimaryButton } from '@/components/ui/Primitives';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useAppDialog } from '@/components/ui/useAppDialog';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useFinanceStore } from '@/stores/finance-store';
import { parseAmount } from '@/lib/money';
import { nowIso } from '@/lib/dates';
import { upsertTransaction } from '@/lib/db';
import { queueMutation } from '@/lib/sync/engine';
import type { TransactionType } from '@/types/models';

const TYPES: Array<{ id: TransactionType; label: string }> = [
  { id: 'expense_sporadic', label: 'Expense' },
  { id: 'income_sporadic', label: 'Income' },
  { id: 'variable', label: 'Variable' },
  { id: 'fixed', label: 'Fixed' },
  { id: 'savings_contrib', label: 'Savings' },
];

export default function TransactionEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const transactions = useFinanceStore((s) => s.transactions);
  const users = useFinanceStore((s) => s.users);
  const categories = useFinanceStore((s) => s.categories);
  const refresh = useFinanceStore((s) => s.refresh);
  const { alert, Dialog } = useAppDialog();

  const existing = useMemo(() => transactions.find((t) => t.id === id), [transactions, id]);

  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState<TransactionType>('expense_sporadic');
  const [categoryId, setCategoryId] = useState('');
  const [userId, setUserId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setAmount(String(existing.amount_aud));
    setMerchant(existing.merchant);
    setNote(existing.note);
    setDate(existing.date);
    setType(existing.type);
    setCategoryId(existing.category_id);
    setUserId(existing.user_id);
  }, [existing]);

  if (!existing) {
    return (
      <Screen tabAware={false}>
        <GlassPanel>
          <Text style={styles.missing}>Entry not found.</Text>
          <PrimaryButton label="Back" onPress={() => router.back()} />
        </GlassPanel>
      </Screen>
    );
  }

  const save = async () => {
    const value = parseAmount(amount);
    if (!value || !date) {
      alert('Missing fields', 'Enter amount and date (yyyy-MM-dd).');
      return;
    }
    setBusy(true);
    try {
      const updated = {
        ...existing,
        amount_aud: value,
        merchant: merchant.trim(),
        note: note.trim(),
        date: date.slice(0, 10),
        type,
        category_id: categoryId || existing.category_id,
        user_id: userId || existing.user_id,
        updated_at: nowIso(),
      };
      await upsertTransaction(updated);
      await queueMutation('transactions', updated);
      await refresh();
      router.back();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen tabAware={false}>
      <GlassPanel style={{ gap: Spacing.sm }}>
        <Text style={styles.label}>Amount AUD</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          style={styles.input}
          placeholderTextColor={Palette.textDim}
        />
        <Text style={styles.label}>Date</Text>
        <TextInput
          value={date}
          onChangeText={setDate}
          placeholder="yyyy-MM-dd"
          style={styles.input}
          placeholderTextColor={Palette.textDim}
        />
        <Text style={styles.label}>Merchant / title</Text>
        <TextInput
          value={merchant}
          onChangeText={setMerchant}
          style={styles.input}
          placeholderTextColor={Palette.textDim}
        />
        <Text style={styles.label}>Note</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          style={styles.input}
          placeholderTextColor={Palette.textDim}
        />

        <Text style={styles.label}>Type</Text>
        <View style={styles.row}>
          {TYPES.map((t) => (
            <Pressable key={t.id} onPress={() => setType(t.id)}>
              <Text style={[styles.chip, type === t.id && styles.chipOn]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Category</Text>
        <View style={styles.row}>
          {categories.map((c) => (
            <Pressable key={c.id} onPress={() => setCategoryId(c.id)}>
              <Text style={[styles.chip, categoryId === c.id && styles.chipOn]}>{c.name}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Registered by</Text>
        <View style={styles.row}>
          {users.map((u) => {
            const on = userId === u.id;
            return (
              <Pressable
                key={u.id}
                onPress={() => setUserId(u.id)}
                style={[styles.person, on && styles.personOn]}>
                <UserAvatar user={u} size={22} selected={on} />
                <Text style={[styles.personText, on && styles.personTextOn]}>{u.name}</Text>
              </Pressable>
            );
          })}
        </View>

        <PrimaryButton label={busy ? 'Saving…' : 'Save'} onPress={save} disabled={busy} />
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
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    color: Palette.textMuted,
    backgroundColor: Palette.panelElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.pill,
    overflow: 'hidden',
  },
  chipOn: { color: Palette.void, backgroundColor: Palette.cyan },
  person: {
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
  personOn: { backgroundColor: Palette.cyan, borderColor: Palette.cyan },
  personText: { color: Palette.textMuted, fontSize: 12, fontWeight: '600' },
  personTextOn: { color: Palette.void },
  missing: {
    color: Palette.textMuted,
    fontFamily: Fonts.body,
    marginBottom: Spacing.md,
  },
});
