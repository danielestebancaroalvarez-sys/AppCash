import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { GlassPanel, PrimaryButton } from '@/components/ui/Primitives';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useAppDialog } from '@/components/ui/useAppDialog';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useFinanceStore } from '@/stores/finance-store';
import { formatAud, parseAmount } from '@/lib/money';
import { formatDisplayDate, nowIso } from '@/lib/dates';
import {
  deleteReceipt,
  deleteReceiptItem,
  upsertReceiptItem,
} from '@/lib/db';
import { queueMutation } from '@/lib/sync/engine';
import { isReceiptNoiseLine } from '@/lib/purchases/filter';
import { recomputeProductStats } from '@/lib/insights/market';
import type { ReceiptItem } from '@/types/models';

function hasLocalPhoto(uri: string): boolean {
  return Boolean(uri && (uri.startsWith('file:') || uri.startsWith('content:') || uri.startsWith('http')));
}

export default function ReceiptDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const receipts = useFinanceStore((s) => s.receipts);
  const receiptItems = useFinanceStore((s) => s.receiptItems);
  const users = useFinanceStore((s) => s.users);
  const refresh = useFinanceStore((s) => s.refresh);
  const { alert, confirm, Dialog } = useAppDialog();
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftQty, setDraftQty] = useState('');
  const [draftPrice, setDraftPrice] = useState('');
  const [draftTotal, setDraftTotal] = useState('');
  const [draftCat, setDraftCat] = useState('');
  const cleanedNoiseFor = useRef<string | null>(null);

  const receipt = useMemo(() => receipts.find((r) => r.id === id), [receipts, id]);
  const rawItems = useMemo(
    () => receiptItems.filter((i) => i.receipt_id === id),
    [receiptItems, id]
  );
  const items = useMemo(
    () => rawItems.filter((i) => !isReceiptNoiseLine(i.name)),
    [rawItems]
  );
  const user = users.find((u) => u.id === receipt?.user_id);

  // One-shot purge of leftover TOTAL / GST lines from older scans
  useEffect(() => {
    if (!id || cleanedNoiseFor.current === id) return;
    const noise = rawItems.filter((i) => isReceiptNoiseLine(i.name));
    if (!noise.length) {
      cleanedNoiseFor.current = id;
      return;
    }
    cleanedNoiseFor.current = id;
    void (async () => {
      for (const item of noise) {
        await deleteReceiptItem(item.id);
        await queueMutation('receipt_items', { id: item.id, deleted: true });
      }
      await recomputeProductStats();
      await refresh();
    })();
  }, [id, rawItems, refresh]);

  if (!receipt) {
    return (
      <Screen tabAware={false}>
        <GlassPanel>
          <Text style={styles.missing}>Receipt not found.</Text>
          <PrimaryButton label="Back" onPress={() => router.back()} />
        </GlassPanel>
      </Screen>
    );
  }

  const photo = hasLocalPhoto(receipt.photo_uri_or_drive_id);

  const startEdit = (item: ReceiptItem) => {
    setEditingId(item.id);
    setDraftName(item.name);
    setDraftQty(String(item.qty));
    setDraftPrice(String(item.unit_price_aud));
    setDraftTotal(String(item.line_total_aud));
    setDraftCat(item.category_guess || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveItem = async () => {
    if (!editingId) return;
    const name = draftName.trim();
    if (!name) {
      alert('Name required', 'Enter a product name.');
      return;
    }
    if (isReceiptNoiseLine(name)) {
      alert('Not a product', 'Totals / GST / payment lines can’t be saved as items.');
      return;
    }
    const qty = Number(draftQty) || 1;
    const unit = parseAmount(draftPrice);
    const line = parseAmount(draftTotal) || unit * qty;
    const existing = rawItems.find((i) => i.id === editingId);
    if (!existing) return;

    setBusy(true);
    try {
      const updated: ReceiptItem = {
        ...existing,
        name,
        qty,
        unit_price_aud: unit,
        line_total_aud: line,
        category_guess: draftCat.trim(),
        updated_at: nowIso(),
      };
      await upsertReceiptItem(updated);
      await queueMutation('receipt_items', updated);
      await recomputeProductStats();
      await refresh();
      setEditingId(null);
    } finally {
      setBusy(false);
    }
  };

  const removeItem = (item: ReceiptItem) => {
    confirm(
      'Delete item?',
      `Remove “${item.name}” from this receipt.`,
      async () => {
        setBusy(true);
        try {
          await deleteReceiptItem(item.id);
          await queueMutation('receipt_items', { id: item.id, deleted: true });
          if (editingId === item.id) setEditingId(null);
          await recomputeProductStats();
          await refresh();
        } finally {
          setBusy(false);
        }
      },
      { confirmLabel: 'Delete', tone: 'danger' }
    );
  };

  const onDelete = () => {
    confirm(
      'Delete this receipt?',
      'Removes the photo record and line items from this phone (and next Sheet sync).',
      async () => {
        setBusy(true);
        try {
          await deleteReceipt(receipt.id);
          await queueMutation('receipts', { id: receipt.id, deleted: true });
          await refresh();
          router.back();
        } finally {
          setBusy(false);
        }
      },
      { confirmLabel: 'Delete', tone: 'danger' }
    );
  };

  return (
    <Screen tabAware={false}>
      {photo ? (
        <Image source={{ uri: receipt.photo_uri_or_drive_id }} style={styles.hero} />
      ) : (
        <View style={[styles.hero, styles.heroFallback]}>
          <Ionicons name="image-outline" size={40} color={Palette.textDim} />
          <Text style={styles.noPhoto}>No photo on this device</Text>
        </View>
      )}

      <GlassPanel style={styles.metaCard}>
        <Text style={styles.store}>{receipt.store || 'Receipt'}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={14} color={Palette.cyan} />
          <Text style={styles.metaText}>
            {formatDisplayDate(receipt.purchased_at.slice(0, 10) || receipt.purchased_at)}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="cash-outline" size={14} color={Palette.coral} />
          <Text style={[styles.metaText, { color: Palette.coral, fontWeight: '800' }]}>
            {formatAud(receipt.total_aud)}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <UserAvatar user={user} size={22} />
          <Text style={styles.metaText}>{user?.name ?? 'Unknown'}</Text>
        </View>
      </GlassPanel>

      <Text style={styles.section}>Line items ({items.length})</Text>
      {items.length === 0 ? (
        <GlassPanel>
          <Text style={styles.empty}>No line items stored for this receipt.</Text>
        </GlassPanel>
      ) : (
        items.map((item) => {
          const editing = editingId === item.id;
          return (
            <GlassPanel key={item.id} style={styles.itemCard}>
              {editing ? (
                <View style={styles.editForm}>
                  <Text style={styles.fieldLabel}>Product</Text>
                  <TextInput
                    value={draftName}
                    onChangeText={setDraftName}
                    style={styles.input}
                    placeholderTextColor={Palette.textDim}
                  />
                  <View style={styles.editRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Qty</Text>
                      <TextInput
                        value={draftQty}
                        onChangeText={setDraftQty}
                        keyboardType="decimal-pad"
                        style={styles.input}
                        placeholderTextColor={Palette.textDim}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Unit AUD</Text>
                      <TextInput
                        value={draftPrice}
                        onChangeText={setDraftPrice}
                        keyboardType="decimal-pad"
                        style={styles.input}
                        placeholderTextColor={Palette.textDim}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Line AUD</Text>
                      <TextInput
                        value={draftTotal}
                        onChangeText={setDraftTotal}
                        keyboardType="decimal-pad"
                        style={styles.input}
                        placeholderTextColor={Palette.textDim}
                      />
                    </View>
                  </View>
                  <Text style={styles.fieldLabel}>Category guess</Text>
                  <TextInput
                    value={draftCat}
                    onChangeText={setDraftCat}
                    style={styles.input}
                    placeholderTextColor={Palette.textDim}
                  />
                  <View style={styles.editActions}>
                    <Pressable onPress={cancelEdit} style={styles.ghostBtn}>
                      <Text style={styles.ghostBtnText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={saveItem}
                      disabled={busy}
                      style={[styles.saveBtn, busy && { opacity: 0.6 }]}>
                      <Text style={styles.saveBtnText}>{busy ? 'Saving…' : 'Save item'}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.itemRow}>
                  <View style={styles.itemIcon}>
                    <Ionicons name="cube-outline" size={18} color={Palette.cyan} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemMeta}>
                      Qty {item.qty}
                      {item.category_guess ? ` · ${item.category_guess}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.itemAmt}>{formatAud(item.line_total_aud)}</Text>
                  <Pressable onPress={() => startEdit(item)} hitSlop={8} style={styles.iconBtn}>
                    <Ionicons name="pencil-outline" size={18} color={Palette.cyan} />
                  </Pressable>
                  <Pressable onPress={() => removeItem(item)} hitSlop={8} style={styles.iconBtn}>
                    <Ionicons name="trash-outline" size={18} color={Palette.coral} />
                  </Pressable>
                </View>
              )}
            </GlassPanel>
          );
        })
      )}

      <PrimaryButton
        label={busy ? 'Working…' : 'Delete receipt'}
        variant="danger"
        onPress={onDelete}
        disabled={busy}
      />
      <View style={{ height: Spacing.lg }} />
      {Dialog}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    width: '100%',
    height: 220,
    borderRadius: Radii.lg,
    marginBottom: Spacing.md,
    backgroundColor: Palette.panelElevated,
  },
  heroFallback: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  noPhoto: { color: Palette.textDim, fontSize: 12 },
  metaCard: { gap: 10, marginBottom: Spacing.md },
  store: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontWeight: '800',
    fontSize: 22,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { color: Palette.textMuted, fontSize: 14 },
  section: {
    color: Palette.textDim,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  empty: { color: Palette.textMuted },
  itemCard: { marginBottom: Spacing.sm, gap: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: `${Palette.cyan}22`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: { color: Palette.text, fontWeight: '700' },
  itemMeta: { color: Palette.textDim, fontSize: 12, marginTop: 2 },
  itemAmt: { color: Palette.text, fontWeight: '800' },
  iconBtn: { padding: 4 },
  editForm: { gap: 6 },
  fieldLabel: { color: Palette.textDim, fontSize: 11, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: Palette.stroke,
    borderRadius: Radii.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: Palette.text,
    backgroundColor: Palette.panelElevated,
    fontSize: 14,
  },
  editRow: { flexDirection: 'row', gap: 8 },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  ghostBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Palette.stroke,
  },
  ghostBtnText: { color: Palette.textMuted, fontWeight: '700' },
  saveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radii.pill,
    backgroundColor: Palette.cyan,
  },
  saveBtnText: { color: Palette.void, fontWeight: '800' },
  missing: { color: Palette.textMuted, marginBottom: Spacing.md },
});
