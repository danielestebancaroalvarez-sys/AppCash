import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { GlassPanel } from '@/components/ui/Primitives';
import { EmptyState } from '@/components/ui/EmptyState';
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
import { OnboardingChecklist } from '@/components/onboarding/OnboardingChecklist';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useFinanceStore } from '@/stores/finance-store';
import { usePeriodStats } from '@/hooks/use-period-stats';
import { useWidgetPrefs } from '@/hooks/use-widget-prefs';
import { useSheetRefresh } from '@/hooks/use-sheet-refresh';
import { recomputeProductStats } from '@/lib/insights/market';
import {
  HOME_WIDGET_ORDER,
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
  const router = useRouter();
  const syncMessage = useFinanceStore((s) => s.syncMessage);
  const pendingSyncCount = useFinanceStore((s) => s.pendingSyncCount);
  const stats = usePeriodStats();
  const { isEnabled } = useWidgetPrefs();
  const { refreshing, onRefresh } = useSheetRefresh(async () => {
    await recomputeProductStats();
  });

  const show = (id: DashboardWidgetId) => isEnabled(id) && widgetHasData(id, stats);
  const emptyPeriod = !periodHasAnyData(stats);
  const widgetIds = HOME_WIDGET_ORDER.filter(show);

  return (
    <Screen onRefresh={onRefresh} refreshing={refreshing}>
      <PeriodSelector />
      <AppBalanceCard stats={stats} />

      <OnboardingChecklist />

      <Pressable
        onPress={() => router.push('/insights' as never)}
        style={({ pressed }) => [styles.marketShortcut, pressed && { opacity: 0.88 }]}
        accessibilityRole="button"
        accessibilityLabel="Open market prediction">
        <View style={styles.marketShortcutIcon}>
          <Ionicons name="trending-up-outline" size={18} color={Palette.teal} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.marketShortcutTitle}>Market prediction</Text>
          <Text style={styles.marketShortcutSub}>What to buy next from grocery history</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Palette.textDim} />
      </Pressable>

      {emptyPeriod ? (
        <GlassPanel style={styles.emptyPanel}>
          <EmptyState
            icon="calendar-outline"
            title="No data in this period"
            body={`Add an expense, income or scan a receipt for ${stats.label}, or switch the week above.`}
            actionLabel="Add expense"
            onAction={() => router.push('/(tabs)/add' as never)}
          />
        </GlassPanel>
      ) : null}

      {widgetIds.map((id) => (
        <View key={id}>{renderWidget(id, stats)}</View>
      ))}

      {syncMessage && !pendingSyncCount ? <Text style={styles.sync}>{syncMessage}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  emptyPanel: {
    marginBottom: Spacing.md,
  },
  marketShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: Spacing.sm,
    borderRadius: Radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.stroke,
    backgroundColor: Palette.panel,
  },
  marketShortcutIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(61,231,255,0.12)',
  },
  marketShortcutTitle: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontSize: 14,
    fontWeight: '700',
  },
  marketShortcutSub: { color: Palette.textDim, fontSize: 11, marginTop: 2 },
  sync: {
    color: Palette.textDim,
    fontSize: 11,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
});
