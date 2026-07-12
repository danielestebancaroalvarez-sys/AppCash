import { StyleSheet, Text } from 'react-native';
import { Screen } from '@/components/ui/Screen';
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
import { Palette, Spacing } from '@/constants/theme';
import { useFinanceStore } from '@/stores/finance-store';
import { usePeriodStats } from '@/hooks/use-period-stats';
import { useWidgetPrefs } from '@/hooks/use-widget-prefs';
import { useSheetRefresh } from '@/hooks/use-sheet-refresh';
import { recomputeProductStats } from '@/lib/insights/market';
import type { DashboardWidgetId } from '@/lib/dashboard/widgets';

export default function DashboardScreen() {
  const syncMessage = useFinanceStore((s) => s.syncMessage);
  const stats = usePeriodStats();
  const { isEnabled } = useWidgetPrefs();
  const { refreshing, onRefresh } = useSheetRefresh(async () => {
    await recomputeProductStats();
  });

  const show = (id: DashboardWidgetId) => isEnabled(id);

  return (
    <Screen onRefresh={onRefresh} refreshing={refreshing}>
      <PeriodSelector />
      <AppBalanceCard stats={stats} />

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
  sync: {
    color: Palette.textDim,
    fontSize: 11,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
});
