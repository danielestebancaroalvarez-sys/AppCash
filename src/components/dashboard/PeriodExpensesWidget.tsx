import { StyleSheet, Text } from 'react-native';
import { CollapsibleWidget } from '@/components/ui/CollapsibleWidget';
import { WidgetTitle } from '@/components/dashboard/WidgetTitle';
import { CategoryBars, DashboardDonut } from '@/components/dashboard/charts';
import { Palette, Spacing } from '@/constants/theme';
import { formatAud } from '@/lib/money';
import type { PeriodStats } from '@/hooks/use-period-stats';

export function PeriodExpensesWidget({ stats }: { stats: PeriodStats }) {
  const total = stats.segments.reduce((a, s) => a + s.value, 0);
  const segments = stats.segments.length
    ? stats.segments
    : [{ id: '_', label: 'None', value: 0, color: Palette.stroke }];

  return (
    <CollapsibleWidget
      accent={Palette.coral}
      header={<WidgetTitle icon="pie-chart" title="Period Expenses" iconColor={Palette.coral} />}
      collapsedSummary={
        <Text style={styles.summary}>Total {formatAud(total)} · {stats.segments.length} categories</Text>
      }>
      {stats.segments.length === 0 ? (
        <Text style={styles.empty}>No expenses in this period yet.</Text>
      ) : (
        <>
          <DashboardDonut segments={segments} centerAmount={total} centerLabel="Total" />
          <CategoryBars items={stats.segments} />
        </>
      )}
    </CollapsibleWidget>
  );
}

const styles = StyleSheet.create({
  summary: { color: Palette.textDim, fontSize: 12 },
  empty: { color: Palette.textMuted, marginTop: Spacing.xs },
});
