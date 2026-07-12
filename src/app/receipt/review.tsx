import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { GlassPanel, PrimaryButton } from '@/components/ui/Primitives';
import { Palette, Radii, Spacing } from '@/constants/theme';
import type { ParsedReceipt } from '@/types/models';
import { useFinanceStore } from '@/stores/finance-store';
import { createId } from '@/lib/id';
import { nowIso } from '@/lib/dates';
import { parseAmount } from '@/lib/money';
import {
  upsertReceipt,
  upsertReceiptItem,
  upsertTransaction,
} from '@/lib/db';
import { queueMutation } from '@/lib/sync/engine';
import { recomputeProductStats } from '@/lib/insights/market';

export default function ReceiptReviewScreen() {
  const { photoUri, draft } = useLocalSearchParams<{ photoUri?: string; draft?: string }>();
  const router = useRouter();
  const users = useFinanceStore((s) => s.users);
  const categories = useFinanceStore((s) => s.categories);
  const activeUserId = useFinanceStore((s) => s.activeUserId);
  const refresh = useFinanceStore((s) => s.refresh);

  const initial = useMemo<ParsedReceipt>(() => {
    try {
      return JSON.parse(draft ?? '{}') as ParsedReceipt;
    } catch {
      return { store: '', purchased_at: '', total_aud: 0, items: [] };
    }
  }, [draft]);

  const [store, setStore] = useState(initial.store || '');
  const [date, setDate] = useState(initial.purchased_at || '');
  const [total, setTotal] = useState(String(initial.total_aud || ''));
  const [items, setItems] = useState(initial.items || []);
  const [userId, setUserId] = useState(activeUserId || users[0]?.id || '');

  const updateItem = (index: number, patch: Partial<(typeof items)[number]>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const confirm = async () => {
    const grocery = categories.find((c) => c.name.toLowerCase() === 'groceries') ?? categories[0];
    if (!grocery || !userId) {
      Alert.alert('Missing category/user');
      return;
    }
    const receiptId = createId();
    const receipt = {
      id: receiptId,
      user_id: userId,
      store,
      total_aud: parseAmount(total),
      photo_uri_or_drive_id: photoUri ?? '',
      purchased_at: date,
      raw_gemini_json: draft ?? '',
      updated_at: nowIso(),
    };
    await upsertReceipt(receipt);
    await queueMutation('receipts', receipt);

    for (const item of items) {
      const row = {
        id: createId(),
        receipt_id: receiptId,
        name: item.name,
        qty: item.qty,
        unit_price_aud: item.unit_price_aud,
        line_total_aud: item.line_total_aud,
        category_guess: item.category_guess,
        updated_at: nowIso(),
      };
      await upsertReceiptItem(row);
      await queueMutation('receipt_items', row);
    }

    const tx = {
      id: createId(),
      user_id: userId,
      type: 'expense_sporadic' as const,
      category_id: grocery.id,
      amount_aud: parseAmount(total) || items.reduce((a, i) => a + i.line_total_aud, 0),
      date: date.slice(0, 10),
      note: `Receipt ${store}`,
      merchant: store,
      receipt_id: receiptId,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await upsertTransaction(tx);
    await queueMutation('transactions', tx);
    await recomputeProductStats();
    await refresh();
    Alert.alert('Saved', 'Receipt and line items stored.');
    router.back();
  };

  return (
    <Screen>
      {photoUri ? <Image source={{ uri: photoUri }} style={styles.photo} /> : null}
      <GlassPanel style={{ gap: Spacing.sm, marginBottom: Spacing.md }}>
        <Text style={styles.label}>Store</Text>
        <TextInput value={store} onChangeText={setStore} style={styles.input} placeholderTextColor={Palette.textDim} />
        <Text style={styles.label}>Date</Text>
        <TextInput value={date} onChangeText={setDate} style={styles.input} placeholderTextColor={Palette.textDim} />
        <Text style={styles.label}>Total AUD</Text>
        <TextInput value={total} onChangeText={setTotal} keyboardType="decimal-pad" style={styles.input} placeholderTextColor={Palette.textDim} />
        <Text style={styles.label}>Who paid</Text>
        <View style={styles.chips}>
          {users.map((u) => (
            <Text
              key={u.id}
              onPress={() => setUserId(u.id)}
              style={[styles.chip, userId === u.id && styles.chipOn]}>
              {u.name}
            </Text>
          ))}
        </View>
      </GlassPanel>

      {items.map((item, index) => (
        <GlassPanel key={`${item.name}-${index}`} style={{ marginBottom: Spacing.sm, gap: 6 }}>
          <TextInput
            value={item.name}
            onChangeText={(name) => updateItem(index, { name })}
            style={styles.input}
            placeholderTextColor={Palette.textDim}
          />
          <View style={styles.row}>
            <TextInput
              value={String(item.qty)}
              onChangeText={(v) => updateItem(index, { qty: Number(v) || 1 })}
              style={[styles.input, { flex: 1 }]}
              keyboardType="decimal-pad"
              placeholder="Qty"
              placeholderTextColor={Palette.textDim}
            />
            <TextInput
              value={String(item.line_total_aud)}
              onChangeText={(v) => updateItem(index, { line_total_aud: Number(v) || 0 })}
              style={[styles.input, { flex: 1 }]}
              keyboardType="decimal-pad"
              placeholder="Line total"
              placeholderTextColor={Palette.textDim}
            />
          </View>
        </GlassPanel>
      ))}

      <PrimaryButton label="Confirm & save" onPress={confirm} />
      <View style={{ height: 24 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', height: 180, borderRadius: Radii.lg, marginBottom: Spacing.md },
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    color: Palette.textMuted,
    backgroundColor: Palette.panelElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.pill,
    overflow: 'hidden',
  },
  chipOn: { color: Palette.void, backgroundColor: Palette.cyan },
  row: { flexDirection: 'row', gap: 8 },
});
