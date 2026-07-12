import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CollapsibleWidget } from '@/components/ui/CollapsibleWidget';
import { WidgetTitle } from '@/components/dashboard/WidgetTitle';
import { Palette, Spacing } from '@/constants/theme';
import { formatAud } from '@/lib/money';
import type { PeriodStats } from '@/hooks/use-period-stats';

export function UpcomingBuysWidget({ stats }: { stats: PeriodStats }) {
  const router = useRouter();
  return (
    <CollapsibleWidget
      accent={Palette.mint}
      header={<WidgetTitle icon="bag-handle-outline" title="Upcoming Buys" iconColor={Palette.mint} />}
      collapsedSummary={
        <Text style={styles.summary}>
          {stats.upcomingBuys.length
            ? `${stats.upcomingBuys.length} likely soon`
            : 'No predictions yet'}
        </Text>
      }>
      {stats.upcomingBuys.length === 0 ? (
        <Text style={styles.empty}>Scan a few grocery receipts to unlock predictions.</Text>
      ) : (
        stats.upcomingBuys.map((p) => (
          <View key={p.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{p.product_name_normalized}</Text>
              <Text style={styles.meta}>
                every ~{p.buy_frequency_days}d · avg {formatAud(p.avg_price)}
              </Text>
            </View>
            <Text style={styles.price}>{formatAud(p.avg_price)}</Text>
          </View>
        ))
      )}
      <Pressable onPress={() => router.push('/insights' as never)} style={styles.link}>
        <Text style={styles.linkText}>Open market insights</Text>
        <Ionicons name="chevron-forward" size={14} color={Palette.cyan} />
      </Pressable>
    </CollapsibleWidget>
  );
}

const styles = StyleSheet.create({
  summary: { color: Palette.textDim, fontSize: 12 },
  empty: { color: Palette.textMuted, fontSize: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.stroke,
  },
  name: { color: Palette.text, fontWeight: '600', textTransform: 'capitalize' },
  meta: { color: Palette.textDim, fontSize: 11, marginTop: 2 },
  price: { color: Palette.cyan, fontWeight: '800' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.sm },
  linkText: { color: Palette.cyan, fontWeight: '700', fontSize: 13 },
});
