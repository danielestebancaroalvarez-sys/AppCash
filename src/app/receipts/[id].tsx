import { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { GlassPanel, PrimaryButton } from '@/components/ui/Primitives';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useAppDialog } from '@/components/ui/useAppDialog';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useFinanceStore } from '@/stores/finance-store';
import { formatAud } from '@/lib/money';
import { formatDisplayDate } from '@/lib/dates';
import { deleteReceipt } from '@/lib/db';
import { queueMutation } from '@/lib/sync/engine';

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
  const { confirm, Dialog } = useAppDialog();
  const [busy, setBusy] = useState(false);

  const receipt = useMemo(() => receipts.find((r) => r.id === id), [receipts, id]);
  const items = useMemo(
    () => receiptItems.filter((i) => i.receipt_id === id),
    [receiptItems, id]
  );
  const user = users.find((u) => u.id === receipt?.user_id);

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
        items.map((item) => (
          <GlassPanel key={item.id} style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemMeta}>
                Qty {item.qty}
                {item.category_guess ? ` · ${item.category_guess}` : ''}
              </Text>
            </View>
            <Text style={styles.itemAmt}>{formatAud(item.line_total_aud)}</Text>
          </GlassPanel>
        ))
      )}

      <PrimaryButton
        label={busy ? 'Deleting…' : 'Delete receipt'}
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
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: Spacing.sm,
  },
  itemName: { color: Palette.text, fontWeight: '700' },
  itemMeta: { color: Palette.textDim, fontSize: 12, marginTop: 2 },
  itemAmt: { color: Palette.text, fontWeight: '800' },
  missing: { color: Palette.textMuted, marginBottom: Spacing.md },
});
