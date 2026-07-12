import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { GlassPanel } from '@/components/ui/Primitives';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useFinanceStore } from '@/stores/finance-store';
import { useSheetRefresh } from '@/hooks/use-sheet-refresh';
import { formatAud } from '@/lib/money';
import { formatDisplayDate } from '@/lib/dates';

function hasLocalPhoto(uri: string): boolean {
  return Boolean(uri && (uri.startsWith('file:') || uri.startsWith('content:') || uri.startsWith('http')));
}

export default function ReceiptsListScreen() {
  const router = useRouter();
  const receipts = useFinanceStore((s) => s.receipts);
  const users = useFinanceStore((s) => s.users);
  const receiptItems = useFinanceStore((s) => s.receiptItems);
  const { refreshing, onRefresh } = useSheetRefresh();

  return (
    <Screen onRefresh={onRefresh} refreshing={refreshing} tabAware={false}>
      <Text style={styles.lead}>
        {receipts.length} receipt{receipts.length === 1 ? '' : 's'} stored on this phone
      </Text>

      {receipts.length === 0 ? (
        <GlassPanel>
          <Text style={styles.emptyTitle}>No receipts yet</Text>
          <Text style={styles.empty}>
            Scan a receipt from the Add tab — photos and line items show up here.
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)/add' as never)}
            style={styles.cta}>
            <Ionicons name="scan-outline" size={18} color={Palette.void} />
            <Text style={styles.ctaText}>Scan a receipt</Text>
          </Pressable>
        </GlassPanel>
      ) : (
        receipts.map((r) => {
          const user = users.find((u) => u.id === r.user_id);
          const itemCount = receiptItems.filter((i) => i.receipt_id === r.id).length;
          const photo = hasLocalPhoto(r.photo_uri_or_drive_id);
          return (
            <Pressable
              key={r.id}
              onPress={() =>
                router.push({ pathname: '/receipts/[id]' as never, params: { id: r.id } })
              }>
              <GlassPanel style={styles.card}>
                {photo ? (
                  <Image source={{ uri: r.photo_uri_or_drive_id }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbFallback]}>
                    <Ionicons name="receipt-outline" size={28} color={Palette.cyan} />
                  </View>
                )}
                <View style={styles.body}>
                  <Text style={styles.store} numberOfLines={1}>
                    {r.store || 'Receipt'}
                  </Text>
                  <Text style={styles.meta}>
                    {formatDisplayDate(r.purchased_at.slice(0, 10) || r.purchased_at)}
                    {itemCount ? ` · ${itemCount} items` : ''}
                  </Text>
                  <View style={styles.who}>
                    <UserAvatar user={user} size={18} />
                    <Text style={styles.whoName} numberOfLines={1}>
                      {user?.name ?? 'Unknown'}
                    </Text>
                  </View>
                </View>
                <View style={styles.right}>
                  <Text style={styles.amt}>{formatAud(r.total_aud)}</Text>
                  <Ionicons name="chevron-forward" size={16} color={Palette.textDim} />
                </View>
              </GlassPanel>
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { color: Palette.textMuted, fontSize: 13, marginBottom: Spacing.md },
  emptyTitle: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontWeight: '800',
    fontSize: 16,
    marginBottom: 6,
  },
  empty: { color: Palette.textDim, fontSize: 13, lineHeight: 18, marginBottom: Spacing.md },
  cta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Palette.cyan,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radii.pill,
  },
  ctaText: { color: Palette.void, fontWeight: '800', fontSize: 13 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: Spacing.sm,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: Radii.md,
    backgroundColor: Palette.panelElevated,
  },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0 },
  store: { color: Palette.text, fontFamily: Fonts.display, fontWeight: '800', fontSize: 15 },
  meta: { color: Palette.textDim, fontSize: 12, marginTop: 3 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  whoName: { color: Palette.textMuted, fontSize: 12, flexShrink: 1 },
  right: { alignItems: 'flex-end', gap: 8 },
  amt: { color: Palette.coral, fontWeight: '800', fontSize: 14 },
});
