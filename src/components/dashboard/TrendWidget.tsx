import { StyleSheet, Text, View } from 'react-native';
import { CollapsibleWidget } from '@/components/ui/CollapsibleWidget';
import { WidgetTitle } from '@/components/dashboard/WidgetTitle';
import { TrendGroupedBars } from '@/components/dashboard/charts';
import { Palette } from '@/constants/theme';
import { formatAud } from '@/lib/money';
import type { PeriodStats } from '@/hooks/use-period-stats';

export function TrendWidget({ stats }: { stats: PeriodStats }) {
  const last = stats.trend[stats.trend.length - 1];
  return (
    <CollapsibleWidget
      accent={Palette.teal}
      header={<WidgetTitle icon="bar-chart-outline" title="Trend" iconColor={Palette.teal} />}
      collapsedSummary={
        <Text style={styles.summary}>
          This week {formatAud(last?.balance ?? 0)} balance
        </Text>
      }>
      <TrendGroupedBars weeks={stats.trend} />
      <View style={styles.foot}>
        <View style={styles.leg}>
          <View style={[styles.dot, { backgroundColor: Palette.teal }]} />
          <Text style={styles.legText}>Income</Text>
          <View style={[styles.dot, { backgroundColor: Palette.coral, marginLeft: 10 }]} />
          <Text style={styles.legText}>Expenses</Text>
        </View>
        <Text style={styles.note}>+/− = balance of the period</Text>
      </View>
    </CollapsibleWidget>
  );
}

const styles = StyleSheet.create({
  summary: { color: Palette.textDim, fontSize: 12 },
  foot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  leg: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legText: { color: Palette.textMuted, fontSize: 11 },
  note: { color: Palette.textDim, fontSize: 11 },
});
