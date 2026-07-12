import { StyleSheet, Text, View } from 'react-native';
import { CollapsibleWidget } from '@/components/ui/CollapsibleWidget';
import { WidgetTitle } from '@/components/dashboard/WidgetTitle';
import { Palette } from '@/constants/theme';
import { formatAud } from '@/lib/money';
import type { PeriodStats } from '@/hooks/use-period-stats';

export function TopMerchantsWidget({ stats }: { stats: PeriodStats }) {
  return (
    <CollapsibleWidget
      accent={Palette.amber}
      header={<WidgetTitle icon="storefront-outline" title="Top Merchants" iconColor={Palette.amber} />}
      collapsedSummary={
        <Text style={styles.summary}>
          {stats.topMerchants[0]
            ? `${stats.topMerchants[0].name} · ${formatAud(stats.topMerchants[0].value)}`
            : 'No merchant spend yet'}
        </Text>
      }>
      {stats.topMerchants.length === 0 ? (
        <Text style={styles.empty}>Log expenses with a merchant name to see rankings.</Text>
      ) : (
        stats.topMerchants.map((m, i) => (
          <View key={m.name} style={styles.row}>
            <Text style={styles.rank}>{i + 1}</Text>
            <Text style={styles.name}>{m.name}</Text>
            <Text style={styles.amt}>{formatAud(m.value)}</Text>
          </View>
        ))
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
    color: Palette.amber,
    fontWeight: '800',
    fontSize: 13,
  },
  name: { flex: 1, color: Palette.text, fontWeight: '600' },
  amt: { color: Palette.text, fontWeight: '800' },
});
