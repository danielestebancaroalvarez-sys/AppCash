import { StyleSheet, Text, View } from 'react-native';
import { CollapsibleWidget } from '@/components/ui/CollapsibleWidget';
import { WidgetTitle } from '@/components/dashboard/WidgetTitle';
import { PlainDailyBars } from '@/components/dashboard/charts';
import { Palette, Spacing } from '@/constants/theme';
import { formatAud } from '@/lib/money';
import type { PeriodStats } from '@/hooks/use-period-stats';

export function DailySpendWidget({ stats }: { stats: PeriodStats }) {
  const total = stats.dailyBars.reduce((a, b) => a + b.value, 0);
  const peak = stats.dailyBars.reduce(
    (best, b) => (b.value > best.value ? b : best),
    stats.dailyBars[0] ?? { label: '—', value: 0 }
  );

  return (
    <CollapsibleWidget
      accent={Palette.amber}
      header={<WidgetTitle icon="calendar-outline" title="Daily Spend" iconColor={Palette.amber} />}
      collapsedSummary={<Text style={styles.summary}>Week total {formatAud(total)}</Text>}>
      <View style={styles.meta}>
        <Text style={styles.metaText}>Week total {formatAud(total)}</Text>
        {peak.value > 0 ? (
          <Text style={styles.metaText}>
            Peak {peak.label} · {formatAud(peak.value)}
          </Text>
        ) : null}
      </View>
      <PlainDailyBars values={stats.dailyBars} color={Palette.amber} />
    </CollapsibleWidget>
  );
}

const styles = StyleSheet.create({
  summary: { color: Palette.textDim, fontSize: 12 },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    gap: 8,
  },
  metaText: { color: Palette.textMuted, fontSize: 12, fontWeight: '600' },
});
