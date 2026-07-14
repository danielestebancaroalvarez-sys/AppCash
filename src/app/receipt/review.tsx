import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { GlassPanel, PrimaryButton } from '@/components/ui/Primitives';
import { useAppDialog } from '@/components/ui/useAppDialog';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Palette, Radii, Spacing } from '@/constants/theme';
import type { ParsedReceipt } from '@/types/models';
import { useFinanceStore } from '@/stores/finance-store';
import { createId } from '@/lib/id';
import { normalizeReceiptDate, nowIso } from '@/lib/dates';
import { parseAmount } from '@/lib/money';
import {
  upsertReceipt,
  upsertReceiptItem,
  upsertTransaction,
} from '@/lib/db';
import { queueMutation } from '@/lib/sync/engine';
import { tryUploadReceiptPhoto } from '@/lib/google/drive';
import { recomputeProductStats } from '@/lib/insights/market';
import { isReceiptNoiseLine } from '@/lib/purchases/filter';

export default function ReceiptReviewScreen() {
  const { photoUri, draft } = useLocalSearchParams<{ photoUri?: string; draft?: string }>();
  const router = useRouter();
  const users = useFinanceStore((s) => s.users);
  const categories = useFinanceStore((s) => s.categories);
  const activeUserId = useFinanceStore((s) => s.activeUserId);
  const session = useFinanceStore((s) => s.session);
  const refresh = useFinanceStore((s) => s.refresh);
  const { alert, Dialog } = useAppDialog();

  const initial = useMemo<ParsedReceipt>(() => {
    try {
      return JSON.parse(draft ?? '{}') as ParsedReceipt;
    } catch {
      return { store: '', purchased_at: '', total_aud: 0, items: [] };
    }
  }, [draft]);

  const [store, setStore] = useState(initial.store || '');
  const [date, setDate] = useState(normalizeReceiptDate(initial.purchased_at || ''));
  const [total, setTotal] = useState(String(initial.total_aud || ''));
  const [items, setItems] = useState(
    (initial.items || []).filter((item) => !isReceiptNoiseLine(item.name || ''))
  );
  const [userId, setUserId] = useState(activeUserId || users[0]?.id || '');

  const updateItem = (index: number, patch: Partial<(typeof items)[number]>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const saveReceipt = async () => {
    const grocery = categories.find((c) => c.name.toLowerCase() === 'groceries') ?? categories[0];
    if (!grocery || !userId) {
      alert('Missing category/user', 'Create a Groceries category and pick who paid.');
      return;
    }
    const receiptId = createId();
    const dateIso = normalizeReceiptDate(date);
    const productItems = items.filter((item) => !isReceiptNoiseLine(item.name || ''));
    const photoRef = await tryUploadReceiptPhoto(session?.accessToken, photoUri ?? '', receiptId);
    const receipt = {
      id: receiptId,
      user_id: userId,
      store: store.trim() || 'Store',
      total_aud: parseAmount(total),
      photo_uri_or_drive_id: photoRef || photoUri || '',
      purchased_at: `${dateIso}T12:00:00`,
      raw_gemini_json: draft ?? '',
      updated_at: nowIso(),
    };
    await upsertReceipt(receipt);
    await queueMutation('receipts', receipt);

    for (const item of productItems) {
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
      id: `tx_${receiptId}`,
      user_id: userId,
      type: 'expense_sporadic' as const,
      category_id: grocery.id,
      amount_aud: parseAmount(total) || productItems.reduce((a, i) => a + i.line_total_aud, 0),
      date: dateIso,
      note: `Receipt ${store.trim() || 'Store'}`,
      merchant: store.trim() || 'Store',
      receipt_id: receiptId,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await upsertTransaction(tx);
    await queueMutation('transactions', tx);
    await recomputeProductStats();
    await refresh();
    alert('Saved', 'Receipt and line items stored.');
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

      <PrimaryButton label="Confirm & save" onPress={saveReceipt} />
      <View style={{ height: 24 }} />
      {Dialog}
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
  row: { flexDirection: 'row', gap: 8 },
});
