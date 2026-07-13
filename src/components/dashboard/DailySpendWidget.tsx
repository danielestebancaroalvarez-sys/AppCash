import { StyleSheet, Text } from 'react-native';
import { CollapsibleWidget } from '@/components/ui/CollapsibleWidget';
import { WidgetTitle } from '@/components/dashboard/WidgetTitle';
import { PlainDailyBars } from '@/components/dashboard/charts';
import { Palette } from '@/constants/theme';
import { formatAud } from '@/lib/money';
import type { PeriodStats } from '@/hooks/use-period-stats';

export function DailySpendWidget({ stats }: { stats: PeriodStats }) {
  const total = stats.dailyBars.reduce((a, b) => a + b.value, 0);
  return (
    <CollapsibleWidget
      accent={Palette.amber}
      header={<WidgetTitle icon="calendar-outline" title="Daily Spend" iconColor={Palette.amber} />}
      collapsedSummary={<Text style={styles.summary}>Week total {formatAud(total)}</Text>}>
      <PlainDailyBars values={stats.dailyBars} color={Palette.amber} />
    </CollapsibleWidget>
  );
}

const styles = StyleSheet.create({
  summary: { color: Palette.textDim, fontSize: 12 },
});
