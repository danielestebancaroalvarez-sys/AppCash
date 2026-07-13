import { StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { GlassPanel } from '@/components/ui/Primitives';
import { PeriodSelector } from '@/components/dashboard/PeriodSelector';
import { AppBalanceCard } from '@/components/dashboard/AppBalanceCard';
import { PeriodBudgetWidget } from '@/components/dashboard/PeriodBudgetWidget';
import { PeriodExpensesWidget } from '@/components/dashboard/PeriodExpensesWidget';
import { TrendWidget } from '@/components/dashboard/TrendWidget';
import { ExpensesByPersonWidget } from '@/components/dashboard/ExpensesByPersonWidget';
import { SavingsGoalsWidget } from '@/components/dashboard/SavingsGoalsWidget';
import { ConverterWidget } from '@/components/dashboard/ConverterWidget';
import { MarketWidget } from '@/components/dashboard/MarketWidget';
import { DailySpendWidget } from '@/components/dashboard/DailySpendWidget';
import { UpcomingBuysWidget } from '@/components/dashboard/UpcomingBuysWidget';
import { UpcomingBillsWidget } from '@/components/dashboard/UpcomingBillsWidget';
import { CashflowWidget } from '@/components/dashboard/CashflowWidget';
import { TopMerchantsWidget } from '@/components/dashboard/TopMerchantsWidget';
import { GoalsPaceWidget } from '@/components/dashboard/GoalsPaceWidget';
import { Fonts, Palette, Spacing } from '@/constants/theme';
import { useFinanceStore } from '@/stores/finance-store';
import { usePeriodStats } from '@/hooks/use-period-stats';
import { useWidgetPrefs } from '@/hooks/use-widget-prefs';
import { useSheetRefresh } from '@/hooks/use-sheet-refresh';
import { recomputeProductStats } from '@/lib/insights/market';
import {
  periodHasAnyData,
  widgetHasData,
  type DashboardWidgetId,
} from '@/lib/dashboard/widgets';

export default function DashboardScreen() {
  const syncMessage = useFinanceStore((s) => s.syncMessage);
  const stats = usePeriodStats();
  const { isEnabled } = useWidgetPrefs();
  const { refreshing, onRefresh } = useSheetRefresh(async () => {
    await recomputeProductStats();
  });

  const show = (id: DashboardWidgetId) => isEnabled(id) && widgetHasData(id, stats);
  const emptyPeriod = !periodHasAnyData(stats);

  return (
    <Screen onRefresh={onRefresh} refreshing={refreshing}>
      <PeriodSelector />
      <AppBalanceCard stats={stats} />

      {emptyPeriod ? (
        <GlassPanel style={styles.emptyPanel}>
          <Ionicons name="calendar-outline" size={28} color={Palette.cyan} />
          <Text style={styles.emptyTitle}>No data in this period</Text>
          <Text style={styles.emptyBody}>
            Add an expense, income or scan a receipt for {stats.label}, or switch the week above.
          </Text>
        </GlassPanel>
      ) : null}

      {show('period_budget') ? <PeriodBudgetWidget stats={stats} /> : null}
      {show('period_expenses') ? <PeriodExpensesWidget stats={stats} /> : null}
      {show('trend') ? <TrendWidget stats={stats} /> : null}
      {show('expenses_by_person') ? <ExpensesByPersonWidget stats={stats} /> : null}
      {show('savings_goals') ? <SavingsGoalsWidget stats={stats} /> : null}
      {show('cashflow') ? <CashflowWidget stats={stats} /> : null}
      {show('market') ? <MarketWidget stats={stats} /> : null}
      {show('daily_spend') ? <DailySpendWidget stats={stats} /> : null}
      {show('upcoming_buys') ? <UpcomingBuysWidget stats={stats} /> : null}
      {show('upcoming_bills') ? <UpcomingBillsWidget stats={stats} /> : null}
      {show('top_merchants') ? <TopMerchantsWidget stats={stats} /> : null}
      {show('goals_pace') ? <GoalsPaceWidget stats={stats} /> : null}
      {show('converter') ? <ConverterWidget /> : null}

      {syncMessage ? <Text style={styles.sync}>{syncMessage}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  emptyPanel: {
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  emptyTitle: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontWeight: '800',
    fontSize: 16,
  },
  emptyBody: {
    color: Palette.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  sync: {
    color: Palette.textDim,
    fontSize: 11,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
});
