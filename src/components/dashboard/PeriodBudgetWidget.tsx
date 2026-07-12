import { StyleSheet, Text, View } from 'react-native';
import { CollapsibleWidget } from '@/components/ui/CollapsibleWidget';
import { WidgetTitle } from '@/components/dashboard/WidgetTitle';
import { DashboardDonut } from '@/components/dashboard/charts';
import { Fonts, Palette, Spacing } from '@/constants/theme';
import { formatAud } from '@/lib/money';
import type { PeriodStats } from '@/hooks/use-period-stats';

const COLORS = {
  fixed: '#5B8CFF',
  variable: '#FF6B9A',
  savings: '#FF9F6B',
};

export function PeriodBudgetWidget({ stats }: { stats: PeriodStats }) {
  const segments = [
    { label: 'Fixed', value: stats.expenseFixed, color: COLORS.fixed },
    { label: 'Variable', value: stats.expenseVariable, color: COLORS.variable },
    { label: 'Savings', value: stats.savingsContrib, color: COLORS.savings },
  ];

  return (
    <CollapsibleWidget
      accent={COLORS.fixed}
      header={<WidgetTitle icon="pie-chart-outline" title="Period Budget" iconColor={COLORS.fixed} />}
      collapsedSummary={
        <Text style={styles.summary}>
          Income {formatAud(stats.incomeTotal)} · Free {formatAud(stats.free)}
        </Text>
      }>
      <DashboardDonut
        segments={segments}
        centerAmount={stats.incomeTotal}
        centerLabel="Income"
      />
      <View style={styles.divider} />
      <View style={styles.grid}>
        <View style={styles.col}>
          <Text style={[styles.big, { color: Palette.teal }]}>↑ {formatAud(stats.incomeTotal)}</Text>
          <Text style={[styles.line, { color: COLORS.variable }]}>
            Variable: {formatAud(stats.expenseVariable)}
          </Text>
          <Text style={styles.line}>Free: {formatAud(stats.free)}</Text>
        </View>
        <View style={styles.col}>
          <Text style={[styles.big, { color: COLORS.fixed }]}>
            ↓ {formatAud(stats.expenseFixed)} fixed
          </Text>
          <Text style={[styles.line, { color: COLORS.savings }]}>
            Savings: {formatAud(stats.savingsContrib)}
          </Text>
        </View>
      </View>
      <Text style={styles.footer}>
        Total savings accumulated: {formatAud(stats.totalSavingsAccumulated)}
      </Text>
    </CollapsibleWidget>
  );
}

const styles = StyleSheet.create({
  summary: { color: Palette.textDim, fontSize: 12 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Palette.stroke,
    marginVertical: Spacing.sm,
  },
  grid: { flexDirection: 'row', gap: 12 },
  col: { flex: 1, gap: 6 },
  big: { fontFamily: Fonts.display, fontWeight: '800', fontSize: 15 },
  line: { color: Palette.text, fontSize: 13, fontWeight: '600' },
  footer: { color: Palette.textMuted, fontSize: 12, marginTop: 4 },
});
