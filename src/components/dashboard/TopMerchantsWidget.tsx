import { StyleSheet, Text, View } from 'react-native';
import { CollapsibleWidget } from '@/components/ui/CollapsibleWidget';
import { WidgetTitle } from '@/components/dashboard/WidgetTitle';
import { CategoryPalette, Palette } from '@/constants/theme';
import { formatAud } from '@/lib/money';
import type { PeriodStats } from '@/hooks/use-period-stats';

export function TopMerchantsWidget({ stats }: { stats: PeriodStats }) {
  return (
    <CollapsibleWidget
      accent={Palette.amber}
      header={
        <WidgetTitle icon="storefront-outline" title="Top Merchants" iconColor={Palette.amber} />
      }
      collapsedSummary={
        <Text style={styles.summary}>
          {stats.topMerchants[0]
            ? `${stats.topMerchants[0].name} · ${formatAud(stats.topMerchants[0].value)}`
            : 'No merchant spend yet'}
        </Text>
      }>
      {stats.topMerchants.length === 0 ? (
        <Text style={styles.empty}>Scan receipts to see store rankings.</Text>
      ) : (
        stats.topMerchants.map((m, i) => {
          const color = CategoryPalette[i % CategoryPalette.length];
          return (
            <View key={m.name} style={styles.row}>
              <Text style={[styles.rank, { color }]}>{i + 1}</Text>
              <View style={[styles.dot, { backgroundColor: color }]} />
              <Text style={styles.name}>{m.name}</Text>
              <Text style={styles.amt}>{formatAud(m.value)}</Text>
            </View>
          );
        })
      )}
    </CollapsibleWidget>
  );
}

const styles = StyleSheet.create({
  summary: { color: Palette.textDim, fontSize: 12 },
  empty: { color: Palette.textMuted, fontSize: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.stroke,
  },
  rank: {
    width: 22,
    fontWeight: '800',
    fontSize: 13,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  name: { flex: 1, color: Palette.text, fontWeight: '600' },
  amt: { color: Palette.text, fontWeight: '800' },
});
