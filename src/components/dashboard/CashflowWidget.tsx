import { StyleSheet, Text, View } from 'react-native';
import { CollapsibleWidget } from '@/components/ui/CollapsibleWidget';
import { WidgetTitle } from '@/components/dashboard/WidgetTitle';
import { AmountText } from '@/components/ui/Primitives';
import { Palette, Radii, Spacing } from '@/constants/theme';
import { formatAud } from '@/lib/money';
import type { PeriodStats } from '@/hooks/use-period-stats';

export function CashflowWidget({ stats }: { stats: PeriodStats }) {
  return (
    <CollapsibleWidget
      accent={Palette.teal}
      header={<WidgetTitle icon="pulse-outline" title="Cashflow Summary" iconColor={Palette.teal} />}
      collapsedSummary={
        <Text style={styles.summary}>Net {formatAud(stats.flow)}</Text>
      }>
      <View style={styles.grid}>
        <Kpi label="Fixed in" value={stats.incomeFixed} tone="income" />
        <Kpi label="Sporadic in" value={stats.incomeSporadic} tone="income" />
        <Kpi label="Fixed out" value={stats.expenseFixed} tone="expense" />
        <Kpi label="Variable out" value={stats.expenseVariable} tone="expense" />
      </View>
    </CollapsibleWidget>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'income' | 'expense';
}) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <AmountText value={formatAud(value)} tone={tone} size="md" />
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { color: Palette.textDim, fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  kpi: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: Palette.panelElevated,
    borderRadius: Radii.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Palette.stroke,
  },
  kpiLabel: { color: Palette.textMuted, fontSize: 12, marginBottom: 6 },
});
