import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { GlassPanel } from '@/components/ui/Primitives';
import { CollapsibleWidget } from '@/components/ui/CollapsibleWidget';
import { WidgetTitle } from '@/components/dashboard/WidgetTitle';
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
  HOME_PRIMARY_ORDER,
  HOME_SECONDARY_ORDER,
  periodHasAnyData,
  widgetHasData,
  type DashboardWidgetId,
} from '@/lib/dashboard/widgets';

function renderWidget(id: DashboardWidgetId, stats: ReturnType<typeof usePeriodStats>) {
  switch (id) {
    case 'period_budget':
      return <PeriodBudgetWidget stats={stats} />;
    case 'period_expenses':
      return <PeriodExpensesWidget stats={stats} />;
    case 'trend':
      return <TrendWidget stats={stats} />;
    case 'expenses_by_person':
      return <ExpensesByPersonWidget stats={stats} />;
    case 'savings_goals':
      return <SavingsGoalsWidget stats={stats} />;
    case 'cashflow':
      return <CashflowWidget stats={stats} />;
    case 'market':
      return <MarketWidget stats={stats} />;
    case 'daily_spend':
      return <DailySpendWidget stats={stats} />;
    case 'upcoming_buys':
      return <UpcomingBuysWidget stats={stats} />;
    case 'upcoming_bills':
      return <UpcomingBillsWidget stats={stats} />;
    case 'top_merchants':
      return <TopMerchantsWidget stats={stats} />;
    case 'goals_pace':
      return <GoalsPaceWidget stats={stats} />;
    case 'converter':
      return <ConverterWidget />;
    default:
      return null;
  }
}

export default function DashboardScreen() {
  const syncMessage = useFinanceStore((s) => s.syncMessage);
  const session = useFinanceStore((s) => s.session);
  const stats = usePeriodStats();
  const { isEnabled } = useWidgetPrefs();
  const { refreshing, onRefresh } = useSheetRefresh(async () => {
    await recomputeProductStats();
  });

  const show = (id: DashboardWidgetId) => isEnabled(id) && widgetHasData(id, stats);
  const emptyPeriod = !periodHasAnyData(stats);
  const primaryIds = HOME_PRIMARY_ORDER.filter(show);
  const secondaryIds = HOME_SECONDARY_ORDER.filter(show);

  return (
    <Screen onRefresh={onRefresh} refreshing={refreshing}>
      <PeriodSelector />
      <AppBalanceCard stats={stats} />

      {!session?.spreadsheetId ? (
        <Text style={styles.offlineHint}>
          Offline ledger · purchase sheet optional (Account → Purchase sheet)
        </Text>
      ) : null}

      {emptyPeriod ? (
        <GlassPanel style={styles.emptyPanel}>
          <Ionicons name="calendar-outline" size={28} color={Palette.cyan} />
          <Text style={styles.emptyTitle}>No data in this period</Text>
          <Text style={styles.emptyBody}>
            Add an expense, income or scan a receipt for {stats.label}, or switch the week above.
          </Text>
        </GlassPanel>
      ) : null}

      {primaryIds.map((id) => (
        <View key={id}>{renderWidget(id, stats)}</View>
      ))}

      {secondaryIds.length > 0 ? (
        <CollapsibleWidget
          accent={Palette.textDim}
          defaultExpanded={false}
          header={
            <WidgetTitle
              icon="layers-outline"
              title="More this period"
              iconColor={Palette.textMuted}
            />
          }
          collapsedSummary={
            <Text style={styles.moreSummary}>
              {secondaryIds.length} more insight{secondaryIds.length === 1 ? '' : 's'}
            </Text>
          }>
          {secondaryIds.map((id) => (
            <View key={id}>{renderWidget(id, stats)}</View>
          ))}
        </CollapsibleWidget>
      ) : null}

      {syncMessage ? <Text style={styles.sync}>{syncMessage}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  offlineHint: {
    color: Palette.textDim,
    fontFamily: Fonts.body,
    fontSize: 12,
    marginBottom: Spacing.sm,
  },
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
  moreSummary: { color: Palette.textDim, fontSize: 12 },
  sync: {
    color: Palette.textDim,
    fontSize: 11,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
});
