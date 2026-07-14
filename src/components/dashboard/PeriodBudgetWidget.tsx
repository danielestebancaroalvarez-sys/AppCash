import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CollapsibleWidget } from '@/components/ui/CollapsibleWidget';
import { WidgetTitle } from '@/components/dashboard/WidgetTitle';
import { DashboardDonut, CategoryBars } from '@/components/dashboard/charts';
import { FinanceColors, Fonts, Palette, Spacing } from '@/constants/theme';
import { formatAud } from '@/lib/money';
import type { PeriodStats } from '@/hooks/use-period-stats';

/** How this period’s income is allocated — fixed, variable, savings, leftover. */
export function PeriodBudgetWidget({ stats }: { stats: PeriodStats }) {
  const saved = stats.savingsContrib;
  const free = stats.free;
  const overspent = free < 0;

  const segments = useMemo(() => {
    return [
      { label: 'Fixed', value: stats.expenseFixed, color: FinanceColors.fixed },
      { label: 'Variable', value: stats.expenseVariable, color: FinanceColors.variable },
      { label: 'Savings', value: saved, color: FinanceColors.savings },
      { label: 'Free', value: Math.max(0, free), color: FinanceColors.income },
    ].filter((s) => s.value > 0);
  }, [stats.expenseFixed, stats.expenseVariable, saved, free]);

  return (
    <CollapsibleWidget
      accent={FinanceColors.fixed}
      accessibilityLabel="Period budget"
      header={
        <WidgetTitle icon="pie-chart-outline" title="Period Budget" iconColor={FinanceColors.fixed} />
      }
      collapsedSummary={
        <Text style={styles.summary}>
          Income {formatAud(stats.incomeTotal)} · Saved {formatAud(saved)} ·{' '}
          {overspent ? `Short ${formatAud(Math.abs(free))}` : `Free ${formatAud(free)}`}
        </Text>
      }>
      <View style={styles.kpiRow}>
        <Text style={[styles.kpi, { color: FinanceColors.income }]}>
          ↑ {formatAud(stats.incomeTotal)}
        </Text>
        <Text style={[styles.kpi, { color: FinanceColors.fixed }]}>
          Fixed {formatAud(stats.expenseFixed)}
        </Text>
        <Text style={[styles.kpi, { color: FinanceColors.variable }]}>
          Var {formatAud(stats.expenseVariable)}
        </Text>
        <Text style={[styles.kpi, { color: FinanceColors.savings }]}>
          Saved {formatAud(saved)}
        </Text>
      </View>

      {segments.length === 0 ? (
        <Text style={styles.empty}>No income or spend in this period yet.</Text>
      ) : (
        <>
          <DashboardDonut
            segments={segments}
            centerAmount={overspent ? Math.abs(free) : free}
            centerLabel={overspent ? 'Short' : 'Free'}
          />
          {overspent ? (
            <Text style={styles.over}>
              Spending exceeds income by {formatAud(Math.abs(free))}
            </Text>
          ) : null}
          <CategoryBars items={segments} />
          <Text style={styles.hint}>
            Includes savings contributions this period
            {saved > 0 ? ` (${formatAud(saved)})` : ''}
          </Text>
        </>
      )}
    </CollapsibleWidget>
  );
}

const styles = StyleSheet.create({
  summary: { color: Palette.textDim, fontSize: 12 },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: Spacing.sm,
  },
  kpi: { fontFamily: Fonts.display, fontSize: 13, fontWeight: '700' },
  empty: { color: Palette.textMuted, marginTop: Spacing.xs },
  over: {
    color: FinanceColors.expense,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  hint: {
    color: Palette.textDim,
    fontSize: 11,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
});
